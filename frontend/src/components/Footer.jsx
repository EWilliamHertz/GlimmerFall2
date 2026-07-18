import React from "react";
import { Link } from "react-router-dom";
import { LOGO } from "@/lib/factions";

export const Footer = () => (
  <footer className="mt-16 border-t border-white/10 glass">
    <div className="max-w-7xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <img src={LOGO} alt="GlimmerFall" className="w-10 h-10 object-contain" />
        <div>
          <div className="font-display text-lg font-bold">GLIMMER<span className="text-[#F2A900]">FALL</span></div>
          <div className="text-white/40 text-xs font-head">The Awakening · A Trading Card Game</div>
        </div>
      </div>
      <div className="flex items-center gap-6 text-sm font-head text-white/50">
        <Link to="/cards" className="hover:text-white transition-colors">Cards</Link>
        <Link to="/rules" className="hover:text-white transition-colors">Rules</Link>
        <Link to="/decks" className="hover:text-white transition-colors">Decks</Link>
        <Link to="/booster" className="hover:text-white transition-colors">Booster</Link>
      </div>
      <p className="text-white/30 text-xs font-head">© {new Date().getFullYear()} GlimmerFall TCG</p>
    </div>
    {/* subtle mass-print link */}
    <div className="text-center pb-4">
      <Link to="/print" data-testid="footer-print-link" className="text-[10px] text-white/15 hover:text-white/40 transition-colors">print</Link>
    </div>
  </footer>
);

export default Footer;
