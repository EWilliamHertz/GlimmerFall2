import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, useSearchParams } from 'react-router-dom';
import { LogOut, Users, Crosshair, Package, Activity, ShieldAlert, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

export default function Dashboard() {
  const { user, logout, verify, resendVerification } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('verify');
    if (token) {
      verify(token);
      searchParams.delete('verify');
      setSearchParams(searchParams);
    }
  }, [searchParams, verify, setSearchParams]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-display font-black flex items-center gap-3">
            Welcome, <span className="text-[#F2A900]">{user.nickname}</span>
            {user.isVerified && <CheckCircle className="w-6 h-6 text-[#22E07B]" />}
          </h1>
          <p className="text-white/60 font-head mt-2 text-lg flex items-center flex-wrap gap-2">
            <span>{user.isAdmin ? "System Administrator Access" : "Founder & Alpha Tester"}</span>
            {!user.isVerified && (
              <span className="text-red-400 flex items-center gap-2">
                (Unverified Email)
                <button 
                  onClick={() => resendVerification(user.email)} 
                  className="text-xs bg-red-500/20 hover:bg-red-500/40 px-2.5 py-1 rounded-md text-red-300 transition-colors border border-red-500/30"
                >
                  Resend Mail
                </button>
              </span>
            )}
          </p>
        </div>
        <button onClick={logout} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors shadow-sm">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {user.isAdmin && (
        <div className="mb-12">
          <AdminPanel />
        </div>
      )}
      
      <PlayerDashboard user={user} />
    </div>
  );
}

function PlayerDashboard({ user }) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="glass-strong p-6 rounded-2xl border border-[#F2A900]/30 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-[#F2A900]"><Crosshair className="w-24 h-24" /></div>
        <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">Matchmaking</h3>
        <p className="text-4xl font-black">{user.matchmaking?.rank || "Unranked"}</p>
        <p className="text-white/60 mt-1">MMR: {user.matchmaking?.mmr || 1200}</p>
      </div>
      
      <div className="glass-strong p-6 rounded-2xl border border-[#00BFFF]/30 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-[#00BFFF]"><Package className="w-24 h-24" /></div>
        <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">My Bookings</h3>
        <p className="text-4xl font-black">{user.bookings || 0}</p>
        <p className="text-white/60 mt-1">First Edition Boxes Pre-ordered</p>
      </div>

      <div className="glass-strong p-6 rounded-2xl border border-[#22E07B]/30 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-[#22E07B]"><Users className="w-24 h-24" /></div>
        <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">Referrals</h3>
        <p className="text-4xl font-black">{user.referrals || 0}</p>
        <p className="text-white/60 mt-1">Friends Invited</p>
      </div>
    </div>
  );
}

function AdminPanel() {
  const [stats, setStats] = useState({ registered_gamers: 0, active_matches: 0, total_preorders: 0, gross_revenue: 0 });

  useEffect(() => {
    api.get("/admin/stats").then(res => setStats(res.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 font-bold uppercase tracking-wider mb-2 border border-red-500/30">
        <ShieldAlert className="w-5 h-5" /> Admin Panel Active
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass p-6 rounded-2xl border border-white/10 shadow-lg">
          <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-3">
            <Activity className="w-5 h-5 text-[#F2A900]" /> Global Analytics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-white/60">Total Registered Gamers</span>
              <span className="font-bold text-lg">{stats.registered_gamers}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-white/60">Active Matches (Live)</span>
              <span className="font-bold text-lg text-[#22E07B]">{stats.active_matches}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-white/60">Total Server Uptime</span>
              <span className="font-bold text-lg text-[#22E07B]">100%</span>
            </div>
          </div>
        </div>

        <div className="glass p-6 rounded-2xl border border-white/10 shadow-lg">
          <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-3">
            <Package className="w-5 h-5 text-[#00BFFF]" /> Booster Box Bookings
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-white/60">Total Pre-orders</span>
              <span className="font-bold text-lg text-[#00BFFF]">{stats.total_preorders} / 500</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/5">
              <span className="text-white/60">Gross Revenue</span>
              <span className="font-bold text-lg">${stats.gross_revenue}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-white/60">Pending Fulfillment</span>
              <span className="font-bold text-lg">{stats.total_preorders}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
