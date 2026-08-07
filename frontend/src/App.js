import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Cards from "@/pages/Cards";
import Rules from "@/pages/Rules";
import Booster from "@/pages/Booster";
import DeckBuilder from "@/pages/DeckBuilder";
import Arena from "@/pages/Arena";
import PrintPage from "@/pages/PrintPage";
import Dashboard from "@/pages/Dashboard";
import Stores from "@/pages/Stores";
import Community from "@/pages/Community";
import Leaderboard from "@/pages/Leaderboard";
import UserProfile from "@/pages/UserProfile";
import Codex from "@/pages/Codex";
import Support from "@/pages/Support";
import FlyerGenerator from "@/pages/FlyerGenerator";
import Shop from "@/pages/Shop";
import TutorialSandbox from "@/pages/TutorialSandbox";
import MediaKit from "@/pages/MediaKit";
import { AuthProvider } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/react";
import { useEffect } from "react";

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Small timeout to allow page to render before scrolling to ID
      setTimeout(() => {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const isPrint = pathname === "/print" || pathname === "/print-all";
  const hideChrome = isPrint || pathname === "/sandbox";
  const hideFooter = isPrint || pathname === "/play" || pathname === "/sandbox";
  return (
    <div className="dark App min-h-screen text-foreground">
      <ScrollToTop />
      {!hideChrome && <Navbar />}
      <main className={hideChrome ? "" : "pt-16"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Arena />} />
          <Route path="/sandbox" element={<TutorialSandbox />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/decks" element={<DeckBuilder />} />
          <Route path="/booster" element={<Booster />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/codex" element={<Codex />} />
          <Route path="/community" element={<Community />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile/:nickname" element={<UserProfile />} />
          <Route path="/print" element={<PrintPage />} />
          <Route path="/print-all" element={<PrintPage />} />
          <Route path="/playtest" element={<PrintPage isPlaytest />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/support" element={<Support />} />
          <Route path="/retailer-flyer" element={<FlyerGenerator />} />
          <Route path="/media-kit" element={<MediaKit />} />
        </Routes>
      </main>
      {!hideFooter && <Footer />}
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
      <Analytics />
    </AuthProvider>
  );
}

export default App;
