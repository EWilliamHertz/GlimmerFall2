import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Format a number with thin non-breaking spaces every 3 digits (1 250, 12 300).
const fmt = (n) => String(Math.max(0, n | 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");

/**
 * A shiny hand-drawn crystal SVG. Used inline in the navbar purse widget.
 */
export function GlimmerCrystal({ size = 20 }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      style={{ filter: "drop-shadow(0 0 6px #00BFFF) drop-shadow(0 0 2px #F2A900)" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gf-crystal-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B3F0FF" />
          <stop offset="45%" stopColor="#00BFFF" />
          <stop offset="100%" stopColor="#003a66" />
        </linearGradient>
        <linearGradient id="gf-crystal-b" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Faceted crystal */}
      <polygon
        points="16,2 27,11 23,29 9,29 5,11"
        fill="url(#gf-crystal-a)"
        stroke="#7FDBFF"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Inner facet lines */}
      <polyline
        points="16,2 16,29 5,11 27,11 16,29"
        fill="none"
        stroke="#B3F0FF"
        strokeWidth="0.5"
        opacity="0.7"
      />
      {/* Sheen */}
      <polygon
        points="10,6 15,4 17,12 12,14"
        fill="url(#gf-crystal-b)"
        opacity="0.65"
      />
    </svg>
  );
}

const SOURCE_LABEL = {
  quest: "Quest Reward",
  referral: "Referral Bonus",
  referral_bonus: "Joined via Referral",
  signup_bonus: "Welcome Bonus",
  shop_redemption: "Shop Discount",
  admin_grant: "Admin Grant",
  refund: "Refund",
};

function GlimmerHistoryModal({ onClose, balance, referralCode }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/glimmer/transactions")
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.response?.data?.detail || "Failed to load history"));
  }, []);

  const copyLink = async () => {
    if (!referralCode) return;
    const url = `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {}
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.92, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="glass-strong rounded-3xl w-full max-w-lg border border-[#00BFFF]/25 shadow-[0_0_60px_rgba(0,191,255,0.15)] overflow-hidden"
        >
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-[#001a2a] to-[#000]">
            <div className="flex items-center gap-3">
              <GlimmerCrystal size={38} />
              <div>
                <div className="text-white/50 text-xs font-head uppercase tracking-widest">Glimmer Balance</div>
                <div className="text-3xl font-num font-black text-[#7FDBFF] tabular-nums leading-tight">{fmt(balance)}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {referralCode && (
            <div className="px-6 py-4 border-b border-white/10 bg-black/30">
              <div className="text-[10px] font-head uppercase tracking-widest text-white/40 mb-1.5">Your Referral Link</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate text-xs font-mono text-[#F2A900] bg-black/40 rounded-lg px-3 py-2 border border-[#F2A900]/20">
                  {`${window.location.origin}/?ref=${referralCode}`}
                </code>
                <button
                  onClick={copyLink}
                  className="px-3 py-2 rounded-lg bg-[#F2A900]/20 text-[#F2A900] hover:bg-[#F2A900]/30 font-head text-xs font-bold"
                >
                  Copy
                </button>
              </div>
              <p className="text-[11px] text-white/40 mt-2 leading-relaxed">
                Share this link. When a friend registers and <span className="text-[#7FDBFF]">verifies their email</span>, you both earn Glimmer.
              </p>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-4">
            {error && <div className="text-red-400 text-sm p-4">{error}</div>}
            {!error && rows == null && (
              <div className="p-6 text-white/40 text-sm text-center">Loading…</div>
            )}
            {!error && rows && rows.length === 0 && (
              <div className="p-6 text-white/40 text-sm text-center italic">
                No transactions yet. Complete a Daily Quest or invite a friend to earn Glimmer.
              </div>
            )}
            {!error && rows && rows.length > 0 && (
              <ul className="space-y-1.5">
                {rows.map((r) => {
                  const positive = r.amount > 0;
                  const Icon = positive ? TrendingUp : TrendingDown;
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/30 border border-white/5"
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${positive ? "text-[#22E07B]" : "text-red-400"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-head text-sm text-white/90 truncate">
                          {SOURCE_LABEL[r.source] || r.source}
                        </div>
                        {r.memo && (
                          <div className="text-[11px] text-white/40 truncate">{r.memo}</div>
                        )}
                      </div>
                      <div
                        className={`font-num text-sm font-bold tabular-nums whitespace-nowrap ${
                          positive ? "text-[#7FDBFF]" : "text-red-400"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {fmt(r.amount)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * GlimmerPurse — the shiny crystal + balance widget for the Navbar.
 * Only renders when a user is logged in. Polls balance every 60s.
 */
export default function GlimmerPurse() {
  const { user, updateUser } = useAuth();
  const [balance, setBalance] = useState(user?.glimmer_balance ?? 0);
  const [refCode, setRefCode] = useState(user?.referral_code ?? null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api.get("/glimmer/balance");
      setBalance(r.data.balance ?? 0);
      setRefCode(r.data.referral_code || refCode);
      if (updateUser) updateUser({ glimmer_balance: r.data.balance ?? 0, referral_code: r.data.referral_code });
    } catch (e) {}
  }, [user, updateUser, refCode]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const onGrant = () => refresh();
    window.addEventListener("gf-glimmer-changed", onGrant);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("gf-glimmer-changed", onGrant);
    };
  }, [refresh]);

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Glimmer balance: ${balance}. Click to view history.`}
        data-testid="glimmer-purse"
        className="hidden md:flex items-center gap-2 h-8 pl-2 pr-3 rounded-full glass border border-[#00BFFF]/25 hover:border-[#00BFFF]/60 transition-all shadow-[0_0_15px_rgba(0,191,255,0.12)] hover:shadow-[0_0_18px_rgba(0,191,255,0.35)]"
      >
        <motion.span
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          <GlimmerCrystal size={20} />
        </motion.span>
        <span className="font-num text-sm font-bold text-[#7FDBFF] tabular-nums leading-none">
          {fmt(balance)}
        </span>
      </button>

      {open && (
        <GlimmerHistoryModal onClose={() => setOpen(false)} balance={balance} referralCode={refCode} />
      )}
    </>
  );
}
