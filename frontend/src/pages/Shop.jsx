import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ShoppingCart, Plus, Minus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const getProductLore = (name) => {
    if (name.includes("Gaia")) {
      return {
        theme: "Unstoppable natural growth, giant elemental beasts, and the cyclical power of the earth.",
        desc: "Embrace the primal heartbeat of the world. Gaia's Loop accelerates your Resonance capabilities at frightening speeds, allowing you to deploy colossal elemental behemoths while your opponent is still gathering their strength. Command the World-Soul and let the forest reclaim the battlefield.",
        type: "40-Card Preconstructed Tuck-Box Deck"
      };
    }
    if (name.includes("Solar")) {
      return {
        theme: "Blinding speed, radiant fire, and overwhelming aggressive Light magic.",
        desc: "Strike with the fury of a dying star. Solar Singularity is a hyper-aggressive deck that utilizes fast, flying celestial entities to overwhelm the opponent's defenses before they can set up. Burn away their resources and crash through with the brilliant might of the Emberwings.",
        type: "40-Card Preconstructed Tuck-Box Deck"
      };
    }
    if (name.includes("Fractured")) {
      return {
        theme: "Time manipulation, spell echoing, and disruption of reality itself.",
        desc: "Rewrite the rules of engagement. Fractured Continuum is a complex, spell-heavy control deck that bends time and space to its will. Copy your spells, counter your opponent's Rites, and trap their Entities in temporal loops until reality collapses entirely in your favor.",
        type: "40-Card Preconstructed Tuck-Box Deck"
      };
    }
    if (name.includes("Graveglass")) {
      return {
        theme: "Necromancy, forbidden knowledge, and sacrificial shadow magic.",
        desc: "Look beyond the veil of mortality. The Graveglass Veil excels at utilizing the discard pile as a second hand. Sacrifice your own Entities to trigger devastating effects, gaze into the future, and overwhelm your foes with an endless tide of undying shadow horrors.",
        type: "40-Card Preconstructed Tuck-Box Deck"
      };
    }
    if (name.includes("Awakening")) {
      return {
        theme: "The First Edition Set featuring cards from all four primary factions.",
        desc: "Secure your physical collector's box. Each booster box contains 30 booster packs, with 10 cards per pack including guaranteed rare or higher drops. Build entirely new decks or enhance your starter decks with legendary mythics.",
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

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="max-w-7xl mx-auto px-5 py-12 relative animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-wide">
            GLIMMERFALL <span className="text-[#F2A900]">STORE</span>
          </h1>
          <p className="text-white/50">Purchase Starter Decks and Booster Boxes to play in the real world.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <button className="relative glass px-4 py-3 rounded-xl hover:bg-white/5 transition-colors flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-white/80" />
              <span className="font-bold text-white">${cartTotal.toFixed(2)}</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#F2A900] text-black text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
          </DialogTrigger>
          <DialogContent className="glass-panel border border-white/10 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display text-white">Your Cart</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-white/40">Your cart is empty.</div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                    <div>
                      <div className="font-bold text-white text-sm">{item.name}</div>
                      <div className="text-white/50 text-xs">${item.price} each</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-black/40 rounded-lg">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-white/10 rounded-l-lg"><Minus className="w-3 h-3 text-white/70" /></button>
                        <span className="w-8 text-center text-sm font-bold text-white">{item.quantity}</span>
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
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-white/60">Total</span>
                  <span className="text-2xl font-bold text-white">${cartTotal.toFixed(2)}</span>
                </div>
                <Button className="w-full bg-[#F2A900] hover:bg-[#FFD700] text-black font-bold h-12 text-lg">
                  Checkout
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {selectedProduct && (
        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="glass-panel border border-white/10 sm:max-w-3xl p-0 overflow-hidden bg-[#0a0a0c]">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/2 bg-black/60 relative flex items-center justify-center p-8 border-r border-white/10">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="max-w-full max-h-80 object-contain drop-shadow-2xl" />
                ) : (
                  <div className="w-48 h-64 bg-gradient-to-br from-white/10 to-white/5 rounded-lg border border-white/20 shadow-2xl flex items-center justify-center">
                    <span className="text-white/20 font-display font-bold text-center leading-tight text-xl">PRODUCT<br/>MOCKUP</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 text-center text-[10px] text-white/40 uppercase tracking-widest bg-black/80 px-2 py-1 rounded backdrop-blur-sm">
                  * Product design not final. 3D mockup for visualization purposes only.
                </div>
              </div>
              <div className="md:w-1/2 p-8 flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-display text-white mb-1">{selectedProduct.name}</DialogTitle>
                </DialogHeader>
                <div className="text-[#00BFFF] text-sm font-bold uppercase tracking-widest mb-4">
                  {getProductLore(selectedProduct.name).type}
                </div>
                
                <div className="space-y-4 flex-1">
                  <div>
                    <h4 className="text-white/80 font-bold text-sm uppercase tracking-wider mb-1">Theme</h4>
                    <p className="text-white/60 text-sm">{getProductLore(selectedProduct.name).theme}</p>
                  </div>
                  <div>
                    <h4 className="text-white/80 font-bold text-sm uppercase tracking-wider mb-1">Lore</h4>
                    <p className="text-white/60 text-sm leading-relaxed">{getProductLore(selectedProduct.name).desc}</p>
                  </div>
                  
                  {getProductLore(selectedProduct.name).type.includes('Deck') && (
                    <div className="bg-white/5 p-4 rounded-lg border border-[#F2A900]/30 mt-4 text-center">
                      <p className="text-sm text-white/80 mb-3 font-bold">Contains a fully playable 40-card preconstructed deck.</p>
                      <button 
                        onClick={() => window.location.href = "/decks?tab=precon"}
                        className="text-xs bg-[#F2A900] text-black px-4 py-2 rounded-full font-bold uppercase tracking-wider hover:bg-[#FFD700] transition-colors"
                      >
                        View Full Decklist
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <div className="text-3xl font-bold text-white">${selectedProduct.price}</div>
                      <div className="text-white/40 text-sm">Weight: {selectedProduct.weight_kg} kg</div>
                    </div>
                    {selectedProduct.stock <= 0 && selectedProduct.is_preorder && (
                      <div className="text-[#C77DFF] font-bold">ETA: {selectedProduct.eta}</div>
                    )}
                  </div>
                  <Button 
                    disabled={selectedProduct.stock <= 0 && !selectedProduct.is_preorder}
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    className="w-full bg-[#F2A900] hover:bg-[#FFD700] text-black font-bold h-12 text-lg shadow-[0_0_20px_rgba(242,169,0,0.3)] hover:shadow-[0_0_30px_rgba(242,169,0,0.6)] transition-all"
                  >
                    {selectedProduct.stock <= 0 && selectedProduct.is_preorder ? 'Pre-order Now' : (selectedProduct.stock <= 0 ? 'Out of Stock' : 'Add to Cart')}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {loading ? (
        <div className="text-center py-20 text-white/50">Loading products...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(product => {
            const isOOS = product.stock <= 0 && !product.is_preorder;
            const isPreorder = product.stock <= 0 && product.is_preorder;
            
            return (
              <div key={product.id} className="relative group h-full" onClick={() => setSelectedProduct(product)}>
                <div className="glass-panel border border-white/10 rounded-2xl overflow-hidden h-full group-hover:border-white/30 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all cursor-pointer flex flex-col">
                  <div className="aspect-[4/3] bg-black/60 relative flex items-center justify-center p-6 border-b border-white/5">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-700 ease-out" />
                    ) : (
                      <div className="w-32 h-48 bg-gradient-to-br from-white/10 to-white/5 rounded-lg border border-white/20 shadow-2xl transform group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
                        <span className="text-white/20 font-display font-bold text-center leading-tight">MOCKUP</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <h3 className="text-xl font-bold text-white mb-2 relative z-10">{product.name}</h3>
                    <p className="text-white/60 text-sm mb-4 flex-1">{product.description}</p>
                    
                    <div className="flex items-end justify-between mt-auto">
                    <div>
                      <div className="text-2xl font-bold text-white">${product.price}</div>
                      {isPreorder && product.eta && (
                        <div className="text-[#C77DFF] text-xs mt-1">ETA: {product.eta}</div>
                      )}
                      {!isPreorder && (
                        <div className={`text-xs mt-1 ${product.stock > 0 ? 'text-[#22E07B]' : 'text-red-400'}`}>
                          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </div>
                      )}
                    </div>
                    <Button 
                      disabled={isOOS}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      className={isPreorder ? "bg-[#9B30FF] hover:bg-[#C77DFF] text-white shadow-[0_0_15px_rgba(155,48,255,0.4)]" : "bg-white hover:bg-white/90 text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"}
                    >
                      {isPreorder ? 'Pre-order' : (isOOS ? 'Out of Stock' : 'Add to Cart')}
                    </div>
                  </div>
                </div>
                {isPreorder && (
                  <div className="absolute -top-3 -right-3 bg-[#9B30FF] text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-[0_0_20px_rgba(155,48,255,0.6)] border border-white/20 z-20 pointer-events-none">
                    Pre-order
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
