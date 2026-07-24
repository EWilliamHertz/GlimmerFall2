import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Activity, ShieldAlert, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [telemetry, setTelemetry] = useState(null);

  useEffect(() => {
    api.get("/admin/telemetry").then(r => setTelemetry(r.data)).catch(console.error);
  }, []);

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="font-display text-4xl font-bold text-red-500">Access Denied</h1>
          <p className="text-white/50 font-head mt-2">You must be an administrator to view this page.</p>
        </div>
      </div>
    );
  }

  if (!telemetry) {
    return <div className="py-32 text-center text-white/50 font-head">Loading telemetry...</div>;
  }

  const COLORS = ["#22E07B", "#9B30FF", "#F2A900", "#00BFFF", "#FF5252"];
  const PIE_DATA = [
    { name: "First Player Win", value: telemetry.first_vs_second.first },
    { name: "Second Player Win", value: telemetry.first_vs_second.second },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 py-24 space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-2 flex items-center gap-3">
            <Activity className="w-10 h-10 text-[#00BFFF]" /> Admin Telemetry
          </h1>
          <p className="text-white/60 font-head text-lg">Balance Analytics & Game Health Metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Faction Win Rates */}
        <section className="glass rounded-3xl p-6">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#22E07B]">
            <TrendingUp className="w-6 h-6" /> Faction Win Rates
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telemetry.faction_win_rates} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="faction" type="category" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.7)", fontFamily: "Inter", fontSize: 14 }} width={80} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={{ backgroundColor: "#06070c", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontFamily: "Inter" }} />
                <Bar dataKey="winRate" radius={[0, 4, 4, 0]} barSize={24}>
                  {telemetry.faction_win_rates.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* First vs Second */}
        <section className="glass rounded-3xl p-6">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#F2A900]">
            First vs Second Advantage
          </h2>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  <Cell fill="#00BFFF" />
                  <Cell fill="#FF5252" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#06070c", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px", fontFamily: "Inter" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center gap-2 pointer-events-none">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#00BFFF]" /><span className="text-sm font-head text-white/70">Go First ({telemetry.first_vs_second.first}%)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#FF5252]" /><span className="text-sm font-head text-white/70">Go Second ({telemetry.first_vs_second.second}%)</span></div>
            </div>
          </div>
        </section>

        {/* Most Drafted Cards */}
        <section className="glass rounded-3xl p-6 lg:col-span-2">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#9B30FF]">
            Most Drafted Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {telemetry.most_drafted_cards.map((card, i) => (
              <div key={card.name} className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-display font-bold text-white/20 mb-2">#{i + 1}</div>
                <div className="font-head font-bold text-[#F2A900] mb-1">{card.name}</div>
                <div className="text-xs text-white/50">{card.count.toLocaleString()} drafts</div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
