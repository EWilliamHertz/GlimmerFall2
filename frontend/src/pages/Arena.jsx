import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Play, LogOut, Crown, Hand as HandIcon, Skull, Target, X, Sword, Heart
} from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { api } from "@/lib/api";
import { FACTIONS, factionCfg } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";
import { useAuth } from "@/lib/auth";

const SESSION_KEY = "glimmerfall_session";

const CardTooltip = ({ card, children, side="top" }) => {
  if (!card) return children;
  const f = factionCfg(card.faction);
  return (
    <HoverCard openDelay={200} closeDelay={0}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent side={side} sideOffset={8} className="w-72 bg-black/95 border border-white/20 shadow-2xl p-4 z-[100]">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-display text-xl font-bold" style={{color: f.color}}>{card.name}</h4>
          <span className="text-[10px] font-head px-2 py-0.5 rounded-full" style={{background: `${f.color}22`, color: f.color}}>{card.card_type || card.cardType}</span>
        </div>
        <div className="flex gap-4 mb-3 text-xs font-head">
          {card.cost !== null && <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-[#F2A900]"/> {card.cost}</span>}
          {card.power !== null && card.power !== "None" && <span className="flex items-center gap-1"><Sword className="w-3 h-3 text-[#FF5252]"/> {card.power}</span>}
          {card.health !== null && card.health !== "None" && <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-[#22E07B]"/> {card.health}</span>}
        </div>
        {card.keywords && card.keywords !== "None" && (
          <div className="mb-2 text-[11px] font-head font-bold text-[#00BFFF] uppercase tracking-wide">{card.keywords}</div>
        )}
        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{card.description || "No rules text."}</p>
      </HoverCardContent>
    </HoverCard>
  );
};

/* ------------------------------------------------------------------ */
/* LOBBY                                                              */
/* ------------------------------------------------------------------ */
function Lobby({ onStart }) {
  const { user } = useAuth();
  const [username, setUsername] = useState(user ? user.nickname : localStorage.getItem("gf_username") || "");
  const [room, setRoom] = useState("");
  const [faction, setFaction] = useState(null);
  const [deckCards, setDeckCards] = useState(null);
  const [deckName, setDeckName] = useState("Random Chaos");
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [personalDecks, setPersonalDecks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("glimmerfall_decks") || "{}");
      setPersonalDecks(Object.values(stored));
    } catch(e){}
  }, []);

  const go = async (mode) => {
    if (!username.trim()) return toast.error("Enter a summoner name.");
    localStorage.setItem("gf_username", username.trim());
    setLoading(true);
    try {
      const body = { username: username.trim(), faction, deckCards };
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

  const selectStarter = (d) => {
    setFaction(d.factions);
    setDeckCards(null);
    setDeckName(d.name);
    setShowDeckModal(false);
  };

  const selectPersonal = (pd) => {
    const list = [];
    pd.cards.forEach(c => {
      for(let i=0; i<c.count; i++) list.push(c.id);
    });
    setDeckCards(list);
    setFaction(null);
    setDeckName(pd.name);
    setShowDeckModal(false);
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
          {user ? (
            <div className="mt-1.5 w-full bg-black/40 border border-[#F2A900]/30 rounded-xl px-4 py-3 text-[#F2A900] font-bold font-head shadow-inner flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> {user.nickname} <span className="text-white/40 font-normal text-sm ml-auto">(Logged In)</span>
            </div>
          ) : (
            <input
              data-testid="lobby-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Nyx"
              className="mt-1.5 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#F2A900]/60 font-head"
            />
          )}
        </div>

        <div>
          <label className="text-xs font-head uppercase tracking-wider text-white/50">Your Deck</label>
          <button 
            onClick={() => setShowDeckModal(true)}
            className="mt-1.5 w-full bg-black/40 border border-white/10 hover:bg-white/5 rounded-xl px-4 py-3 text-left font-head transition-all flex items-center justify-between"
          >
            <span>{deckName}</span>
            <Layers className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <AnimatePresence>
          {showDeckModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="glass rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col gap-6 relative">
                <button onClick={() => setShowDeckModal(false)} className="absolute top-6 right-6 text-white/50 hover:text-white"><X className="w-6 h-6" /></button>
                
                <div>
                  <h2 className="font-display text-2xl font-bold mb-4">Personal Decks</h2>
                  {personalDecks.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {personalDecks.map((pd, i) => (
                        <button key={i} onClick={() => selectPersonal(pd)} className="text-left p-3 rounded-xl border border-white/10 bg-black/20 hover:bg-white/5 transition-all">
                          <div className="font-head text-sm font-semibold text-[#F2A900]">{pd.name}</div>
                          <div className="text-white/50 text-xs mt-1">{pd.cards?.reduce((a, b) => a + b.count, 0) || 0} cards</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-white/40 text-sm font-head italic px-2">No personal decks found. Build one in the Deck Builder!</div>
                  )}
                </div>

                <div>
                  <h2 className="font-display text-2xl font-bold mb-4">Starter Decks</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { name: "Nature's Wrath", desc: "A resilient green deck built around big creatures and growth effects.", factions: "Terra", color: "#22E07B" },
                      { name: "Cinder Ignition", desc: "An aggressive Umbri deck built around burn spells and fast attackers.", factions: "Umbri", color: "#9B30FF" },
                      { name: "Solar Singularity", desc: "A top-tier aggressive deck combining the raw power of Sun with Void singularity loops.", factions: "Solari,Umbri", color: "#F2A900" },
                      { name: "Gaia's Loop", desc: "A control deck leveraging infinite nature cycles and magical manipulation.", factions: "Terra,Aether", color: "#22E07B" },
                      { name: "Random Chaos", desc: "A chaotic mix of all cards. Anything can happen.", factions: null, color: "#ffffff" }
                    ].map((d) => (
                      <button
                        key={d.name}
                        onClick={() => selectStarter(d)}
                        className={`text-left p-3 rounded-xl border transition-all ${deckName === d.name ? "bg-white/10" : "bg-black/20 hover:bg-white/5"}`}
                        style={{ borderColor: deckName === d.name ? d.color : "rgba(255,255,255,0.1)" }}
                      >
                        <div className="font-head text-sm font-semibold" style={{ color: d.color }}>{d.name}</div>
                        <div className="text-white/50 text-xs mt-1 leading-relaxed">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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

const Nexus = ({ player, mine, isTarget, onClick, testId }) => (
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
    <CardTooltip card={entity} side="top">
      <div>
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
      </div>
    </CardTooltip>
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
      <CardTooltip card={card} side="top">
        <div>
          <CardTemplate card={card} size="md" tilt={false} />
        </div>
      </CardTooltip>
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
  const navigate = useNavigate();

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      
      if (e.key === "Escape") {
        setPendingSpell(null);
        setSelectedAttacker(null);
      }
      if (e.key === " " && isMyTurn && !busy) {
        e.preventDefault();
        setSelectedAttacker(null);
        setPendingSpell(null);
        act("END_TURN", {});
      }
      if ((e.key === "d" || e.key === "D") && isMyTurn && !busy && !me.hasDrawnThisTurn) {
        act("DRAW_CARD", {});
      }
      if (e.key >= "1" && e.key <= "5") {
        const tabs = ["/play", "/cards", "/decks", "/booster", "/rules"];
        navigate(tabs[parseInt(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMyTurn, busy, me, act, navigate]);

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
      toast.info(`Casting ${card.name} — choose a target or cast at a Nexus.`);
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

  const clickNexus = (targetSlot) => {
    if (pendingSpell) return castAt("nexus", null, targetSlot);
    if (targetSlot !== slot && selectedAttacker) {
      act("ATTACK_NEXUS", { attackerId: selectedAttacker });
      setSelectedAttacker(null);
    }
  };

  const enemyHasGuard = opp.battlefield?.some((e) => e.keywords?.includes("Guard"));

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="max-w-6xl mx-auto px-4 py-4 min-h-[calc(100vh-4rem)] flex flex-col gap-3">
        {/* top: opponent */}
        <div className="flex items-center justify-between gap-3">
          <Nexus
            player={opp}
            mine={false}
            isTarget={(!!selectedAttacker && !enemyHasGuard) || !!pendingSpell}
            onClick={() => clickNexus(oppSlot)}
            testId="enemy-nexus"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-1.5 border border-white/10">
              <div className="flex items-center gap-1 text-white/50 text-sm font-head" title="Hand">
                <HandIcon className="w-3.5 h-3.5" /> {opp.handCount ?? opp.hand?.length ?? 0}
              </div>
              <div className="w-px h-3 bg-white/20 mx-1" />
              <div className="flex items-center gap-1 text-white/50 text-sm font-head" title="Deck">
                <Layers className="w-3.5 h-3.5 text-[#F2A900]" /> {opp.libraryCount ?? opp.library?.length ?? 0}
              </div>
              <div className="w-px h-3 bg-white/20 mx-1" />
              <div className="flex items-center gap-1 text-white/50 text-sm font-head" title="Void">
                <Skull className="w-3.5 h-3.5 text-[#9B30FF]" /> {opp.void?.length ?? 0}
              </div>
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

        {/* resonance + player nexus */}
        <div className="flex items-stretch gap-3">
          <Nexus player={me} mine isTarget={!!pendingSpell} onClick={() => clickNexus(slot)} testId="my-nexus" />
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
          <div className="flex items-center gap-2 bg-black/20 rounded-xl px-4 py-2 border border-white/10">
            <button
              data-testid="btn-draw"
              disabled={!isMyTurn || busy || me.hasDrawnThisTurn}
              onClick={() => act("DRAW_CARD", {})}
              className="inline-flex items-center gap-1.5 text-white/80 font-head text-sm hover:text-white disabled:opacity-40 transition-colors"
              title="Draw Card"
            >
              <Layers className="w-4 h-4 text-[#F2A900]" /> Deck ({me.libraryCount ?? me.library?.length ?? 0}) {me.hasDrawnThisTurn ? "✓" : ""}
            </button>
            <div className="w-px h-4 bg-white/20 mx-2" />
            <div className="inline-flex items-center gap-1.5 text-white/50 font-head text-sm" title="Void">
              <Skull className="w-4 h-4 text-[#9B30FF]" /> Void ({me.void?.length ?? 0})
            </div>
          </div>
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
        <div className="glass rounded-2xl p-3 h-64 overflow-y-auto flex flex-col-reverse" data-testid="game-log">
          <div className="flex flex-col gap-1.5">
            {[...(state.log || [])].map((l, i) => {
              let color = "text-white/60";
              let text = l;
              if (typeof l === 'string') {
                if (l.startsWith("[P1] ")) {
                  color = slot === "1" ? "text-[#39E58C]" : "text-red-400";
                  text = l.replace("[P1] ", "");
                } else if (l.startsWith("[P2] ")) {
                  color = slot === "2" ? "text-[#39E58C]" : "text-red-400";
                  text = l.replace("[P2] ", "");
                } else if (l.startsWith("[P0] ")) {
                  color = "text-[#F2A900]";
                  text = l.replace("[P0] ", "");
                }
              }
              return <p key={i} className={`text-xs leading-relaxed ${color}`}>{text}</p>;
            })}
          </div>
          <div className="flex items-center gap-1.5 text-white/40 text-xs font-head mb-2 sticky top-0 bg-[#0B0C10]/90 backdrop-blur-md z-10 py-1"><ScrollText className="w-3.5 h-3.5" /> Battle Log</div>
        </div>
      </div>

      <DragOverlay>{activeDrag ? <CardTemplate card={activeDrag} size="md" tilt={false} /> : null}</DragOverlay>

      {/* pending spell banner */}
      <AnimatePresence>
        {pendingSpell && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} className="fixed bottom-5 left-1/2 -translate-x-1/2 glass-strong rounded-full px-5 py-2.5 z-50 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-[#F2A900]" />
            <span className="font-head text-sm">Casting <b>{pendingSpell.name}</b> — tap a target, or</span>
            <button onClick={() => castAt("nexus", null, oppSlot)} className="px-3 py-1 rounded-full bg-red-500/80 text-white text-xs font-head">Enemy Nexus</button>
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
