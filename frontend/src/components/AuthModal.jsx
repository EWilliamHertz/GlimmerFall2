import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { X } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [faction, setFaction] = useState('solari');
  
  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      await login(email, password);
    } else {
      await register(email, password, faction);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="glass-strong rounded-2xl w-full max-w-md relative shadow-2xl border border-white/10 my-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        
        {/* TABS */}
        <div className="flex border-b border-white/10">
          <button 
            className={`flex-1 py-4 text-sm font-bold tracking-widest uppercase transition-colors ${isLogin ? 'text-[#F2A900] border-b-2 border-[#F2A900]' : 'text-white/50 hover:text-white'}`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button 
            className={`flex-1 py-4 text-sm font-bold tracking-widest uppercase transition-colors ${!isLogin ? 'text-[#00BFFF] border-b-2 border-[#00BFFF]' : 'text-white/50 hover:text-white'}`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <h2 className="text-2xl font-display font-bold mb-6 text-center">
            {isLogin ? 'Welcome Back' : 'Join the Alpha'}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-head text-white/60 mb-1.5 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#F2A900] focus:ring-1 focus:ring-[#F2A900] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-head text-white/60 mb-1.5 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#F2A900] focus:ring-1 focus:ring-[#F2A900] transition-all"
                required
              />
            </div>
            
            {!isLogin && (
              <div>
                <label className="block text-xs font-head text-white/60 mb-1.5 uppercase tracking-wider">Favorite Faction</label>
                <select 
                  value={faction}
                  onChange={(e) => setFaction(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF] transition-all"
                >
                  <option value="solari">Solari (Light)</option>
                  <option value="umbri">Umbri (Shadow)</option>
                  <option value="terra">Terra (Earth)</option>
                  <option value="aether">Aether (Magic)</option>
                </select>
              </div>
            )}

            <button type="submit" className={`w-full py-3.5 rounded-xl text-black font-bold tracking-wide transition-colors ${isLogin ? 'bg-[#F2A900] hover:bg-[#ffc21f]' : 'bg-[#00BFFF] hover:bg-[#20caff]'}`}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
