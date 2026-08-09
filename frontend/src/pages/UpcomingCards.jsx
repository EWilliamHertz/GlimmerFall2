import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import CardTemplate from "@/components/CardTemplate";
import { ThumbsUp, ThumbsDown, Search, Filter } from "lucide-react";
import { toast } from "sonner";

export default function UpcomingCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState("");
  const [factionFilter, setFactionFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("collector");

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const res = await api.get("/upcoming-cards");
      setCards(res.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch upcoming cards");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (cardId, voteValue) => {
    if (!user) {
      toast.error("You must be logged in to vote on cards.");
      return;
    }
    
    // Optimistic UI update
    setCards(prev => prev.map(c => {
      if (c.id === cardId) {
        const oldVote = c.user_vote || 0;
        const diff = voteValue - oldVote;
        return { ...c, user_vote: voteValue, vote_score: parseInt(c.vote_score) + diff };
      }
      return c;
    }));

    try {
      await api.post(`/upcoming-cards/${cardId}/vote`, { vote: voteValue });
    } catch (e) {
      console.error(e);
      fetchCards(); // Revert on failure
      toast.error("Failed to cast vote.");
    }
  };

  // Filter & Sort Logic
  const filteredCards = cards.filter(c => {
    if (factionFilter !== "All" && c.faction !== factionFilter) return false;
    if (typeFilter !== "All" && c.card_type !== typeFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c.description || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortOrder === "collector") return a.collector_number - b.collector_number;
    if (sortOrder === "highest") return b.vote_score - a.vote_score;
    if (sortOrder === "lowest") return a.vote_score - b.vote_score;
    return 0;
  });

  if (loading) {
    return <div className="min-h-screen pt-20 flex items-center justify-center text-white/50 font-head animate-pulse">Loading Set 2...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-12">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-black mb-4">Set 2: Upcoming Cards</h1>
        <p className="text-white/60 max-w-2xl mx-auto font-head">
          Review the new cards for the upcoming expansion. Vote on their balance and design!
          No artwork has been finalized yet.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="glass rounded-xl p-4 mb-8 flex flex-wrap gap-4 items-center justify-between sticky top-20 z-40 border border-white/10 shadow-xl shadow-black/50">
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input 
              type="text" 
              placeholder="Search by name or text..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-[#F2A900] outline-none transition-colors"
            />
          </div>
          <select value={factionFilter} onChange={e => setFactionFilter(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="All">All Factions</option>
            <option value="Solari">Solari</option>
            <option value="Umbri">Umbri</option>
            <option value="Terra">Terra</option>
            <option value="Aether">Aether</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="All">All Types</option>
            <option value="Entity">Entity</option>
            <option value="Rite">Rite</option>
            <option value="Flash">Flash</option>
            <option value="Relic">Relic</option>
          </select>
        </div>

        <div className="flex gap-2 items-center">
          <Filter className="w-4 h-4 text-white/40" />
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="bg-transparent border-none text-sm outline-none text-white/80 font-bold">
            <option value="collector">Sort by Collector #</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredCards.map((card) => (
          <div key={card.id} className="flex flex-col items-center">
            {/* The Card */}
            <CardTemplate card={card} size="lg" />
            
            {/* Voting Bar underneath */}
            <div className="mt-4 flex items-center justify-between w-full max-w-[220px] bg-black/30 rounded-full border border-white/10 p-1">
              <button 
                onClick={() => handleVote(card.id, -1)}
                className={`p-2 rounded-full transition-colors ${card.user_vote === -1 ? 'bg-red-500/20 text-red-500' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
              
              <span className={`font-bold font-num ${card.vote_score > 0 ? 'text-[#22E07B]' : card.vote_score < 0 ? 'text-red-500' : 'text-white/60'}`}>
                {card.vote_score > 0 ? '+' : ''}{card.vote_score}
              </span>
              
              <button 
                onClick={() => handleVote(card.id, 1)}
                className={`p-2 rounded-full transition-colors ${card.user_vote === 1 ? 'bg-green-500/20 text-[#22E07B]' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {filteredCards.length === 0 && (
        <div className="text-center py-20 text-white/40">
          No cards matched your filters.
        </div>
      )}
    </div>
  );
}
