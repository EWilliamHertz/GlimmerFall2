import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CheckCircle, Zap } from 'lucide-react';

export default function TutorialSandbox() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to the Sandbox",
      text: "Let's learn the basics of GlimmerFall. Click next to begin.",
      actionText: "Next",
      onAction: () => setStep(1),
      boardState: "empty"
    },
    {
      title: "Glimmer Nodes",
      text: "This is your hand. You have a Glimmer Node. Glimmer Nodes generate the resources you need to play cards. Click the Glimmer Node to play it into your Resonance Zone.",
      actionText: null, // user must click the node
      boardState: "hand_node"
    },
    {
      title: "Resonance Zone",
      text: "Great! The node is now in your Resonance Zone. It provides 1 Glimmer this turn. Now you have enough resources to play a card.",
      actionText: "Next",
      onAction: () => setStep(3),
      boardState: "played_node"
    },
    {
      title: "Playing a Card",
      text: "You have a basic attack card that costs 1 Glimmer. Since you have 1 active Glimmer Node, you can play it! Click the attack card to play it.",
      actionText: null, // user must click card
      boardState: "hand_attack"
    },
    {
      title: "Attack Successful!",
      text: "You dealt 2 damage to the opponent! That's the core loop: play nodes, gain Glimmer, play cards to defeat your opponent.",
      actionText: "Finish Tutorial",
      onAction: () => navigate('/play'),
      boardState: "attack_done"
    }
  ];

  const current = steps[step];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative font-head flex flex-col">
      {/* Top Bar */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md z-10">
        <h1 className="font-display text-xl font-bold text-[#F2A900]">Interactive Tutorial</h1>
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white">Exit Tutorial</button>
      </div>

      {/* Play Area */}
      <div className="flex-1 relative flex items-center justify-center p-8">
        
        {/* Opponent Area */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-50">
          <div className="w-24 h-24 rounded-full bg-red-900 border-4 border-red-500/50 flex items-center justify-center font-display text-2xl font-bold">
            {step >= 4 ? "18 HP" : "20 HP"}
          </div>
          <div className="text-white/50 font-bold uppercase tracking-widest text-sm">Opponent</div>
        </div>

        {/* Board Elements based on state */}
        <AnimatePresence mode="wait">
          {(current.boardState === "played_node" || current.boardState === "hand_attack" || current.boardState === "attack_done") && (
            <motion.div 
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="absolute bottom-48 left-1/2 -translate-x-1/2 flex gap-2"
            >
              <div className="w-20 h-28 bg-[#00BFFF]/20 border-2 border-[#00BFFF] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,191,255,0.3)]">
                <Zap className="w-8 h-8 text-[#00BFFF]" />
              </div>
              <div className="absolute -bottom-8 w-full text-center text-[#00BFFF] font-bold text-sm">Resonance Zone</div>
            </motion.div>
          )}

          {current.boardState === "attack_done" && (
            <motion.div
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -300, opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 w-32 h-48 bg-white border-2 border-red-500 rounded-xl flex items-center justify-center z-20"
            >
              <span className="text-red-500 font-bold">Attack Card</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player Hand Area */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
          {current.boardState === "hand_node" && (
            <motion.div
              whileHover={{ y: -10 }}
              onClick={() => setStep(2)}
              className="w-32 h-48 bg-zinc-800 border-2 border-[#00BFFF] rounded-xl flex flex-col items-center justify-center cursor-pointer shadow-lg hover:shadow-[#00BFFF]/50"
            >
              <Zap className="w-10 h-10 text-[#00BFFF] mb-2" />
              <span className="font-bold">Glimmer Node</span>
              <span className="text-xs text-white/50 mt-2 text-center px-2">Click to play</span>
            </motion.div>
          )}

          {current.boardState === "hand_attack" && (
            <motion.div
              whileHover={{ y: -10 }}
              onClick={() => setStep(4)}
              className="w-32 h-48 bg-zinc-800 border-2 border-red-500 rounded-xl flex flex-col items-center justify-center cursor-pointer shadow-lg hover:shadow-red-500/50"
            >
              <span className="font-bold text-red-500">Attack</span>
              <span className="text-xs text-white/50 mt-2 text-center px-2">Cost: 1 Glimmer<br/>Click to play</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Tutorial Dialog Overlay */}
      <div className="absolute bottom-8 right-8 max-w-sm bg-black/80 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-right-8 fade-in duration-500">
        <h2 className="text-xl font-bold font-display text-[#F2A900] mb-2">{current.title}</h2>
        <p className="text-white/80 leading-relaxed mb-6">{current.text}</p>
        
        {current.actionText && (
          <button 
            onClick={current.onAction}
            className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
          >
            {current.actionText}
            {step === steps.length - 1 ? <CheckCircle className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        )}
      </div>

    </div>
  );
}
