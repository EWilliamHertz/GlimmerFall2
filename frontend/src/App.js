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
import { AuthProvider } from "@/lib/auth";

function Shell() {
  const { pathname } = useLocation();
  const isPrint = pathname === "/print" || pathname === "/print-all";
  const hideChrome = isPrint;
  const hideFooter = isPrint || pathname === "/play";
  return (
    <div className="dark App min-h-screen text-foreground">
      {!hideChrome && <Navbar />}
      <main className={hideChrome ? "" : "pt-16"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Arena />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/decks" element={<DeckBuilder />} />
          <Route path="/booster" element={<Booster />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/print" element={<PrintPage />} />
          <Route path="/print-all" element={<PrintPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
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
    </AuthProvider>
  );
}

export default App;
