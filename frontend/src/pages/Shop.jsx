import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ShoppingCart, Plus, Minus, X, Globe, Truck, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CURRENCIES = {
  SEK: { symbol: "kr", label: "SEK (kr)", rate: 11.0, format: (val) => `${val} kr` },
  EUR: { symbol: "€", label: "EUR (€)", rate: 0.95, format: (val) => `${val} €` },
  USD: { symbol: "$", label: "USD ($)", rate: 1.0, format: (val) => `$${val}` },
};

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem("gf_shop_currency") || "SEK";
  });

  const changeCurrency = (c) => {
    setCurrency(c);
    localStorage.setItem("gf_shop_currency", c);
  };

  const getProductImage = (product) => {
    if (product.image_url) return product.image_url;
    const n = (product.name || "").toLowerCase();
    if (n.includes("gaia") || n.includes("terra")) return "/deckboxes_3.0/gaias_loop_3.0.png";
    if (n.includes("solar") || n.includes("solari")) return "/deckboxes_3.0/solar_singularity_3.0.png";
    if (n.includes("fractur") || n.includes("aether")) return "/deckboxes_3.0/fractured_continuum_3.0.png";
    if (n.includes("graveglass") || n.includes("umbri")) return "/deckboxes_3.0/graveglass_veil_3.0.png";
    return null;
  };

  const isTuckbox3 = (product) => {
    const n = (product.name || "").toLowerCase();
    return n.includes("gaia") || n.includes("solar") || n.includes("fractur") || n.includes("graveglass") || n.includes("starter");
  };

  const getConvertedPrice = (usdPrice) => {
    const p = parseFloat(usdPrice) || 0;
    if (currency === "SEK") {
      if (Math.abs(p - 19.99) < 0.5) return 219;
      if (Math.abs(p - 119.99) < 1.0) return 1299;
      return Math.round(p * 11.0);
    }
    if (currency === "EUR") {
      if (Math.abs(p - 19.99) < 0.5) return 18.99;
      if (Math.abs(p - 119.99) < 1.0) return 109.99;
      return parseFloat((p * 0.95).toFixed(2));
    }
    return p;
  };

  const formatPriceDisplay = (usdPrice) => {
    const val = getConvertedPrice(usdPrice);
    if (currency === "SEK") return `${val.toLocaleString()} kr`;
    if (currency === "EUR") return `${val.toFixed(2)} €`;
    return `$${val.toFixed(2)}`;
  };

  const handleCheckout = async () => {
    try {
      setCheckoutLoading(true);
      const items = cart.map(item => ({ id: item.id, quantity: item.quantity }));
      const res = await api.post("/shop/checkout", { items, currency: currency.toLowerCase() });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to initiate checkout. Please try again.");
      setCheckoutLoading(false);
    }
  };

  const getProductLore = (name) => {
    if (name.includes("Gaia")) {
      return {
        theme: "Unstoppable natural growth, giant elemental beasts, and the cyclical power of the earth.",
        desc: "Embrace the primal heartbeat of the world. Gaia's Loop accelerates your Resonance capabilities at frightening speeds, allowing you to deploy colossal elemental behemoths while your opponent is still gathering their strength. Command the World-Soul and let the forest reclaim the battlefield.",
        type: "40-Card Preconstructed 3.0 Tuck-Box Deck"
      };
    }
    if (name.includes("Solar")) {
      return {
        theme: "Blinding speed, radiant fire, and overwhelming aggressive Light magic.",
        desc: "Strike with the fury of a dying star. Solar Singularity is a hyper-aggressive deck that utilizes fast, flying celestial entities to overwhelm the opponent's defenses before they can set up. Burn away their resources and crash through with the brilliant might of the Emberwings.",
        type: "40-Card Preconstructed 3.0 Tuck-Box Deck"
      };
    }
    if (name.includes("Fractured")) {
      return {
        theme: "Time manipulation, spell echoing, and disruption of reality itself.",
        desc: "Rewrite the rules of engagement. Fractured Continuum is a complex, spell-heavy control deck that bends time and space to its will. Copy your spells, counter your opponent's Rites, and trap their Entities in temporal loops until reality collapses entirely in your favor.",
        type: "40-Card Preconstructed 3.0 Tuck-Box Deck"
      };
    }
    if (name.includes("Graveglass")) {
      return {
        theme: "Necromancy, forbidden knowledge, and sacrificial shadow magic.",
        desc: "Look beyond the veil of mortality. The Graveglass Veil excels at utilizing the discard pile as a second hand. Sacrifice your own Entities to trigger devastating effects, gaze into the future, and overwhelm your foes with an endless tide of undying shadow horrors.",
        type: "40-Card Preconstructed 3.0 Tuck-Box Deck"
      };
    }
    if (name.includes("Awakening")) {
      return {
        theme: "The First Edition Set featuring cards from all four primary factions.",
        desc: "Secure your physical collector's box. Each booster box contains 30 booster packs, with 10 cards per pack including guaranteed rare or higher drops. Build entirely new decks or enhance your starter decks with legendary epics.",
        type: "30-Pack Booster Box"
      };
    }
    return {
      theme: "GlimmerFall Product",
      desc: "A premium product for the GlimmerFall Trading Card Game.",
      type: "Product"
    };
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") && params.get("session_id")) {
      api.get(`/shop/orders/session/${params.get("session_id")}`)
        .then(res => setReceiptData(res.data))
        .catch(e => toast.error("Payment successful, but failed to load receipt details."));
    } else if (params.get("success")) {
      toast.success("Payment successful! Your order will be processed.");
    }
    if (params.get("canceled")) {
      toast.error("Checkout was canceled.");
    }

    api.get("/shop/products").then(res => {
      setProducts(res.data);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    toast.success(`Added ${product.name} to cart!`, {
      style: { background: '#111', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (getConvertedPrice(item.price) * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const formatCartTotal = () => {
    if (currency === "SEK") return `${cartTotal.toLocaleString()} kr`;
    if (currency === "EUR") return `${cartTotal.toFixed(2)} €`;
    return `$${cartTotal.toFixed(2)}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-5 py-12 relative animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Sticky Top Store Nav */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8 sticky top-[72px] z-[90] bg-[#0a0a0c]/90 backdrop-blur-2xl py-4 -mx-5 px-5 border-b border-white/10 rounded-b-xl shadow-2xl shadow-black/50">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-1 tracking-wide">
            GLIMMERFALL <span className="text-[#F2A900]">STORE</span>
          </h1>
          <p className="text-white/50 text-xs sm:text-sm">Physical 3.0 Tuck-Box Theme Decks &amp; Collector Booster Boxes.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Currency Switcher */}
          <div className="flex items-center bg-black/60 border border-white/15 rounded-xl p-1 text-xs font-head font-bold">
            {Object.keys(CURRENCIES).map((cKey) => (
              <button
                key={cKey}
                onClick={() => changeCurrency(cKey)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  currency === cKey 
                    ? "bg-[#F2A900] text-black shadow-md font-black" 
                    : "text-white/60 hover:text-white"
                }`}
              >
                {cKey}
              </button>
            ))}
          </div>

          {/* Cart Dialog Trigger */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="relative glass px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors flex items-center gap-2.5">
                <ShoppingCart className="w-5 h-5 text-white/80" />
                <span className="font-bold text-white font-num">{formatCartTotal()}</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#F2A900] text-black text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-lg">
                    {cartCount}
                  </span>
                )}
              </button>
            </DialogTrigger>
            <DialogContent className="glass-panel border border-white/10 sm:max-w-md bg-black/95 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-display text-white">Your Cart</DialogTitle>
              </DialogHeader>

              {/* Shipping info banner */}
              <div className="bg-[#00BFFF]/10 border border-[#00BFFF]/20 rounded-xl p-3 text-xs font-head flex items-center gap-2.5 text-[#00BFFF]">
                <Truck className="w-4 h-4 shrink-0" />
                <span>Spårbart via PostNord (2-4 vardagar inom Sverige &amp; Norden)</span>
              </div>

              <div className="mt-4 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-white/40 font-head">Your cart is empty.</div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                      <div>
                        <div className="font-bold text-white text-sm font-head">{item.name}</div>
                        <div className="text-white/50 text-xs font-num">{formatPriceDisplay(item.price)} each</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-black/60 border border-white/10 rounded-lg">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-white/10 rounded-l-lg"><Minus className="w-3 h-3 text-white/70" /></button>
                          <span className="w-8 text-center text-sm font-bold text-white font-num">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-white/10 rounded-r-lg"><Plus className="w-3 h-3 text-white/70" /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-white/40 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-white/60 font-head">Subtotal ({currency})</span>
                    <span className="text-2xl font-bold text-white font-display">{formatCartTotal()}</span>
                  </div>

                  <div className="text-[11px] font-head text-white/40 mb-4 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#22E07B]" />
                    <span>Säker Stripe checkout med Kort, Klarna och Apple Pay</span>
                  </div>

                  <Button 
                    disabled={checkoutLoading} 
                    onClick={handleCheckout} 
                    className="w-full bg-[#F2A900] hover:bg-[#FFD700] text-black font-bold h-12 text-lg shadow-[0_0_20px_rgba(242,169,0,0.3)] transition-all font-head"
                  >
                    {checkoutLoading ? "Redirecting to Stripe..." : `Proceed to Checkout (${currency})`}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Trust & Shipping Highlights Banner */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-white/10">
          <Truck className="w-6 h-6 text-[#00BFFF] shrink-0" />
          <div>
            <div className="text-sm font-bold text-white font-head">PostNord Express</div>
            <div className="text-xs text-white/50">2-4 days tracked in Nordics &amp; EU</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-white/10">
          <Sparkles className="w-6 h-6 text-[#F2A900] shrink-0" />
          <div>
            <div className="text-sm font-bold text-white font-head">3.0 Production Tuckboxes</div>
            <div className="text-xs text-white/50">300 DPI dieline print finish</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-white/10">
          <ShieldCheck className="w-6 h-6 text-[#22E07B] shrink-0" />
          <div>
            <div className="text-sm font-bold text-white font-head">Stripe Verified</div>
            <div className="text-xs text-white/50">Klarna, Card, Apple Pay supported</div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <Dialog open={!!receiptData} onOpenChange={(v) => !v && setReceiptData(null)}>
        <DialogContent className="glass-strong border-white/20 bg-black/95 max-w-2xl p-0 overflow-hidden text-white">
          {receiptData && (
            <div>
              <div className="bg-[#00BFFF]/20 border-b border-[#00BFFF]/30 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#00BFFF]/20 flex items-center justify-center mx-auto mb-4 text-[#00BFFF]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <DialogTitle className="font-display text-3xl font-bold text-white mb-2">Order Confirmed!</DialogTitle>
                <p className="text-white/60 font-head text-sm">Thank you for supporting GlimmerFall. Your order is being packed.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center text-sm font-head border-b border-white/10 pb-3">
                  <span className="text-white/50">Order Reference</span>
                  <span className="font-mono font-bold text-white">#{receiptData.id}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-head border-b border-white/10 pb-3">
                  <span className="text-white/50">Shipping Carrier</span>
                  <span className="font-bold text-white">PostNord Tracked</span>
                </div>
                <div className="flex justify-between items-center text-sm font-head border-b border-white/10 pb-3">
                  <span className="text-white/50">Estimated Delivery</span>
                  <span className="font-bold text-[#22E07B]">{receiptData.delivery_eta || "2-4 business days"}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      {selectedProduct && (
        <Dialog open={!!selectedProduct} onOpenChange={(v) => !v && setSelectedProduct(null)}>
          <DialogContent className="glass-panel border border-white/10 sm:max-w-3xl bg-black/95 text-white overflow-hidden p-0">
            <div className="grid md:grid-cols-2 h-full">
              <div className="bg-black/60 p-8 flex flex-col items-center justify-center border-r border-white/10 relative">
                {getProductImage(selectedProduct) ? (
                  <img 
                    src={getProductImage(selectedProduct)} 
                    alt={selectedProduct.name} 
                    className="w-full max-h-80 object-contain drop-shadow-[0_0_30px_rgba(242,169,0,0.3)]" 
                  />
                ) : (
                  <div className="w-48 h-64 bg-white/5 rounded-xl border border-white/20 flex items-center justify-center text-white/30 font-display">
                    3.0 DECKBOX
                  </div>
                )}
                {isTuckbox3(selectedProduct) && (
                  <div className="mt-4 px-3 py-1 rounded-full bg-[#F2A900]/20 border border-[#F2A900]/40 text-[#F2A900] text-xs font-head font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> 3.0 Production Tuckbox
                  </div>
                )}
              </div>

              <div className="p-6 flex flex-col justify-between">
                <div>
                  <DialogTitle className="text-2xl font-display font-bold text-white mb-1">
                    {selectedProduct.name}
                  </DialogTitle>
                  <div className="text-xs text-[#00BFFF] font-head font-bold mb-4">
                    {getProductLore(selectedProduct.name).type}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-white/80 font-bold text-xs uppercase tracking-wider mb-1">Theme</h4>
                      <p className="text-white/60 text-xs leading-relaxed">{getProductLore(selectedProduct.name).theme}</p>
                    </div>
                    <div>
                      <h4 className="text-white/80 font-bold text-xs uppercase tracking-wider mb-1">Lore</h4>
                      <p className="text-white/60 text-xs leading-relaxed">{getProductLore(selectedProduct.name).desc}</p>
                    </div>

                    {getProductLore(selectedProduct.name).type.includes('Deck') && (
                      <div className="bg-white/5 p-3 rounded-xl border border-[#F2A900]/30 text-center">
                        <p className="text-xs text-white/80 mb-2 font-bold">Contains a tournament-legal 40-card preconstructed deck.</p>
                        <button 
                          onClick={() => window.location.href = "/decks?tab=precon"}
                          className="text-[11px] bg-[#F2A900] text-black px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider hover:bg-[#FFD700] transition-colors"
                        >
                          View Decklist &amp; Analytics
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <div className="text-2xl font-bold font-display text-white">
                        {formatPriceDisplay(selectedProduct.price)}
                      </div>
                      <div className="text-white/40 text-[11px]">Weight: {selectedProduct.weight_kg} kg · PostNord delivery</div>
                    </div>
                  </div>

                  <Button 
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="w-full bg-[#F2A900] hover:bg-[#FFD700] text-black font-bold h-11 text-base shadow-[0_0_20px_rgba(242,169,0,0.3)] transition-all font-head"
                  >
                    Add to Cart ({formatPriceDisplay(selectedProduct.price)})
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Main Products Grid */}
      {loading ? (
        <div className="text-center py-20 text-white/50 font-head">Loading catalog...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(product => {
            const isOOS = product.stock <= 0 && !product.is_preorder;
            const isPreorder = product.stock <= 0 && product.is_preorder;
            const imgSrc = getProductImage(product);
            
            return (
              <div key={product.id} className="relative group h-full" onClick={() => setSelectedProduct(product)}>
                <div className="glass-panel border border-white/10 rounded-2xl overflow-hidden h-full group-hover:border-white/30 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all cursor-pointer flex flex-col">
                  <div className="aspect-[4/3] bg-black/60 relative flex items-center justify-center p-6 border-b border-white/5">
                    {imgSrc ? (
                      <img 
                        src={imgSrc} 
                        alt={product.name} 
                        className="w-full h-full object-contain drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-500 ease-out" 
                      />
                    ) : (
                      <div className="w-32 h-44 bg-gradient-to-br from-white/10 to-white/5 rounded-lg border border-white/20 shadow-2xl flex items-center justify-center">
                        <span className="text-white/20 font-display font-bold text-center text-xs">3.0 BOX</span>
                      </div>
                    )}

                    {isTuckbox3(product) && (
                      <div className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded-md bg-black/70 border border-white/20 text-[10px] font-head font-bold text-[#F2A900]">
                        3.0 Dieline
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col relative overflow-hidden">
                    <h3 className="text-lg font-bold text-white mb-1.5 font-display">{product.name}</h3>
                    <p className="text-white/60 text-xs mb-4 flex-1 line-clamp-3 font-head">{product.description}</p>
                    
                    <div className="flex items-end justify-between mt-auto pt-3 border-t border-white/5">
                      <div>
                        <div className="text-xl font-bold font-display text-white">
                          {formatPriceDisplay(product.price)}
                        </div>
                        <div className="text-[10px] text-white/40 font-head">PostNord Tracked</div>
                      </div>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(product);
                        }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold font-head transition-all bg-white hover:bg-white/90 text-black shadow-md hover:scale-105"
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
