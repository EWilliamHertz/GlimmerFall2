import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { factionCfg } from "@/lib/factions";

/**
 * ProjectileLayer
 * A fullscreen fixed overlay that listens for `gf-attack` CustomEvents and
 * animates a projectile from a source DOM element to a target DOM element,
 * then flashes an impact burst and floats a damage number.
 *
 * Event payload:
 *   { sourceTestId, targetTestId, faction, damage, kind }
 *   kind: 'entity' | 'nexus'
 */
export default function ProjectileLayer() {
  const [shots, setShots] = useState([]);
  const [shake, setShake] = useState(0);

  const spawn = useCallback((detail) => {
    const { sourceTestId, targetTestId, faction = "Solari", damage, kind = "entity" } = detail || {};
    if (!sourceTestId || !targetTestId) return;
    const src = document.querySelector(`[data-testid="${sourceTestId}"]`);
    const tgt = document.querySelector(`[data-testid="${targetTestId}"]`);
    if (!src || !tgt) return;
    const s = src.getBoundingClientRect();
    const t = tgt.getBoundingClientRect();
    const from = { x: s.left + s.width / 2, y: s.top + s.height / 2 };
    const to = { x: t.left + t.width / 2, y: t.top + t.height / 2 };
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setShots((prev) => [...prev, { id, from, to, faction, damage, kind }]);
    // remove after full lifecycle (~1.6s)
    setTimeout(() => setShots((prev) => prev.filter((x) => x.id !== id)), 1700);
    // screen shake for nexus hits, small shake for entity hits
    setShake((n) => n + (kind === "nexus" ? 2 : 1));
  }, []);

  useEffect(() => {
    const handler = (e) => spawn(e.detail);
    window.addEventListener("gf-attack", handler);
    return () => window.removeEventListener("gf-attack", handler);
  }, [spawn]);

  // Trigger a brief screen shake by animating a wrapper element
  return (
    <motion.div
      animate={shake > 0 ? { x: [0, -6, 6, -4, 4, 0], y: [0, 3, -3, 2, -2, 0] } : {}}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      key={shake}
      className="fixed inset-0 pointer-events-none z-[65]"
    >
      <AnimatePresence>
        {shots.map((s) => (
          <Projectile key={s.id} {...s} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function Projectile({ from, to, faction, damage, kind }) {
  const color = factionCfg(faction).color;
  const glow = factionCfg(faction).glow;
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

  // Trail line drawn from source toward target - fades quickly
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);

  return (
    <>
      {/* Slash trail line */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: [0, 0.7, 0], scaleX: [0, 1, 1] }}
        transition={{ duration: 0.45, ease: "easeIn" }}
        style={{
          position: "absolute",
          left: from.x,
          top: from.y - 2,
          width: dist,
          height: 4,
          transformOrigin: "0% 50%",
          transform: `rotate(${angle}deg)`,
          background: `linear-gradient(90deg, transparent 0%, ${color} 40%, #fff 60%, ${color} 80%, transparent 100%)`,
          boxShadow: `0 0 12px ${color}, 0 0 30px ${glow}`,
          borderRadius: 4,
          filter: "blur(0.5px)",
        }}
      />

      {/* Projectile orb - flies from source to target */}
      <motion.div
        initial={{ x: from.x, y: from.y, opacity: 0.6, scale: 0.4 }}
        animate={{
          x: to.x,
          y: to.y,
          opacity: [0.6, 1, 1, 0.2],
          scale: [0.4, 1.3, 1.3, 0.6],
        }}
        transition={{ duration: 0.45, ease: [0.4, 0.0, 0.6, 1] }}
        style={{
          position: "absolute",
          left: -18,
          top: -18,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `radial-gradient(circle, #fff 15%, ${color} 55%, transparent 90%)`,
          boxShadow: `0 0 24px 6px ${color}, 0 0 48px 12px ${glow}`,
          filter: "blur(0.4px)",
        }}
      />

      {/* Impact ring burst */}
      <motion.div
        initial={{ x: to.x, y: to.y, opacity: 0, scale: 0.3 }}
        animate={{
          x: to.x,
          y: to.y,
          opacity: [0, 0.9, 0],
          scale: [0.3, kind === "nexus" ? 4 : 2.6, kind === "nexus" ? 5.5 : 3.6],
        }}
        transition={{ duration: 0.55, delay: 0.4, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: -40,
          top: -40,
          width: 80,
          height: 80,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
        }}
      />

      {/* Impact sparks - 6 lines radiating outward */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const spx = Math.cos(a) * 60;
        const spy = Math.sin(a) * 60;
        return (
          <motion.div
            key={i}
            initial={{ x: to.x, y: to.y, opacity: 0, scale: 0.5 }}
            animate={{ x: to.x + spx, y: to.y + spy, opacity: [0, 1, 0], scale: [0.5, 1, 0.3] }}
            transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: -2,
              top: -2,
              width: 4,
              height: 4,
              borderRadius: 4,
              background: "#fff",
              boxShadow: `0 0 8px ${color}, 0 0 16px ${color}`,
            }}
          />
        );
      })}

      {/* Damage number floater */}
      {damage != null && damage > 0 && (
        <motion.div
          initial={{ x: to.x, y: to.y - 10, opacity: 0, scale: 0.5 }}
          animate={{
            x: to.x + 20,
            y: to.y - 90,
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1.5, 1.2, 1.0],
          }}
          transition={{ duration: 1.2, delay: 0.45, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: -24,
            top: -24,
            fontFamily: '"Bebas Neue", system-ui, sans-serif',
            fontWeight: 900,
            fontSize: kind === "nexus" ? 44 : 32,
            color: "#fff",
            textShadow: `0 0 12px ${color}, 0 0 4px #000, 2px 2px 0 #000, -1px -1px 0 #000`,
            letterSpacing: "0.05em",
            userSelect: "none",
          }}
        >
          -{damage}
        </motion.div>
      )}
    </>
  );
}

/**
 * Helper to dispatch an attack projectile from anywhere.
 */
export function fireAttackProjectile({ sourceTestId, targetTestId, faction, damage, kind }) {
  try {
    window.dispatchEvent(
      new CustomEvent("gf-attack", {
        detail: { sourceTestId, targetTestId, faction, damage, kind },
      })
    );
  } catch (e) {}
}
