import React, { useMemo } from "react";
import { 
  BarChart, Bar, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from "recharts";
import { Zap, Sword, Heart, Shield, BookOpen, Layers, Activity } from "lucide-react";
import { factionCfg } from "@/lib/factions";

const TYPE_CONFIG = {
  Entity: { label: "Entities", color: "#FF5252", bg: "rgba(255, 82, 82, 0.15)", icon: Sword },
  Rite: { label: "Rites", color: "#00BFFF", bg: "rgba(0, 191, 255, 0.15)", icon: BookOpen },
  Relic: { label: "Relics", color: "#22E07B", bg: "rgba(34, 224, 123, 0.15)", icon: Shield },
  Flash: { label: "Flash", color: "#F2A900", bg: "rgba(242, 169, 0, 0.15)", icon: Zap },
};

export default function DeckAnalytics({ deckEntries = [], compact = false }) {
  // deckEntries is expected to be an array of: { card, count }
  const totalCards = useMemo(() => {
    return deckEntries.reduce((sum, item) => sum + (item.count || 0), 0);
  }, [deckEntries]);

  // Mana / Energy Curve Data (0 through 6+)
  const curveData = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6+
    let totalCost = 0;
    let countedCards = 0;

    deckEntries.forEach(({ card, count }) => {
      if (!card) return;
      const cost = Number(card.cost) || 0;
      const bucketIdx = Math.min(6, Math.max(0, cost));
      buckets[bucketIdx] += count;
      totalCost += cost * count;
      countedCards += count;
    });

    const avgCost = countedCards > 0 ? (totalCost / countedCards).toFixed(1) : "0.0";
    const data = buckets.map((count, cost) => ({
      cost: cost === 6 ? "6+" : String(cost),
      count,
      pct: totalCards > 0 ? Math.round((count / totalCards) * 100) : 0
    }));

    return { data, avgCost, buckets };
  }, [deckEntries, totalCards]);

  // Card Type Splits (Entity, Rite, Relic, Flash)
  const typeData = useMemo(() => {
    const counts = { Entity: 0, Rite: 0, Relic: 0, Flash: 0, Other: 0 };
    deckEntries.forEach(({ card, count }) => {
      if (!card) return;
      const t = card.card_type;
      if (counts[t] !== undefined) {
        counts[t] += count;
      } else {
        counts.Other += count;
      }
    });

    const entries = Object.entries(counts)
      .filter(([name, value]) => value > 0 && name !== "Other")
      .map(([name, value]) => ({
        name,
        label: TYPE_CONFIG[name]?.label || name,
        value,
        pct: totalCards > 0 ? Math.round((value / totalCards) * 100) : 0,
        color: TYPE_CONFIG[name]?.color || "#FFF"
      }));

    return { counts, entries };
  }, [deckEntries, totalCards]);

  // Faction Breakdown
  const factionData = useMemo(() => {
    const counts = {};
    deckEntries.forEach(({ card, count }) => {
      if (!card || !card.faction) return;
      counts[card.faction] = (counts[card.faction] || 0) + count;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      pct: totalCards > 0 ? Math.round((value / totalCards) * 100) : 0,
      color: factionCfg(name).color
    }));
  }, [deckEntries, totalCards]);

  // Combat Stat Aggregates (Entities Power & Health)
  const combatStats = useMemo(() => {
    let totalPower = 0;
    let totalHealth = 0;
    let entityCount = 0;

    deckEntries.forEach(({ card, count }) => {
      if (!card || card.card_type !== "Entity") return;
      const p = Number(card.power) || 0;
      const h = Number(card.health) || 0;
      totalPower += p * count;
      totalHealth += h * count;
      entityCount += count;
    });

    return {
      totalPower,
      totalHealth,
      entityCount,
      avgPower: entityCount > 0 ? (totalPower / entityCount).toFixed(1) : "0",
      avgHealth: entityCount > 0 ? (totalHealth / entityCount).toFixed(1) : "0"
    };
  }, [deckEntries]);

  // Game Phases: Early (0-2), Mid (3-4), Late (5+)
  const phaseBreakdown = useMemo(() => {
    const b = curveData.buckets;
    const early = b[0] + b[1] + b[2];
    const mid = b[3] + b[4];
    const late = b[5] + b[6];
    return {
      earlyPct: totalCards > 0 ? Math.round((early / totalCards) * 100) : 0,
      midPct: totalCards > 0 ? Math.round((mid / totalCards) * 100) : 0,
      latePct: totalCards > 0 ? Math.round((late / totalCards) * 100) : 0
    };
  }, [curveData, totalCards]);

  if (totalCards === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-white/40 font-head text-sm">
        Add cards to view live energy curve and deck analytics.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-center">
          <div className="text-[10px] font-head uppercase tracking-wider text-white/40">Avg Energy</div>
          <div className="text-xl font-display font-black text-[#F2A900] flex items-center justify-center gap-1">
            <Zap className="w-4 h-4" /> {curveData.avgCost}
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-center">
          <div className="text-[10px] font-head uppercase tracking-wider text-white/40">Entities</div>
          <div className="text-xl font-display font-black text-[#FF5252] flex items-center justify-center gap-1">
            <Sword className="w-4 h-4" /> {typeData.counts.Entity || 0}
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-center">
          <div className="text-[10px] font-head uppercase tracking-wider text-white/40">Spells (R/F)</div>
          <div className="text-xl font-display font-black text-[#00BFFF] flex items-center justify-center gap-1">
            <BookOpen className="w-4 h-4" /> {(typeData.counts.Rite || 0) + (typeData.counts.Flash || 0)}
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-center">
          <div className="text-[10px] font-head uppercase tracking-wider text-white/40">Relics</div>
          <div className="text-xl font-display font-black text-[#22E07B] flex items-center justify-center gap-1">
            <Shield className="w-4 h-4" /> {typeData.counts.Relic || 0}
          </div>
        </div>
      </div>

      {/* Energy Curve Section */}
      <div className="bg-black/50 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#F2A900]" />
            <h4 className="font-head font-bold text-sm text-white/90">Energy Curve</h4>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-head text-white/50">
            <span>Early (0-2): <strong className="text-white">{phaseBreakdown.earlyPct}%</strong></span>
            <span>Mid (3-4): <strong className="text-white">{phaseBreakdown.midPct}%</strong></span>
            <span>Late (5+): <strong className="text-white">{phaseBreakdown.latePct}%</strong></span>
          </div>
        </div>

        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={curveData.data} margin={{ top: 12, right: 0, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="cost" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)", fontFamily: "sans-serif" }} 
                dy={4} 
              />
              <RechartsTooltip 
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
                formatter={(val) => [`${val} Cards (${totalCards > 0 ? Math.round((val/totalCards)*100) : 0}%)`, "Count"]}
                contentStyle={{ 
                  backgroundColor: "#0B0C10", 
                  borderColor: "rgba(255,255,255,0.15)", 
                  borderRadius: "10px", 
                  color: "#FFF",
                  fontSize: "12px",
                  padding: "6px 12px"
                }} 
              />
              <Bar 
                dataKey="count" 
                fill="#00BFFF" 
                radius={[5, 5, 0, 0]} 
                label={{ 
                  position: "top", 
                  fill: "rgba(255,255,255,0.7)", 
                  fontSize: 10, 
                  formatter: (v) => v > 0 ? v : "" 
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Card Type Distribution */}
      <div className="bg-black/50 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00BFFF]" />
            <h4 className="font-head font-bold text-sm text-white/90">Card Type Split</h4>
          </div>
          <span className="text-xs font-head text-white/50">{totalCards} Total</span>
        </div>

        {/* Segmented Progress Bar */}
        <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden flex mb-3">
          {typeData.entries.map((item) => (
            <div 
              key={item.name}
              title={`${item.label}: ${item.value} (${item.pct}%)`}
              style={{ width: `${item.pct}%`, backgroundColor: item.color }}
              className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
            />
          ))}
        </div>

        {/* Type Badges Breakdown */}
        <div className="grid grid-cols-2 gap-2 text-xs font-head">
          {["Entity", "Rite", "Relic", "Flash"].map((typeName) => {
            const count = typeData.counts[typeName] || 0;
            const pct = totalCards > 0 ? Math.round((count / totalCards) * 100) : 0;
            const cfg = TYPE_CONFIG[typeName];
            const Icon = cfg.icon;

            return (
              <div 
                key={typeName}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/5 bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-md" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-bold text-white">{cfg.label}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-white mr-1.5">{count}</span>
                  <span className="text-white/40 text-[11px]">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Factions & Combat Power Overview */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Factions */}
        <div className="bg-black/50 border border-white/10 rounded-2xl p-4">
          <div className="text-xs font-head font-bold text-white/70 uppercase tracking-wider mb-2.5">
            Faction Purity
          </div>
          <div className="space-y-1.5">
            {factionData.map((f) => (
              <div key={f.name} className="flex items-center justify-between text-xs font-head">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="font-bold text-white">{f.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${f.pct}%`, backgroundColor: f.color }} />
                  </div>
                  <span className="text-white/60 font-mono text-[11px] w-8 text-right">{f.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Combat Board Presence */}
        <div className="bg-black/50 border border-white/10 rounded-2xl p-4">
          <div className="text-xs font-head font-bold text-white/70 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>Combat Potential</span>
            <Activity className="w-3.5 h-3.5 text-[#22E07B]" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <div className="text-[10px] font-head text-white/40 uppercase">Total Atk</div>
              <div className="text-lg font-display font-bold text-[#FF5252] flex items-center justify-center gap-1">
                <Sword className="w-3.5 h-3.5" /> {combatStats.totalPower}
              </div>
              <div className="text-[10px] text-white/40">~{combatStats.avgPower} avg</div>
            </div>
            <div className="p-2 rounded-xl bg-white/5 border border-white/5">
              <div className="text-[10px] font-head text-white/40 uppercase">Total HP</div>
              <div className="text-lg font-display font-bold text-[#22E07B] flex items-center justify-center gap-1">
                <Heart className="w-3.5 h-3.5" /> {combatStats.totalHealth}
              </div>
              <div className="text-[10px] text-white/40">~{combatStats.avgHealth} avg</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
