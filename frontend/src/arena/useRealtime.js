import { useCallback, useEffect, useRef, useState } from "react";
import { api, buildWsUrl } from "@/lib/api";

/**
 * Realtime match stream: WebSocket primary (`/api/ws/match/{id}`) with automatic
 * fallback to version-diffed HTTP polling (`/api/v2/match/{id}?since=v`).
 */
export function useMatchStream(matchId, isSpectator = false, enabled = true) {
  const [match, setMatch] = useState(null);
  const [connected, setConnected] = useState(true);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const versionRef = useRef(null);
  const wsActiveRef = useRef(false);

  const applyPayload = useCallback((data) => {
    if (!data) return;
    if (typeof data.serverTime === "number") {
      setClockOffsetMs(data.serverTime - Date.now());
    }
    if (data.unchanged) return;
    if (data.version !== undefined) {
      versionRef.current = data.version;
    }
    setMatch(data);
  }, []);

  const fetchOnce = useCallback(
    async (forceFull = false) => {
      if (!matchId || !enabled) return;
      try {
        const params = {};
        if (isSpectator) params.spectate = true;
        if (!forceFull && versionRef.current !== null) {
          params.since = versionRef.current;
        }
        const r = await api.get(`/v2/match/${matchId}`, { params });
        setConnected(true);
        applyPayload(r.data);
      } catch {
        // Fallback to legacy endpoint if needed
        try {
          const r2 = await api.get("/match", {
            params: { id: matchId, isSpectator },
          });
          setConnected(true);
          applyPayload(r2.data);
        } catch {
          setConnected(false);
        }
      }
    },
    [matchId, isSpectator, enabled, applyPayload]
  );

  useEffect(() => {
    if (!matchId || !enabled) {
      setMatch(null);
      versionRef.current = null;
      return;
    }

    let cancelled = false;
    let ws = null;
    let pollTimer = null;
    let reconnectTimer = null;

    const startPolling = (intervalMs = 1500) => {
      if (pollTimer || cancelled) return;
      pollTimer = setInterval(() => {
        if (!wsActiveRef.current) fetchOnce(false);
      }, intervalMs);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const connectWs = () => {
      if (cancelled || typeof WebSocket === "undefined") {
        startPolling(1500);
        return;
      }
      try {
        const url = buildWsUrl(`/api/ws/match/${matchId}`, {
          spectate: isSpectator ? "true" : undefined,
        });
        ws = new WebSocket(url);
        ws.onopen = () => {
          if (cancelled) return;
          wsActiveRef.current = true;
          setConnected(true);
          // Keep a slow safety heartbeat poll in case proxies buffer
          stopPolling();
          startPolling(8000);
        };
        ws.onmessage = (ev) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "state" && msg.match) {
              applyPayload(msg.match);
            } else if (msg.type === "ping" && typeof msg.serverTime === "number") {
              setClockOffsetMs(msg.serverTime - Date.now());
            }
          } catch {
            // ignore malformed frame
          }
        };
        ws.onerror = () => {
          wsActiveRef.current = false;
        };
        ws.onclose = () => {
          wsActiveRef.current = false;
          if (!cancelled) {
            stopPolling();
            startPolling(1500);
            reconnectTimer = setTimeout(connectWs, 4000);
          }
        };
      } catch {
        wsActiveRef.current = false;
        startPolling(1500);
      }
    };

    fetchOnce(true);
    connectWs();

    return () => {
      cancelled = true;
      wsActiveRef.current = false;
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [matchId, isSpectator, enabled, fetchOnce, applyPayload]);

  const updateMatchOptimistic = useCallback(
    (matchOrState) => {
      if (!matchOrState) return;
      if (matchOrState.matchId && matchOrState.state) {
        applyPayload(matchOrState);
      } else {
        setMatch((prev) =>
          prev
            ? {
                ...prev,
                state: matchOrState,
                status: matchOrState.phase,
                turn: matchOrState.turn,
                activePlayer: matchOrState.activePlayer,
                version: matchOrState.version ?? prev.version,
              }
            : prev
        );
      }
    },
    [applyPayload]
  );

  return { match, setMatch: updateMatchOptimistic, refreshNow: () => fetchOnce(true), connected, clockOffsetMs };
}

/**
 * Realtime matchmaking queue stream: WebSocket + HTTP heartbeat fallback.
 */
export function useQueueStream(searching, onMatched) {
  const [queueState, setQueueState] = useState(null);
  const onMatchedRef = useRef(onMatched);
  onMatchedRef.current = onMatched;

  useEffect(() => {
    if (!searching) {
      setQueueState(null);
      return;
    }

    let cancelled = false;
    let ws = null;
    let hbTimer = null;

    const handleStatus = (data) => {
      if (cancelled || !data) return;
      setQueueState(data);
      if (data.status === "matched" && data.matchId) {
        onMatchedRef.current?.(data);
      }
    };

    const pollHeartbeat = async () => {
      try {
        const r = await api.post("/queue/heartbeat");
        handleStatus(r.data);
      } catch {}
    };

    if (typeof WebSocket !== "undefined") {
      try {
        ws = new WebSocket(buildWsUrl("/api/ws/queue"));
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "queue") handleStatus(msg);
          } catch {}
        };
      } catch {}
    }

    pollHeartbeat();
    hbTimer = setInterval(pollHeartbeat, 2500);

    return () => {
      cancelled = true;
      if (hbTimer) clearInterval(hbTimer);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [searching]);

  return queueState;
}

/**
 * Realtime private lobby stream: WebSocket + HTTP polling fallback.
 */
export function useLobbyStream(lobbyCode, enabled = true) {
  const [lobby, setLobby] = useState(null);
  const [closedReason, setClosedReason] = useState(null);

  const refreshLobby = useCallback(async () => {
    if (!lobbyCode || !enabled) return;
    try {
      const r = await api.get(`/lobby/${lobbyCode}`);
      setLobby(r.data);
    } catch (e) {
      if (e.response?.status === 404) {
        setClosedReason("Lobby closed or expired.");
      }
    }
  }, [lobbyCode, enabled]);

  useEffect(() => {
    if (!lobbyCode || !enabled) {
      setLobby(null);
      setClosedReason(null);
      return;
    }

    let cancelled = false;
    let ws = null;
    let pollTimer = null;

    refreshLobby();
    pollTimer = setInterval(refreshLobby, 3000);

    if (typeof WebSocket !== "undefined") {
      try {
        ws = new WebSocket(buildWsUrl(`/api/ws/lobby/${lobbyCode}`));
        ws.onmessage = (ev) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "lobby" && msg.lobby) {
              setLobby(msg.lobby);
            } else if (msg.type === "closed") {
              setClosedReason(msg.detail || "Lobby was closed by the host.");
            }
          } catch {}
        };
      } catch {}
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (ws) {
        try {
          ws.close();
        } catch {}
      }
    };
  }, [lobbyCode, enabled, refreshLobby]);

  return { lobby, setLobby, refreshLobby, closedReason };
}
