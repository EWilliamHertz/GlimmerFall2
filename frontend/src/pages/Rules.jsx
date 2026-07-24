import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { Shield, Eye, Ghost, Skull, Waves, Zap, Layers } from "lucide-react";
import { api } from "@/lib/api";
import { FACTIONS, KEYWORDS } from "@/lib/factions";

const KW_ICONS = { Guard: Shield, Evasive: Eye, Stealth: Ghost, Lethal: Skull, Overwhelm: Waves, Swift: Zap };

const TYPES = [
  { name: "Entity", desc: "Creatures placed on the battlefield. No summoning sickness — they can attack immediately." },
  { name: "Rite", desc: "Slow spells. Can only be cast during your own main turn." },
  { name: "Flash", desc: "Fast spells. Can be cast during either player's turn to interrupt or respond." },
  { name: "Relic", desc: "Artifacts that stay on the board providing passive effects." },
];

export default function Rules() {
  const [sections, setSections] = useState([]);
  useEffect(() => {
    api.get("/rules").then((r) => setSections(r.data)).catch(() => {});
  }, []);

  return (
    <div data-testid="rules-page" className="max-w-3xl mx-auto px-5 py-12">
      <h1 className="font-display text-4xl md:text-5xl font-bold mb-2">Rulebook</h1>
      <p className="text-white/50 font-head mb-10">The tenets, keywords and lore of GlimmerFall.</p>

      {/* Alpha Notice */}
      <section className="glass rounded-2xl p-7 mb-8 border border-[#F2A900]/30 bg-[#F2A900]/5">
        <h2 className="font-display text-xl font-bold mb-2 text-[#F2A900]">Alpha Notice: Deckbuilding & Factions</h2>
        <p className="text-white/80 text-sm leading-relaxed">
          It is currently undetermined in the Alpha stage whether players will be permitted to mix different factions together in a single deck, or if deckbuilding will strictly bind you to a single faction. 
          If you have any tips and tricks regarding this, they are well sought after!
        </p>
      </section>

      {/* Core loop */}
      <section className="glass rounded-2xl p-7 mb-8">
        <h2 className="font-display text-2xl font-bold mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-[#F2A900]" /> The Core Loop</h2>
        <ul className="space-y-2.5 text-white/75 text-sm leading-relaxed list-disc pl-5">
          <li>Your Nexus begins with <b className="text-white">25 health</b>. Reduce your opponent's to 0 to win.</li>
          <li>Each turn, refill Energy to your maximum, then play one <b className="text-white">Resonance Node</b> (drag any card to the Resonance Row) to raise your maximum Energy by 1.</li>
          <li>You may <b className="text-white">draw only 1 card</b> and play <b className="text-white">1 Resonance Node</b> per turn.</li>
          <li>Spend Energy to deploy Entities, cast spells and place Relics, then attack with your Entities.</li>
        </ul>
      </section>

      {/* Card types */}
      <section className="mb-8">
        <h2 className="font-display text-2xl font-bold mb-4">Card Types</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {TYPES.map((t) => (
            <div key={t.name} className="glass rounded-xl p-5" data-testid={`rules-type-${t.name.toLowerCase()}`}>
              <h3 className="font-head font-semibold text-[#00BFFF] mb-1">{t.name}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Keywords */}
      <section className="mb-8">
        <h2 className="font-display text-2xl font-bold mb-4">Keywords</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.entries(KEYWORDS).map(([kw, desc]) => {
            const Icon = KW_ICONS[kw] || Zap;
            return (
              <div key={kw} className="glass rounded-xl p-4 flex gap-3" data-testid={`rules-kw-${kw.toLowerCase()}`}>
                <div className="w-9 h-9 rounded-lg bg-[#F2A900]/15 text-[#F2A900] flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-head font-semibold">{kw}</h3>
                  <p className="text-white/60 text-sm leading-snug">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Faction colour legend */}
      <section className="mb-10">
        <h2 className="font-display text-2xl font-bold mb-4">Faction Identities</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(FACTIONS).map((f) => (
            <div key={f.name} className="glass rounded-xl p-4 flex items-center gap-3">
              <span className="w-3 h-10 rounded-full" style={{ background: f.grad }} />
              <div>
                <h3 className="font-head font-semibold" style={{ color: f.color }}>{f.name}</h3>
                <p className="text-white/50 text-xs">{f.tag}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DB rulebook sections */}
      {sections.map((s, i) => (
        <motion.section
          key={s.id}
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          className="glass rounded-2xl p-7 mb-6"
          data-testid={`rules-section-${i}`}
        >
          <h2 className="font-display text-2xl font-bold mb-4">{s.title}</h2>
          <div className="prose-gf">
            <ReactMarkdown
              components={{
                h1: (p) => <h3 className="font-head text-xl font-semibold mt-4 mb-2" {...p} />,
                h2: (p) => <h4 className="font-head text-lg font-semibold mt-4 mb-2 text-[#F2A900]" {...p} />,
                h3: (p) => <h4 className="font-head font-semibold mt-3 mb-1.5 text-[#00BFFF]" {...p} />,
                p: (p) => <p className="text-white/75 leading-relaxed mb-3 text-sm" {...p} />,
                ul: (p) => <ul className="list-disc pl-5 space-y-1.5 mb-3 text-white/75 text-sm" {...p} />,
                ol: (p) => <ol className="list-decimal pl-5 space-y-1.5 mb-3 text-white/75 text-sm" {...p} />,
                strong: (p) => <strong className="text-white font-semibold" {...p} />,
              }}
            >
              {s.content}
            </ReactMarkdown>
          </div>
        </motion.section>
      ))}
    </div>
  );
}
