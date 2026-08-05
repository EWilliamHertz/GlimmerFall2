import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Activity, Crosshair, Users, Trophy, Medal, Play } from "lucide-react";
import { motion } from "framer-motion";

export default function UserProfile() {
  const { nickname } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/users/${nickname}`)
      .then(res => {
        setProfile(res.data);
        setLoading(false);
      })
      .catch(e => {
        setLoading(false);
      });
  }, [nickname]);

  if (loading) {
    return <div className="py-32 text-center text-white/50 font-head">Loading profile...</div>;
  }

  if (!profile) {
    return (
      <div className="py-32 text-center text-white/50 font-head">
        <h2 className="text-2xl font-bold font-display text-white mb-4">User not found</h2>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#F2A900] text-black font-bold rounded-xl">Go Back</button>
      </div>
    );
  }

  const winRate = (profile.wins + profile.losses) > 0 ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-6 bg-black/40 p-6 rounded-3xl border border-white/10 mb-8">
        <img 
          src={profile.avatar === 'default_avatar.png' || !profile.avatar ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.nickname}` : profile.avatar} 
          alt="Avatar" 
          className="w-24 h-24 rounded-full border-4 border-[#F2A900] shadow-lg object-cover" 
        />
        <div>
          <h2 className="text-3xl font-bold font-display text-white">{profile.nickname}</h2>
          <p className="text-white/60 font-head text-sm mt-1">
            Faction: <span className="text-[#F2A900] font-semibold">{profile.faction || "None"}</span>
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-strong p-6 rounded-2xl border border-[#9B30FF]/30 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-[#9B30FF]"><Activity className="w-24 h-24" /></div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">Win Rate</h3>
          <p className="text-4xl font-black">{winRate}%</p>
          <p className="text-white/60 mt-1">{profile.wins || 0}W - {profile.losses || 0}L</p>
        </div>

        <div className="glass-strong p-6 rounded-2xl border border-[#F2A900]/30 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-[#F2A900]"><Crosshair className="w-24 h-24" /></div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">Matchmaking</h3>
          <p className="text-3xl font-black">{profile.matchmaking?.rank || "Unranked"}</p>
          <p className="text-white/60 mt-1">MMR: {profile.matchmaking?.mmr || 1200}</p>
        </div>
      </div>

      {(profile.badges || []).length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-xl font-bold mb-4 text-white/80">Achievements</h3>
          <div className="flex flex-wrap gap-3">
            {profile.badges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gradient-to-br from-[#9B30FF]/20 to-[#F2A900]/20 border border-white/10 px-4 py-2 rounded-full font-head text-sm font-bold text-white/90 shadow-lg shadow-black/50">
                <Medal className="w-4 h-4 text-[#F2A900]" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.matchHistory && profile.matchHistory.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-xl font-bold mb-4 text-white/80">Recent Matches</h3>
          <div className="flex flex-col gap-3">
            {profile.matchHistory.map((match, idx) => (
              <div key={idx} className="flex justify-between items-center bg-black/30 border border-white/5 p-4 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded font-bold text-xs uppercase tracking-wider ${match.result === 'Win' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {match.result}
                  </div>
                  <div>
                    <span className="text-white/50 text-sm">vs</span>
                    <span className="ml-2 font-bold font-head text-white/90">{match.opponent}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-white/30 text-xs font-head">
                    {match.date ? new Date(match.date).toLocaleDateString() : 'Unknown Date'}
                  </div>
                  <button
                    onClick={() => navigate(`/play?replayId=${match.id}`)}
                    className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-bold transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    WATCH REPLAY
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
