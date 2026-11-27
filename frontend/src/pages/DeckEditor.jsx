import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Save,
  Download,
  Printer,
  BookOpen,
  Share2,
  Upload,
  Zap,
  Sword,
  Heart,
  Users,
  Activity,
  ChevronDown,
  ChevronUp,
  Layers,
  X,
  ArrowLeft,
} from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { api } from "@/lib/api";
import { FACTIONS, factionCfg } from "@/lib/factions";
import { useAuth } from "@/lib/auth";
import CardTemplate from "@/components/CardTemplate";
import DeckAnalytics from "@/components/DeckAnalytics";

const DECK_MAX = 40;
const COPY_MAX = 3;
const LEGACY_STORE_KEY = "glimmerfall_decks";
const PRINT_DECK_KEY = "gf_print_deck";

const CardTooltip = ({ card, children, side = "right" }) => {
  if (!card) return children;
  const f = factionCfg(card.faction);
  return (
    <HoverCard openDelay={200} closeDelay={0}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        sideOffset={8}
        className="hidden md:block w-72 bg-black/95 border border-white/20 shadow-2xl p-4 z-[90]"
      >
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-display text-xl font-bold" style={{ color: f.color }}>
            {card.name}
          </h4>
          <span
            className="text-[10px] font-head px-2 py-0.5 rounded-full"
            style={{ background: `${f.color}22`, color: f.color }}
          >
            {card.card_type}
          </span>
        </div>
        <div className="flex gap-4 mb-3 text-xs font-head">
          {card.cost !== null && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-[#F2A900]" /> {card.cost}
            </span>
          )}
          {card.power !== null && card.power !== "None" && (
            <span className="flex items-center gap-1">
              <Sword className="w-3 h-3 text-[#FF5252]" /> {card.power}
            </span>
          )}
          {card.health !== null && card.health !== "None" && (
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-[#22E07B]" /> {card.health}
            </span>
          )}
        </div>
        {card.keywords && card.keywords !== "None" && (
          <div className="mb-2 text-[11px] font-head font-bold text-[#00BFFF] uppercase tracking-wide">
            {card.keywords}
          </div>
        )}
        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
          {card.description || "No rules text."}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
};

export default function DeckEditor({ initialDeck, onExit }) {
  const [cards, setCards] = useState([]);
  const [q, setQ] = useState("");
  const [faction, setFaction] = useState(null);
  const [deck, setDeck] = useState({}); // cardId -> {card, count}
  const [deckName, setDeckName] = useState("New Deck");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [saved, setSaved] = useState([]);
  const [starters, setStarters] = useState([]);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    api
      .get("/cards")
      .then((r) => setCards(r.data))
      .catch(() => {});
    api
      .get("/starter-decks")
      .then((r) => setStarters(r.data))
      .catch(() => {});
    if (user) {
      api
        .get("/auth/me/decks")
        .then((r) => {
          setSaved(
            (r.data || []).map((d) => ({
              id: d.id,
              name: d.deck_name,
              server: true,
              is_public: d.is_public,
              cards: (d.cards || []).map((c) => ({
                id: c.card_id || c.card_name,
                name: c.card_name,
                count: c.count,
              })),
            }))
          );
        })
        .catch(() => setSaved([]));
    } else {
      try {
        setSaved(JSON.parse(localStorage.getItem(LEGACY_STORE_KEY) || "[]"));
      } catch {
        setSaved([]);
      }
    }
  }, [user]);

  useEffect(() => {
    if (initialDeck && initialDeck.cards && cards.length > 0 && !hasLoadedInitial) {
      const nd = {};
      initialDeck.cards.forEach((e) => {
        const card = cards.find((c) => c.id === e.id || c.name === e.name || c.name === e.id);
        if (card) nd[card.id] = { card, count: e.count };
      });
      setDeck(nd);
      setDeckName(initialDeck.name);
      setHasLoadedInitial(true);
    }
  }, [cards, initialDeck, hasLoadedInitial]);

  const total = useMemo(() => Object.values(deck).reduce((s, e) => s + e.count, 0), [deck]);

  const filtered = useMemo(
    () =>
      cards.filter((c) => {
        if (
          q &&
          !c.name.toLowerCase().includes(q.toLowerCase()) &&
          !(c.description || "").toLowerCase().includes(q.toLowerCase())
        )
          return false;
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

  const generateDeckCode = () => {
    if (total === 0) return toast.error("Deck is empty.");
    const payload = Object.values(deck)
      .map(({ card, count }) => `${card.id}:${count}`)
      .join(",");
    navigator.clipboard.writeText(btoa(payload));
    toast.success("Deck code copied to clipboard!");
  };

  const importDeckCode = () => {
    const code = prompt("Enter deck code:");
    if (!code) return;
    try {
      const payload = atob(code);
      const parts = payload.split(",");
      const nd = {};
      parts.forEach((p) => {
        const [id, count] = p.split(":");
        const card = cards.find((c) => String(c.id) === String(id));
        if (card) nd[card.id] = { card, count: Math.min(COPY_MAX, Number(count) || 1) };
      });
      setDeck(nd);
      toast.success("Deck imported!");
    } catch {
      toast.error("Invalid deck code.");
    }
  };

  const saveDeck = async () => {
    if (total === 0) return toast.error("Add some cards first.");
    if (user) {
      const payload = {
        deck_name: deckName || "Untitled",
        deck_cards: Object.values(deck).map(({ card, count }) => ({ card_name: card.name, count })),
      };
      try {
        if (initialDeck && initialDeck.server && initialDeck.id) {
          await api.put(`/auth/me/decks/${initialDeck.id}`, payload);
          toast.success(`Updated "${payload.deck_name}".`);
        } else {
          await api.post("/auth/me/decks", payload);
          toast.success(`Saved "${payload.deck_name}" (${total} cards).`);
        }
        const r = await api.get("/auth/me/decks");
        setSaved(
          (r.data || []).map((d) => ({
            id: d.id,
            name: d.deck_name,
            server: true,
            is_public: d.is_public,
            cards: (d.cards || []).map((c) => ({
              id: c.card_id || c.card_name,
              name: c.card_name,
              count: c.count,
            })),
          }))
        );
      } catch (e) {
        toast.error(e.response?.data?.detail || "Failed to save deck.");
      }
      return;
    }
    const entry = {
      id: Date.now(),
      name: deckName || "Untitled",
      cards: Object.values(deck).map(({ card, count }) => ({ id: card.id, name: card.name, count })),
    };
    const next = [entry, ...saved].slice(0, 20);
    setSaved(next);
    localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(next));
    toast.success(`Saved "${entry.name}" locally (sign in to sync).`);
  };

  const deleteSavedDeck = async (id) => {
    if (user) {
      try {
        await api.delete(`/auth/me/decks/${id}`);
        setSaved((prev) => prev.filter((d) => d.id !== id));
        toast.success("Deck deleted.");
      } catch (e) {
        toast.error(e.response?.data?.detail || "Failed to delete.");
      }
      return;
    }
    const next = saved.filter((d) => d.id !== id);
    setSaved(next);
    localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(next));
    toast.success("Deck deleted.");
  };

  const publishDeck = async () => {
    if (total === 0) return toast.error("Add some cards first.");
    const username = user?.nickname || "Anonymous";
    setPublishing(true);
    try {
      await api.post("/decks", {
        username,
        deck_name: deckName || "Untitled",
        deck_cards: Object.values(deck).map(({ card, count }) => ({ card_name: card.name, count })),
      });
      toast.success(`Published "${deckName || "Untitled"}" to the Community!`);
    } catch {
      toast.error("Failed to publish deck.");
    } finally {
      setPublishing(false);
    }
  };

  const loadDeck = (entry) => {
    const nd = {};
    entry.cards.forEach((e) => {
      const card = cards.find((c) => c.id === e.id || c.name === e.name || c.name === e.id);
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
      : {
          name: deckName || "Custom Deck",
          cards: Object.values(deck).map(({ card, count }) => ({ id: card.id, count })),
        };
    if (!payload.cards.length) return toast.error("Add cards to print.");
    localStorage.setItem(PRINT_DECK_KEY, JSON.stringify(payload));
    window.open("/print?src=deck", "_blank");
  };

  const deckPanelContent = (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4 sm:p-5">
        <input
          data-testid="deck-name-input"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
          className="w-full bg-transparent font-display text-xl font-bold outline-none border-b border-white/10 pb-2 mb-3 focus:border-[#F2A900]"
        />
        <div className="flex items-center justify-between mb-3">
          <span className="font-head text-sm text-white/60">Deck Size</span>
          <span className="font-num text-lg font-bold" data-testid="deck-count">
            <span className={total === DECK_MAX ? "text-[#22E07B]" : "text-white"}>{total}</span>
            <span className="text-white/40"> / {DECK_MAX}</span>
          </span>
        </div>

        {/* Competitive Deck Analytics */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-xs font-head font-bold text-[#00BFFF]"
          >
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#F2A900]" />
              Curve &amp; Faction Analytics
            </span>
            {showAnalytics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAnalytics && (
            <div className="mt-3">
              <DeckAnalytics deckEntries={Object.values(deck)} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveDeck}
            data-testid="deck-save-btn"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F2A900] text-black font-head font-bold text-sm hover:bg-[#ffc21f]"
          >
            <Save className="w-4 h-4" /> Save
          </button>
          <button
            onClick={publishDeck}
            disabled={publishing}
            title="Publish to Community"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00BFFF] text-black font-head font-bold text-sm hover:bg-[#38ccff] disabled:opacity-50"
          >
            <Users className="w-4 h-4" /> Publish
          </button>
          <button
            onClick={generateDeckCode}
            title="Copy Deck Code"
            className="p-2.5 rounded-xl bg-[#00BFFF]/20 text-[#7FDBFF] hover:bg-[#00BFFF]/30"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={importDeckCode}
            title="Import Deck Code"
            className="p-2.5 rounded-xl bg-[#22E07B]/20 text-[#22E07B] hover:bg-[#22E07B]/30"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={() => printProxy(null)}
            data-testid="deck-print-btn"
            title="Print Proxy"
            className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setDeck({});
              setDeckName("New Deck");
            }}
            title="Clear Deck"
            className="p-2.5 rounded-xl glass hover:border-white/25"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Deck List */}
      <div className="glass rounded-2xl p-4 max-h-[320px] overflow-y-auto">
        {total === 0 ? (
          <p className="text-white/40 text-sm text-center py-6 font-head">
            Tap cards in the gallery to add them (max 3 copies).
          </p>
        ) : (
          <div className="space-y-1.5" data-testid="deck-list">
            {Object.values(deck)
              .sort((a, b) => (Number(a.card.cost) || 0) - (Number(b.card.cost) || 0))
              .map(({ card, count }) => {
                const f = factionCfg(card.faction);
                return (
                  <div
                    key={card.id}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2"
                    style={{ background: `${f.color}15` }}
                  >
                    <span
                      className="w-6 h-6 rounded flex items-center justify-center font-num font-bold text-xs text-black shrink-0"
                      style={{ background: f.color }}
                    >
                      {card.cost}
                    </span>
                    <span className="flex-1 text-sm truncate font-head text-white">{card.name}</span>
                    <button
                      onClick={() => remove(card.id)}
                      className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/70 hover:text-white"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-num text-sm font-bold w-4 text-center">{count}</span>
                    <button
                      onClick={() => add(card)}
                      className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/70 hover:text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Starter Decks */}
      {starters.length > 0 && (
        <div className="glass rounded-2xl p-4" data-testid="starter-decks">
          <p className="font-head text-xs uppercase tracking-wider text-white/50 font-bold mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Starter Templates
          </p>
          <div className="space-y-1.5">
            {starters.map((sd) => (
              <button
                key={sd.id}
                onClick={() => loadStarter(sd)}
                data-testid={`starter-deck-${sd.id}`}
                className="w-full text-left px-3 py-2 rounded-xl bg-black/30 hover:bg-black/50 transition-colors"
              >
                <div className="font-head text-sm font-semibold">{sd.deck_name}</div>
                <div className="text-white/40 text-xs line-clamp-1">{sd.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved Decks */}
      {saved.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <p className="font-head text-xs uppercase tracking-wider text-white/50 font-bold mb-2">
            Saved Decks
          </p>
          <div className="space-y-1.5">
            {saved.map((d) => (
              <div key={d.id} className="flex items-center gap-1.5">
                <button
                  onClick={() => loadDeck(d)}
                  data-testid={`saved-deck-${d.id}`}
                  className="flex-1 flex items-center justify-between px-3 py-2 rounded-xl bg-black/30 hover:bg-black/50 text-sm font-head min-w-0"
                >
                  <span className="truncate">{d.name}</span>
                  <span className="text-white/40 inline-flex items-center gap-1 shrink-0 ml-2">
                    <Download className="w-3.5 h-3.5" /> {d.cards.reduce((s, c) => s + c.count, 0)}
                  </span>
                </button>
                <button
                  onClick={() => printProxy(d)}
                  data-testid={`saved-deck-print-${d.id}`}
                  title="Print proxy"
                  className="p-2 rounded-xl bg-[#00BFFF]/20 text-[#7FDBFF]"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteSavedDeck(d.id)}
                  data-testid={`saved-deck-delete-${d.id}`}
                  title="Delete deck"
                  className="p-2 rounded-xl bg-red-500/20 text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div data-testid="deckbuilder-page" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-28 lg:pb-10">
      <div className="flex items-center gap-3 mb-1.5">
        {onExit && (
          <button
            onClick={onExit}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="font-display text-3xl sm:text-5xl font-bold">Deck Editor</h1>
      </div>
      <p className="text-white/50 font-head text-xs sm:text-base mb-5">
        Forge your {DECK_MAX}-card battle list (up to {COPY_MAX} copies per card).
      </p>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Card Pool Gallery */}
        <div>
          <div className="glass-strong rounded-2xl p-3 sm:p-4 mb-5 space-y-2.5 sticky top-14 z-20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                data-testid="deck-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search cards by name or effect…"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#F2A900]/60"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setFaction(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-head border shrink-0 ${
                  !faction ? "bg-white text-black font-bold" : "border-white/15 text-white/65"
                }`}
              >
                All
              </button>
              {Object.values(FACTIONS).map((f) => (
                <button
                  key={f.name}
                  data-testid={`deck-faction-${f.name.toLowerCase()}`}
                  onClick={() => setFaction(faction === f.name ? null : f.name)}
                  className="px-3 py-1.5 rounded-full text-xs font-head border transition-all shrink-0 font-semibold"
                  style={
                    faction === f.name
                      ? { background: f.color, borderColor: f.color, color: "#000" }
                      : { borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.65)" }
                  }
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
                <div
                  key={c.id}
                  className="relative w-full max-w-[160px]"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("cardId", c.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    remove(c.id);
                  }}
                >
                  <CardTooltip card={c} side="right">
                    <div className="relative">
                      <CardTemplate
                        card={c}
                        size="sm"
                        width="100%"
                        tilt={false}
                        onClick={() => add(c)}
                        testId={`deck-pool-${c.collector_number}`}
                      />
                      {count > 0 && (
                        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(c.id);
                            }}
                            className="w-6 h-6 rounded-full bg-black/90 border border-white/30 text-white flex items-center justify-center lg:hidden"
                            aria-label={`Remove 1 ${c.name}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 h-6 rounded-full bg-[#F2A900] text-black font-num font-bold text-sm flex items-center justify-center border-2 border-[#0B0C10]">
                            {count}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardTooltip>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop Sticky Sidebar */}
        <div
          className="hidden lg:block lg:sticky lg:top-20 self-start"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const cardId = e.dataTransfer.getData("cardId");
            if (cardId) {
              const card = cards.find((c) => String(c.id) === String(cardId));
              if (card) add(card);
            }
          }}
        >
          {deckPanelContent}
        </div>
      </div>

      {/* Mobile Floating Deck Tray Bar */}
      <div className="lg:hidden fixed bottom-16 inset-x-3 z-40 glass-strong rounded-2xl p-2.5 border border-[#F2A900]/40 shadow-2xl flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex items-center gap-2.5 px-2 min-w-0 flex-1 text-left"
        >
          <Layers className="w-5 h-5 text-[#F2A900] shrink-0" />
          <div className="min-w-0">
            <div className="font-head font-bold text-xs text-white truncate">{deckName}</div>
            <div className="font-num text-xs text-[#F2A900] font-bold">
              {total} / {DECK_MAX} Cards · Tap to View List
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={saveDeck}
          className="px-4 py-2 rounded-xl bg-[#F2A900] text-black font-head font-bold text-xs flex items-center gap-1.5 shrink-0"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
      </div>

      {/* Mobile Slide-Up Deck Sheet */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="lg:hidden fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[86dvh] overflow-y-auto bg-[#0B0C10] border-t border-white/15 rounded-t-3xl p-4 pb-safe space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-display text-lg font-bold">Current Deck ({total}/{DECK_MAX})</span>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {deckPanelContent}
          </div>
        </div>
      )}
    </div>
  );
}
