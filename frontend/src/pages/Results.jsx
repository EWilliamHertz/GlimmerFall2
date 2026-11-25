import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Layers,
  Scissors,
  Search,
  X,
} from "lucide-react";
import { CARD_TYPES, FACTIONS, RARITY, factionCfg } from "@/lib/factions";

const PAGE_STEP = 48;

export default function Results() {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState("trim"); // trim | bleed
  const [search, setSearch] = useState("");
  const [factionFilter, setFactionFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [rarityFilter, setRarityFilter] = useState("All");
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetch("/results/manifest.json")
      .then((r) => r.json())
      .then((data) => {
        setManifest(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load /results/manifest.json", err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_STEP);
  }, [search, factionFilter, typeFilter, rarityFilter]);

  const cards = useMemo(() => manifest?.cards || [], [manifest]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (factionFilter !== "All" && c.faction !== factionFilter) return false;
      if (typeFilter !== "All" && c.card_type !== typeFilter) return false;
      if (rarityFilter !== "All" && c.rarity !== rarityFilter) return false;
      if (!q) return true;
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.collector_label || "").toLowerCase().includes(q) ||
        String(c.collector_number || "").includes(q) ||
        (c.description || "").toLowerCase().includes(q) ||
        (c.keywords || []).join(" ").toLowerCase().includes(q)
      );
    });
  }, [cards, search, factionFilter, typeFilter, rarityFilter]);

  const shownCards = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  if (loading) {
    return (
      <div className="min-h-screen pt-28 px-6 text-center text-white/60 font-head animate-pulse">
        Loading Complete 322-Card GlimmerFall Prepress Catalog...
      </div>
    );
  }

  return (
    <div data-testid="results-page" className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20 space-y-10">
      {/* HERO HEADER */}
      <section className="glass rounded-3xl p-7 sm:p-10 border border-[#F2A900]/30 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-[#F2A900]/10 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 w-96 h-96 bg-[#00BFFF]/10 rounded-full blur-[110px] pointer-events-none" />

        <div className="relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#22E07B]/15 border border-[#22E07B]/35 text-[#22E07B] text-xs font-head font-bold uppercase tracking-widest">
            <CheckCircle2 className="w-3.5 h-3.5" /> Complete {cards.length}-Card Press Production · Smart Lore Edition
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <h1 className="font-display text-3xl sm:text-5xl font-black text-white leading-tight">
                AWK First Edition — All {cards.length} Press-Ready Cards
              </h1>
              <p className="text-white/75 font-head text-sm sm:text-base leading-relaxed">
                Generated 100% deterministically from the cleaned{" "}
                <Link to="/designer" className="text-[#00BFFF] hover:underline font-semibold">
                  /designer
                </Link>{" "}
                PostgreSQL database with Smart Lore, unified GlimmerFall Oracle templating, 300 DPI ICC CMYK separation,
                and exact 69×94mm / R3 63×88mm Shenzhen press dielines.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {manifest?.web_contact_sheet_url && (
                <a
                  href={manifest.web_contact_sheet_url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="results-open-sheet"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F2A900] text-black font-head font-bold text-sm hover:bg-[#ffc21f] transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Showcase Sheet
                </a>
              )}
              <Link
                to="/designer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-head font-semibold text-sm transition-colors"
              >
                <Layers className="w-4 h-4" /> View /designer Source DB
              </Link>
            </div>
          </div>

          {/* Prepress Specs Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-black/45 border border-white/10 rounded-2xl p-4">
              <div className="font-num text-2xl sm:text-3xl font-bold text-[#F2A900]">{cards.length} / 322</div>
              <div className="text-xs font-head text-white/50 uppercase tracking-wider mt-0.5">
                Cards Rendered (#001–#322)
              </div>
            </div>
            <div className="bg-black/45 border border-white/10 rounded-2xl p-4">
              <div className="font-num text-2xl sm:text-3xl font-bold text-[#00BFFF]">63×88 mm R3</div>
              <div className="text-xs font-head text-white/50 uppercase tracking-wider mt-0.5">
                +3mm Bleed = 69×94 mm
              </div>
            </div>
            <div className="bg-black/45 border border-white/10 rounded-2xl p-4">
              <div className="font-num text-2xl sm:text-3xl font-bold text-[#22E07B]">300 DPI CMYK</div>
              <div className="text-xs font-head text-white/50 uppercase tracking-wider mt-0.5">
                ICC 4C+4C · TAC ≤ 300%
              </div>
            </div>
            <div className="bg-black/45 border border-white/10 rounded-2xl p-4">
              <div className="font-num text-2xl sm:text-3xl font-bold text-[#C77DFF]">3 OCG Layers</div>
              <div className="text-xs font-head text-white/50 uppercase tracking-wider mt-0.5">
                Matches Official Backside PDF
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STICKY SEARCH & FILTER BAR */}
      <div className="glass-strong rounded-2xl p-4 sm:p-5 sticky top-14 z-30 border border-white/10 space-y-3 shadow-2xl shadow-black/60">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              data-testid="results-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search #001–#322 by collector number, name, keyword, or Oracle text..."
              className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-head text-white outline-none focus:border-[#F2A900]/60 transition-colors"
            />
          </div>

          <div className="flex items-center bg-black/55 border border-white/10 rounded-xl p-1 text-xs font-head shrink-0">
            <button
              onClick={() => setPreviewMode("trim")}
              data-testid="results-mode-trim"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                previewMode === "trim" ? "bg-[#F2A900] text-black" : "text-white/65 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Trim (63×88mm R3)
            </button>
            <button
              onClick={() => setPreviewMode("bleed")}
              data-testid="results-mode-bleed"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                previewMode === "bleed" ? "bg-red-500 text-white" : "text-white/65 hover:text-white"
              }`}
            >
              <Scissors className="w-3.5 h-3.5" /> Bleed + Dieline (69×94mm)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-head">
          <button
            onClick={() => setFactionFilter("All")}
            className={`px-3 py-1 rounded-full border transition-colors ${
              factionFilter === "All"
                ? "bg-white text-black font-bold border-white"
                : "border-white/15 text-white/65 hover:text-white"
            }`}
          >
            All Factions ({filtered.length})
          </button>
          {Object.values(FACTIONS).map((f) => (
            <button
              key={f.name}
              onClick={() => setFactionFilter(factionFilter === f.name ? "All" : f.name)}
              className={`px-3 py-1 rounded-full border transition-colors ${
                factionFilter === f.name ? "text-black font-bold" : "border-white/15 text-white/65 hover:text-white"
              }`}
              style={factionFilter === f.name ? { background: f.color, borderColor: f.color } : {}}
            >
              {f.name}
            </button>
          ))}

          <span className="w-px h-4 bg-white/15 mx-1" />

          {["All", ...CARD_TYPES].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t && t !== "All" ? "All" : t)}
              className={`px-3 py-1 rounded-full border transition-colors ${
                typeFilter === t
                  ? "bg-[#00BFFF] text-black font-bold border-[#00BFFF]"
                  : "border-white/15 text-white/65 hover:text-white"
              }`}
            >
              {t === "All" ? "All Types" : t}
            </button>
          ))}

          <span className="w-px h-4 bg-white/15 mx-1" />

          {["All", "Common", "Uncommon", "Rare", "Epic"].map((r) => {
            const rCfg = RARITY[r];
            const active = rarityFilter === r;
            return (
              <button
                key={r}
                onClick={() => setRarityFilter(active && r !== "All" ? "All" : r)}
                className={`px-3 py-1 rounded-full border transition-colors ${
                  active ? "text-black font-bold" : "border-white/15 text-white/65 hover:text-white"
                }`}
                style={
                  active ? { background: rCfg ? rCfg.color : "#F2A900", borderColor: rCfg ? rCfg.color : "#F2A900" } : {}
                }
              >
                {r === "All" ? "All Rarities" : r}
              </button>
            );
          })}
        </div>
      </div>

      {/* CARD GRID (OFFICIAL BACKSIDE + 322 VERIFIED FRONTS) */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {factionFilter === "All" && typeFilter === "All" && rarityFilter === "All" && !search.trim() && manifest?.web_back_url && (
          <article className="glass rounded-2xl p-4 border border-[#F2A900]/35 flex flex-col justify-between">
            <div>
              <div
                onClick={() =>
                  setLightbox({
                    name: "Official Card Back (Approved Press Master)",
                    collector_label: "4C Backside",
                    imgUrl: manifest.web_back_url,
                  })
                }
                className="relative aspect-[69/94] w-full rounded-xl overflow-hidden bg-black/70 cursor-zoom-in group"
              >
                <img
                  src={manifest.web_back_url}
                  alt="Official GlimmerFall Card Back"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform"
                />
                <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-black/80 border border-[#F2A900]/40 text-[11px] font-head font-bold text-[#F2A900]">
                  Approved Backside
                </span>
              </div>
              <div className="mt-3.5 space-y-1">
                <div className="text-xs font-head text-[#F2A900] font-semibold uppercase tracking-wider">
                  Reference Press Master
                </div>
                <h3 className="font-display text-lg font-bold text-white">Official Card Back</h3>
                <p className="text-xs font-head text-white/60 leading-relaxed">
                  Exact 69×94mm bleed &amp; R3 63×88mm red dieline specification matched across all 322 fronts.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-white/10 text-[11px] font-mono text-white/45">
              DeviceCMYK · 图层 1/2/3 Matched
            </div>
          </article>
        )}

        {shownCards.map((card) => {
          const fac = factionCfg(card.faction);
          const rar = RARITY[card.rarity] || RARITY.Common;
          const imgSrc = previewMode === "bleed" ? card.web_bleed_url : card.web_trim_url;

          return (
            <article
              key={card.collector_number}
              data-testid={`results-card-${card.collector_number}`}
              className="glass rounded-2xl p-4 border border-white/10 hover:border-white/25 transition-all flex flex-col justify-between"
            >
              <div>
                <div
                  onClick={() =>
                    setLightbox({
                      ...card,
                      imgUrl: imgSrc,
                    })
                  }
                  className="relative aspect-[69/94] w-full rounded-xl overflow-hidden bg-black/50 flex items-center justify-center cursor-zoom-in group p-1"
                >
                  <img
                    src={imgSrc}
                    alt={`${card.name} (${card.collector_label})`}
                    loading="lazy"
                    decoding="async"
                    className="max-w-full max-h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>

                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-head">
                    <span className="font-num font-bold text-[#F2A900]">{card.collector_label} / 322</span>
                    <span style={{ color: rar.color }} className="font-semibold">
                      {card.rarity}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-white leading-snug">{card.name}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-head">
                    <span className="px-2 py-0.5 rounded font-bold text-black" style={{ background: fac.color }}>
                      {card.faction} · {card.card_type}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 font-num">
                      Cost {card.cost}
                      {card.card_type === "Entity" ? ` · ${card.power}/${card.health}` : ""}
                    </span>
                    {card.lore_included && (
                      <span className="px-2 py-0.5 rounded bg-[#F2A900]/15 text-[#F2A900]">+ Lore</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-white/10 flex items-center gap-2">
                <a
                  href={card.web_pdf_url}
                  download
                  data-testid={`results-pdf-${card.collector_number}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#00BFFF]/20 hover:bg-[#00BFFF]/30 border border-[#00BFFF]/40 text-[#7FDBFF] text-xs font-head font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> CMYK Print PDF
                </a>
                <a
                  href={imgSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 text-xs font-head transition-colors"
                  title="Open full-res preview"
                >
                  <FileText className="w-3.5 h-3.5" />
                </a>
              </div>
            </article>
          );
        })}
      </section>

      {/* PAGINATION / LOAD MORE */}
      {visibleCount < filtered.length && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setVisibleCount((v) => v + PAGE_STEP)}
            data-testid="results-load-more"
            className="px-6 py-3 rounded-full bg-[#F2A900] text-black font-head font-bold text-sm hover:bg-[#ffc21f] transition-colors"
          >
            Load Next {Math.min(PAGE_STEP, filtered.length - visibleCount)} Cards ({shownCards.length} /{" "}
            {filtered.length})
          </button>
          <button
            onClick={() => setVisibleCount(filtered.length)}
            data-testid="results-show-all"
            className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-head font-semibold text-sm transition-colors"
          >
            Show All {filtered.length} Cards
          </button>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 border border-white/15 relative flex flex-col items-center gap-4"
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center">
              <div className="text-xs font-num text-[#F2A900] font-bold">{lightbox.collector_label}</div>
              <h3 className="font-display text-2xl font-bold text-white">{lightbox.name}</h3>
            </div>
            <img
              src={lightbox.imgUrl}
              alt={lightbox.name}
              className="max-h-[72vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
