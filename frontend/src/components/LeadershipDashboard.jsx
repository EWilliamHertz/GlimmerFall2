import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Briefcase, LineChart, Megaphone, CheckCircle2, XCircle, ChevronUp, DollarSign, ScrollText, Plus, Save, Edit3 } from "lucide-react";
import { toast } from "sonner";

export default function LeadershipDashboard() {
  const [tab, setTab] = useState("overview"); // overview, ledger, campaigns, proposals
  const [transactions, setTransactions] = useState({ total_usd: 0, total_glimmer: 0, total_marketing: 0, recent_shop: [] });
  const [campaigns, setCampaigns] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [newCampaign, setNewCampaign] = useState({ title: "", description: "", start_date: "", end_date: "", cost: 0 });
  const [newSuggestion, setNewSuggestion] = useState({ type: "Proposal", content: "" });
  const [editingCampaign, setEditingCampaign] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txRes, campRes, suggRes] = await Promise.all([
        api.get("/admin/leadership/transactions"),
        api.get("/admin/leadership/campaigns"),
        api.get("/admin/leadership/suggestions"),
      ]);
      setTransactions(txRes.data);
      setCampaigns(campRes.data);
      setSuggestions(suggRes.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load leadership data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/leadership/campaigns", newCampaign);
      setNewCampaign({ title: "", description: "", start_date: "", end_date: "", cost: 0 });
      fetchData();
      toast.success("Campaign created!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to create campaign");
    }
  };

  const handleUpdateCampaign = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/leadership/campaigns/${editingCampaign.id}`, editingCampaign);
      setEditingCampaign(null);
      fetchData();
      toast.success("Campaign updated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update campaign");
    }
  };

  const handleCreateSuggestion = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/leadership/suggestions", newSuggestion);
      setNewSuggestion({ type: "Proposal", content: "" });
      fetchData();
      toast.success("Proposal submitted");
    } catch (e) {
      console.error(e);
    }
  };

  const handleVote = async (id, status = null) => {
    try {
      await api.post(`/admin/leadership/suggestions/${id}/vote`, { status });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-8 text-white/50 text-center animate-pulse font-head">Loading Diplomacy Data...</div>;

  // Build the ledger by combining shop orders and campaign costs
  const ledgerEntries = [
    ...transactions.recent_shop.map(o => ({
      id: `shop_${o.id}`,
      date: new Date(o.created_at),
      description: `Shop Order: ${o.email}`,
      amount: parseFloat(o.total_price || 0),
      type: 'revenue'
    })),
    ...campaigns.filter(c => parseFloat(c.cost) !== 0).map(c => ({
      id: `camp_${c.id}`,
      date: new Date(c.start_date),
      description: `Marketing Campaign: ${c.title}`,
      amount: parseFloat(c.cost || 0),
      type: 'expense'
    }))
  ].sort((a, b) => b.date - a.date);

  return (
    <div className="space-y-6">
      {/* Internal Tabs */}
      <div className="flex border-b border-white/10 font-head overflow-x-auto">
        <button onClick={() => setTab("overview")} className={`px-4 py-3 font-bold whitespace-nowrap transition-colors border-b-2 ${tab === "overview" ? "border-[#9B30FF] text-white" : "border-transparent text-white/50 hover:text-white"}`}>Overview</button>
        <button onClick={() => setTab("ledger")} className={`px-4 py-3 font-bold whitespace-nowrap transition-colors border-b-2 ${tab === "ledger" ? "border-[#22E07B] text-white" : "border-transparent text-white/50 hover:text-white"}`}>Transactions Ledger</button>
        <button onClick={() => setTab("campaigns")} className={`px-4 py-3 font-bold whitespace-nowrap transition-colors border-b-2 ${tab === "campaigns" ? "border-[#F2A900] text-white" : "border-transparent text-white/50 hover:text-white"}`}>Campaigns</button>
        <button onClick={() => setTab("proposals")} className={`px-4 py-3 font-bold whitespace-nowrap transition-colors border-b-2 ${tab === "proposals" ? "border-[#00BFFF] text-white" : "border-transparent text-white/50 hover:text-white"}`}>Proposals</button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass rounded-xl p-5 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5"><DollarSign size={80} /></div>
              <h3 className="text-white/50 font-head font-bold uppercase tracking-wider text-xs mb-1">Gross Revenue</h3>
              <p className="text-3xl font-display font-black text-[#22E07B]">${transactions.total_usd.toFixed(2)}</p>
            </div>
            <div className="glass rounded-xl p-5 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Megaphone size={80} /></div>
              <h3 className="text-white/50 font-head font-bold uppercase tracking-wider text-xs mb-1">Marketing Expenses</h3>
              <p className="text-3xl font-display font-black text-[#FF5252]">
                {transactions.total_marketing < 0 ? `-$${Math.abs(transactions.total_marketing).toFixed(2)}` : `$${transactions.total_marketing.toFixed(2)}`}
              </p>
            </div>
            <div className="glass rounded-xl p-5 border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5"><Briefcase size={80} /></div>
              <h3 className="text-white/50 font-head font-bold uppercase tracking-wider text-xs mb-1">Net Profit</h3>
              <p className={`text-3xl font-display font-black ${(transactions.total_usd + transactions.total_marketing) >= 0 ? 'text-[#22E07B]' : 'text-red-500'}`}>
                ${(transactions.total_usd + transactions.total_marketing).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* LEDGER TAB */}
        {tab === "ledger" && (
          <div className="glass rounded-xl p-5 border border-white/10">
            <h2 className="text-xl font-bold font-head mb-4 flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-[#22E07B]" /> Financial Ledger
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-white/40 uppercase tracking-wider text-[10px] border-b border-white/5">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 text-white/60">{entry.date.toLocaleDateString()}</td>
                      <td className="py-3">{entry.description}</td>
                      <td className={`py-3 text-right font-bold font-num ${entry.amount > 0 ? 'text-[#22E07B]' : 'text-[#FF5252]'}`}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {ledgerEntries.length === 0 && (
                    <tr><td colSpan="3" className="py-8 text-center text-white/40">No transactions recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CAMPAIGNS TAB */}
        {tab === "campaigns" && (
          <div className="space-y-6">
            <div className="glass rounded-xl p-5 border border-white/10">
              <h2 className="text-xl font-bold font-head mb-4 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#F2A900]" /> Active Campaigns
              </h2>
              
              <form onSubmit={handleCreateCampaign} className="mb-6 flex flex-col gap-2 bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 mb-2"><Plus className="w-4 h-4 text-[#F2A900]"/> <h3 className="font-bold text-sm text-white/80">Launch New Campaign</h3></div>
                <input type="text" placeholder="Campaign Title (e.g. Facebook Group Ads)" required className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm" value={newCampaign.title} onChange={e => setNewCampaign({...newCampaign, title: e.target.value})} />
                <textarea placeholder="Detailed Description" rows={2} className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm resize-none" value={newCampaign.description} onChange={e => setNewCampaign({...newCampaign, description: e.target.value})} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input type="date" required title="Start Date" className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm" value={newCampaign.start_date} onChange={e => setNewCampaign({...newCampaign, start_date: e.target.value})} />
                  <input type="date" title="End Date" className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm" value={newCampaign.end_date} onChange={e => setNewCampaign({...newCampaign, end_date: e.target.value})} />
                  <input type="number" step="0.01" placeholder="Cost ($)" title="Marketing Cost (Use negative for expenses, e.g. -1250)" className="bg-black/40 border border-white/10 rounded px-3 py-2 text-sm" value={newCampaign.cost} onChange={e => setNewCampaign({...newCampaign, cost: e.target.value})} />
                </div>
                <button type="submit" className="bg-[#F2A900] text-black font-bold text-sm py-2 rounded-lg hover:bg-[#F2A900]/80 mt-2">Launch Campaign</button>
              </form>

              <div className="space-y-4">
                {campaigns.map(c => (
                  <div key={c.id} className="bg-black/40 rounded-xl p-4 border border-white/5">
                    {editingCampaign && editingCampaign.id === c.id ? (
                      <form onSubmit={handleUpdateCampaign} className="flex flex-col gap-2">
                        <input type="text" required className="bg-black/40 border border-[#F2A900]/50 rounded px-3 py-1.5 text-sm" value={editingCampaign.title} onChange={e => setEditingCampaign({...editingCampaign, title: e.target.value})} />
                        <textarea rows={2} className="bg-black/40 border border-[#F2A900]/50 rounded px-3 py-1.5 text-sm" value={editingCampaign.description} onChange={e => setEditingCampaign({...editingCampaign, description: e.target.value})} />
                        <div className="grid grid-cols-3 gap-2">
                          <input type="date" className="bg-black/40 border border-[#F2A900]/50 rounded px-3 py-1.5 text-sm" value={editingCampaign.start_date} onChange={e => setEditingCampaign({...editingCampaign, start_date: e.target.value})} />
                          <input type="date" className="bg-black/40 border border-[#F2A900]/50 rounded px-3 py-1.5 text-sm" value={editingCampaign.end_date || ''} onChange={e => setEditingCampaign({...editingCampaign, end_date: e.target.value})} />
                          <input type="number" step="0.01" className="bg-black/40 border border-[#F2A900]/50 rounded px-3 py-1.5 text-sm" value={editingCampaign.cost} onChange={e => setEditingCampaign({...editingCampaign, cost: e.target.value})} />
                        </div>
                        <div className="flex gap-2 justify-end mt-2">
                          <button type="button" onClick={() => setEditingCampaign(null)} className="px-3 py-1.5 rounded text-sm text-white/50 hover:bg-white/5">Cancel</button>
                          <button type="submit" className="px-3 py-1.5 rounded text-sm bg-[#F2A900] text-black font-bold flex items-center gap-1"><Save className="w-4 h-4"/> Save</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-lg">{c.title}</h3>
                            <span className="text-xs text-white/40 block">
                              {new Date(c.start_date).toLocaleDateString()} {c.end_date && `- ${new Date(c.end_date).toLocaleDateString()}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-num font-bold ${c.cost < 0 ? 'text-[#FF5252]' : 'text-white/40'}`}>
                              {c.cost !== undefined ? `$${parseFloat(c.cost).toFixed(2)}` : '$0.00'}
                            </span>
                            <button onClick={() => setEditingCampaign(c)} className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"><Edit3 className="w-4 h-4"/></button>
                          </div>
                        </div>
                        <p className="text-sm text-white/70 mb-4 bg-white/5 p-3 rounded-lg border border-white/5">{c.description}</p>
                        
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white/5 rounded-lg py-2 border border-white/5">
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">New Signups</p>
                            <p className="font-bold text-xl text-[#00BFFF] font-num">{c.registrations}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg py-2 border border-white/5">
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">Matches Played</p>
                            <p className="font-bold text-xl text-[#FF5252] font-num">{c.matches_played}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg py-2 border border-white/5">
                            <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">Page Views</p>
                            <p className="font-bold text-xl text-[#22E07B] font-num">{c.page_views}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {campaigns.length === 0 && <p className="text-sm text-white/40 text-center py-8">No campaigns launched yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* PROPOSALS TAB */}
        {tab === "proposals" && (
          <div className="glass rounded-xl p-5 border border-white/10">
            <h2 className="text-xl font-bold font-head mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#9B30FF]" /> Leadership Proposals
            </h2>

            <form onSubmit={handleCreateSuggestion} className="mb-6 flex gap-2">
              <select className="bg-black/40 border border-white/10 rounded px-2 text-sm outline-none" value={newSuggestion.type} onChange={e => setNewSuggestion({...newSuggestion, type: e.target.value})}>
                <option>Proposal</option>
                <option>Goal</option>
                <option>Task</option>
              </select>
              <input type="text" required placeholder="What should we focus on?" className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm outline-none" value={newSuggestion.content} onChange={e => setNewSuggestion({...newSuggestion, content: e.target.value})} />
              <button type="submit" className="bg-[#9B30FF] text-white font-bold text-sm px-4 rounded hover:bg-[#9B30FF]/80 transition-colors">Add</button>
            </form>

            <div className="space-y-3">
              {suggestions.map(s => (
                <div key={s.id} className="bg-black/40 rounded-xl p-3 border border-white/5 flex gap-4 items-center">
                  <button onClick={() => handleVote(s.id)} className="flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 p-2 rounded-lg text-white/60 hover:text-[#22E07B] transition-colors shrink-0 min-w-[50px]">
                    <ChevronUp className="w-5 h-5 mb-1" />
                    <span className="text-xs font-bold font-num">{s.upvotes}</span>
                  </button>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/60">{s.suggestion_type}</span>
                      <span className="text-xs text-white/40">{s.user_email}</span>
                    </div>
                    <p className="text-sm text-white/90">{s.content}</p>
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    {s.status === 'Pending' ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleVote(s.id, 'Approved')} className="p-2 bg-green-500/10 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"><CheckCircle2 className="w-5 h-5"/></button>
                        <button onClick={() => handleVote(s.id, 'Rejected')} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"><XCircle className="w-5 h-5"/></button>
                      </div>
                    ) : (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${s.status === 'Approved' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
                        {s.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {suggestions.length === 0 && <p className="text-sm text-white/40 text-center py-8">No active proposals.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
