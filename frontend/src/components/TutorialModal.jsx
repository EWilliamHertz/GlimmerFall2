import React from "react";
import { Link } from "react-router-dom";
import { X, BookOpen, GraduationCap, Zap, Swords, Shield, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { KEYWORDS } from "@/lib/factions";

export default function TutorialModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl pb-safe"
        >
          <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 shrink-0">
            <h2 className="text-lg sm:text-xl font-display font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F2A900]" /> Tactical Quick Reference
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-white/80 font-head">
            <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 space-y-1.5">
              <div className="font-bold text-[#F2A900] flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Turn Checklist (Any Order!)
              </div>
              <p>• <b>Draw 1 Card</b> by tapping the Draw button.</p>
              <p>• <b>Charge 1 Glimmer Node</b> by selecting any card in hand → <b>Charge as Node (+1)</b>.</p>
              <p>• <b>Deploy &amp; Strike:</b> Entities enter ready immediately! Tap your Entity, then tap an Enemy Guard or Nexus.</p>
              <p>• <b>Flash Spells:</b> Can be cast even during your opponent's turn if you leave Energy open!</p>
            </div>

            <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 space-y-1.5">
              <div className="font-bold text-[#00BFFF] flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Keywords Cheat Sheet
              </div>
              {Object.entries(KEYWORDS).map(([kw, desc]) => (
                <p key={kw}>
                  <b className="text-white">{kw}:</b> <span className="text-white/65">{desc}</span>
                </p>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Link
                to="/sandbox"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-[#00BFFF] text-black font-bold text-center flex items-center justify-center gap-1.5"
              >
                <GraduationCap className="w-4 h-4" /> Interactive Tutorial
              </Link>
              <Link
                to="/learn"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-center flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-4 h-4 text-[#F2A900]" /> Full How-to-Play Guide
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
