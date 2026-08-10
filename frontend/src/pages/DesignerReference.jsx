import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Download, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export default function DesignerReference() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/cards")
      .then(res => {
        // Sort by collector number
        const sorted = res.data.sort((a, b) => (a.collector_number || 0) - (b.collector_number || 0));
        setCards(sorted);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load cards for designer reference");
        setLoading(false);
      });
  }, []);

  const exportCSV = () => {
    const headers = [
      "Set Code", "Collector Number", "Name", "Faction", 
      "Card Type", "Cost", "Power", "Health", "Keywords", 
      "Rules Text", "Lore", "Rarity", "Image URL"
    ];
    
    const rows = cards.map(c => [
      c.set_code || "AWK",
      c.collector_number || "",
      `"${(c.name || "").replace(/"/g, '""')}"`,
      c.faction || "",
      c.card_type || "",
      c.cost ?? "",
      c.power ?? "",
      c.health ?? "",
      `"${(c.keywords || "").replace(/"/g, '""')}"`,
      `"${(c.description || "").replace(/"/g, '""')}"`,
      `"${(c.lore || "").replace(/"/g, '""')}"`,
      c.rarity || "",
      c.image_url || ""
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "glimmerfall_designer_reference.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="min-h-screen pt-24 p-8 text-center text-white/50 animate-pulse font-head">Loading Designer Database...</div>;
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">Designer Reference</h1>
          <p className="text-white/60 font-head">Complete database of all original GlimmerFall cards for external design tooling.</p>
        </div>
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 bg-[#F2A900] text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-transform"
        >
          <Download className="w-5 h-5" /> Export as CSV
        </button>
      </div>

      <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-black/60 border-b border-white/10 text-white/40 font-head uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Art</th>
                <th className="p-4">Set / #</th>
                <th className="p-4">Name</th>
                <th className="p-4">Faction</th>
                <th className="p-4">Type</th>
                <th className="p-4">Stats</th>
                <th className="p-4">Rules Text</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/80 font-head">
              {cards.map(c => (
                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    {c.image_url ? (
                      <a href={c.image_url} target="_blank" rel="noreferrer">
                        <img src={c.image_url} alt={c.name} className="w-12 h-16 object-cover rounded shadow-md border border-white/10 hover:border-[#F2A900] transition-colors" />
                      </a>
                    ) : (
                      <div className="w-12 h-16 bg-black/40 rounded border border-white/5 flex items-center justify-center text-white/20">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                  </td>
                  <td className="p-4 font-num text-white/60">
                    <span className="font-bold text-white">{c.set_code || "AWK"}</span> {c.collector_number ? `#${String(c.collector_number).padStart(3, '0')}` : ''}
                  </td>
                  <td className="p-4 font-display font-bold text-base text-[#F2A900]">{c.name}</td>
                  <td className="p-4">{c.faction || "-"}</td>
                  <td className="p-4">{c.card_type || "-"}</td>
                  <td className="p-4 font-num">
                    {c.cost !== null && <span className="inline-block bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs mr-1">{c.cost}C</span>}
                    {c.power !== null && <span className="inline-block bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs mr-1">{c.power}P</span>}
                    {c.health !== null && <span className="inline-block bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">{c.health}H</span>}
                  </td>
                  <td className="p-4 whitespace-normal min-w-[300px]">
                    {c.keywords && <div className="text-[#9B30FF] font-bold text-xs uppercase tracking-wide mb-1">{c.keywords}</div>}
                    <div className="text-white/90 font-medium mb-1">{c.description}</div>
                    {c.lore && <div className="text-white/40 italic text-xs">"{c.lore}"</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
