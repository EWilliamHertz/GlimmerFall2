import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Sparkles, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { CARDBACK, RARITY, factionCfg } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";
import { CardModal } from "@/pages/Cards";

const RANK = { Common: 0, Uncommon: 1, Rare: 2, Mythic: 3, "Founders Foil": 4 };

export default function Booster() {
  const [phase, setPhase] = useState("idle"); // idle | opening | revealing
  const [pack, setPack] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const openPack = async () => {
    setLoading(true);
    try {
      const r = await api.get("/booster");
      const sorted = [...r.data].sort((a, b) => (RANK[a.rarity] || 0) - (RANK[b.rarity] || 0));
      setPack(sorted);
      setRevealed({});
      setPhase("opening");
      setTimeout(() => setPhase("revealing"), 1100);
    } finally {
      setLoading(false);
    }
  };

  const revealAll = () => {
    const all = {};
    pack.forEach((c) => (all[c.id] = true));
    setRevealed(all);
  };

  const reset = () => {
    setPhase("idle");
    setPack([]);
    setRevealed({});
  };

  const bestPull = pack.reduce((best, c) => ((RANK[c.rarity] || 0) > (RANK[best?.rarity] || -1) ? c : best), null);

  return (
    <div data-testid="booster-page" className="max-w-6xl mx-auto px-5 py-12 min-h-[80vh]">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-bold">Booster Simulator</h1>
        <p className="text-white/50 mt-2 font-head">Crack a 10-card pack from The Awakening.</p>
      </div>

      {/* IDLE / OPENING */}
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-8 py-10">
            <motion.button
              data-testid="booster-open-btn"
              onClick={openPack}
              disabled={loading}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="relative"
            >
              <div className="absolute -inset-6 rounded-3xl blur-2xl bg-[#9B30FF]/40 animate-pulse-glow" />
              <img src={CARDBACK} alt="pack" className="relative w-52 rounded-2xl shadow-[0_0_40px_rgba(155,48,255,0.5)]" />
            </motion.button>
            <button
              onClick={openPack}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#9B30FF] hover:bg-[#af57ff] text-white font-head font-semibold transition-colors shadow-[0_0_30px_rgba(155,48,255,0.5)]"
            >
              <Package className="w-5 h-5" /> {loading ? "Opening..." : "Open Pack"}
            </button>
          </motion.div>
        )}

        {phase === "opening" && (
          <motion.div key="opening" className="flex items-center justify-center py-24">
            <motion.div
              animate={{ scale: [1, 1.1, 1.3, 0], rotate: [0, -6, 6, 0], opacity: [1, 1, 1, 0] }}
              transition={{ duration: 1.1 }}
            >
              <img src={CARDBACK} alt="" className="w-52 rounded-2xl" />
            </motion.div>
            <motion.div
              animate={{ scale: [0, 3], opacity: [0, 0.9, 0] }}
              transition={{ duration: 1 }}
              className="absolute w-40 h-40 rounded-full bg-white blur-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* REVEAL */}
      {phase === "revealing" && (
        <div>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <button onClick={revealAll} data-testid="booster-reveal-all" className="px-5 py-2 rounded-full glass font-head text-sm hover:border-white/25">
              <Sparkles className="w-4 h-4 inline mr-1.5" /> Reveal All
            </button>
            <button onClick={openPack} data-testid="booster-open-another" className="px-5 py-2 rounded-full bg-[#9B30FF] text-white font-head text-sm font-semibold hover:bg-[#af57ff]">
              Open Another
            </button>
            <button onClick={reset} className="px-5 py-2 rounded-full glass font-head text-sm hover:border-white/25">
              <RotateCcw className="w-4 h-4 inline mr-1.5" /> Reset
            </button>
          </div>

          {bestPull && (
            <p className="text-center mb-6 font-head text-sm">
              Best pull:{" "}
              <span style={{ color: (RARITY[bestPull.rarity] || RARITY.Common).color, fontWeight: 700 }}>
                {bestPull.name} · {bestPull.rarity}
              </span>
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-8 justify-items-center">
            {pack.map((c, i) => (
              <PackCard
                key={c.id + "-" + i}
                card={c}
                index={i}
                flipped={!!revealed[c.id]}
                onFlip={() => setRevealed((r) => ({ ...r, [c.id]: true }))}
                onDetail={() => revealed[c.id] && setDetail(c)}
              />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>{detail && <CardModal card={detail} onClose={() => setDetail(null)} />}</AnimatePresence>
    </div>
  );
}

const PackCard = ({ card, index, flipped, onFlip, onDetail }) => {
  const rar = RARITY[card.rarity] || RARITY.Common;
  const special = card.rarity === "Mythic" || card.rarity === "Founders Foil";
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateZ: -8 }}
      animate={{ opacity: 1, y: 0, rotateZ: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative"
      style={{ perspective: 1000 }}
      data-testid={`pack-card-${index}`}
    >
      <motion.div
        className="relative w-40 aspect-[5/7]"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6 }}
        onClick={flipped ? onDetail : onFlip}
      >
        <div className="absolute inset-0 rounded-xl overflow-hidden border-2 border-white/15" style={{ backfaceVisibility: "hidden" }}>
          <img src={CARDBACK} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <CardTemplate card={card} size="md" tilt={false} className="w-40" onClick={onDetail} />
        </div>
      </motion.div>
      {flipped && special && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-head font-bold text-black whitespace-nowrap"
          style={{ background: rar.color, boxShadow: rar.glow }}
        >
          {card.rarity.toUpperCase()}
        </motion.div>
      )}
    </motion.div>
  );
};
