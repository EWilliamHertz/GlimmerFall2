import React, { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { api } from "@/lib/api";

// We assume GameBoard is passed as a prop to avoid cyclic imports if it remains in Arena.jsx
// Or we can import GameBoard if it's extracted. For now, since GameBoard is in Arena.jsx and ReplayViewer is used by Arena,
// it might be tricky to extract GameBoard and ReplayViewer separately without a lot of work.
// Let's pass GameBoard in as a prop.

export default function ReplayViewer({ session, onExit, GameBoard }) {
  const [history, setHistory] = useState([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/match/${session.matchId}/history`).then(res => {
      setHistory(res.data.history || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session.matchId]);

  useEffect(() => {
    if (!playing || history.length === 0) return;
    const interval = setInterval(() => {
      setIndex(i => {
        if (i >= history.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [playing, history.length]);

  if (loading) return <div className="py-32 text-center text-white/50 font-head">Loading replay history...</div>;
  if (!history || history.length === 0) return (
     <div className="py-32 text-center text-white/50 font-head">
       No step-by-step history available for this match.<br/>
       (Only matches played after this feature was added can be replayed.)
       <div className="mt-4"><button onClick={onExit} className="px-4 py-2 bg-white/10 rounded">Exit</button></div>
     </div>
  );

  const currentState = history[index];
  const mockedMatch = {
    id: session.matchId,
    state: currentState,
    status: currentState.phase,
    activePlayer: currentState.activePlayer
  };

  // Add Turn Information for the Scrubber
  const turnLabel = `Turn ${currentState.turn || 1} - ${currentState.activePlayer === 1 ? 'P1' : 'P2'} ${currentState.phase}`;

  return (
    <div className="relative min-h-screen">
      <GameBoard session={session} match={mockedMatch} refresh={() => {}} onExit={onExit} />
      
      {/* Playback Controls Overlay with Improved Scrubber */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-md border-t border-white/10 z-[100] flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
           <button onClick={() => setIndex(Math.max(0, index - 1))} className="p-2 hover:bg-white/10 rounded-full text-white"><SkipBack className="w-5 h-5"/></button>
           <button onClick={() => setPlaying(!playing)} className="p-3 bg-[#00BFFF] text-black rounded-full hover:bg-[#38ccff] transition-all">
             {playing ? <Pause className="w-6 h-6"/> : <Play className="w-6 h-6 fill-current"/>}
           </button>
           <button onClick={() => setIndex(Math.min(history.length - 1, index + 1))} className="p-2 hover:bg-white/10 rounded-full text-white"><SkipForward className="w-5 h-5"/></button>
        </div>
        <div className="w-full max-w-3xl flex flex-col gap-1 items-center text-white">
           <div className="text-sm font-bold text-[#F2A900] mb-1">{turnLabel}</div>
           <div className="w-full flex items-center gap-4">
             <span className="text-xs font-num">{index + 1}</span>
             <input 
               type="range" 
               min={0} 
               max={history.length - 1} 
               value={index} 
               onChange={e => {
                 setIndex(parseInt(e.target.value));
                 setPlaying(false); // Pause when scrubbing
               }} 
               className="flex-1 accent-[#00BFFF] cursor-pointer" 
             />
             <span className="text-xs font-num">{history.length}</span>
           </div>
        </div>
      </div>
    </div>
  );
}
