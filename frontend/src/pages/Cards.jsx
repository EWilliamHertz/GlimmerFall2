import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Sword, Heart, Zap, SlidersHorizontal } from "lucide-react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { FACTIONS, RARITY, CARD_TYPES, factionCfg } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";

const fetcher = (url) => api.get(url).then((r) => r.data);
const RARITIES = ["Common", "Uncommon", "Rare", "Epic"];

const FilterChip = ({ active, onClick, children, color, testId }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-head border transition-all shrink-0 ${
      active ? "text-black font-semibold" : "text-white/65 border-white/15 hover:text-white"
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
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    return cards
      .filter((c) => {
        if (
          q &&
          !c.name.toLowerCase().includes(q.toLowerCase()) &&
          !(c.description || "").toLowerCase().includes(q.toLowerCase())
        )
          return false;
        if (faction && c.faction !== faction) return false;
        if (type && c.card_type !== type) return false;
        if (rarity && c.rarity !== rarity) return false;
        return true;
      })
      .sort((a, b) => {
        const numA = a.collector_number != null ? Number(a.collector_number) : 999999;
        const numB = b.collector_number != null ? Number(b.collector_number) : 999999;
        return numA - numB;
      });
  }, [cards, q, faction, type, rarity]);

  const activeFilterCount = Number(Boolean(type)) + Number(Boolean(rarity));

  return (
    <div data-testid="cards-page" className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-10">
      <div className="mb-4 sm:mb-6">
        <h1 className="font-display text-3xl sm:text-5xl font-bold">Card Database</h1>
        <p className="text-white/50 mt-1 text-xs sm:text-base font-head">
          The GlimmerFall Oracle — {cards.length} cards in registry (First Edition: The Awakening).
        </p>
      </div>

      {/* Compact Mobile-First Sticky Filter Bar */}
      <div className="glass-strong rounded-2xl p-3 sm:p-4 mb-6 space-y-2.5 sticky top-14 z-30 shadow-xl shadow-black/40">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              data-testid="cards-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, keyword, or effect…"
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-sm outline-none focus:border-[#F2A900]/60 transition-colors"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMoreFiltersOpen((v) => !v)}
            className={`sm:hidden px-3 py-2 rounded-xl border text-xs font-head font-bold flex items-center gap-1.5 shrink-0 ${
              moreFiltersOpen || activeFilterCount > 0
                ? "bg-[#F2A900]/15 border-[#F2A900]/50 text-[#F2A900]"
                : "bg-white/5 border-white/10 text-white/70"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {activeFilterCount > 0 ? `(${activeFilterCount})` : "Type"}
          </button>
        </div>

        {/* Factions Horizontal Scroll Rail */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <FilterChip testId="filter-faction-all" active={!faction} onClick={() => setFaction(null)}>
            All Factions
          </FilterChip>
          {Object.values(FACTIONS).map((f) => (
            <FilterChip
              key={f.name}
              testId={`filter-faction-${f.name.toLowerCase()}`}
              active={faction === f.name}
              color={f.color}
              onClick={() => setFaction(faction === f.name ? null : f.name)}
            >
              {f.name}
            </FilterChip>
          ))}
        </div>

        {/* Types & Rarities (collapsible on mobile, always visible on sm+) */}
        <div
          className={`${
            moreFiltersOpen ? "flex" : "hidden sm:flex"
          } items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap pt-0.5`}
        >
          <FilterChip testId="filter-type-all" active={!type} onClick={() => setType(null)}>
            All Types
          </FilterChip>
          {CARD_TYPES.map((t) => (
            <FilterChip
              key={t}
              testId={`filter-type-${t.toLowerCase()}`}
              active={type === t}
              onClick={() => setType(type === t ? null : t)}
            >
              {t}
            </FilterChip>
          ))}
          <span className="w-px h-4 bg-white/10 mx-1 shrink-0" />
          {RARITIES.map((r) => (
            <FilterChip
              key={r}
              testId={`filter-rarity-${r.toLowerCase().replace(/\s+/g, "-")}`}
              active={rarity === r}
              color={RARITY[r].color}
              onClick={() => setRarity(rarity === r ? null : r)}
            >
              {r}
            </FilterChip>
          ))}
        </div>
      </div>

      <p className="text-white/40 text-xs sm:text-sm mb-4 font-head" data-testid="cards-result-count">
        {filtered.length} cards
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 sm:gap-x-4 gap-y-5 justify-items-center">
        {filtered.map((c) => (
          <div key={c.id} className="w-full max-w-[176px] flex flex-col items-center group">
            <CardTemplate
              card={c}
              size="md"
              width="100%"
              onClick={() => setActive(c)}
              testId={`card-${c.collector_number}`}
            />
            <div className="flex items-center gap-1 mt-1.5 text-[11px] font-mono text-white/50 group-hover:text-white transition-colors max-w-full">
              <span className="font-semibold text-[#F2A900] shrink-0">
                #{String(c.collector_number || 0).padStart(3, "0")}
              </span>
              <span className="text-white/30">•</span>
              <span className="truncate text-white/75">{c.name}</span>
            </div>
          </div>
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
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.95, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-t-3xl sm:rounded-3xl max-w-3xl w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-8 flex flex-col md:flex-row gap-6 md:gap-8 relative pb-safe"
        style={{ boxShadow: `0 0 60px ${f.glow}` }}
      >
        <button
          onClick={onClose}
          data-testid="card-modal-close"
          className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="mx-auto md:mx-0 shrink-0">
          <CardTemplate card={card} size="lg" tilt />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-head font-semibold text-black"
              style={{ background: f.color }}
            >
              {card.faction}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-head border border-white/15 text-white/70">
              {card.card_type}
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-head"
              style={{ color: rar.color, border: `1px solid ${rar.color}` }}
            >
              {card.rarity}
            </span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-1">{card.name}</h2>
          <p className="text-white/40 text-xs font-head mb-4">
            {card.set_name} · #{card.collector_number}
          </p>

          <div className="flex flex-wrap gap-2.5 mb-4">
            <Stat icon={Zap} label="Cost" value={card.cost} color="#F2A900" />
            {card.power != null && card.power !== "None" && (
              <Stat icon={Sword} label="Power" value={card.power} color="#FF5252" />
            )}
            {card.health != null && card.health !== "None" && (
              <Stat icon={Heart} label="Health" value={card.health} color="#22E07B" />
            )}
          </div>

          {card.keywords && card.keywords !== "None" && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {card.keywords.split(",").map((k) => (
                <span
                  key={k}
                  className="px-2.5 py-1 rounded-md text-xs font-head font-semibold"
                  style={{ background: `${f.color}22`, color: f.color }}
                >
                  {k.trim()}
                </span>
              ))}
            </div>
          )}

          <p className="text-white/80 leading-relaxed text-sm mb-4 font-head">
            {card.description || "No rules text."}
          </p>

          {card.lore && (
            <div className="mt-4 pt-4 border-t border-white/10 relative">
              <div className="text-[10px] uppercase tracking-widest text-white/35 font-head mb-1">
                Lore Fragment
              </div>
              <p className="italic text-sm leading-relaxed font-head" style={{ color: f.soft }}>
                "{card.lore}"
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const Stat = ({ icon: Icon, label, value, color }) => (
  <div className="glass rounded-xl px-3.5 py-2 flex items-center gap-2">
    <Icon className="w-4 h-4" style={{ color }} />
    <div>
      <div className="font-num text-lg font-bold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
    </div>
  </div>
);
