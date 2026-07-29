import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ShoppingCart, Plus, Minus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

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

      {loading ? (
        <div className="text-center py-20 text-white/50">Loading products...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(product => {
            const isOOS = product.stock <= 0 && !product.is_preorder;
            const isPreorder = product.stock <= 0 && product.is_preorder;
            
            return (
              <div key={product.id} className="glass-panel border border-white/10 rounded-2xl overflow-hidden group hover:border-white/30 transition-colors flex flex-col">
                <div className="aspect-[4/3] bg-black/40 relative flex items-center justify-center p-6">
                  {/* Placeholder box for deck */}
                  <div className="w-32 h-48 bg-gradient-to-br from-white/10 to-white/5 rounded-lg border border-white/20 shadow-2xl transform group-hover:scale-105 transition-transform duration-500 flex items-center justify-center">
                    <span className="text-white/20 font-display font-bold text-center leading-tight">STARTER<br/>DECK</span>
                  </div>
                  
                  {isPreorder && (
                    <div className="absolute top-4 right-4 bg-[#9B30FF] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Pre-order
                    </div>
                  )}
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-white mb-2">{product.name}</h3>
                  <p className="text-white/60 text-sm mb-6 flex-1">{product.description}</p>
                  
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
                      onClick={() => addToCart(product)}
                      className={isPreorder ? "bg-[#9B30FF] hover:bg-[#C77DFF] text-white" : "bg-white hover:bg-white/90 text-black"}
                    >
                      {isPreorder ? 'Pre-order' : (isOOS ? 'Out of Stock' : 'Add to Cart')}
                    </Button>
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
