import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, useSearchParams, Link } from 'react-router-dom';
import { LogOut, Users, Crosshair, Package, Activity, ShieldAlert, CheckCircle, TrendingUp, Store, Plus, Save, Edit, Settings, X, Crown, ListOrdered, Link as LinkIcon, Vote, Target, History, UserPlus, Check, Clock, Gift, Swords, Medal, Play, Eye, Sparkles, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const { user, logout, verify, resendVerification, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(user?.isAdmin ? 'admin' : 'player');

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
        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('player')} 
            className={`px-6 py-2.5 rounded-xl font-bold transition-colors shadow-sm ${activeTab === 'player' ? 'bg-[#F2A900] text-black' : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/5'}`}
          >
            Player Profile
          </button>
          <button 
            onClick={() => setActiveTab('admin')} 
            className={`px-6 py-2.5 rounded-xl font-bold transition-colors shadow-sm flex items-center gap-2 ${activeTab === 'admin' ? 'bg-red-500 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/5'}`}
          >
            <ShieldAlert className="w-4 h-4" /> Admin Panel
          </button>
        </div>
      )}

      {user.isAdmin && activeTab === 'admin' ? (
        <div className="mb-12">
          <AdminPanel user={user} />
        </div>
      ) : (
        <PlayerDashboard user={user} updateUser={updateUser} />
      )}
    </div>
  );
}

function PlayerDashboard({ user, updateUser }) {
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatars, setAvatars] = useState([]);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [quests, setQuests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendInput, setFriendInput] = useState("");
  const [referralInfo, setReferralInfo] = useState(null);

  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    api.get("/auth/me/quests").then(res => {
      setQuests(res.data);
      res.data.forEach(q => {
        if (q.is_completed && !q.reward_claimed) {
          toast(`Quest Completed: ${q.description}`, { icon: '🎯' });
        }
      });
    }).catch(console.error);
    api.get("/auth/me/matches").then(res => setMatches(res.data)).catch(console.error);
    api.get("/auth/me/friends").then(res => setFriends(res.data)).catch(console.error);
    api.get("/auth/me/referral").then(res => setReferralInfo(res.data)).catch(() => {});
    api.get("/auth/me/inventory").then(res => setInventory(res.data)).catch(() => {});
  }, []);

  const claimQuest = async (qid) => {
    try {
      const res = await api.post(`/quests/${qid}/claim`);
      let msg = [];
      if (res.data.credited > 0) msg.push(`+${res.data.credited} Glimmer`);
      if (res.data.credited_items?.length) msg.push(res.data.credited_items.join(", "));
      toast.success(`Claimed: ${msg.join(" and ")}!`);
      // refresh quests
      const r = await api.get("/auth/me/quests");
      setQuests(r.data);
      if (updateUser) updateUser({ glimmer_balance: res.data.balance });
      // refresh inventory
      const invRes = await api.get("/auth/me/inventory");
      setInventory(invRes.data);
      // ping navbar widget to refresh
      window.dispatchEvent(new CustomEvent("gf-glimmer-changed"));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to claim");
    }
  };

  const copyReferralLink = async () => {
    if (!referralInfo?.referral_code && !user?.referral_code) return;
    const code = referralInfo?.referral_code || user?.referral_code;
    const url = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Referral link copied!");
    } catch (e) {
      toast.error("Copy failed - link: " + url);
    }
  };

  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    if (!friendInput.trim()) return;
    try {
      await api.post("/auth/me/friends/request", { nickname: friendInput.trim() });
      setFriendInput("");
      api.get("/auth/me/friends").then(res => setFriends(res.data)).catch(console.error);
    } catch(err) {
      alert("Failed to send friend request: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleAcceptFriend = async (id) => {
    try {
      await api.post(`/auth/me/friends/${id}/accept`);
      api.get("/auth/me/friends").then(res => setFriends(res.data)).catch(console.error);
    } catch(err) {
      alert("Failed to accept friend: " + (err.response?.data?.detail || err.message));
    }
  };

  useEffect(() => {
    if (showAvatarModal && avatars.length === 0) {
      api.get("/cards").then(res => {
        const withImages = res.data.filter(c => c.image_url);
        // Take a unique set of images (up to 24)
        const unique = [];
        const seen = new Set();
        for(const c of withImages) {
            if(!seen.has(c.image_url)) {
                seen.add(c.image_url);
                unique.push(c);
            }
            if(unique.length >= 24) break;
        }
        setAvatars(unique);
      });
    }
  }, [showAvatarModal, avatars.length]);

  const selectAvatar = async (url) => {
    setSavingAvatar(true);
    try {
      await api.put("/auth/me/avatar", { avatar_url: url });
      updateUser({ avatar: url });
      setShowAvatarModal(false);
    } catch(e) {
      console.error(e);
    }
    setSavingAvatar(false);
  };

  const winRate = (user.wins + user.losses) > 0 ? Math.round((user.wins / (user.wins + user.losses)) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-6 bg-black/40 p-6 rounded-3xl border border-white/10">
        <div className="relative group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
          <img 
            src={user.avatar === 'default_avatar.png' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.nickname}` : user.avatar} 
            alt="Avatar" 
            className="w-24 h-24 rounded-full border-4 border-[#F2A900] shadow-lg object-cover transition-transform group-hover:scale-105" 
          />
          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs font-bold text-[#F2A900] uppercase tracking-wider">Change</span>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold font-display text-white">{user.nickname}</h2>
          <p className="text-white/60 font-head text-sm mt-1">
            Faction: <span className="text-[#F2A900] font-semibold">{user.faction || "None"}</span>
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <div className="glass-strong p-6 rounded-2xl border border-[#9B30FF]/30 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-[#9B30FF]"><Activity className="w-24 h-24" /></div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">Win Rate</h3>
          <p className="text-4xl font-black">{winRate}%</p>
          <p className="text-white/60 mt-1">{user.wins || 0}W - {user.losses || 0}L</p>
        </div>

        <div className="glass-strong p-6 rounded-2xl border border-[#F2A900]/30 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-[#F2A900]"><Crosshair className="w-24 h-24" /></div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">Matchmaking</h3>
          <p className="text-3xl font-black">{user.matchmaking?.rank || "Unranked"}</p>
          <p className="text-white/60 mt-1">MMR: {user.matchmaking?.mmr || 1200}</p>
        </div>
        
        <div className="glass-strong p-6 rounded-2xl border border-[#00BFFF]/30 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-[#00BFFF]"><Package className="w-24 h-24" /></div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">My Bookings</h3>
          <p className="text-4xl font-black">{user.bookings || 0}</p>
          <p className="text-white/60 mt-1">Booster Boxes</p>
        </div>

        <div className="glass-strong p-6 rounded-2xl border border-[#22E07B]/30 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-[#22E07B]"><Users className="w-24 h-24" /></div>
          <h3 className="text-sm uppercase tracking-widest text-white/50 font-bold mb-2">Referrals</h3>
          <p className="text-4xl font-black">{user.referrals || 0}</p>
          <p className="text-white/60 mt-1">Friends Invited</p>
        </div>
      </div>

      {(user.badges || []).length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-xl font-bold mb-4 text-white/80">Achievements</h3>
          <div className="flex flex-wrap gap-3">
            {user.badges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gradient-to-br from-[#9B30FF]/20 to-[#F2A900]/20 border border-white/10 px-4 py-2 rounded-full font-head text-sm font-bold text-white/90 shadow-lg shadow-black/50">
                <Medal className="w-4 h-4 text-[#F2A900]" />
                {badge}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 mt-8">
        <div className="glass-strong p-6 rounded-3xl border border-[#00BFFF]/25 shadow-xl flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10"><Sparkles className="w-32 h-32 text-[#00BFFF]" /></div>
          <h3 className="font-display text-2xl font-bold flex items-center gap-2 mb-4 text-[#00BFFF] relative z-10">
            <Sparkles className="w-6 h-6" /> Your Referral Link
          </h3>
          <p className="text-white/60 font-head text-sm mb-4 relative z-10 leading-relaxed">
            Share this link. When a friend registers <span className="text-white">and verifies their email</span>, you earn <span className="text-[#F2A900] font-bold">100 Glimmer</span> and they get <span className="text-[#F2A900] font-bold">50 Glimmer</span>.
          </p>
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <code
              data-testid="referral-link"
              className="flex-1 truncate text-xs font-mono text-[#F2A900] bg-black/50 rounded-lg px-3 py-2.5 border border-[#F2A900]/25"
            >
              {(referralInfo?.referral_code || user?.referral_code)
                ? `${window.location.origin}/?ref=${referralInfo?.referral_code || user?.referral_code}`
                : "Loading..."}
            </code>
            <button
              onClick={copyReferralLink}
              data-testid="copy-referral-btn"
              className="px-3 py-2.5 rounded-lg bg-[#F2A900]/20 text-[#F2A900] hover:bg-[#F2A900]/30 font-head text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-auto relative z-10">
            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 font-head uppercase tracking-widest">Verified</div>
              <div className="font-num text-2xl font-bold text-white">{referralInfo?.verified_referrals ?? 0}</div>
            </div>
            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 font-head uppercase tracking-widest">Total Invited</div>
              <div className="font-num text-2xl font-bold text-white">{referralInfo?.referrals ?? user?.referrals ?? 0}</div>
            </div>
            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
              <div className="text-[10px] text-white/40 font-head uppercase tracking-widest">Glimmer</div>
              <div className="font-num text-2xl font-bold text-[#7FDBFF]">{referralInfo?.glimmer_from_referrals ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="glass-strong p-6 rounded-3xl border border-white/10 shadow-xl flex flex-col">
          <h3 className="font-display text-2xl font-bold flex items-center gap-2 mb-6 text-[#F2A900]">
            <Target className="w-6 h-6" /> Daily Quests
          </h3>
          <div className="space-y-4 flex-1">
            {quests.length === 0 ? (
              <p className="text-white/50 italic font-head">No active quests.</p>
            ) : (
              quests.map(q => {
                const progress = Math.min((q.current_value / q.target_value) * 100, 100);
                const canClaim = q.is_completed && !q.reward_claimed;
                return (
                  <div key={q.id} className="bg-black/40 border border-white/10 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white uppercase tracking-wider text-sm">{q.description}</h4>
                        <p className="text-sm text-white/50 font-head mt-1">Reward: <span className="text-[#00BFFF] font-bold">{q.reward}</span></p>
                      </div>
                      {q.reward_claimed ? (
                        <span className="text-[10px] font-head uppercase tracking-widest text-white/40 shrink-0">Claimed</span>
                      ) : canClaim ? (
                        <button
                          onClick={() => claimQuest(q.id)}
                          data-testid={`claim-quest-${q.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F2A900] text-black text-xs font-head font-bold hover:bg-[#ffc21f] shadow-[0_0_15px_rgba(242,169,0,0.4)] shrink-0"
                        >
                          <Sparkles className="w-3 h-3" /> Claim Reward
                        </button>
                      ) : progress >= 100 ? (
                        <CheckCircle className="w-5 h-5 text-[#22E07B] shrink-0" />
                      ) : null}
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2.5 mb-1 mt-3">
                      <div className="bg-[#F2A900] h-2.5 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(242,169,0,0.5)]" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="text-right text-xs text-white/50 font-head mt-2">
                      {q.current_value} / {q.target_value}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {inventory.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <h4 className="font-display text-xl font-bold flex items-center gap-2 mb-4 text-[#F2A900]">
                 Inventory
              </h4>
              <div className="flex flex-wrap gap-3">
                {inventory.map((item, idx) => (
                  <div key={idx} className="bg-black/40 border border-[#F2A900]/30 rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg">
                    <span className="text-[#F2A900] font-num text-xl font-bold">{item.quantity}x</span>
                    <span className="text-white font-head font-bold">{item.item_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="glass-strong p-6 rounded-3xl border border-white/10 shadow-xl flex flex-col">
          <h3 className="font-display text-2xl font-bold flex items-center gap-2 mb-6 text-[#00BFFF]">
            <History className="w-6 h-6" /> Match History
          </h3>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
            {matches.length === 0 ? (
              <p className="text-white/50 italic font-head">No recent matches.</p>
            ) : (
              matches.map(m => {
                const isPlayer1 = m.player1 === user.nickname;
                const opponent = isPlayer1 ? m.player2 : m.player1;
                const isWin = (m.winner === "1" && isPlayer1) || (m.winner === "2" && !isPlayer1);
                
                return (
                  <div key={m.id} className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-white/90">vs {opponent || 'AI / Unknown'}</span>
                      <span className="text-xs text-white/50 font-head flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" /> {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold ${isWin ? 'bg-[#22E07B]/20 text-[#22E07B]' : 'bg-red-500/20 text-red-400'}`}>
                        {isWin ? 'VICTORY' : 'DEFEAT'}
                      </span>
                      <a href={`/play?replayId=${m.id}`} className="text-[#00BFFF] hover:text-white transition-colors bg-[#00BFFF]/10 hover:bg-[#00BFFF]/30 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 border border-[#00BFFF]/30">
                        <Play className="w-3 h-3" /> Replay
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="glass-strong p-6 rounded-3xl border border-white/10 shadow-xl flex flex-col md:col-span-2">
          <h3 className="font-display text-2xl font-bold flex items-center gap-2 mb-6 text-[#9B30FF]">
            <Users className="w-6 h-6" /> Friends List
          </h3>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div>
                <h4 className="font-head text-sm uppercase tracking-widest text-white/50 font-bold mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Add Friend
                </h4>
                <form onSubmit={handleSendFriendRequest} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter nickname..." 
                    value={friendInput}
                    onChange={(e) => setFriendInput(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-head outline-none focus:border-[#9B30FF]/50 transition-colors"
                  />
                  <button type="submit" className="bg-[#9B30FF] hover:bg-[#8022d9] text-white px-4 py-2 rounded-xl font-bold transition-colors">
                    Send
                  </button>
                </form>
              </div>

              <div>
                <h4 className="font-head text-sm uppercase tracking-widest text-white/50 font-bold mb-3">Pending Requests</h4>
                <div className="space-y-2">
                  {friends.filter(f => f.status === 'pending').length === 0 ? (
                    <p className="text-white/50 italic text-sm font-head">No pending requests.</p>
                  ) : (
                    friends.filter(f => f.status === 'pending').map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-black/40 border border-[#9B30FF]/30 rounded-xl p-3">
                        <div>
                          <span className="font-bold text-white/90">{f.nickname}</span>
                          <p className="text-xs text-white/50 mt-0.5">{f.direction === 'incoming' ? 'Incoming request' : 'Request sent'}</p>
                        </div>
                        {f.direction === 'incoming' && (
                          <button 
                            onClick={() => handleAcceptFriend(f.id)}
                            className="bg-[#22E07B]/20 text-[#22E07B] hover:bg-[#22E07B]/30 p-2 rounded-lg transition-colors"
                            title="Accept Request"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1">
              <h4 className="font-head text-sm uppercase tracking-widest text-white/50 font-bold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> My Friends
              </h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {friends.filter(f => f.status === 'accepted').length === 0 ? (
                  <p className="text-white/50 italic text-sm font-head">You have no friends yet.</p>
                ) : (
                  friends.filter(f => f.status === 'accepted').map(f => (
                    <div key={f.id} className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl p-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
                        <Users className="w-5 h-5 text-white/50" />
                      </div>
                      <div className="flex-1">
                        <Link to={`/profile/${f.nickname}`} className="font-bold text-white/90 text-lg block hover:text-[#00BFFF] transition-colors">{f.nickname}</Link>
                        {f.current_match_id && <span className="text-xs text-[#22E07B] animate-pulse">In a match</span>}
                      </div>
                      {f.current_match_id && (
                        <a href={`/play?spectateId=${f.current_match_id}&slot=${f.current_match_slot}&roomCode=${f.current_room_code}`} className="bg-[#9B30FF]/20 text-[#9B30FF] hover:bg-[#9B30FF]/40 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 border border-[#9B30FF]/30">
                          <Eye className="w-4 h-4" /> Spectate
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0B0C10] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl shadow-black">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
              <h2 className="font-display text-2xl font-bold text-[#F2A900]">Choose your Avatar</h2>
              <button onClick={() => setShowAvatarModal(false)} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {avatars.length === 0 ? (
                <div className="text-center py-10 text-white/40 animate-pulse font-head">Loading avatars...</div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
                  {avatars.map(c => (
                    <img 
                      key={c.name}
                      src={c.image_url}
                      alt={c.name}
                      title={c.name}
                      onClick={() => !savingAvatar && selectAvatar(c.image_url)}
                      className={`w-full aspect-square object-cover rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${user.avatar === c.image_url ? 'border-[#F2A900] shadow-[0_0_15px_rgba(242,169,0,0.5)]' : 'border-white/10 hover:border-white/40'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPanel({ user }) {
  const [adminTab, setAdminTab] = useState("telemetry");
  
  const [telemetry, setTelemetry] = useState(null);
  const [products, setProducts] = useState([]);
  const [shopStats, setShopStats] = useState(null);
  const [userList, setUserList] = useState([]);
  const [orderList, setOrderList] = useState([]);
  const [pollList, setPollList] = useState([]);

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newPoll, setNewPoll] = useState({ title: "", description: "", finish_at: "", options: ["", ""] });

  const handleAddPollOption = () => {
    setNewPoll(prev => ({ ...prev, options: [...prev.options, ""] }));
  };

  const handleUpdatePollOption = (index, value) => {
    const newOptions = [...newPoll.options];
    newOptions[index] = value;
    setNewPoll(prev => ({ ...prev, options: newOptions }));
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    try {
      await api.post("/polls", newPoll);
      alert("Poll created successfully!");
      setNewPoll({ title: "", description: "", finish_at: "", options: ["", ""] });
      fetchData();
    } catch(err) {
      alert("Failed to create poll: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.REACT_APP_IMGBB_API_KEY}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setEditingProduct({ ...editingProduct, image_url: data.data.url });
      } else {
        alert("Failed to upload image.");
      }
    } catch (err) {
      alert("Error uploading image: " + err.message);
    }
    setIsUploading(false);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/shop/products/${editingProduct.id}`, editingProduct);
      setEditingProduct(null);
      fetchData();
    } catch (err) {
      alert("Failed to save product: " + err.message);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab]);

  const fetchData = async () => {
    try {
      if (adminTab === "telemetry") {
        const res = await api.get("/admin/stats/game");
        setTelemetry(res.data);
      } else if (adminTab === "shop") {
        const pRes = await api.get("/admin/shop/products");
        setProducts(pRes.data);
        const sRes = await api.get("/admin/shop/stats");
        setShopStats(sRes.data);
      } else if (adminTab === "users") {
        const uRes = await api.get("/admin/users");
        setUserList(uRes.data);
      } else if (adminTab === "orders") {
        const oRes = await api.get("/admin/shop/orders");
        setOrderList(oRes.data);
      } else if (adminTab === "polls") {
        const pRes = await api.get("/polls");
        setPollList(pRes.data);
      }
    } catch (e) {
      console.error(e);
      alert("API Error in Dashboard: " + e.message);
      // Fallback data for preview purposes if backend fails
      if (adminTab === "telemetry") setTelemetry(null); // stay loading
    }
  };

  const isOwner = user.email === "swagyser9@gmail.com";

  const handleToggleAdmin = async (targetId) => {
    if (!isOwner) return;
    try {
      await api.post(`/admin/users/${targetId}/toggle_admin`);
      fetchData();
    } catch (err) {
      alert("Failed to toggle admin status.");
    }
  };

  const COLORS = ["#22E07B", "#9B30FF", "#F2A900", "#00BFFF", "#FF5252"];
  const PIE_DATA = telemetry ? [
    { name: "First Player Win", value: telemetry.first_vs_second.first },
    { name: "Second Player Win", value: telemetry.first_vs_second.second },
  ] : [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap gap-2 glass rounded-2xl p-1 mb-4">
        <button 
          onClick={() => setAdminTab("telemetry")}
          className={`px-4 py-2 rounded-xl font-head font-bold transition-all ${adminTab === "telemetry" ? "bg-[#00BFFF] text-black" : "text-white/50 hover:text-white"}`}
        >
          <Activity className="w-4 h-4 inline-block mr-2" /> Telemetry
        </button>
        <button 
          onClick={() => setAdminTab("shop")}
          className={`px-4 py-2 rounded-xl font-head font-bold transition-all ${adminTab === "shop" ? "bg-[#22E07B] text-black" : "text-white/50 hover:text-white"}`}
        >
          <Store className="w-4 h-4 inline-block mr-2" /> Shop Manager
        </button>
        <button 
          onClick={() => setAdminTab("orders")}
          className={`px-4 py-2 rounded-xl font-head font-bold transition-all ${adminTab === "orders" ? "bg-[#F2A900] text-black" : "text-white/50 hover:text-white"}`}
        >
          <ListOrdered className="w-4 h-4 inline-block mr-2" /> Sales Log
        </button>
        <button 
          onClick={() => setAdminTab("users")}
          className={`px-4 py-2 rounded-xl font-head font-bold transition-all ${adminTab === "users" ? "bg-[#9B30FF] text-black" : "text-white/50 hover:text-white"}`}
        >
          <Users className="w-4 h-4 inline-block mr-2" /> User Management
        </button>
        <button 
          onClick={() => setAdminTab("polls")}
          className={`px-4 py-2 rounded-xl font-head font-bold transition-all ${adminTab === "polls" ? "bg-[#FF5252] text-black" : "text-white/50 hover:text-white"}`}
        >
          <Vote className="w-4 h-4 inline-block mr-2" /> Polls
        </button>
      </div>

      {adminTab === "telemetry" && (
        <div className="space-y-6 animate-in fade-in zoom-in-95">
          {!telemetry ? <div className="text-white/50">Loading telemetry...</div> : (
            <>
              {/* Vercel-style metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#111] border border-white/10 rounded-xl p-5 flex flex-col justify-between">
                  <span className="text-white/40 text-xs font-mono uppercase tracking-wider mb-2">Total Matches</span>
                  <span className="text-3xl font-head font-bold text-white tracking-tight">{telemetry.deck_win_rates?.reduce((sum, d) => sum + d.totalGames, 0) || 0}</span>
                </div>
                <div className="bg-[#111] border border-white/10 rounded-xl p-5 flex flex-col justify-between">
                  <span className="text-white/40 text-xs font-mono uppercase tracking-wider mb-2">First Player WR</span>
                  <span className="text-3xl font-head font-bold text-[#F2A900] tracking-tight">{telemetry.first_vs_second.first}%</span>
                </div>
                <div className="bg-[#111] border border-white/10 rounded-xl p-5 flex flex-col justify-between">
                  <span className="text-white/40 text-xs font-mono uppercase tracking-wider mb-2">Second Player WR</span>
                  <span className="text-3xl font-head font-bold text-[#00BFFF] tracking-tight">{telemetry.first_vs_second.second}%</span>
                </div>
                <div className="bg-[#111] border border-white/10 rounded-xl p-5 flex flex-col justify-between">
                  <span className="text-white/40 text-xs font-mono uppercase tracking-wider mb-2">Total Referrals</span>
                  <span className="text-3xl font-head font-bold text-[#9B30FF] tracking-tight">{telemetry.referrals?.reduce((sum, r) => sum + r.count, 0) || 0}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Deck Win Rates */}
                <section className="bg-[#111] border border-white/10 rounded-xl p-6 lg:col-span-2">
                  <h2 className="text-sm font-mono text-white/50 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Deck Win Rates
                  </h2>
                  {telemetry.deck_win_rates?.length === 0 ? (
                    <p className="text-white/40 text-sm">No matches played yet.</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-[#111] text-white/40 text-xs font-mono uppercase tracking-wider">
                          <tr>
                            <th className="py-3 font-normal">Deck Name</th>
                            <th className="py-3 font-normal text-right">Total Games</th>
                            <th className="py-3 font-normal text-right">Win Rate</th>
                            <th className="py-3 font-normal w-1/3 pl-4">Performance</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm font-head">
                          {telemetry.deck_win_rates.map((d, i) => (
                            <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-3 font-medium text-white/90">{d.deck}</td>
                              <td className="py-3 text-white/60 text-right">{d.totalGames}</td>
                              <td className="py-3 text-white/90 text-right">{d.winRate}%</td>
                              <td className="py-3 pl-4">
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-red-500 via-[#F2A900] to-[#22E07B]" style={{ width: `${d.winRate}%` }}></div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Referral Sources */}
                <section className="bg-[#111] border border-white/10 rounded-xl p-6">
                  <h2 className="text-sm font-mono text-white/50 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" /> External Sources
                  </h2>
                  <div className="space-y-4">
                    {telemetry.referrals?.map((r, i) => {
                      const totalRefs = telemetry.referrals?.reduce((sum, ref) => sum + ref.count, 0) || 1;
                      const pct = Math.round((r.count / totalRefs) * 100);
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-sm font-head">
                            <span className="text-white/80">{r.source}</span>
                            <span className="text-white/50">{r.count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-white/30" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                    {telemetry.referrals?.length === 0 && <p className="text-white/40 text-sm">No referral data.</p>}
                  </div>
                </section>

                {/* Top User Referrals */}
                <section className="bg-[#111] border border-white/10 rounded-xl p-6">
                  <h2 className="text-sm font-mono text-white/50 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Top Referrers
                  </h2>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {telemetry.top_referrers?.map((r, i) => {
                      const maxRefs = Math.max(...(telemetry.top_referrers?.map(x => x.count) || [1]));
                      const pct = Math.round((r.count / maxRefs) * 100);
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-sm font-head">
                            <div className="flex items-center gap-3">
                              <span className="text-white/30 font-mono w-4">{i + 1}.</span>
                              <span className="text-white/80">{r.referrer}</span>
                            </div>
                            <span className="text-white/50">{r.count}</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden ml-7" style={{ width: 'calc(100% - 1.75rem)' }}>
                            <div className="h-full bg-[#9B30FF]/60" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                    {(!telemetry.top_referrers || telemetry.top_referrers.length === 0) && <p className="text-white/40 text-sm">No user referrals yet.</p>}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      )}


      {adminTab === "shop" && (
        <div className="space-y-8 animate-in fade-in zoom-in-95">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass rounded-2xl p-5 border-l-4 border-[#00BFFF]">
              <div className="text-white/50 text-sm font-head mb-1">Total Orders</div>
              <div className="text-3xl font-display font-bold">{shopStats?.total_orders || 0}</div>
            </div>
            <div className="glass rounded-2xl p-5 border-l-4 border-[#22E07B]">
              <div className="text-white/50 text-sm font-head mb-1">Gross Revenue</div>
              <div className="text-3xl font-display font-bold">${shopStats?.total_revenue || 0}</div>
            </div>
            <div className="glass rounded-2xl p-5 border-l-4 border-[#F2A900]">
              <div className="text-white/50 text-sm font-head mb-1">Total Shipping Weight</div>
              <div className="text-3xl font-display font-bold">{shopStats?.total_weight || 0} kg</div>
            </div>
            <div className="glass rounded-2xl p-5 border-l-4 border-[#9B30FF]">
              <div className="text-white/50 text-sm font-head mb-1">Estimated Courier Fees</div>
              <div className="text-3xl font-display font-bold">${((shopStats?.total_weight || 0) * 12.5).toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 glass rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                  <Package className="text-[#22E07B]" /> Product Inventory
                </h2>
                <button className="flex items-center gap-2 bg-[#00BFFF] text-black font-bold px-4 py-2 rounded-xl text-sm hover:brightness-110">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-sm font-head">
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium">Price</th>
                      <th className="pb-3 font-medium">Cost / Profit</th>
                      <th className="pb-3 font-medium">Stock</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Weight</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="py-4 font-bold">{p.name}</td>
                        <td className="py-4">${p.price}</td>
                        <td className="py-4">
                          <div className="text-sm text-red-400">Cost: ${p.cost_price || 0}</div>
                          <div className="text-sm text-yellow-400">Tax(25%): ${(p.price * 0.20).toFixed(2)}</div>
                          <div className="text-sm text-green-400 font-bold">Net: ${(p.price - (p.cost_price || 0) - (p.price * 0.20)).toFixed(2)}</div>
                        </td>
                        <td className="py-4">
                          {p.stock > 0 ? (
                            <span className="text-[#22E07B]">{p.stock} in stock</span>
                          ) : (
                            <span className="text-red-400">Out of Stock</span>
                          )}
                        </td>
                        <td className="py-4">
                          {p.is_preorder ? (
                            <span className="bg-[#9B30FF]/20 text-[#9B30FF] px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Preorder ({p.eta})</span>
                          ) : (
                            <span className="bg-[#22E07B]/20 text-[#22E07B] px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Active</span>
                          )}
                        </td>
                        <td className="py-4 text-white/50">{p.weight_kg} kg</td>
                        <td className="py-4 text-right">
                          <button 
                            onClick={() => setEditingProduct({...p})} 
                            className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sm transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {editingProduct && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <div className="glass-strong rounded-3xl p-8 max-w-lg w-full relative">
                  <button onClick={() => setEditingProduct(null)} className="absolute top-6 right-6 text-white/50 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                  <h3 className="text-2xl font-display font-bold text-white mb-6">Edit Product</h3>
                  <form onSubmit={handleSaveProduct} className="space-y-4 font-head">
                    <div>
                      <label className="block text-white/50 text-sm mb-1">Name</label>
                      <input type="text" required value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white" />
                    </div>
                    <div>
                      <label className="block text-white/50 text-sm mb-1">Description</label>
                      <textarea required value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white h-20" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/50 text-sm mb-1">Image Upload (ImgBB)</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleImageUpload} 
                            disabled={isUploading}
                            className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600"
                          />
                          {isUploading && <span className="text-purple-400 text-sm animate-pulse">Uploading...</span>}
                        </div>
                        {editingProduct.image_url && (
                          <div className="mt-2 text-xs text-green-400 truncate">Current: {editingProduct.image_url}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-white/50 text-sm mb-1">Price ($)</label>
                        <input type="number" step="0.01" required value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-white/50 text-sm mb-1">Cost / Buy-in ($)</label>
                        <input type="number" step="0.01" required value={editingProduct.cost_price || 0} onChange={e => setEditingProduct({...editingProduct, cost_price: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-white/50 text-sm mb-1">Stock</label>
                        <input type="number" required value={editingProduct.stock} onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/50 text-sm mb-1">Weight (kg)</label>
                        <input type="number" step="0.01" required value={editingProduct.weight_kg} onChange={e => setEditingProduct({...editingProduct, weight_kg: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-white/50 text-sm mb-1">ETA (if preorder)</label>
                        <input type="text" value={editingProduct.eta} onChange={e => setEditingProduct({...editingProduct, eta: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <input type="checkbox" id="is_preorder" checked={editingProduct.is_preorder} onChange={e => setEditingProduct({...editingProduct, is_preorder: e.target.checked})} className="w-4 h-4" />
                      <label htmlFor="is_preorder" className="text-white">Allow Preorders</label>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                      <button type="button" onClick={() => setEditingProduct(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">Cancel</button>
                      <button type="submit" className="px-4 py-2 rounded-lg bg-[#00BFFF] text-black font-bold hover:brightness-110 transition-all">Save Changes</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                <Store className="text-[#F2A900]" /> Country Analytics
              </h2>
              <div className="space-y-4">
                {shopStats?.countries?.length === 0 ? (
                  <p className="text-white/50 text-sm italic">No orders yet.</p>
                ) : (
                  shopStats?.countries?.map(c => (
                    <div key={c.country} className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                      <span className="font-bold">{c.country}</span>
                      <span className="bg-white/10 px-2 py-1 rounded text-sm">{c.count} orders</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {adminTab === "orders" && (
        <div className="glass rounded-3xl p-6 animate-in fade-in zoom-in-95">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#F2A900]">
            <ListOrdered className="w-6 h-6" /> Sales Log
          </h2>
          {orderList.length === 0 ? (
            <p className="text-white/50 italic">No orders have been placed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-white/10 text-white/50 text-sm font-head">
                  <tr>
                    <th className="pb-3">Order ID</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Country</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orderList.map(o => (
                    <tr 
                      key={o.id} 
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <td className="py-4 font-mono text-[#00BFFF]">#{o.id}</td>
                      <td className="py-4">{o.first_name} {o.last_name}</td>
                      <td className="py-4 text-white/70">{o.country}</td>
                      <td className="py-4 font-bold text-[#22E07B]">${o.total_amount}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${o.status === 'paid' ? 'bg-[#22E07B]/20 text-[#22E07B]' : 'bg-white/10 text-white/50'}`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-4 text-white/50 text-sm">{new Date(o.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="glass-strong rounded-3xl p-8 max-w-lg w-full relative">
                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="absolute top-6 right-6 text-white/50 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
                <h3 className="text-3xl font-display font-bold text-[#00BFFF] mb-6">Order #{selectedOrder.id}</h3>
                <div className="space-y-4 font-head">
                  <div><span className="text-white/50">Customer:</span> {selectedOrder.first_name} {selectedOrder.last_name} ({selectedOrder.user_email || 'No email'})</div>
                  <div><span className="text-white/50">Phone:</span> {selectedOrder.phone || 'N/A'}</div>
                  <div><span className="text-white/50">Address:</span> {selectedOrder.address}, {selectedOrder.country}</div>
                  
                  {selectedOrder.items && selectedOrder.items.length > 0 && (
                    <>
                      <hr className="border-white/10 my-4" />
                      <div className="text-white/50 mb-2">Purchased Items:</div>
                      <div className="space-y-2">
                        {selectedOrder.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                            <div>
                              <span className="font-bold">{item.product_name || 'Unknown Product'}</span>
                              <span className="text-white/50 ml-2">x{item.quantity}</span>
                            </div>
                            <span className="text-[#22E07B]">${(parseFloat(item.price_at_purchase) * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <hr className="border-white/10 my-4" />
                  <div className="flex justify-between"><span className="text-white/50">Total Paid (incl. Shipping/Tax):</span> <span className="font-bold text-[#22E07B]">${selectedOrder.total_amount}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Shipping Cost:</span> <span className="text-red-400">-${selectedOrder.shipping_cost || 0}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Cost of Goods (Buy-in):</span> <span className="text-red-400">-${selectedOrder.total_cogs || 0}</span></div>
                  <div className="flex justify-between pt-2 border-t border-white/10 mt-2">
                    <span className="text-white/80 font-bold">Net Profit:</span> 
                    <span className="font-bold text-[#F2A900]">${(parseFloat(selectedOrder.total_amount || 0) - parseFloat(selectedOrder.shipping_cost || 0) - parseFloat(selectedOrder.total_cogs || 0)).toFixed(2)}</span>
                  </div>
                  
                  {isEditingOrder ? (
                    <div className="space-y-4 mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
                      <div>
                        <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wider">Status</label>
                        <select 
                          value={selectedOrder.status}
                          onChange={(e) => setSelectedOrder({...selectedOrder, status: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white outline-none"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="PAID">PAID</option>
                          <option value="SHIPPED">SHIPPED</option>
                          <option value="DELIVERED">DELIVERED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wider">First Name</label>
                          <input type="text" value={selectedOrder.first_name || ''} onChange={(e) => setSelectedOrder({...selectedOrder, first_name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wider">Last Name</label>
                          <input type="text" value={selectedOrder.last_name || ''} onChange={(e) => setSelectedOrder({...selectedOrder, last_name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wider">Address</label>
                        <input type="text" value={selectedOrder.address || ''} onChange={(e) => setSelectedOrder({...selectedOrder, address: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white outline-none" />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={async () => {
                          try {
                            await api.put(`/admin/shop/orders/${selectedOrder.id}`, selectedOrder);
                            setIsEditingOrder(false);
                            fetchData();
                          } catch(err) {
                            alert("Failed to update order");
                          }
                        }} className="flex-1 bg-[#22E07B] text-black font-bold py-2 rounded-lg hover:brightness-110">Save</button>
                        <button onClick={() => setIsEditingOrder(false)} className="flex-1 bg-white/10 text-white hover:bg-white/20 py-2 rounded-lg">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-6">
                      <button onClick={() => setIsEditingOrder(true)} className="flex-1 bg-white/10 text-white hover:bg-white/20 font-bold py-2 rounded-lg transition-colors border border-white/10">Edit Order</button>
                      <button onClick={async () => {
                        if(confirm("Are you sure you want to permanently delete this order?")) {
                          try {
                            await api.delete(`/admin/shop/orders/${selectedOrder.id}`);
                            setSelectedOrder(null);
                            fetchData();
                          } catch(err) {
                            alert("Failed to delete order");
                          }
                        }
                      }} className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 font-bold py-2 rounded-lg transition-colors border border-red-500/30">Delete Order</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {adminTab === "users" && (
        <div className="glass rounded-3xl p-6 animate-in fade-in zoom-in-95">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#9B30FF]">
            <Users className="w-6 h-6" /> User Management
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-white/10 text-white/50 text-sm font-head">
                <tr>
                  <th className="pb-3">ID</th>
                  <th className="pb-3">Username</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userList.map(u => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-4 text-white/50">{u.id}</td>
                    <td className="py-4 font-bold text-[#F2A900]">{u.username}</td>
                    <td className="py-4 text-white/70">{u.email}</td>
                    <td className="py-4">
                      {u.is_admin ? (
                        <span className="flex items-center gap-1 text-red-400 font-bold text-sm"><Crown className="w-4 h-4" /> Admin</span>
                      ) : (
                        <span className="text-white/50 text-sm">Player</span>
                      )}
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${u.status === 'active' ? 'bg-green-500/20 text-green-400' : u.status === 'suspended' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                        {(u.status || 'active').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        {isOwner && (u.email !== "swagyser9@gmail.com") && (
                          <button 
                            onClick={() => handleToggleAdmin(u.id)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${u.is_admin ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                          >
                            {u.is_admin ? "Revoke Admin" : "Make Admin"}
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if(confirm(`Are you sure you want to reset the password for ${u.username}?`)) {
                              try {
                                await api.post(`/admin/users/${u.id}/reset-password`);
                                toast.success("Password reset email sent!");
                              } catch(e) {
                                toast.error("Failed to reset password.");
                              }
                            }
                          }}
                          className="bg-white/10 text-white/70 hover:bg-white/20 px-3 py-1 rounded-md text-xs font-bold transition-colors"
                        >
                          Reset Pass
                        </button>
                        
                        {(u.email !== "swagyser9@gmail.com" && !u.is_admin) && (
                          <select 
                            value={u.status || 'active'} 
                            onChange={async (e) => {
                              try {
                                await api.put(`/admin/users/${u.id}/status`, { status: e.target.value });
                                toast.success("User status updated!");
                                fetchData();
                              } catch (err) {
                                toast.error("Failed to update status");
                              }
                            }}
                            className="bg-black/40 border border-white/10 rounded-md p-1 text-xs text-white outline-none"
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="banned">Banned</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminTab === "polls" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in zoom-in-95">
          <div className="glass rounded-3xl p-6">
            <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#FF5252]">
              <Vote className="w-6 h-6" /> Create Poll
            </h2>
            <form onSubmit={handleCreatePoll} className="space-y-4">
              <div>
                <label className="block text-white/50 text-xs uppercase tracking-wider mb-1">Title</label>
                <input type="text" required value={newPoll.title} onChange={e => setNewPoll({...newPoll, title: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" placeholder="e.g. Faction Mixing?" />
              </div>
              <div>
                <label className="block text-white/50 text-xs uppercase tracking-wider mb-1">Description</label>
                <textarea required value={newPoll.description} onChange={e => setNewPoll({...newPoll, description: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white h-24" placeholder="What is this poll about?"></textarea>
              </div>
              <div>
                <label className="block text-white/50 text-xs uppercase tracking-wider mb-1">Finish Date (Optional)</label>
                <input type="date" value={newPoll.finish_at} onChange={e => setNewPoll({...newPoll, finish_at: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" />
              </div>
              
              <div className="pt-4 border-t border-white/10">
                <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Options</label>
                <div className="space-y-2">
                  {newPoll.options.map((opt, i) => (
                    <input key={i} type="text" required value={opt} onChange={e => handleUpdatePollOption(i, e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white" placeholder={`Option ${i+1}`} />
                  ))}
                </div>
                <button type="button" onClick={handleAddPollOption} className="mt-2 text-[#FF5252] text-sm font-bold flex items-center gap-1 hover:text-[#ff7676]"><Plus className="w-4 h-4"/> Add Option</button>
              </div>

              <button type="submit" className="w-full bg-[#FF5252] hover:bg-[#ff7676] text-white font-bold py-3 rounded-xl mt-6 shadow-[0_0_20px_rgba(255,82,82,0.4)] transition-colors">
                Publish Poll
              </button>
            </form>
          </div>

          <div className="glass rounded-3xl p-6">
            <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#FF5252]">
              <ListOrdered className="w-6 h-6" /> Active Polls
            </h2>
            <div className="space-y-4">
              {pollList.length === 0 ? <p className="text-white/50 italic">No active polls.</p> : pollList.map(poll => (
                <div key={poll.id} className="bg-black/40 border border-white/10 rounded-xl p-4">
                  <h3 className="font-bold text-white mb-1">{poll.title}</h3>
                  <p className="text-white/50 text-sm mb-3">{poll.description}</p>
                  <div className="space-y-2">
                    {poll.options.map(opt => (
                      <div key={opt.id} className="flex justify-between items-center bg-white/5 px-3 py-1.5 rounded-lg text-sm">
                        <span>{opt.option_text}</span>
                        <span className="font-bold text-[#FF5252]">{opt.vote_count} votes</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
