import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Users, Trophy, Vote, Swords, Video, MessageSquare, Hammer, ChevronUp, PlusCircle, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import CardTemplate from "@/components/CardTemplate";
import { factionCfg, FACTIONS } from "@/lib/factions";

export default function Community() {
  const { user } = useAuth();
  const [voted, setVoted] = useState(false);
  const [decks, setDecks] = useState([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [polls, setPolls] = useState([]);

  // The Forge state
  const [customCards, setCustomCards] = useState([]);
  const [showForgeModal, setShowForgeModal] = useState(false);
  const [forgeForm, setForgeForm] = useState({
    name: "", faction: "Terra", card_type: "Entity", cost: 1, power: 1, health: 1, description: "", lore: ""
  });
  const [submittingCard, setSubmittingCard] = useState(false);

  const fetchCustomCards = () => {
    api.get("/custom-cards").then(r => setCustomCards(r.data)).catch(console.error);
  };

  useEffect(() => {
    fetchCustomCards();
    api.get("/community-decks").then(r => {
      setDecks(r.data);
      setLoadingDecks(false);
    }).catch(err => {
      console.error(err);
      setLoadingDecks(false);
    });
    api.get("/polls").then(r => setPolls(r.data)).catch(console.error);
  }, []);

  const handleVotePoll = async (pollId, optionId) => {
    if (!user) return toast.error("Please login to vote.");
    try {
      await api.post(`/polls/${pollId}/vote`, { option_id: optionId });
      toast.success("Vote recorded!");
      api.get("/polls").then(r => setPolls(r.data)).catch(console.error);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to vote.");
    }
  };

  const handleVote = (factionPref) => {
    setVoted(true);
    toast.success("Thanks for your feedback! Your vote has been recorded.");
  };

  const handleForgeSubmit = async (e) => {
    e.preventDefault();
    if (!forgeForm.name) return toast.error("Card name is required!");
    
    setSubmittingCard(true);
    try {
      await api.post("/custom-cards", {
        ...forgeForm,
        author: user?.nickname || "Anonymous"
      });
      toast.success("Your custom card has been forged!");
      setShowForgeModal(false);
      setForgeForm({ name: "", faction: "Terra", card_type: "Entity", cost: 1, power: 1, health: 1, description: "", lore: "" });
      fetchCustomCards();
    } catch (err) {
      toast.error("Failed to forge card.");
    } finally {
      setSubmittingCard(false);
    }
  };

  const handleUpvoteCard = async (id) => {
    try {
      await api.post(`/custom-cards/${id}/upvote`);
      fetchCustomCards(); // Refresh the list
    } catch (err) {
      toast.error("Failed to upvote.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-24 space-y-16">
      <div className="text-center">
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Community & Social</h1>
        <p className="text-white/60 font-head max-w-2xl mx-auto text-lg">
          Connect with other Summoners, track your progress, and help shape the future of GlimmerFall during the Alpha stage.
        </p>
      </div>

      {/* Alpha Polls */}
      {polls.length > 0 && (
        <section className="space-y-6">
          <h2 className="font-display text-3xl font-bold mb-4 flex items-center gap-3">
            <Vote className="w-8 h-8 text-[#00BFFF]" /> Active Community Polls
          </h2>
          {polls.map(poll => {
            // Find if user voted
            const userVote = poll.votes?.find(v => v.user_email === user?.email)?.option_id;
            const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.vote_count || 0), 0);
            return (
              <div key={poll.id} className="glass rounded-3xl p-8 relative overflow-hidden border border-[#00BFFF]/20">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <Vote className="w-48 h-48" />
                </div>
                <div className="relative z-10 max-w-3xl">
                  <h3 className="font-display text-2xl font-bold mb-2 text-[#00BFFF]">{poll.title}</h3>
                  <p className="text-white/70 font-head mb-6">{poll.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {poll.options.map(opt => {
                      const pct = totalVotes > 0 ? Math.round(((opt.vote_count || 0) / totalVotes) * 100) : 0;
                      return (
                        <button 
                          key={opt.id}
                          onClick={() => handleVotePoll(poll.id, opt.id)}
                          className={`relative glass border p-5 rounded-2xl text-left transition-all overflow-hidden ${userVote === opt.id ? 'border-[#00BFFF] bg-[#00BFFF]/10' : 'border-white/10 hover:bg-white/5'}`}
                        >
                          <div className="absolute left-0 top-0 bottom-0 bg-[#00BFFF]/20 z-0 transition-all" style={{ width: `${pct}%` }}></div>
                          <div className="relative z-10 flex justify-between items-center">
                            <div className="font-head font-bold text-lg">{opt.option_text}</div>
                            {userVote && <div className="text-sm font-bold text-white/50">{pct}%</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {poll.finish_at && (
                    <div className="mt-4 text-xs text-white/40 font-head">
                      Closes on: {new Date(poll.finish_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* The Forge (Custom Cards) */}
      <section className="pt-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-3xl font-bold mb-2 text-[#F2A900] flex items-center gap-3">
              <Hammer className="w-8 h-8" /> The Forge
            </h2>
            <p className="text-white/60 font-head">Design your own custom cards and vote on community creations. The best designs might become official!</p>
          </div>
          <button onClick={() => setShowForgeModal(true)} className="px-6 py-3 rounded-full bg-[#F2A900] text-black font-head font-bold hover:bg-[#ffc21f] transition-all flex items-center gap-2 shadow-lg shadow-[#F2A900]/20">
            <PlusCircle className="w-5 h-5" /> Design a Card
          </button>
        </div>

        {customCards.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border-dashed border-white/20">
            <p className="text-white/40 font-head">The Forge is empty. Be the first to craft a custom card!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {customCards.map(c => (
              <div key={c.id} className="relative group">
                <CardTemplate card={{...c, rarity: "Rare"}} size="sm" />
                <div className="absolute top-2 right-2 flex flex-col gap-2">
                  <button 
                    onClick={() => handleUpvoteCard(c.id)}
                    className="w-10 h-10 rounded-full bg-black/80 border border-white/20 text-white flex flex-col items-center justify-center hover:bg-[#22E07B] hover:text-black hover:border-[#22E07B] transition-colors shadow-xl"
                  >
                    <ChevronUp className="w-4 h-4" />
                    <span className="text-[10px] font-bold leading-none">{c.upvotes}</span>
                  </button>
                </div>
                <div className="text-center mt-3">
                  <p className="font-head text-sm text-white/50">Designed by <span className="text-white font-bold">{c.author}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>



      {/* Forge Modal */}
      {showForgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0B0C10] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-black">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
              <h2 className="font-display text-2xl font-bold text-[#F2A900] flex items-center gap-2"><Hammer className="w-6 h-6" /> Forge a Card</h2>
              <button onClick={() => setShowForgeModal(false)} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col md:flex-row gap-10">
                {/* Form */}
                <form onSubmit={handleForgeSubmit} className="flex-1 space-y-5">
                  <div>
                    <label className="block text-sm font-head text-white/60 mb-1">Card Name</label>
                    <input required value={forgeForm.name} onChange={e => setForgeForm({...forgeForm, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-head focus:border-[#F2A900] outline-none" placeholder="e.g. Blade of the Fallen" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-head text-white/60 mb-1">Faction</label>
                      <select value={forgeForm.faction} onChange={e => setForgeForm({...forgeForm, faction: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-head focus:border-[#F2A900] outline-none appearance-none">
                        {Object.keys(FACTIONS).map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-head text-white/60 mb-1">Card Type</label>
                      <select value={forgeForm.card_type} onChange={e => setForgeForm({...forgeForm, card_type: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-head focus:border-[#F2A900] outline-none appearance-none">
                        <option value="Entity">Entity</option>
                        <option value="Rite">Rite (Spell)</option>
                        <option value="Flash">Flash (Instant Spell)</option>
                        <option value="Relic">Relic (Item/Artifact)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-head text-white/60 mb-1">Cost</label>
                      <input type="number" min="0" value={forgeForm.cost} onChange={e => setForgeForm({...forgeForm, cost: parseInt(e.target.value) || 0})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-num font-bold text-lg text-center focus:border-[#F2A900] outline-none" />
                    </div>
                    {forgeForm.card_type === 'Entity' && (
                      <>
                        <div>
                          <label className="block text-sm font-head text-white/60 mb-1">Power</label>
                          <input type="number" min="0" value={forgeForm.power} onChange={e => setForgeForm({...forgeForm, power: parseInt(e.target.value) || 0})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-num font-bold text-lg text-center focus:border-[#F2A900] outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-head text-white/60 mb-1">Health</label>
                          <input type="number" min="1" value={forgeForm.health} onChange={e => setForgeForm({...forgeForm, health: parseInt(e.target.value) || 1})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-num font-bold text-lg text-center focus:border-[#F2A900] outline-none" />
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-head text-white/60 mb-1">Card Rules / Description</label>
                    <textarea rows={3} value={forgeForm.description} onChange={e => setForgeForm({...forgeForm, description: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-head focus:border-[#F2A900] outline-none resize-none" placeholder="e.g. When deployed, deal 2 damage to target Entity." />
                  </div>

                  <div>
                    <label className="block text-sm font-head text-white/60 mb-1">Lore Text (Optional)</label>
                    <textarea rows={2} value={forgeForm.lore} onChange={e => setForgeForm({...forgeForm, lore: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-white font-head italic focus:border-[#F2A900] outline-none resize-none" placeholder="The flavor text of the card..." />
                  </div>
                </form>

                {/* Live Preview */}
                <div className="w-full md:w-[320px] shrink-0 flex flex-col items-center">
                  <p className="font-head text-sm text-white/40 mb-4 uppercase tracking-widest">Live Preview</p>
                  <CardTemplate 
                    card={{
                      ...forgeForm,
                      name: forgeForm.name || "Card Name",
                      rarity: "Rare"
                    }} 
                    size="md" 
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-3">
              <button onClick={() => setShowForgeModal(false)} className="px-6 py-2.5 rounded-full font-head text-white/60 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleForgeSubmit} disabled={submittingCard} className="px-8 py-2.5 rounded-full font-head font-bold bg-[#F2A900] text-black hover:bg-[#ffc21f] transition-colors disabled:opacity-50">
                {submittingCard ? "Forging..." : "Publish Card"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
