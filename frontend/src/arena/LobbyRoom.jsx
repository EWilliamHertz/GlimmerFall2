import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Share2,
  Check,
  Crown,
  User,
  Layers,
  Clock,
  LogOut,
  UserMinus,
  ShieldCheck,
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import DeckSelectorSheet, { STARTER_DECK_PRESETS } from "./DeckSelectorSheet";
import { useLobbyStream } from "./useRealtime";

export default function LobbyRoom({ code, initialDeck, onMatchStart, onLeave }) {
  const { user } = useAuth();
  const { lobby, setLobby, closedReason } = useLobbyStream(code, true);
  const [showDeckSheet, setShowDeckSheet] = useState(false);
  const [personalDecks, setPersonalDecks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [copiedType, setCopiedType] = useState(null);

  useEffect(() => {
    if (closedReason) {
      toast.info(closedReason);
      onLeave();
    }
  }, [closedReason, onLeave]);

  // Auto-enter match when both readied and match is live!
  useEffect(() => {
    if (
      lobby?.matchId &&
      lobby?.matchStatus &&
      lobby.matchStatus !== "ENDED" &&
      lobby.slot in { 1: true, 2: true }
    ) {
      onMatchStart({
        matchId: lobby.matchId,
        slot: lobby.slot,
        lobbyCode: lobby.code,
        mode: "private",
        status: lobby.matchStatus,
      });
    }
  }, [lobby, onMatchStart]);

  useEffect(() => {
    if (user) {
      api
        .get("/auth/me/decks")
        .then((r) => {
          setPersonalDecks(
            (r.data || []).map((d) => ({
              id: d.id,
              name: d.deck_name,
              cards: (d.cards || []).map((c) => ({
                id: c.card_id || c.card_name,
                name: c.card_name,
                count: c.count,
              })),
            }))
          );
        })
        .catch(() => {});
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem("glimmerfall_decks") || "[]");
        setPersonalDecks(Array.isArray(stored) ? stored : Object.values(stored));
      } catch {}
    }
  }, [user]);

  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play?lobby=${code}` : `/play?lobby=${code}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedType("code");
      toast.success("Lobby code copied!");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {}
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedType("link");
      toast.success("Invite link copied!");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {}
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "GlimmerFall Private Duel",
          text: `Challenge me in GlimmerFall! Room Code: ${code}`,
          url: inviteUrl,
        });
        return;
      } catch {}
    }
    copyLink();
  };

  const updateDeck = async (deckPayload) => {
    setBusy(true);
    try {
      const r = await api.post(`/lobby/${code}/deck`, deckPayload);
      setLobby(r.data);
      toast.success(`Equipped ${deckPayload.deckName}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to update deck.");
    } finally {
      setBusy(false);
    }
  };

  const toggleReady = async () => {
    if (!lobby) return;
    const isHost = lobby.you === "host";
    const myReady = isHost ? lobby.hostReady : lobby.guestReady;
    const hasDeck = isHost ? lobby.hostHasDeck : lobby.guestHasDeck;

    if (!hasDeck) {
      await updateDeck({
        faction: initialDeck?.faction ?? STARTER_DECK_PRESETS[0].factions,
        deckCards: initialDeck?.deckCards ?? null,
        deckName: initialDeck?.deckName ?? STARTER_DECK_PRESETS[0].name,
      });
    }

    setBusy(true);
    try {
      const r = await api.post(`/lobby/${code}/ready`, { ready: !myReady });
      setLobby(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not toggle ready state.");
    } finally {
      setBusy(false);
    }
  };

  const updateSettings = async (patch) => {
    try {
      const r = await api.post(`/lobby/${code}/settings`, patch);
      setLobby(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not update settings.");
    }
  };

  const handleKick = async () => {
    try {
      const r = await api.post(`/lobby/${code}/kick`);
      setLobby(r.data);
      toast.info("Removed challenger from lobby.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not kick challenger.");
    }
  };

  const handleLeave = async () => {
    try {
      await api.post(`/lobby/${code}/leave`);
    } catch {}
    onLeave();
  };

  if (!lobby) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center font-head text-white/60">
        Connecting to Private Lobby <span className="text-[#F2A900] font-mono">{code}</span>…
      </div>
    );
  }

  const isHost = lobby.you === "host";
  const myReady = isHost ? lobby.hostReady : lobby.guestReady;
  const myDeckName = isHost ? lobby.hostDeck : lobby.guestDeck;
  const score = lobby.settings?.score || { host: 0, guest: 0 };
  const turnSeconds = lobby.settings?.turnSeconds ?? 120;
  const bestOf = lobby.settings?.bestOf ?? 1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-head uppercase tracking-widest text-[#C77DFF] font-bold">
            Private Duel Room
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black">Lobby Staging</h1>
        </div>
        <button
          onClick={handleLeave}
          className="px-3.5 py-2 rounded-xl glass text-xs font-head font-semibold text-white/70 hover:text-white flex items-center gap-1.5"
        >
          <LogOut className="w-4 h-4" /> {isHost ? "Close Room" : "Leave"}
        </button>
      </div>

      {/* Invite Banner */}
      <div className="glass-strong rounded-3xl p-5 border border-[#9B30FF]/35 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <div className="text-[11px] font-head uppercase tracking-widest text-white/45 font-bold">
            Room Invite Code
          </div>
          <button
            onClick={copyCode}
            data-testid="waiting-room-code"
            className="mt-1 font-mono text-3xl sm:text-4xl font-black tracking-[0.25em] text-[#F2A900] hover:opacity-85 transition-opacity"
          >
            {lobby.code}
          </button>
          <p className="text-xs text-white/50 font-head mt-1">
            Share this code or invite link — match begins automatically when both players click Ready!
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={copyCode}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-head text-xs font-bold flex items-center justify-center gap-1.5"
          >
            {copiedType === "code" ? <Check className="w-4 h-4 text-[#22E07B]" /> : <Copy className="w-4 h-4" />}
            Code
          </button>
          <button
            onClick={copyLink}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-head text-xs font-bold flex items-center justify-center gap-1.5"
          >
            {copiedType === "link" ? <Check className="w-4 h-4 text-[#22E07B]" /> : <LinkIcon className="w-4 h-4" />}
            Invite Link
          </button>
          <button
            onClick={shareNative}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#9B30FF] hover:bg-[#ad4dff] text-white font-head text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      {/* Series Score + Match Rules */}
      <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-head uppercase tracking-wider text-white/50 font-bold">
            Series ({bestOf === 3 ? "Best of 3" : "Single Game"}):
          </span>
          <span className="font-num text-xl font-bold text-[#F2A900]">
            {score.host} <span className="text-white/30 mx-1">–</span> {score.guest}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-white/45 mr-1" />
          {[
            { label: "60s", val: 60 },
            { label: "90s", val: 90 },
            { label: "120s", val: 120 },
            { label: "Untimed", val: 0 },
          ].map((opt) => (
            <button
              key={opt.val}
              disabled={!isHost}
              onClick={() => updateSettings({ turnSeconds: opt.val })}
              className={`px-2.5 py-1 rounded-lg text-xs font-head font-bold transition-colors ${
                turnSeconds === opt.val
                  ? "bg-[#F2A900] text-black"
                  : "bg-white/5 text-white/50 hover:text-white disabled:opacity-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="w-px h-4 bg-white/10 mx-1" />
          {[1, 3].map((bo) => (
            <button
              key={bo}
              disabled={!isHost}
              onClick={() => updateSettings({ bestOf: bo })}
              className={`px-2.5 py-1 rounded-lg text-xs font-head font-bold transition-colors ${
                bestOf === bo
                  ? "bg-[#00BFFF] text-black"
                  : "bg-white/5 text-white/50 hover:text-white disabled:opacity-50"
              }`}
            >
              Bo{bo}
            </button>
          ))}
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Host Seat */}
        <div
          className={`glass rounded-3xl p-5 border-2 transition-all ${
            lobby.hostReady ? "border-[#22E07B] bg-[#22E07B]/5" : "border-white/10"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-head font-bold text-[#F2A900]">
              <Crown className="w-4 h-4" /> Host {isHost ? "(You)" : ""}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-head font-bold ${
                lobby.hostReady ? "bg-[#22E07B] text-black" : "bg-white/10 text-white/55"
              }`}
            >
              {lobby.hostReady ? "READY" : "Preparing"}
            </span>
          </div>
          <div className="font-display text-xl font-bold text-white truncate">{lobby.host}</div>
          <div className="mt-3 p-3 rounded-2xl bg-black/35 border border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-[#F2A900] shrink-0" />
              <span className="text-xs font-head text-white/80 truncate">
                {lobby.hostDeck || "No deck chosen"}
              </span>
            </div>
            {isHost && (
              <button
                onClick={() => setShowDeckSheet(true)}
                className="text-xs font-head font-bold text-[#00BFFF] hover:underline shrink-0"
              >
                Change
              </button>
            )}
          </div>
        </div>

        {/* Guest / Challenger Seat */}
        <div
          className={`glass rounded-3xl p-5 border-2 transition-all ${
            lobby.guestReady ? "border-[#22E07B] bg-[#22E07B]/5" : "border-white/10"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-head font-bold text-[#00BFFF]">
              <User className="w-4 h-4" /> Challenger {lobby.you === "guest" ? "(You)" : ""}
            </span>
            {lobby.guest ? (
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-head font-bold ${
                    lobby.guestReady ? "bg-[#22E07B] text-black" : "bg-white/10 text-white/55"
                  }`}
                >
                  {lobby.guestReady ? "READY" : "Preparing"}
                </span>
                {isHost && (
                  <button
                    onClick={handleKick}
                    title="Remove Challenger"
                    className="p-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[11px] font-head text-white/35 italic">Open Seat</span>
            )}
          </div>

          {lobby.guest ? (
            <>
              <div className="font-display text-xl font-bold text-white truncate">{lobby.guest}</div>
              <div className="mt-3 p-3 rounded-2xl bg-black/35 border border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="w-4 h-4 text-[#00BFFF] shrink-0" />
                  <span className="text-xs font-head text-white/80 truncate">
                    {lobby.guestDeck || "Selecting deck…"}
                  </span>
                </div>
                {lobby.you === "guest" && (
                  <button
                    onClick={() => setShowDeckSheet(true)}
                    className="text-xs font-head font-bold text-[#00BFFF] hover:underline shrink-0"
                  >
                    Change
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="py-6 text-center">
              <Sparkles className="w-6 h-6 text-white/25 mx-auto mb-2 animate-pulse" />
              <p className="text-xs font-head text-white/45">
                Waiting for a friend to join with code <strong className="text-white">{lobby.code}</strong>…
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      {lobby.you && (
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => setShowDeckSheet(true)}
            className="sm:w-56 py-3.5 px-5 rounded-2xl glass font-head font-bold text-sm text-white hover:border-white/30 flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4 text-[#F2A900]" /> {myDeckName ? "Switch Deck" : "Choose Deck"}
          </button>
          <button
            onClick={toggleReady}
            disabled={busy}
            data-testid="lobby-ready-btn"
            className={`flex-1 py-3.5 px-6 rounded-2xl font-head font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg ${
              myReady
                ? "bg-white/15 border border-white/25 text-white hover:bg-white/20"
                : "bg-[#22E07B] hover:bg-[#39E58C] text-black shadow-[0_0_25px_rgba(34,224,123,0.4)]"
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            {myReady ? "Ready! (Tap to Unready)" : "Lock In & Ready Up"}
          </button>
        </div>
      )}

      <DeckSelectorSheet
        open={showDeckSheet}
        onClose={() => setShowDeckSheet(false)}
        personalDecks={personalDecks}
        selectedDeckName={myDeckName}
        onSelectStarter={(d) => {
          setShowDeckSheet(false);
          updateDeck({ faction: d.factions, deckCards: null, deckName: d.name });
        }}
        onSelectPersonal={(pd) => {
          const list = [];
          (pd.cards || []).forEach((c) => {
            for (let i = 0; i < (c.count || 1); i++) list.push(c.name || c.id);
          });
          setShowDeckSheet(false);
          updateDeck({ faction: null, deckCards: list, deckName: pd.name });
        }}
      />
    </div>
  );
}
