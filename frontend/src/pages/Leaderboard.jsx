import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { 
  Trophy, Swords, Medal, ShieldAlert, Shield, Crown, Sparkles, 
  Flame, Globe, Filter, ChevronDown, Award, TrendingUp, Calendar
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { factionCfg } from "@/lib/factions";

const TIER_CONFIG = {
  Master: { color: "#FF4500", bg: "rgba(255, 69, 0, 0.15)", border: "rgba(255, 69, 0, 0.4)", icon: Crown },
  Diamond: { color: "#B9F2FF", bg: "rgba(185, 242, 255, 0.15)", border: "rgba(185, 242, 255, 0.4)", icon: Sparkles },
  Platinum: { color: "#00BFFF", bg: "rgba(0, 191, 255, 0.15)", border: "rgba(0, 191, 255, 0.4)", icon: Shield },
  Gold: { color: "#F2A900", bg: "rgba(242, 169, 0, 0.15)", border: "rgba(242, 169, 0, 0.4)", icon: Medal },
  Silver: { color: "#C0C0C0", bg: "rgba(192, 192, 192, 0.15)", border: "rgba(192, 192, 192, 0.4)", icon: Shield },
  Bronze: { color: "#CD7F32", bg: "rgba(205, 127, 50, 0.15)", border: "rgba(205, 127, 50, 0.4)", icon: Shield },
};

function getTierBadge(tierName = "Bronze", division = "I") {
  const cfg = TIER_CONFIG[tierName] || TIER_CONFIG.Bronze;
  const IconComponent = cfg.icon;
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-head font-bold uppercase tracking-wider"
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        color: cfg.color,
        borderWidth: 1
      }}
    >
      <IconComponent className="w-3.5 h-3.5" />
      {tierName} {tierName !== "Master" ? division : ""}
    </span>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [season, setSeason] = useState({
    number: 1,
    name: "Dawn of the Factions",
    ends_in_days: 24,
    tiers: [
      { name: "Master", threshold: 2000, color: "#FF4500" },
      { name: "Diamond", threshold: 1800, color: "#B9F2FF" },
      { name: "Platinum", threshold: 1600, color: "#00BFFF" },
      { name: "Gold", threshold: 1400, color: "#F2A900" },
      { name: "Silver", threshold: 1200, color: "#C0C0C0" },
      { name: "Bronze", threshold: 0, color: "#CD7F32" }
    ]
  });
  const [loading, setLoading] = useState(true);
  const [regionFilter, setRegionFilter] = useState("all");
  const [factionFilter, setFactionFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (regionFilter !== "all") params.append("region", regionFilter);
      if (factionFilter !== "all") params.append("faction", factionFilter);
      if (tierFilter !== "all") params.append("tier", tierFilter);

      const res = await api.get(`/leaderboard?${params.toString()}`);
      if (res.data) {
        if (Array.isArray(res.data)) {
          setPlayers(res.data);
        } else {
          setPlayers(res.data.players || []);
          if (res.data.season) setSeason(res.data.season);
        }
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    } finally {
      setLoading(false);
    }
  }, [regionFilter, factionFilter, tierFilter]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Find user's standing
  const userStanding = user ? players.find(p => p.nickname?.toLowerCase() === user.nickname?.toLowerCase()) : null;
  const userMMR = user?.matchmaking?.mmr || 1400;
  const userTier = user?.matchmaking?.tier || "Gold";
  const userDiv = user?.matchmaking?.division || "II";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header & Season Info */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F2A900]/10 border border-[#F2A900]/30 text-[#F2A900] text-xs font-head font-bold uppercase tracking-widest mb-4">
          <Calendar className="w-3.5 h-3.5" />
          Season {season.number} · {season.name} (Ends in {season.ends_in_days} Days)
        </div>
        <h1 className="text-4xl sm:text-6xl font-display font-black tracking-tight mb-4 flex items-center justify-center gap-3">
          <Trophy className="w-10 h-10 sm:w-14 h-14 text-[#F2A900] drop-shadow-[0_0_15px_rgba(242,169,0,0.6)]" />
          RANKED <span className="text-[#00BFFF]">LADDER</span>
        </h1>
        <p className="text-white/60 font-head text-base sm:text-lg max-w-2xl mx-auto">
          Ascend through the seasonal Elo tiers. Compete in 1v1 tactical arenas and secure your position among the realm's Grandmasters.
        </p>

        {/* Tier Milestones Strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {season.tiers.map((t) => (
            <div 
              key={t.name}
              onClick={() => setTierFilter(tierFilter === t.name ? "all" : t.name)}
              className={`cursor-pointer px-3.5 py-1.5 rounded-xl border transition-all text-xs font-head flex items-center gap-2 ${
                tierFilter === t.name 
                  ? 'bg-white/20 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)] scale-105' 
                  : 'bg-black/40 border-white/10 hover:border-white/30 text-white/70'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: t.color }}></span>
              <span className="font-bold text-white">{t.name}</span>
              <span className="text-white/40 text-[10px]">{t.threshold}+ MMR</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Current Standing Card */}
      {user && (
        <div className="mb-8 p-5 sm:p-6 rounded-2xl glass border border-[#00BFFF]/30 bg-gradient-to-r from-[#00BFFF]/10 via-black/40 to-[#F2A900]/10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-4">
            <img 
              src={user.avatar === 'default_avatar.png' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.nickname}` : user.avatar} 
              alt={user.nickname} 
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#00BFFF] shadow-[0_0_15px_rgba(0,191,255,0.4)]"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-display font-bold text-white">{user.nickname}</span>
                {getTierBadge(userTier, userDiv)}
              </div>
              <div className="text-sm font-head text-white/50 flex items-center gap-4 mt-1">
                <span>Faction: <strong className="text-white">{user.faction || "Unaligned"}</strong></span>
                {userStanding && <span>Global Standing: <strong className="text-[#F2A900]">#{userStanding.rank_num}</strong></span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8 text-center sm:text-right">
            <div>
              <div className="text-xs font-head uppercase tracking-wider text-white/40">Rating</div>
              <div className="text-3xl font-display font-black text-[#00BFFF] flex items-center justify-center sm:justify-end gap-1.5">
                <Swords className="w-5 h-5 opacity-80" />
                {userMMR}
              </div>
            </div>
            <div>
              <div className="text-xs font-head uppercase tracking-wider text-white/40">Record</div>
              <div className="text-base font-head font-bold text-white">
                {user.wins || 0}W - {user.losses || 0}L
              </div>
              <div className="text-xs text-[#22E07B] font-bold">
                {((user.wins || 0) + (user.losses || 0)) > 0 ? Math.round(((user.wins || 0) / ((user.wins || 0) + (user.losses || 0))) * 100) : 0}% Win Rate
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass rounded-2xl p-4 mb-6 border border-white/10 flex flex-wrap items-center justify-between gap-4">
        {/* Regions */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-white/50 ml-1" />
          <span className="text-xs font-head text-white/50 uppercase font-bold mr-1">Region:</span>
          {["all", "EU", "NA", "APAC"].map((reg) => (
            <button
              key={reg}
              onClick={() => setRegionFilter(reg)}
              className={`px-3 py-1.5 rounded-xl text-xs font-head font-bold transition-all ${
                regionFilter === reg 
                  ? "bg-[#00BFFF] text-black shadow-[0_0_10px_rgba(0,191,255,0.4)]" 
                  : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {reg === "all" ? "Global" : reg}
            </button>
          ))}
        </div>

        {/* Factions */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-head text-white/50 uppercase font-bold">Faction:</span>
          {["all", "Solari", "Umbri", "Aether", "Terra"].map((fac) => {
            const isSelected = factionFilter === fac;
            const fCfg = fac !== "all" ? factionCfg(fac) : null;
            return (
              <button
                key={fac}
                onClick={() => setFactionFilter(fac)}
                className={`px-3 py-1.5 rounded-xl text-xs font-head font-bold transition-all ${
                  isSelected 
                    ? "bg-white text-black shadow-md" 
                    : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                }`}
                style={isSelected && fCfg ? { backgroundColor: fCfg.color, color: "#000" } : {}}
              >
                {fac === "all" ? "All Factions" : fac}
              </button>
            );
          })}
        </div>

        {/* Tier Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/50" />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-head text-white outline-none focus:border-[#F2A900]"
          >
            <option value="all">All Tiers</option>
            <option value="Master">Master (2000+)</option>
            <option value="Diamond">Diamond (1800-1999)</option>
            <option value="Platinum">Platinum (1600-1799)</option>
            <option value="Gold">Gold (1400-1599)</option>
            <option value="Silver">Silver (1200-1399)</option>
            <option value="Bronze">Bronze (0-1199)</option>
          </select>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="glass rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/10 relative overflow-hidden">
        {loading ? (
          <div className="py-24 text-center text-white/50 animate-pulse font-head flex flex-col items-center">
            <Swords className="w-10 h-10 mb-3 animate-spin text-[#00BFFF]" />
            <p>Syncing ladder standings...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="py-24 text-center text-white/50 font-head flex flex-col items-center">
            <ShieldAlert className="w-12 h-12 mb-4 opacity-40 text-[#F2A900]" />
            <p className="text-lg text-white/80 font-bold mb-1">No Tacticians Found</p>
            <p className="text-sm">Try broadening your region, faction, or tier filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs font-head uppercase tracking-wider">
                  <th className="py-4 px-4 font-semibold">Rank</th>
                  <th className="py-4 px-4 font-semibold">Tactician</th>
                  <th className="py-4 px-4 font-semibold">Tier</th>
                  <th className="py-4 px-4 font-semibold">Faction</th>
                  <th className="py-4 px-4 font-semibold text-right">MMR</th>
                  <th className="py-4 px-4 font-semibold text-right">Ranked Record</th>
                  <th className="py-4 px-4 font-semibold text-center">Region</th>
                </tr>
              </thead>
              <tbody className="font-head text-sm">
                {players.map((player, index) => {
                  const pvpWins = player.wins || 0;
                  const pvpLosses = player.losses || 0;
                  const winRate = player.win_rate !== undefined 
                    ? player.win_rate 
                    : (pvpWins + pvpLosses > 0 ? Math.round((pvpWins / (pvpWins + pvpLosses)) * 100) : 0);
                  const isTop3 = index < 3;
                  const fCfg = factionCfg(player.faction);

                  return (
                    <tr 
                      key={player.nickname || index} 
                      className={`border-b border-white/5 hover:bg-white/5 transition-all ${
                        isTop3 ? 'bg-gradient-to-r from-[#F2A900]/10 via-transparent to-transparent' : ''
                      }`}
                    >
                      {/* Rank Position */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 font-display text-lg font-bold">
                          {index === 0 && <Crown className="w-6 h-6 text-[#F2A900] drop-shadow-[0_0_8px_rgba(242,169,0,0.8)]" />}
                          {index === 1 && <Medal className="w-6 h-6 text-[#C0C0C0]" />}
                          {index === 2 && <Medal className="w-6 h-6 text-[#CD7F32]" />}
                          <span className={isTop3 ? 'text-[#F2A900] font-black' : 'text-white/60'}>
                            #{player.rank_num || index + 1}
                          </span>
                        </div>
                      </td>

                      {/* Player Avatar & Nickname */}
                      <td className="py-4 px-4">
                        <Link to={`/profile/${player.nickname}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <img 
                            src={player.avatar === 'default_avatar.png' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.nickname}` : player.avatar} 
                            alt={player.nickname} 
                            className={`w-10 h-10 rounded-full object-cover border-2 ${
                              index === 0 
                                ? 'border-[#F2A900] shadow-[0_0_12px_rgba(242,169,0,0.6)]' 
                                : 'border-white/20'
                            }`}
                          />
                          <div>
                            <span className="font-bold text-white text-base block">{player.nickname}</span>
                          </div>
                        </Link>
                      </td>

                      {/* Tier Badge */}
                      <td className="py-4 px-4">
                        {getTierBadge(player.tier || "Bronze", player.division || "I")}
                      </td>

                      {/* Faction */}
                      <td className="py-4 px-4">
                        <span 
                          className="px-2.5 py-0.5 rounded-lg text-xs font-bold"
                          style={{
                            color: fCfg.color,
                            backgroundColor: `${fCfg.color}15`,
                            border: `1px solid ${fCfg.color}30`
                          }}
                        >
                          {player.faction || "Unaligned"}
                        </span>
                      </td>

                      {/* MMR Rating */}
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 font-display font-black text-[#00BFFF] text-lg">
                          <Swords className="w-4 h-4 opacity-75" />
                          {player.mmr || 1400}
                        </div>
                      </td>

                      {/* Record & Win Rate */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-white">{pvpWins}W - {pvpLosses}L</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#22E07B] rounded-full" 
                                style={{ width: `${winRate}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#22E07B] font-bold">{winRate}%</span>
                          </div>
                        </div>
                      </td>

                      {/* Region */}
                      <td className="py-4 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50 text-xs font-mono">
                          {player.region || "GL"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
