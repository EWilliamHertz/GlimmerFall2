import React, { useState } from "react";
import { toast } from "sonner";
import { Users, Trophy, Vote, Swords, Video, MessageSquare } from "lucide-react";

export default function Community() {
  const [voted, setVoted] = useState(false);

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

    </div>
  );
}
