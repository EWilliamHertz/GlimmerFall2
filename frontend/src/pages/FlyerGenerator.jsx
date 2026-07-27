import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Printer, MapPin, Calendar, Clock } from "lucide-react";
import { LOGO } from "@/lib/factions";

export default function FlyerGenerator() {
  const [params] = useSearchParams();
  const type = params.get("type") || "event";
  
  const [storeName, setStoreName] = useState("Your Local Game Store");
  const [address, setAddress] = useState("123 Glimmer Street, Nexus City");
  const [date, setDate] = useState("Saturday, November 12th");
  const [time, setTime] = useState("2:00 PM");
  const [extraText, setExtraText] = useState(
    type === "marketing" 
      ? "Pre-order your booster boxes today and secure exclusive Founders Foil promos!"
      : "Join us for our first official GlimmerFall draft tournament. Prizing included!"
  );

  const printFlyer = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-5 py-10 print:p-0 print:m-0 print:max-w-none">
      
      {/* Editor UI - Hidden on Print */}
      <div className="print:hidden mb-10">
        <h1 className="font-display text-4xl font-bold mb-2">
          {type === "marketing" ? "Marketing Flyer Generator" : "Event Flyer Generator"}
        </h1>
        <p className="text-white/60 font-head mb-8">Customize your store's flyer below, then print it directly or save as PDF.</p>
        
        <div className="glass p-6 rounded-2xl grid md:grid-cols-2 gap-6 border border-white/10">
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">Store Name</label>
            <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00BFFF]" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white/80 mb-2">Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00BFFF]" />
          </div>
          {type === "event" && (
            <>
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Event Date</label>
                <input type="text" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00BFFF]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Event Time</label>
                <input type="text" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00BFFF]" />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-white/80 mb-2">Additional Details</label>
            <textarea value={extraText} onChange={e => setExtraText(e.target.value)} rows="2" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00BFFF]"></textarea>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button onClick={printFlyer} className="flex items-center gap-2 px-6 py-3 bg-[#00BFFF] hover:bg-[#20caff] text-black font-bold rounded-xl shadow-[0_0_15px_rgba(0,191,255,0.4)] transition-all">
              <Printer className="w-5 h-5" /> Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* The Printable Canvas */}
      <div className="w-full max-w-[8.5in] mx-auto bg-black text-white border-2 border-white/20 print:border-none print:w-full print:h-screen relative overflow-hidden aspect-[8.5/11]">
        
        {/* Background Decor */}
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black z-0"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00BFFF]/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#F2A900]/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        {/* Content */}
        <div className="relative z-10 p-12 h-full flex flex-col justify-between">
          
          {/* Header */}
          <div className="text-center space-y-4">
            <img src={LOGO} alt="GlimmerFall" className="w-32 h-32 mx-auto drop-shadow-[0_0_20px_rgba(56,204,255,0.6)]" />
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-widest uppercase">
              Glimmer<span className="text-[#F2A900]">Fall</span>
            </h1>
            <h2 className="font-head text-2xl md:text-3xl font-light text-[#00BFFF] tracking-wider uppercase">
              {type === "marketing" ? "Available Now" : "Official Organized Play"}
            </h2>
          </div>

          {/* Middle Body */}
          <div className="text-center space-y-6 flex-1 flex flex-col justify-center">
            {type === "marketing" ? (
              <h3 className="font-display text-5xl font-bold text-white leading-tight">
                Step into the <br/> Fractured Realms
              </h3>
            ) : (
              <h3 className="font-display text-5xl font-bold text-white leading-tight">
                Join The Battle <br/> For The Nexus
              </h3>
            )}
            
            <p className="font-head text-2xl text-white/80 max-w-lg mx-auto leading-relaxed border-y border-white/20 py-8 my-8">
              {extraText}
            </p>
          </div>

          {/* Footer Details */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl">
            <h4 className="font-display text-4xl font-bold text-[#F2A900] mb-6 text-center">{storeName}</h4>
            <div className="flex flex-col md:flex-row justify-center items-center gap-8 font-head text-lg text-white">
              {type === "event" && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-[#00BFFF]" />
                  <span>{date}</span>
                </div>
              )}
              {type === "event" && (
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-[#00BFFF]" />
                  <span>{time}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6 text-[#00BFFF]" />
                <span>{address}</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
    </div>
  );
}
