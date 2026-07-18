import React, { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { LOGO } from "@/lib/factions";
import { useAuth } from "@/lib/auth";
import AuthModal from "@/components/AuthModal";

const LINKS = [
  { to: "/play", label: "Arena", id: "arena" },
  { to: "/cards", label: "Cards", id: "cards" },
  { to: "/decks", label: "Deck Builder", id: "decks" },
  { to: "/booster", label: "Booster", id: "booster" },
  { to: "/rules", label: "Rulebook", id: "rules" },
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();
  return (
    <>
    <header className="fixed top-0 inset-x-0 z-50 glass-strong">
      <nav className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2.5 group">
          <img src={LOGO} alt="GlimmerFall" className="w-9 h-9 object-contain group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(56,204,255,0.5)]" />
          <span className="font-display text-xl font-bold tracking-wide">
            GLIMMER<span className="text-[#F2A900]">FALL</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={`nav-${l.id}`}
              className={({ isActive }) =>
                `relative px-4 py-2 font-head text-sm rounded-lg transition-colors ${
                  isActive ? "text-white" : "text-white/60 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {l.label}
                  {isActive && (
                    <span className="absolute left-3 right-3 -bottom-0.5 h-[2px] bg-[#F2A900] rounded-full shadow-[0_0_10px_rgba(242,169,0,0.9)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {user ? (
          <Link
            to="/dashboard"
            data-testid="nav-dashboard"
            className="hidden md:block px-5 py-2 rounded-full font-head text-sm font-semibold text-black bg-[#00BFFF] hover:bg-[#20caff] transition-colors shadow-[0_0_20px_rgba(0,191,255,0.4)]"
          >
            Dashboard
          </Link>
        ) : (
          <button
            onClick={() => setAuthOpen(true)}
            data-testid="nav-auth-cta"
            className="hidden md:block px-5 py-2 rounded-full font-head text-sm font-semibold text-black bg-[#F2A900] hover:bg-[#ffc21f] transition-colors shadow-[0_0_20px_rgba(242,169,0,0.4)]"
          >
            Register / Login
          </button>
        )}

        <button
          className="md:hidden text-white"
          onClick={() => setOpen((v) => !v)}
          data-testid="nav-mobile-toggle"
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      {open && (
        <div className="md:hidden glass-strong border-t border-white/10 px-5 py-3 flex flex-col gap-1">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="py-2 font-head text-white/80"
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
    <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
};

export default Navbar;
