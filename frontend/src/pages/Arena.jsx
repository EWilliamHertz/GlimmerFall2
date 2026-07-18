import React, { useCallback, useEffect, useRef, useState } from "react";
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
  Swords, Bot, Users, Shield, Zap, Layers, Sparkles, ScrollText,
  Play, LogOut, Crown, Hand as HandIcon, Skull, Target, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { FACTIONS, factionCfg } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";

const SESSION_KEY = "glimmerfall_session";

/* ------------------------------------------------------------------ */
/* LOBBY                                                              */
/* ------------------------------------------------------------------ */
function Lobby({ onStart }) {
  const [username, setUsername] = useState(localStorage.getItem("gf_username") || "");
  const [room, setRoom] = useState("");
  const [faction, setFaction] = useState(null);
  const [loading, setLoading] = useState(false);

  const go = async (mode) => {
    if (!username.trim()) return toast.error("Enter a summoner name.");
    localStorage.setItem("gf_username", username.trim());
    setLoading(true);
    try {
      const body = { username: username.trim(), faction };
      if (mode === "ai") body.vsAI = true;
      if (mode === "room") body.roomCode = room.trim();
      const r = await api.post("/matchmaking", body);
      onStart({ ...r.data, username: username.trim() });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Matchmaking failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-5 py-16">
      <div className="text-center mb-8">
        <h1 className="font-display text-4xl md:text-5xl font-bold">Enter the Arena</h1>
        <p className="text-white/50 font-head mt-2">Battle the AI or challenge a friend by room code.</p>
      </div>

      <div className="glass rounded-3xl p-7 space-y-6">
        <div>
          <label className="text-xs font-head uppercase tracking-wider text-white/50">Summoner Name</label>
          <input
            data-testid="lobby-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. Nyx"
            className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#F2A900]/60 font-head"
          />
        </div>

        <div>
          <label className="text-xs font-head uppercase tracking-wider text-white/50">Faction (deck)</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              onClick={() => setFaction(null)}
              className={`px-3 py-2.5 rounded-xl text-sm font-head border transition-all ${!faction ? "bg-white text-black" : "border-white/15 text-white/60"}`}
            >
              Random
            </button>
            {Object.values(FACTIONS).map((f) => (
              <button
                key={f.name}
                data-testid={`lobby-faction-${f.name.toLowerCase()}`}
                onClick={() => setFaction(faction === f.name ? null : f.name)}
                className="px-3 py-2.5 rounded-xl text-sm font-head border transition-all"
                style={faction === f.name ? { background: f.color, color: "#000", borderColor: f.color } : { borderColor: "rgba(255,255,255,0.15)" }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        <button
          data-testid="lobby-play-ai"
          onClick={() => go("ai")}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#F2A900] text-black font-head font-semibold hover:bg-[#ffc21f] transition-colors shadow-[0_0_25px_rgba(242,169,0,0.4)] disabled:opacity-60"
        >
          <Bot className="w-5 h-5" /> Play vs GlimmerBot (AI)
        </button>

        <div className="flex items-center gap-3 text-white/30 text-xs font-head">
          <span className="flex-1 h-px bg-white/10" /> OR MULTIPLAYER <span className="flex-1 h-px bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            data-testid="lobby-room-code"
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            placeholder="Room code (optional)"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#00BFFF]/60 font-head uppercase tracking-widest"
          />
          <button
            data-testid="lobby-join-room"
            onClick={() => go("room")}
            disabled={loading}
            className="px-5 rounded-xl bg-[#00BFFF] text-black font-head font-semibold hover:bg-[#38ccff] transition-colors disabled:opacity-60"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
        <button
          data-testid="lobby-quick-match"
          onClick={() => go("quick")}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl glass font-head hover:border-white/25 transition-colors disabled:opacity-60"
        >
          <Swords className="w-4 h-4" /> Quick Match
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WAITING ROOM                                                       */
/* ------------------------------------------------------------------ */
function WaitingRoom({ roomCode, onCancel }) {
  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="mx-auto w-16 h-16 mb-6">
        <Sparkles className="w-16 h-16 text-[#F2A900]" />
      </motion.div>
      <h2 className="font-display text-3xl font-bold mb-2">Awaiting Challenger</h2>
      <p className="text-white/50 font-head mb-6">Share this room code with a friend:</p>
      <div data-testid="waiting-room-code" className="glass rounded-2xl px-6 py-5 font-num text-4xl font-bold tracking-[0.3em] text-[#F2A900] mb-8">
        {roomCode}
      </div>
      <button onClick={onCancel} className="px-6 py-2.5 rounded-full glass font-head hover:border-white/25 inline-flex items-center gap-2">
        <LogOut className="w-4 h-4" /> Cancel
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GAME PIECES                                                        */
/* ------------------------------------------------------------------ */
const EnergyDots = ({ energy, max }) => (
  <div className="flex flex-wrap gap-1 items-center">
    {Array.from({ length: Math.max(max, 0) }).map((_, i) => (
      <span
        key={i}
        className={`w-3 h-3 rounded-full transition-all ${i < energy ? "bg-[#00BFFF] shadow-[0_0_8px_rgba(0,191,255,0.9)]" : "bg-white/15"}`}
      />
    ))}
    <span className="ml-2 font-num text-sm text-[#7FDBFF]">{energy}/{max}</span>
  </div>
);

const Vanguard = ({ player, mine, isTarget, onClick, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className={`relative glass rounded-2xl px-5 py-3 flex items-center gap-3 min-w-[190px] transition-all ${isTarget ? "ring-2 ring-red-500 shadow-[0_0_20px_rgba(255,50,50,0.6)]" : ""}`}
  >
    <div className={`relative w-12 h-12 rounded-full flex items-center justify-center ${mine ? "bg-[#22E07B]/15" : "bg-red-500/15"}`}>
      <Shield className={`w-6 h-6 ${mine ? "text-[#39E58C]" : "text-red-400"}`} />
    </div>
    <div className="text-left">
      <div className="font-head text-sm text-white/70 truncate max-w-[120px]">{player.username}</div>
      <div className="font-num text-2xl font-bold leading-none">
        <span className={player.hp <= 8 ? "text-red-400" : "text-white"}>{player.hp}</span>
        <span className="text-white/30 text-base"> / 25</span>
      </div>
    </div>
    {isTarget && <Target className="absolute -top-2 -right-2 w-5 h-5 text-red-500 animate-pulse-glow" />}
  </button>
);

function BattlefieldEntity({ entity, selectable, selected, isTarget, onClick, testId }) {
  return (
    <CardTemplate
      card={entity}
      size="sm"
      tilt={false}
      selected={selected}
      exhausted={entity.exhausted}
      dimmed={selectable === false && !isTarget}
      onClick={onClick}
      testId={testId}
      className={isTarget ? "ring-2 ring-red-500 rounded-xl" : ""}
    />
  );
}

function HandCard({ card, draggable, onClick, testId }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.instanceId,
    data: { card },
    disabled: !draggable,
  });
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...attributes}
      onClick={onClick}
      style={{ opacity: isDragging ? 0.25 : 1, touchAction: "none" }}
      className="hover:-translate-y-4 transition-transform"
      data-testid={testId}
    >
      <CardTemplate card={card} size="md" tilt={false} />
    </div>
  );
}

function DropZone({ id, className, children, active, label }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`dropzone-${id}`}
      className={`${className} rounded-2xl transition-all ${isOver && active ? "ring-2 ring-[#F2A900] bg-[#F2A900]/5" : ""}`}
    >
      {children}
      {(!children || (Array.isArray(children) && children.every((c) => !c))) && label && (
        <span className="absolute inset-0 flex items-center justify-center text-white/25 font-head text-sm pointer-events-none">{label}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GAME BOARD                                                         */
/* ------------------------------------------------------------------ */
function GameBoard({ session, match, refresh, onExit }) {
  const slot = String(session.slot);
  const oppSlot = slot === "1" ? "2" : "1";
  const state = match.state;
  const me = state.players[slot];
  const opp = state.players[oppSlot];
  const isMyTurn = String(state.activePlayer) === slot && state.phase === "PLAYING";
  const ended = state.phase === "ENDED";

  const [selectedAttacker, setSelectedAttacker] = useState(null);
  const [pendingSpell, setPendingSpell] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const act = useCallback(
    async (action, payload) => {
      setBusy(true);
      try {
        const r = await api.post("/action", { matchId: session.matchId, slot: session.slot, action, payload });
        refresh(r.data.state);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Illegal move.");
      } finally {
        setBusy(false);
      }
    },
    [session, refresh]
  );

  const handleDragStart = (e) => setActiveDrag(e.active.data.current?.card || null);
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
        toast.info("Spells are cast — tap the card in hand to cast it.");
      }
    }
  };

  const clickHandCard = (card) => {
    if (card.cardType === "Rite" || card.cardType === "Flash") {
      if (card.cardType === "Rite" && !isMyTurn) return toast.error("Rite spells only on your turn.");
      setSelectedAttacker(null);
      setPendingSpell(card);
      toast.info(`Casting ${card.name} — choose a target or cast at a Vanguard.`);
    } else {
      toast.info("Drag Entities/Relics onto the battlefield to deploy.");
    }
  };

  const castAt = (targetType, targetId, targetSlot) => {
    if (!pendingSpell) return;
    act("CAST_SPELL", { instanceId: pendingSpell.instanceId, targetType, targetId, targetSlot });
    setPendingSpell(null);
  };

  const clickEntity = (entity, ownerSlot) => {
    if (pendingSpell) return castAt("entity", entity.instanceId, ownerSlot);
    if (ownerSlot === slot) {
      if (!isMyTurn) return;
      if (entity.exhausted) return toast.error("That entity is exhausted.");
      if (!entity.power) return toast.error("This entity cannot attack.");
      setSelectedAttacker(selectedAttacker === entity.instanceId ? null : entity.instanceId);
    } else {
      if (!selectedAttacker) return;
      act("ATTACK_ENTITY", { attackerId: selectedAttacker, targetId: entity.instanceId });
      setSelectedAttacker(null);
    }
  };

  const clickVanguard = (targetSlot) => {
    if (pendingSpell) return castAt("vanguard", null, targetSlot);
    if (targetSlot !== slot && selectedAttacker) {
      act("ATTACK_VANGUARD", { attackerId: selectedAttacker });
      setSelectedAttacker(null);
    }
  };

  const enemyHasGuard = opp.battlefield?.some((e) => e.keywords?.includes("Guard"));

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="max-w-6xl mx-auto px-4 py-4 min-h-[calc(100vh-4rem)] flex flex-col gap-3">
        {/* top: opponent */}
        <div className="flex items-center justify-between gap-3">
          <Vanguard
            player={opp}
            mine={false}
            isTarget={(!!selectedAttacker && !enemyHasGuard) || !!pendingSpell}
            onClick={() => clickVanguard(oppSlot)}
            testId="enemy-vanguard"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-white/50 text-sm font-head">
              <HandIcon className="w-4 h-4" /> {opp.handCount ?? opp.hand?.length ?? 0}
            </div>
            <EnergyDots energy={opp.energy || 0} max={opp.maxEnergy || 0} />
            <button onClick={onExit} data-testid="exit-match" className="px-3 py-2 rounded-lg glass hover:border-white/25 text-sm">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* opponent hand (facedown) */}
        <div className="flex justify-center gap-1 h-10 -mt-1">
          {Array.from({ length: Math.min(opp.handCount ?? 0, 8) }).map((_, i) => (
            <div key={i} className="w-8 h-11 rounded bg-[#12151E] border border-white/10 -ml-3 first:ml-0" style={{ transform: `rotate(${(i - 3) * 3}deg)` }} />
          ))}
        </div>

        {/* opponent battlefield */}
        <div className="glass rounded-2xl p-3 min-h-[130px] relative flex items-center justify-center gap-3 flex-wrap">
          {opp.battlefield?.length ? (
            opp.battlefield.map((e) => (
              <BattlefieldEntity
                key={e.instanceId}
                entity={e}
                selectable={!!selectedAttacker || !!pendingSpell}
                isTarget={(!!selectedAttacker && (!enemyHasGuard || e.keywords?.includes("Guard"))) || !!pendingSpell}
                onClick={() => clickEntity(e, oppSlot)}
                testId={`enemy-entity-${e.instanceId}`}
              />
            ))
          ) : (
            <span className="text-white/25 font-head text-sm">Enemy Battlefield</span>
          )}
        </div>

        {/* center status */}
        <div className="flex items-center justify-center gap-4 py-1">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
          <span className={`font-head text-sm px-4 py-1.5 rounded-full ${isMyTurn ? "bg-[#F2A900] text-black font-semibold" : "glass text-white/60"}`} data-testid="turn-indicator">
            {ended ? "Match Over" : isMyTurn ? "Your Turn" : `${opp.username}'s Turn`} · Turn {state.turn}
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
        </div>

        {/* player battlefield */}
        <DropZone id="battlefield" active={!!activeDrag} label="Drag Entities & Relics here" className="glass p-3 min-h-[140px] relative flex items-center justify-center gap-3 flex-wrap">
          {me.battlefield?.map((e) => (
            <BattlefieldEntity
              key={e.instanceId}
              entity={e}
              selectable={isMyTurn}
              selected={selectedAttacker === e.instanceId}
              onClick={() => clickEntity(e, slot)}
              testId={`my-entity-${e.instanceId}`}
            />
          ))}
          {me.relics?.map((e) => (
            <BattlefieldEntity key={e.instanceId} entity={e} selectable={false} onClick={() => {}} testId={`my-relic-${e.instanceId}`} />
          ))}
        </DropZone>

        {/* resonance + player vanguard */}
        <div className="flex items-stretch gap-3">
          <Vanguard player={me} mine isTarget={!!pendingSpell} onClick={() => clickVanguard(slot)} testId="my-vanguard" />
          <DropZone id="resonance" active={!!activeDrag} label="Resonance Row — drag a card to charge Energy" className="glass p-3 flex-1 relative flex items-center gap-2 flex-wrap min-h-[70px]">
            {me.resonanceRow?.map((c) => (
              <div key={c.instanceId} className="w-9 h-12 rounded-md flex items-center justify-center font-num text-xs" style={{ background: `${factionCfg(c.faction).color}33`, border: `1px solid ${factionCfg(c.faction).color}` }}>
                <Zap className="w-4 h-4" style={{ color: factionCfg(c.faction).color }} />
              </div>
            ))}
            <div className="ml-auto"><EnergyDots energy={me.energy || 0} max={me.maxEnergy || 0} /></div>
          </DropZone>
        </div>

        {/* controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            data-testid="btn-draw"
            disabled={!isMyTurn || busy || me.hasDrawnThisTurn}
            onClick={() => act("DRAW_CARD", {})}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass font-head text-sm hover:border-white/25 disabled:opacity-40"
          >
            <Layers className="w-4 h-4" /> Draw {me.hasDrawnThisTurn ? "✓" : ""}
          </button>
          <button
            data-testid="btn-end-turn"
            disabled={!isMyTurn || busy}
            onClick={() => { setSelectedAttacker(null); setPendingSpell(null); act("END_TURN", {}); }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#F2A900] text-black font-head font-semibold text-sm hover:bg-[#ffc21f] disabled:opacity-40"
          >
            <Play className="w-4 h-4" /> End Turn
          </button>
          {pendingSpell && (
            <button onClick={() => setPendingSpell(null)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-300 font-head text-sm">
              <X className="w-4 h-4" /> Cancel Cast
            </button>
          )}
        </div>

        {/* player hand */}
        <div className="flex justify-center items-end gap-[-8px] min-h-[180px] pt-6" style={{ perspective: 1200 }}>
          <div className="flex justify-center -space-x-6">
            {me.hand?.map((c) => (
              <HandCard key={c.instanceId} card={c} draggable={!ended} onClick={() => clickHandCard(c)} testId={`hand-card-${c.instanceId}`} />
            ))}
          </div>
        </div>

        {/* log */}
        <div className="glass rounded-2xl p-3 max-h-28 overflow-y-auto" data-testid="game-log">
          <div className="flex items-center gap-1.5 text-white/40 text-xs font-head mb-1 sticky top-0"><ScrollText className="w-3.5 h-3.5" /> Battle Log</div>
          {[...(state.log || [])].slice(-8).reverse().map((l, i) => (
            <p key={i} className="text-xs text-white/60 leading-relaxed">{l}</p>
          ))}
        </div>
      </div>

      <DragOverlay>{activeDrag ? <CardTemplate card={activeDrag} size="md" tilt={false} /> : null}</DragOverlay>

      {/* pending spell banner */}
      <AnimatePresence>
        {pendingSpell && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} className="fixed bottom-5 left-1/2 -translate-x-1/2 glass-strong rounded-full px-5 py-2.5 z-50 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#F2A900]" />
            <span className="font-head text-sm">Casting <b>{pendingSpell.name}</b> — tap a target, or</span>
            <button onClick={() => castAt("vanguard", null, oppSlot)} className="px-3 py-1 rounded-full bg-red-500/80 text-white text-xs font-head">Enemy Vanguard</button>
            <button onClick={() => castAt(null, null, oppSlot)} className="px-3 py-1 rounded-full glass text-xs font-head">No Target</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* end screen */}
      <AnimatePresence>
        {ended && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md px-5" data-testid="match-over">
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-strong rounded-3xl p-10 text-center max-w-sm">
              {String(state.winner) === slot ? (
                <>
                  <Crown className="w-16 h-16 text-[#F2A900] mx-auto mb-4 drop-shadow-[0_0_20px_rgba(242,169,0,0.8)]" />
                  <h2 className="font-display text-4xl font-bold text-[#F2A900]">Victory</h2>
                </>
              ) : (
                <>
                  <Skull className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h2 className="font-display text-4xl font-bold text-red-400">Defeat</h2>
                </>
              )}
              <p className="text-white/60 font-head mt-2 mb-6">The match has ended on turn {state.turn}.</p>
              <button onClick={onExit} data-testid="return-lobby" className="px-6 py-3 rounded-xl bg-[#F2A900] text-black font-head font-semibold hover:bg-[#ffc21f]">
                Return to Lobby
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  );
}

/* ------------------------------------------------------------------ */
/* ARENA CONTAINER                                                    */
/* ------------------------------------------------------------------ */
export default function Arena() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [match, setMatch] = useState(null);
  const pollRef = useRef(null);

  const persist = (s) => {
    setSession(s);
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
    setMatch(null);
  };

  const fetchMatch = useCallback(async () => {
    if (!session) return;
    try {
      const r = await api.get("/match", { params: { id: session.matchId, slot: session.slot } });
      setMatch(r.data);
    } catch {
      /* ignore transient */
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchMatch();
    pollRef.current = setInterval(fetchMatch, 1800);
    return () => clearInterval(pollRef.current);
  }, [session, fetchMatch]);

  const refresh = (newState) => setMatch((m) => (m ? { ...m, state: newState, status: newState.phase, activePlayer: newState.activePlayer } : m));

  if (!session) return <Lobby onStart={persist} />;

  const status = match?.status || session.status;
  if (status === "WAITING") {
    return <WaitingRoom roomCode={session.roomCode} onCancel={() => persist(null)} />;
  }
  if (!match) {
    return <div className="py-32 text-center text-white/50 font-head">Loading match…</div>;
  }
  return <GameBoard session={session} match={match} refresh={refresh} onExit={() => persist(null)} />;
}
