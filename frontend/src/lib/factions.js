export const CARDBACK =
  "https://res.cloudinary.com/dfyh7cs1g/image/upload/v1784376716/glimmerfall/baked_cardback.png";

export const LOGO = "/glimmerfall-logo-256.png";
export const LOGO_FULL = "/glimmerfall-logo.png";

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
  },
};

export const RARITY = {
  Common: { color: "#B0BEC5", glow: "0 0 8px rgba(176,190,197,0.4)" },
  Uncommon: { color: "#4CAF50", glow: "0 0 12px rgba(76,175,80,0.55)" },
  Rare: { color: "#2196F3", glow: "0 0 16px rgba(33,150,243,0.7)" },
  Mythic: { color: "#FF9800", glow: "0 0 22px rgba(255,152,0,0.9)" },
  "Founders Foil": { color: "#E040FB", glow: "0 0 26px rgba(224,64,251,0.85)" },
};

export const CARD_TYPES = ["Entity", "Rite", "Flash", "Relic"];

export const KEYWORDS = {
  Guard: "Enemies must attack a Guard entity before the Vanguard or other entities.",
  Evasive: "Bypasses Guard and can attack the Vanguard directly.",
  Stealth: "Cannot be targeted by spells or attacks. Fades after it attacks.",
  Lethal: "Any damage this entity deals instantly destroys the target.",
  Overwhelm: "Excess damage dealt to a Guard spills over to the enemy Vanguard.",
  Swift: "Reacts faster in the tempo chain.",
};

export const factionCfg = (f) => FACTIONS[f] || FACTIONS.Aether;
