import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Trophy,
  Swords,
  Medal,
  ShieldAlert,
  Shield,
  Crown,
  Sparkles,
  Globe,
  Filter,
  Calendar,
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
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-head font-bold uppercase tracking-wider shrink-0"
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        color: cfg.color,
        borderWidth: 1,
      }}
    >
      <IconComponent className="w-3 h-3" />
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
      { name: "Bronze", threshold: 0, color: "#CD7F32" },
    ],
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

  const userStanding = user
    ? players.find((p) => p.nickname?.toLowerCase() === user.nickname?.toLowerCase())
    : null;
  const userMMR = user?.matchmaking?.mmr ?? 1400;
  const userTier = user?.matchmaking?.tier || "Gold";
  const userDiv = user?.matchmaking?.division || "II";
  const placementLeft = user?.matchmaking?.placement_games_left ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Header & Season Info */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F2A900]/10 border border-[#F2A900]/30 text-[#F2A900] text-[11px] font-head font-bold uppercase tracking-widest mb-3">
          <Calendar className="w-3.5 h-3.5" />
          Season {season.number} · {season.name} ({season.ends_in_days}d left)
        </div>
        <h1 className="text-3xl sm:text-6xl font-display font-black tracking-tight mb-3 flex items-center justify-center gap-2.5">
          <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-[#F2A900] drop-shadow-[0_0_15px_rgba(242,169,0,0.6)]" />
          RANKED <span className="text-[#00BFFF]">LADDER</span>
        </h1>
        <p className="text-white/60 font-head text-sm sm:text-base max-w-2xl mx-auto">
          Ascend the competitive Elo tiers in 1v1 Arena matches. New summoners calibrate across 10 placement matches.
        </p>

        {/* Tier Milestones Rail */}
        <div className="mt-5 flex items-center sm:justify-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {season.tiers.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setTierFilter(tierFilter === t.name ? "all" : t.name)}
              className={`shrink-0 px-3 py-1.5 rounded-xl border transition-all text-xs font-head flex items-center gap-2 ${
                tierFilter === t.name
                  ? "bg-white/20 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  : "bg-black/40 border-white/10 hover:border-white/30 text-white/70"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="font-bold text-white">{t.name}</span>
              <span className="text-white/40 text-[10px]">{t.threshold}+</span>
            </button>
          ))}
        </div>
      </div>

      {/* User Current Standing Card */}
      {user && (
        <div className="mb-6 p-4 sm:p-6 rounded-2xl glass border border-[#00BFFF]/30 bg-gradient-to-r from-[#00BFFF]/10 via-black/40 to-[#F2A900]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-3.5">
            <img
              src={
                user.avatar === "default_avatar.png" || !user.avatar
                  ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.nickname}`
                  : user.avatar
              }
              alt={user.nickname}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-[#00BFFF]"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg sm:text-xl font-display font-bold text-white truncate">
                  {user.nickname}
                </span>
                {getTierBadge(userTier, userDiv)}
              </div>
              <div className="text-xs font-head text-white/55 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span>
                  Faction: <strong className="text-white">{user.faction || "Unaligned"}</strong>
                </span>
                {userStanding && (
                  <span>
                    Standing: <strong className="text-[#F2A900]">#{userStanding.rank_num}</strong>
                  </span>
                )}
                {placementLeft > 0 && (
                  <span className="text-[#00BFFF] font-semibold">
                    {placementLeft} placement left
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-around sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/10">
            <div>
              <div className="text-[10px] font-head uppercase tracking-wider text-white/40">Rating</div>
              <div className="text-2xl sm:text-3xl font-num font-black text-[#00BFFF] flex items-center gap-1.5">
                <Swords className="w-4 h-4 opacity-80" />
                {userMMR}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-head uppercase tracking-wider text-white/40">Record</div>
              <div className="text-sm sm:text-base font-head font-bold text-white">
                {user.wins || 0}W – {user.losses || 0}L
              </div>
            </div>
            <Link
              to="/play"
              className="px-4 py-2.5 rounded-xl bg-[#F2A900] text-black font-head font-bold text-xs shrink-0"
            >
              Queue Now
            </Link>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass rounded-2xl p-3.5 mb-5 border border-white/10 space-y-2.5 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <Globe className="w-4 h-4 text-white/45 shrink-0" />
          {["all", "EU", "NA", "APAC"].map((reg) => (
            <button
              key={reg}
              onClick={() => setRegionFilter(reg)}
              className={`px-3 py-1.5 rounded-xl text-xs font-head font-bold shrink-0 transition-all ${
                regionFilter === reg
                  ? "bg-[#00BFFF] text-black"
                  : "bg-white/5 text-white/60 hover:text-white"
              }`}
            >
              {reg === "all" ? "Global" : reg}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {["all", "Solari", "Umbri", "Aether", "Terra"].map((fac) => {
            const isSelected = factionFilter === fac;
            const fCfg = fac !== "all" ? factionCfg(fac) : null;
            return (
              <button
                key={fac}
                onClick={() => setFactionFilter(fac)}
                className={`px-3 py-1.5 rounded-xl text-xs font-head font-bold shrink-0 transition-all ${
                  isSelected ? "bg-white text-black" : "bg-white/5 text-white/60 hover:text-white"
                }`}
                style={isSelected && fCfg ? { backgroundColor: fCfg.color, color: "#000" } : {}}
              >
                {fac === "all" ? "All Factions" : fac}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/45 shrink-0" />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="flex-1 md:flex-initial bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-head text-white outline-none focus:border-[#F2A900]"
          >
            <option value="all">All Tiers</option>
            <option value="Master">Master (2000+)</option>
            <option value="Diamond">Diamond (1800–1999)</option>
            <option value="Platinum">Platinum (1600–1799)</option>
            <option value="Gold">Gold (1400–1599)</option>
            <option value="Silver">Silver (1200–1399)</option>
            <option value="Bronze">Bronze (0–1199)</option>
          </select>
        </div>
      </div>

      {/* Standings Container */}
      <div className="glass rounded-3xl p-3 sm:p-6 shadow-2xl border border-white/10">
        {loading ? (
          <div className="py-20 text-center text-white/50 animate-pulse font-head flex flex-col items-center">
            <Swords className="w-9 h-9 mb-3 animate-spin text-[#00BFFF]" />
            <p className="text-sm">Syncing ladder standings…</p>
          </div>
        ) : players.length === 0 ? (
          <div className="py-20 text-center text-white/50 font-head flex flex-col items-center">
            <ShieldAlert className="w-10 h-10 mb-3 opacity-40 text-[#F2A900]" />
            <p className="text-base text-white/80 font-bold mb-1">No Tacticians Found</p>
            <p className="text-xs">Try broadening your region, faction, or tier filters.</p>
          </div>
        ) : (
          <>
            {/* Mobile Player Cards (< md) */}
            <div className="md:hidden space-y-2.5">
              {players.map((player, index) => {
                const pvpWins = player.wins || 0;
                const pvpLosses = player.losses || 0;
                const winRate =
                  player.win_rate !== undefined
                    ? player.win_rate
                    : pvpWins + pvpLosses > 0
                    ? Math.round((pvpWins / (pvpWins + pvpLosses)) * 100)
                    : 0;
                const isTop3 = index < 3;
                const fCfg = factionCfg(player.faction);

                return (
                  <Link
                    key={player.nickname || index}
                    to={`/profile/${player.nickname}`}
                    className={`block rounded-2xl p-3.5 border transition-colors ${
                      isTop3
                        ? "bg-gradient-to-r from-[#F2A900]/12 to-white/[0.02] border-[#F2A900]/30"
                        : "bg-white/[0.03] border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`font-display text-base font-black w-7 shrink-0 ${
                            isTop3 ? "text-[#F2A900]" : "text-white/55"
                          }`}
                        >
                          #{player.rank_num || index + 1}
                        </span>
                        <img
                          src={
                            player.avatar === "default_avatar.png" || !player.avatar
                              ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.nickname}`
                              : player.avatar
                          }
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-head font-bold text-sm text-white truncate">
                            {player.nickname}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {getTierBadge(player.tier || "Bronze", player.division || "I")}
                            <span
                              className="text-[10px] font-head font-bold"
                              style={{ color: fCfg.color }}
                            >
                              {player.faction || "Unaligned"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-num text-lg font-bold text-[#00BFFF]">
                          {player.mmr || 1400}
                        </div>
                        <div className="text-[11px] font-head text-white/55">
                          {pvpWins}W–{pvpLosses}L ({winRate}%)
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop Table (md+) */}
            <div className="hidden md:block overflow-x-auto">
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
                    const winRate =
                      player.win_rate !== undefined
                        ? player.win_rate
                        : pvpWins + pvpLosses > 0
                        ? Math.round((pvpWins / (pvpWins + pvpLosses)) * 100)
                        : 0;
                    const isTop3 = index < 3;
                    const fCfg = factionCfg(player.faction);

                    return (
                      <tr
                        key={player.nickname || index}
                        className={`border-b border-white/5 hover:bg-white/5 transition-all ${
                          isTop3 ? "bg-gradient-to-r from-[#F2A900]/10 via-transparent to-transparent" : ""
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 font-display text-lg font-bold">
                            {index === 0 && <Crown className="w-5 h-5 text-[#F2A900]" />}
                            {index === 1 && <Medal className="w-5 h-5 text-[#C0C0C0]" />}
                            {index === 2 && <Medal className="w-5 h-5 text-[#CD7F32]" />}
                            <span className={isTop3 ? "text-[#F2A900] font-black" : "text-white/60"}>
                              #{player.rank_num || index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Link
                            to={`/profile/${player.nickname}`}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                          >
                            <img
                              src={
                                player.avatar === "default_avatar.png" || !player.avatar
                                  ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.nickname}`
                                  : player.avatar
                              }
                              alt={player.nickname}
                              className="w-10 h-10 rounded-full object-cover border border-white/20"
                            />
                            <span className="font-bold text-white text-base">{player.nickname}</span>
                          </Link>
                        </td>
                        <td className="py-4 px-4">
                          {getTierBadge(player.tier || "Bronze", player.division || "I")}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className="px-2.5 py-0.5 rounded-lg text-xs font-bold"
                            style={{
                              color: fCfg.color,
                              backgroundColor: `${fCfg.color}15`,
                              border: `1px solid ${fCfg.color}30`,
                            }}
                          >
                            {player.faction || "Unaligned"}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-num font-bold text-[#00BFFF] text-lg">
                          {player.mmr || 1400}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-bold text-white">
                            {pvpWins}W – {pvpLosses}L
                          </span>
                          <span className="ml-2 text-xs text-[#22E07B] font-bold">({winRate}%)</span>
                        </td>
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
          </>
        )}
      </div>
    </div>
  );
}
