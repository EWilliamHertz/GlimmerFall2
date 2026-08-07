import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Download, ExternalLink, Image as ImageIcon } from "lucide-react";
import { CARDBACK, RARITY_ICONS } from "@/lib/factions";

export default function MediaKit() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/cards")
      .then((res) => {
        setCards(res.data.filter(c => c.image_url && c.image_url !== "None"));
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const otherAssets = [
    { name: "Card Back", url: CARDBACK },
    { name: "Common Rarity Icon", url: RARITY_ICONS.Common },
    { name: "Uncommon Rarity Icon", url: RARITY_ICONS.Uncommon },
    { name: "Rare Rarity Icon", url: RARITY_ICONS.Rare },
    { name: "Epic Rarity Icon", url: RARITY_ICONS.Epic },
    { name: "Mythic Rarity Icon", url: RARITY_ICONS.Mythic }
  ];

  if (loading) {
    return <div className="p-20 text-center text-white/50 animate-pulse font-head">Loading Media Kit...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-5 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-display text-4xl md:text-5xl font-black mb-4">GlimmerFall Media Kit</h1>
        <p className="text-white/60 max-w-2xl mx-auto font-head">
          This is a private page for graphic designers and partners containing raw, borderless artwork and branding assets. Click on the external link icon to open the full-resolution image on Cloudinary, or right-click to save.
        </p>
      </div>

      <div className="mb-16">
        <h2 className="text-2xl font-bold font-head mb-6 flex items-center gap-2 border-b border-white/10 pb-2">
          <ImageIcon className="w-6 h-6 text-[#F2A900]" /> Core Branding Assets
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {otherAssets.map((asset) => (
            <div key={asset.name} className="glass rounded-xl p-4 flex flex-col items-center justify-center group relative overflow-hidden">
              <div className="h-24 w-full flex items-center justify-center mb-3">
                <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" />
              </div>
              <span className="text-xs font-head text-white/70 text-center">{asset.name}</span>
              <a 
                href={asset.url} 
                target="_blank" 
                rel="noreferrer" 
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white hover:text-[#00BFFF]"
              >
                <ExternalLink className="w-6 h-6" />
              </a>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold font-head mb-6 flex items-center gap-2 border-b border-white/10 pb-2">
          <ImageIcon className="w-6 h-6 text-[#00BFFF]" /> Raw Card Artwork ({cards.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {cards.map((card) => (
            <div key={card.id} className="glass rounded-xl overflow-hidden group relative">
              <div className="aspect-[5/7] bg-black">
                <img src={card.image_url} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="p-3">
                <h3 className="font-bold text-sm truncate">{card.name}</h3>
                <p className="text-xs text-white/50 truncate">{card.faction}</p>
              </div>
              <a 
                href={card.image_url} 
                target="_blank" 
                rel="noreferrer" 
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 items-center justify-center text-white font-head text-sm"
              >
                <ExternalLink className="w-6 h-6 mb-1 hover:text-[#00BFFF]" />
                <span className="hover:text-[#00BFFF]">View Full Res</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
