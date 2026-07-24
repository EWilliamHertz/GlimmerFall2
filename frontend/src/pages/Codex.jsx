import React from "react";
import { BookOpen } from "lucide-react";

export default function Codex() {
  return (
    <div className="max-w-4xl mx-auto px-5 py-24 space-y-12">
      <div className="text-center">
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
          <BookOpen className="w-10 h-10 text-[#00BFFF]" /> The Lore Codex
        </h1>
        <p className="text-white/60 font-head max-w-2xl mx-auto text-lg">
          Explore the deep lore, world history, and faction origins of GlimmerFall.
        </p>
      </div>

      <section className="glass rounded-3xl p-8 md:p-12">
        <h2 className="font-display text-3xl font-bold mb-6 text-[#F2A900]">The World of GlimmerFall</h2>
        <div className="space-y-4 text-white/80 font-head leading-relaxed text-lg">
          <p>
            When the celestial radiance known as the Glimmer met the devouring silence of the Fall, reality did not end it fractured. At the heart of creation, the Nexus, a crystalline core that bound all worlds into one, shattered in a storm of light, shadow, and impossible starlight. Its fragments fell into four realms, each reshaped by the force that claimed it.
          </p>
          <p>
            Now the realms stand at the brink of conquest. Through Resonance, powerful champions draw upon the shattered Nexus to deploy mighty Entities, unleash world-altering Rites, and defend what remains from forces that would bend existence to their will. Every clash is a struggle for more than victory: it is a battle to decide whether the Glimmer will restore the world or the Fall will consume it forever.
          </p>
          <p className="font-bold text-[#00BFFF] pt-2">
            Choose your realm. Protect your Nexus. Shape the fate of GlimmerFall.
          </p>
        </div>
      </section>

      <section className="space-y-8">
        <h2 className="font-display text-3xl font-bold text-center mb-10">The Four Factions</h2>

        <div className="glass rounded-3xl p-8 border-l-4 border-[#F2A900]">
          <h3 className="font-display text-2xl font-bold mb-4 text-[#F2A900]">Solari   The Light</h3>
          <p className="text-white/80 font-head leading-relaxed">
            The Solari believe order is mercy and truth is a weapon. Beneath vast aureate spires and skies split by holy radiance, angelic guardians and celestial champions stand as the last unbroken shield against the Fall. Solari decks endure through healing, protective Bastions, and disciplined defenses then turn the tide with towering late-game Entities whose brilliance leaves nowhere for darkness to hide.
          </p>
        </div>

        <div className="glass rounded-3xl p-8 border-l-4 border-[#9B30FF]">
          <h3 className="font-display text-2xl font-bold mb-4 text-[#9B30FF]">Umbri   The Darkness</h3>
          <p className="text-white/80 font-head leading-relaxed">
            The Umbri do not fear the Void; they listen to it. In hidden sanctums and moonless alleys, assassins, spectres, and forbidden scholars trade certainty for power, turning secrets into blades. Their playstyle is swift, cruel, and deliberate: disrupt an opponent’s plans, drain their strength, strike from stealth, and sacrifice what is expendable to claim an advantage no honest force could match.
          </p>
        </div>

        <div className="glass rounded-3xl p-8 border-l-4 border-[#22E07B]">
          <h3 className="font-display text-2xl font-bold mb-4 text-[#22E07B]">Terra   The Earth</h3>
          <p className="text-white/80 font-head leading-relaxed">
            The Terra answer to older laws: root, stone, storm, and tooth. Their realm is alive with colossal elementals, primeval beasts, and wardens whose patience is measured in centuries. Terra builds momentum like a gathering mountain accelerating its resources, fielding resilient defenders, and eventually unleashing overwhelming force that is almost impossible to move once it takes hold.
          </p>
        </div>

        <div className="glass rounded-3xl p-8 border-l-4 border-[#00BFFF]">
          <h3 className="font-display text-2xl font-bold mb-4 text-[#00BFFF]">Aether   The Magic</h3>
          <p className="text-white/80 font-head leading-relaxed">
            The Aether see reality as a current to be redirected, not a law to be obeyed. Amid cosmic storms, floating observatories, and fractured constellations, wizards and astral adepts weave possibility into power. Aether decks reward spell mastery, extra card draw, and clever manipulation, chaining Rites into explosive combinations that can transform the battlefield in a single, spectacular moment.
          </p>
        </div>
      </section>
    </div>
  );
}
