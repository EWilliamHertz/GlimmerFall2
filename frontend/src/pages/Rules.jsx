import React from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Shield, Eye, Ghost, Skull, Waves, Zap, Layers, GraduationCap, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import useSWR from "swr";
import { FACTIONS, KEYWORDS } from "@/lib/factions";

const fetcher = (url) => api.get(url).then((r) => r.data);

const KW_ICONS = {
  Guard: Shield,
  Evasive: Eye,
  Stealth: Ghost,
  Lethal: Skull,
  Overwhelm: Waves,
  Echo: Zap,
};

const TYPES = [
  {
    name: "Entity",
    desc: "Warriors and creatures placed on the battlefield. Entities enter ready (no summoning sickness) and can attack the opponent's Nexus or Entities during your turn.",
  },
  {
    name: "Rite (Spell)",
    desc: "Slow spells. Cast anytime during your own turn for powerful board effects, then placed into the Void.",
  },
  {
    name: "Flash (Spell)",
    desc: "Fast spells. Can be cast during EITHER player's turn whenever you have enough unspent Energy.",
  },
  {
    name: "Relic",
    desc: "Permanent artifacts that either remain on your board with passive abilities or attach to an Entity to buff its stats and keywords.",
  },
];

export default function Rules() {
  const { data: sections = [] } = useSWR("/rules", fetcher);

  return (
    <div data-testid="rules-page" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold mb-1.5">Comprehensive Rulebook</h1>
          <p className="text-white/55 font-head text-sm sm:text-base">
            The official tenets, combat rules, keywords, and codex laws of GlimmerFall.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/learn"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass text-xs font-head font-bold text-[#F2A900] hover:border-[#F2A900]/40"
          >
            <BookOpen className="w-4 h-4" /> Visual Guide
          </Link>
          <Link
            to="/sandbox"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00BFFF] text-black text-xs font-head font-bold"
          >
            <GraduationCap className="w-4 h-4" /> Play Tutorial
          </Link>
        </div>
      </div>

      {/* Core loop */}
      <section className="glass rounded-2xl p-5 sm:p-7">
        <h2 className="font-display text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#F2A900]" /> The Core Rules
        </h2>
        <ul className="space-y-2.5 text-white/75 text-sm leading-relaxed list-disc pl-5 font-head">
          <li>
            Your Nexus begins with <b className="text-white">30 Health</b> and a <b className="text-white">40-card deck</b> (max 3 copies per card, 5-card opening hand). Reduce your opponent's Nexus to 0 HP to win.
          </li>
          <li>
            At the start of your turn, refill Energy to your maximum and ready all your Entities.
          </li>
          <li>
            Once per turn, you may <b className="text-white">draw 1 card</b> and charge <b className="text-white">1 Glimmer Node</b> (place any card from hand into your Resonance Row to raise Max Energy by +1 up to 12, gaining +1 Energy immediately).
          </li>
          <li>
            Spend Energy to deploy Entities, attach or place Relics, cast Rites and Flashes, and attack with ready Entities in <b className="text-white">any order</b> during your turn.
          </li>
        </ul>
      </section>

      {/* Card types */}
      <section className="glass rounded-2xl p-5 sm:p-7">
        <h2 className="font-display text-xl sm:text-2xl font-bold mb-4">Card Types</h2>
        <div className="grid sm:grid-cols-2 gap-3.5">
          {TYPES.map((t) => (
            <div key={t.name} className="bg-black/30 rounded-xl p-4 border border-white/10">
              <h3 className="font-head font-bold text-[#F2A900] mb-1">{t.name}</h3>
              <p className="text-xs sm:text-sm text-white/70 font-head leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Keywords */}
      <section className="glass rounded-2xl p-5 sm:p-7">
        <h2 className="font-display text-xl sm:text-2xl font-bold mb-4">Keywords</h2>
        <div className="grid sm:grid-cols-2 gap-3.5">
          {Object.entries(KEYWORDS).map(([name, desc]) => {
            const Icon = KW_ICONS[name] || Zap;
            return (
              <div key={name} className="bg-black/30 rounded-xl p-4 border border-white/10 flex items-start gap-3">
                <Icon className="w-5 h-5 text-[#00BFFF] shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-head font-bold text-white text-sm">{name}</h3>
                  <p className="text-xs text-white/65 font-head mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Factions */}
      <section className="glass rounded-2xl p-5 sm:p-7">
        <h2 className="font-display text-xl sm:text-2xl font-bold mb-4">Factions</h2>
        <div className="grid sm:grid-cols-2 gap-3.5">
          {Object.values(FACTIONS).map((f) => (
            <div
              key={f.name}
              className="rounded-xl p-4 border bg-black/30"
              style={{ borderColor: `${f.color}40` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-display font-bold text-lg" style={{ color: f.color }}>
                  {f.name}
                </span>
                <span className="text-xs font-head text-white/50">{f.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dynamic DB Rulebook Sections */}
      {sections.length > 0 && (
        <div className="space-y-4">
          {sections.map((sec) => (
            <section key={sec.id} className="glass rounded-2xl p-5 sm:p-7">
              <h2 className="font-display text-xl sm:text-2xl font-bold mb-3 text-[#F2A900]">{sec.title}</h2>
              <div className="prose prose-invert prose-sm max-w-none font-head text-white/75 leading-relaxed">
                <ReactMarkdown>{sec.content}</ReactMarkdown>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
