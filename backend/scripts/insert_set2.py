import psycopg2, os
from dotenv import load_dotenv

cards = [
    # SOLARI (31 cards) - Aggro / Light
    ("Solari Charger", "Entity", 1, 2, 1, "Solari", "Evasive", "When deployed, deal 1 damage to the enemy Nexus.", "Common"),
    ("Dawnbreaker Paladin", "Entity", 3, 4, 3, "Solari", "Guard, Overwhelm", "None", "Uncommon"),
    ("Sunfire Zealot", "Entity", 2, 3, 1, "Solari", "Lethal", "None", "Common"),
    ("Blinding Light", "Flash", 2, None, None, "Solari", "None", "Give target Entity -3 Power this turn.", "Common"),
    ("Radiant Strike", "Rite", 1, None, None, "Solari", "None", "Deal 2 damage to any target.", "Common"),
    ("Golden Lion", "Entity", 4, 5, 4, "Solari", "Guard", "When deployed, give another Solari Entity +1/+1.", "Rare"),
    ("Sunforge Anvil", "Relic", 3, None, None, "Solari", "None", "At the start of your turn, give a random friendly Entity +1 Power.", "Rare"),
    ("Daybreak", "Rite", 4, None, None, "Solari", "None", "Destroy all Entities with Power 3 or less.", "Epic"),
    ("Solari Vanguard", "Entity", 2, 2, 3, "Solari", "Guard", "None", "Common"),
    ("Solar Flare", "Rite", 3, None, None, "Solari", "None", "Deal 3 damage to all enemy Entities.", "Rare"),
    ("Lightsworn Archer", "Entity", 2, 3, 2, "Solari", "None", "When this Entity attacks, it gains Evasive until end of turn.", "Uncommon"),
    ("Radiant Blessing", "Rite", 2, None, None, "Solari", "None", "Heal your Nexus for 4 and draw a card.", "Uncommon"),
    ("Sun-Kissed Priest", "Entity", 3, 2, 4, "Solari", "None", "At the end of your turn, heal your Nexus for 2.", "Common"),
    ("Aegis of the Sun", "Relic", 4, None, None, "Solari", "None", "Your Nexus cannot take more than 5 damage from a single source.", "Epic"),
    ("Solar Eclipse", "Rite", 5, None, None, "Solari", "None", "Silence all enemy Entities, then deal 2 damage to them.", "Epic"),
    ("Morningstar Knight", "Entity", 5, 6, 5, "Solari", "Overwhelm", "If your Nexus is at full health, this costs 1 less.", "Rare"),
    ("Flash of Brilliance", "Flash", 1, None, None, "Solari", "None", "Target Entity gets +2/+0 this turn.", "Common"),
    ("Solari Standard Bearer", "Entity", 3, 3, 3, "Solari", "None", "Other friendly Solari Entities have +1 Power.", "Rare"),
    ("Divine Verdict", "Rite", 6, None, None, "Solari", "None", "Destroy target Entity. You gain Health equal to its Power.", "Epic"),
    ("Sunbeam", "Flash", 2, None, None, "Solari", "None", "Deal 2 damage to an attacking Entity.", "Common"),
    ("Luminous Wisp", "Entity", 1, 1, 1, "Solari", "Stealth", "When destroyed, draw a card.", "Common"),
    ("Gilded Griffin", "Entity", 4, 4, 3, "Solari", "Evasive", "None", "Uncommon"),
    ("Righteous Fury", "Rite", 2, None, None, "Solari", "None", "Target Entity gains Overwhelm and +2 Power this turn.", "Uncommon"),
    ("Solari Spellblade", "Entity", 3, 3, 2, "Solari", "None", "When you cast a Rite, this gains +1/+1.", "Rare"),
    ("Heaven's Gate", "Relic", 5, None, None, "Solari", "None", "Friendly Guard Entities have +2 Health.", "Rare"),
    ("Blazing Seraph", "Entity", 7, 7, 7, "Solari", "Evasive, Overwhelm", "When deployed, deal 3 damage to all enemies.", "Epic"),
    ("Sunstone Ritual", "Rite", 1, None, None, "Solari", "None", "Gain 2 Energy this turn. You cannot attack this turn.", "Uncommon"),
    ("Auric Elemental", "Entity", 4, 4, 5, "Solari", "None", "None", "Common"),
    ("Dawn's Arrival", "Flash", 3, None, None, "Solari", "None", "Prevent all combat damage this turn.", "Rare"),
    ("Solari Inquisitor", "Entity", 4, 4, 4, "Solari", "Lethal", "None", "Uncommon"),
    ("Crest of the Sun", "Relic", 2, None, None, "Solari", "None", "When a Solari Entity is deployed, heal your Nexus for 1.", "Common"),
    
    # UMBRI (31 cards) - Void / Control
    ("Voidling", "Entity", 1, 2, 1, "Umbri", "None", "When destroyed, deal 1 damage to the enemy Nexus.", "Common"),
    ("Shadow Assassin", "Entity", 3, 4, 2, "Umbri", "Stealth, Lethal", "None", "Rare"),
    ("Grasp of the Void", "Rite", 2, None, None, "Umbri", "None", "Give target Entity -2/-2.", "Common"),
    ("Umbri Cultist", "Entity", 2, 1, 3, "Umbri", "None", "At the end of your turn, deal 1 damage to both Nexuses.", "Uncommon"),
    ("Dark Ritual", "Rite", 1, None, None, "Umbri", "None", "Destroy a friendly Entity to draw 2 cards.", "Common"),
    ("Soul Siphon", "Rite", 3, None, None, "Umbri", "None", "Deal 3 damage to an Entity and heal your Nexus for 3.", "Uncommon"),
    ("Abyssal Horror", "Entity", 5, 5, 6, "Umbri", "Overwhelm", "When an Entity is destroyed, this gains +1/+1.", "Rare"),
    ("Void Gate", "Relic", 4, None, None, "Umbri", "None", "At the start of your turn, create a 1/1 Voidling token.", "Rare"),
    ("Eclipse Edict", "Rite", 6, None, None, "Umbri", "None", "Destroy all Entities.", "Epic"),
    ("Umbri Shade", "Entity", 2, 2, 2, "Umbri", "Evasive", "Cannot block.", "Common"),
    ("Mind Rot", "Rite", 3, None, None, "Umbri", "None", "Target opponent discards a random card.", "Uncommon"),
    ("Nightmare Weaver", "Entity", 4, 3, 5, "Umbri", "None", "Enemy Entities have -1 Power.", "Epic"),
    ("Void Touch", "Flash", 1, None, None, "Umbri", "None", "Target Entity gains Lethal this turn.", "Common"),
    ("Shadow Pact", "Rite", 2, None, None, "Umbri", "None", "Pay 3 Health. Draw 2 cards.", "Uncommon"),
    ("Umbri Overlord", "Entity", 7, 8, 8, "Umbri", "Guard", "When deployed, destroy target enemy Entity.", "Epic"),
    ("Creeping Darkness", "Rite", 4, None, None, "Umbri", "None", "Give all enemy Entities -1/-1 permanently.", "Rare"),
    ("Soul Reaper", "Entity", 4, 4, 3, "Umbri", "Lethal", "When this destroys an Entity, heal your Nexus for 2.", "Rare"),
    ("Void Prism", "Relic", 3, None, None, "Umbri", "None", "Whenever a player discards a card, deal 1 damage to their Nexus.", "Rare"),
    ("Shadow Step", "Flash", 2, None, None, "Umbri", "None", "Return target friendly Entity to your hand.", "Common"),
    ("Umbri Wraith", "Entity", 3, 3, 1, "Umbri", "Stealth", "None", "Common"),
    ("Essence Drain", "Rite", 5, None, None, "Umbri", "None", "Destroy target Entity with Power 4 or less.", "Uncommon"),
    ("Void Spawn", "Entity", 2, 3, 2, "Umbri", "None", "Enters exhausted.", "Common"),
    ("Darkness Falls", "Flash", 3, None, None, "Umbri", "None", "All Entities lose all keywords this turn.", "Epic"),
    ("Umbri Bloodmage", "Entity", 3, 2, 3, "Umbri", "None", "When you cast a Rite, deal 1 damage to the enemy Nexus.", "Uncommon"),
    ("Tome of the Void", "Relic", 5, None, None, "Umbri", "None", "Your maximum hand size is increased by 2. Draw an extra card each turn.", "Epic"),
    ("Shadow Behemoth", "Entity", 6, 6, 6, "Umbri", "Guard, Overwhelm", "None", "Rare"),
    ("Void Ripple", "Rite", 1, None, None, "Umbri", "Echo", "Deal 1 damage to target Entity.", "Uncommon"),
    ("Umbri Stalker", "Entity", 4, 5, 2, "Umbri", "Stealth", "None", "Common"),
    ("Despair", "Rite", 3, None, None, "Umbri", "None", "Target Entity cannot attack or use abilities next turn.", "Uncommon"),
    ("Altar of Sacrifice", "Relic", 2, None, None, "Umbri", "None", "Once per turn, you may destroy a friendly Entity to gain 1 Energy.", "Rare"),
    ("Void Leviathan", "Entity", 8, 9, 9, "Umbri", "Overwhelm", "When deployed, all other players sacrifice an Entity.", "Epic"),

    # TERRA (30 cards) - Growth / Protection
    ("Terra Sapling", "Entity", 1, 1, 3, "Terra", "Guard", "None", "Common"),
    ("Grizzly Bear", "Entity", 3, 4, 4, "Terra", "None", "None", "Common"),
    ("Nature's Blessing", "Rite", 2, None, None, "Terra", "None", "Give target Entity +2/+2.", "Common"),
    ("Terra Treant", "Entity", 5, 5, 6, "Terra", "Guard", "None", "Uncommon"),
    ("Wild Growth", "Rite", 3, None, None, "Terra", "None", "Gain 1 empty Energy crystal permanently.", "Rare"),
    ("Stone Golem", "Entity", 4, 3, 7, "Terra", "Guard", "Cannot attack.", "Common"),
    ("Healing Herbs", "Flash", 1, None, None, "Terra", "None", "Heal target Entity or Nexus for 3.", "Common"),
    ("Terra Druid", "Entity", 2, 2, 2, "Terra", "None", "When deployed, gain 1 temporary Energy.", "Uncommon"),
    ("Bramble Armor", "Relic", 3, None, None, "Terra", "None", "Friendly Guard Entities reflect 1 damage back to attackers.", "Rare"),
    ("Earthquake", "Rite", 6, None, None, "Terra", "None", "Deal 4 damage to all non-Evasive Entities.", "Epic"),
    ("Terra Warden", "Entity", 4, 4, 5, "Terra", "Guard", "When deployed, heal your Nexus for 2.", "Uncommon"),
    ("Giant Spider", "Entity", 3, 3, 2, "Terra", "Lethal", "None", "Common"),
    ("Root Snare", "Flash", 2, None, None, "Terra", "None", "Target attacking Entity deals no damage this turn.", "Uncommon"),
    ("Terra Ancient", "Entity", 7, 7, 8, "Terra", "Guard, Overwhelm", "When deployed, draw a card for each friendly Entity.", "Epic"),
    ("Beastmaster", "Entity", 3, 2, 3, "Terra", "None", "Other friendly Terra Entities have +1/+1.", "Rare"),
    ("Stampede", "Rite", 5, None, None, "Terra", "None", "All friendly Entities gain Overwhelm and +2 Power this turn.", "Rare"),
    ("Terra Stag", "Entity", 2, 3, 2, "Terra", "Evasive", "None", "Common"),
    ("Living Vines", "Rite", 2, None, None, "Terra", "None", "Create two 1/1 Sapling tokens with Guard.", "Uncommon"),
    ("Grove Sanctuary", "Relic", 4, None, None, "Terra", "None", "At the end of your turn, fully heal all friendly Entities.", "Epic"),
    ("Terra Basilisk", "Entity", 5, 4, 5, "Terra", "Lethal", "None", "Rare"),
    ("Feral Howl", "Flash", 1, None, None, "Terra", "None", "Target Entity gains +3 Power this turn.", "Common"),
    ("Terra Elemental", "Entity", 6, 6, 6, "Terra", "None", "None", "Common"),
    ("Natural Selection", "Rite", 4, None, None, "Terra", "None", "Destroy all Entities with Power less than their Health.", "Rare"),
    ("Terra Ranger", "Entity", 3, 3, 3, "Terra", "None", "When deployed, deal 2 damage to an Evasive Entity.", "Uncommon"),
    ("Heart of the Forest", "Relic", 5, None, None, "Terra", "None", "Your Nexus gains +1 maximum Health at the end of each turn.", "Epic"),
    ("Terra Boar", "Entity", 2, 4, 1, "Terra", "Overwhelm", "None", "Common"),
    ("Regrowth", "Rite", 3, None, None, "Terra", "None", "Return an Entity from your discard pile to your hand.", "Uncommon"),
    ("Terra Chimera", "Entity", 8, 8, 8, "Terra", "Guard, Evasive, Overwhelm", "None", "Epic"),
    ("Spore Cloud", "Flash", 2, None, None, "Terra", "None", "Give all enemy Entities -1/-0 this turn.", "Common"),
    ("Terra Forager", "Entity", 1, 1, 2, "Terra", "None", "When deployed, look at the top card of your deck. You may put it on the bottom.", "Common"),

    # AETHER (30 cards) - Spells / Tempo
    ("Aether Sprite", "Entity", 1, 2, 1, "Aether", "Evasive", "None", "Common"),
    ("Mana Bolt", "Rite", 1, None, None, "Aether", "Echo", "Deal 2 damage to target Entity.", "Common"),
    ("Aether Mage", "Entity", 3, 2, 2, "Aether", "None", "When you cast a Rite or Flash, deal 1 damage to a random enemy.", "Rare"),
    ("Counterspell", "Flash", 2, None, None, "Aether", "None", "Cancel an enemy Rite or Flash.", "Rare"),
    ("Aether Scholar", "Entity", 2, 1, 3, "Aether", "None", "When deployed, draw a card.", "Uncommon"),
    ("Arcane Intellect", "Rite", 3, None, None, "Aether", "None", "Draw 2 cards.", "Common"),
    ("Aether Golem", "Entity", 5, 4, 6, "Aether", "Guard", "Costs 1 less for each spell you've cast this turn.", "Epic"),
    ("Mana Crystal", "Relic", 2, None, None, "Aether", "None", "When you cast a spell, gain 1 temporary Energy (max once per turn).", "Rare"),
    ("Time Warp", "Rite", 7, None, None, "Aether", "None", "Take an extra turn after this one.", "Epic"),
    ("Aether Illusionist", "Entity", 4, 3, 4, "Aether", "Stealth", "When an enemy targets this, negate it and remove Stealth.", "Uncommon"),
    ("Frost Nova", "Rite", 3, None, None, "Aether", "None", "Freeze all enemy Entities (they cannot attack next turn).", "Rare"),
    ("Aether Drake", "Entity", 6, 5, 5, "Aether", "Evasive", "When deployed, draw a card.", "Common"),
    ("Blink", "Flash", 1, None, None, "Aether", "None", "Remove a friendly Entity from combat. It takes no damage.", "Uncommon"),
    ("Aether Weaver", "Entity", 2, 2, 2, "Aether", "None", "Spells cost 1 less.", "Rare"),
    ("Arcane Explosion", "Rite", 4, None, None, "Aether", "None", "Deal 2 damage to all enemy Entities.", "Uncommon"),
    ("Aether Sphinx", "Entity", 7, 5, 7, "Aether", "Evasive, Guard", "Your opponent plays with their hand revealed.", "Epic"),
    ("Spell Pierce", "Flash", 1, None, None, "Aether", "None", "Cancel a spell unless its controller pays 2 extra Energy.", "Uncommon"),
    ("Aether Elemental", "Entity", 4, 4, 4, "Aether", "None", "Gains +1/+1 whenever you draw a card.", "Rare"),
    ("Book of Secrets", "Relic", 3, None, None, "Aether", "None", "At the end of your turn, if you didn't attack, draw a card.", "Epic"),
    ("Aether Familiar", "Entity", 1, 1, 1, "Aether", "None", "When deployed, add a Mana Bolt to your hand.", "Common"),
    ("Teleport", "Rite", 2, None, None, "Aether", "None", "Swap the positions of two friendly Entities.", "Common"),
    ("Aether Warden", "Entity", 3, 3, 4, "Aether", "Guard", "None", "Common"),
    ("Mind Control", "Rite", 6, None, None, "Aether", "None", "Take control of an enemy Entity with Power 3 or less.", "Epic"),
    ("Aether Sniper", "Entity", 3, 4, 1, "Aether", "Stealth", "None", "Uncommon"),
    ("Static Shock", "Flash", 2, None, None, "Aether", "None", "Deal 1 damage to two different targets.", "Common"),
    ("Aether Serpent", "Entity", 5, 6, 3, "Aether", "Evasive", "None", "Uncommon"),
    ("Copycat", "Rite", 4, None, None, "Aether", "None", "Create a 1/1 copy of target friendly Entity.", "Rare"),
    ("Aether Channeler", "Entity", 4, 2, 5, "Aether", "None", "At the start of your turn, gain 1 Energy.", "Rare"),
    ("Mirror Shield", "Relic", 4, None, None, "Aether", "None", "The first spell your opponent casts each turn is canceled.", "Epic"),
    ("Aether Leviathan", "Entity", 8, 7, 8, "Aether", "Evasive", "Spells cannot be cast while this is attacking.", "Epic")
]

load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

# 1. Clear cards2 entirely
cur.execute("TRUNCATE TABLE cards2;")

# 2. Recreate cards2_votes table for voting logic
cur.execute("""
CREATE TABLE IF NOT EXISTS cards2_votes (
    card_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
    PRIMARY KEY (card_id, user_email)
);
""")

# 3. Insert the 122 new balanced cards
insert_query = """
    INSERT INTO cards2 (name, card_type, cost, power, health, faction, keywords, description, rarity, set_code, collector_number, ai_art_prompt) 
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'SET2', %s, %s)
"""

collector = 101
for c in cards:
    name, ctype, cost, power, health, faction, kw, desc, rarity = c
    
    # Auto-generate ai_art_prompt fallback for the Flux generation script to use later
    ai_prompt = f"A premium fantasy trading card illustration of {name}, a {faction} {ctype}."
    
    cur.execute(insert_query, (name, ctype, cost, power, health, faction, kw, desc, rarity, collector, ai_prompt))
    collector += 1

conn.commit()
print(f"Successfully inserted {len(cards)} brand new cards into cards2 and created voting table.")
cur.close()
conn.close()
