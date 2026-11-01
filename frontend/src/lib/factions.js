export const CARDBACK = "/frames/cardback.webp";
export const FALLBACK_CARDBACK =
  "https://wqnuijtdmorxprhl.public.blob.vercel-storage.com/glimmerfall/static/baked_cardback-8Bh4M95RMoY2TSNhQzGI5YH3XZOsb0.png";

export const LOGO = "/glimmerfall-logo-256.png";
export const LOGO_FULL = "/glimmerfall-logo.png";

export const FACTION_FRAMES = {
  Solari: {
    key: "solari",
    header: "/frames/solari_header.webp",
    footer: "/frames/solari_footer.webp",
    costOrb: "/frames/solari_cost_orb.webp",
    statPill: "/frames/solari_stat_pill.webp",
    symbol: "/solari_nobg.png",
  },
  Umbri: {
    key: "umbri",
    header: "/frames/umbri_header.webp",
    footer: "/frames/umbri_footer.webp",
    costOrb: "/frames/umbri_cost_orb.webp",
    statPill: "/frames/umbri_stat_pill.webp",
    symbol: "/umbri_nobg.png",
  },
  Terra: {
    key: "terra",
    header: "/frames/terra_header.webp",
    footer: "/frames/terra_footer.webp",
    costOrb: "/frames/terra_cost_orb.webp",
    statPill: "/frames/terra_stat_pill.webp",
    symbol: "/terra_nobg.png",
  },
  Aether: {
    key: "aether",
    header: "/frames/aether_header.webp",
    footer: "/frames/aether_footer.webp",
    costOrb: "/frames/aether_cost_orb.webp",
    statPill: "/frames/aether_stat_pill.webp",
    symbol: "/aether_nobg.png",
  },
};

export const DESIGNER_CARDS = new Set([
  "aether_sprite",
  "aetheric_blast",
  "ancient_canopy",
  "arcane_intellect",
  "astral_cartographer",
  "blackout_edict",
  "blinding_radiance",
  "borrowed_face",
  "bramble_stag",
  "chrono_shift",
  "deepstone_miner",
  "duskblade_fiend",
  "eclipse_ritual",
  "emberwing_courier",
  "fading_memory",
  "firstlight_scout",
  "forest_warden",
  "formula_of_sparks",
  "gaia_the_world-soul",
  "gilded_pegasus",
  "granite_behemoth",
  "grasping_shadows",
  "graveglass_oracle",
  "hollow_courtier",
  "mind_sculptor",
  "mirrorgate",
  "murkborn_informant",
  "mycelial_network",
  "nexus_weaver",
  "paradox_adept",
  "phasewing_drake",
  "prism_courier",
  "ravenous_echo",
  "reality_fracture",
  "renewal_spring",
  "shadow_cloak",
  "singularity_engine",
  "siphon_soul",
  "solar_flare",
  "solari_vanguard",
  "static_anomaly",
  "stormweaver",
  "the_infinite_loop",
  "the_nightfall_king",
  "umbral_assassin",
  "void_stalker",
  "voidling_swarm",
  "voltage_savant",
  "whispers_of_the_void",
  "zenith_inquisitor",
]);

export const getDesignerCardUrl = (cardName) => {
  if (!cardName) return null;
  const slug = String(cardName).toLowerCase().replace(/[',]/g, "").trim().replace(/\s+/g, "_");
  if (DESIGNER_CARDS.has(slug)) {
    return `/cards/designer/${slug}.webp`;
  }
  return null;
};

export const FACTIONS = {
  Solari: {
    name: "Solari",
    tag: "Light · Aggro",
    color: "#F2A900",
    soft: "#FFD700",
    glow: "rgba(242,169,0,0.55)",
    grad: "linear-gradient(135deg,#4A3500 0%,#F2A900 100%)",
    text: "text-[#F2A900]",
    bgSoft: "bg-[#F2A900]/12",
    border: "border-[#F2A900]/50",
    frames: FACTION_FRAMES.Solari,
  },
  Umbri: {
    name: "Umbri",
    tag: "Void · Control",
    color: "#9B30FF",
    soft: "#C77DFF",
    glow: "rgba(155,48,255,0.55)",
    grad: "linear-gradient(135deg,#1A0033 0%,#9B30FF 100%)",
    text: "text-[#C77DFF]",
    bgSoft: "bg-[#9B30FF]/12",
    border: "border-[#9B30FF]/50",
    frames: FACTION_FRAMES.Umbri,
  },
  Terra: {
    name: "Terra",
    tag: "Growth · Protection",
    color: "#22E07B",
    soft: "#6BFFB0",
    glow: "rgba(34,224,123,0.5)",
    grad: "linear-gradient(135deg,#012A16 0%,#22E07B 100%)",
    text: "text-[#39E58C]",
    bgSoft: "bg-[#22E07B]/12",
    border: "border-[#22E07B]/50",
    frames: FACTION_FRAMES.Terra,
  },
  Aether: {
    name: "Aether",
    tag: "Spells · Tempo",
    color: "#00BFFF",
    soft: "#7FDBFF",
    glow: "rgba(0,191,255,0.55)",
    grad: "linear-gradient(135deg,#001133 0%,#00BFFF 100%)",
    text: "text-[#38CCff]",
    bgSoft: "bg-[#00BFFF]/12",
    border: "border-[#00BFFF]/50",
    frames: FACTION_FRAMES.Aether,
  },
};

export const RARITY = {
  Common: { color: "#B0BEC5", glow: "0 0 8px rgba(176,190,197,0.4)" },
  Uncommon: { color: "#2196F3", glow: "0 0 12px rgba(33,150,243,0.55)" },
  Rare: { color: "#FFD700", glow: "0 0 16px rgba(255,215,0,0.7)" },
  Epic: { color: "#9B30FF", glow: "0 0 22px rgba(155,48,255,0.9)" },
  "Founders Foil": { color: "#E040FB", glow: "0 0 26px rgba(224,64,251,0.85)" },
};

export const RARITY_ICONS = {
  Common: "https://wqnuijtdmorxprhl.public.blob.vercel-storage.com/glimmerfall/static/rarity_common-tuHj85Rai6aSc8qW2RyEqhNeTxXptX.svg",
  Uncommon: "https://wqnuijtdmorxprhl.public.blob.vercel-storage.com/glimmerfall/static/rarity_uncommon-g7mzZv9t48OCGMfoDjfNqwFn1BGpxt.svg",
  Rare: "https://wqnuijtdmorxprhl.public.blob.vercel-storage.com/glimmerfall/static/rarity_mythic-QL9iyt009yFcmawQR0K0YaHbCyvCH1.svg",
  Epic: "https://wqnuijtdmorxprhl.public.blob.vercel-storage.com/glimmerfall/static/rarity_rare-4bDZ8wMiRhs2soTjHbD2aBJsMnMddj.svg",
  "Founders Foil": "https://wqnuijtdmorxprhl.public.blob.vercel-storage.com/glimmerfall/static/rarity_rare-4bDZ8wMiRhs2soTjHbD2aBJsMnMddj.svg",
};

export const rarityIcon = (r) => RARITY_ICONS[r] || RARITY_ICONS.Common;

export const CARD_TYPES = ["Entity", "Rite", "Flash", "Relic"];

export const KEYWORDS = {
  Guard: "Enemies must attack a Guard entity before the Nexus or other entities.",
  Evasive: "Bypasses Guard and can attack the Nexus directly.",
  Stealth: "Cannot be attacked while Stealthed. Attacking breaks Stealth.",
  Echo: "When cast, return a copy of this spell to your hand. It costs 1 more.",
  Overwhelm: "Excess damage dealt to a Guard spills over to the enemy Nexus.",
  Lethal: "Any damage dealt to an Entity destroys it.",
};

export const factionCfg = (f) => FACTIONS[f] || FACTIONS.Aether;
