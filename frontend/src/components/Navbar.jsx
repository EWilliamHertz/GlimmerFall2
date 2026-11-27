import React, { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  ChevronDown,
  Swords,
  Layers,
  Library,
  BookOpen,
  User,
  Trophy,
  Sparkles,
  ShoppingBag,
  GraduationCap,
} from "lucide-react";
import { LOGO } from "@/lib/factions";
import { useAuth } from "@/lib/auth";
import AuthModal from "@/components/AuthModal";
import GlimmerPurse from "@/components/GlimmerPurse";
import TutorialModal from "@/components/TutorialModal";

const NAV_GROUPS = [
  {
    label: "Play",
    links: [
      { to: "/play", label: "Enter Arena", id: "arena" },
      { to: "/sandbox", label: "Interactive Tutorial", id: "sandbox" },
      { to: "/decks", label: "Deck Hub & Builder", id: "decks" },
      { to: "/booster", label: "Booster Simulator", id: "booster" },
      { to: "/playtest", label: "Print & Playtest", id: "playtest" },
    ],
  },
  {
    label: "Learn & Lore",
    links: [
      { to: "/learn", label: "How to Play Guide", id: "learn" },
      { to: "/rules", label: "Full Rulebook", id: "rules" },
      { to: "/cards", label: "Card Oracle", id: "cards" },
      { to: "/codex", label: "Lore Codex", id: "codex" },
    ],
  },
  {
    label: "Community",
    links: [
      { to: "/leaderboard", label: "Ranked Ladder", id: "leaderboard" },
      { to: "/community", label: "Community Hub", id: "community" },
      { to: "/community#giveaway", label: "Giveaway", id: "giveaway" },
    ],
  },
  {
    label: "Store",
    to: "/shop",
    id: "shop",
  },
];

export const Navbar = ({ inActiveMatch = false }) => {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onOpenAuth = (e) => {
      setAuthMode(e?.detail?.mode === "register" ? "register" : "login");
      setAuthOpen(true);
    };
    const onOpenTips = () => setTutorialOpen(true);
    window.addEventListener("gf-open-auth", onOpenAuth);
    window.addEventListener("gf-open-tips", onOpenTips);
    return () => {
      window.removeEventListener("gf-open-auth", onOpenAuth);
      window.removeEventListener("gf-open-tips", onOpenTips);
    };
  }, []);

  const mobileTabs = [
    { to: "/play", label: "Play", icon: Swords, match: (p) => p === "/play" },
    { to: "/decks", label: "Decks", icon: Layers, match: (p) => p.startsWith("/decks") },
    { to: "/cards", label: "Cards", icon: Library, match: (p) => p.startsWith("/cards") },
    {
      to: "/learn",
      label: "Learn",
      icon: BookOpen,
      match: (p) => p.startsWith("/learn") || p.startsWith("/rules"),
    },
  ];

  return (
    <>
      {!inActiveMatch && (
        <header
          className={`fixed top-0 inset-x-0 z-[100] print:hidden pt-safe transition-all duration-300 ${
            isScrolled || open
              ? "bg-[#0B0C10]/90 border-b border-white/10 backdrop-blur-xl shadow-lg"
              : "bg-[#0B0C10]/65 backdrop-blur-md border-b border-white/5"
          }`}
        >
          <nav className="max-w-7xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-2">
            <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 group shrink-0">
              <img
                src={LOGO}
                alt="GlimmerFall"
                className="w-8 h-8 object-contain group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(56,204,255,0.5)]"
              />
              <span className="font-display text-lg sm:text-xl font-bold tracking-wide">
                GLIMMER<span className="text-[#F2A900]">FALL</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2">
              {NAV_GROUPS.map((group) =>
                group.links ? (
                  <div key={group.label} className="relative group">
                    <button className="flex items-center gap-1 px-3 py-1.5 font-head text-sm rounded-lg transition-colors text-white/70 hover:text-white">
                      {group.label}{" "}
                      <ChevronDown className="w-3.5 h-3.5 opacity-70 group-hover:rotate-180 transition-transform" />
                    </button>
                    <div className="absolute top-full left-0 mt-1.5 w-52 bg-[#0B0C10]/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1.5">
                      {group.links.map((l) => (
                        <NavLink
                          key={l.to}
                          to={l.to}
                          data-testid={`nav-${l.id}`}
                          className={({ isActive }) =>
                            `px-3.5 py-2 font-head text-sm rounded-lg transition-colors ${
                              isActive
                                ? "bg-[#F2A900]/15 text-[#F2A900] font-semibold"
                                : "text-white/70 hover:text-white hover:bg-white/5"
                            }`
                          }
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
                        isActive ? "text-white font-semibold" : "text-white/70 hover:text-white"
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
              )}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-2.5">
              <Link
                to="/sandbox"
                className="px-3.5 py-1.5 rounded-full font-head text-xs font-semibold text-[#00BFFF] bg-[#00BFFF]/10 hover:bg-[#00BFFF]/20 transition-colors border border-[#00BFFF]/30 flex items-center gap-1.5"
              >
                <GraduationCap className="w-3.5 h-3.5" /> Tutorial
              </Link>
              {user ? (
                <div className="flex items-center gap-2.5">
                  <GlimmerPurse />
                  <Link
                    to="/dashboard"
                    data-testid="nav-dashboard"
                    className="px-4 py-1.5 rounded-full font-head text-sm font-semibold text-black bg-[#00BFFF] hover:bg-[#20caff] transition-colors shadow-[0_0_20px_rgba(0,191,255,0.35)]"
                  >
                    {user.nickname}
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthOpen(true);
                  }}
                  data-testid="nav-auth-cta"
                  className="px-4 py-1.5 rounded-full font-head text-sm font-semibold text-black bg-[#F2A900] hover:bg-[#ffc21f] transition-colors shadow-[0_0_20px_rgba(242,169,0,0.35)]"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Mobile Header Right Controls */}
            <div className="flex md:hidden items-center gap-2">
              {user ? (
                <GlimmerPurse />
              ) : (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthOpen(true);
                  }}
                  data-testid="nav-mobile-signin"
                  className="px-3 py-1.5 rounded-full font-head text-xs font-bold text-black bg-[#F2A900] active:scale-95 transition-transform"
                >
                  Sign In
                </button>
              )}
              <button
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:bg-white/10"
                onClick={() => setOpen((v) => !v)}
                aria-label="Toggle navigation menu"
                data-testid="nav-mobile-toggle"
              >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </nav>

          {/* Mobile Slide-Down Drawer */}
          {open && (
            <div className="md:hidden bg-[#0B0C10]/98 backdrop-blur-2xl border-t border-white/10 px-4 py-4 flex flex-col gap-4 max-h-[calc(100dvh-3.5rem)] overflow-y-auto pb-24">
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  to="/sandbox"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[#00BFFF]/15 border border-[#00BFFF]/30 text-[#00BFFF] font-head text-xs font-bold"
                >
                  <GraduationCap className="w-4 h-4 shrink-0" /> Interactive Tutorial
                </Link>
                <Link
                  to="/leaderboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-[#F2A900]/15 border border-[#F2A900]/30 text-[#F2A900] font-head text-xs font-bold"
                >
                  <Trophy className="w-4 h-4 shrink-0" /> Ranked Ladder
                </Link>
              </div>

              {NAV_GROUPS.map((group) =>
                group.links ? (
                  <div key={group.label} className="flex flex-col gap-1">
                    <div className="font-display font-bold text-white/40 uppercase tracking-widest text-[11px] px-1 mb-0.5">
                      {group.label}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.links.map((l) => (
                        <NavLink
                          key={l.to}
                          to={l.to}
                          onClick={() => setOpen(false)}
                          className={({ isActive }) =>
                            `px-3 py-2.5 rounded-xl font-head text-sm transition-colors ${
                              isActive
                                ? "bg-white/10 text-[#F2A900] font-semibold border border-[#F2A900]/30"
                                : "bg-white/[0.03] text-white/80 border border-white/5"
                            }`
                          }
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
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-[#F2A900]/15 to-[#9B30FF]/15 border border-white/10 font-head font-bold text-sm text-white"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-[#F2A900]" /> First Edition Store
                    </span>
                    <Sparkles className="w-4 h-4 text-[#F2A900]" />
                  </NavLink>
                )
              )}

              <div className="pt-2 border-t border-white/10 flex gap-2">
                {user ? (
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="w-full py-3 rounded-xl bg-[#00BFFF] text-black font-head font-bold text-sm text-center"
                  >
                    Open Player Dashboard ({user.nickname})
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setOpen(false);
                        setAuthMode("login");
                        setAuthOpen(true);
                      }}
                      className="flex-1 py-3 rounded-xl bg-[#F2A900] text-black font-head font-bold text-sm"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        setAuthMode("register");
                        setAuthOpen(true);
                      }}
                      className="flex-1 py-3 rounded-xl bg-[#00BFFF]/20 border border-[#00BFFF]/40 text-[#00BFFF] font-head font-bold text-sm"
                    >
                      Create Account
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </header>
      )}

      {/* Mobile Bottom Tab Bar (hidden on md+ and during active board match) */}
      {!inActiveMatch && (
        <nav
          aria-label="Mobile primary navigation"
          data-testid="mobile-bottom-nav"
          className="md:hidden fixed bottom-0 inset-x-0 z-[95] print:hidden bg-[#0B0C10]/95 backdrop-blur-2xl border-t border-white/10 pb-safe"
        >
          <div className="grid grid-cols-5 h-14 px-1">
            {mobileTabs.map((t) => {
              const Icon = t.icon;
              const active = t.match(pathname);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                    active ? "text-[#F2A900]" : "text-white/50 active:text-white"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_8px_rgba(242,169,0,0.7)]" : ""}`} />
                  <span className="text-[10px] font-head font-semibold leading-none">{t.label}</span>
                </Link>
              );
            })}
            {user ? (
              <Link
                to="/dashboard"
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                  pathname.startsWith("/dashboard") || pathname.startsWith("/profile")
                    ? "text-[#00BFFF]"
                    : "text-white/50 active:text-white"
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] font-head font-semibold leading-none truncate max-w-[56px]">
                  {user.nickname}
                </span>
              </Link>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                className="flex flex-col items-center justify-center gap-0.5 rounded-xl text-white/50 active:text-white"
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] font-head font-semibold leading-none">Account</span>
              </button>
            )}
          </div>
        </nav>
      )}

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
      <TutorialModal isOpen={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </>
  );
};

export default Navbar;
