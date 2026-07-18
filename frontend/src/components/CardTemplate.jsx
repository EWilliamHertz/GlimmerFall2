import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { CARDBACK, RARITY, factionCfg } from "@/lib/factions";

const SIZES = {
  xs: "w-[80px]",
  sm: "w-[132px]",
  md: "w-44",
  lg: "w-56",
  xl: "w-72",
};
const SHOW_TEXT = { xs: false, sm: false, md: true, lg: true, xl: true };
const NAME_CLS = { xs: "text-[8px]", sm: "text-[10px]", md: "text-xs", lg: "text-sm", xl: "text-base" };
const COST_CLS = { xs: "w-5 h-5 text-[10px]", sm: "w-7 h-7 text-sm", md: "w-8 h-8 text-base", lg: "w-9 h-9 text-lg", xl: "w-10 h-10 text-xl" };
const STAT_CLS = { xs: "w-5 h-5 text-[10px]", sm: "w-6 h-6 text-xs", md: "w-7 h-7 text-sm", lg: "w-8 h-8 text-base", xl: "w-9 h-9 text-lg" };
const PH_CLS = { xs: "text-[9px]", sm: "text-[10px]", md: "text-xs", lg: "text-sm", xl: "text-base" };

const kwList = (card) => {
  if (Array.isArray(card?.keywords)) return card.keywords;
  const k = card?.keywords;
  if (!k || k === "None") return [];
  return String(k).split(",").map((s) => s.trim()).filter(Boolean);
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
  eager = false,
  testId,
}) => {
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [11, -11]), { stiffness: 220, damping: 16 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-11, 11]), { stiffness: 220, damping: 16 });
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

  const img = hidden ? CARDBACK : card?.image_url && card.image_url !== "None" ? card.image_url : CARDBACK;
  const isHolo = !hidden && (card?.rarity === "Mythic" || card?.rarity === "Founders Foil");

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
        boxShadow: selected ? `0 0 0 3px #fff, 0 0 30px ${f.glow}` : hover ? `0 0 26px ${f.glow}, ${rar.glow}` : rar.glow,
      }}
      className={`${width ? "" : SIZES[size]} relative shrink-0 aspect-[5/7] rounded-xl cursor-pointer select-none transition-shadow duration-300
        ${dimmed ? "opacity-40" : ""} ${className}`}
    >
      <div className="absolute inset-0 rounded-xl overflow-hidden" style={{ border: `2px solid ${selected ? "#ffffff" : f.color}` }}>
        <img src={img} alt={card?.name || "card"} className="w-full h-full object-cover" draggable={false} loading={eager ? "eager" : "lazy"} />

        {/* faction background tint */}
        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to top, ${f.color}33 0%, transparent 55%)` }} />

        {isHolo && (
          <div className="pointer-events-none absolute inset-0" style={{ mixBlendMode: "color-dodge", opacity: hover ? 0.55 : 0.28, transition: "opacity .3s", background: "linear-gradient(115deg, transparent 18%, rgba(179,229,252,.6) 38%, rgba(255,235,59,.5) 50%, rgba(224,64,251,.6) 62%, transparent 82%)" }} />
        )}

        {/* bottom info panel */}
        <div className={`absolute inset-x-0 bottom-0 px-1.5 pt-4 ${isEntity ? "pb-5" : "pb-1.5"}`} style={{ background: "linear-gradient(to top, rgba(6,7,12,0.70) 62%, rgba(6,7,12,0.40) 100%)", backdropFilter: "blur(1px)" }}>
          <div className="flex items-center gap-1">
            <span className={`font-display font-bold leading-tight truncate ${NAME_CLS[size]}`} style={{ color: f.soft }} data-testid={testId ? `${testId}-name` : undefined}>
              {card?.name}
            </span>
          </div>
          <span
            className="inline-block mt-0.5 px-1.5 rounded text-[8px] font-head font-semibold uppercase tracking-wide"
            style={{ background: `${f.color}`, color: "#000" }}
            data-testid={testId ? `${testId}-type` : undefined}
          >
            {type}
          </span>
          {showText && desc && (
            <p className={isEntity ? "mt-1 pr-9" : "mt-1"} style={{ color: "rgba(255,255,255,0.92)", fontSize: size === "xl" ? 11 : 9, display: "-webkit-box", WebkitLineClamp: size === "xl" ? 5 : 4, WebkitBoxOrient: "vertical", overflow: "hidden" }} data-testid={testId ? `${testId}-desc` : undefined}>
              {desc}
            </p>
          )}
        </div>

        {exhausted && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
            <span className="text-[10px] font-head uppercase tracking-widest text-white/80 rotate-[-8deg] border border-white/30 px-2 py-0.5 rounded">Exhausted</span>
          </div>
        )}
      </div>

      {/* energy cost badge (faction) */}
      <div
        className={`absolute left-1 top-1 rounded-full flex items-center justify-center font-num font-bold text-black ${COST_CLS[size]}`}
        style={{ background: f.color, border: "2px solid rgba(0,0,0,0.5)", boxShadow: `0 0 10px ${f.glow}` }}
        data-testid={testId ? `${testId}-cost` : undefined}
      >
        {card?.cost}
      </div>

      {/* rarity gem */}
      <div className="absolute right-1.5 top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: rar.color, boxShadow: rar.glow }} />

      {/* keywords */}
      {kws.length > 0 && (
        <div className="absolute left-1 top-8 flex flex-col gap-0.5">
          {kws.slice(0, 3).map((k) => (
            <span key={k} className="text-[7px] font-head font-bold px-1 rounded leading-tight" style={{ background: `${f.color}dd`, color: "#000" }}>{k}</span>
          ))}
        </div>
      )}

      {/* power / health — combined faction-colored pill, bottom-right */}
      {isEntity && power != null && (
        <div className={`absolute right-1 bottom-1 flex items-center gap-0.5 px-1.5 rounded-md font-num font-bold border-2 border-black/60 ${PH_CLS[size]}`} style={{ background: f.color, color: "#000" }}>
          <span data-testid={testId ? `${testId}-power` : undefined}>{power}</span>
          <span className="opacity-50">/</span>
          <span className={damaged ? "text-red-800" : ""} data-testid={testId ? `${testId}-health` : undefined}>{health}</span>
        </div>
      )}

      {badge}
    </motion.div>
  );
};

export default CardTemplate;
