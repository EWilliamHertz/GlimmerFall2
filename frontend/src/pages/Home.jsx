import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Swords, Library, BookOpen, Package, Hammer, ArrowRight, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { FACTIONS } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";

const HERO_BG =
  "https://static.prod-images.emergentagent.com/jobs/b8c31a9c-2781-4f44-b53e-2f632cd70450/images/6b32b9586616bef4733ae73acd6ec2dcad2406fd070f4347b9c293262a10af01.png";

const FEATURES = [
  { to: "/play", icon: Swords, title: "Player Arena", desc: "Battle live opponents or the GlimmerBot AI on a full drag-and-drop board.", color: "#F2A900" },
  { to: "/cards", icon: Library, title: "Card Database", desc: "Search and filter the complete 100-card Oracle across four factions.", color: "#00BFFF" },
  { to: "/decks", icon: Hammer, title: "Deck Builder", desc: "Forge single-faction decks, track your mana curve and save your lists.", color: "#22E07B" },
  { to: "/booster", icon: Package, title: "Booster Simulator", desc: "Crack packs and chase holographic Mythics and Founders Foils.", color: "#9B30FF" },
  { to: "/rules", icon: BookOpen, title: "Rulebook", desc: "Learn the tenets, keywords and faction lore of GlimmerFall.", color: "#F2A900" },
];

export default function Home() {
  const [cards, setCards] = useState([]);
  useEffect(() => {
    api.get("/cards").then((r) => setCards(r.data)).catch(() => {});
  }, []);

  const showcase = React.useMemo(() => {
    const pick = [];
    ["Solari", "Umbri", "Terra", "Aether"].forEach((fac) => {
      const c = cards.find((x) => x.faction === fac && (x.rarity === "Mythic" || x.rarity === "Rare"));
      if (c) pick.push(c);
    });
    return pick;
  }, [cards]);

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B0C10]/40 via-[#0B0C10]/70 to-[#0B0C10]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-5 pt-24 pb-20 md:pt-32 md:pb-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-head tracking-widest uppercase text-[#F2A900] mb-6"
            >
              <Sparkles className="w-3.5 h-3.5" /> The Awakening · Set One
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="font-display font-black leading-[0.95] text-5xl sm:text-6xl lg:text-7xl"
            >
              GLIMMER<span className="text-[#F2A900] drop-shadow-[0_0_25px_rgba(242,169,0,0.6)]">FALL</span>
              <span className="block text-2xl sm:text-3xl lg:text-4xl mt-3 text-white/70 font-head font-light tracking-wide">
                A Trading Card Game of Light &amp; Void
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-6 text-white/60 max-w-md text-base leading-relaxed"
            >
              Channel Resonance, deploy Entities and weave spells across four warring factions.
              Command your Vanguard and shatter your rival's Nexus.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-9 flex flex-wrap gap-4"
            >
              <Link
                to="/play"
                data-testid="home-enter-arena"
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#F2A900] text-black font-head font-semibold hover:bg-[#ffc21f] transition-all shadow-[0_0_30px_rgba(242,169,0,0.45)]"
              >
                <Swords className="w-5 h-5" /> Enter the Arena
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/booster"
                data-testid="home-open-booster"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full glass font-head font-semibold hover:border-white/25 transition-all"
              >
                <Package className="w-5 h-5" /> Open a Booster
              </Link>
            </motion.div>
          </div>

          {/* floating cards */}
          <div className="relative h-[380px] hidden lg:block">
            {showcase.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.12 }}
                className="absolute animate-floaty"
                style={{ left: `${i * 20}%`, top: `${(i % 2) * 60}px`, animationDelay: `${i * 0.8}s`, zIndex: i }}
              >
                <CardTemplate card={c} size="lg" tilt />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FACTIONS strip */}
      <section className="max-w-7xl mx-auto px-5 py-14">
        <h2 className="font-display text-2xl md:text-3xl font-bold mb-8 text-center">Four Factions, One Nexus</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(FACTIONS).map((f) => (
            <div
              key={f.name}
              data-testid={`home-faction-${f.name.toLowerCase()}`}
              className="glass rounded-2xl p-6 relative overflow-hidden group"
            >
              <div
                className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity"
                style={{ background: f.color }}
              />
              <div className="w-10 h-1.5 rounded-full mb-4" style={{ background: f.grad }} />
              <h3 className="font-display text-xl font-bold" style={{ color: f.color }}>{f.name}</h3>
              <p className="text-white/50 text-sm mt-1 font-head">{f.tag}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-5 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feat) => (
            <Link
              key={feat.to}
              to={feat.to}
              data-testid={`home-feature-${feat.title.toLowerCase().replace(/\s+/g, "-")}`}
              className="glass rounded-2xl p-7 group hover:-translate-y-1 transition-transform relative overflow-hidden"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${feat.color}1f`, color: feat.color }}
              >
                <feat.icon className="w-6 h-6" />
              </div>
              <h3 className="font-head text-lg font-semibold mb-2">{feat.title}</h3>
              <p className="text-white/55 text-sm leading-relaxed">{feat.desc}</p>
              <ArrowRight className="w-5 h-5 mt-4 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
