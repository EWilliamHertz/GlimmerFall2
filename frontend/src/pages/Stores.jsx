import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Library, Star, ShieldCheck, Download, Users, Mail } from "lucide-react";

export default function Stores() {
  return (
    <div data-testid="stores-page" className="max-w-6xl mx-auto px-5 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <h1 className="font-display font-black text-4xl md:text-5xl lg:text-6xl text-white mb-6">
          Become a <span className="text-[#00BFFF] drop-shadow-[0_0_15px_rgba(0,191,255,0.4)]">Sanctioned Store</span>
        </h1>
        <p className="text-white/70 font-head text-lg md:text-xl max-w-2xl mx-auto">
          Join the GlimmerFall retailer network. Bring the war of Light and Void to your local community, host sanctioned events, and get direct support from the creators.
        </p>
      </motion.div>

      {/* Benefits Grid */}
      <section className="grid md:grid-cols-2 gap-6 mb-16">
        <div className="glass p-8 rounded-3xl border border-[#00BFFF]/20">
          <ShieldCheck className="w-10 h-10 text-[#00BFFF] mb-4" />
          <h3 className="font-display text-2xl font-bold text-white mb-3">Sanctioned Pricing</h3>
          <p className="text-white/70 font-head leading-relaxed">
            While our direct customer price is €60 (or $60), Sanctioned Stores access an exclusive wholesale price of <strong>€52 / 520 SEK</strong> per booster box.
          </p>
        </div>

        <div className="glass p-8 rounded-3xl border border-[#F2A900]/20" id="events">
          <Star className="w-10 h-10 text-[#F2A900] mb-4" />
          <h3 className="font-display text-2xl font-bold text-white mb-3">Event Support</h3>
          <p className="text-white/70 font-head leading-relaxed">
            Receive exclusive promotional cards for your player base when you host release tournaments and weekly play sessions. We actively help you grow your local meta.
          </p>
        </div>

        <div className="glass p-8 rounded-3xl border border-[#22E07B]/20">
          <Users className="w-10 h-10 text-[#22E07B] mb-4" />
          <h3 className="font-display text-2xl font-bold text-white mb-3">Website Listing</h3>
          <p className="text-white/70 font-head leading-relaxed">
            All Sanctioned Stores are added to our official Store Locator map. Players in your region will be directed to your shop to buy sealed products and participate in events.
          </p>
        </div>

        <div className="glass p-8 rounded-3xl border border-[#9932CC]/20">
          <Library className="w-10 h-10 text-[#9932CC] mb-4" />
          <h3 className="font-display text-2xl font-bold text-white mb-3">Minimum Order</h3>
          <p className="text-white/70 font-head leading-relaxed">
            To qualify for the Sanctioned Store rate, initial orders require a minimum of 1 case (6 booster boxes). Restocks have flexible minimums to support your cash flow.
          </p>
        </div>
      </section>

      {/* Application Form & Downloads */}
      <div className="grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 glass p-8 md:p-10 rounded-3xl border border-white/10">
          <h2 className="font-display text-3xl font-bold text-white mb-6">Store Application</h2>
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Store Name</label>
                <input type="text" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00BFFF] transition-colors" placeholder="Your Store Ltd." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Contact Email</label>
                <input type="email" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00BFFF] transition-colors" placeholder="contact@store.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">Store Address</label>
              <input type="text" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00BFFF] transition-colors" placeholder="123 Main St, City, Country" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/80 mb-2">Additional Information (Website, social media, current TCGs)</label>
              <textarea rows="4" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00BFFF] transition-colors" placeholder="Tell us about your community..."></textarea>
            </div>
            <button type="submit" className="px-8 py-4 bg-gradient-to-r from-[#00BFFF] to-[#007acc] hover:from-[#33ccff] hover:to-[#00BFFF] text-white font-bold rounded-xl shadow-[0_0_20px_rgba(0,191,255,0.3)] transition-all">
              Submit Application
            </button>
          </form>
        </section>

        <section className="glass p-8 rounded-3xl h-fit border border-white/10">
          <h2 className="font-display text-2xl font-bold text-white mb-6">Retailer Resources</h2>
          <div className="space-y-4">
            <a href="#" className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
              <div className="bg-[#9932CC]/20 p-2 rounded-lg text-[#9932CC]">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Marketing Flyer</div>
                <div className="text-xs text-white/50">Print-ready PDF (12MB)</div>
              </div>
            </a>
            <a href="#" className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
              <div className="bg-[#22E07B]/20 p-2 rounded-lg text-[#22E07B]">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">Event Invitation</div>
                <div className="text-xs text-white/50">Editable Template</div>
              </div>
            </a>
            <div className="mt-8 pt-6 border-t border-white/10">
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">Questions?</h3>
              <a href="mailto:retailers@glimmerfall.com" className="flex items-center gap-2 text-white hover:text-[#00BFFF] transition-colors font-head">
                <Mail className="w-4 h-4" /> retailers@glimmerfall.com
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
