import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Navigate, useSearchParams } from 'react-router-dom';
import { LogOut, Users, Crosshair, Package, Activity, ShieldAlert, CheckCircle, TrendingUp, Store, Plus, Save, Edit, Settings, X, Crown, ListOrdered, Link } from 'lucide-react';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const { user, logout, verify, resendVerification } = useAuth();
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
        <PlayerDashboard user={user} />
      )}
    </div>
  );
}

function PlayerDashboard({ user }) {
  const winRate = (user.wins + user.losses) > 0 ? Math.round((user.wins / (user.wins + user.losses)) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-6 bg-black/40 p-6 rounded-3xl border border-white/10">
        <img 
          src={user.avatar === 'default_avatar.png' ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.nickname}` : user.avatar} 
          alt="Avatar" 
          className="w-24 h-24 rounded-full border-4 border-[#F2A900] shadow-lg" 
        />
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

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchData();
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
      </div>

      {adminTab === "telemetry" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in zoom-in-95">
          {!telemetry ? <div className="text-white/50">Loading telemetry...</div> : (
            <>
              {/* Deck Win Rates */}
              <section className="glass rounded-3xl p-6 lg:col-span-2">
                <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#22E07B]">
                  <TrendingUp className="w-6 h-6" /> Deck Win Rates
                </h2>
                {telemetry.deck_win_rates?.length === 0 ? (
                  <p className="text-white/50 italic">No matches played yet.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-black/80 backdrop-blur text-white/50 text-sm">
                        <tr>
                          <th className="py-2">Deck Name</th>
                          <th className="py-2">Total Games</th>
                          <th className="py-2">Win Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {telemetry.deck_win_rates.map((d, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 font-bold text-[#F2A900]">{d.deck}</td>
                            <td className="py-3">{d.totalGames}</td>
                            <td className="py-3 text-[#22E07B]">{d.winRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Referral Sources */}
              <section className="glass rounded-3xl p-6">
                <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#9B30FF]">
                  <Link className="w-6 h-6" /> Referral Sources
                </h2>
                <div className="space-y-3">
                  {telemetry.referrals?.map((r, i) => (
                    <div key={i} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                      <span className="font-bold text-white/80">{r.source}</span>
                      <span className="bg-[#9B30FF]/20 text-[#9B30FF] px-2 py-1 rounded-md text-sm font-bold">{r.count} users</span>
                    </div>
                  ))}
                  {telemetry.referrals?.length === 0 && <p className="text-white/50 italic">No referral data.</p>}
                </div>
              </section>

              {/* First vs Second */}
              <section className="glass rounded-3xl p-6">
                <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2 text-[#F2A900]">
                  First vs Second Advantage
                </h2>
                <div className="h-64 flex items-center justify-center relative">
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
                      <th className="pb-3 font-medium">Stock</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="py-4 font-bold">{p.name}</td>
                        <td className="py-4">${p.price}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
                  <div><span className="text-white/50">Customer:</span> {selectedOrder.first_name} {selectedOrder.last_name} ({selectedOrder.user_email})</div>
                  <div><span className="text-white/50">Address:</span> {selectedOrder.address}, {selectedOrder.country}</div>
                  <hr className="border-white/10 my-4" />
                  <div className="flex justify-between"><span className="text-white/50">Total Paid:</span> <span className="font-bold text-[#22E07B]">${selectedOrder.total_amount}</span></div>
                  <div className="flex justify-between"><span className="text-white/50">Shipping Cost:</span> <span className="text-red-400">-${selectedOrder.shipping_cost}</span></div>
                  <div className="flex justify-between pt-2 border-t border-white/10 mt-2">
                    <span className="text-white/80 font-bold">Net Profit:</span> 
                    <span className="font-bold text-[#F2A900]">${selectedOrder.net_profit}</span>
                  </div>
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
                  {isOwner && <th className="pb-3">Actions</th>}
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
                    {isOwner && (
                      <td className="py-4">
                        {(u.email !== "swagyser9@gmail.com") && (
                          <button 
                            onClick={() => handleToggleAdmin(u.id)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${u.is_admin ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                          >
                            {u.is_admin ? "Revoke Admin" : "Make Admin"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
