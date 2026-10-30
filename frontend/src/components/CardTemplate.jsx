import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { CARDBACK, RARITY, RARITY_ICONS, factionCfg, getDesignerCardUrl } from "@/lib/factions";

const SIZES = {
  xs: "w-[80px]",
  sm: "w-[132px]",
  md: "w-44",
  lg: "w-56",
  xl: "w-72",
};

const SHOW_TEXT = { xs: false, sm: false, md: true, lg: true, xl: true };
const NAME_CLS = { 
  xs: "text-[7px]", 
  sm: "text-[9px]", 
  md: "text-[11px]", 
  lg: "text-sm", 
  xl: "text-base" 
};
const COST_CLS = { 
  xs: "text-[9px] w-4 h-4", 
  sm: "text-[11px] w-5 h-5", 
  md: "text-xs w-6 h-6", 
  lg: "text-sm w-7 h-7", 
  xl: "text-base w-8 h-8" 
};
const STAT_CLS = { 
  xs: "text-[8px]", 
  sm: "text-[10px]", 
  md: "text-xs", 
  lg: "text-sm", 
  xl: "text-base" 
};
const RARITY_ICON_H = { 
  xs: "h-3", 
  sm: "h-3.5", 
  md: "h-4", 
  lg: "h-5", 
  xl: "h-6" 
};

const kwList = (card) => {
  if (Array.isArray(card?.keywords)) return card.keywords;
  const k = card?.keywords;
  if (!k || k === "None") return [];
  return String(k).split(",").map((s) => s.trim()).filter(Boolean);
};

// Rarity-scaled tilt: subtle for common cards, dramatic for Epic
const TILT_BY_RARITY = {
  Common: 11,
  Uncommon: 11,
  Rare: 15,
  Epic: 20,
  "Founders Foil": 20,
};

export const CardTemplate = ({
  card,
  size = "md",
  hidden = false,
  onClick,
  selected = false,
  exhausted = false,
  dimmed = false,
  tilt = true,
  forceText = false,
  badge = null,
  className = "",
  width = null,
  height = null,
  eager = false,
  bleed = null,
  testId,
  preferDesigner = false,
}) => {
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltDeg = TILT_BY_RARITY[card?.rarity] || 11;
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [tiltDeg, -tiltDeg]), { stiffness: 220, damping: 16 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-tiltDeg, tiltDeg]), { stiffness: 220, damping: 16 });
  
  // Mouse-tracked positions for holo strip (Rare) and foil shimmer (Epic)
  const stripX = useTransform(mx, [-0.5, 0.5], ["-40%", "140%"]);
  const [hover, setHover] = useState(false);

  const f = factionCfg(card?.faction);
  const rar = RARITY[card?.rarity] || RARITY.Common;
  const type = card?.cardType || card?.card_type;
  const isEntity = type === "Entity";
  const power = card?.power;
  const health = card?.curHealth != null ? card.curHealth : card?.health;
  const damaged = card?.curHealth != null && card?.health != null && card.curHealth < card.health;
  const desc = card?.description || "";
  const kws = kwList(card);
  const showText = forceText || SHOW_TEXT[size];

  const onMove = (e) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => { mx.set(0); my.set(0); setHover(false); };

  const designerImg = preferDesigner ? getDesignerCardUrl(card?.name) : null;
  const img = hidden ? CARDBACK : card?.image_url && card.image_url !== "None" ? card.image_url : CARDBACK;
  const isRare = !hidden && card?.rarity === "Rare";
  const isEpic = !hidden && (card?.rarity === "Epic" || card?.rarity === "Founders Foil");

  if (hidden) {
    return (
      <motion.div
        data-testid={testId}
        className={`${SIZES[size]} relative shrink-0 aspect-[5/7] rounded-xl overflow-hidden border-2 border-white/15 ${className}`}
      >
        <img src={CARDBACK} alt="card back" className="w-full h-full object-cover" draggable={false} loading={eager ? "eager" : "lazy"} />
      </motion.div>
    );
  }

  const frames = f.frames || {};

  return (
    <motion.div
      ref={ref}
      data-testid={testId}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={reset}
      onClick={onClick}
      style={{
        rotateX: tilt ? rx : 0,
        rotateY: tilt ? ry : 0,
        transformStyle: "preserve-3d",
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        boxShadow: selected ? `0 0 0 3px #fff, 0 0 30px ${f.glow}` : hover ? `0 0 26px ${f.glow}, ${rar.glow}` : rar.glow,
      }}
      className={`${width ? "" : SIZES[size]} relative shrink-0 ${width && height ? "" : "aspect-[5/7]"} rounded-xl cursor-pointer select-none transition-shadow duration-300
        ${dimmed ? "opacity-40" : ""} ${className}`}
    >
      {/* Outer Card Shell with Designer Borders */}
      <div 
        className="absolute inset-0 rounded-xl overflow-hidden print-no-border bg-[#0d0f12] flex flex-col justify-between"
        style={{ border: `2px solid ${selected ? "#ffffff" : f.color}` }}
      >
        {/* Background Artwork Layer (Centered Inset Art Window) */}
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={img} 
            alt={card?.name || "card"} 
            className="w-full h-full object-cover" 
            draggable={false} 
            loading={eager ? "eager" : "lazy"} 
          />
          {/* Faction atmospheric vignette */}
          <div 
            className="pointer-events-none absolute inset-0" 
            style={{ 
              background: `linear-gradient(to bottom, rgba(10,12,16,0.7) 0%, rgba(10,12,16,0.1) 25%, rgba(10,12,16,0.1) 60%, rgba(10,12,16,0.92) 85%, #0a0c10 100%)` 
            }} 
          />
        </div>

        {/* ============================================================ */}
        {/* DESIGNER TOP FRAME / HEADER BANNER                           */}
        {/* ============================================================ */}
        <div className="relative z-10 w-full pt-1 px-1">
          {frames.header && (
            <img 
              src={frames.header} 
              alt="frame header" 
              className="absolute top-0 left-0 w-full h-auto pointer-events-none drop-shadow-md" 
              draggable={false} 
            />
          )}

          <div className="relative flex items-center justify-between min-h-[26px] px-1 pt-0.5">
            {/* Embedded Cost Orb */}
            <div className="relative flex items-center justify-center shrink-0 -ml-0.5 -mt-0.5">
              {frames.costOrb ? (
                <img 
                  src={frames.costOrb} 
                  alt="cost orb" 
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none filter drop-shadow" 
                />
              ) : null}
              <div
                className={`absolute inset-0 flex items-center justify-center font-num font-black text-white ${COST_CLS[size]}`}
                style={{ textShadow: "0 2px 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)" }}
                data-testid={testId ? `${testId}-cost` : undefined}
              >
                {card?.cost}
              </div>
            </div>

            {/* Card Name */}
            <div className="flex-1 mx-1.5 overflow-hidden">
              <span 
                className={`font-display font-bold tracking-wide truncate block text-center ${NAME_CLS[size]}`} 
                style={{ 
                  color: "#ffffff", 
                  textShadow: `0 0 8px ${f.glow}, 0 2px 4px rgba(0,0,0,0.9)` 
                }} 
                data-testid={testId ? `${testId}-name` : undefined}
              >
                {card?.name}
              </span>
            </div>

            {/* Rarity Symbol */}
            <div className="shrink-0 -mr-0.5">
              <img
                src={RARITY_ICONS[card?.rarity] || RARITY_ICONS.Common}
                alt={card?.rarity || "Common"}
                className={`w-auto pointer-events-none ${RARITY_ICON_H[size]}`}
                style={{ filter: `drop-shadow(0 0 4px ${rar.color})` }}
                loading={eager ? "eager" : "lazy"}
                draggable={false}
                data-testid={testId ? `${testId}-rarity` : undefined}
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DESIGNER BOTTOM FRAME / TEXT BOX & STATS                    */}
        {/* ============================================================ */}
        <div className="relative z-10 w-full mt-auto">
          {frames.footer && (
            <img 
              src={frames.footer} 
              alt="frame footer" 
              className="absolute bottom-0 left-0 w-full h-auto pointer-events-none" 
              draggable={false} 
            />
          )}

          <div 
            className={`relative px-2 pt-2.5 ${isEntity ? "pb-4" : "pb-2"}`} 
            style={{ 
              background: `linear-gradient(to top, rgba(8,10,14,0.96) 0%, rgba(12,15,20,0.88) 75%, transparent 100%)`,
              textShadow: "0 1px 3px rgba(0,0,0,0.9)" 
            }}
          >
            {/* Type & Keywords Ribbon */}
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1 overflow-hidden">
                <span
                  className="inline-block px-1.5 py-0.2 rounded text-[7px] sm:text-[8px] font-head font-bold uppercase tracking-wider"
                  style={{ background: f.color, color: "#000" }}
                  data-testid={testId ? `${testId}-type` : undefined}
                >
                  {card?.faction} • {type}
                </span>
                {kws.slice(0, 2).map((k) => (
                  <span 
                    key={k} 
                    className="text-[6.5px] sm:text-[7.5px] font-head font-bold px-1 rounded bg-white/15 text-white/90 border border-white/10"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            {/* Description Text */}
            {showText && desc && (
              <p 
                className={isEntity ? "pr-8 mt-0.5 leading-snug" : "mt-0.5 leading-snug"} 
                style={{ 
                  color: "rgba(255,255,255,0.92)", 
                  fontSize: size === "xl" ? 11 : size === "lg" ? 9.5 : 8.5, 
                  display: "-webkit-box", 
                  WebkitLineClamp: size === "xl" ? 5 : size === "lg" ? 4 : 3, 
                  WebkitBoxOrient: "vertical", 
                  overflow: "hidden" 
                }} 
                data-testid={testId ? `${testId}-desc` : undefined}
              >
                {desc}
              </p>
            )}

            {/* Collector Code (Footer) */}
            {showText && (
              <div 
                className="text-[5.5px] text-white/50 font-mono tracking-wider pt-1 pointer-events-none" 
                data-testid={testId ? `${testId}-collector` : undefined}
              >
                {card?.set_code || "AWK"} • {String(card?.collector_number || 0).padStart(3, "0")}
              </div>
            )}

            {/* Power / Health Stat Pill (Bottom-Right) */}
            {isEntity && power != null && (
              <div className="absolute right-1.5 bottom-1 flex items-center justify-center">
                {frames.statPill && (
                  <img 
                    src={frames.statPill} 
                    alt="stat pill" 
                    className="absolute w-12 sm:w-14 h-auto pointer-events-none" 
                  />
                )}
                <div 
                  className={`relative flex items-center justify-center gap-0.5 font-num font-black px-1.5 py-0.5 rounded ${STAT_CLS[size]}`}
                  style={{ 
                    background: frames.statPill ? "transparent" : f.color, 
                    color: frames.statPill ? "#ffffff" : "#000000",
                    textShadow: "0 2px 4px rgba(0,0,0,0.95)"
                  }}
                >
                  <span data-testid={testId ? `${testId}-power` : undefined} className="text-amber-300 font-black">{power}</span>
                  <span className="opacity-60 text-white/70">/</span>
                  <span 
                    data-testid={testId ? `${testId}-health` : undefined} 
                    className={damaged ? "text-red-400 font-black" : "text-emerald-300 font-black"}
                  >
                    {health}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rare Holo Strip */}
        {isRare && tilt && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              mixBlendMode: "color-dodge",
              opacity: hover ? 0.45 : 0,
              transition: "opacity .3s",
              background: `linear-gradient(115deg, transparent 42%, rgba(255,235,150,0.55) 49%, rgba(255,255,255,0.85) 52%, rgba(150,235,255,0.55) 55%, transparent 62%)`,
              backgroundSize: "220% 220%",
              backgroundPositionX: stripX,
              backgroundPositionY: stripX,
            }}
          />
        )}

        {/* Epic Holographic Foil Sheen */}
        {isEpic && tilt && (
          <>
            <motion.div
              className="pointer-events-none absolute inset-0 z-20"
              style={{
                mixBlendMode: "color-dodge",
                opacity: hover ? 0.8 : 0,
                transition: "opacity .3s",
                background: `linear-gradient(115deg, transparent 42%, rgba(255,235,150,0.55) 49%, rgba(255,255,255,0.85) 52%, rgba(150,235,255,0.55) 55%, transparent 62%)`,
                backgroundSize: "220% 220%",
                backgroundPositionX: stripX,
                backgroundPositionY: stripX,
              }}
            />
            {hover && (
              <motion.div
                className="pointer-events-none absolute inset-0 z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0], backgroundPositionX: ["0%", "150%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                style={{
                  mixBlendMode: "screen",
                  background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.85) 50%, transparent 60%)",
                  backgroundSize: "220% 100%",
                }}
              />
            )}
          </>
        )}

        {/* Exhausted Overlay */}
        {exhausted && (
          <div className="absolute inset-0 z-30 bg-black/55 flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-[10px] font-head uppercase tracking-widest text-white/90 rotate-[-8deg] border border-white/40 px-2 py-0.5 rounded shadow-lg bg-black/60">
              Exhausted
            </span>
          </div>
        )}
      </div>

      {badge}
    </motion.div>
  );
};

export default CardTemplate;
