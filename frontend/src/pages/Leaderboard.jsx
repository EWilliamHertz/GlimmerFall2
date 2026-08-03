import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Trophy, Swords, Medal, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

export default function Leaderboard() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await api.get("/leaderboard");
        setPlayers(res.data);
      } catch (err) {
        console.error("Failed to fetch leaderboard", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-display font-black mb-4 flex items-center justify-center gap-4">
          <Trophy className="w-12 h-12 text-[#F2A900]" />
          GLOBAL <span className="text-[#00BFFF]">LEADERBOARD</span>
        </h1>
        <p className="text-white/60 font-head text-lg max-w-2xl mx-auto">
          The top 100 tacticians in the GlimmerFall arena. Prove your worth and claim your spot among the legends.
        </p>
      </div>

      <div className="glass rounded-3xl p-6 shadow-2xl border border-white/10 relative overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-white/50 animate-pulse font-head">
            Loading ranks...
          </div>
        ) : players.length === 0 ? (
          <div className="py-20 text-center text-white/50 font-head flex flex-col items-center">
            <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
            <p>No players found. The arena awaits its first challengers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-sm font-head uppercase tracking-wider">
                  <th className="py-4 px-4 font-medium">Rank</th>
                  <th className="py-4 px-4 font-medium">Player</th>
                  <th className="py-4 px-4 font-medium">Faction</th>
                  <th className="py-4 px-4 font-medium text-right">MMR</th>
                  <th className="py-4 px-4 font-medium text-right">Win/Loss</th>
                </tr>
              </thead>
              <tbody className="font-head">
                {players.map((player, index) => {
                  const winRate = (player.wins + player.losses) > 0 
                    ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                    : 0;

                  return (
                    <tr 
                      key={player.id || index} 
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index < 3 ? 'bg-gradient-to-r from-[#F2A900]/10 to-transparent' : ''}`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 font-display text-xl font-bold">
                          {index === 0 && <Medal className="w-6 h-6 text-[#F2A900]" />}
                          {index === 1 && <Medal className="w-6 h-6 text-[#C0C0C0]" />}
                          {index === 2 && <Medal className="w-6 h-6 text-[#CD7F32]" />}
                          <span className={index < 3 ? 'text-[#F2A900]' : 'text-white/60'}>
                            #{index + 1}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Link to={`/profile/${player.nickname}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                          <img 
                            src={player.avatar === 'default_avatar.png' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.nickname}` : player.avatar} 
                            alt={player.nickname} 
                            className={`w-12 h-12 rounded-full object-cover border-2 ${index === 0 ? 'border-[#F2A900] shadow-[0_0_10px_rgba(242,169,0,0.5)]' : 'border-white/20'}`}
                          />
                          <span className="font-bold text-lg">{player.nickname}</span>
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-white/70">
                        {player.faction || "Unaligned"}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2 font-black text-[#00BFFF] text-xl">
                          <Swords className="w-5 h-5 opacity-70" />
                          {player.mmr || 1200}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold">{player.wins}W - {player.losses}L</span>
                          <span className="text-sm text-[#22E07B]">{winRate}% Win Rate</span>
                        </div>
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
