import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, Plus, Trash2, Heart, Users, BookOpen, Download, ArrowLeft, Zap, Sword, MessageSquare, Send, Award, Clock, TrendingUp, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import DeckEditor from "./DeckEditor";
import CardTemplate from "@/components/CardTemplate";
import { useAuth } from "@/lib/auth";

const LEGACY_STORE_KEY = "glimmerfall_decks"; // for one-time migration

export default function DeckBuilder() {
  const [view, setView] = useState("hub");
  const [activeTab, setActiveTab] = useState("community");
  const [allDecks, setAllDecks] = useState([]);
  const [myDecks, setMyDecks] = useState([]);
  const [cards, setCards] = useState([]);
  const [viewDeck, setViewDeck] = useState(null);
  const [editorInitialDeck, setEditorInitialDeck] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [sort, setSort] = useState("upvotes"); // upvotes | newest | trending

  const { user } = useAuth();

  // Refresh community decks according to sort
  const refreshCommunity = useCallback(() => {
    api
      .get(`/decks/community?sort=${sort}`)
      .then((r) => setAllDecks(r.data))
      .catch(() => {});
  }, [sort]);

  // Refresh caller's server-side personal decks
  const refreshMyDecks = useCallback(async () => {
    if (!user) {
      // Anonymous: fall back to legacy localStorage so print/proxy still works.
      try {
        const raw = localStorage.getItem(LEGACY_STORE_KEY);
        setMyDecks(raw ? JSON.parse(raw) : []);
      } catch {
        setMyDecks([]);
      }
      return;
    }
    try {
      const r = await api.get("/auth/me/decks");
      // Normalize to old shape ({id, name, cards:[{id,name,count}]})
      const decks = (r.data || []).map((d) => ({
        id: d.id,
        name: d.deck_name,
        is_public: d.is_public,
        server: true,
        cards: (d.cards || []).map((c) => ({
          id: c.card_id || c.card_name,
          name: c.card_name,
          count: c.count,
        })),
      }));
      setMyDecks(decks);
    } catch (e) {
      setMyDecks([]);
    }
  }, [user]);

  // One-time migration: if the user just logged in and has localStorage decks,
  // upload them to the server, then wipe localStorage so it never re-syncs.
  const migrateLocalDecks = useCallback(async () => {
    if (!user) return;
    let raw;
    try {
      raw = localStorage.getItem(LEGACY_STORE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) {
        localStorage.removeItem(LEGACY_STORE_KEY);
        return;
      }
      toast.info(`Migrating ${arr.length} local deck${arr.length === 1 ? "" : "s"} to your account…`);
      let migrated = 0;
      for (const d of arr) {
        try {
          await api.post("/auth/me/decks", {
            deck_name: d.name || "Untitled",
            deck_cards: (d.cards || []).map((c) => ({
              card_name: c.name || c.id,
              count: c.count,
            })),
          });
          migrated++;
        } catch (e) {}
      }
      if (migrated > 0) {
        toast.success(`Migrated ${migrated} deck${migrated === 1 ? "" : "s"} to your account`);
      }
      localStorage.removeItem(LEGACY_STORE_KEY);
      refreshMyDecks();
    } catch (e) {}
  }, [user, refreshMyDecks]);

  useEffect(() => {
    if (view !== "hub") return;
    api.get("/decks").then((r) => setAllDecks(r.data)).catch(() => {});
    api.get("/cards").then((r) => setCards(r.data)).catch(() => {});
    refreshMyDecks();
    migrateLocalDecks();

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "precon") setActiveTab("precon");
  }, [view, refreshMyDecks, migrateLocalDecks]);

  useEffect(() => {
    if (view !== "hub") return;
    if (activeTab === "community") refreshCommunity();
  }, [activeTab, sort, view, refreshCommunity]);

  useEffect(() => {
    if (viewDeck?.id) {
      api.get(`/decks/${viewDeck.id}/comments`).then(r => setComments(r.data)).catch(console.error);
    }
  }, [viewDeck]);

  const handleLike = async (deckId) => {
    if (!user) return toast.error("Log in to like decks.");
    try {
      const r = await api.post(`/decks/${deckId}/like`);
      setAllDecks(prev => prev.map(d => d.id === deckId ? { ...d, liked_by_me: r.data.liked, likes_count: r.data.likes_count } : d));
      if (viewDeck?.id === deckId) {
        setViewDeck(prev => ({ ...prev, liked_by_me: r.data.liked, likes_count: r.data.likes_count }));
      }
    } catch (err) {
      toast.error("Failed to toggle like.");
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user) return toast.error("Log in to comment.");
    if (!newComment.trim()) return;
    try {
      await api.post(`/decks/${viewDeck.id}/comments`, { content: newComment });
      setNewComment("");
      const r = await api.get(`/decks/${viewDeck.id}/comments`);
      setComments(r.data);
      toast.success("Comment posted!");
    } catch (err) {
      toast.error("Failed to post comment.");
    }
  };

  const importDeck = async (deck) => {
    // Community deck -> clone to caller's private deck list (server-side).
    if (!user) {
      // Anonymous fallback: keep the old localStorage import.
      const resolvedCards = [];
      (deck.cards || []).forEach(c => {
        const found = cards.find(fullCard => fullCard.name === (c.card_name || c.name));
        if (found) {
          resolvedCards.push({ id: found.id, name: found.name, count: c.count });
        } else if (c.id) {
          resolvedCards.push(c);
        }
      });
      const entry = {
        id: Date.now(),
        name: `${deck.username} - ${deck.deck_name || deck.name}`,
        cards: resolvedCards,
      };
      const next = [entry, ...myDecks].slice(0, 20);
      setMyDecks(next);
      localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(next));
      toast.success(`Imported "${entry.name}" to My Decks (login to sync to your account).`);
      return;
    }
    try {
      await api.post(`/decks/${deck.id}/clone`);
      toast.success(`Cloned "${deck.deck_name || deck.name}" to My Decks!`);
      refreshMyDecks();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to clone deck.");
    }
  };

  const deleteDeck = async (id) => {
    // Server-backed personal decks
    if (user) {
      try {
        await api.delete(`/auth/me/decks/${id}`);
        setMyDecks((prev) => prev.filter((d) => d.id !== id));
        toast.success("Deck deleted.");
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to delete deck.");
      }
      return;
    }
    // Anonymous localStorage fallback
    const next = myDecks.filter((d) => d.id !== id);
    setMyDecks(next);
    localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(next));
    toast.success("Deck deleted.");
  };

  const deleteCommunityDeck = async (id) => {
    if (!window.confirm("Delete this deck permanently?")) return;
    try {
      await api.delete(`/decks/${id}`);
      setAllDecks(prev => prev.filter(d => d.id !== id));
      toast.success("Deck deleted.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to delete deck");
    }
  };

  if (view === "editor") {
    return <DeckEditor onExit={() => setView("hub")} initialDeck={editorInitialDeck} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-10" data-testid="deck-hub-page">
      {/* Landing Header */}
      <div className="text-center max-w-4xl mx-auto mb-12">
        <h1 className="font-display text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00BFFF] to-[#F2A900] drop-shadow-[0_0_20px_rgba(242,169,0,0.4)] mb-6 uppercase tracking-wider">
          The Deck Hub
        </h1>
        <p className="font-head text-white/80 text-lg md:text-xl leading-relaxed">
          This is the haven where you can browse, study, and play professionally built decks. 
          Vote on your favorites to give them a chance to land in the community spotlights!
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-4 mb-8 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab("precon")}
          className={`px-8 py-3 rounded-full font-display font-bold text-lg transition-all ${activeTab === "precon" ? "bg-[#9B30FF] text-white shadow-[0_0_20px_rgba(155,48,255,0.5)]" : "glass text-white/60 hover:text-white"}`}
        >
          Preconstructed
        </button>
        <button 
          onClick={() => setActiveTab("community")}
          className={`px-8 py-3 rounded-full font-display font-bold text-lg transition-all ${activeTab === "community" ? "bg-[#F2A900] text-black shadow-[0_0_20px_rgba(242,169,0,0.5)]" : "glass text-white/60 hover:text-white"}`}
        >
          Community Decks
        </button>
        <button 
          onClick={() => setActiveTab("my-decks")}
          className={`px-8 py-3 rounded-full font-display font-bold text-lg transition-all ${activeTab === "my-decks" ? "bg-[#00BFFF] text-black shadow-[0_0_20px_rgba(0,191,255,0.5)]" : "glass text-white/60 hover:text-white"}`}
        >
          My Decks
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "precon" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allDecks.filter(d => d.is_preconstructed).map(deck => {
            const themeColor = deck.deck_name === "Solar Singularity" ? "#F2A900" :
                          deck.deck_name === "Gaia's Loop" ? "#22E07B" :
                          deck.deck_name === "Fractured Continuum" ? "#38CCFF" :
                          deck.deck_name === "The Graveglass Veil" ? "#9B30FF" : "#ffffff";
            return (
            <div key={deck.id} className="glass-strong rounded-2xl p-6 relative group overflow-hidden border transition-colors"
                 style={{ borderColor: `${themeColor}4D` }}
                 onMouseEnter={(e) => e.currentTarget.style.borderColor = themeColor}
                 onMouseLeave={(e) => e.currentTarget.style.borderColor = `${themeColor}4D`}>
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><BookOpen className="w-24 h-24" style={{ color: themeColor }} /></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="font-display text-xl font-bold" style={{ color: themeColor }}>{deck.deck_name}</h3>
                  <p className="font-head text-sm text-white/50">Official Theme Deck</p>
                </div>
                <button 
                  onClick={() => handleLike(deck.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${deck.liked_by_me ? "text-[#FF5252] drop-shadow-[0_0_8px_rgba(255,82,82,0.6)]" : "text-white/40 hover:text-[#FF5252]"}`}
                >
                  <Heart className={`w-4 h-4 ${deck.liked_by_me ? "fill-current" : ""}`} /> 
                  {deck.likes_count || 0}
                </button>
              </div>
              <div className="flex gap-3 mt-6 relative z-10">
                <button onClick={() => setViewDeck(deck)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-head text-sm transition-colors border border-white/10 hover:border-white/20">
                  View List
                </button>
                <button onClick={() => importDeck(deck)} className="flex-1 py-2 rounded-xl bg-[#00BFFF]/20 text-[#00BFFF] hover:bg-[#00BFFF]/40 font-head text-sm transition-colors flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Import
                </button>
              </div>
            </div>
            );
          })}
          {allDecks.filter(d => d.is_preconstructed).length === 0 && (
            <div className="col-span-full py-20 text-center text-white/40 font-head">
              No preconstructed decks available yet.
            </div>
          )}
        </div>
      )}

      {activeTab === "community" && (
        <>
        <div className="flex justify-end mb-6 gap-2">
          <button
            onClick={() => setSort("upvotes")}
            data-testid="community-sort-upvotes"
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-head text-sm transition-all ${sort === "upvotes" ? "bg-[#F2A900] text-black" : "glass text-white/60 hover:text-white"}`}
          >
            <Award className="w-4 h-4" /> Most Upvoted
          </button>
          <button
            onClick={() => setSort("trending")}
            data-testid="community-sort-trending"
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-head text-sm transition-all ${sort === "trending" ? "bg-[#F2A900] text-black" : "glass text-white/60 hover:text-white"}`}
          >
            <TrendingUp className="w-4 h-4" /> Trending 7d
          </button>
          <button
            onClick={() => setSort("newest")}
            data-testid="community-sort-newest"
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-head text-sm transition-all ${sort === "newest" ? "bg-[#F2A900] text-black" : "glass text-white/60 hover:text-white"}`}
          >
            <Clock className="w-4 h-4" /> Newest
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allDecks.filter(d => !d.is_preconstructed).map(deck => (
            <div key={deck.id} className="glass-strong rounded-2xl p-6 relative group overflow-hidden border border-white/10 hover:border-[#F2A900]/50 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#F2A900]">{deck.deck_name}</h3>
                  <p className="font-head text-sm text-white/50">By {deck.username}</p>
                </div>
                <button 
                  onClick={() => handleLike(deck.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${deck.liked_by_me ? "text-[#FF5252] drop-shadow-[0_0_8px_rgba(255,82,82,0.6)]" : "text-white/40 hover:text-[#FF5252]"}`}
                >
                  <Heart className={`w-4 h-4 ${deck.liked_by_me ? "fill-current" : ""}`} /> 
                  {deck.likes_count || 0}
                </button>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button onClick={() => setViewDeck(deck)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-head text-sm transition-colors border border-white/10 hover:border-white/20">
                  View List
                </button>
                <button onClick={() => importDeck(deck)} className="flex-1 py-2 rounded-xl bg-[#00BFFF]/20 text-[#00BFFF] hover:bg-[#00BFFF]/40 font-head text-sm transition-colors flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Import
                </button>
                {user && user.nickname === deck.username && (
                  <button onClick={() => deleteCommunityDeck(deck.id)} className="px-3 py-2 rounded-xl bg-red-500/20 text-red-500 hover:bg-red-500/40 font-head transition-colors" title="Delete Deck">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {allDecks.filter(d => !d.is_preconstructed).length === 0 && (
            <div className="col-span-full py-20 text-center text-white/40 font-head">
              No community decks found yet. Be the first to publish one from your arsenal!
            </div>
          )}
        </div>
        </>
      )}

      {activeTab === "my-decks" && (
        <div>
          <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
            <h2 className="font-display text-2xl font-bold text-white uppercase tracking-widest">Your Arsenal</h2>
            <button 
              onClick={() => { setEditorInitialDeck(null); setView("editor"); }}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-[#00BFFF] text-white font-bold font-head shadow-[0_0_20px_rgba(0,191,255,0.4)] hover:scale-105 transition-transform flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Create New Deck
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myDecks.map(deck => (
              <div key={deck.id} className="glass rounded-2xl p-6 relative group border border-white/5 hover:border-[#00BFFF]/50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-display text-xl font-bold text-white truncate" title={deck.name}>{deck.name}</h3>
                  {deck.server && (
                    deck.is_public ? (
                      <span title="Published to Community" className="text-[10px] font-head font-bold uppercase tracking-widest text-[#F2A900] bg-[#F2A900]/15 border border-[#F2A900]/30 px-2 py-0.5 rounded-full shrink-0">Public</span>
                    ) : (
                      <span title="Private (only you)" className="text-[10px] font-head font-bold uppercase tracking-widest text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0">Private</span>
                    )
                  )}
                </div>
                <p className="font-head text-sm text-white/40 mb-6">{deck.cards.reduce((acc, c) => acc + c.count, 0)} Cards</p>

                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => {
                    const resolved = { ...deck, cards: deck.cards.map(c => ({ card_name: c.name || c.id, count: c.count })) };
                    setViewDeck(resolved);
                  }} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 font-head text-sm transition-colors border border-white/10 hover:border-white/20">
                    View
                  </button>
                  <button onClick={() => { setEditorInitialDeck(deck); setView("editor"); }} className="flex-1 py-2 rounded-xl bg-[#F2A900]/20 text-[#F2A900] hover:bg-[#F2A900]/40 font-head text-sm transition-colors flex items-center justify-center gap-2">
                    Edit
                  </button>
                  {deck.server && user && (
                    deck.is_public ? (
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/auth/me/decks/${deck.id}/unpublish`);
                            toast.success("Deck unpublished.");
                            refreshMyDecks();
                          } catch (e) { toast.error("Unpublish failed"); }
                        }}
                        title="Unpublish from Community"
                        className="px-3 py-2 rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/30 font-head text-xs transition-colors"
                      >
                        <Upload className="w-4 h-4 rotate-180" />
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            await api.post(`/auth/me/decks/${deck.id}/publish`);
                            toast.success("Deck published to Community!");
                            refreshMyDecks();
                            refreshCommunity();
                          } catch (e) { toast.error("Publish failed"); }
                        }}
                        title="Publish to Community"
                        className="px-3 py-2 rounded-xl bg-[#00BFFF]/20 text-[#00BFFF] hover:bg-[#00BFFF]/40 font-head text-xs transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    )
                  )}
                  <button onClick={() => deleteDeck(deck.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {myDecks.length === 0 && (
              <div className="col-span-full py-20 text-center text-white/40 font-head glass rounded-3xl">
                You haven't built or imported any decks yet! Start forging your first deck.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deck View Modal */}
      {viewDeck && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-5xl bg-gray-900 border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-full">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40 rounded-t-3xl">
              <div>
                <h2 className="font-display text-3xl font-bold text-[#F2A900] uppercase tracking-wide drop-shadow-lg">
                  {viewDeck.deck_name || viewDeck.name}
                </h2>
                {viewDeck.username && <p className="font-head text-white/50 text-sm mt-1">Built by <span className="text-white/80">{viewDeck.username}</span></p>}
              </div>
              <button onClick={() => setViewDeck(null)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
            </div>
            
            <div className="p-6 overflow-hidden flex-1 bg-black/20 flex flex-col md:flex-row gap-6 min-h-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 border-r border-white/10">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {viewDeck.cards.map((c, i) => {
                    const fullCard = cards.find(fc => fc.name === c.card_name || fc.id === c.card_name || fc.id === c.id);
                    if (!fullCard) return null;
                    
                    return (
                      <HoverCard key={i} openDelay={100} closeDelay={0}>
                        <HoverCardTrigger asChild>
                          <div className="relative group cursor-pointer hover:-translate-y-2 transition-transform duration-300">
                            <CardTemplate card={fullCard} size="sm" tilt={true} />
                            <div className="absolute -top-3 -right-3 w-8 h-8 bg-black rounded-full border-2 border-[#F2A900] flex items-center justify-center font-display font-bold text-sm text-[#F2A900] shadow-[0_0_10px_rgba(242,169,0,0.8)] z-10">
                              x{c.count}
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="right" sideOffset={8} className="w-72 bg-transparent border-0 shadow-none p-0 overflow-visible z-[200]">
                          <CardTemplate card={fullCard} size="md" tilt={false} />
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </div>
              </div>
              
              <div className="w-full md:w-80 flex flex-col h-full bg-black/30 rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                  <h3 className="font-head font-bold flex items-center gap-2 text-white/80"><MessageSquare className="w-4 h-4"/> Comments</h3>
                  <button onClick={() => handleLike(viewDeck.id)} className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${viewDeck.liked_by_me ? "text-[#FF5252]" : "text-white/40 hover:text-[#FF5252]"}`}>
                    <Heart className={`w-4 h-4 ${viewDeck.liked_by_me ? "fill-current drop-shadow-[0_0_8px_rgba(255,82,82,0.6)]" : ""}`} />
                    {viewDeck.likes_count || 0}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {comments.length === 0 ? (
                    <div className="text-white/30 text-sm italic text-center py-10">No comments yet.</div>
                  ) : comments.map(c => (
                    <div key={c.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-[#00BFFF] truncate max-w-[150px]">{c.user_email.split('@')[0]}</span>
                        <span className="text-[10px] text-white/30">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-white/80 leading-relaxed">{c.content}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleCommentSubmit} className="p-3 border-t border-white/10 bg-black/40 flex gap-2">
                  <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00BFFF]/50" />
                  <button type="submit" disabled={!newComment.trim()} className="bg-[#00BFFF] text-black p-2 rounded-lg hover:bg-[#20caff] disabled:opacity-50 transition-colors"><Send className="w-4 h-4" /></button>
                </form>
              </div>
            </div>
            
            <div className="p-6 border-t border-white/10 bg-black/40 rounded-b-3xl flex justify-end gap-4">
              {viewDeck.username && (
                <button onClick={() => { importDeck(viewDeck); setViewDeck(null); }} className="px-6 py-2.5 rounded-full bg-[#00BFFF] text-black font-bold font-head shadow-[0_0_20px_rgba(0,191,255,0.4)] hover:bg-[#20caff] hover:scale-105 transition-all flex items-center gap-2">
                  <Download className="w-4 h-4" /> Import to My Decks
                </button>
              )}
              <button onClick={() => setViewDeck(null)} className="px-8 py-2.5 rounded-full glass text-white font-bold font-head hover:bg-white/10 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
