import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export default function FactionParticles({ faction }) {
  const particles = useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * -20,
    }));
  }, [faction]);

  if (!faction) return null;

  let color = "#ffffff";
  let opacity = 0.1;
  let shadow = "none";
  let effectType = "float";

  if (faction.includes("Solari")) {
    color = "#F2A900"; // Fire embers
    opacity = 0.6;
    shadow = "0 0 10px #F2A900";
    effectType = "rise";
  } else if (faction.includes("Umbri")) {
    color = "#9B30FF"; // Void spores
    opacity = 0.4;
    shadow = "0 0 15px #9B30FF";
    effectType = "drift";
  } else if (faction.includes("Terra")) {
    color = "#22E07B"; // Green leaves/spores
    opacity = 0.5;
    shadow = "0 0 8px #22E07B";
    effectType = "fall";
  } else if (faction.includes("Aether")) {
    color = "#00BFFF"; // Arcane wisps
    opacity = 0.5;
    shadow = "0 0 12px #00BFFF";
    effectType = "orbit";
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => {
        let animate = {};
        if (effectType === "rise") {
          animate = { y: ["110vh", "-10vh"], x: [`${p.x}vw`, `${p.x + (Math.random()*10-5)}vw`] };
        } else if (effectType === "fall") {
          animate = { y: ["-10vh", "110vh"], x: [`${p.x}vw`, `${p.x + (Math.random()*20-10)}vw`] };
        } else if (effectType === "drift") {
          animate = { y: [`${p.y}vh`, `${p.y + (Math.random()*20-10)}vh`], x: ["-10vw", "110vw"] };
        } else {
          // float / orbit
          animate = { 
            y: [`${p.y}vh`, `${p.y - 10}vh`, `${p.y + 10}vh`, `${p.y}vh`], 
            x: [`${p.x}vw`, `${p.x + 10}vw`, `${p.x - 10}vw`, `${p.x}vw`] 
          };
        }

        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0 }}
            animate={{
              ...animate,
              opacity: [0, opacity, opacity, 0]
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: color,
              boxShadow: shadow,
              filter: "blur(1px)"
            }}
          />
        );
      })}
    </div>
  );
}
