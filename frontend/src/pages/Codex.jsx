import React, { useState } from "react";
import { BookOpen, Globe2, Sun, Moon, Mountain, Sparkles } from "lucide-react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { factionCfg } from "@/lib/factions";

const fetcher = (url) => api.get(url).then((r) => r.data);

const FACTION_LORE = {
  Solari: {
    title: "Solari, The Light",
    icon: "/solari_nobg.png",
    desc: (
      <div className="space-y-4">
        <p>The Solari believe order is mercy and truth is a weapon. Beneath vast aureate spires and skies split by holy radiance, angelic guardians and celestial champions stand as the last unbroken shield against the Fall.</p>
        <p>Originating from the High Heavens—a domain where shadows cannot exist—the Solari are unyielding zealots bound by the "Decree of the Sun." They deploy healing magic, impenetrable Bastions, and disciplined defenses to outlast their enemies. When the time is right, they unleash towering late-game Entities whose brilliance incinerates darkness instantly.</p>
        <p className="italic text-white/50">"Where there is light, there is law. Where there is shadow, there is a lesson to be taught in fire."</p>
      </div>
    )
  },
  Umbri: {
    title: "Umbri, The Darkness",
    icon: "/umbri_nobg.png",
    desc: (
      <div className="space-y-4">
        <p>The Umbri do not fear the Void; they listen to it. In hidden sanctums and moonless alleys, assassins, spectres, and forbidden scholars trade certainty for power, turning secrets into blades.</p>
        <p>Born from the deepest chasms of the fractured world, the Umbri manipulate the creeping corruption of the Fall rather than fight it. Their playstyle is swift, cruel, and deliberate: disrupt an opponent’s plans, drain their strength, strike from stealth, and sacrifice their own followers to claim an advantage no honest force could match.</p>
        <p className="italic text-white/50">"The light blinds you to the truth. Only in the dark can you see the strings that move the world."</p>
      </div>
    )
  },
  Terra: {
    title: "Terra, The Earth",
    icon: "/terra_nobg.png",
    desc: (
      <div className="space-y-4">
        <p>The Terra answer to older laws: root, stone, storm, and tooth. Their realm is alive with colossal elementals, primeval beasts, and wardens whose patience is measured in centuries.</p>
        <p>Connected through a massive subterranean Mycelial Network, the Terra harness raw elemental fury and unmatched resilience. They build momentum like a gathering mountain—accelerating their resources, fielding towering defenders, and eventually unleashing overwhelming force that simply flattens anything foolish enough to stand in its path.</p>
        <p className="italic text-white/50">"Civilizations rise and fall like the autumn leaves. The roots, however, remain forever."</p>
      </div>
    )
  },
  Aether: {
    title: "Aether, The Magic",
    icon: "/aether_nobg.png",
    desc: (
      <div className="space-y-4">
        <p>The Aether see reality as a current to be redirected, not a law to be obeyed. Amid cosmic storms, floating observatories, and fractured constellations, wizards and astral adepts weave possibility into power.</p>
        <p>Masters of the arcane and the infinite loop of time, the Aether twist the battlefield to their advantage. They reward spell mastery, rapid card draw, and clever manipulation, chaining devastating Rites into explosive combinations that can completely reshape existence in a single, spectacular moment.</p>
        <p className="italic text-white/50">"Do not look at the stars and wonder what they are. Look at the stars and tell them what to be."</p>
      </div>
    )
  }
};

export default function Codex() {
  const { data: cards = [] } = useSWR("/cards", fetcher);
  const [activeFaction, setActiveFaction] = useState("Solari");

  // Only get cards with lore
  const loreCards = cards.filter(c => c.lore && c.lore.trim().length > 0);
  
  // Filter cards by selected faction
  const displayedCards = loreCards.filter(c => c.faction === activeFaction);

  const activeData = FACTION_LORE[activeFaction];
  const activeCfg = factionCfg(activeFaction);
  const ActiveIcon = activeData.icon;

  return (
    <div className="max-w-6xl mx-auto px-5 py-24 space-y-16">
      
      {/* Header */}
      <div className="text-center">
        <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 flex items-center justify-center gap-4">
          <BookOpen className="w-12 h-12 text-[#00BFFF]" /> The Lore Codex
        </h1>
        <p className="text-white/60 font-head max-w-2xl mx-auto text-xl">
          Explore the deep lore, world history, and faction origins of GlimmerFall.
        </p>
      </div>

      {/* World Section */}
      <section className="glass rounded-[2rem] p-8 md:p-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Globe2 className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h2 className="font-display text-4xl font-bold mb-8 text-[#00BFFF]">The World of GlimmerFall</h2>
          <div className="space-y-6 text-white/80 font-head leading-relaxed text-xl max-w-4xl">
            <p>
              When the celestial radiance known as the Glimmer met the devouring silence of the Fall, reality did not end—it fractured. At the heart of creation, the Nexus, a crystalline core that bound all worlds into one, shattered in a storm of light, shadow, and impossible starlight. Its fragments fell into four realms, each reshaped by the force that claimed it.
            </p>
            <p>
              Now the realms stand at the brink of conquest. Through Resonance, powerful champions draw upon the shattered Nexus to deploy mighty Entities, unleash world-altering Rites, and defend what remains from forces that would bend existence to their will. Every clash is a struggle for more than victory: it is a battle to decide whether the Glimmer will restore the world—or the Fall will consume it forever.
            </p>
          </div>
        </div>
      </section>

      {/* Factions Section (Hyper Modern Tabbed Interface) */}
      <section className="space-y-12">
        <div className="text-center mb-8">
          <h2 className="font-display text-4xl font-bold text-white mb-4">Choose Your Realm</h2>
          <p className="text-white/50 font-head text-lg">Select a faction to uncover its history and legendary cards.</p>
        </div>

        {/* Faction Selector */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8">
          {Object.entries(FACTION_LORE).map(([faction, data]) => {
            const cfg = factionCfg(faction);
            const Icon = data.icon;
            const isActive = activeFaction === faction;
            
            return (
              <button
                key={faction}
                onClick={() => setActiveFaction(faction)}
                className={`relative px-8 py-5 rounded-2xl flex flex-col items-center gap-3 transition-all duration-500 font-head font-bold text-lg overflow-hidden group ${
                  isActive ? "bg-white/10 scale-105" : "bg-black/40 hover:bg-white/5 text-white/50 hover:text-white"
                }`}
                style={{
                  boxShadow: isActive ? `0 0 40px ${cfg.glow}` : "none",
                  border: `1px solid ${isActive ? cfg.color : "rgba(255,255,255,0.1)"}`,
                  color: isActive ? cfg.color : undefined
                }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: cfg.color }} />
                <img src={data.icon} alt={faction} className={`w-10 h-10 object-contain transition-transform duration-500 ${isActive ? "scale-110" : ""}`} style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.2))" }} />
                {faction}
              </button>
            );
          })}
        </div>

        {/* Faction Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFaction}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="glass rounded-[2rem] p-8 md:p-14 border-t-4"
            style={{ borderTopColor: activeCfg.color }}
          >
            <div className="flex items-center gap-5 mb-8">
              <div className="p-4 rounded-2xl bg-black/50" style={{ boxShadow: `0 0 30px ${activeCfg.glow}` }}>
                <img src={activeData.icon} alt={activeFaction} className="w-16 h-16 object-contain" />
              </div>
              <h3 className="font-display text-4xl font-bold" style={{ color: activeCfg.color }}>
                {activeData.title}
              </h3>
            </div>
            <div className="text-white/80 font-head text-xl leading-relaxed mb-12">
              {activeData.desc}
            </div>

            {/* Faction Cards */}
            <div>
              <h4 className="font-display text-2xl font-bold mb-6 flex items-center gap-3 text-white/90">
                Legends & Artifacts of {activeFaction}
              </h4>
              
              {displayedCards.length === 0 ? (
                <div className="p-8 text-center text-white/40 font-head italic border border-white/10 rounded-2xl bg-black/30">
                  No legendary tales have been recorded for this faction yet...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {displayedCards.map((c) => (
                    <div 
                      key={c.id} 
                      className="bg-black/60 rounded-2xl overflow-hidden flex flex-col sm:flex-row h-full border border-white/5 hover:border-white/20 transition-colors group"
                    >
                      {c.image_url && (
                        <div className="w-full sm:w-40 h-40 sm:h-auto shrink-0 relative border-b sm:border-b-0 sm:border-r border-white/10">
                          <img src={c.image_url} alt={c.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                      <div className="p-6 flex flex-col justify-center flex-1">
                        <h5 className="font-display text-2xl font-bold mb-1" style={{ color: activeCfg.color }}>{c.name}</h5>
                        <p className="text-white/30 text-[10px] font-head mb-3 uppercase tracking-widest">{c.card_type}</p>
                        <p className="text-white/70 italic font-head leading-relaxed text-sm">
                          "{c.lore}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </motion.div>
        </AnimatePresence>

      </section>
    </div>
  );
}
