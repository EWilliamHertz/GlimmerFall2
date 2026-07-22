import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import JSZip from "jszip";
import { Printer, ArrowLeft, FileDown, Layers, Package, Loader2, BookOpen } from "lucide-react";
import { api } from "@/lib/api";
import { LOGO, factionCfg, RARITY_ICONS } from "@/lib/factions";
import CardTemplate from "@/components/CardTemplate";
import { buildCardSVG, buildBackSVG, toDataURL, CARDBACK } from "@/lib/cardSvg";

const PER_PAGE = 9;
const PRINT_DECK_KEY = "gf_print_deck";
const SAVED_KEY = "glimmerfall_decks";

export default function PrintPage() {
  const location = useLocation();
  const [master, setMaster] = useState([]);
  const [starters, setStarters] = useState([]);
  const [savedDecks, setSavedDecks] = useState([]);
  const [builderDeck, setBuilderDeck] = useState(null);
  const [selId, setSelId] = useState("full");
  const [mode, setMode] = useState("hobby"); // hobby | pro
  const [backMode, setBackMode] = useState("single"); // single | each | none
  const [gen, setGen] = useState(null); // svg generation progress

  useEffect(() => {
    api.get("/cards").then((r) => setMaster(r.data));
    api.get("/starter-decks").then((r) => setStarters(r.data)).catch(() => {});
    try { setSavedDecks(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")); } catch { setSavedDecks([]); }
    try {
      const d = JSON.parse(localStorage.getItem(PRINT_DECK_KEY) || "null");
      if (d?.cards?.length) setBuilderDeck(d);
    } catch { /* noop */ }
    const params = new URLSearchParams(location.search);
    if (params.get("src") === "deck") setSelId("builder");
  }, [location.search]);

  const byId = useMemo(() => Object.fromEntries(master.map((c) => [c.id, c])), [master]);
  const byName = useMemo(() => Object.fromEntries(master.map((c) => [c.name, c])), [master]);

  const sources = useMemo(() => {
    const s = [{ id: "full", label: "Complete Set", desc: "All 100 GlimmerFall cards from The Awakening.", kind: "full", count: master.length }];
    if (builderDeck) s.push({ id: "builder", label: builderDeck.name + " (Builder)", desc: "The deck currently open in the Deck Builder.", kind: "builder", count: builderDeck.cards.reduce((a, c) => a + (c.count || 1), 0) });
    starters.forEach((sd) => s.push({ id: "starter-" + sd.id, label: sd.deck_name, desc: sd.description, kind: "starter", ref: sd, count: (sd.cards || []).reduce((a, c) => a + (c.count || 1), 0) }));
    savedDecks.forEach((d) => s.push({ id: "saved-" + d.id, label: d.name, desc: "Your saved custom deck.", kind: "saved", ref: d, count: d.cards.reduce((a, c) => a + (c.count || 1), 0) }));
    return s;
  }, [master, starters, savedDecks, builderDeck]);

  const selected = sources.find((s) => s.id === selId) || sources[0];

  const cards = useMemo(() => {
    if (!selected || !master.length) return [];
    const out = [];
    const push = (card, n) => { for (let i = 0; i < (n || 1); i++) if (card) out.push(card); };
    if (selected.kind === "full") return master;
    if (selected.kind === "builder") builderDeck.cards.forEach((e) => push(byId[e.id], e.count));
    if (selected.kind === "starter") selected.ref.cards.forEach((e) => push(byName[e.card_name], e.count));
    if (selected.kind === "saved") selected.ref.cards.forEach((e) => push(byId[e.id], e.count));
    return out;
  }, [selected, master, byId, byName, builderDeck]);

  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < cards.length; i += PER_PAGE) out.push(cards.slice(i, i + PER_PAGE));
    return out;
  }, [cards]);

  // Professional / SVG ordering with card-back rule
  const proSeq = useMemo(() => {
    const seq = [];
    if (backMode === "single") seq.push({ back: true, key: "back-lead" });
    cards.forEach((c, i) => {
      seq.push({ card: c, key: c.id + "-" + i });
      if (backMode === "each") seq.push({ back: true, key: "back-" + i });
    });
    return seq;
  }, [cards, backMode]);

  const downloadSVGs = async () => {
    if (!cards.length) return;
    setGen({ done: 0, total: proSeq.length });
    const zip = new JSZip();
    const cache = {};
    const getImg = async (url) => {
      if (!url || url === "None") url = CARDBACK;
      if (!cache[url]) cache[url] = await toDataURL(url);
      return cache[url];
    };
    const backSvg = buildBackSVG(await getImg(CARDBACK));
    let n = 0;
    for (const item of proSeq) {
      const idx = String(n + 1).padStart(3, "0");
      if (item.back) {
        zip.file(`${idx}_backside.svg`, backSvg);
      } else {
        const img = await getImg(item.card.image_url);
        const rIcon = await getImg(RARITY_ICONS[item.card.rarity] || RARITY_ICONS.Common);
        const safe = (item.card.name || "card").replace(/[^a-z0-9]+/gi, "_");
        zip.file(`${idx}_${safe}.svg`, buildCardSVG(item.card, img, rIcon));
      }
      n++;
      setGen({ done: n, total: proSeq.length });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `glimmerfall_${selected.label.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_svg.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    setGen(null);
  };

  const pageStyle = mode === "pro"
    ? "@media print{@page{size:69mm 94mm;margin:0}}"
    : "@media print{@page{size:A4 portrait;margin:8mm}}";

  return (
    <div className="print-root bg-[#0B0C10] min-h-screen">
      <style>{pageStyle}</style>

      {/* HUD toolbar */}
      <div className="no-print sticky top-0 z-50 glass-strong px-5 py-3 flex items-center justify-between gap-3">
        <Link to="/decks" className="inline-flex items-center gap-2 text-white/60 hover:text-white font-head text-sm shrink-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <img src={LOGO} alt="" className="w-7 h-7 object-contain shrink-0" />
          <span className="font-display font-bold truncate">Proxy Printer</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => window.print()} data-testid="print-now-btn" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F2A900] text-black font-head font-semibold text-sm hover:bg-[#ffc21f]">
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
          <button onClick={downloadSVGs} disabled={!!gen} data-testid="download-svg-btn" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#00BFFF] text-black font-head font-semibold text-sm hover:bg-[#38ccff] disabled:opacity-60">
            {gen ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {gen ? `${gen.done}/${gen.total}` : "SVG (.zip)"}
          </button>
        </div>
      </div>

      <div className="no-print max-w-7xl mx-auto px-5 py-6 grid lg:grid-cols-[320px_1fr] gap-6">
        {/* control panel */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <p className="font-head text-sm text-white/60 mb-2 flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> What to print</p>
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelId(s.id)}
                  data-testid={`print-src-${s.id}`}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selId === s.id ? "bg-[#F2A900] text-black" : "bg-black/30 hover:bg-black/50"}`}
                >
                  <div className="font-head text-sm font-semibold flex items-center justify-between">
                    <span className="truncate">{s.label}</span>
                    <span className={selId === s.id ? "text-black/60 text-xs" : "text-white/40 text-xs"}>{s.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <div className="glass rounded-2xl p-4" data-testid="print-selected-desc">
              <p className="font-display text-lg font-bold mb-1" style={{ color: "#F2A900" }}>{selected.label}</p>
              <p className="text-white/60 text-sm leading-relaxed">{selected.desc}</p>
              <p className="text-white/40 text-xs mt-2 font-head">{cards.length} cards</p>
            </div>
          )}

          <div className="glass rounded-2xl p-4">
            <p className="font-head text-sm text-white/60 mb-2">Output format</p>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => setMode("hobby")} data-testid="print-mode-hobby" className={`text-left px-3 py-2.5 rounded-lg border transition-all ${mode === "hobby" ? "border-[#F2A900] bg-[#F2A900]/10" : "border-white/10"}`}>
                <div className="font-head text-sm font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Hobby Proxy</div>
                <div className="text-white/50 text-xs mt-0.5">9 cards per A4 page · print to PDF</div>
              </button>
              <button onClick={() => setMode("pro")} data-testid="print-mode-pro" className={`text-left px-3 py-2.5 rounded-lg border transition-all ${mode === "pro" ? "border-[#00BFFF] bg-[#00BFFF]/10" : "border-white/10"}`}>
                <div className="font-head text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4" /> Professional</div>
                <div className="text-white/50 text-xs mt-0.5">1 card / page · 63×88mm +3mm bleed · SVG + PDF</div>
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <p className="font-head text-sm text-white/60 mb-2">Card backs <span className="text-white/30">(Professional / SVG)</span></p>
            <div className="space-y-2">
              {[["single", "One card back before the fronts"], ["each", "A card back after every card (duplex)"], ["none", "No card backs"]].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setBackMode(v)}
                  data-testid={`print-back-${v}`}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-head transition-all ${backMode === v ? "border-[#F2A900] bg-[#F2A900]/10 text-white" : "border-white/10 text-white/70"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* preview note */}
        <div className="glass rounded-2xl p-4 h-max">
          <p className="font-head text-sm text-white/70">
            {mode === "hobby"
              ? `${pages.length} A4 page(s), 9 cards each. Click “Print / PDF”.`
              : `${proSeq.length} pages (${cards.length} cards${backMode === "none" ? "" : backMode === "each" ? " + a back after each" : " + 1 leading back"}), each 63×88mm with 3mm bleed. Use “SVG (.zip)” for print-studio vector files or “Print / PDF” for a 1-card-per-page PDF.`}
          </p>
        </div>
      </div>

      {/* ---- printable sheets ---- */}
      {mode === "hobby" ? (
        <div className="print-sheets py-2">
          {pages.map((pg, pi) => (
            <div key={pi} className="print-page mx-auto bg-white rounded-lg mb-6" data-testid={`print-page-${pi}`}>
              <div className="grid grid-cols-3 gap-3 p-4 place-items-center">
                {pg.map((c, ci) => (
                  <CardTemplate key={c.id + "-" + pi + "-" + ci} card={c} tilt={false} forceText eager width="58mm" testId={`print-card-${pi}-${ci}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="print-sheets pro py-2 flex flex-col items-center gap-6">
          {proSeq.map((item, si) =>
            item.back ? (
              <div key={item.key} className="pro-page bg-[#0B0C10] flex items-center justify-center" data-testid={si === 0 ? "pro-page-back" : `pro-page-back-${si}`}>
                <img src={CARDBACK} alt="backside" className="object-cover" style={{ width: "57mm", height: "82mm", borderRadius: "4mm" }} />
              </div>
            ) : (
              <div key={item.key} className="pro-page bg-[#0B0C10] flex items-center justify-center" data-testid={`pro-page-${si}`}>
                <CardTemplate card={item.card} tilt={false} forceText eager width="57mm" height="82mm" />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
