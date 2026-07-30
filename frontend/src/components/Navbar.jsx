import React, { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { LOGO } from "@/lib/factions";
import { useAuth } from "@/lib/auth";
import AuthModal from "@/components/AuthModal";

const NAV_GROUPS = [
  {
    label: "Play",
    links: [
      { to: "/play", label: "Arena", id: "arena" },
      { to: "/decks", label: "Deck Builder", id: "decks" },
      { to: "/booster", label: "Booster", id: "booster" },
    ]
  },
  {
    label: "Universe",
    links: [
      { to: "/cards", label: "Cards", id: "cards" },
      { to: "/codex", label: "Lore Codex", id: "codex" },
      { to: "/rules", label: "Rulebook", id: "rules" },
    ]
  },
  {
    label: "Community",
    to: "/community",
    id: "community"
  },
  {
    label: "Store",
    to: "/shop",
    id: "shop"
  }
];

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
    <header className={`fixed top-0 inset-x-0 z-[100] print:hidden transition-all duration-300 ${isScrolled ? "bg-white/5 border-b border-white/10 backdrop-blur-xl shadow-lg" : "bg-transparent border-transparent"}`}>
      <nav className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2.5 group">
          <img src={LOGO} alt="GlimmerFall" className="w-8 h-8 object-contain group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(56,204,255,0.5)]" />
          <span className="font-display text-xl font-bold tracking-wide">
            GLIMMER<span className="text-[#F2A900]">FALL</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2">
          {NAV_GROUPS.map((group) => (
            group.links ? (
              <div key={group.label} className="relative group">
                <button className="flex items-center gap-1 px-3 py-1.5 font-head text-sm rounded-lg transition-colors text-white/60 hover:text-white">
                  {group.label} <ChevronDown className="w-3.5 h-3.5 opacity-70 group-hover:rotate-180 transition-transform" />
                </button>
                <div className="absolute top-full left-0 mt-2 w-48 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-2">
                  {group.links.map(l => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      data-testid={`nav-${l.id}`}
                      className={({ isActive }) => `px-4 py-2 font-head text-sm rounded-lg transition-colors ${isActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                    >
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <NavLink
                key={group.to}
                to={group.to}
                data-testid={`nav-${group.id}`}
                className={({ isActive }) =>
                  `relative px-3 py-1.5 font-head text-sm rounded-lg transition-colors ${
                    isActive ? "text-white" : "text-white/60 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {group.label}
                    {isActive && (
                      <span className="absolute left-3 right-3 -bottom-0.5 h-[2px] bg-[#F2A900] rounded-full shadow-[0_0_10px_rgba(242,169,0,0.9)]" />
                    )}
                  </>
                )}
              </NavLink>
            )
          ))}
        </div>

        {/* CTA */}
        {user ? (
          <Link
            to="/dashboard"
            data-testid="nav-dashboard"
            className="hidden md:block px-4 py-1.5 rounded-full font-head text-sm font-semibold text-black bg-[#00BFFF] hover:bg-[#20caff] transition-colors shadow-[0_0_20px_rgba(0,191,255,0.4)]"
          >
            Dashboard
          </Link>
        ) : (
          <button
            onClick={() => setAuthOpen(true)}
            data-testid="nav-auth-cta"
            className="hidden md:block px-4 py-1.5 rounded-full font-head text-sm font-semibold text-black bg-[#F2A900] hover:bg-[#ffc21f] transition-colors shadow-[0_0_20px_rgba(242,169,0,0.4)]"
          >
            Register / Login
          </button>
        )}

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white"
          onClick={() => setOpen((v) => !v)}
          data-testid="nav-mobile-toggle"
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Mobile Nav */}
      {open && (
        <div className="md:hidden bg-black/90 backdrop-blur-xl border-t border-white/10 px-5 py-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            group.links ? (
              <div key={group.label} className="flex flex-col gap-2">
                <div className="font-display font-bold text-white/40 uppercase tracking-widest text-xs mb-1">{group.label}</div>
                {group.links.map(l => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="py-1 font-head text-white/80 pl-2 border-l border-white/10"
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>
            ) : (
              <NavLink
                key={group.to}
                to={group.to}
                onClick={() => setOpen(false)}
                className="py-1 font-head text-white/80 font-display font-bold uppercase tracking-widest text-xs"
              >
                {group.label}
              </NavLink>
            )
          ))}
        </div>
      )}
    </header>
    <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
};

export default Navbar;
