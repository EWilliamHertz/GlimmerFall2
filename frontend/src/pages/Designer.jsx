import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  FileJson,
  Printer,
  ExternalLink,
  Copy,
  Check,
  LayoutGrid,
  Table as TableIcon,
  Layers,
  Sparkles,
  BookOpen,
  Image as ImageIcon,
  Sword,
  Heart,
  Zap,
  X,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  FACTIONS,
  RARITY,
  RARITY_ICONS,
  CARD_TYPES,
  KEYWORDS,
  FALLBACK_CARDBACK,
  LOGO_FULL,
  factionCfg,
} from "@/lib/factions";

const FACTION_DETAILS = {
  Solari: {
    subtitle: "Light · Aggro & Radiance",
    palette: "Ivory, Sun-Gold (#F2A900), Ember-Orange",
    summary:
      "Angelic heralds, solar knights, and unyielding Guard bastions from the High Heavens. Solari decks create early combat pressure, heal the Nexus, protect allies with Shield/Guard, and close games with towering celestial Entities.",
  },
  Umbri: {
    subtitle: "Void · Control & Shadow",
    palette: "Obsidian, Void Violet (#9B30FF), Abyssal Indigo",
    summary:
      "Assassins, spectres, and forbidden Void scholars from the deepest chasms. Umbri decks disrupt enemy hands, drain life, strike from Stealth with Lethal precision, and sacrifice followers to recur threats from the Void.",
  },
  Terra: {
    subtitle: "Earth · Growth & Protection",
    palette: "Emerald (#22E07B), Moss Green, Ancient Stone",
    summary:
      "Primeval beasts, treants, and colossal elementals linked by the subterranean Mycelial Network. Terra decks accelerate Resonance Nodes, fortify with high-Health Guard defenders, and overwhelm opponents with massive late-game stats.",
  },
  Aether: {
    subtitle: "Magic · Spells & Tempo",
    palette: "Cobalt Blue, Electric Cyan (#00BFFF), Arcane Magenta",
    summary:
      "Starforged wizards, astral constructs, and time-bending drakes. Aether decks manipulate tempo, chain Echo Rites and Flashes, draw cards rapidly, and outmaneuver opponents with tactical spell sequencing.",
  },
};

const CARD_TYPE_SPECS = [
  {
    type: "Entity",
    desc: "Creatures deployed onto the battlefield that attack enemy Entities or the Nexus. Displays Power & Health.",
    fields: "Cost, Name, Faction, Type, Keywords, Rules Text, Power / Health, Rarity, AWK #, Lore",
  },
  {
    type: "Rite",
    desc: "Slow spells cast anytime during your own turn to alter board state, deal damage, or draw cards.",
    fields: "Cost, Name, Faction, Type, Keywords, Rules Text, Rarity, AWK #, Lore",
  },
  {
    type: "Flash",
    desc: "Fast spells playable during either player's turn to respond, buff, or disrupt combat.",
    fields: "Cost, Name, Faction, Type, Keywords, Rules Text, Rarity, AWK #, Lore",
  },
  {
    type: "Relic",
    desc: "Artifacts that stay on the battlefield or attach to Entities to grant ongoing passive effects.",
    fields: "Cost, Name, Faction, Type, Keywords, Rules Text, Rarity, AWK #, Lore",
  },
];

const ALL_KEYWORDS = {
  ...KEYWORDS,
  Charge: "Can attack immediately upon deployment.",
  Shield: "Absorbs incoming damage / protects the Entity.",
  Spellshield: "Negates the next enemy spell or ability targeting this Entity.",
  Lifesteal: "Damage dealt by this Entity restores Health to your Nexus.",
  Piercing: "Deals bonus / penetrating combat damage to defenders.",
};

const parseKeywords = (raw) => {
  if (!raw || raw === "None") return [];
  return String(raw)
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && k !== "None");
};

const formatCollector = (num) => `#${String(num ?? 0).padStart(3, "0")}`;

const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

export default function Designer() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [factionFilter, setFactionFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [rarityFilter, setRarityFilter] = useState("All");
  const [viewMode, setViewMode] = useState("detailed"); // detailed | table
  const [artMode, setArtMode] = useState("raw"); // raw | framed
  const [cardArtOverrides, setCardArtOverrides] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);
  const [lightboxCard, setLightboxCard] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.get("/designer/cards");
        if (!active) return;
        const sorted = [...res.data].sort(
          (a, b) => (Number(a.collector_number) || 999999) - (Number(b.collector_number) || 999999)
        );
        setCards(sorted);
      } catch (err) {
        // Fallback to /cards if /designer/cards is unavailable
        try {
          const fallback = await api.get("/cards");
          if (!active) return;
          const sorted = [...fallback.data]
            .map((c) => ({ ...c, raw_image_url: c.image_url, framed_image_url: null }))
            .sort(
              (a, b) => (Number(a.collector_number) || 999999) - (Number(b.collector_number) || 999999)
            );
          setCards(sorted);
        } catch (innerErr) {
          console.error(innerErr);
          toast.error("Failed to load GlimmerFall card database.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const byFaction = {};
    const byType = {};
    const byRarity = {};
    let framedCount = 0;
    cards.forEach((c) => {
      byFaction[c.faction] = (byFaction[c.faction] || 0) + 1;
      byType[c.card_type] = (byType[c.card_type] || 0) + 1;
      byRarity[c.rarity] = (byRarity[c.rarity] || 0) + 1;
      if (c.framed_image_url) framedCount += 1;
    });
    return { total: cards.length, byFaction, byType, byRarity, framedCount };
  }, [cards]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (factionFilter !== "All" && c.faction !== factionFilter) return false;
      if (typeFilter !== "All" && c.card_type !== typeFilter) return false;
      if (rarityFilter !== "All" && c.rarity !== rarityFilter) return false;
      if (!q) return true;
      const cn = String(c.collector_number || "");
      const cnPadded = formatCollector(c.collector_number).toLowerCase();
      return (
        (c.name || "").toLowerCase().includes(q) ||
        cn.includes(q) ||
        cnPadded.includes(q) ||
        (c.set_code || "awk").toLowerCase().includes(q) ||
        (c.set_name || "the awakening").toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.lore || "").toLowerCase().includes(q) ||
        (c.keywords || "").toLowerCase().includes(q)
      );
    });
  }, [cards, search, factionFilter, typeFilter, rarityFilter]);

  const hasActiveFilters = Boolean(
    search.trim() || factionFilter !== "All" || typeFilter !== "All" || rarityFilter !== "All"
  );

  const resetFilters = () => {
    setSearch("");
    setFactionFilter("All");
    setTypeFilter("All");
    setRarityFilter("All");
  };

  const resolveCardArt = (card) => {
    const mode = cardArtOverrides[card.id] || artMode;
    if (mode === "framed" && card.framed_image_url) {
      return { url: card.framed_image_url, kind: "framed" };
    }
    return { url: card.raw_image_url || card.image_url, kind: "raw" };
  };

  const toggleSingleCardArt = (cardId) => {
    setCardArtOverrides((prev) => {
      const cur = prev[cardId] || artMode;
      return { ...prev, [cardId]: cur === "raw" ? "framed" : "raw" };
    });
  };

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied URL to clipboard");
      setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const downloadFile = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = [
      "Collector Number",
      "Expansion Code",
      "Expansion Title",
      "Name",
      "Faction",
      "Card Type",
      "Rarity",
      "Cost",
      "Power",
      "Health",
      "Keywords",
      "Detailed Game Text",
      "Lore Text",
      "Vercel Blob High-Res Image URL",
      "Existing Framed Prototype URL",
      "Database ID",
    ];
    const rows = filtered.map((c) => [
      c.collector_number ?? "",
      c.set_code || "AWK",
      escapeCsv(c.set_name || "The Awakening"),
      escapeCsv(c.name),
      escapeCsv(c.faction),
      escapeCsv(c.card_type),
      escapeCsv(c.rarity),
      c.cost ?? "",
      c.power ?? "",
      c.health ?? "",
      escapeCsv(parseKeywords(c.keywords).join(", ")),
      escapeCsv(c.description || ""),
      escapeCsv(c.lore || ""),
      escapeCsv(c.raw_image_url || c.image_url || ""),
      escapeCsv(c.framed_image_url || ""),
      escapeCsv(c.id),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadFile(csv, "glimmerfall_awk_designer_spec.csv", "text/csv;charset=utf-8;");
    toast.success(`Exported ${filtered.length} cards to CSV`);
  };

  const exportJSON = () => {
    const payload = {
      game: "GlimmerFall TCG",
      expansion_title: "The Awakening",
      expansion_code: "AWK",
      total_cards: filtered.length,
      card_dimensions_mm: { trim: "63x88", with_bleed: "69x94", bleed_mm: 3, dpi: 300 },
      cards: filtered.map((c) => ({
        collector_number: c.collector_number,
        collector_label: `${c.set_code || "AWK"} ${formatCollector(c.collector_number)}`,
        set_code: c.set_code || "AWK",
        set_name: c.set_name || "The Awakening",
        name: c.name,
        faction: c.faction,
        card_type: c.card_type,
        rarity: c.rarity,
        cost: c.cost,
        power: c.power,
        health: c.health,
        keywords: parseKeywords(c.keywords),
        description: c.description || "",
        lore: c.lore || "",
        vercel_blob_high_res_url: c.raw_image_url || c.image_url || "",
        existing_framed_prototype_url: c.framed_image_url || null,
        id: c.id,
      })),
    };
    downloadFile(JSON.stringify(payload, null, 2), "glimmerfall_awk_designer_spec.json", "application/json");
    toast.success(`Exported ${filtered.length} cards to JSON`);
  };

  return (
    <div data-testid="designer-page" className="designer-page max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-12">
      <style>{`
        @media print {
          .designer-page { color: #111827 !important; max-width: 100% !important; padding: 0 !important; }
          .designer-page .glass, .designer-page .glass-strong {
            background: #f9fafb !important;
            border: 1px solid #d1d5db !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
          }
          .designer-page h1, .designer-page h2, .designer-page h3, .designer-page h4, .designer-page strong {
            color: #111827 !important;
          }
          .designer-page p, .designer-page li, .designer-page td, .designer-page th, .designer-page div {
            color: #1f2937 !important;
          }
          .designer-page article { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      {/* 1. HERO & PERSONAL GREETING */}
      <section className="glass rounded-3xl p-7 sm:p-10 md:p-12 border border-[#F2A900]/25 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-[#F2A900]/10 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-96 h-96 bg-[#00BFFF]/10 rounded-full blur-[110px] pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F2A900]/15 border border-[#F2A900]/35 text-[#F2A900] text-xs font-head font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Designer Quote &amp; Asset Brief · Expansion 1 (AWK)
          </div>

          <div className="space-y-2">
            <h1
              data-testid="designer-greeting"
              className="font-display text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight"
            >
              Ni hao, Wo ming Jiao William. Ni jiao shen mu ming zu?
            </h1>
            <p className="text-[#F2A900]/90 font-head text-base sm:text-lg">
              你好，我名叫 William。你叫什么名字？
            </p>
          </div>

          <p className="text-white/75 font-head text-base sm:text-lg leading-relaxed max-w-4xl">
            Thank you for taking a look at <strong className="text-white">GlimmerFall TCG</strong>. Below is a short
            introduction to how the game works, our four factions, our shared branding assets, and the complete{" "}
            <strong className="text-white">322-card catalog for Expansion 1: The Awakening (AWK)</strong> in strict
            collector number order (<span className="font-num text-[#F2A900]">#001 – #322</span>), each with its
            high-resolution artwork from Vercel Blob and full database fields so you can give us an accurate cost
            estimate.
          </p>

          {/* Quick stats + actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
              <div className="font-num text-3xl font-bold text-[#F2A900]">{stats.total || 322}</div>
              <div className="text-xs font-head text-white/50 uppercase tracking-wider mt-0.5">Total Cards (AWK)</div>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
              <div className="font-num text-3xl font-bold text-[#00BFFF]">4</div>
              <div className="text-xs font-head text-white/50 uppercase tracking-wider mt-0.5">Factions</div>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
              <div className="font-num text-3xl font-bold text-[#22E07B]">63×88 mm</div>
              <div className="text-xs font-head text-white/50 uppercase tracking-wider mt-0.5">
                Trim (+3 mm Bleed)
              </div>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
              <div className="font-num text-3xl font-bold text-[#C77DFF]">{stats.framedCount || 52} / 322</div>
              <div className="text-xs font-head text-white/50 uppercase tracking-wider mt-0.5">
                Existing Frame Refs
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 print:hidden">
            <a
              href="#game-overview"
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-head text-white transition-colors"
            >
              1. Game Overview
            </a>
            <a
              href="#factions-overview"
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-head text-white transition-colors"
            >
              2. The 4 Factions
            </a>
            <a
              href="#card-database"
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-head text-white transition-colors"
            >
              3. All {stats.total || 322} Cards
            </a>
            <span className="hidden sm:inline-block w-px h-6 bg-white/15 mx-1" />
            <button
              onClick={exportCSV}
              data-testid="designer-export-csv"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F2A900] text-black font-head font-bold text-sm hover:bg-[#ffc21f] transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV ({filtered.length})
            </button>
            <button
              onClick={exportJSON}
              data-testid="designer-export-json"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00BFFF]/20 text-[#7FDBFF] border border-[#00BFFF]/40 font-head font-semibold text-sm hover:bg-[#00BFFF]/30 transition-colors"
            >
              <FileJson className="w-4 h-4" /> Export JSON
            </button>
            <button
              onClick={() => window.print()}
              data-testid="designer-print"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-white/20 text-white/80 font-head font-semibold text-sm hover:text-white transition-colors"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
          </div>
        </div>
      </section>

      {/* 2. INFORMATION ABOUT THE GAME (SHORT VERSION) */}
      <section id="game-overview" className="space-y-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-[#00BFFF]" />
          <div>
            <h2 className="font-display text-3xl font-bold text-white">About GlimmerFall TCG (Short Version)</h2>
            <p className="text-white/50 font-head text-sm">
              Core rules, card layout requirements, and production specifications for your cost estimate.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Core Loop */}
          <div className="glass rounded-2xl p-6 sm:p-7 space-y-4">
            <h3 className="font-display text-xl font-bold text-[#F2A900]">How the Game Works</h3>
            <p className="text-white/80 font-head text-sm leading-relaxed">
              <strong className="text-white">GlimmerFall</strong> is a fantasy / aether-punk Trading Card Game set in a
              world fractured between <strong className="text-[#F2A900]">Light (The Glimmer)</strong> and{" "}
              <strong className="text-[#C77DFF]">Shadow (The Fall)</strong>. Players build{" "}
              <strong className="text-white">40-card single-faction decks</strong> (max 3 copies per card) and battle to
              reduce their opponent's <strong className="text-white">Nexus</strong> HP to 0.
            </p>
            <ul className="space-y-2 text-sm font-head text-white/75 list-disc pl-5 leading-relaxed">
              <li>
                <strong className="text-white">No Dedicated Mana Cards:</strong> Once per turn, <em>any</em> card from
                your hand can be played face-down into the <strong>Resonance Zone</strong> as a{" "}
                <strong>Resonance Node</strong>, permanently increasing your maximum Energy by +1 (up to 12).
              </li>
              <li>
                <strong className="text-white">Turn Structure:</strong> Energy refills at the start of your turn. Draw 1
                card, optionally play 1 Resonance Node, then spend Energy in any order to deploy Entities, cast spells
                (Rites &amp; Flashes), place Relics, and attack.
              </li>
              <li>
                <strong className="text-white">Expansion 1 — The Awakening (AWK):</strong> All{" "}
                <strong className="text-white">{stats.total || 322} cards</strong> belong to our First Edition set{" "}
                <span className="font-mono text-[#00BFFF]">AWK</span> (Collector #001 – #322).
              </li>
            </ul>
          </div>

          {/* Scope for Cost Estimate */}
          <div className="glass rounded-2xl p-6 sm:p-7 space-y-4">
            <h3 className="font-display text-xl font-bold text-[#00BFFF]">What We Need Designed (Scope)</h3>
            <ul className="space-y-2.5 text-sm font-head text-white/75 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#F2A900] mt-2 shrink-0" />
                <span>
                  <strong className="text-white">Artwork Already Complete:</strong> All{" "}
                  <strong>{stats.total || 322} illustrations</strong> are already finished and stored in high
                  resolution on Vercel Blob (<span className="font-mono text-xs">1920×1920</span>,{" "}
                  <span className="font-mono text-xs">1024×1024</span>, or{" "}
                  <span className="font-mono text-xs">768×1024</span> WebP).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00BFFF] mt-2 shrink-0" />
                <span>
                  <strong className="text-white">Card Frame &amp; Layout Production:</strong> Every card needs a
                  faction-themed card frame, Energy cost badge, Card Name, Faction &amp; Card Type bar, Rarity icon,
                  Keywords &amp; Game Text box, Lore text (when present), Power/Health badge (Entities only), and
                  Expansion + Collector Number (<span className="font-mono text-xs">AWK #001</span>).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#22E07B] mt-2 shrink-0" />
                <span>
                  <strong className="text-white">Print Specification:</strong> Standard TCG size{" "}
                  <strong>63 × 88 mm</strong> trim (<strong>69 × 94 mm</strong> with 3 mm bleed), 300 DPI CMYK/print-ready
                  PDF &amp; web WebP exports.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#9B30FF] mt-2 shrink-0" />
                <span>
                  <strong className="text-white">Existing Prototypes:</strong> {stats.framedCount || 52} cards already
                  have a framed prototype (you can switch between <em>High-Res Raw Art</em> and{" "}
                  <em>Existing Frame Prototype</em> in the catalog below to inspect the style).
                </span>
              </li>
            </ul>
            <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2 text-xs font-head">
              {Object.entries(RARITY).slice(0, 4).map(([rarName, cfg]) => (
                <span
                  key={rarName}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 border border-white/10"
                >
                  <img src={RARITY_ICONS[rarName]} alt={rarName} className="w-3.5 h-3.5" />
                  <span style={{ color: cfg.color }} className="font-semibold">
                    {rarName}:
                  </span>
                  <span className="font-num text-white">{stats.byRarity[rarName] || 0}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Card Types */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARD_TYPE_SPECS.map((ct) => (
            <div key={ct.type} className="glass rounded-2xl p-5 flex flex-col justify-between border border-white/10">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-display text-lg font-bold text-[#00BFFF]">{ct.type}</h4>
                  <span className="font-num text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-white/80">
                    {stats.byType[ct.type] || 0} cards
                  </span>
                </div>
                <p className="text-white/70 font-head text-xs leading-relaxed mb-3">{ct.desc}</p>
              </div>
              <div className="pt-2.5 border-t border-white/10 text-[11px] font-head text-white/45">
                <span className="text-white/70 font-semibold">Card Elements:</span> {ct.fields}
              </div>
            </div>
          ))}
        </div>

        {/* Keywords */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <h3 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#F2A900]" /> Keyword Glossary (Badges / Callouts in Card Text)
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(ALL_KEYWORDS).map(([kw, desc]) => (
              <div key={kw} className="bg-black/35 border border-white/10 rounded-xl p-3">
                <span className="inline-block text-xs font-head font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F2A900]/15 text-[#F2A900] mb-1">
                  {kw}
                </span>
                <p className="text-xs font-head text-white/65 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. ABOUT THE FACTIONS */}
      <section id="factions-overview" className="space-y-6">
        <div className="flex items-center gap-3">
          <Layers className="w-7 h-7 text-[#F2A900]" />
          <div>
            <h2 className="font-display text-3xl font-bold text-white">About the Four Factions</h2>
            <p className="text-white/50 font-head text-sm">
              Each card belongs to one of four factions, driving its frame palette, emblem, and gameplay identity.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {Object.values(FACTIONS).map((fac) => {
            const info = FACTION_DETAILS[fac.name];
            return (
              <div
                key={fac.name}
                className="glass rounded-3xl p-6 sm:p-7 relative overflow-hidden border transition-colors"
                style={{ borderColor: `${fac.color}44` }}
              >
                <div
                  className="absolute -right-12 -top-12 w-48 h-48 rounded-full blur-[70px] opacity-20 pointer-events-none"
                  style={{ background: fac.color }}
                />
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center shrink-0 p-2"
                    style={{ boxShadow: `0 0 24px ${fac.glow}` }}
                  >
                    <img src={fac.frames.symbol} alt={fac.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <h3 className="font-display text-2xl font-bold" style={{ color: fac.color }}>
                        {fac.name}
                      </h3>
                      <span className="font-num text-xs font-bold px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-white/80">
                        {stats.byFaction[fac.name] || 0} cards · {fac.color}
                      </span>
                    </div>
                    <div className="text-xs font-head font-semibold uppercase tracking-wider text-white/60 mb-2">
                      {info.subtitle}
                    </div>
                    <p className="text-sm font-head text-white/75 leading-relaxed mb-3">{info.summary}</p>
                    <div className="text-xs font-head text-white/50">
                      <strong className="text-white/70">Visual Palette:</strong> {info.palette}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shared Core Branding & Vercel Blob Static Assets */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <h3 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#00BFFF]" /> Shared Branding, Card Back &amp; Rarity Assets
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {[
              { label: "GlimmerFall Logo", url: LOGO_FULL, note: "PNG Logo" },
              { label: "Card Back (High-Res)", url: FALLBACK_CARDBACK, note: "Vercel Blob PNG" },
              { label: "Common Rarity", url: RARITY_ICONS.Common, note: "Vercel Blob SVG" },
              { label: "Uncommon Rarity", url: RARITY_ICONS.Uncommon, note: "Vercel Blob SVG" },
              { label: "Rare Rarity", url: RARITY_ICONS.Rare, note: "Vercel Blob SVG" },
              { label: "Epic Rarity", url: RARITY_ICONS.Epic, note: "Vercel Blob SVG" },
            ].map((asset) => (
              <a
                key={asset.label}
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="bg-black/45 hover:bg-white/5 border border-white/10 hover:border-[#F2A900]/50 rounded-xl p-3.5 flex flex-col items-center text-center transition-all group"
              >
                <div className="h-16 w-full flex items-center justify-center mb-2">
                  <img src={asset.url} alt={asset.label} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="text-xs font-head font-semibold text-white group-hover:text-[#F2A900] transition-colors">
                  {asset.label}
                </div>
                <div className="text-[10px] font-head text-white/40 mt-0.5 flex items-center gap-1">
                  {asset.note} <ExternalLink className="w-2.5 h-2.5" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 4. ALL CARDS IN COLLECTOR NUMBER ORDER */}
      <section id="card-database" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-white">
              Complete Card Database ({filtered.length} / {stats.total || 322})
            </h2>
            <p className="text-white/50 font-head text-sm mt-1">
              Strictly ordered by collector number (<span className="font-num text-[#F2A900]">#001 – #322</span>) ·
              Expansion: <strong className="text-white/80">The Awakening (AWK)</strong> · High-quality artwork hosted on
              Vercel Blob.
            </p>
          </div>
        </div>

        {/* Sticky Controls Toolbar */}
        <div className="glass-strong rounded-2xl p-4 sm:p-5 space-y-4 sticky top-14 z-30 border border-white/10 shadow-2xl shadow-black/60 print:hidden">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                data-testid="designer-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by # number, card name, game text, keyword, or lore..."
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-head text-white outline-none focus:border-[#F2A900]/60 transition-colors"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {/* Art Mode Switcher */}
              <div className="flex items-center bg-black/50 border border-white/10 rounded-xl p-1 text-xs font-head">
                <button
                  onClick={() => {
                    setArtMode("raw");
                    setCardArtOverrides({});
                  }}
                  data-testid="art-mode-raw"
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    artMode === "raw" ? "bg-[#00BFFF] text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  High-Res Raw Art
                </button>
                <button
                  onClick={() => {
                    setArtMode("framed");
                    setCardArtOverrides({});
                  }}
                  data-testid="art-mode-framed"
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    artMode === "framed" ? "bg-[#F2A900] text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  Frame Refs ({stats.framedCount})
                </button>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center bg-black/50 border border-white/10 rounded-xl p-1 text-xs font-head">
                <button
                  onClick={() => setViewMode("detailed")}
                  data-testid="view-mode-detailed"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    viewMode === "detailed" ? "bg-white text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Detailed
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  data-testid="view-mode-table"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    viewMode === "table" ? "bg-white text-black" : "text-white/60 hover:text-white"
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" /> Table
                </button>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-head">
            <button
              onClick={() => setFactionFilter("All")}
              className={`px-3 py-1 rounded-full border transition-colors ${
                factionFilter === "All"
                  ? "bg-white text-black font-bold border-white"
                  : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              All Factions
            </button>
            {Object.values(FACTIONS).map((f) => (
              <button
                key={f.name}
                onClick={() => setFactionFilter(factionFilter === f.name ? "All" : f.name)}
                className={`px-3 py-1 rounded-full border transition-colors ${
                  factionFilter === f.name
                    ? "text-black font-bold"
                    : "border-white/15 text-white/60 hover:text-white"
                }`}
                style={factionFilter === f.name ? { background: f.color, borderColor: f.color } : {}}
              >
                {f.name}
              </button>
            ))}

            <span className="w-px h-4 bg-white/15 mx-1" />

            <button
              onClick={() => setTypeFilter("All")}
              className={`px-3 py-1 rounded-full border transition-colors ${
                typeFilter === "All"
                  ? "bg-[#00BFFF] text-black font-bold border-[#00BFFF]"
                  : "border-white/15 text-white/60 hover:text-white"
              }`}
            >
              All Types
            </button>
            {CARD_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? "All" : t)}
                className={`px-3 py-1 rounded-full border transition-colors ${
                  typeFilter === t
                    ? "bg-[#00BFFF] text-black font-bold border-[#00BFFF]"
                    : "border-white/15 text-white/60 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}

            <span className="w-px h-4 bg-white/15 mx-1" />

            {["All", "Common", "Uncommon", "Rare", "Epic"].map((r) => {
              const rCfg = RARITY[r];
              const isActive = rarityFilter === r;
              return (
                <button
                  key={r}
                  onClick={() => setRarityFilter(isActive && r !== "All" ? "All" : r)}
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    isActive
                      ? "text-black font-bold"
                      : "border-white/15 text-white/60 hover:text-white"
                  }`}
                  style={
                    isActive
                      ? { background: rCfg ? rCfg.color : "#F2A900", borderColor: rCfg ? rCfg.color : "#F2A900" }
                      : {}
                  }
                >
                  {r === "All" ? "All Rarities" : r}
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                data-testid="designer-reset-filters"
                className="ml-auto px-3 py-1 rounded-full border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Loading / Empty */}
        {loading ? (
          <div className="glass rounded-2xl p-16 text-center text-white/50 font-head animate-pulse">
            Loading all 322 GlimmerFall cards and Vercel Blob artwork...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center text-white/40 font-head">
            No cards matched your search or filters.
          </div>
        ) : viewMode === "detailed" ? (
          <div className="space-y-4" data-testid="designer-card-list">
            {filtered.map((card) => {
              const fac = factionCfg(card.faction);
              const rar = RARITY[card.rarity] || RARITY.Common;
              const kws = parseKeywords(card.keywords);
              const art = resolveCardArt(card);
              const setCode = card.set_code || "AWK";
              const setName = card.set_name || "The Awakening";
              const isEntity = card.card_type === "Entity";
              const hasDesc = Boolean(card.description && card.description.trim() && card.description.trim() !== "None");
              const hasLore = Boolean(card.lore && card.lore.trim() && card.lore.trim() !== "None");

              return (
                <article
                  key={card.id}
                  data-testid={`designer-card-${card.collector_number}`}
                  className="glass rounded-2xl p-4 sm:p-6 border border-white/10 hover:border-white/25 transition-colors grid md:grid-cols-[240px_1fr] gap-6 items-start"
                >
                  {/* Left: High-Quality Vercel Blob Picture */}
                  <div className="space-y-2.5">
                    <div
                      onClick={() => setLightboxCard(card)}
                      className="relative aspect-[3/4] w-full max-w-[260px] mx-auto bg-black/70 rounded-xl overflow-hidden border cursor-zoom-in group"
                      style={{ borderColor: `${fac.color}55` }}
                    >
                      {art.url ? (
                        <img
                          src={art.url}
                          alt={`${card.name} (${setCode} ${formatCollector(card.collector_number)})`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/25">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-white/15 font-num text-xs font-bold text-[#F2A900]">
                        {setCode} {formatCollector(card.collector_number)}
                      </div>
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 border border-white/15 text-[10px] font-head text-white/80">
                        {art.kind === "framed" ? "Frame Ref" : "High-Res Raw"}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 print:hidden">
                      {art.url && (
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-head text-white/80 hover:text-[#00BFFF] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> Open Full-Res
                        </a>
                      )}
                      {art.url && (
                        <button
                          onClick={() => copyText(art.url, `url-${card.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-head text-white/80 transition-colors"
                        >
                          {copiedKey === `url-${card.id}` ? (
                            <Check className="w-3 h-3 text-[#22E07B]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copy Blob URL
                        </button>
                      )}
                      {card.framed_image_url && (
                        <button
                          onClick={() => toggleSingleCardArt(card.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F2A900]/15 hover:bg-[#F2A900]/25 border border-[#F2A900]/35 text-[11px] font-head text-[#F2A900] transition-colors"
                        >
                          {art.kind === "framed" ? "Show Raw Art" : "Show Frame Ref"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: Complete Database Information */}
                  <div className="space-y-4 min-w-0">
                    {/* Header row */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-num text-sm font-bold px-2.5 py-0.5 rounded-md bg-[#F2A900]/15 text-[#F2A900] border border-[#F2A900]/35">
                            Collector {formatCollector(card.collector_number)}
                          </span>
                          <span className="text-xs font-head font-semibold px-2.5 py-0.5 rounded-md bg-white/10 text-white/85">
                            Expansion: {setName} ({setCode})
                          </span>
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-head font-bold px-2.5 py-0.5 rounded-md text-black"
                            style={{ background: fac.color }}
                          >
                            {card.faction}
                          </span>
                          <span className="text-xs font-head px-2.5 py-0.5 rounded-md border border-white/15 text-white/80">
                            {card.card_type}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-xs font-head font-semibold px-2.5 py-0.5 rounded-md bg-black/50"
                            style={{ color: rar.color, border: `1px solid ${rar.color}66` }}
                          >
                            <img src={RARITY_ICONS[card.rarity] || RARITY_ICONS.Common} alt="" className="w-3 h-3" />
                            {card.rarity}
                          </span>
                        </div>
                        <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">{card.name}</h3>
                      </div>

                      {/* Stats pills */}
                      <div className="flex items-center gap-2">
                        <div className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-[#F2A900]" />
                          <div>
                            <div className="font-num text-lg font-bold leading-none text-white">{card.cost ?? 0}</div>
                            <div className="text-[10px] uppercase tracking-wider text-white/45 font-head">Cost</div>
                          </div>
                        </div>
                        {isEntity && card.power != null && (
                          <div className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 flex items-center gap-2">
                            <Sword className="w-4 h-4 text-[#FF5252]" />
                            <div>
                              <div className="font-num text-lg font-bold leading-none text-white">{card.power}</div>
                              <div className="text-[10px] uppercase tracking-wider text-white/45 font-head">Power</div>
                            </div>
                          </div>
                        )}
                        {isEntity && card.health != null && (
                          <div className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 flex items-center gap-2">
                            <Heart className="w-4 h-4 text-[#22E07B]" />
                            <div>
                              <div className="font-num text-lg font-bold leading-none text-white">{card.health}</div>
                              <div className="text-[10px] uppercase tracking-wider text-white/45 font-head">Health</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Keywords */}
                    {kws.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider font-head text-white/45 mr-1">
                          Keywords:
                        </span>
                        {kws.map((kw) => (
                          <span
                            key={kw}
                            className="px-2.5 py-0.5 rounded-md text-xs font-head font-bold uppercase tracking-wide"
                            style={{ background: `${fac.color}25`, color: fac.soft, border: `1px solid ${fac.color}55` }}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Detailed Game Text & Lore */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-black/35 border border-white/10 rounded-xl p-4">
                        <div className="text-[10px] uppercase tracking-widest font-head font-bold text-[#00BFFF] mb-1.5">
                          Detailed Game Text
                        </div>
                        <p className="text-sm font-head text-white/90 leading-relaxed whitespace-pre-wrap">
                          {hasDesc ? card.description : "— (No additional rules text beyond keywords/stats)"}
                        </p>
                      </div>

                      <div className="bg-black/35 border border-white/10 rounded-xl p-4">
                        <div className="text-[10px] uppercase tracking-widest font-head font-bold text-[#F2A900] mb-1.5">
                          Lore Text
                        </div>
                        <p
                          className={`text-sm font-head leading-relaxed ${
                            hasLore ? "italic text-white/75" : "text-white/35"
                          }`}
                        >
                          {hasLore ? `"${card.lore}"` : "— (No lore text assigned)"}
                        </p>
                      </div>
                    </div>

                    {/* Technical DB & Vercel Blob Metadata */}
                    <div className="bg-black/25 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-mono text-white/50 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          <strong className="text-white/70">DB ID:</strong> {card.id}
                        </span>
                        <span>
                          <strong className="text-white/70">Set:</strong> {setName} ({setCode})
                        </span>
                        <span>
                          <strong className="text-white/70">Collector #:</strong> {card.collector_number}
                        </span>
                      </div>
                      {art.url && (
                        <div className="truncate">
                          <strong className="text-white/70">Vercel Blob ({art.kind}):</strong>{" "}
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#00BFFF] hover:underline"
                          >
                            {art.url}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* COMPACT SPREADSHEET TABLE VIEW */
          <div className="glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="designer-card-table">
                <thead className="bg-black/70 border-b border-white/10 text-white/50 font-head uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">Art (Vercel Blob)</th>
                    <th className="p-3.5">Set / #</th>
                    <th className="p-3.5">Name</th>
                    <th className="p-3.5">Faction / Type / Rarity</th>
                    <th className="p-3.5">Stats</th>
                    <th className="p-3.5">Game Text &amp; Keywords</th>
                    <th className="p-3.5">Lore Text</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-head">
                  {filtered.map((card) => {
                    const fac = factionCfg(card.faction);
                    const rar = RARITY[card.rarity] || RARITY.Common;
                    const kws = parseKeywords(card.keywords);
                    const art = resolveCardArt(card);
                    const setCode = card.set_code || "AWK";
                    const setName = card.set_name || "The Awakening";

                    return (
                      <tr key={card.id} className="hover:bg-white/5 transition-colors align-top">
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setLightboxCard(card)}
                              className="w-14 h-16 bg-black/60 rounded-lg border border-white/10 hover:border-[#F2A900] overflow-hidden shrink-0"
                              title="Inspect full-res image"
                            >
                              {art.url ? (
                                <img
                                  src={art.url}
                                  alt={card.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 m-auto text-white/20" />
                              )}
                            </button>
                            {art.url && (
                              <a
                                href={art.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[#00BFFF] hover:underline flex items-center gap-1"
                              >
                                Blob <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap font-num">
                          <div className="font-bold text-[#F2A900]">{formatCollector(card.collector_number)}</div>
                          <div className="text-[11px] font-head text-white/50">
                            {setName} ({setCode})
                          </div>
                        </td>
                        <td className="p-3.5 font-display font-bold text-white min-w-[160px]">{card.name}</td>
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-bold text-xs" style={{ color: fac.color }}>
                            {card.faction}
                          </div>
                          <div className="text-xs text-white/75">{card.card_type}</div>
                          <div className="text-[11px]" style={{ color: rar.color }}>
                            {card.rarity}
                          </div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap font-num text-xs">
                          <span className="inline-block bg-[#F2A900]/20 text-[#F2A900] px-2 py-0.5 rounded mr-1">
                            {card.cost ?? 0}C
                          </span>
                          {card.card_type === "Entity" && card.power != null && (
                            <span className="inline-block bg-red-500/20 text-red-300 px-2 py-0.5 rounded mr-1">
                              {card.power}P
                            </span>
                          )}
                          {card.card_type === "Entity" && card.health != null && (
                            <span className="inline-block bg-green-500/20 text-green-300 px-2 py-0.5 rounded">
                              {card.health}H
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 min-w-[260px] max-w-sm">
                          {kws.length > 0 && (
                            <div className="text-[11px] font-bold uppercase tracking-wide text-[#C77DFF] mb-1">
                              {kws.join(" · ")}
                            </div>
                          )}
                          <div className="text-xs text-white/90 leading-relaxed">
                            {card.description || <span className="text-white/35">—</span>}
                          </div>
                        </td>
                        <td className="p-3.5 min-w-[220px] max-w-xs">
                          <div className="text-xs italic text-white/55 leading-relaxed">
                            {card.lore ? `"${card.lore}"` : <span className="not-italic text-white/30">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* FULL-RES LIGHTBOX MODAL */}
      {lightboxCard && (
        <div
          onClick={() => setLightboxCard(null)}
          data-testid="designer-lightbox"
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 border border-white/15 grid md:grid-cols-[1fr_1fr] gap-6 relative"
          >
            <button
              onClick={() => setLightboxCard(null)}
              className="absolute right-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="bg-black/70 rounded-2xl p-3 flex flex-col items-center justify-center border border-white/10">
              <img
                src={resolveCardArt(lightboxCard).url}
                alt={lightboxCard.name}
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                <a
                  href={resolveCardArt(lightboxCard).url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00BFFF] text-black font-head font-bold text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Original File
                </a>
                {lightboxCard.framed_image_url && (
                  <button
                    onClick={() => toggleSingleCardArt(lightboxCard.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F2A900]/20 text-[#F2A900] border border-[#F2A900]/40 font-head font-bold text-xs"
                  >
                    {resolveCardArt(lightboxCard).kind === "framed"
                      ? "Switch to High-Res Raw Art"
                      : "Switch to Existing Frame Ref"}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4 py-2">
              <div>
                <div className="text-xs font-head text-[#F2A900] font-bold uppercase tracking-wider mb-1">
                  {lightboxCard.set_name || "The Awakening"} ({lightboxCard.set_code || "AWK"}) ·{" "}
                  {formatCollector(lightboxCard.collector_number)}
                </div>
                <h3 className="font-display text-3xl font-bold text-white">{lightboxCard.name}</h3>
                <p className="text-sm font-head text-white/60 mt-1">
                  {lightboxCard.faction} · {lightboxCard.card_type} · {lightboxCard.rarity}
                </p>
              </div>

              <div className="flex gap-3 font-num text-sm">
                <span className="px-3 py-1 rounded-lg bg-[#F2A900]/20 text-[#F2A900] font-bold">
                  Cost: {lightboxCard.cost ?? 0}
                </span>
                {lightboxCard.card_type === "Entity" && lightboxCard.power != null && (
                  <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 font-bold">
                    Power: {lightboxCard.power}
                  </span>
                )}
                {lightboxCard.card_type === "Entity" && lightboxCard.health != null && (
                  <span className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 font-bold">
                    Health: {lightboxCard.health}
                  </span>
                )}
              </div>

              {parseKeywords(lightboxCard.keywords).length > 0 && (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/45 font-head mb-1">Keywords</div>
                  <div className="flex flex-wrap gap-1.5">
                    {parseKeywords(lightboxCard.keywords).map((kw) => (
                      <span key={kw} className="px-2.5 py-0.5 rounded bg-white/10 text-white text-xs font-head font-bold">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#00BFFF] font-head font-bold mb-1">
                  Detailed Game Text
                </div>
                <p className="text-sm font-head text-white/90 leading-relaxed">
                  {lightboxCard.description || "—"}
                </p>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#F2A900] font-head font-bold mb-1">
                  Lore Text
                </div>
                <p className="text-sm font-head italic text-white/70 leading-relaxed">
                  {lightboxCard.lore ? `"${lightboxCard.lore}"` : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
