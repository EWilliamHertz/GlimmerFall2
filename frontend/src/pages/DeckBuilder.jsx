import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, Save, Download, Printer, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { FACTIONS, factionCfg } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";

const DECK_MAX = 40;
const COPY_MAX = 3;
const STORE_KEY = "glimmerfall_decks";
const PRINT_DECK_KEY = "gf_print_deck";

export default function DeckBuilder() {
  const [cards, setCards] = useState([]);
  const [q, setQ] = useState("");
  const [faction, setFaction] = useState(null);
  const [deck, setDeck] = useState({}); // cardId -> {card, count}
  const [deckName, setDeckName] = useState("New Deck");
  const [saved, setSaved] = useState([]);
  const [starters, setStarters] = useState([]);

  useEffect(() => {
    api.get("/cards").then((r) => setCards(r.data)).catch(() => {});
    api.get("/starter-decks").then((r) => setStarters(r.data)).catch(() => {});
    try {
      setSaved(JSON.parse(localStorage.getItem(STORE_KEY) || "[]"));
    } catch {
      setSaved([]);
    }
  }, []);

  const total = useMemo(() => Object.values(deck).reduce((s, e) => s + e.count, 0), [deck]);

  const filtered = useMemo(
    () =>
      cards.filter((c) => {
        if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
        if (faction && c.faction !== faction) return false;
        return true;
      }),
    [cards, q, faction]
  );

  const add = (card) => {
    setDeck((d) => {
      const cur = d[card.id]?.count || 0;
      if (total >= DECK_MAX) {
        toast.error(`Deck is full (${DECK_MAX} cards).`);
        return d;
      }
      if (cur >= COPY_MAX) {
        toast.error("Max 3 copies of a card.");
        return d;
      }
      return { ...d, [card.id]: { card, count: cur + 1 } };
    });
  };

  const remove = (cardId) => {
    setDeck((d) => {
      const cur = d[cardId]?.count || 0;
      if (cur <= 1) {
        const nd = { ...d };
        delete nd[cardId];
        return nd;
      }
      return { ...d, [cardId]: { ...d[cardId], count: cur - 1 } };
    });
  };

  const curve = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0, 0]; // 0,1,2,3,4,5,6+
    Object.values(deck).forEach(({ card, count }) => {
      const c = Math.min(6, Number(card.cost) || 0);
      buckets[c] += count;
    });
    return buckets;
  }, [deck]);
  const maxCurve = Math.max(1, ...curve);

  const factionCounts = useMemo(() => {
    const m = {};
    Object.values(deck).forEach(({ card, count }) => (m[card.faction] = (m[card.faction] || 0) + count));
    return m;
  }, [deck]);

  const saveDeck = () => {
    if (total === 0) return toast.error("Add some cards first.");
    const entry = {
      id: Date.now(),
      name: deckName || "Untitled",
      cards: Object.values(deck).map(({ card, count }) => ({ id: card.id, name: card.name, count })),
    };
    const next = [entry, ...saved].slice(0, 20);
    setSaved(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    toast.success(`Saved "${entry.name}" (${total} cards).`);
  };

  const loadDeck = (entry) => {
    const nd = {};
    entry.cards.forEach((e) => {
      const card = cards.find((c) => c.id === e.id);
      if (card) nd[card.id] = { card, count: e.count };
    });
    setDeck(nd);
    setDeckName(entry.name);
    toast.success(`Loaded "${entry.name}".`);
  };

  const loadStarter = (sd) => {
    const nd = {};
    (sd.cards || []).forEach((e) => {
      const card = cards.find((c) => c.name === e.card_name);
      if (card) nd[card.id] = { card, count: Math.min(COPY_MAX, e.count || 1) };
    });
    if (!Object.keys(nd).length) return toast.error("Deck cards not found.");
    setDeck(nd);
    setDeckName(sd.deck_name);
    toast.success(`Loaded starter deck "${sd.deck_name}".`);
  };

  const printProxy = (entry) => {
    const payload = entry
      ? { name: entry.name, cards: entry.cards.map((c) => ({ id: c.id, count: c.count })) }
      : { name: deckName || "Custom Deck", cards: Object.values(deck).map(({ card, count }) => ({ id: card.id, count })) };
    if (!payload.cards.length) return toast.error("Add cards to print.");
    localStorage.setItem(PRINT_DECK_KEY, JSON.stringify(payload));
    window.open("/print?src=deck", "_blank");
  };

  return (
    <div data-testid="deckbuilder-page" className="max-w-7xl mx-auto px-5 py-10">
      <h1 className="font-display text-4xl md:text-5xl font-bold mb-2">Deck Builder</h1>
      <p className="text-white/50 font-head mb-8">Forge your deck — up to {DECK_MAX} cards, max 3 copies each.</p>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* gallery */}
        <div>
          <div className="glass rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                data-testid="deck-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search cards..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#F2A900]/60"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFaction(null)} className={`px-3 py-1.5 rounded-full text-xs font-head border ${!faction ? "bg-white text-black" : "border-white/15 text-white/60"}`}>All</button>
              {Object.values(FACTIONS).map((f) => (
                <button
                  key={f.name}
                  data-testid={`deck-faction-${f.name.toLowerCase()}`}
                  onClick={() => setFaction(faction === f.name ? null : f.name)}
                  className="px-3 py-1.5 rounded-full text-xs font-head border transition-all"
                  style={faction === f.name ? { background: f.color, borderColor: f.color, color: "#000" } : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-5 justify-items-center">
            {filtered.map((c) => {
              const count = deck[c.id]?.count || 0;
              return (
                <div key={c.id} className="relative">
                  <CardTemplate card={c} size="sm" onClick={() => add(c)} testId={`deck-pool-${c.collector_number}`} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 rounded-full bg-[#F2A900] text-black font-num font-bold text-sm flex items-center justify-center border-2 border-[#0B0C10]">
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* deck panel */}
        <div className="lg:sticky lg:top-20 self-start space-y-4">
          <div className="glass rounded-2xl p-5">
            <input
              data-testid="deck-name-input"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              className="w-full bg-transparent font-display text-xl font-bold outline-none border-b border-white/10 pb-2 mb-3 focus:border-[#F2A900]"
            />
            <div className="flex items-center justify-between mb-3">
              <span className="font-head text-sm text-white/60">Cards</span>
              <span className="font-num text-lg font-bold" data-testid="deck-count">
                <span className={total === DECK_MAX ? "text-[#22E07B]" : "text-white"}>{total}</span>
                <span className="text-white/40"> / {DECK_MAX}</span>
              </span>
            </div>

            {/* faction identity */}
            <div className="flex gap-1.5 mb-4">
              {Object.entries(factionCounts).map(([fac, n]) => (
                <span key={fac} className="text-[10px] font-head px-2 py-0.5 rounded" style={{ background: `${factionCfg(fac).color}22`, color: factionCfg(fac).color }}>
                  {fac} {n}
                </span>
              ))}
            </div>

            {/* mana curve */}
            <div className="mb-4">
              <p className="text-xs font-head text-white/40 mb-1.5">Energy Curve</p>
              <div className="flex items-end gap-1 h-16">
                {curve.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-[#00BFFF]/70 transition-all" style={{ height: `${(v / maxCurve) * 100}%`, minHeight: v ? 4 : 0 }} />
                    <span className="text-[9px] text-white/40 font-num">{i === 6 ? "6+" : i}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={saveDeck} data-testid="deck-save-btn" className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F2A900] text-black font-head font-semibold text-sm hover:bg-[#ffc21f]">
                <Save className="w-4 h-4" /> Save
              </button>
              <button onClick={() => printProxy(null)} data-testid="deck-print-btn" title="Print proxy sheet" className="px-4 py-2.5 rounded-xl bg-[#00BFFF]/20 text-[#7FDBFF] hover:bg-[#00BFFF]/30 text-sm font-head inline-flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> Proxy
              </button>
              <button onClick={() => { setDeck({}); setDeckName("New Deck"); }} className="px-4 py-2.5 rounded-xl glass hover:border-white/25 text-sm font-head">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* starter / tournament decks */}
          {starters.length > 0 && (
            <div className="glass rounded-2xl p-4" data-testid="starter-decks">
              <p className="font-head text-sm text-white/60 mb-2 flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> Starter &amp; Tournament Decks</p>
              <div className="space-y-1.5">
                {starters.map((sd) => (
                  <button
                    key={sd.id}
                    onClick={() => loadStarter(sd)}
                    data-testid={`starter-deck-${sd.id}`}
                    className="w-full text-left px-3 py-2 rounded-lg bg-black/30 hover:bg-black/50 transition-colors"
                  >
                    <div className="font-head text-sm font-semibold">{sd.deck_name}</div>
                    <div className="text-white/40 text-xs line-clamp-1">{sd.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* deck list */}
          <div className="glass rounded-2xl p-4 max-h-[340px] overflow-y-auto">
            {total === 0 ? (
              <p className="text-white/40 text-sm text-center py-8 font-head">Click cards to add them.</p>
            ) : (
              <div className="space-y-1.5" data-testid="deck-list">
                {Object.values(deck)
                  .sort((a, b) => (Number(a.card.cost) || 0) - (Number(b.card.cost) || 0))
                  .map(({ card, count }) => {
                    const f = factionCfg(card.faction);
                    return (
                      <div key={card.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: `${f.color}12` }}>
                        <span className="w-6 h-6 rounded flex items-center justify-center font-num font-bold text-xs text-black" style={{ background: f.color }}>{card.cost}</span>
                        <span className="flex-1 text-sm truncate font-head">{card.name}</span>
                        <button onClick={() => remove(card.id)} className="text-white/50 hover:text-white"><Minus className="w-4 h-4" /></button>
                        <span className="font-num text-sm w-4 text-center">{count}</span>
                        <button onClick={() => add(card)} className="text-white/50 hover:text-white"><Plus className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* saved decks */}
          {saved.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <p className="font-head text-sm text-white/60 mb-2">Saved Decks</p>
              <div className="space-y-1.5">
                {saved.map((d) => (
                  <div key={d.id} className="flex items-center gap-1.5">
                    <button onClick={() => loadDeck(d)} data-testid={`saved-deck-${d.id}`} className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg bg-black/30 hover:bg-black/50 text-sm font-head">
                      <span className="truncate">{d.name}</span>
                      <span className="text-white/40 inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" /> {d.cards.reduce((s, c) => s + c.count, 0)}</span>
                    </button>
                    <button onClick={() => printProxy(d)} data-testid={`saved-deck-print-${d.id}`} title="Print proxy" className="px-2.5 py-2 rounded-lg bg-[#00BFFF]/20 text-[#7FDBFF] hover:bg-[#00BFFF]/30">
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
