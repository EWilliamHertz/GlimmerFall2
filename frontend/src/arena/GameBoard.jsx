import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Shield,
  Zap,
  Layers,
  Sparkles,
  ScrollText,
  Play,
  LogOut,
  Crown,
  Hand as HandIcon,
  Skull,
  Target,
  X,
  Sword,
  Heart,
  Eye,
  Share2,
  Copy,
  Volume2,
  VolumeX,
  HelpCircle,
  Flag,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  WifiOff,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { api } from "@/lib/api";
import { KEYWORDS, factionCfg } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";
import ProjectileLayer, { fireAttackProjectile } from "@/components/ProjectileLayer";
import FactionParticles from "@/components/FactionParticles";

const playSound = (type, muted = false) => {
  if (muted) return;
  try {
    const audio = new Audio(`/audio/${type}.mp3`);
    audio.volume = 0.28;
    audio.play().catch(() => {});
  } catch {}
};

const vibrate = (ms = 12) => {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms);
  } catch {}
};

const kwArray = (card) => {
  if (Array.isArray(card?.keywords)) return card.keywords;
  if (!card?.keywords || card.keywords === "None") return [];
  return String(card.keywords)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
};

function CardTooltip({ card, children, side = "top" }) {
  if (!card) return children;
  const f = factionCfg(card.faction);
  const kws = kwArray(card);
  return (
    <HoverCard openDelay={220} closeDelay={0}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        sideOffset={8}
        className="hidden md:block w-72 bg-[#0B0C10]/95 border border-white/20 shadow-2xl p-4 z-[110]"
      >
        <div className="flex justify-between items-start gap-2 mb-2">
          <h4 className="font-display text-lg font-bold leading-tight" style={{ color: f.color }}>
            {card.name}
          </h4>
          <span
            className="text-[10px] font-head px-2 py-0.5 rounded-full shrink-0"
            style={{ background: `${f.color}22`, color: f.color }}
          >
            {card.card_type || card.cardType}
          </span>
        </div>
        <div className="flex gap-3 mb-2.5 text-xs font-head">
          {card.cost != null && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#F2A900]" /> {card.cost}
            </span>
          )}
          {card.power != null && card.power !== "None" && (
            <span className="flex items-center gap-1">
              <Sword className="w-3 h-3 text-[#FF5252]" /> {card.power}
            </span>
          )}
          {card.health != null && card.health !== "None" && (
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-[#22E07B]" /> {card.curHealth ?? card.health}
            </span>
          )}
        </div>
        {kws.length > 0 && (
          <div className="mb-2 text-[11px] font-head font-bold text-[#00BFFF] uppercase tracking-wide">
            {kws.join(" · ")}
          </div>
        )}
        <p className="text-xs text-white/75 leading-relaxed whitespace-pre-wrap">
          {card.description || "No additional rules text."}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

const EnergyPills = ({ energy = 0, max = 0, compact = false }) => (
  <div className="flex items-center gap-1.5">
    <div className="hidden sm:flex items-center gap-1">
      {Array.from({ length: Math.min(Math.max(max, 0), 12) }).map((_, i) => (
        <span
          key={i}
          className={`${compact ? "w-2 h-2" : "w-2.5 h-2.5"} rounded-full transition-all ${
            i < energy
              ? "bg-[#00BFFF] shadow-[0_0_8px_rgba(0,191,255,0.9)]"
              : "bg-white/15"
          }`}
        />
      ))}
    </div>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00BFFF]/15 border border-[#00BFFF]/30 font-num text-xs sm:text-sm font-bold text-[#7FDBFF]">
      <Zap className="w-3 h-3 text-[#00BFFF]" />
      {energy}/{max}
    </span>
  </div>
);

const NexusBadge = ({ player, mine, isTarget, spotlight, onClick, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className={`relative glass rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2.5 transition-all active:scale-95 ${
      isTarget
        ? "ring-2 ring-red-500 bg-red-500/15 shadow-[0_0_20px_rgba(239,68,68,0.55)]"
        : spotlight
        ? "ring-2 ring-[#F2A900] shadow-[0_0_20px_rgba(242,169,0,0.6)]"
        : ""
    }`}
  >
    <div
      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
        mine ? "bg-[#22E07B]/15" : "bg-red-500/15"
      }`}
    >
      <Shield className={`w-4 h-4 sm:w-5 sm:h-5 ${mine ? "text-[#39E58C]" : "text-red-400"}`} />
    </div>
    <div className="text-left min-w-0">
      <div className="font-head text-[11px] sm:text-xs text-white/70 truncate max-w-[96px] sm:max-w-[140px]">
        {player?.username}
        {player?.mmr ? <span className="ml-1 text-[10px] text-[#F2A900]/80">[{player.mmr}]</span> : null}
      </div>
      <div className="font-num text-lg sm:text-2xl font-bold leading-none">
        <span className={(player?.hp ?? 30) <= 8 ? "text-red-400" : "text-white"}>{player?.hp ?? 30}</span>
        <span className="text-white/30 text-xs sm:text-sm"> / 30</span>
      </div>
    </div>
    {isTarget && <Target className="absolute -top-1.5 -right-1.5 w-4 h-4 text-red-400 animate-ping" />}
  </button>
);

function BattlefieldEntity({
  entity,
  attachedRelics,
  canAttack,
  selected,
  isTarget,
  onClick,
  onInspect,
  testId,
}) {
  const kws = kwArray(entity);
  const isGuard = kws.includes("Guard") && !kws.includes("Stealth");
  const isStealth = kws.includes("Stealth");
  const pressTimer = useRef(null);

  const startPress = () => {
    if (!onInspect) return;
    pressTimer.current = setTimeout(() => {
      vibrate(20);
      onInspect(entity);
    }, 480);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <CardTooltip card={entity} side="top">
      <div
        className="relative flex flex-col items-center shrink-0"
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
      >
        {attachedRelics?.map((relic) => (
          <div
            key={relic.instanceId}
            className="w-[74px] sm:w-[104px] h-4 mb-[-5px] relative z-0 bg-gradient-to-t from-black to-[#2A2D3E] rounded-t-md border-t border-x border-[#F2A900]/45 flex items-center justify-center shadow-md pointer-events-none"
          >
            <span className="text-[7px] text-[#F2A900] font-head font-bold tracking-wider uppercase truncate px-1.5">
              {relic.name}
            </span>
          </div>
        ))}
        <motion.div
          layoutId={`card-${entity.instanceId}`}
          initial={{ opacity: 0, scale: 0.65, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.25 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className={`relative z-10 ${isStealth ? "opacity-65" : ""}`}
        >
          {onInspect && (
            <button
              type="button"
              aria-label={`Inspect ${entity.name}`}
              className="absolute -top-2 -right-2 bg-black/90 rounded-full p-1.5 z-30 md:hidden border border-white/25 shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                onInspect(entity);
              }}
            >
              <Eye className="w-3 h-3 text-[#00BFFF]" />
            </button>
          )}
          <div className="w-[82px] sm:w-[116px] md:w-[128px]">
            <CardTemplate
              card={entity}
              size="sm"
              width="100%"
              tilt={false}
              selected={selected}
              exhausted={entity.exhausted}
              onClick={onClick}
              testId={testId}
              className={
                isTarget
                  ? "ring-2 ring-red-500 rounded-xl shadow-[0_0_18px_rgba(239,68,68,0.65)]"
                  : canAttack && !selected
                  ? "ring-2 ring-[#22E07B]/80 rounded-xl shadow-[0_0_12px_rgba(34,224,123,0.35)]"
                  : ""
              }
            />
          </div>
          {isGuard && (
            <div className="absolute -inset-1 border-2 border-sky-200/85 rounded-xl pointer-events-none shadow-[0_0_12px_rgba(125,211,252,0.45)]" />
          )}
        </motion.div>
      </div>
    </CardTooltip>
  );
}

function HandCardItem({ card, selected, affordable, draggable, onSelect, onInspect, testId }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.instanceId,
    data: { card },
    disabled: !draggable,
  });

  const pressTimer = useRef(null);
  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      vibrate(20);
      onInspect?.(card);
    }, 520);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <motion.div
      layoutId={`card-${card.instanceId}`}
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...attributes}
      onClick={() => onSelect(card)}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      style={{ opacity: isDragging ? 0.25 : 1 }}
      className={`relative shrink-0 transition-transform duration-150 ${
        selected ? "-translate-y-4 sm:-translate-y-5 z-30" : "hover:-translate-y-2 z-10"
      }`}
      data-testid={testId}
    >
      <CardTooltip card={card} side="top">
        <div className="w-[92px] sm:w-[124px] md:w-[142px]">
          <CardTemplate
            card={card}
            size="md"
            width="100%"
            tilt={false}
            selected={selected}
            className={
              affordable && !selected
                ? "ring-1 ring-[#00BFFF]/70 shadow-[0_0_12px_rgba(0,191,255,0.28)]"
                : ""
            }
          />
        </div>
      </CardTooltip>
    </motion.div>
  );
}

function DropZone({ id, className, children, active, spotlight, label, onClick }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      data-testid={`dropzone-${id}`}
      className={`${className} rounded-2xl transition-all ${
        isOver && active
          ? "ring-2 ring-[#F2A900] bg-[#F2A900]/10"
          : spotlight
          ? "ring-2 ring-[#F2A900] shadow-[0_0_20px_rgba(242,169,0,0.45)]"
          : ""
      }`}
    >
      {children}
      {(!children || (Array.isArray(children) && children.every((c) => !c))) && label && (
        <span className="absolute inset-0 flex items-center justify-center text-white/25 font-head text-xs pointer-events-none px-2 text-center">
          {label}
        </span>
      )}
    </div>
  );
}

function TurnRopeBar({ turnStartedAt, turnSeconds, phase, clockOffsetMs = 0 }) {
  const [leftMs, setLeftMs] = useState((turnSeconds || 90) * 1000);

  useEffect(() => {
    if (!turnSeconds || phase !== "PLAYING" || !turnStartedAt) return;
    const totalMs = turnSeconds * 1000;
    const update = () => {
      const serverNow = Date.now() + clockOffsetMs;
      const elapsed = serverNow - turnStartedAt;
      setLeftMs(Math.max(0, totalMs - elapsed));
    };
    update();
    const timer = setInterval(update, 150);
    return () => clearInterval(timer);
  }, [turnStartedAt, turnSeconds, phase, clockOffsetMs]);

  if (!turnSeconds || phase !== "PLAYING" || !turnStartedAt) return null;
  const totalMs = turnSeconds * 1000;
  const pct = Math.max(0, Math.min(100, (leftMs / totalMs) * 100));
  const isDanger = leftMs <= 15000;
  const secs = Math.ceil(leftMs / 1000);

  return (
    <div className="flex items-center gap-2 w-full max-w-md mx-auto">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-150 ${
            isDanger
              ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]"
              : "bg-[#F2A900] shadow-[0_0_8px_rgba(242,169,0,0.6)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`font-num text-xs font-bold w-8 text-right ${
          isDanger ? "text-red-400 animate-pulse" : "text-white/55"
        }`}
      >
        {secs}s
      </span>
    </div>
  );
}

function DiceRollModal({ state, slot, act }) {
  const me = state.players[slot];
  const oppSlot = slot === "1" ? "2" : "1";
  const opp = state.players[oppSlot];
  const myRoll = state.diceRolls?.[slot];
  const oppRoll = state.diceRolls?.[oppSlot];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-strong rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center border border-white/15 shadow-2xl">
        <div className="text-xs font-head uppercase tracking-widest text-[#00BFFF] font-bold mb-1">
          Initiative Roll
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold mb-6">Who Goes First?</h2>

        <div className="flex justify-around items-center mb-6">
          <div className="flex flex-col items-center gap-2">
            <span className="font-head text-xs font-bold text-[#F2A900] truncate max-w-[110px]">
              {me?.username}
            </span>
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-[#F2A900]/40 flex items-center justify-center text-3xl font-bold font-num text-white">
              {myRoll || "?"}
            </div>
          </div>
          <span className="font-display text-white/30 text-lg font-bold">VS</span>
          <div className="flex flex-col items-center gap-2">
            <span className="font-head text-xs text-white/60 truncate max-w-[110px]">{opp?.username}</span>
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center text-3xl font-bold font-num text-white/70">
              {oppRoll || "?"}
            </div>
          </div>
        </div>

        {myRoll ? (
          <p className="font-head text-sm text-white/60 animate-pulse">
            Waiting for {opp?.username} to roll…
          </p>
        ) : (
          <button
            onClick={() => act("ROLL_DICE", {})}
            data-testid="roll-dice-btn"
            className="w-full py-3.5 rounded-2xl bg-[#00BFFF] text-black font-bold font-head text-base hover:bg-[#38ccff] transition-colors shadow-[0_0_25px_rgba(0,191,255,0.4)]"
          >
            Roll 1d6
          </button>
        )}
        <p className="text-[11px] text-white/35 font-head mt-3">Auto-rolls after 20 seconds</p>
      </div>
    </div>
  );
}

export default function GameBoard({
  session,
  match,
  refresh,
  onExit,
  onRematchShortcut,
  connected = true,
  clockOffsetMs = 0,
  tutorialCoach = null,
}) {
  const slot = String(match?.slot || session?.slot || 1);
  const viewSlot = slot === "0" ? "1" : slot;
  const oppSlot = viewSlot === "1" ? "2" : "1";
  const state = match.state;
  const me = state.players[viewSlot];
  const opp = state.players[oppSlot];
  const isReadOnly = Boolean(session.isSpectator || session.isReplay || slot === "0");
  const isMyTurn = String(state.activePlayer) === viewSlot && state.phase === "PLAYING" && !isReadOnly;
  const ended = state.phase === "ENDED";

  // Hide site Navbar / MobileTabBar while inside an active board
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("gf-match-mode", { detail: { active: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent("gf-match-mode", { detail: { active: false } }));
    };
  }, []);

  const [selectedHandId, setSelectedHandId] = useState(null);
  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [pendingSpell, setPendingSpell] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const [busy, setBusy] = useState(false);
  const [inspectCard, setInspectCard] = useState(null);
  const [viewingVoid, setViewingVoid] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [confirmConcede, setConfirmConcede] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem("gf_audio_muted") === "true");

  const audioRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("gf_audio_muted", String(muted));
    if (audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.volume = muted ? 0 : 0.14;
    }
  }, [muted]);

  // Clear hand selection if card left hand
  const selectedHandCard = useMemo(
    () => me?.hand?.find((c) => c.instanceId === selectedHandId) || null,
    [me?.hand, selectedHandId]
  );

  useEffect(() => {
    if (selectedHandId && !selectedHandCard) setSelectedHandId(null);
  }, [selectedHandId, selectedHandCard]);

  // Auto-follow casual PvP rematch if opponent triggered rematch creation
  useEffect(() => {
    if (match?.rematchMatchId && onRematchShortcut && !isReadOnly) {
      onRematchShortcut({
        matchId: match.rematchMatchId,
        slot: Number(viewSlot),
        mode: match.mode,
        lobbyCode: match.lobbyCode,
        status: "PLAYING",
      });
    }
  }, [match?.rematchMatchId, match?.mode, match?.lobbyCode, viewSlot, isReadOnly, onRematchShortcut]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const effectiveCost = useCallback(
    (card) => {
      if (!card) return 0;
      let cost = Number(card.cost || 0);
      if (card.name?.includes("Gaia")) {
        cost = Math.max(0, cost - (me?.resonanceRow?.length || 0));
      }
      if (card.cardType === "Rite" || card.cardType === "Flash") {
        const hasVoltage = me?.battlefield?.some((e) => e.name === "Voltage Savant");
        if (hasVoltage && (me?.spellsCastThisTurn || 0) === 0) {
          cost = Math.max(0, cost - 1);
        }
      }
      return cost;
    },
    [me]
  );

  const act = useCallback(
    async (action, payload = {}) => {
      if (isReadOnly) {
        toast.info(session.isReplay ? "Replay mode is view-only." : "Spectators cannot perform actions.");
        return;
      }
      if (tutorialCoach?.allowAction && !tutorialCoach.allowAction(action, payload)) {
        return;
      }

      setBusy(true);
      vibrate(14);

      try {
        if (action === "ATTACK_ENTITY" || action === "ATTACK_NEXUS") {
          const attacker = (me?.battlefield || []).find((e) => e.instanceId === payload.attackerId);
          if (attacker) {
            fireAttackProjectile({
              sourceTestId: `my-entity-${payload.attackerId}`,
              targetTestId: action === "ATTACK_ENTITY" ? `enemy-entity-${payload.targetId}` : "enemy-nexus",
              faction: attacker.faction || "Solari",
              damage: attacker.power ?? 0,
              kind: action === "ATTACK_ENTITY" ? "entity" : "nexus",
            });
          }
        }
      } catch {}

      try {
        const r = await api.post(`/v2/match/${session.matchId}/action`, { action, payload });
        if (action === "DRAW_CARD") playSound("draw", muted);
        if (action === "PLAY_CARD") playSound("play", muted);
        if (action === "ATTACK_ENTITY") playSound("attack", muted);
        if (action === "ATTACK_NEXUS") playSound("nexus_hit", muted);
        if (action === "CAST_SPELL") playSound("spell", muted);
        if (action === "END_TURN") playSound("pass", muted);
        setSelectedHandId(null);
        refresh(r.data);
        tutorialCoach?.onActionDone?.(action, payload, r.data);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Illegal move.");
      } finally {
        setBusy(false);
      }
    },
    [isReadOnly, session, tutorialCoach, me?.battlefield, muted, refresh]
  );

  const handleConcede = async () => {
    setConfirmConcede(false);
    try {
      const r = await api.post(`/v2/match/${session.matchId}/concede`);
      refresh(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not concede.");
    }
  };

  const handleRematch = async () => {
    setRematchBusy(true);
    try {
      const r = await api.post(`/v2/match/${session.matchId}/rematch`);
      if (r.data.status === "started" && r.data.matchId) {
        onRematchShortcut?.({
          matchId: r.data.matchId,
          slot: r.data.slot || 1,
          mode: match.mode,
          lobbyCode: match.lobbyCode,
          status: "PLAYING",
        });
      } else if (r.data.status === "lobby" && r.data.lobbyCode) {
        onRematchShortcut?.({ returnToLobby: r.data.lobbyCode });
      } else {
        toast.success("Rematch offer sent! Waiting for opponent…");
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Rematch unavailable.");
    } finally {
      setRematchBusy(false);
    }
  };

  // Keyboard shortcuts for desktop players
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") {
        setPendingSpell(null);
        setSelectedAttacker(null);
        setSelectedHandId(null);
      }
      if (e.key === " " && isMyTurn && !busy) {
        e.preventDefault();
        setSelectedAttacker(null);
        setPendingSpell(null);
        setSelectedHandId(null);
        act("END_TURN", {});
      }
      if ((e.key === "d" || e.key === "D") && isMyTurn && !busy && !me?.hasDrawnThisTurn) {
        act("DRAW_CARD", {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMyTurn, busy, me?.hasDrawnThisTurn, act]);

  // Opponent attack projectile detection
  const prevStateRef = useRef(null);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (!prev || session.isReplay) return;
    try {
      const prevOpp = prev.players?.[oppSlot];
      const prevMe = prev.players?.[viewSlot];
      if (!prevOpp || !prevMe) return;
      if (prevMe.hp != null && me.hp != null && me.hp < prevMe.hp) {
        const curBf = opp.battlefield || [];
        const prevBf = prevOpp.battlefield || [];
        const attacker =
          curBf.find((e) => {
            const b = prevBf.find((p) => p.instanceId === e.instanceId);
            return b && !b.exhausted && e.exhausted;
          }) || curBf[0];
        if (attacker) {
          fireAttackProjectile({
            sourceTestId: `enemy-entity-${attacker.instanceId}`,
            targetTestId: "my-nexus",
            faction: attacker.faction || "Umbri",
            damage: prevMe.hp - me.hp,
            kind: "nexus",
          });
          playSound("nexus_hit", muted);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const wasEndedRef = useRef(false);
  useEffect(() => {
    if (ended && !wasEndedRef.current) {
      playSound(String(state.winner) === viewSlot ? "victory" : "defeat", muted);
    }
    wasEndedRef.current = ended;
  }, [ended, state.winner, viewSlot, muted]);

  const handleDragStart = (e) => {
    setSelectedHandId(null);
    setActiveDrag(e.active.data.current?.card || null);
  };

  const handleDragEnd = (e) => {
    const card = activeDrag;
    setActiveDrag(null);
    if (!card || !e.over) return;
    if (e.over.id === "resonance") {
      act("PLAY_CARD", { instanceId: card.instanceId, destination: "resonance" });
    } else if (e.over.id === "battlefield") {
      if (card.cardType === "Entity" || card.cardType === "Relic") {
        act("PLAY_CARD", { instanceId: card.instanceId, destination: "battlefield" });
      } else {
        setPendingSpell(card);
      }
    }
  };

  const selectHandCard = (card) => {
    if (isReadOnly || ended) {
      setInspectCard(card);
      return;
    }
    setSelectedAttacker(null);
    setPendingSpell(null);
    setSelectedHandId((prev) => (prev === card.instanceId ? null : card.instanceId));
  };

  const beginSpellCast = (card) => {
    if (card.cardType === "Rite" && !isMyTurn) {
      return toast.error("Rite spells can only be cast on your turn.");
    }
    if (effectiveCost(card) > (me?.energy || 0)) {
      return toast.error("Not enough Energy.");
    }
    setSelectedHandId(null);
    setSelectedAttacker(null);
    setPendingSpell(card);
  };

  const castAt = (targetType, targetId, targetSlot) => {
    if (!pendingSpell) return;
    act("CAST_SPELL", {
      instanceId: pendingSpell.instanceId,
      targetType,
      targetId,
      targetSlot,
    });
    setPendingSpell(null);
  };

  const clickEntity = (entity, ownerSlot) => {
    if (pendingSpell) {
      return castAt("entity", entity.instanceId, ownerSlot);
    }
    if (ownerSlot === viewSlot) {
      if (!isMyTurn) return;
      if (entity.exhausted) return toast.info("That Entity is exhausted until your next turn.");
      if (!entity.power) return toast.info("This card has 0 Power and cannot attack.");
      setSelectedHandId(null);
      setSelectedAttacker((cur) => (cur === entity.instanceId ? null : entity.instanceId));
    } else {
      if (!selectedAttacker) {
        setInspectCard(entity);
        return;
      }
      act("ATTACK_ENTITY", { attackerId: selectedAttacker, targetId: entity.instanceId });
      setSelectedAttacker(null);
    }
  };

  const clickNexus = (targetSlot) => {
    if (pendingSpell) return castAt("nexus", null, targetSlot);
    if (targetSlot !== viewSlot && selectedAttacker) {
      act("ATTACK_NEXUS", { attackerId: selectedAttacker });
      setSelectedAttacker(null);
    }
  };

  const enemyHasGuard = opp?.battlefield?.some((e) => {
    const k = kwArray(e);
    return k.includes("Guard") && !k.includes("Stealth");
  });
  const attackerObj = me?.battlefield?.find((e) => e.instanceId === selectedAttacker);
  const attackerIsEvasive = kwArray(attackerObj).includes("Evasive");

  const dominantFaction = useMemo(() => {
    if (!me) return "Solari";
    const all = [
      ...(me.hand || []),
      ...(me.battlefield || []),
      ...(me.void || []),
      ...(me.resonanceRow || []),
    ];
    const counts = {};
    all.forEach((c) => {
      if (c?.faction && c.faction !== "Neutral") counts[c.faction] = (counts[c.faction] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Solari";
  }, [me]);

  const ambientTrack = `/audio/ambient_${dominantFaction.toLowerCase().split(",")[0]}.mp3`;

  // Contextual helper status message
  const tacticalPrompt = useMemo(() => {
    if (ended) return "Match Ended";
    if (isReadOnly) return session.isReplay ? "Replay Mode" : "Spectating Live";
    if (pendingSpell) return `Casting ${pendingSpell.name}: tap any target Entity or Nexus`;
    if (selectedAttacker) {
      return enemyHasGuard && !attackerIsEvasive
        ? "Enemy Guard active — tap the shielded Guard Entity to attack!"
        : "Attacker ready — tap the Enemy Nexus or an Enemy Entity!";
    }
    if (!isMyTurn) return `${opp?.username}'s Turn — Flash spells remain castable`;
    if (!me?.hasDrawnThisTurn) return "Step 1: Tap Draw to draw your turn card";
    if (!me?.hasResonatedThisTurn && (me?.hand?.length || 0) > 0 && (me?.maxEnergy || 0) < 12) {
      return "Tip: Tap a card in hand to charge a Glimmer Node (+1 Max Energy)";
    }
    return "Your Turn — deploy cards, attack, or End Turn";
  }, [
    ended,
    isReadOnly,
    session.isReplay,
    pendingSpell,
    selectedAttacker,
    enemyHasGuard,
    attackerIsEvasive,
    isMyTurn,
    opp?.username,
    me?.hasDrawnThisTurn,
    me?.hasResonatedThisTurn,
    me?.hand?.length,
    me?.maxEnergy,
  ]);

  const myRatingDelta = state?.ratingResult?.[viewSlot] || null;
  const spot = tutorialCoach?.spotlight || null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <audio ref={audioRef} src={ambientTrack} autoPlay loop />
      <FactionParticles faction={dominantFaction} />
      <ProjectileLayer />

      {state.phase === "DICE_ROLL" && !isReadOnly && (
        <DiceRollModal state={state} slot={viewSlot} act={act} />
      )}

      <div className="relative z-10 h-[100dvh] max-w-6xl mx-auto px-2.5 sm:px-4 py-2 sm:py-3 flex flex-col justify-between gap-1.5 sm:gap-2 overflow-hidden pt-safe pb-safe select-none">
        {/* 1. TOP BAR: Opponent Nexus + Stats + Match Utilities */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <NexusBadge
            player={opp}
            mine={false}
            isTarget={(Boolean(selectedAttacker) && (!enemyHasGuard || attackerIsEvasive)) || Boolean(pendingSpell)}
            spotlight={spot === "enemy-nexus"}
            onClick={() => clickNexus(oppSlot)}
            testId="enemy-nexus"
          />

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {!connected && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-head font-bold">
                <WifiOff className="w-3 h-3" /> Reconnecting
              </span>
            )}
            <EnergyPills energy={opp?.energy || 0} max={opp?.maxEnergy || 0} compact />

            <div className="flex items-center gap-1.5 bg-black/35 rounded-xl px-2.5 py-1.5 border border-white/10 text-xs font-head text-white/65">
              <span className="inline-flex items-center gap-1" title="Opponent Hand">
                <HandIcon className="w-3 h-3" /> {opp?.handCount ?? opp?.hand?.length ?? 0}
              </span>
              <span className="text-white/20">|</span>
              <span className="inline-flex items-center gap-1" title="Opponent Deck">
                <Layers className="w-3 h-3 text-[#F2A900]" /> {opp?.libraryCount ?? 0}
              </span>
              <span className="text-white/20">|</span>
              <button
                type="button"
                onClick={() => setViewingVoid("opp")}
                className="inline-flex items-center gap-1 hover:text-white"
                title="Inspect Enemy Void"
              >
                <Skull className="w-3 h-3 text-[#9B30FF]" /> {opp?.void?.length ?? 0}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setLogOpen(true)}
              aria-label="Open Battle Log"
              data-testid="open-log-btn"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl glass flex items-center justify-center text-white/70 hover:text-white"
            >
              <ScrollText className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("gf-open-tips"))}
              aria-label="Quick Rules Reference"
              className="hidden sm:flex w-9 h-9 rounded-xl glass items-center justify-center text-white/70 hover:text-white"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? "Unmute audio" : "Mute audio"}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl glass flex items-center justify-center text-white/70 hover:text-white"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {isReadOnly || ended ? (
              <button
                type="button"
                onClick={onExit}
                data-testid="exit-match"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl glass flex items-center justify-center text-white/75 hover:text-white"
                title="Leave Match"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmConcede(true)}
                data-testid="exit-match"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-300 hover:bg-red-500/25"
                title="Concede or Leave"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tutorial Coach Banner (when rendered inside TutorialSandbox) */}
        {tutorialCoach?.banner && (
          <div className="rounded-2xl px-3.5 py-2.5 bg-gradient-to-r from-[#F2A900]/20 via-[#00BFFF]/15 to-black/70 border border-[#F2A900]/50 flex items-center justify-between gap-3 shrink-0 shadow-lg">
            <div className="min-w-0">
              <div className="text-[10px] font-head uppercase tracking-widest text-[#F2A900] font-bold">
                {tutorialCoach.banner.stepLabel}
              </div>
              <div className="font-head text-xs sm:text-sm text-white font-semibold leading-snug">
                {tutorialCoach.banner.text}
              </div>
            </div>
            {tutorialCoach.banner.cta && (
              <button
                type="button"
                onClick={tutorialCoach.banner.onCta}
                className="px-3.5 py-2 rounded-xl bg-[#F2A900] text-black font-head font-bold text-xs shrink-0"
              >
                {tutorialCoach.banner.cta}
              </button>
            )}
          </div>
        )}

        {/* 2. BATTLEFIELD ARENA (Enemy Row + Center Turn/Rope + Friendly Row) */}
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-1.5 sm:gap-2">
          {/* Enemy Battlefield */}
          <div
            className={`glass rounded-2xl px-2.5 py-2 flex-1 min-h-[88px] relative flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar ${
              spot === "enemy-entity" ? "ring-2 ring-[#F2A900]" : ""
            }`}
          >
            {opp?.battlefield?.length || opp?.relics?.some((r) => !r.attachedTo) ? (
              <AnimatePresence>
                {(opp.battlefield || []).map((e) => {
                  const k = kwArray(e);
                  const isStealth = k.includes("Stealth");
                  const isGuard = k.includes("Guard") && !isStealth;
                  const validAttack =
                    Boolean(selectedAttacker) && !isStealth && (!enemyHasGuard || attackerIsEvasive || isGuard);
                  const attached = opp.relics?.filter((r) => r.attachedTo === e.instanceId) || [];
                  return (
                    <BattlefieldEntity
                      key={e.instanceId}
                      entity={e}
                      attachedRelics={attached}
                      isTarget={validAttack || (Boolean(pendingSpell) && !isStealth)}
                      onClick={() => clickEntity(e, oppSlot)}
                      onInspect={setInspectCard}
                      testId={`enemy-entity-${e.instanceId}`}
                    />
                  );
                })}
                {(opp.relics || [])
                  .filter((r) => !r.attachedTo)
                  .map((r) => (
                    <BattlefieldEntity
                      key={r.instanceId}
                      entity={r}
                      attachedRelics={[]}
                      isTarget={Boolean(pendingSpell)}
                      onClick={() => clickEntity(r, oppSlot)}
                      onInspect={setInspectCard}
                      testId={`enemy-relic-${r.instanceId}`}
                    />
                  ))}
              </AnimatePresence>
            ) : (
              <span className="text-white/20 font-head text-xs">Enemy Battlefield</span>
            )}
          </div>

          {/* Center Turn Indicator + Timer + Dynamic Tactical Hint */}
          <div className="shrink-0 flex flex-col items-center gap-1 px-1">
            <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-4 w-full">
              <span
                data-testid="turn-indicator"
                className={`font-head text-xs px-3 py-1 rounded-full shrink-0 ${
                  isMyTurn ? "bg-[#F2A900] text-black font-bold" : "glass text-white/65"
                }`}
              >
                {ended ? "Match Over" : isMyTurn ? "Your Turn" : `${opp?.username}'s Turn`} · T{state.turn}
              </span>
              <span className="text-[11px] sm:text-xs font-head text-white/65 truncate text-right sm:text-left">
                {tacticalPrompt}
              </span>
            </div>
            <TurnRopeBar
              turnStartedAt={state.turnStartedAt}
              turnSeconds={match.turnSeconds}
              phase={state.phase}
              clockOffsetMs={clockOffsetMs}
            />
          </div>

          {/* Player Battlefield */}
          <DropZone
            id="battlefield"
            active={Boolean(activeDrag)}
            spotlight={spot === "battlefield"}
            label="Your Battlefield — Deploy Entities & Relics"
            onClick={() => {
              if (
                selectedHandCard &&
                (selectedHandCard.cardType === "Entity" || selectedHandCard.cardType === "Relic")
              ) {
                act("PLAY_CARD", { instanceId: selectedHandCard.instanceId, destination: "battlefield" });
              }
            }}
            className="glass px-2.5 py-2 flex-1 min-h-[92px] relative flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar"
          >
            <AnimatePresence>
              {(me?.battlefield || []).map((e) => {
                const attached = me.relics?.filter((r) => r.attachedTo === e.instanceId) || [];
                const canAtk = isMyTurn && !e.exhausted && (e.power || 0) > 0 && !pendingSpell;
                return (
                  <BattlefieldEntity
                    key={e.instanceId}
                    entity={e}
                    attachedRelics={attached}
                    canAttack={canAtk}
                    selected={selectedAttacker === e.instanceId}
                    isTarget={Boolean(pendingSpell)}
                    onClick={() => clickEntity(e, viewSlot)}
                    onInspect={setInspectCard}
                    testId={`my-entity-${e.instanceId}`}
                  />
                );
              })}
              {(me?.relics || [])
                .filter((r) => !r.attachedTo)
                .map((r) => (
                  <BattlefieldEntity
                    key={r.instanceId}
                    entity={r}
                    attachedRelics={[]}
                    canAttack={false}
                    onClick={() => setInspectCard(r)}
                    onInspect={setInspectCard}
                    testId={`my-relic-${r.instanceId}`}
                  />
                ))}
            </AnimatePresence>
          </DropZone>
        </div>

        {/* 3. PLAYER HUD + RESONANCE ROW + DRAW + END TURN */}
        <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <NexusBadge
            player={me}
            mine
            isTarget={Boolean(pendingSpell)}
            onClick={() => clickNexus(viewSlot)}
            testId="my-nexus"
          />

          <DropZone
            id="resonance"
            active={Boolean(activeDrag)}
            spotlight={spot === "resonance"}
            onClick={() => {
              if (selectedHandCard && isMyTurn && !me.hasResonatedThisTurn) {
                act("PLAY_CARD", { instanceId: selectedHandCard.instanceId, destination: "resonance" });
              }
            }}
            className="glass px-2.5 py-1.5 flex-1 min-w-[140px] min-h-[46px] relative flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {me?.resonanceRow?.length ? (
                me.resonanceRow.map((c) => (
                  <div
                    key={c.instanceId}
                    title={`Glimmer Node (${c.name})`}
                    className="w-6 h-8 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: `${factionCfg(c.faction).color}30`,
                      border: `1px solid ${factionCfg(c.faction).color}`,
                    }}
                  >
                    <Zap className="w-3 h-3" style={{ color: factionCfg(c.faction).color }} />
                  </div>
                ))
              ) : (
                <span className="text-[11px] font-head text-white/35 truncate">Resonance Row (0 Nodes)</span>
              )}
            </div>
            <EnergyPills energy={me?.energy || 0} max={me?.maxEnergy || 0} />
          </DropZone>

          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <button
              type="button"
              data-testid="btn-draw"
              disabled={!isMyTurn || busy || me?.hasDrawnThisTurn}
              onClick={() => act("DRAW_CARD", {})}
              className={`px-3 py-2.5 rounded-xl font-head font-bold text-xs flex items-center gap-1.5 transition-all ${
                spot === "draw"
                  ? "bg-[#F2A900] text-black ring-2 ring-white shadow-[0_0_20px_rgba(242,169,0,0.8)]"
                  : isMyTurn && !me?.hasDrawnThisTurn
                  ? "bg-[#F2A900]/20 border border-[#F2A900] text-[#F2A900] animate-pulse"
                  : "glass text-white/75 disabled:opacity-40"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{me?.hasDrawnThisTurn ? `Deck (${me?.libraryCount ?? 0})` : `Draw (${me?.libraryCount ?? 0})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewingVoid("me")}
              className="px-2.5 py-2.5 rounded-xl glass text-white/65 hover:text-white text-xs font-head flex items-center gap-1"
              title="Inspect Your Void"
            >
              <Skull className="w-3.5 h-3.5 text-[#9B30FF]" />
              <span>{me?.void?.length ?? 0}</span>
            </button>

            <button
              type="button"
              data-testid="btn-end-turn"
              disabled={!isMyTurn || busy}
              onClick={() => {
                setSelectedAttacker(null);
                setPendingSpell(null);
                setSelectedHandId(null);
                act("END_TURN", {});
              }}
              className={`px-4 py-2.5 rounded-xl font-head font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all ${
                spot === "end-turn"
                  ? "bg-[#F2A900] text-black ring-2 ring-white shadow-[0_0_22px_rgba(242,169,0,0.9)]"
                  : "bg-[#F2A900] hover:bg-[#ffc21f] text-black disabled:opacity-35"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" /> End Turn
            </button>
          </div>
        </div>

        {/* 4. FLOATING CARD / SPELL ACTION BAR + HAND DOCK */}
        <div className="relative shrink-0 pt-1">
          {/* Selected Hand Card Command Pill */}
          <AnimatePresence>
            {selectedHandCard && !pendingSpell && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mb-2 mx-auto max-w-xl glass-strong rounded-2xl p-2 border border-white/20 flex flex-wrap items-center justify-center gap-2 shadow-2xl"
              >
                <span className="text-xs font-head font-bold text-white px-2 truncate max-w-[140px]">
                  {selectedHandCard.name}
                </span>

                <button
                  type="button"
                  data-testid="action-play-node"
                  disabled={!isMyTurn || busy || me?.hasResonatedThisTurn || (me?.maxEnergy || 0) >= 12}
                  onClick={() =>
                    act("PLAY_CARD", { instanceId: selectedHandCard.instanceId, destination: "resonance" })
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#00BFFF]/20 hover:bg-[#00BFFF]/30 border border-[#00BFFF]/45 text-[#7FDBFF] font-head font-bold text-xs disabled:opacity-35 flex items-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5" />
                  {me?.hasResonatedThisTurn ? "Node Used" : "Charge as Node (+1)"}
                </button>

                {selectedHandCard.cardType === "Entity" || selectedHandCard.cardType === "Relic" ? (
                  <button
                    type="button"
                    data-testid="action-deploy-card"
                    disabled={!isMyTurn || busy || effectiveCost(selectedHandCard) > (me?.energy || 0)}
                    onClick={() =>
                      act("PLAY_CARD", { instanceId: selectedHandCard.instanceId, destination: "battlefield" })
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-[#22E07B] hover:bg-[#39E58C] text-black font-head font-bold text-xs disabled:opacity-35 flex items-center gap-1"
                  >
                    <Sword className="w-3.5 h-3.5" />
                    Deploy ({effectiveCost(selectedHandCard)}⚡)
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="action-cast-spell"
                    disabled={
                      busy ||
                      (selectedHandCard.cardType === "Rite" && !isMyTurn) ||
                      effectiveCost(selectedHandCard) > (me?.energy || 0)
                    }
                    onClick={() => beginSpellCast(selectedHandCard)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#F2A900] hover:bg-[#ffc21f] text-black font-head font-bold text-xs disabled:opacity-35 flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Cast ({effectiveCost(selectedHandCard)}⚡)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setInspectCard(selectedHandCard)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-head flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Details
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedHandId(null)}
                  className="p-1.5 rounded-xl text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {pendingSpell && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mb-2 mx-auto max-w-xl glass-strong rounded-2xl p-2 border border-[#F2A900]/50 flex flex-wrap items-center justify-center gap-2 shadow-2xl"
              >
                <span className="text-xs font-head text-white px-2">
                  Aiming <b className="text-[#F2A900]">{pendingSpell.name}</b>: tap an Entity or
                </span>
                <button
                  type="button"
                  onClick={() => castAt("nexus", null, oppSlot)}
                  className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-head font-bold text-xs"
                >
                  Enemy Nexus
                </button>
                <button
                  type="button"
                  onClick={() => castAt(null, null, oppSlot)}
                  className="px-3 py-1.5 rounded-xl bg-white/15 text-white font-head font-bold text-xs"
                >
                  Cast (No Target)
                </button>
                <button
                  type="button"
                  onClick={() => setPendingSpell(null)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 text-white/65 hover:text-white text-xs font-head"
                >
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hand Cards Rail */}
          <div
            className={`flex items-end justify-start sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar px-2 pt-4 pb-1 min-h-[138px] sm:min-h-[184px] rounded-2xl ${
              spot === "hand" ? "ring-2 ring-[#F2A900]" : ""
            }`}
          >
            <AnimatePresence>
              {(me?.hand || []).map((c) => {
                const canAfford =
                  (isMyTurn || c.cardType === "Flash") && effectiveCost(c) <= (me?.energy || 0);
                return (
                  <HandCardItem
                    key={c.instanceId}
                    card={c}
                    selected={selectedHandId === c.instanceId}
                    affordable={canAfford}
                    draggable={!ended && !isReadOnly}
                    onSelect={selectHandCard}
                    onInspect={setInspectCard}
                    testId={`hand-card-${c.instanceId}`}
                  />
                );
              })}
            </AnimatePresence>
            {(!me?.hand || me.hand.length === 0) && (
              <div className="w-full text-center text-xs font-head text-white/30 py-8">
                Your hand is empty — draw at the start of your turn!
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>{activeDrag ? <CardTemplate card={activeDrag} size="md" tilt={false} /> : null}</DragOverlay>

      {/* Battle Log Drawer */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="glass-strong border-white/15 bg-[#0B0C10]/95 max-w-lg p-5 max-h-[80dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-[#F2A900]" /> Battle Log
            </DialogTitle>
          </DialogHeader>
          <div data-testid="game-log" className="flex-1 overflow-y-auto space-y-1.5 pr-1 mt-2">
            {(state.log || []).map((entry, idx) => {
              let color = "text-white/70";
              let text = String(entry);
              if (text.startsWith("[P1] ")) {
                color = viewSlot === "1" ? "text-[#39E58C]" : "text-red-300";
                text = text.slice(5);
              } else if (text.startsWith("[P2] ")) {
                color = viewSlot === "2" ? "text-[#39E58C]" : "text-red-300";
                text = text.slice(5);
              } else if (text.startsWith("[P0] ")) {
                color = "text-[#F2A900]";
                text = text.slice(5);
              }
              return (
                <div key={idx} className={`text-xs font-head leading-relaxed ${color}`}>
                  {text}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Concede Confirmation Dialog */}
      <Dialog open={confirmConcede} onOpenChange={setConfirmConcede}>
        <DialogContent className="glass-strong border-white/15 bg-[#0B0C10]/95 max-w-sm p-6 text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-center">Leave Battle?</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-head text-white/65 mt-2 mb-5">
            Conceding ends the match immediately as a loss{match.is_ranked ? " and updates your Ranked MMR" : ""}.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleConcede}
              data-testid="confirm-concede-btn"
              className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-head font-bold text-sm"
            >
              Concede Match
            </button>
            <button
              type="button"
              onClick={() => setConfirmConcede(false)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-head font-semibold text-sm"
            >
              Keep Fighting
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Inspector Sheet (with automatic Keyword Definitions!) */}
      <Dialog open={Boolean(inspectCard)} onOpenChange={() => setInspectCard(null)}>
        <DialogContent className="glass-strong border-white/20 bg-[#0B0C10]/95 max-w-md p-5 max-h-[90dvh] overflow-y-auto">
          {inspectCard && (
            <div className="flex flex-col items-center">
              <div className="mb-4">
                <CardTemplate card={inspectCard} size="lg" tilt={false} />
              </div>
              <DialogHeader className="text-center mb-3">
                <DialogTitle
                  className="font-display text-2xl"
                  style={{ color: factionCfg(inspectCard.faction).color }}
                >
                  {inspectCard.name}
                </DialogTitle>
              </DialogHeader>
              <div className="w-full space-y-2.5 font-head text-sm">
                <div className="flex justify-around bg-white/5 rounded-xl p-2.5 text-xs">
                  <span>
                    Type: <b className="text-white">{inspectCard.card_type || inspectCard.cardType}</b>
                  </span>
                  {inspectCard.cost != null && (
                    <span>
                      Cost: <b className="text-[#F2A900]">{inspectCard.cost}</b>
                    </span>
                  )}
                  {inspectCard.power != null && inspectCard.power !== "None" && (
                    <span>
                      Stats:{" "}
                      <b className="text-white">
                        {inspectCard.power}/{inspectCard.curHealth ?? inspectCard.health}
                      </b>
                    </span>
                  )}
                </div>
                <p className="text-white/85 text-sm leading-relaxed bg-white/[0.03] rounded-xl p-3 border border-white/10">
                  {inspectCard.description || "Vanilla Entity — deploy to attack or defend."}
                </p>
                {kwArray(inspectCard).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {kwArray(inspectCard).map((kw) => (
                      <div key={kw} className="text-xs bg-[#00BFFF]/10 border border-[#00BFFF]/25 rounded-xl p-2.5">
                        <b className="text-[#00BFFF]">{kw}:</b>{" "}
                        <span className="text-white/75">
                          {KEYWORDS[kw] || "Special tactical ability."}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Viewer */}
      <Dialog open={Boolean(viewingVoid)} onOpenChange={() => setViewingVoid(null)}>
        <DialogContent className="glass-strong border-white/20 bg-[#0B0C10]/95 max-w-3xl p-5 max-h-[82dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Skull className="w-5 h-5 text-[#9B30FF]" />
              {viewingVoid === "me" ? "Your Void" : `${opp?.username}'s Void`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-3">
            {(viewingVoid === "me" ? me?.void : opp?.void)?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 justify-items-center">
                {(viewingVoid === "me" ? me.void : opp.void).map((c, i) => (
                  <CardTemplate key={c.instanceId || i} card={c} size="sm" tilt={false} onClick={() => setInspectCard(c)} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-white/40 font-head text-sm">The Void is empty.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Responsive Pending Choice Modal (Scry / Discard) */}
      <Dialog
        open={Boolean(
          state?.pendingChoice &&
            !state.pendingChoice.hidden &&
            String(state.pendingChoice.player) === viewSlot &&
            !isReadOnly
        )}
        onOpenChange={() => {}}
      >
        <DialogContent className="glass-strong border-white/20 bg-[#0B0C10]/98 max-w-2xl p-5 max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-center text-[#00BFFF]">
              {state?.pendingChoice?.prompt}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-3">
            {state?.pendingChoice?.type === "scry_1" && state.pendingChoice.options?.[0]?.payload?.card && (
              <div className="flex justify-center mb-3">
                <CardTemplate card={state.pendingChoice.options[0].payload.card} size="md" tilt={false} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(state?.pendingChoice?.options || []).map((opt, idx) => {
                const previewCard = opt.payload?.keep || opt.payload?.dump;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => act("MAKE_CHOICE", { optionIndex: idx })}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-[#00BFFF]/50 flex flex-col items-center gap-3 text-center transition-all"
                  >
                    {previewCard && <CardTemplate card={previewCard} size="sm" tilt={false} />}
                    <span className="font-head font-bold text-xs sm:text-sm text-white">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Match Over Overlay (with Animated Elo Delta & Instant Rematch!) */}
      <AnimatePresence>
        {ended && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto"
            data-testid="match-over"
          >
            <motion.div
              initial={{ scale: 0.9, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-strong rounded-3xl p-6 sm:p-8 text-center max-w-md w-full border border-white/15 shadow-2xl my-auto"
            >
              {String(state.winner) === viewSlot ? (
                <>
                  <Crown className="w-14 h-14 text-[#F2A900] mx-auto mb-3 drop-shadow-[0_0_20px_rgba(242,169,0,0.8)]" />
                  <h2 className="font-display text-3xl sm:text-4xl font-black text-[#F2A900]">VICTORY</h2>
                </>
              ) : state.winner === 0 ? (
                <>
                  <Shield className="w-14 h-14 text-[#00BFFF] mx-auto mb-3" />
                  <h2 className="font-display text-3xl sm:text-4xl font-black text-[#00BFFF]">DRAW</h2>
                </>
              ) : (
                <>
                  <Skull className="w-14 h-14 text-red-400 mx-auto mb-3" />
                  <h2 className="font-display text-3xl sm:text-4xl font-black text-red-400">DEFEAT</h2>
                </>
              )}

              <p className="text-white/60 font-head text-sm mt-1">
                {state.endReason
                  ? `Ended on turn ${state.turn} (${state.endReason}).`
                  : `Concluded on turn ${state.turn} · ${dominantFaction} Deck`}
              </p>

              {/* Ranked Elo / MMR Delta Card */}
              {myRatingDelta && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                  className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/15 space-y-1.5"
                >
                  {myRatingDelta.promoted && (
                    <div className="text-xs font-head font-black uppercase tracking-widest text-[#F2A900]">
                      ★ Tier Promotion! ★
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span
                      className="font-display font-bold text-base"
                      style={{ color: myRatingDelta.rankColor || "#F2A900" }}
                    >
                      {myRatingDelta.rank}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-num text-sm font-bold ${
                        myRatingDelta.delta >= 0
                          ? "bg-[#22E07B]/20 text-[#39E58C]"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {myRatingDelta.delta >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {myRatingDelta.delta >= 0 ? `+${myRatingDelta.delta}` : myRatingDelta.delta} MMR
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-head text-white/55">
                    <span>
                      {myRatingDelta.before} → <b className="text-white">{myRatingDelta.after} MMR</b>
                    </span>
                    {myRatingDelta.placement_games_left > 0 && (
                      <span>{myRatingDelta.placement_games_left} placement left</span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Actions */}
              <div className="mt-6 space-y-2.5">
                {tutorialCoach?.onComplete ? (
                  <button
                    type="button"
                    onClick={tutorialCoach.onComplete}
                    className="w-full py-3.5 rounded-2xl bg-[#22E07B] text-black font-head font-bold text-sm hover:bg-[#39E58C]"
                  >
                    Complete Training &amp; Enter Arena →
                  </button>
                ) : (
                  <>
                    {!isReadOnly && !match.is_ranked && onRematchShortcut && (
                      <button
                        type="button"
                        disabled={rematchBusy}
                        onClick={handleRematch}
                        data-testid="rematch-btn"
                        className="w-full py-3.5 rounded-2xl bg-[#22E07B] hover:bg-[#39E58C] text-black font-head font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {match.lobbyCode
                          ? "Ready Next Series Game"
                          : state.isAI
                          ? "Battle Again"
                          : match.rematchOffers?.length
                          ? `Rematch (${match.rematchOffers.length}/2 Ready)`
                          : "Offer Rematch"}
                      </button>
                    )}

                    {match.lobbyCode && onRematchShortcut && (
                      <button
                        type="button"
                        onClick={() => onRematchShortcut({ returnToLobby: match.lobbyCode })}
                        className="w-full py-3 rounded-2xl bg-[#9B30FF]/25 border border-[#9B30FF]/50 text-white font-head font-bold text-sm"
                      >
                        Return to Private Lobby
                      </button>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const text = `I just battled in GlimmerFall TCG (${dominantFaction})! Play free at ${window.location.origin}`;
                          if (navigator.share) {
                            navigator.share({ title: "GlimmerFall TCG", text, url: window.location.origin }).catch(() => {});
                          } else {
                            navigator.clipboard.writeText(text);
                            toast.success("Copied battle summary!");
                          }
                        }}
                        className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-head font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="w-4 h-4" /> Share
                      </button>
                      <button
                        type="button"
                        onClick={onExit}
                        data-testid="return-lobby"
                        className="flex-1 py-3 rounded-2xl bg-[#F2A900] hover:bg-[#ffc21f] text-black font-head font-bold text-sm"
                      >
                        Back to Arena
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  );
}
