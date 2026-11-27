import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Swords,
  Bot,
  Users,
  Trophy,
  Layers,
  Sparkles,
  GraduationCap,
  BookOpen,
  Play,
  ArrowRight,
  Clock,
  Shield,
  X,
  Lock,
  Radio,
} from "lucide-react";
import { api, ensurePlayerSession, openAuthModal, GUEST_NAME_KEY } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import DeckSelectorSheet, { STARTER_DECK_PRESETS } from "./DeckSelectorSheet";
import { useQueueStream } from "./useRealtime";

const DECK_CHOICE_KEY = "gf_selected_deck_v2";

export default function PlayHub({ onEnterMatch, onEnterLobby }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [guestInput, setGuestInput] = useState(
    () => localStorage.getItem("gf_username") || localStorage.getItem(GUEST_NAME_KEY)?.split(" #")[0] || ""
  );
  const [deckSelection, setDeckSelection] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DECK_CHOICE_KEY) || "null");
      if (saved?.deckName) return saved;
    } catch {}
    return {
      deckName: STARTER_DECK_PRESETS[0].name,
      faction: STARTER_DECK_PRESETS[0].factions,
      deckCards: null,
      color: STARTER_DECK_PRESETS[0].color,
    };
  });

  const [showDeckSheet, setShowDeckSheet] = useState(false);
  const [personalDecks, setPersonalDecks] = useState([]);
  const [stats, setStats] = useState({ ranked: 0, casual: 0, liveMatches: 0 });
  const [featuredGames, setFeaturedGames] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);

  const [searchingMode, setSearchingMode] = useState(null); // "ranked" | "casual" | null
  const [busyAction, setBusyAction] = useState(null);

  // Private lobby controls
  const [lobbyCodeInput, setLobbyCodeInput] = useState("");
  const [lobbyTimer, setLobbyTimer] = useState(120);
  const [lobbyBestOf, setLobbyBestOf] = useState(1);

  const saveDeckSelection = (sel) => {
    setDeckSelection(sel);
    localStorage.setItem(DECK_CHOICE_KEY, JSON.stringify(sel));
  };

  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId) {
      api
        .get("/auth/me/decks")
        .then((r) => {
          const decks = (r.data || []).map((d) => ({
            id: d.id,
            name: d.deck_name,
            cards: (d.cards || []).map((c) => ({
              id: c.card_id || c.card_name,
              name: c.card_name,
              count: c.count,
            })),
          }));
          setPersonalDecks(decks);
        })
        .catch(() => setPersonalDecks([]));
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem("glimmerfall_decks") || "[]");
        setPersonalDecks(Array.isArray(stored) ? stored : Object.values(stored));
      } catch {
        setPersonalDecks([]);
      }
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    const pollHub = async () => {
      try {
        const [qRes, fRes] = await Promise.all([
          api.get("/queue/stats").catch(() => ({ data: { ranked: 0, casual: 0, liveMatches: 0 } })),
          api.get("/featured").catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;
        setStats(qRes.data || { ranked: 0, casual: 0, liveMatches: 0 });
        setFeaturedGames(fRes.data || []);
      } catch {}
    };

    const checkActive = async () => {
      try {
        if (userId || localStorage.getItem("glimmerfall_guest_token")) {
          const r = await api.get("/me/active-match");
          if (mounted && r.data?.matchId) setActiveMatch(r.data);
          else if (mounted) setActiveMatch(null);
        }
      } catch {}
    };

    pollHub();
    checkActive();
    const timer = setInterval(pollHub, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [userId]);

  const queueState = useQueueStream(Boolean(searchingMode), (matched) => {
    setSearchingMode(null);
    toast.success(`Match found vs ${matched.opponent || "Challenger"}!`);
    onEnterMatch({
      matchId: matched.matchId,
      slot: matched.slot,
      mode: matched.mode || searchingMode,
      status: "PLAYING",
    });
  });

  const prepareSession = async () => {
    if (!user && guestInput.trim()) {
      localStorage.setItem("gf_username", guestInput.trim());
    }
    return ensurePlayerSession(guestInput.trim() || "Summoner");
  };

  const describePlayError = (e, fallback) => {
    const detail = e?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (e?.response?.status === 401 || e?.response?.status === 403) {
      return "Your session expired — please sign in again.";
    }
    if (!e?.response) {
      return `${fallback} (Network error reaching game server — please refresh the page once.)`;
    }
    return fallback;
  };

  const handleJoinQueue = async (mode) => {
    if (mode === "ranked" && !user) {
      toast.info("Sign in or create a free account to compete on the Ranked Elo Ladder!");
      openAuthModal("login");
      return;
    }
    setBusyAction(mode);
    try {
      await prepareSession();
      const r = await api.post("/queue/join", {
        mode,
        faction: deckSelection.faction,
        deckCards: deckSelection.deckCards,
        deckName: deckSelection.deckName,
      });
      if (r.data.status === "matched" && r.data.matchId) {
        onEnterMatch({
          matchId: r.data.matchId,
          slot: r.data.slot,
          mode,
          status: "PLAYING",
        });
      } else {
        setSearchingMode(mode);
      }
    } catch (e) {
      if (e?.response?.status === 401 && mode === "ranked") {
        toast.info("Please sign in again to join Ranked.");
        openAuthModal("login");
      } else {
        toast.error(describePlayError(e, "Could not join matchmaking queue."));
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelQueue = async () => {
    setSearchingMode(null);
    try {
      await api.post("/queue/leave");
    } catch {}
  };

  const handlePlayBot = async () => {
    setBusyAction("bot");
    try {
      if (searchingMode) {
        await api.post("/queue/leave").catch(() => {});
        setSearchingMode(null);
      }
      await prepareSession();
      const r = await api.post("/v2/bot", {
        faction: deckSelection.faction,
        deckCards: deckSelection.deckCards,
        deckName: deckSelection.deckName,
      });
      onEnterMatch({
        matchId: r.data.matchId,
        slot: 1,
        mode: "bot",
        vsAI: true,
        status: "PLAYING",
      });
    } catch (e) {
      toast.error(describePlayError(e, "Could not start GlimmerBot match."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateLobby = async () => {
    setBusyAction("create-lobby");
    try {
      await prepareSession();
      const r = await api.post("/lobby", {
        turnSeconds: lobbyTimer,
        bestOf: lobbyBestOf,
        allowSpectators: true,
      });
      // Pre-load selected deck into the lobby right away for smooth UX
      await api
        .post(`/lobby/${r.data.code}/deck`, {
          faction: deckSelection.faction,
          deckCards: deckSelection.deckCards,
          deckName: deckSelection.deckName,
        })
        .catch(() => {});
      onEnterLobby(r.data.code, deckSelection);
    } catch (e) {
      toast.error(describePlayError(e, "Could not create private lobby."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleJoinLobby = async () => {
    const code = lobbyCodeInput.trim().toUpperCase();
    if (!code) {
      return handleCreateLobby();
    }
    setBusyAction("join-lobby");
    try {
      await prepareSession();
      await api.post(`/lobby/${code}/join`);
      await api
        .post(`/lobby/${code}/deck`, {
          faction: deckSelection.faction,
          deckCards: deckSelection.deckCards,
          deckName: deckSelection.deckName,
        })
        .catch(() => {});
      onEnterLobby(code, deckSelection);
    } catch (e) {
      toast.error(describePlayError(e, "Lobby not found or already full."));
    } finally {
      setBusyAction(null);
    }
  };

  const selectStarter = (d) => {
    saveDeckSelection({
      deckName: d.name,
      faction: d.factions,
      deckCards: null,
      color: d.color,
    });
    setShowDeckSheet(false);
  };

  const selectPersonal = (pd) => {
    const list = [];
    (pd.cards || []).forEach((c) => {
      for (let i = 0; i < (c.count || 1); i++) list.push(c.name || c.id);
    });
    saveDeckSelection({
      deckName: pd.name,
      faction: null,
      deckCards: list,
      color: "#F2A900",
    });
    setShowDeckSheet(false);
  };

  const tutorialDone =
    Boolean(user?.tutorial_done) || localStorage.getItem("gf_tutorial_done") === "true";

  const mmr = user?.matchmaking?.mmr ?? 1400;
  const rankName = user?.matchmaking?.rank || "Gold II";
  const rankColor = user?.matchmaking?.color || "#F2A900";
  const placementLeft = user?.matchmaking?.placement_games_left ?? 0;

  const formatWait = (sec = 0) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-10 space-y-5">
      {/* Header + Live Pulse */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-head text-white/70 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#22E07B] animate-pulse" />
            <span>{stats.liveMatches} Live Battles</span>
            <span className="text-white/25">•</span>
            <span>{stats.ranked + stats.casual} Searching</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight">
            BATTLE <span className="text-[#F2A900]">ARENA</span>
          </h1>
          <p className="text-white/55 font-head text-sm sm:text-base mt-1">
            Compete on the Ranked Elo Ladder, duel in Casual queues, or host a Private Lobby.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/learn"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl glass text-xs font-head font-semibold text-white/80 hover:text-white hover:border-white/25"
          >
            <BookOpen className="w-4 h-4 text-[#F2A900]" /> How to Play
          </Link>
          <Link
            to="/sandbox"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00BFFF]/15 border border-[#00BFFF]/35 text-xs font-head font-bold text-[#00BFFF] hover:bg-[#00BFFF]/25"
          >
            <GraduationCap className="w-4 h-4" /> Tutorial
          </Link>
        </div>
      </div>

      {/* Reconnect Banner if player has a live match */}
      {activeMatch && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 bg-gradient-to-r from-[#22E07B]/20 via-[#00BFFF]/15 to-transparent border border-[#22E07B]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-[#22E07B] animate-pulse shrink-0" />
            <div>
              <div className="font-head font-bold text-sm text-white">
                Match in Progress vs {activeMatch.opponent}
              </div>
              <div className="text-xs text-white/60 font-head capitalize">
                {activeMatch.mode} match · Rejoin before the 60s disconnect timer expires!
              </div>
            </div>
          </div>
          <button
            onClick={() =>
              onEnterMatch({
                matchId: activeMatch.matchId,
                slot: activeMatch.slot,
                mode: activeMatch.mode,
                lobbyCode: activeMatch.lobbyCode,
                status: "PLAYING",
              })
            }
            className="px-5 py-2.5 rounded-xl bg-[#22E07B] text-black font-head font-bold text-sm hover:opacity-95 shrink-0"
          >
            Reconnect Now
          </button>
        </motion.div>
      )}

      {/* First-Time Tutorial Onboarding Banner */}
      {!tutorialDone && (
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-[#00BFFF]/15 via-[#9B30FF]/15 to-[#F2A900]/15 border border-[#00BFFF]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#00BFFF]/20 border border-[#00BFFF]/40 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 text-[#00BFFF]" />
            </div>
            <div>
              <div className="text-xs font-head uppercase tracking-widest text-[#00BFFF] font-bold">
                New to GlimmerFall?
              </div>
              <h2 className="font-display text-lg font-bold text-white">
                Master Glimmer Nodes &amp; Combat in 2 Minutes
              </h2>
              <p className="text-xs sm:text-sm text-white/65 font-head mt-0.5">
                Play a guided hands-on training match using the real game engine — learn how any card becomes Energy!
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/sandbox")}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#00BFFF] text-black font-head font-bold text-sm hover:bg-[#38ccff] transition-colors flex items-center justify-center gap-2 shrink-0 shadow-[0_0_20px_rgba(0,191,255,0.35)]"
          >
            Play Tutorial <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Identity + Active Deck Loadout Strip */}
      <div className="glass rounded-3xl p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Summoner Identity */}
        <div className="flex flex-col justify-between">
          <label className="text-[11px] font-head uppercase tracking-widest text-white/45 font-bold mb-1.5">
            Summoner Identity
          </label>
          {user ? (
            <div className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F2A900] shrink-0" />
                  <span className="font-head font-bold text-white truncate">{user.nickname}</span>
                </div>
                <div className="text-xs text-white/50 font-head mt-0.5">
                  {placementLeft > 0
                    ? `Provisional · ${placementLeft} placement game${placementLeft === 1 ? "" : "s"} left`
                    : `${user.wins || 0}W – ${user.losses || 0}L Ranked Record`}
                </div>
              </div>
              <Link
                to="/leaderboard"
                className="px-3 py-1.5 rounded-xl border text-right shrink-0 hover:opacity-90 transition-opacity"
                style={{
                  borderColor: `${rankColor}55`,
                  background: `${rankColor}18`,
                }}
              >
                <div className="text-xs font-head font-bold leading-tight" style={{ color: rankColor }}>
                  {rankName}
                </div>
                <div className="font-num text-sm font-bold text-white leading-tight">{mmr} MMR</div>
              </Link>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                data-testid="lobby-username"
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                placeholder="Guest handle (e.g. Nyx)"
                maxLength={16}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#F2A900]/60 font-head"
              />
              <button
                onClick={() => openAuthModal("login")}
                className="px-4 py-3 rounded-2xl bg-[#F2A900]/15 border border-[#F2A900]/40 text-[#F2A900] text-xs font-head font-bold hover:bg-[#F2A900]/25 shrink-0"
              >
                Sign In
              </button>
            </div>
          )}
        </div>

        {/* Selected Deck */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-head uppercase tracking-widest text-white/45 font-bold">
              Equipped Battle Deck
            </label>
            <Link to="/decks" className="text-[11px] font-head text-[#00BFFF] hover:underline">
              Edit Decks
            </Link>
          </div>
          <button
            onClick={() => setShowDeckSheet(true)}
            data-testid="lobby-deck-selector"
            className="w-full bg-black/40 border border-white/15 hover:border-white/30 rounded-2xl px-4 py-3 text-left font-head transition-all flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: `${deckSelection.color || "#F2A900"}22`,
                  border: `1px solid ${deckSelection.color || "#F2A900"}55`,
                }}
              >
                <Layers className="w-4 h-4" style={{ color: deckSelection.color || "#F2A900" }} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-white truncate">{deckSelection.deckName}</div>
                <div className="text-xs text-white/45 truncate">
                  {deckSelection.deckCards
                    ? `Custom Deck (${deckSelection.deckCards.length} cards)`
                    : deckSelection.faction
                    ? `Starter · ${deckSelection.faction}`
                    : "All-Faction Chaos"}
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-[#F2A900] shrink-0 px-2.5 py-1 rounded-lg bg-[#F2A900]/10">
              Change
            </span>
          </button>
        </div>
      </div>

      {/* Play Modes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Ranked Queue */}
        <div className="glass rounded-3xl p-5 border border-[#F2A900]/25 flex flex-col justify-between gap-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-[#F2A900]/10 blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F2A900]/15 text-[#F2A900] text-xs font-head font-bold">
                <Trophy className="w-3.5 h-3.5" /> Ranked 1v1
              </span>
              <span className="text-xs font-head text-white/50">
                {stats.ranked} in queue · 90s turn
              </span>
            </div>
            <h3 className="font-display text-xl font-bold">Competitive Ladder</h3>
            <p className="text-white/55 text-xs sm:text-sm font-head mt-1 leading-relaxed">
              Skill-based Elo matchmaking with seasonal tiers from Bronze to Master and 10 provisional placement games.
            </p>
          </div>

          <button
            data-testid="lobby-ranked-match"
            onClick={() => handleJoinQueue("ranked")}
            disabled={Boolean(busyAction)}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#F2A900] hover:bg-[#ffc21f] active:scale-[0.99] text-black font-head font-bold text-sm transition-all shadow-[0_0_25px_rgba(242,169,0,0.35)] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {user ? (
              <>
                <Trophy className="w-4 h-4" /> Find Ranked Match ({mmr} MMR)
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" /> Sign In to Queue Ranked
              </>
            )}
          </button>
        </div>

        {/* 2. Casual Queue */}
        <div className="glass rounded-3xl p-5 border border-[#00BFFF]/25 flex flex-col justify-between gap-4 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-[#00BFFF]/10 blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00BFFF]/15 text-[#00BFFF] text-xs font-head font-bold">
                <Swords className="w-3.5 h-3.5" /> Casual 1v1
              </span>
              <span className="text-xs font-head text-white/50">
                {stats.casual} in queue · 120s turn
              </span>
            </div>
            <h3 className="font-display text-xl font-bold">Unranked Quickplay</h3>
            <p className="text-white/55 text-xs sm:text-sm font-head mt-1 leading-relaxed">
              Test new brews and battle live summoners with zero rating pressure. Open to both accounts and guests!
            </p>
          </div>

          <button
            data-testid="lobby-quick-match"
            onClick={() => handleJoinQueue("casual")}
            disabled={Boolean(busyAction)}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#00BFFF] hover:bg-[#38ccff] active:scale-[0.99] text-black font-head font-bold text-sm transition-all shadow-[0_0_25px_rgba(0,191,255,0.3)] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Swords className="w-4 h-4" /> Find Casual Match
          </button>
        </div>

        {/* 3. Private Lobby */}
        <div className="glass rounded-3xl p-5 border border-[#9B30FF]/25 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#9B30FF]/15 text-[#C77DFF] text-xs font-head font-bold">
                <Users className="w-3.5 h-3.5" /> Private Duel
              </span>
              <span className="text-xs font-head text-white/45">Shareable Invite Link · Bo1 / Bo3</span>
            </div>
            <h3 className="font-display text-xl font-bold">Private Lobby</h3>
            <p className="text-white/55 text-xs sm:text-sm font-head mt-1 leading-relaxed">
              Create a custom room with ready-check, custom turn timers, and series score tracking, or enter a friend's 6-character code.
            </p>

            {/* Quick host settings */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-white/40 font-head mr-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Timer:
              </span>
              {[
                { label: "60s", val: 60 },
                { label: "90s", val: 90 },
                { label: "120s", val: 120 },
                { label: "Untimed", val: 0 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setLobbyTimer(opt.val)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-head font-bold transition-colors ${
                    lobbyTimer === opt.val
                      ? "bg-[#9B30FF] text-white"
                      : "bg-white/5 text-white/55 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <span className="w-px h-3.5 bg-white/10 mx-1" />
              {[1, 3].map((bo) => (
                <button
                  key={bo}
                  type="button"
                  onClick={() => setLobbyBestOf(bo)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-head font-bold transition-colors ${
                    lobbyBestOf === bo
                      ? "bg-[#9B30FF] text-white"
                      : "bg-white/5 text-white/55 hover:text-white"
                  }`}
                >
                  Bo{bo}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleCreateLobby}
              disabled={Boolean(busyAction)}
              data-testid="lobby-create-private"
              className="py-3 px-4 rounded-2xl bg-[#9B30FF] hover:bg-[#ad4dff] text-white font-head font-bold text-sm transition-colors shrink-0 disabled:opacity-60"
            >
              Create Room
            </button>
            <div className="flex flex-1 gap-2">
              <input
                data-testid="lobby-room-code"
                value={lobbyCodeInput}
                onChange={(e) => setLobbyCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="CODE"
                maxLength={6}
                className="w-full min-w-0 bg-black/40 border border-white/15 rounded-2xl px-3.5 py-3 text-center font-mono text-sm uppercase tracking-widest outline-none focus:border-[#9B30FF]"
              />
              <button
                data-testid="lobby-join-room"
                onClick={handleJoinLobby}
                disabled={Boolean(busyAction)}
                className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 font-head font-bold text-sm text-white transition-colors shrink-0 disabled:opacity-60"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {/* 4. Solo AI & Guided Tutorial */}
        <div className="glass rounded-3xl p-5 border border-[#22E07B]/25 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22E07B]/15 text-[#39E58C] text-xs font-head font-bold">
                <Bot className="w-3.5 h-3.5" /> Solo Practice
              </span>
              <span className="text-xs font-head text-white/45">Instant Start · Untimed</span>
            </div>
            <h3 className="font-display text-xl font-bold">GlimmerBot &amp; Training</h3>
            <p className="text-white/55 text-xs sm:text-sm font-head mt-1 leading-relaxed">
              Spar against GlimmerBot piloting official theme decks at your own pace, or replay the interactive combat tutorial.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              data-testid="lobby-play-ai"
              onClick={handlePlayBot}
              disabled={Boolean(busyAction)}
              className="py-3.5 px-4 rounded-2xl bg-[#22E07B] hover:bg-[#39E58C] text-black font-head font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Bot className="w-4 h-4" /> vs GlimmerBot
            </button>
            <button
              onClick={() => navigate("/sandbox")}
              className="py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-head font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <GraduationCap className="w-4 h-4 text-[#00BFFF]" /> Tutorial
            </button>
          </div>
        </div>
      </div>

      {/* Featured Live Matches (Spectate) */}
      {featuredGames.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h3 className="text-xs font-head uppercase tracking-widest text-[#00BFFF] font-bold mb-3 flex items-center gap-2">
            <Play className="w-3.5 h-3.5 fill-current" /> Live Arena Broadcasts — Tap to Spectate
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {featuredGames.map((fg) => (
              <button
                key={fg.id}
                onClick={() =>
                  onEnterMatch({
                    matchId: fg.id,
                    slot: 0,
                    roomCode: fg.room_code,
                    status: "PLAYING",
                    isSpectator: true,
                  })
                }
                className="bg-black/35 hover:bg-black/55 border border-white/10 hover:border-[#00BFFF]/40 transition-all rounded-2xl p-3.5 flex items-center justify-between text-left"
              >
                <div className="min-w-0">
                  <div className="font-head text-sm font-bold text-white truncate">
                    {fg.player1} <span className="text-white/35 text-xs mx-1">vs</span> {fg.player2}
                  </div>
                  <div className="text-[11px] text-white/40 font-head">Arena #{fg.room_code}</div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#00BFFF]/15 text-[#00BFFF] text-[10px] font-head font-bold uppercase tracking-wider shrink-0">
                  Watch
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Queue Overlay Modal */}
      <AnimatePresence>
        {searchingMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              className="glass-strong rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-white/15 shadow-2xl"
            >
              <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-2 border-dashed"
                  style={{ borderColor: searchingMode === "ranked" ? "#F2A900" : "#00BFFF" }}
                />
                {searchingMode === "ranked" ? (
                  <Trophy className="w-8 h-8 text-[#F2A900]" />
                ) : (
                  <Swords className="w-8 h-8 text-[#00BFFF]" />
                )}
              </div>

              <div className="text-xs font-head uppercase tracking-widest text-white/45 font-bold">
                {searchingMode === "ranked" ? "Ranked Ladder Queue" : "Casual Matchmaking"}
              </div>
              <h2 className="font-display text-2xl font-bold mt-1">Searching for Opponent…</h2>

              <div className="font-num text-4xl font-bold text-white my-4">
                {formatWait(queueState?.waitSeconds || 0)}
              </div>

              <div className="bg-white/5 rounded-2xl p-3 text-xs font-head text-white/65 space-y-1 mb-5">
                <div>
                  Deck: <strong className="text-white">{deckSelection.deckName}</strong>
                </div>
                {searchingMode === "ranked" && (
                  <div>
                    Rating Range:{" "}
                    <strong className="text-[#F2A900]">
                      {queueState?.searchRange ? `±${queueState.searchRange} MMR` : "Any Rating"}
                    </strong>
                  </div>
                )}
              </div>

              {queueState?.suggestBot && (
                <button
                  onClick={handlePlayBot}
                  className="w-full mb-2.5 py-3 rounded-2xl bg-[#22E07B] text-black font-head font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Bot className="w-4 h-4" /> Queue quiet? Battle GlimmerBot Now
                </button>
              )}

              <button
                onClick={handleCancelQueue}
                data-testid="cancel-queue-btn"
                className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-head font-semibold text-sm flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Cancel Search
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeckSelectorSheet
        open={showDeckSheet}
        onClose={() => setShowDeckSheet(false)}
        personalDecks={personalDecks}
        selectedDeckName={deckSelection.deckName}
        onSelectStarter={selectStarter}
        onSelectPersonal={selectPersonal}
      />
    </div>
  );
}
