import React, { createContext, useContext, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('glimmerfall_user');
    return saved ? JSON.parse(saved) : null;
  });

  React.useEffect(() => {
    if (user && localStorage.getItem('glimmerfall_token')) {
      api.get("/auth/me").then(res => {
        setUser(res.data);
        localStorage.setItem('glimmerfall_user', JSON.stringify(res.data));
      }).catch(e => {
        // Token expired or invalid
        if (e.response?.status === 401) {
          logout();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatAuthError = (e, fallback) => {
    const detail = e?.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (!e?.response) {
      return "Cannot reach the game server — make sure the backend is running or retry in a moment.";
    }
    if (e.response.status >= 500) {
      const body = typeof e.response.data === "string" ? e.response.data : "";
      if (body.includes("Could not proxy") || body.includes("ECONNREFUSED")) {
        return "Local backend (:8000) is not running — run `npm run dev` from the project root.";
      }
      return "Game server is reconnecting — please try again in a second.";
    }
    return fallback;
  };

  const login = async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email: email.trim(), password });
      setUser(res.data.user);
      localStorage.setItem('glimmerfall_user', JSON.stringify(res.data.user));
      localStorage.setItem('glimmerfall_token', res.data.token);
      toast.success("Welcome back, " + res.data.user.nickname);
      return { ok: true };
    } catch (e) {
      const msg = formatAuthError(e, "Login failed");
      toast.error(msg);
      return { ok: false, error: msg };
    }
  };

  const register = async (email, password, faction, referrerCode = null) => {
    try {
      const payload = { email: email.trim(), password, faction };
      if (referrerCode) payload.referrer_code = referrerCode;
      const res = await api.post("/auth/register", payload);
      if (res.data.token && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('glimmerfall_user', JSON.stringify(res.data.user));
        localStorage.setItem('glimmerfall_token', res.data.token);
      }
      toast.success(res.data.message);
      return { ok: true };
    } catch (e) {
      const msg = formatAuthError(e, "Registration failed");
      toast.error(msg);
      return { ok: false, error: msg };
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

  const logout = React.useCallback(() => {
    setUser(null);
    localStorage.removeItem('glimmerfall_user');
    localStorage.removeItem('glimmerfall_token');
  }, []);

  React.useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener("gf-auth-expired", onExpired);
    return () => window.removeEventListener("gf-auth-expired", onExpired);
  }, [logout]);

  const updateUser = React.useCallback((data) => {
    if (!data) return;
    setUser(prevUser => {
      if (!prevUser) return null;
      const changed = Object.keys(data).some((k) => prevUser[k] !== data[k]);
      if (!changed) return prevUser;
      const u = {...prevUser, ...data};
      localStorage.setItem('glimmerfall_user', JSON.stringify(u));
      return u;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, verify, resendVerification, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
