import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Briefcase, LineChart, Megaphone, CheckCircle2, XCircle, ChevronUp } from "lucide-react";

export default function LeadershipDashboard() {
  const [transactions, setTransactions] = useState({ total_usd: 0, total_glimmer: 0, recent_shop: [] });
  const [campaigns, setCampaigns] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // New campaign state
  const [newCampaign, setNewCampaign] = useState({ title: "", description: "", start_date: "", end_date: "" });

  // New suggestion state
  const [newSuggestion, setNewSuggestion] = useState({ type: "Proposal", content: "" });

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
      setNewCampaign({ title: "", description: "", start_date: "", end_date: "" });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSuggestion = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/leadership/suggestions", newSuggestion);
      setNewSuggestion({ type: "Proposal", content: "" });
      fetchData();
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

  if (loading) return <div className="p-8 text-white/50 text-center animate-pulse">Loading Leadership Data...</div>;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Briefcase size={64} />
          </div>
          <h3 className="text-white/50 font-head font-bold uppercase tracking-wider text-xs mb-1">Total USD Revenue</h3>
          <p className="text-3xl font-display font-black text-[#22E07B]">${transactions.total_usd.toFixed(2)}</p>
        </div>
        <div className="glass rounded-xl p-5 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <LineChart size={64} />
          </div>
          <h3 className="text-white/50 font-head font-bold uppercase tracking-wider text-xs mb-1">Glimmer Issued</h3>
          <p className="text-3xl font-display font-black text-[#00BFFF]">{transactions.total_glimmer}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaigns Widget */}
        <div className="glass rounded-xl p-5 border border-white/10">
          <h2 className="text-xl font-bold font-head mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#F2A900]" /> Active Campaigns
          </h2>
          
          <form onSubmit={handleCreateCampaign} className="mb-6 flex flex-col gap-2 bg-black/20 p-3 rounded-lg border border-white/5">
            <input type="text" placeholder="Campaign Title" required className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm" value={newCampaign.title} onChange={e => setNewCampaign({...newCampaign, title: e.target.value})} />
            <input type="text" placeholder="Description" className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm" value={newCampaign.description} onChange={e => setNewCampaign({...newCampaign, description: e.target.value})} />
            <div className="flex gap-2">
              <input type="date" required className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm w-full" value={newCampaign.start_date} onChange={e => setNewCampaign({...newCampaign, start_date: e.target.value})} />
              <input type="date" className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm w-full" value={newCampaign.end_date} onChange={e => setNewCampaign({...newCampaign, end_date: e.target.value})} />
            </div>
            <button type="submit" className="bg-[#F2A900] text-black font-bold text-sm py-1.5 rounded hover:bg-[#F2A900]/80">Launch Campaign</button>
          </form>

          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.id} className="bg-black/40 rounded-lg p-3 border border-white/5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold">{c.title}</h3>
                  <span className="text-xs text-white/40">{new Date(c.start_date).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-white/60 mb-3">{c.description}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 rounded py-1">
                    <p className="text-[10px] text-white/40 uppercase">Signups</p>
                    <p className="font-bold text-[#00BFFF]">{c.registrations}</p>
                  </div>
                  <div className="bg-white/5 rounded py-1">
                    <p className="text-[10px] text-white/40 uppercase">Matches</p>
                    <p className="font-bold text-[#FF5252]">{c.matches_played}</p>
                  </div>
                  <div className="bg-white/5 rounded py-1">
                    <p className="text-[10px] text-white/40 uppercase">Views</p>
                    <p className="font-bold text-[#22E07B]">{c.page_views}</p>
                  </div>
                </div>
              </div>
            ))}
            {campaigns.length === 0 && <p className="text-sm text-white/40">No campaigns launched yet.</p>}
          </div>
        </div>

        {/* Suggestions / Proposals Widget */}
        <div className="glass rounded-xl p-5 border border-white/10">
          <h2 className="text-xl font-bold font-head mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#9B30FF]" /> Leadership Proposals
          </h2>

          <form onSubmit={handleCreateSuggestion} className="mb-6 flex gap-2">
            <select className="bg-black/40 border border-white/10 rounded px-2 text-sm" value={newSuggestion.type} onChange={e => setNewSuggestion({...newSuggestion, type: e.target.value})}>
              <option>Proposal</option>
              <option>Goal</option>
              <option>Task</option>
            </select>
            <input type="text" required placeholder="What should we focus on?" className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm" value={newSuggestion.content} onChange={e => setNewSuggestion({...newSuggestion, content: e.target.value})} />
            <button type="submit" className="bg-[#9B30FF] text-white font-bold text-sm px-3 rounded hover:bg-[#9B30FF]/80">+</button>
          </form>

          <div className="space-y-3">
            {suggestions.map(s => (
              <div key={s.id} className="bg-black/40 rounded-lg p-3 border border-white/5 flex gap-3 items-center">
                <button onClick={() => handleVote(s.id)} className="flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 p-2 rounded text-white/60 hover:text-[#22E07B] transition-colors shrink-0 min-w-[40px]">
                  <ChevronUp className="w-4 h-4" />
                  <span className="text-xs font-bold">{s.upvotes}</span>
                </button>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/60">{s.suggestion_type}</span>
                    <span className="text-xs text-white/40">{s.user_email}</span>
                  </div>
                  <p className="text-sm">{s.content}</p>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  {s.status === 'Pending' ? (
                    <>
                      <button onClick={() => handleVote(s.id, 'Approved')} className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/40 rounded"><CheckCircle2 className="w-4 h-4"/></button>
                      <button onClick={() => handleVote(s.id, 'Rejected')} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded"><XCircle className="w-4 h-4"/></button>
                    </>
                  ) : (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${s.status === 'Approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {s.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {suggestions.length === 0 && <p className="text-sm text-white/40">No active proposals.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
