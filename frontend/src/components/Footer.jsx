import React from "react";
import { Link } from "react-router-dom";
import { LOGO } from "@/lib/factions";
import { Instagram } from "lucide-react";

export const Footer = () => (
  <footer className="mt-16 border-t border-white/10 glass print:hidden">
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
        <Link to="/support" className="hover:text-white transition-colors text-[#F2A900]">Support</Link>
      </div>
      <div className="flex items-center gap-4 text-white/50">
        <a href="https://discord.gg/VYBjkJCzHw" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="Discord">
          <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="currentColor">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a67.55,67.55,0,0,1-10.87,5.19,77.02,77.02,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.2,46,96.12,53,91.08,65.69,84.69,65.69Z" />
          </svg>
        </a>
        <a href="https://instagram.com/GlimmerFallTCG" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" aria-label="Instagram">
          <Instagram className="w-6 h-6" />
        </a>
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
