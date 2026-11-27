import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Swords,
  Library,
  BookOpen,
  Package,
  Hammer,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Trophy,
} from "lucide-react";
import { api } from "@/lib/api";
import CardTemplate from "@/components/CardTemplate";

const HERO_BG =
  "https://wqnuijtdmorxprhl.public.blob.vercel-storage.com/glimmerfall/static/hero_bg-LEXvPiF25DW4GwYAIML7yqFaTveuiz.png";

const FEATURES = [
  {
    to: "/play",
    icon: Swords,
    title: "Battle Arena",
    desc: "Queue Ranked Elo, Casual quickplay, Private Best-of-3 Lobbies, or GlimmerBot AI on mobile & desktop.",
    color: "#F2A900",
  },
  {
    to: "/sandbox",
    icon: GraduationCap,
    title: "Interactive Tutorial",
    desc: "Learn Glimmer Nodes, instant Entities, Guard combat, and Flash spells hands-on in 2 minutes.",
    color: "#00BFFF",
  },
  {
    to: "/cards",
    icon: Library,
    title: "Card Database",
    desc: "Explore and filter the complete 322-card First Edition Oracle across all four factions.",
    color: "#38BDF8",
  },
  {
    to: "/decks",
    icon: Hammer,
    title: "Deck Hub & Builder",
    desc: "Forge 40-card decks, inspect curve analytics, import starter lists, and vote on community brews.",
    color: "#22E07B",
  },
  {
    to: "/booster",
    icon: Package,
    title: "Booster Simulator",
    desc: "Crack packs and chase holographic Epics and Founders Foils.",
    color: "#9B30FF",
  },
  {
    to: "/learn",
    icon: BookOpen,
    title: "How to Play & Rules",
    desc: "Master turn sequencing, keywords, faction synergies, and competitive Ranked tiers.",
    color: "#F2A900",
  },
];

export default function Home() {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    api
      .get("/cards")
      .then((r) => setCards(r.data))
      .catch(() => {});
  }, []);

  const showcase = React.useMemo(() => {
    const pick = [];
    ["Solari", "Umbri", "Terra", "Aether"].forEach((fac) => {
      let options = cards.filter((x) => x.faction === fac && (x.rarity === "Epic" || x.rarity === "Rare"));
      if (options.length === 0) options = cards.filter((x) => x.faction === fac);
      if (options.length > 0) {
        pick.push(options[Math.floor(Math.random() * options.length)]);
      }
    });
    return pick;
  }, [cards]);

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B0C10]/45 via-[#0B0C10]/75 to-[#0B0C10]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12 md:pt-20 md:pb-24 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-head tracking-widest uppercase text-[#F2A900] mb-4 sm:mb-6"
            >
              <Sparkles className="w-3.5 h-3.5" /> The Awakening · First Edition
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="font-display font-black leading-[0.95] text-4xl sm:text-6xl lg:text-7xl"
            >
              GLIMMER
              <span className="text-[#F2A900] drop-shadow-[0_0_25px_rgba(242,169,0,0.6)]">FALL</span>
              <span className="block text-lg sm:text-2xl lg:text-3xl mt-3 text-white/75 font-head font-light tracking-wide leading-snug">
                A Tactical Trading Card Game of Light &amp; Void — built for mobile &amp; tabletop mastery.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-4 sm:mt-6 text-white/65 max-w-lg text-sm sm:text-base leading-relaxed font-head"
            >
              Turn any card into a Glimmer Node, deploy Entities ready to strike immediately, and weave instant Flash spells across four warring factions.
            </motion.p>

            {/* Primary Mobile-First CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3"
            >
              <Link
                to="/play"
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#F2A900] text-black font-head font-bold hover:bg-[#ffc21f] transition-all shadow-[0_0_30px_rgba(242,169,0,0.45)]"
              >
                <Swords className="w-5 h-5" /> Play Free in Arena
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/sandbox"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#00BFFF]/15 border border-[#00BFFF]/40 text-[#7FDBFF] font-head font-bold hover:bg-[#00BFFF]/25 transition-all"
              >
                <GraduationCap className="w-5 h-5" /> 2-Min Tutorial
              </Link>
              <Link
                to="/shop"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl glass font-head font-semibold hover:border-white/25 transition-all text-sm"
              >
                <Package className="w-4 h-4 text-[#F2A900]" /> Reserve 1st Edition Box
              </Link>
            </motion.div>

            {/* Quick Secondary Links */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-head text-white/55">
              <Link to="/learn" className="hover:text-[#F2A900] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> How to Play Guide
              </Link>
              <Link to="/leaderboard" className="hover:text-[#00BFFF] flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" /> Ranked Ladder
              </Link>
              <Link to="/stores" className="hover:text-white">
                Sanctioned Stores &amp; Events →
              </Link>
            </div>
          </div>

          {/* Mobile Card Showcase Rail */}
          {showcase.length > 0 && (
            <div className="lg:hidden -mx-4 px-4 flex gap-3 overflow-x-auto no-scrollbar py-2">
              {showcase.map((c) => (
                <Link key={c.id} to="/cards" className="shrink-0">
                  <CardTemplate card={c} size="sm" tilt={false} />
                </Link>
              ))}
            </div>
          )}

          {/* Desktop Floating Cards */}
          <div className="relative h-[380px] hidden lg:block">
            {showcase.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.12 }}
                className="absolute animate-floaty"
                style={{
                  left: `${i * 20}%`,
                  top: `${(i % 2) * 56}px`,
                  animationDelay: `${i * 0.8}s`,
                  zIndex: i,
                }}
              >
                <CardTemplate card={c} size="lg" tilt />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feat) => (
            <Link
              key={feat.to}
              to={feat.to}
              data-testid={`home-feature-${feat.title.toLowerCase().replace(/\s+/g, "-")}`}
              className="glass rounded-2xl p-5 sm:p-6 group hover:-translate-y-1 transition-transform relative overflow-hidden flex items-start gap-4 sm:flex-col sm:gap-0"
            >
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 sm:mb-4"
                style={{ background: `${feat.color}1f`, color: feat.color }}
              >
                <feat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-head text-base sm:text-lg font-bold mb-1">{feat.title}</h3>
                <p className="text-white/55 text-xs sm:text-sm leading-relaxed font-head">{feat.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* THE FOUR FACTIONS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="font-display text-xs font-bold mb-6 text-center uppercase tracking-[0.3em] text-white/40">
          Four Warring Realms
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {[
            {
              title: "Solari, The Light",
              color: "#F2A900",
              body: "Radiant citadels guarded by angelic heralds and unbreakable Bastions. Solari forces heal wounds, fortify allies with Relics, and overwhelm foes beneath divine brilliance.",
            },
            {
              title: "Umbri, The Shadow",
              color: "#9B30FF",
              body: "Assassins walking through smoke and the edges of the Void. Umbri decks disrupt hands, exploit Stealth and Lethal, and sacrifice pawns to awaken forbidden power.",
            },
            {
              title: "Terra, The Earth",
              color: "#22E07B",
              body: "Root, stone, storm, and primal blood. Terra Summoners accelerate their Glimmer Nodes and command colossal elementals with unstoppable Overwhelm.",
            },
            {
              title: "Aether, The Magic",
              color: "#00BFFF",
              body: "Starforged scholars bending time and probability. Aether decks master Rites and reactive Flashes, draw extra cards, and turn clever sequencing into sudden victory.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden border transition-colors"
              style={{ borderColor: `${f.color}33` }}
            >
              <h3 className="font-display text-2xl font-black mb-2.5" style={{ color: f.color }}>
                {f.title}
              </h3>
              <p className="text-white/70 font-head leading-relaxed text-sm sm:text-base">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROJECT TRANSPARENCY */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-14">
        <div className="glass rounded-3xl p-6 sm:p-10 border border-white/10">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-5">
            Project Transparency &amp; First Edition Print Run
          </h2>
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 text-white/70 font-head text-sm leading-relaxed">
            <div className="space-y-3">
              <h3 className="text-[#00BFFF] font-semibold text-base">Development &amp; Quality</h3>
              <p>
                GlimmerFall is crafted for both competitive digital play and physical tabletop collection. Our First Edition print run is capped at <strong>500 booster boxes</strong> for early supporters, manufactured at an internationally established TCG facility.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-[#00BFFF] font-semibold text-base">Fulfillment &amp; Support</h3>
              <p>
                Expected physical shipping timeframe is Q4 2026 with hassle-free pre-shipment cancellation anytime. Questions?{" "}
                <Link to="/support" className="text-[#00BFFF] hover:underline">
                  Contact Support
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
