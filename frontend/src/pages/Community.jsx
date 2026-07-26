import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Users, Trophy, Vote, Swords, Video, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";

export default function Community() {
  const [voted, setVoted] = useState(false);
  const [decks, setDecks] = useState([]);
  const [loadingDecks, setLoadingDecks] = useState(true);

  useEffect(() => {
    api.get("/community-decks").then(r => {
      setDecks(r.data);
      setLoadingDecks(false);
    }).catch(err => {
      console.error(err);
      setLoadingDecks(false);
    });
  }, []);

  const handleVote = (factionPref) => {
    setVoted(true);
    toast.success("Thanks for your feedback! Your vote has been recorded.");
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-24 space-y-16">
      <div className="text-center">
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Community & Social</h1>
        <p className="text-white/60 font-head max-w-2xl mx-auto text-lg">
          Connect with other Summoners, track your progress, and help shape the future of GlimmerFall during the Alpha stage.
        </p>
      </div>

      {/* Alpha Poll */}
      <section className="glass rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Vote className="w-32 h-32" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <h2 className="font-display text-2xl font-bold mb-2 text-[#00BFFF]">Alpha Feedback: Faction Mixing</h2>
          <p className="text-white/70 font-head mb-6">
            It is currently undetermined if we will allow players to mix different factions in a single deck, or if you will be bound to one faction. What is your preference?
          </p>
          
          {!voted ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => handleVote('mixed')}
                className="glass hover:bg-white/5 border border-white/10 p-5 rounded-2xl text-left transition-all"
              >
                <div className="font-head font-bold text-lg mb-1">Allow Mixed Factions</div>
                <div className="text-sm text-white/50">More deckbuilding freedom, but harder to balance.</div>
              </button>
              <button 
                onClick={() => handleVote('single')}
                className="glass hover:bg-white/5 border border-white/10 p-5 rounded-2xl text-left transition-all"
              >
                <div className="font-head font-bold text-lg mb-1">Strict Single Faction</div>
                <div className="text-sm text-white/50">Stronger faction identity, easier to balance.</div>
              </button>
            </div>
          ) : (
            <div className="bg-[#22E07B]/10 border border-[#22E07B]/30 text-[#22E07B] rounded-2xl p-5 font-head font-semibold text-center">
              Your feedback has been recorded! We'll announce the decision soon.
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Features Grid */}
      <section>
        <h2 className="font-display text-3xl font-bold mb-8 text-center">Upcoming Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="glass rounded-2xl p-6 hover:border-white/20 transition-colors">
            <Users className="w-8 h-8 text-[#F2A900] mb-4" />
            <h3 className="font-head font-bold text-xl mb-2">User Accounts & Profiles</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Create an account, choose an avatar based on your favorite card art, and track your match history, win rates, and highest ranks.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 hover:border-white/20 transition-colors">
            <Trophy className="w-8 h-8 text-[#22E07B] mb-4" />
            <h3 className="font-head font-bold text-xl mb-2">Quests & Rewards</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Complete Daily and Weekly missions (e.g., "Play 20 Rites," "Win 3 games as Terra") to earn rewards and encourage regular play.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 hover:border-white/20 transition-colors">
            <Swords className="w-8 h-8 text-[#FF5252] mb-4" />
            <h3 className="font-head font-bold text-xl mb-2">Friends & Direct Challenges</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Add friends to your Social tab. See who's online and send them direct match invites without needing a room code.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 hover:border-white/20 transition-colors">
            <Video className="w-8 h-8 text-[#9B30FF] mb-4" />
            <h3 className="font-head font-bold text-xl mb-2">Match Replays</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Save your past matches to review your strategies, learn from your misplays, or share epic comebacks with the community.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 hover:border-white/20 transition-colors">
            <MessageSquare className="w-8 h-8 text-[#00BFFF] mb-4" />
            <h3 className="font-head font-bold text-xl mb-2">Spectator Mode</h3>
            <p className="text-white/60 text-sm leading-relaxed">
              Watch your friends' matches live! Spectator mode will feature a slight broadcast delay to prevent stream-sniping and ensure competitive integrity.
            </p>
          </div>

        </div>
      </section>

      {/* Community Decks Section */}
      <section className="pt-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-3xl font-bold mb-2">Community Decks</h2>
            <p className="text-white/60 font-head">Discover and try out decks created by other Summoners.</p>
          </div>
        </div>

        {loadingDecks ? (
          <div className="text-center py-20 text-white/50 font-head animate-pulse">Loading community decks...</div>
        ) : decks.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border-dashed border-white/20">
            <h3 className="font-display text-2xl font-bold text-white/40 mb-2">No Decks Published Yet</h3>
            <p className="text-white/40 font-head">Be the first to publish a deck from the Deck Builder!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {decks.map(deck => {
              const totalCards = deck.cards.reduce((sum, c) => sum + c.count, 0);
              
              // Figure out main faction based on most common card faction
              const factions = {};
              deck.cards.forEach(c => {
                if(c.faction) {
                  factions[c.faction] = (factions[c.faction] || 0) + c.count;
                }
              });
              const dominantFaction = Object.entries(factions).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Neutral';
              
              return (
                <div key={deck.id} className="glass rounded-2xl overflow-hidden hover:border-white/20 transition-all flex flex-col group">
                  <div className="p-6 pb-4 border-b border-white/10 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-screen bg-cover bg-center" 
                         style={{ backgroundImage: deck.cards[0]?.image_url ? `url(${deck.cards[0].image_url})` : 'none', filter: 'blur(10px)' }} />
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <h3 className="font-display font-bold text-2xl mb-1 group-hover:text-[#F2A900] transition-colors">{deck.deck_name}</h3>
                        <p className="font-head text-sm text-white/50">by <span className="text-white/80 font-bold">{deck.username}</span></p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-head font-bold bg-white/10 text-white border border-white/20">
                          {dominantFaction}
                        </span>
                        <div className="text-[10px] text-white/40 mt-2 uppercase tracking-wider">{totalCards} Cards</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-black/40 flex-1">
                    <div className="flex flex-wrap gap-2">
                      {deck.cards.slice(0, 15).map(c => (
                        <div key={c.card_name} className="px-2 py-1 bg-white/5 rounded text-[11px] font-head text-white/70 border border-white/5 flex gap-2 items-center">
                          <span className="text-white/30">{c.count}x</span>
                          <span className="truncate max-w-[120px]">{c.card_name}</span>
                        </div>
                      ))}
                      {deck.cards.length > 15 && (
                        <div className="px-2 py-1 bg-white/5 rounded text-[11px] font-head text-white/40 border border-white/5">
                          +{deck.cards.length - 15} more...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
