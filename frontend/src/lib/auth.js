import React, { createContext, useContext, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('glimmerfall_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      setUser(res.data.user);
      localStorage.setItem('glimmerfall_user', JSON.stringify(res.data.user));
      localStorage.setItem('glimmerfall_token', res.data.token);
      toast.success("Welcome back, " + res.data.user.nickname);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Login failed");
    }
  };

  const register = async (email, password, faction) => {
    try {
      const res = await api.post("/auth/register", { email, password, faction });
      toast.success(res.data.message);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Registration failed");
    }
  };

  const verify = async (token) => {
    try {
      const res = await api.post(`/auth/verify?token=${token}`);
      toast.success(res.data.message);
      if (user) {
        const u = {...user, isVerified: true};
        setUser(u);
        localStorage.setItem('glimmerfall_user', JSON.stringify(u));
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Verification failed");
    }
  };

  const resendVerification = async (email) => {
    try {
      const res = await api.post("/auth/resend-verify", { email });
      toast.success(res.data.message);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to resend verification");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('glimmerfall_user');
    localStorage.removeItem('glimmerfall_token');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, verify, resendVerification, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
