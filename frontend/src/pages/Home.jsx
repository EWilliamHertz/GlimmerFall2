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
  const [stats, setStats] = useState({ total_preorders: 0 });
  useEffect(() => {
    api.get("/cards").then((r) => setCards(r.data)).catch(() => {});
    api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const showcase = React.useMemo(() => {
    const pick = [];
    ["Solari", "Umbri", "Terra", "Aether"].forEach((fac) => {
      let options = cards.filter((x) => x.faction === fac && (x.rarity === "Mythic" || x.rarity === "Rare"));
      if (options.length === 0) options = cards.filter((x) => x.faction === fac);
      
      if (options.length > 0) {
        const randomCard = options[Math.floor(Math.random() * options.length)];
        pick.push(randomCard);
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

      {/* ALPHA PRE-ORDER PROMO */}
      <section className="max-w-7xl mx-auto px-5 py-8 mt-4 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 via-blue-900/30 to-transparent rounded-3xl blur-md" />
        <div className="relative glass rounded-3xl p-8 md:p-12 border border-purple-500/30 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-xs font-bold uppercase tracking-wider text-purple-300 mb-4 border border-purple-500/30">
              <Sparkles className="w-3.5 h-3.5" /> Alpha Users Exclusive
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-black text-white leading-tight">
              First Edition: <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                The Awakening Booster Box
              </span>
            </h2>
            <p className="mt-4 text-white/70 max-w-xl text-lg font-head">
              Secure your physical collector's box. Strictly limited supply of <strong className="text-white">500 boxes</strong> worldwide. Limit 1 box per person.
            </p>
            <div className="mt-6 flex items-baseline gap-4">
              <span className="text-5xl font-black text-white drop-shadow-lg">$60</span>
              <span className="text-xl text-red-400/60 line-through">$80 MSRP</span>
              <span className="text-sm text-white/60 ml-2 uppercase tracking-wide">+ Shipping</span>
            </div>
          </div>
          <div className="w-full md:w-auto shrink-0 flex flex-col items-center">
            <button className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold rounded-xl shadow-[0_0_40px_rgba(168,85,247,0.4)] transition-all transform hover:scale-105 active:scale-95 text-lg whitespace-nowrap">
              Pre-order Now
            </button>
            <div className="mt-5 w-full bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner border border-slate-700">
              <div 
                className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-1000" 
                style={{ width: `${(stats.total_preorders / 500) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-purple-300 text-center uppercase tracking-widest font-bold">Only {500 - stats.total_preorders} Boxes Remaining</p>
          </div>
        </div>
      </section>


      {/* LORE SECTION */}
      <section className="max-w-5xl mx-auto px-5 pt-24 pb-12 text-center">
        <h2 className="font-display text-4xl md:text-6xl font-black mb-8 text-white drop-shadow-md">
          The World of GlimmerFall
        </h2>
        <div className="space-y-6 text-white/70 font-head text-lg md:text-xl leading-relaxed max-w-4xl mx-auto">
          <p>
            Before time was given shape, there was only the radiance of the Glimmer and the silence of the Fall. Between them stood the Nexus, a crystalline heart that bound matter, memory, and possibility into one living reality. For ages, its light held the Void at bay. Then the Nexus shattered, scattering its power across four wounded realms and awakening forces that had slept beneath the world.
          </p>
          <p>
            Now, powerful Summoners channel Resonance to call Entities from the fragments of creation and wield devastating Rites. Every battle is a struggle for control of the Nexus shards, and every victory reshapes the balance between Light and Void. Choose your faction, gather your strength, and enter a war where the fate of reality may rest on a single card.
          </p>
        </div>
      </section>

      {/* THE FOUR FACTIONS */}
      <section className="max-w-7xl mx-auto px-5 py-10 pb-20">
        <h2 className="font-display text-sm font-bold mb-10 text-center uppercase tracking-[0.3em] text-white/40">
          Choose Your Path
        </h2>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden group border border-[#F2A900]/20 hover:border-[#F2A900]/50 transition-colors">
            <div className="absolute right-0 top-0 w-64 h-64 bg-[#F2A900]/10 rounded-full blur-[80px] -mr-10 -mt-10 group-hover:bg-[#F2A900]/30 transition-all duration-700" />
            <h3 className="font-display text-3xl font-black text-[#F2A900] mb-4 drop-shadow-[0_0_10px_rgba(242,169,0,0.5)]">Solari, The Light</h3>
            <p className="text-white/70 font-head leading-relaxed text-lg relative z-10">
              The Solari believe that truth is the first law of creation. Their radiant citadels rise above fields of gold and crystal, guarded by angelic heralds and unbreakable Bastions. Solari forces protect what is fragile, restore what is wounded, and gather celestial power until their greatest Entities descend in overwhelming brilliance. Choose Solari if you want to heal, defend, and outlast your opponent before ending the battle beneath the weight of divine radiance.
            </p>
          </div>

          <div className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden group border border-[#9932CC]/20 hover:border-[#9932CC]/50 transition-colors">
            <div className="absolute right-0 top-0 w-64 h-64 bg-[#9932CC]/10 rounded-full blur-[80px] -mr-10 -mt-10 group-hover:bg-[#9932CC]/30 transition-all duration-700" />
            <h3 className="font-display text-3xl font-black text-[#9932CC] mb-4 drop-shadow-[0_0_10px_rgba(153,50,204,0.5)]">Umbri, The Shadow</h3>
            <p className="text-white/70 font-head leading-relaxed text-lg relative z-10">
              The Umbri walk where light cannot reach, carrying secrets that were never meant to be remembered. Their assassins move through smoke, fractured dreams, and the edges of the Void, striking before their enemies can react. Umbri decks disrupt plans, drain life, exploit Stealth, and sacrifice their own forces to unlock forbidden power. Choose Umbri if you prefer deception, precision, and victory earned from the shadows.
            </p>
          </div>

          <div className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden group border border-[#22E07B]/20 hover:border-[#22E07B]/50 transition-colors">
            <div className="absolute right-0 top-0 w-64 h-64 bg-[#22E07B]/10 rounded-full blur-[80px] -mr-10 -mt-10 group-hover:bg-[#22E07B]/30 transition-all duration-700" />
            <h3 className="font-display text-3xl font-black text-[#22E07B] mb-4 drop-shadow-[0_0_10px_rgba(34,224,123,0.5)]">Terra, The Earth</h3>
            <p className="text-white/70 font-head leading-relaxed text-lg relative z-10">
              Terra is the oldest living force in GlimmerFall: root, stone, storm, and blood. Its primal beasts roam beside colossal elementals, while ancient guardians endure wounds that would destroy lesser Entities. Terra Summoners accelerate their resources, build an imposing board, and turn patience into unstoppable strength. Choose Terra if you want to grow beyond your opponent’s reach, command massive Entities, and win through resilience and brute force.
            </p>
          </div>

          <div className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden group border border-[#00BFFF]/20 hover:border-[#00BFFF]/50 transition-colors">
            <div className="absolute right-0 top-0 w-64 h-64 bg-[#00BFFF]/10 rounded-full blur-[80px] -mr-10 -mt-10 group-hover:bg-[#00BFFF]/30 transition-all duration-700" />
            <h3 className="font-display text-3xl font-black text-[#00BFFF] mb-4 drop-shadow-[0_0_10px_rgba(0,191,255,0.5)]">Aether, The Magic</h3>
            <p className="text-white/70 font-head leading-relaxed text-lg relative z-10">
              Aether belongs to those who refuse to accept that reality has fixed boundaries. Within their storm-lit towers, wizards and starforged scholars bend distance, time, and probability through disciplined Resonance. Aether decks master Rites, draw additional cards, manipulate the flow of battle, and assemble unpredictable combinations that can transform a losing position into sudden victory. Choose Aether if you enjoy clever sequencing, strategic flexibility, and the thrill of discovering what the next Rite can make possible.
            </p>
          </div>
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
