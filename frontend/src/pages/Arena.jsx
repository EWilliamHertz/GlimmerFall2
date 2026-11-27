import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { api, ensurePlayerSession } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import FeedbackModal from "@/components/FeedbackModal";
import ReplayViewer from "@/components/ReplayViewer";
import PlayHub from "@/arena/PlayHub";
import LobbyRoom from "@/arena/LobbyRoom";
import GameBoard from "@/arena/GameBoard";
import { useMatchStream } from "@/arena/useRealtime";

const SESSION_KEY = "glimmerfall_session_v2";

export default function Arena() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Active Private Lobby state (`?lobby=CODE` or created from PlayHub)
  const [lobbyCode, setLobbyCode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("lobby")?.trim().toUpperCase() || null;
  });
  const [lobbyInitialDeck, setLobbyInitialDeck] = useState(null);

  const [session, setSession] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const specId = p.get("spectateId");
    const repId = p.get("replayId");
    if (specId) {
      return {
        matchId: parseInt(specId, 10),
        slot: 0,
        roomCode: p.get("roomCode") || "",
        status: "PLAYING",
        isSpectator: true,
      };
    }
    if (repId) {
      return {
        matchId: parseInt(repId, 10),
        slot: 1,
        roomCode: "Replay",
        status: "ENDED",
        isReplay: true,
      };
    }
    if (p.get("lobby")) return null;
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  });

  // Auto-join private lobby when arriving via invite URL `?lobby=ABCDEF`
  useEffect(() => {
    const urlLobby = searchParams.get("lobby")?.trim().toUpperCase();
    if (!urlLobby) return;
    let cancelled = false;
    (async () => {
      try {
        await ensurePlayerSession("Challenger");
        await api.post(`/lobby/${urlLobby}/join`);
        if (!cancelled) {
          setSession(null);
          setLobbyCode(urlLobby);
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e.response?.data?.detail || "Could not join private lobby.");
          setLobbyCode(null);
          searchParams.delete("lobby");
          setSearchParams(searchParams, { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSession = useCallback(
    (next) => {
      setSession(next);
      if (next && !next.isReplay && !next.isSpectator) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
      if (!next) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("spectateId");
        nextParams.delete("replayId");
        nextParams.delete("roomCode");
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams]
  );

  const { match, setMatch, connected, clockOffsetMs } = useMatchStream(
    session?.matchId,
    Boolean(session?.isSpectator),
    Boolean(session && !session.isReplay)
  );

  const handleEnterLobby = (code, deckSel) => {
    persistSession(null);
    setLobbyInitialDeck(deckSel);
    setLobbyCode(code);
    setSearchParams({ lobby: code }, { replace: true });
  };

  const handleLeaveLobby = useCallback(() => {
    setLobbyCode(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("lobby");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleRematchShortcut = useCallback(
    (info) => {
      if (info?.returnToLobby) {
        persistSession(null);
        setLobbyCode(info.returnToLobby);
        setSearchParams({ lobby: info.returnToLobby }, { replace: true });
        return;
      }
      if (info?.matchId) {
        persistSession(info);
      }
    },
    [persistSession, setSearchParams]
  );

  // Replay View
  if (session?.isReplay) {
    return <ReplayViewer session={session} onExit={() => persistSession(null)} GameBoard={GameBoard} />;
  }

  // Live Match View
  if (session) {
    if (!match) {
      return (
        <div className="min-h-[70dvh] flex flex-col items-center justify-center gap-3 px-4 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#F2A900] border-t-transparent animate-spin" />
          <p className="font-head text-sm text-white/60">Entering the Arena…</p>
          <button
            onClick={() => persistSession(null)}
            className="mt-2 text-xs font-head text-white/40 hover:text-white underline"
          >
            Cancel &amp; return to Hub
          </button>
        </div>
      );
    }
    return (
      <GameBoard
        session={session}
        match={match}
        refresh={setMatch}
        onExit={() => persistSession(null)}
        onRematchShortcut={handleRematchShortcut}
        connected={connected}
        clockOffsetMs={clockOffsetMs}
      />
    );
  }

  // Private Lobby Staging Room
  if (lobbyCode) {
    return (
      <LobbyRoom
        code={lobbyCode}
        initialDeck={lobbyInitialDeck}
        onMatchStart={(matchSession) => {
          setLobbyCode(null);
          persistSession(matchSession);
        }}
        onLeave={handleLeaveLobby}
      />
    );
  }

  // Default Arena Command Center
  return (
    <>
      <PlayHub onEnterMatch={persistSession} onEnterLobby={handleEnterLobby} />
      <button
        onClick={() => setFeedbackOpen(true)}
        className="hidden md:flex fixed bottom-5 right-5 z-[80] px-3.5 py-2 glass rounded-full text-white/55 hover:text-white font-head text-xs items-center gap-1.5"
      >
        <MessageSquare className="w-3.5 h-3.5" /> Feedback
      </button>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} user={user} />
    </>
  );
}
