import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GraduationCap, ArrowLeft, RotateCcw } from "lucide-react";
import { api, ensurePlayerSession } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import GameBoard from "@/arena/GameBoard";

/**
 * Interactive Guided Tutorial powered by the real server-authoritative game_engine.py!
 * Inspects live match state to automatically highlight the next lesson step.
 */
export default function TutorialSandbox() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [match, setMatch] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const startNewTutorial = useCallback(async () => {
    setLoading(true);
    try {
      await ensurePlayerSession(user?.nickname || "Apprentice");
      const r = await api.post("/tutorial/start");
      const m = await api.get(`/v2/match/${r.data.matchId}`);
      setSession({ matchId: r.data.matchId, slot: 1, mode: "tutorial", status: "PLAYING" });
      setMatch(m.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not start tutorial session.");
    } finally {
      setLoading(false);
    }
  }, [user?.nickname]);

  useEffect(() => {
    startNewTutorial();
  }, [startNewTutorial]);

  // Derive the current coached lesson directly from the live game_engine state!
  const lesson = useMemo(() => {
    const st = match?.state;
    if (!st) return null;
    const p1 = st.players?.["1"];
    const p2 = st.players?.["2"];
    if (!p1 || !p2) return null;

    if (st.phase === "ENDED") {
      return {
        stepLabel: "Training Complete!",
        text: "You shattered the enemy Nexus! You're ready for GlimmerBot, Private Lobbies, and Ranked.",
        spotlight: null,
      };
    }

    // Turn 1 sequence
    if (st.turn === 1) {
      if (!p1.hasDrawnThisTurn) {
        return {
          stepLabel: "Lesson 1 of 6 · Drawing Cards",
          text: "Every turn you may draw 1 card. Tap the glowing Draw button to draw your first card!",
          spotlight: "draw",
        };
      }
      if (!p1.hasResonatedThisTurn) {
        return {
          stepLabel: "Lesson 2 of 6 · Every Card is a Glimmer Node",
          text: "Sunfire Colossus costs 5 Energy — too expensive right now! Tap Sunfire Colossus in your hand, then tap 'Charge as Node (+1)' to gain 1 permanent Energy.",
          spotlight: "hand",
        };
      }
      if ((p1.battlefield?.length || 0) === 0) {
        return {
          stepLabel: "Lesson 3 of 6 · Deploying Entities",
          text: "Now you have 1/1 Energy! Tap Solari Vanguard (Cost 1, 2/1) in your hand and tap 'Deploy' to summon it.",
          spotlight: "hand",
        };
      }
      const unexhausted = p1.battlefield.find((e) => !e.exhausted && (e.power || 0) > 0);
      if (unexhausted) {
        return {
          stepLabel: "Lesson 4 of 6 · No Summoning Sickness!",
          text: "Entities enter ready to strike immediately! Tap Solari Vanguard on your battlefield, then tap the Enemy Nexus at the top-left to deal 2 damage.",
          spotlight: "enemy-nexus",
        };
      }
      return {
        stepLabel: "Lesson 5 of 6 · Passing Priority",
        text: "Solari Vanguard is now exhausted until your next turn. Tap 'End Turn' to let the Nexus Construct take its turn!",
        spotlight: "end-turn",
      };
    }

    // Turn 3+ (Player's second turn — enemy deployed a 1/2 Guard Sentinel!)
    if (!p1.hasDrawnThisTurn) {
      return {
        stepLabel: "Lesson 6 of 6 · Breaking Through Guard",
        text: "The enemy deployed Gloom Sentinel with GUARD (blocking direct Nexus attacks)! First, tap Draw to draw your turn card.",
        spotlight: "draw",
      };
    }
    if (!p1.hasResonatedThisTurn && (p1.hand?.length || 0) > 1 && p1.energy < 1) {
      return {
        stepLabel: "Lesson 6 of 6 · Charge a Second Node",
        text: "Tap Emberwing Courier in hand and tap 'Charge as Node (+1)' so you have Energy for your spell!",
        spotlight: "hand",
      };
    }
    if ((p2.battlefield?.length || 0) > 0) {
      const hasSpell = p1.hand?.some((c) => c.cardType === "Flash" || c.cardType === "Rite");
      if (hasSpell && p1.energy >= 1) {
        return {
          stepLabel: "Lesson 6 of 6 · Casting Spells",
          text: "Tap 'Flare Strike' in your hand → tap 'Cast (1⚡)' → then tap the enemy Gloom Sentinel on the board to destroy their Guard!",
          spotlight: "enemy-entity",
        };
      }
    }

    return {
      stepLabel: "Final Blow · Shatter the Nexus!",
      text: "The Guard is gone! Attack the Enemy Nexus with your ready Entity (or cast Flare Strike at the Enemy Nexus) to reduce it to 0 HP!",
      spotlight: "enemy-nexus",
    };
  }, [match?.state]);

  const handleFinish = async () => {
    localStorage.setItem("gf_tutorial_done", "true");
    try {
      await api.post("/me/tutorial-done");
      if (user && updateUser) updateUser({ tutorial_done: true });
    } catch {}
    toast.success("Training complete! Welcome to the Arena.");
    navigate("/play");
  };

  if (loading || !match || !session) {
    return (
      <div className="min-h-[100dvh] bg-[#0B0C10] flex flex-col items-center justify-center gap-4 px-5 text-center">
        <GraduationCap className="w-12 h-12 text-[#00BFFF] animate-bounce" />
        <h1 className="font-display text-2xl font-bold">Preparing Tactical Simulator…</h1>
        <p className="text-xs font-head text-white/50">Loading real GlimmerFall combat engine</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Subtle top-left exit / restart pill bar */}
      <div className="fixed bottom-2 left-2 z-[75] hidden lg:flex items-center gap-1.5">
        <button
          onClick={() => navigate("/play")}
          className="px-3 py-1.5 rounded-xl glass text-xs font-head text-white/65 hover:text-white flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Skip to Arena
        </button>
        <button
          onClick={startNewTutorial}
          className="px-3 py-1.5 rounded-xl glass text-xs font-head text-white/65 hover:text-white flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </button>
      </div>

      <GameBoard
        session={session}
        match={match}
        refresh={setMatch}
        onExit={() => navigate("/play")}
        tutorialCoach={{
          spotlight: lesson?.spotlight || null,
          banner: lesson
            ? {
                stepLabel: lesson.stepLabel,
                text: lesson.text,
              }
            : null,
          onComplete: handleFinish,
        }}
      />
    </div>
  );
}
