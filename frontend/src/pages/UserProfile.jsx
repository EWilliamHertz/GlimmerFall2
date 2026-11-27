import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Activity, Crosshair, Medal, Play, ArrowLeft } from "lucide-react";

export default function UserProfile() {
  const { nickname } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/users/${nickname}`)
      .then((res) => {
        setProfile(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [nickname]);

  if (loading) {
    return <div className="py-28 text-center text-white/50 font-head">Loading profile…</div>;
  }

  if (!profile) {
    return (
      <div className="py-28 text-center text-white/50 font-head px-4">
        <h2 className="text-2xl font-bold font-display text-white mb-4">Summoner not found</h2>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 bg-[#F2A900] text-black font-bold rounded-xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  const winRate =
    profile.wins + profile.losses > 0
      ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
      : 0;
  const placementLeft = profile.matchmaking?.placement_games_left ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-head text-white/55 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6 bg-black/40 p-5 sm:p-6 rounded-3xl border border-white/10 mb-6 text-center sm:text-left">
        <img
          src={
            profile.avatar === "default_avatar.png" || !profile.avatar
              ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.nickname}`
              : profile.avatar
          }
          alt="Avatar"
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-[#F2A900] shadow-lg object-cover"
        />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">{profile.nickname}</h1>
          <p className="text-white/60 font-head text-sm mt-1">
            Faction:{" "}
            <span className="text-[#F2A900] font-semibold">{profile.faction || "Unaligned"}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div className="glass-strong p-5 sm:p-6 rounded-2xl border border-[#9B30FF]/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-[#9B30FF]">
            <Activity className="w-16 h-16 sm:w-24 sm:h-24" />
          </div>
          <h3 className="text-xs uppercase tracking-widest text-white/50 font-bold mb-1">Win Rate</h3>
          <p className="text-2xl sm:text-4xl font-num font-black">{winRate}%</p>
          <p className="text-white/60 text-xs sm:text-sm mt-1 font-head">
            {profile.wins || 0}W – {profile.losses || 0}L
          </p>
        </div>

        <div className="glass-strong p-5 sm:p-6 rounded-2xl border border-[#F2A900]/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-[#F2A900]">
            <Crosshair className="w-16 h-16 sm:w-24 sm:h-24" />
          </div>
          <h3 className="text-xs uppercase tracking-widest text-white/50 font-bold mb-1">Ranked</h3>
          <p
            className="text-xl sm:text-3xl font-display font-black"
            style={{ color: profile.matchmaking?.color || "#F2A900" }}
          >
            {profile.matchmaking?.rank || "Gold II"}
          </p>
          <p className="text-white/60 text-xs sm:text-sm mt-1 font-head">
            {profile.matchmaking?.mmr || 1400} MMR
            {placementLeft > 0 ? ` · ${placementLeft} placement left` : ""}
          </p>
        </div>
      </div>

      {(profile.badges || []).length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-bold mb-3 text-white/80">Achievements</h3>
          <div className="flex flex-wrap gap-2.5">
            {profile.badges.map((badge, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-gradient-to-br from-[#9B30FF]/20 to-[#F2A900]/20 border border-white/10 px-3.5 py-1.5 rounded-full font-head text-xs font-bold text-white/90"
              >
                <Medal className="w-3.5 h-3.5 text-[#F2A900]" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.matchHistory && profile.matchHistory.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-lg font-bold mb-3 text-white/80">Recent Matches</h3>
          <div className="flex flex-col gap-2.5">
            {profile.matchHistory.map((match, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-black/30 border border-white/5 p-3.5 rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs uppercase tracking-wider ${
                      match.result === "Win"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {match.result}
                  </span>
                  <div className="text-sm font-head">
                    <span className="text-white/45">vs</span>{" "}
                    <span className="font-bold text-white">{match.opponent}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span className="text-white/35 text-xs font-head">
                    {match.date ? new Date(match.date).toLocaleDateString() : ""}
                  </span>
                  <button
                    onClick={() => navigate(`/play?replayId=${match.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-head font-bold transition-colors"
                  >
                    <Play className="w-3 h-3 fill-current" /> Replay
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
