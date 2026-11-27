import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Swords,
  Zap,
  Layers,
  Shield,
  Eye,
  Ghost,
  Skull,
  Waves,
  Sparkles,
  Trophy,
  Clock,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  ArrowRight,
  Users,
} from "lucide-react";
import { FACTIONS } from "@/lib/factions";

const SECTIONS = [
  { id: "quickstart", label: "Quickstart" },
  { id: "nodes", label: "Glimmer Nodes" },
  { id: "turn", label: "Turn Flow" },
  { id: "types", label: "Card Types" },
  { id: "keywords", label: "Combat & Keywords" },
  { id: "factions", label: "Factions" },
  { id: "ranked", label: "Ranked & Lobbies" },
  { id: "faq", label: "FAQ" },
];

const KEYWORD_GUIDE = [
  {
    name: "Guard",
    icon: Shield,
    color: "#38BDF8",
    summary: "Frontline protector. Enemies must attack a Guard Entity before hitting your Nexus or non-Guard allies.",
    detail: "Note: If an Entity has both Guard and Stealth, Guard only blocks once Stealth breaks!",
  },
  {
    name: "Evasive",
    icon: Eye,
    color: "#00BFFF",
    summary: "Flies past frontline defenses — can strike the Enemy Nexus or backline Entities even if they control a Guard.",
    detail: "Great for closing out games when the board stalls behind heavy Terra or Solari blockers.",
  },
  {
    name: "Stealth",
    icon: Ghost,
    color: "#9B30FF",
    summary: "Cannot be attacked or targeted by enemy spells while Stealthed. Attacking breaks Stealth permanently.",
    detail: "Area-of-effect spells ('deal damage to all opposing Entities') can still hit Stealthed units!",
  },
  {
    name: "Lethal",
    icon: Skull,
    color: "#22E07B",
    summary: "Deadly venom — any amount of combat damage (> 0) dealt to an Entity destroys it outright.",
    detail: "Works both when attacking AND when striking back as a defender!",
  },
  {
    name: "Overwhelm",
    icon: Waves,
    color: "#F2A900",
    summary: "Excess attack damage beyond a blocker's remaining Health tramples straight onto the Enemy Nexus.",
    detail: "Example: A 6-Power Overwhelm Entity attacking a 2-Health Guard deals 4 overflow damage to the Nexus!",
  },
  {
    name: "Echo & Scry",
    icon: Sparkles,
    color: "#E879F9",
    summary: "Spell & deck mastery. Scry effects inspect top cards of your deck to stack draws or fuel the Void.",
    detail: "The Void is your discard/graveyard zone — Umbri and Aether cards often revive or scale with the Void.",
  },
];

const FAQS = [
  {
    q: "Do Entities have summoning sickness?",
    a: "No! In GlimmerFall, Entities enter the battlefield ready and may attack immediately on the turn you deploy them. Positioning and open Energy for Flash spells are how defenders respond.",
  },
  {
    q: "Which cards should I turn into Glimmer Nodes?",
    a: "On Turns 1–3, convert situational or expensive high-cost cards (5+ Cost) into Glimmer Nodes so you can deploy 1–3 Cost threats immediately. Late game, once you have 6–8 Nodes, keep your haymakers and convert cheap 1-drops instead!",
  },
  {
    q: "Must I draw my card before playing anything on my turn?",
    a: "No! You get 1 Draw and 1 Glimmer Node per turn, and you can take them at ANY point during your turn — for instance, casting a Scry effect first to inspect the top of your deck before tapping Draw!",
  },
  {
    q: "How can I play on my opponent's turn?",
    a: "Leave unspent Energy open when you end your turn. If you hold a Flash spell in hand with enough open Energy, you can tap and cast it right in the middle of your opponent's turn!",
  },
  {
    q: "What happens if my deck runs out of cards?",
    a: "Each time you draw from an empty library, your Nexus takes 1 Fatigue damage instead.",
  },
];

export default function Learn() {
  const [activeKw, setActiveKw] = useState(KEYWORD_GUIDE[0].name);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div data-testid="learn-page" className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">
      {/* Hero Banner */}
      <section className="glass-strong rounded-3xl p-6 sm:p-10 border border-[#F2A900]/25 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-[#F2A900]/10 blur-3xl pointer-events-none" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2A900]/15 text-[#F2A900] text-xs font-head font-bold uppercase tracking-widest mb-3">
          <BookOpen className="w-3.5 h-3.5" /> Official Player Guide
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-black leading-tight">
          HOW TO PLAY <span className="text-[#F2A900]">GLIMMERFALL</span>
        </h1>
        <p className="text-white/65 font-head text-sm sm:text-base max-w-2xl mt-2 leading-relaxed">
          Everything you need to master Resonance, command the four factions, and climb the Ranked Elo Ladder — designed to read in 3 minutes or learn hands-on in our interactive simulator.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            to="/sandbox"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#00BFFF] hover:bg-[#38ccff] text-black font-head font-bold text-sm shadow-[0_0_25px_rgba(0,191,255,0.35)]"
          >
            <GraduationCap className="w-5 h-5" /> Play Interactive Tutorial (2 Min)
          </Link>
          <Link
            to="/play"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#F2A900] hover:bg-[#ffc21f] text-black font-head font-bold text-sm"
          >
            <Swords className="w-4 h-4" /> Enter the Arena
          </Link>
          <Link
            to="/rules"
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl glass text-white/80 hover:text-white font-head font-semibold text-sm"
          >
            Comprehensive Rulebook <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Sticky Section Jump Rail */}
      <div className="sticky top-14 z-30 -mx-4 px-4 py-2.5 bg-[#0B0C10]/90 backdrop-blur-xl border-y border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-head font-semibold text-white/80 hover:text-white shrink-0 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Quickstart */}
      <section id="quickstart" className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-[#F2A900]" /> 1. The Goal in 60 Seconds
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 border border-white/10">
            <div className="font-num text-3xl font-black text-[#22E07B] mb-1">30 HP</div>
            <div className="font-head font-bold text-white text-sm mb-1">Shatter the Enemy Nexus</div>
            <p className="text-xs text-white/60 font-head leading-relaxed">
              Both Summoners start at 30 Nexus Health with a 5-card opening hand. Reduce your rival's Nexus to 0 HP to win!
            </p>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/10">
            <div className="font-num text-3xl font-black text-[#00BFFF] mb-1">1 Node / Turn</div>
            <div className="font-head font-bold text-white text-sm mb-1">Every Card is Energy</div>
            <p className="text-xs text-white/60 font-head leading-relaxed">
              No mana screw! Once per turn, charge ANY card from your hand into your Resonance Row for +1 permanent Max Energy (up to 12).
            </p>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/10">
            <div className="font-num text-3xl font-black text-[#F2A900] mb-1">Instant Action</div>
            <div className="font-head font-bold text-white text-sm mb-1">No Summoning Sickness</div>
            <p className="text-xs text-white/60 font-head leading-relaxed">
              Entities deploy ready to attack right away! Draw, Resonate, cast spells, and strike in any order on your turn.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Glimmer Nodes & Energy */}
      <section id="nodes" className="scroll-mt-28 glass rounded-3xl p-6 sm:p-8 border border-[#00BFFF]/25 space-y-4">
        <div className="flex items-center gap-2.5">
          <Zap className="w-6 h-6 text-[#00BFFF]" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold">2. Glimmer Nodes &amp; Resonance</h2>
        </div>
        <p className="text-sm sm:text-base text-white/75 font-head leading-relaxed">
          GlimmerFall eliminates dedicated "land" cards. Instead, <strong className="text-white">every card in your hand has two uses</strong>: you can either spend Energy to play it for its card effect, OR sacrifice it face-down into your <strong className="text-[#00BFFF]">Resonance Row</strong> as a Glimmer Node.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-black/35 rounded-2xl p-4 border border-white/10 space-y-2">
            <div className="text-xs font-head uppercase tracking-wider text-[#00BFFF] font-bold">
              How Charging Works
            </div>
            <ul className="space-y-1.5 text-xs sm:text-sm font-head text-white/70">
              <li>• Tap any card in hand → tap <b className="text-white">Charge as Node (+1)</b> (or drag it to the Resonance Row).</li>
              <li>• Raises your <b className="text-white">Max Energy by +1</b> AND grants <b className="text-white">+1 usable Energy immediately</b>.</li>
              <li>• Limit: <b className="text-white">1 Node per turn</b>, up to <b className="text-white">12 Max Energy</b>.</li>
            </ul>
          </div>
          <div className="bg-black/35 rounded-2xl p-4 border border-[#F2A900]/25 space-y-2">
            <div className="text-xs font-head uppercase tracking-wider text-[#F2A900] font-bold">
              Pro Strategy Tip
            </div>
            <p className="text-xs sm:text-sm font-head text-white/70 leading-relaxed">
              On Turn 1, convert a costly 5–7 Energy card into your first Glimmer Node so you keep cheap 1–2 Cost Entities ready to deploy immediately!
            </p>
          </div>
        </div>
      </section>

      {/* 3. Turn Structure */}
      <section id="turn" className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
          <Clock className="w-6 h-6 text-[#22E07B]" /> 3. Anatomy of a Turn
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: "Phase A · Start of Turn",
              title: "Refill & Ready",
              desc: "Your Energy automatically refills to your current Max Energy, and all your exhausted Entities become ready to attack again.",
              color: "#22E07B",
            },
            {
              step: "Phase B · Main Phase (Free Order!)",
              title: "Draw, Charge, Deploy & Strike",
              desc: "In ANY sequence you choose: tap Draw (once/turn), charge a Glimmer Node (once/turn), deploy Entities/Relics, cast Rites/Flashes, and attack with ready Entities.",
              color: "#F2A900",
            },
            {
              step: "Phase C · End Turn",
              title: "Pass & Hold Flash Energy",
              desc: "Tap End Turn. Temporary 'until End Phase' buffs expire. Any unspent Energy stays available to cast Flash spells during your opponent's turn!",
              color: "#00BFFF",
            },
          ].map((p) => (
            <div key={p.step} className="glass rounded-2xl p-5 border border-white/10 flex flex-col gap-2">
              <span className="text-[11px] font-head uppercase tracking-widest font-bold" style={{ color: p.color }}>
                {p.step}
              </span>
              <h3 className="font-display text-lg font-bold text-white">{p.title}</h3>
              <p className="text-xs sm:text-sm font-head text-white/65 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Card Types */}
      <section id="types" className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
          <Layers className="w-6 h-6 text-[#9B30FF]" /> 4. The Four Card Types
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              type: "Entity",
              speed: "Your Turn · Stays on Board",
              color: "#FF5252",
              desc: "Warriors, beasts, and celestials with Power (attack) and Health. Deploy ready to strike! When two Entities clash, BOTH deal their Power in damage to each other. At 0 Health, an Entity goes to the Void.",
            },
            {
              type: "Rite (Spell)",
              speed: "Your Turn Only · One-Shot",
              color: "#00BFFF",
              desc: "Sorceries and rituals with high-impact effects — board wipes, multi-card draw, token armies, or Void revival. Resolves and goes to the Void.",
            },
            {
              type: "Flash (Spell)",
              speed: "ANY Turn! · Instant Response",
              color: "#F2A900",
              desc: "Fast tactical spells castable on your turn OR during your opponent's turn! Ambush attackers, buff allies mid-combat, or snipe low-HP threats.",
            },
            {
              type: "Relic",
              speed: "Your Turn · Permanent Artifact",
              color: "#22E07B",
              desc: "Ancient artifacts. Standalone Relics grant ongoing passive triggers, while Attachment Relics bind to your strongest Entity to grant permanent stats and keywords!",
            },
          ].map((ct) => (
            <div key={ct.type} className="glass rounded-2xl p-5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-xl font-bold" style={{ color: ct.color }}>
                  {ct.type}
                </h3>
                <span className="text-[10px] font-head uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-white/60">
                  {ct.speed}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-head text-white/70 leading-relaxed">{ct.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Combat & Interactive Keywords */}
      <section id="keywords" className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
          <Swords className="w-6 h-6 text-[#F2A900]" /> 5. Combat &amp; Keywords Explorer
        </h2>
        <p className="text-xs sm:text-sm font-head text-white/60">
          Tap any keyword below to inspect its exact combat rules and interactions:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {KEYWORD_GUIDE.map((k) => {
            const Icon = k.icon;
            const isSel = activeKw === k.name;
            return (
              <button
                key={k.name}
                type="button"
                onClick={() => setActiveKw(k.name)}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                  isSel ? "bg-white/10" : "bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
                style={{ borderColor: isSel ? k.color : "rgba(255,255,255,0.1)" }}
              >
                <Icon className="w-5 h-5 shrink-0" style={{ color: k.color }} />
                <span className="font-head font-bold text-sm text-white">{k.name}</span>
              </button>
            );
          })}
        </div>

        {KEYWORD_GUIDE.filter((k) => k.name === activeKw).map((k) => (
          <motion.div
            key={k.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-5 border"
            style={{ borderColor: `${k.color}55` }}
          >
            <h3 className="font-display text-xl font-bold mb-1" style={{ color: k.color }}>
              {k.name}
            </h3>
            <p className="font-head text-sm text-white/85 leading-relaxed">{k.summary}</p>
            <p className="font-head text-xs text-white/55 mt-2 pt-2 border-t border-white/10">{k.detail}</p>
          </motion.div>
        ))}
      </section>

      {/* 6. The Four Factions */}
      <section id="factions" className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">6. The Four Factions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              ...FACTIONS.Solari,
              desc: "Radiant vanguard of Light. Excels at Nexus healing, Guard bastions, Relic attachments, and coordinated go-wide boards.",
              starter: "Solar Singularity",
            },
            {
              ...FACTIONS.Umbri,
              desc: "Assassins of the Void. Commands Stealth, Lethal, hand disruption, targeted removal, and reviving fallen Entities from the Void.",
              starter: "The Graveglass Veil",
            },
            {
              ...FACTIONS.Terra,
              desc: "Primal titans of root and stone. Accelerates Glimmer Nodes directly from the deck and overwhelms foes with colossal Entities.",
              starter: "Gaia's Loop",
            },
            {
              ...FACTIONS.Aether,
              desc: "Scholars of storm and time. Masters Flash instants, Scry deck manipulation, spell cost reduction, and spell-damage engines.",
              starter: "Fractured Continuum",
            },
          ].map((f) => (
            <div
              key={f.name}
              className="glass rounded-2xl p-5 border flex flex-col justify-between gap-3"
              style={{ borderColor: `${f.color}40` }}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-display text-xl font-bold" style={{ color: f.color }}>
                    {f.name}
                  </h3>
                  <span className="text-xs font-head text-white/50">{f.tag}</span>
                </div>
                <p className="text-xs sm:text-sm font-head text-white/70 leading-relaxed">{f.desc}</p>
              </div>
              <div className="text-xs font-head text-white/50 pt-2 border-t border-white/10">
                Starter Deck: <strong className="text-white">{f.starter}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Deckbuilding, Ranked Elo & Lobbies */}
      <section id="ranked" className="scroll-mt-28 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-3xl p-6 border border-[#F2A900]/25 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#F2A900]" />
            <h2 className="font-display text-xl font-bold">Ranked Elo &amp; Matchmaking</h2>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm font-head text-white/70 leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#F2A900] shrink-0 mt-0.5" />
              <span><b>Deck Construction:</b> 40 cards total, max 3 copies of any card, single or multi-faction!</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#F2A900] shrink-0 mt-0.5" />
              <span><b>10 Placement Games:</b> New Summoners start at 1400 MMR (Gold II) with boosted calibration (K=40) for their first 10 Ranked games.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#F2A900] shrink-0 mt-0.5" />
              <span><b>6 Competitive Tiers:</b> Bronze (0+) → Silver (1200+) → Gold (1400+) → Platinum (1600+) → Diamond (1800+) → Master (2000+).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#F2A900] shrink-0 mt-0.5" />
              <span><b>Fair Timers:</b> 90-second turn rope in Ranked (120s in Casual) and 60-second disconnect protection.</span>
            </li>
          </ul>
        </div>

        <div className="glass rounded-3xl p-6 border border-[#9B30FF]/25 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#C77DFF]" />
            <h2 className="font-display text-xl font-bold">Private Lobbies &amp; Series</h2>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm font-head text-white/70 leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C77DFF] shrink-0 mt-0.5" />
              <span><b>6-Character Room Codes &amp; Invite Links:</b> Create a room on `/play` and share a 1-tap join link with a friend on mobile or desktop.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C77DFF] shrink-0 mt-0.5" />
              <span><b>Custom Rules:</b> Choose 60s Blitz, 90s Standard, 120s Relaxed, or Untimed friendly play, plus Best-of-1 or Best-of-3 series tracking!</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C77DFF] shrink-0 mt-0.5" />
              <span><b>Deck Lock &amp; Ready Check:</b> Both players pick or swap decks and ready up before battle begins.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 8. FAQ */}
      <section id="faq" className="scroll-mt-28 space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2.5">
          <HelpCircle className="w-6 h-6 text-[#00BFFF]" /> 8. Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((item) => (
            <div key={item.q} className="glass rounded-2xl p-4 sm:p-5 border border-white/10">
              <h3 className="font-head font-bold text-sm sm:text-base text-white mb-1.5">{item.q}</h3>
              <p className="font-head text-xs sm:text-sm text-white/65 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
