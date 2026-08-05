import React from "react";
import { X, Play, Book, Settings, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TutorialModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl"
        >
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/20">
            <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
              <Book className="w-6 h-6 text-[#F2A900]" /> Welcome to GlimmerFall
            </h2>
            <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-white/80 font-head">
            <section className="space-y-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#00BFFF]" /> Glimmer Nodes & Resonance Zone
              </h3>
              <p>
                In GlimmerFall, managing your resources is key. Your Glimmer nodes are placed into the Resonance zone to generate the resources you need to play cards. You can play one Glimmer node per turn from your hand into the Resonance zone. Think of them as your mana pool!
              </p>
            </section>
            
            <section className="space-y-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="w-5 h-5 text-[#00BFFF]" /> Drawing & Playing Cards
              </h3>
              <p>
                At the beginning of your turn, you automatically draw a card. To play a card from your hand, you must have enough activated Glimmer nodes in your Resonance zone that match the card's cost. Simply click on a card in your hand and select a valid target or zone to play it.
              </p>
            </section>
            
            <section className="space-y-2 bg-[#F2A900]/10 p-4 rounded-xl border border-[#F2A900]/30">
              <h3 className="text-lg font-bold text-[#F2A900] flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> Alpha Feedback
              </h3>
              <p>
                We are currently in the Alpha phase of GlimmerFall. If you encounter any bugs, weird interactions, or have suggestions, please use the Feedback button located in the Game Arena or Dashboard. This sends your report directly to the Admin panel so our team can review and fix it!
              </p>
            </section>
          </div>
          
          <div className="p-4 border-t border-white/10 flex justify-between bg-black/20">
            <button
              onClick={() => {
                onClose();
                window.location.href = "/sandbox";
              }}
              className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors shadow-lg flex items-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" /> Play Interactive Tutorial
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#F2A900] text-black font-bold rounded-lg hover:bg-[#ffc21f] transition-colors shadow-lg"
            >
              Got it, let's play!
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
