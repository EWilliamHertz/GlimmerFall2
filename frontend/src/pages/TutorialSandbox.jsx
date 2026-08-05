import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CheckCircle, Zap, Shield, Sword, Box, Heart } from 'lucide-react';

export default function TutorialSandbox() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to GlimmerFall",
      text: "Let's learn the basics of combat. You'll learn how to generate resources, draw cards, and attack your opponent.",
      actionText: "Begin Training",
      onAction: () => setStep(1),
      boardState: "empty"
    },
    {
      title: "Drawing Cards",
      text: "Every turn, you start by drawing a card from your deck. Click your deck on the right to draw your first card.",
      actionText: null, // user must click deck
      boardState: "draw_phase"
    },
    {
      title: "Any Card is a Node",
      text: "You drew 'Gaia, the World-Soul', a very expensive card. In GlimmerFall, there are no dedicated mana or energy cards! ANY card in your hand can be played upside-down as a Glimmer Node. Because she costs so much Glimmer, we can turn her into a Glimmer Node to make sure that we can play our spells! Click Gaia to turn her into a Glimmer Node in your Resonance Zone.",
      actionText: null, // user must click gaia
      boardState: "hand_gaia"
    },
    {
      title: "The Resonance Zone",
      text: "Excellent! Gaia is now an active Glimmer Node. It provides 1 Glimmer per turn to cast spells and deploy entities. Now that you have resources, let's draw another card.",
      actionText: "Draw Card",
      onAction: () => setStep(4),
      boardState: "played_node"
    },
    {
      title: "Playing an Entity",
      text: "You drew 'Emberwing Courier', an Entity that costs 1 Glimmer and has 2 Attack. Since you have 1 Glimmer Node active, you can play it! Click the card to deploy it onto the battlefield.",
      actionText: null, // user must click card
      boardState: "hand_entity"
    },
    {
      title: "Attacking",
      text: "Your Entity is ready to strike! Click your 'Emberwing Courier' to command it to attack the opponent's Nexus (Health).",
      actionText: null, // user must click entity on board
      boardState: "board_entity"
    },
    {
      title: "Direct Hit!",
      text: "You dealt 2 damage to the opponent! That's the core loop: use any card as a node, gain Glimmer, deploy entities, and defeat your opponent.",
      actionText: "Complete Training",
      onAction: () => navigate('/play'),
      boardState: "attack_done"
    }
  ];

  const current = steps[step];

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-head flex flex-col">
      {/* Background styling */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(242,169,0,0.05),transparent_50%)] pointer-events-none" />

      {/* Top Bar */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <Box className="text-[#F2A900] w-6 h-6" />
          <h1 className="font-display text-xl font-bold text-white tracking-widest uppercase">Combat Simulator</h1>
        </div>
        <button onClick={() => navigate('/')} className="text-white/50 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest">Abort Simulator</button>
      </div>

      {/* Play Area */}
      <div className="flex-1 relative p-8">
        
        {/* Opponent Area */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 transition-all duration-500">
          <motion.div 
            animate={{ scale: step >= 6 ? [1, 1.1, 1] : 1, borderColor: step >= 6 ? ["#ef4444", "#ff0000", "#ef4444"] : "#ef4444" }}
            className="w-24 h-24 rounded-full bg-red-950 border-4 border-red-500 flex items-center justify-center font-display text-2xl font-bold shadow-[0_0_30px_rgba(239,68,68,0.3)] z-10 relative"
          >
            {step >= 6 ? "18" : "20"}
          </motion.div>
          <div className="text-white/50 font-bold uppercase tracking-widest text-sm bg-black/50 px-4 py-1 rounded-full border border-white/10">Enemy Nexus</div>
        </div>

        {/* Deck */}
        <div className="absolute right-10 bottom-48 flex flex-col items-center gap-3">
          <motion.div 
            whileHover={current.boardState === "draw_phase" ? { y: -5, boxShadow: "0 0 20px rgba(242,169,0,0.5)" } : {}}
            onClick={() => current.boardState === "draw_phase" && setStep(2)}
            className={`w-28 h-40 bg-zinc-900 border-2 rounded-xl flex items-center justify-center transition-all ${
              current.boardState === "draw_phase" ? "border-[#F2A900] cursor-pointer shadow-[0_0_30px_rgba(242,169,0,0.3)]" : "border-white/10 opacity-50"
            }`}
          >
            <div className="w-16 h-16 opacity-20 bg-white/20 rounded-full blur-xl" />
          </motion.div>
          <div className="text-white/50 text-xs font-bold uppercase tracking-widest">Deck (39)</div>
        </div>

        {/* Board Elements based on state */}
        <AnimatePresence mode="wait">
          {(step >= 3) && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-48 left-1/4 -translate-x-1/2 flex flex-col items-center gap-3"
            >
              <div className="w-24 h-32 bg-black border border-white/20 rounded-xl shadow-[0_0_30px_rgba(0,191,255,0.2)] overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#00BFFF]/20"></div>
                <div className="w-full h-full flex flex-col items-center justify-center rotate-180 opacity-50">
                   <div className="text-[8px] font-bold text-[#22E07B] uppercase tracking-widest border-b border-white/10 pb-1">Gaia, the World-Soul</div>
                   <Heart className="w-6 h-6 text-[#22E07B] mt-2" />
                </div>
              </div>
              <div className="text-[#00BFFF] font-bold text-xs uppercase tracking-widest bg-black/50 px-3 py-1 rounded-full border border-[#00BFFF]/30 shadow-[0_0_10px_rgba(0,191,255,0.5)]">Active Node (1)</div>
            </motion.div>
          )}

          {step >= 5 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={
                current.boardState === "attack_done" 
                ? { y: -300, scale: 1.5, opacity: 0, transition: { duration: 0.6 } } 
                : { scale: 1, opacity: 1 }
              }
              whileHover={current.boardState === "board_entity" ? { scale: 1.05 } : {}}
              onClick={() => current.boardState === "board_entity" && setStep(6)}
              className={`absolute bottom-56 left-1/2 -translate-x-1/2 w-32 h-44 bg-zinc-900 border-2 rounded-xl flex flex-col items-center justify-between p-2 z-20 transition-all ${
                current.boardState === "board_entity" ? "border-red-500 cursor-pointer shadow-[0_0_30px_rgba(239,68,68,0.4)]" : "border-[#F2A900]"
              }`}
            >
              <div className="w-full text-center text-xs font-bold text-[#F2A900] border-b border-white/10 pb-1">Emberwing</div>
              <div className="flex-1 w-full flex items-center justify-center">
                <Sword className={`w-10 h-10 ${current.boardState === "board_entity" ? "text-red-500 animate-pulse" : "text-white/20"}`} />
              </div>
              <div className="w-full flex justify-between px-1 text-sm font-display font-bold">
                <span className="text-red-400">2</span>
                <span className="text-green-400">1</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player Hand Area */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 h-48 items-end">
          <AnimatePresence>
            {current.boardState === "hand_gaia" && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0, scale: 0.5 }}
                whileHover={{ y: -20 }}
                onClick={() => setStep(3)}
                className="w-36 h-52 bg-zinc-900 border-2 border-[#22E07B] rounded-xl flex flex-col items-center justify-between p-3 cursor-pointer shadow-[0_0_30px_rgba(34,224,123,0.2)] hover:shadow-[0_0_40px_rgba(34,224,123,0.6)] group transition-shadow"
              >
                <div className="w-full text-center text-xs font-bold text-[#22E07B] uppercase tracking-widest border-b border-white/10 pb-2">Gaia, the World-Soul</div>
                <div className="text-white/40 text-[10px] text-center px-2">Colossal earth elemental.</div>
                <div className="w-full text-center text-[9px] text-white/90 bg-[#00BFFF]/20 border border-[#00BFFF]/50 rounded py-1 shadow-[0_0_10px_rgba(0,191,255,0.3)] animate-pulse uppercase">Click to play as Node</div>
                <div className="w-full flex justify-between items-center bg-black/50 rounded p-1 mt-1">
                  <span className="text-[#00BFFF] font-bold text-[10px] flex items-center gap-1"><Zap className="w-3 h-3"/>10</span>
                  <div className="flex gap-1">
                    <span className="text-red-400 font-bold text-[10px]">8</span>
                    <span className="text-green-400 font-bold text-[10px]">8</span>
                  </div>
                </div>
              </motion.div>
            )}

            {current.boardState === "hand_entity" && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0, scale: 0.5 }}
                whileHover={{ y: -20 }}
                onClick={() => setStep(5)}
                className="w-36 h-52 bg-zinc-900 border-2 border-[#F2A900] rounded-xl flex flex-col items-center justify-between p-3 cursor-pointer shadow-[0_0_30px_rgba(242,169,0,0.2)] hover:shadow-[0_0_40px_rgba(242,169,0,0.6)] group transition-shadow"
              >
                <div className="w-full text-center text-xs font-bold text-[#F2A900] uppercase tracking-widest border-b border-white/10 pb-2">Emberwing</div>
                <div className="text-white/40 text-xs text-center px-2">An aggressive celestial attacker.</div>
                <div className="w-full flex justify-between items-center bg-black/50 rounded p-1">
                  <span className="text-[#00BFFF] font-bold text-xs flex items-center gap-1"><Zap className="w-3 h-3"/>1</span>
                  <div className="flex gap-2">
                    <span className="text-red-400 font-bold text-xs">2</span>
                    <span className="text-green-400 font-bold text-xs">1</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tutorial Dialog Overlay */}
      <div className="absolute bottom-8 right-8 max-w-sm bg-black/80 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in slide-in-from-right-8 fade-in duration-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#F2A900]/20 flex items-center justify-center">
            <span className="text-[#F2A900] font-bold font-num">{step + 1}</span>
          </div>
          <h2 className="text-xl font-bold font-display text-white">{current.title}</h2>
        </div>
        <p className="text-white/70 leading-relaxed mb-6 text-sm">{current.text}</p>
        
        {current.actionText && (
          <button 
            onClick={current.onAction}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#F2A900] to-[#FFD700] text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wider text-sm shadow-[0_0_20px_rgba(242,169,0,0.3)]"
          >
            {current.actionText}
            {step === steps.length - 1 ? <CheckCircle className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        )}
        {!current.actionText && (
          <div className="w-full text-center text-[#F2A900] animate-pulse text-sm font-bold uppercase tracking-widest border border-[#F2A900]/30 rounded-xl py-3 bg-[#F2A900]/10">
            Awaiting Action...
          </div>
        )}
      </div>
    </div>
  );
}
