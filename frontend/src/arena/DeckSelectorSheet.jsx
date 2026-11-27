import React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Layers, Hammer, Check, Sparkles } from "lucide-react";

export const STARTER_DECK_PRESETS = [
  {
    name: "Solar Singularity",
    desc: "Aggressive Solari & Umbri tempo combining radiant threats with Void disruption.",
    factions: "Solari,Umbri",
    color: "#F2A900",
    tag: "Aggro · Dual",
  },
  {
    name: "The Graveglass Veil",
    desc: "Shadow Umbri control built around Stealth assassins, Lethal, and Void recursion.",
    factions: "Umbri",
    color: "#9B30FF",
    tag: "Control · Umbri",
  },
  {
    name: "Fractured Continuum",
    desc: "Spell-slinging Aether deck bending card draw, Scry, and reactive Flash instants.",
    factions: "Aether",
    color: "#00BFFF",
    tag: "Tempo · Aether",
  },
  {
    name: "Gaia's Loop",
    desc: "Resilient Terra & Aether ramp commanding massive Guardians and Energy acceleration.",
    factions: "Terra,Aether",
    color: "#22E07B",
    tag: "Ramp · Terra",
  },
  {
    name: "Random Chaos",
    desc: "Unpredictable 40-card mix forged across all four realms.",
    factions: null,
    color: "#E2E8F0",
    tag: "Wildcard",
  },
];

export default function DeckSelectorSheet({
  open,
  onClose,
  personalDecks = [],
  selectedDeckName,
  onSelectStarter,
  onSelectPersonal,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/15 max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl pb-safe"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-[#F2A900]" />
                <h2 className="font-display text-xl font-bold">Select Battle Deck</h2>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6">
              {/* Personal Decks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-head uppercase tracking-widest text-white/50 font-bold">
                    Your Custom Decks ({personalDecks.length})
                  </h3>
                  <Link
                    to="/decks"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 text-xs font-head font-bold text-[#00BFFF] hover:underline"
                  >
                    <Hammer className="w-3.5 h-3.5" /> Open Deck Builder
                  </Link>
                </div>

                {personalDecks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {personalDecks.map((pd, i) => {
                      const count = pd.cards?.reduce((a, b) => a + (b.count || 1), 0) || 0;
                      const isSel = selectedDeckName === pd.name;
                      return (
                        <button
                          key={pd.id || i}
                          onClick={() => onSelectPersonal(pd)}
                          className={`text-left p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-2 ${
                            isSel
                              ? "bg-[#F2A900]/15 border-[#F2A900] shadow-[0_0_20px_rgba(242,169,0,0.2)]"
                              : "bg-white/[0.03] border-white/10 hover:bg-white/[0.07]"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-head text-sm font-bold text-white truncate">{pd.name}</div>
                            <div className="text-white/50 text-xs mt-0.5 font-head">
                              {count} cards {count < 30 ? "· Auto-filled to 40" : ""}
                            </div>
                          </div>
                          {isSel && <Check className="w-4 h-4 text-[#F2A900] shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center">
                    <p className="text-xs text-white/50 font-head">
                      No custom decks saved yet. Choose an official Starter Deck below or forge your own 40-card list!
                    </p>
                  </div>
                )}
              </div>

              {/* Official Starter Decks */}
              <div>
                <h3 className="text-xs font-head uppercase tracking-widest text-white/50 font-bold mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F2A900]" /> Ready-to-Play Starter Decks
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STARTER_DECK_PRESETS.map((d) => {
                    const isSel = selectedDeckName === d.name;
                    return (
                      <button
                        key={d.name}
                        onClick={() => onSelectStarter(d)}
                        className={`text-left p-3.5 rounded-2xl border transition-all relative overflow-hidden ${
                          isSel ? "bg-white/10" : "bg-white/[0.03] hover:bg-white/[0.07]"
                        }`}
                        style={{
                          borderColor: isSel ? d.color : "rgba(255,255,255,0.1)",
                          boxShadow: isSel ? `0 0 20px ${d.color}33` : "none",
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-head text-sm font-bold" style={{ color: d.color }}>
                            {d.name}
                          </span>
                          <span
                            className="text-[10px] font-head font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${d.color}20`, color: d.color }}
                          >
                            {d.tag}
                          </span>
                        </div>
                        <p className="text-white/55 text-xs leading-relaxed font-head">{d.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
