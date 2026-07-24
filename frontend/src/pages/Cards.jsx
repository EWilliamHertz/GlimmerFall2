import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Sword, Heart, Zap } from "lucide-react";
import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url) => api.get(url).then((r) => r.data);
import { FACTIONS, RARITY, CARD_TYPES, factionCfg } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";

const RARITIES = ["Common", "Uncommon", "Rare", "Mythic"];

const FilterChip = ({ active, onClick, children, color, testId }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-head border transition-all ${
      active ? "text-black font-semibold" : "text-white/60 border-white/15 hover:text-white"
    }`}
    style={active ? { background: color || "#F2A900", borderColor: color || "#F2A900" } : {}}
  >
    {children}
  </button>
);

export default function Cards() {
  const { data: cards = [] } = useSWR("/cards", fetcher);
  const [q, setQ] = useState("");
  const [faction, setFaction] = useState(null);
  const [type, setType] = useState(null);
  const [rarity, setRarity] = useState(null);
  const [active, setActive] = useState(null);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q.toLowerCase()) && !(c.description || "").toLowerCase().includes(q.toLowerCase())) return false;
      if (faction && c.faction !== faction) return false;
      if (type && c.card_type !== type) return false;
      if (rarity && c.rarity !== rarity) return false;
      return true;
    });
  }, [cards, q, faction, type, rarity]);

  return (
    <div data-testid="cards-page" className="max-w-7xl mx-auto px-5 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl font-bold">Card Database</h1>
        <p className="text-white/50 mt-2 font-head">The complete GlimmerFall Oracle — {cards.length} cards.</p>
      </div>

      {/* filters */}
      <div className="glass rounded-2xl p-5 mb-8 space-y-4 sticky top-20 z-30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            data-testid="cards-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cards by name or effect..."
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#F2A900]/60 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip testId="filter-faction-all" active={!faction} onClick={() => setFaction(null)}>All Factions</FilterChip>
          {Object.values(FACTIONS).map((f) => (
            <FilterChip key={f.name} testId={`filter-faction-${f.name.toLowerCase()}`} active={faction === f.name} color={f.color} onClick={() => setFaction(faction === f.name ? null : f.name)}>{f.name}</FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip testId="filter-type-all" active={!type} onClick={() => setType(null)}>All Types</FilterChip>
          {CARD_TYPES.map((t) => (
            <FilterChip key={t} testId={`filter-type-${t.toLowerCase()}`} active={type === t} onClick={() => setType(type === t ? null : t)}>{t}</FilterChip>
          ))}
          <span className="w-px bg-white/10 mx-1" />
          {RARITIES.map((r) => (
            <FilterChip key={r} testId={`filter-rarity-${r.toLowerCase().replace(/\s+/g, "-")}`} active={rarity === r} color={RARITY[r].color} onClick={() => setRarity(rarity === r ? null : r)}>{r}</FilterChip>
          ))}
        </div>
      </div>

      <p className="text-white/40 text-sm mb-4 font-head" data-testid="cards-result-count">{filtered.length} cards</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6 justify-items-center">
        {filtered.map((c) => (
          <CardTemplate key={c.id} card={c} size="md" onClick={() => setActive(c)} testId={`card-${c.collector_number}`} />
        ))}
      </div>

      <AnimatePresence>
        {active && <CardModal card={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </div>
  );
}

export const CardModal = ({ card, onClose }) => {
  const f = factionCfg(card.faction);
  const rar = RARITY[card.rarity] || RARITY.Common;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      data-testid="card-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl max-w-3xl w-full p-6 md:p-8 flex flex-col md:flex-row gap-8 relative"
        style={{ boxShadow: `0 0 60px ${f.glow}` }}
      >
        <button onClick={onClose} data-testid="card-modal-close" className="absolute right-4 top-4 text-white/50 hover:text-white">
          <X />
        </button>
        <div className="mx-auto md:mx-0">
          <CardTemplate card={card} size="xl" tilt />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-head font-semibold text-black" style={{ background: f.color }}>{card.faction}</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-head border border-white/15 text-white/70">{card.card_type}</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-head" style={{ color: rar.color, border: `1px solid ${rar.color}` }}>{card.rarity}</span>
          </div>
          <h2 className="font-display text-3xl font-bold mb-1">{card.name}</h2>
          <p className="text-white/40 text-xs font-head mb-5">{card.set_name} · #{card.collector_number}</p>

          <div className="flex gap-3 mb-5">
            <Stat icon={Zap} label="Cost" value={card.cost} color="#F2A900" />
            {card.power != null && card.power !== "None" && <Stat icon={Sword} label="Power" value={card.power} color="#FF5252" />}
            {card.health != null && card.health !== "None" && <Stat icon={Heart} label="Health" value={card.health} color="#22E07B" />}
          </div>

          {card.keywords && card.keywords !== "None" && (
            <div className="flex flex-wrap gap-2 mb-4">
              {card.keywords.split(",").map((k) => (
                <span key={k} className="px-2.5 py-1 rounded-md text-xs font-head font-semibold" style={{ background: `${f.color}22`, color: f.color }}>{k.trim()}</span>
              ))}
            </div>
          )}

          <p className="text-white/75 leading-relaxed text-sm">{card.description || "No rules text."}</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Stat = ({ icon: Icon, label, value, color }) => (
  <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2.5">
    <Icon className="w-4 h-4" style={{ color }} />
    <div>
      <div className="font-num text-xl font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  </div>
);
