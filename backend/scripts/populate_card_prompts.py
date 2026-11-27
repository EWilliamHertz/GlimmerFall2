#!/usr/bin/env python3
"""
Populate rich, promising, high-fidelity AI art prompts for all 222 cards in cards2 in NeonDB.
Formatted specifically for Fal.ai FLUX.1 [dev] image generation in GlimmerFall's
high-fantasy aether-punk art style.
"""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment")

# Faction palette and atmospheric tokens matching Set 1 standard
PALETTES = {
    "Solari": "solar gold, warm amber, incandescent white and polished brass palette",
    "Umbri": "violet-black, obsidian indigo, spectral purple and cold silver palette",
    "Terra": "deep emerald green, rich ochre, mossy stone and weathered granite palette",
    "Aether": "luminescent cobalt, electric cyan, celestial sapphire and arcane magenta palette"
}

POSTAMBLE = (
    "cinematic volumetric lighting, intricate material detail, dynamic focal composition, "
    "painterly realism, crisp silhouette, atmospheric depth; "
    "vertical 2:3 composition, leave clean visual breathing room near upper edge and lower edge for card frame; "
    "no words, no letters, no numbers, no logos, no watermark, no UI, no border"
)

# Detailed, tailored scene descriptions for all 222 cards
CARD_SCENES = {
    # ==================== SOLARI (101 - 156) ====================
    101: "a shimmering solar aegis barrier of interlocking golden hexagons deflecting a barrage of dark shadow arrows mid-flight in front of an ally",
    102: "a serene sun priestess pouring warm liquid sunlight from an ornate golden amphora over a kneeling knight, glowing dawn runes healing his wounds",
    103: "a sudden explosion of intense incandescent sunlight erupting from an embossed solar buckler, completely dazzling an oncoming dark beast",
    104: "an agile sun-scout in polished brass leather perched on an ancient sunspire parapet, scanning the horizon through a crystal spyglass at daybreak",
    105: "a brilliant solar surge infusing the edge of a templar's golden longsword with superheated radiant plasma and crackling amber sparks",
    106: "a delicate floating orb of living sunlight dancing with tiny solar flares and miniature sunspots, illuminating ancient sandstone temple pillars",
    107: "a celestial spear of concentrated golden light descending from the clouds like a meteor, striking the battlefield in a radiant shockwave",
    108: "an eager young Solari initiate in gleaming training plate practicing forms with a glowing sun-carved quarterstaff at sunrise courtyard",
    109: "a heavily armored Solari shock trooper riding a bionic solar-charged steed across sun-drenched dunes, lance lowered and gleaming",
    110: "a dedicated acolyte tending the sacred eternal flame of the Sunspire, golden robes fluttering as divine light reflects in his devout eyes",
    111: "an ancient altar carved from glowing sunstone radiating golden warmth and solar energy ribbons into the hands of praying clerics",
    112: "a blinding wave of pure white solar brilliance cascading across the battlefield, forcing charging shadowy fiends to shield their eyes in agony",
    113: "sacred golden runes glowing on scorched earth where a templar struck his hammer, creating a radiant sanctuary of daylight and healing energy",
    114: "an ornate golden heraldic crest shaped like an eclipsed sun, set with a radiant citrine gem that pulses with protective warmth",
    115: "a golden angelic silhouette wrapping wings of pure daylight around a falling paladin, miraculously reversing fatal wounds with divine grace",
    116: "a graceful archer with a recurve bow strung with woven sunbeams, arrow of pure golden light aimed toward the sky from a sunlit cliff",
    117: "a majestic falcon composed of golden fire and glowing feathers diving from the sun with talons outstretched, trailing fiery embers",
    118: "a divine blessing falling from heaven like shimmering golden rain, revitalizing weary templars and infusing their shields with radiant courage",
    119: "a battle-hardened sun paladin entering a state of righteous zeal, golden aura flaring around his broadsword as he charges forward",
    120: "a mirrored sun-shield deflecting an enemy spell back at the caster, splitting the foul energy into harmless golden motes of dust",
    121: "a benevolent cleric in embroidered white and gold vestments channeling soothing solar warmth into the wounds of an injured comrade",
    122: "a focused beam of pinpoint sunlight burning down from the clouds like a focused laser, incinerating an attacking shadowy prowler",
    123: "a master armorer at an outdoor forge hammering glowing solar steel on an anvil, sparks of liquid gold flying into the afternoon air",
    124: "a legendary celestial kite shield forged from star-metal, emblazoned with the zenith sun, emitting a steady pulsing barrier of invulnerability",
    125: "the first blinding rays of morning breaking over a mountain ridge, dispersing the darkness and halting an entire charging enemy frontline",
    126: "a stalwart sentry in heavy gilded plate holding a massive halberd at attention before the gates of the Sunspire, eyes resolute",
    127: "a giant spectral sun-hammer crashing down from the heavens upon an ancient evil creature, judgment sealed with golden divine wrath",
    128: "a massive barricade of interlocking golden energy shields raised by disciplined templars, absorbing a fiery siege explosion without buckling",
    129: "a cascading waterfall of pure liquid light washing away dark miasma, black curses, and creeping shadows from the bodies of fallen allies",
    130: "a disciplined warrior-monk balancing an ethereal radiant blade in one hand and casting a golden solar glyph with the other",
    131: "a heroic standard bearer thrusting a towering gold-embroidered Solari banner into the soil, rally call echoing as nearby soldiers surge with power",
    132: "a gleaming brass chariot pulled by two fiery golden stallions thundering across a stone viaduct, the charioteer holding radiant reins",
    133: "a sun-blessed priest with gentle features touching the forehead of an injured warrior, golden warmth soothing pain and restoring vitality",
    134: "a lightning-fast counter-thrust of a golden rapier intercepting an ambush strike, disarming the assailant in an explosion of radiant sparks",
    135: "a fierce zealot covered in sun-tattoos fighting through wounds, his golden halberd glowing hotter and brighter with every strike taken",
    136: "a towering stone anvil glowing with internal solar heat, upon which celestial weapons are forged by unseen divine hands",
    137: "a majestic armory hall filled with racks of glowing golden armor, crystal-tipped lances, and sun-forged shields ready for holy war",
    138: "an ancient relic shield inscribed with the ancient laws of Sol, creating an impenetrable field of daylight that blunts even the heaviest blows",
    139: "the cataclysmic arrival of dawn shattering the dark sky, a wave of incandescent light incinerating smaller shadowy vermin across the plain",
    140: "a magnificent winged lion sculpted from living golden light and lion's mane of solar flares, roaring with regal fury atop a high cliff",
    141: "a chorus of sun-sisters singing a holy chant from high temple balconies, golden acoustic rings visibly descending to heal soldiers below",
    142: "a valiant knight in full plate charging atop a white warhorse, lance tipped with the brilliance of the morning star piercing the gloom",
    143: "a radiant winged knight soaring through clouds bathed in midday sun, flaming golden broadsword held high as radiant feathers drift down",
    144: "an imposing high templar in ornate heavy plate standing unflinching at the vanguard of the army, shield locked in defiance of darkness",
    145: "a magnificent divine champion imbued with the fiery power of the sun, stepping onto the battlefield with molten gold swirling at his feet",
    146: "a celestial lion leaping from the sun itself with fur of incandescent plasma and eyes of amber fire, landing with thunderous presence",
    147: "a sacred shrine atop a high mountain peak catching the noon sun, channeling immense solar energy through focused crystal prisms",
    148: "a catastrophic solar eclipse where the black disc of the moon is framed by a blinding solar corona, releasing terrifying radiant shockwaves",
    149: "an enormous divine fortress floating upon golden sun-clouds, its soaring spires and ramparts carved from polished white marble and gold",
    150: "a massive divine archon of light standing thirty feet tall, clad in ethereal golden plate and holding a colossal balance scale of justice",
    151: "a terrifying golden dragon whose scales are molten brass and whose breath is a torrent of superheated solar plasma scorching the earth",
    152: "a celestial ceremony crowning a kneeling warrior with a coronet of solar fire, divine authority and immense power flowing into his spirit",
    153: "a revered high inquisitor in grand ceremonial vestments holding a flaming sun-brand, casting judgment over cowering shadowy creatures",
    154: "a crystalline sun-well overflowing with shimmering golden water, surrounded by sun-flowers and priests drawing bowls of liquid blessing",
    155: "an ancient solar titan striding across mountain valleys, each footprint leaving scorched golden glass and blooming radiant flora",
    156: "an awesome celestial archangel of the zenith descending from heaven, six radiant wings outstretched as blinding judgment incinerates all evil",

    # ==================== UMBRI (157 - 212) ====================
    157: "a sinister parasitic leech composed of dark shadow and purple ichor clinging to cold tomb stones, siphoning glowing soul energy",
    158: "creeping tendrils of amethyst smoke and spectral shadow coiling through keyholes, whispering insidious madness into an unsuspecting sleeper",
    159: "a jagged ritual dagger crafted from black volcanic glass dripping with glowing purple venom, resting upon an altar of skulls",
    160: "a spectral assassin stepping silently out of a solid shadow pool, obsidian daggers poised as cold moonlight glints off dark steel",
    161: "an eerie raven woven of nightfall and glowing violet eyes perching upon an iron gargoyle in a rain-slicked Gothic cemetery",
    162: "a cloaked Umbri shade-walker darting between darkened city alleyways, moving like liquid ink across moonlit cobblestones",
    163: "a shadowy cutthroat lurking in the eaves of a derelict cathedral, unseen eyes tracking prey below from impenetrable blackness",
    164: "a cloaked cultist carving cursed shadow glyphs into a stone doorway, deep violet energy oozing from the fresh incisions",
    165: "an alchemical vial of concentrated void venom shattering on the stone floor, hissing purple fumes dissolving metal and stone",
    166: "a dark phantom with hollow violet eyes stepping through a prison wall, chill frost and dying torches following in its wake",
    167: "a swirling dark shadow barrier rising to swallow a blazing firebolt, extinguishing the flame into harmless black ash",
    168: "a swarm of skittering voidlings with many needle-like legs and glowing purple eyes swarming out from a fissure in the dungeon floor",
    169: "a skeletal shadow-hound with elongated fangs stalking through misty graveyard ruins, tracking the scent of blood with violet senses",
    170: "a fanatic cultist offering drops of dark blood into a silver chalice, dark purple runes crawling up his arms with forbidden strength",
    171: "an eerie gothic lantern glowing with cold spectral purple flame, casting shadows that seem to move of their own independent will",
    172: "a cunning Umbri agent with hidden daggers standing in the shadows of a grand imperial ballroom, eyes locked onto a decadent noble target",
    173: "a shadowy mist demon manifesting behind an unsuspecting guard, long ethereal claws sinking into his neck with chilling silence",
    174: "a blood-stained shadow beast feasting on the remains of a fallen warrior, dark energy swirling around its growing fangs and claws",
    175: "a shadowy ritual ring where spectral hands pull an injured allied assassin into the floor, slipping away from the jaws of defeat",
    176: "a shadowy illusionist holding a cracked silver mirror, casting multiple ethereal shadow decoys into the fog to confuse attackers",
    177: "a dark Umbri knight with a weeping blade of black steel parrying an incoming axe blow, dark energy leeching the attacker's strength",
    178: "a hooded shadowy phantom with outstretched skeletal hands, pulling wisps of glowing cyan soul essence from a dying soldier's chest",
    179: "an iron crest bearing the stylized crescent moon and twin daggers, shrouded in permanent cold mist and frost crystals",
    180: "a dark ritual dagger slipping between the ribs of an enemy commander from behind, black smoke erupting from the fatal wound",
    181: "a sinister dark cloud descending over a battlefield, muffling all sound into dead silence as shadowy figures reap the panicked ranks",
    182: "a shadowy void-shifter dissolving into a flock of black spectral bats to evade a swinging morningstar, reforming unharmed behind the foe",
    183: "an Umbri scout wearing an enchanted mask of raven feathers, seeing invisible spirits and tracking ethereal footsteps through the woods",
    184: "a subterranean pool of bubbling black liquid reflection, hands of drowned spirits reaching up through the oily surface",
    185: "a malevolent spectral entity rising from an open crypt, dragging heavy shadow-chains as cold mist freezes the cemetery grass",
    186: "a dark curse spreading across an enemy entity's body like black veins, draining its power and leaving its limbs withered and weak",
    187: "a sinister warlock with hollow glowing purple eyes drawing life force from a captured enemy, rejuvenating his own withered flesh",
    188: "a dark scythe with a crescent blade of obsidian cutting through an ethereal phantom, absorbing its spectral energy into the staff",
    189: "a shadowy puppet master manipulating ethereal strings of violet smoke attached to the limbs of a helpless enemy soldier",
    190: "an assassin vanishing completely into thin air mid-stride, leaving only a fading violet silhouette and the whisper of cold wind",
    191: "an imposing Umbri shadow-knight in spiked obsidian armor standing atop a rampart, black cloak billowing against a blood-red moon",
    192: "a dark gothic crypt overflowing with creeping black roots and glowing purple soul-lamps, eerie statues watching from alcoves",
    193: "a terrifying hound woven from nightmares and void matter howling at an eclipsed moon, chilling the air into black frost",
    194: "a grotesque abyssal horror with writhing tentacles and multiple glowing violet eyes rising from a deep chasm in the earth",
    195: "an ancient stone altar stained dark with centuries of forbidden sacrifices, spectral whispers swirling around cold braziers",
    196: "a terrifying arch-necromancer holding an iron scepter crowned with a void diamond, commanding legions of shadowed spirits",
    197: "a massive spectral monstrosity formed from hundreds of screaming shadow-souls, towering over a ruined Gothic cathedral",
    198: "a cursed black crystal skull whose empty eye sockets project visions of death and ruin into the minds of any who gaze within",
    199: "a cloaked shadow lord snapping his fingers to snuff out every torch and lantern in an ancient citadel, plunging all into pitch black",
    200: "a terrifying void hound with razor-sharp quills and dripping shadow-maw lunging through a portal of pure darkness",
    201: "a dark priestess with a porcelain mask chanting a curse, spectral violet flames consuming the memories and spells of an enemy mage",
    202: "an Umbri stalker leaping silently from the rafters of an ancient library, daggers drawn to silence an arcane scholar",
    203: "a cursed dagger infused with void essence lying on an ornate velvet cushion, whispering dark impulses to any who approach",
    204: "a towering dark inquisitor holding an iron brand glowing with violet flame, demanding secrets from terrified captives in a stone dungeon",
    205: "an ancient crypt lord sitting upon a throne of black iron, draped in regal velvet and shadow, radiating cold immortal dread",
    206: "a dark mirror reflecting an empty room while ghostly figures move within the glass, watching the viewer with sinister intent",
    207: "a dread sovereign clad in spired black plate armor overlooking a city enveloped in eternal eclipse, eyes blazing with cold purple fire",
    208: "a sinister ritual opening an abyssal gateway beneath a ruined city, swirling vortex of black void tearing stone from the earth",
    209: "a colossal winged shadow dragon composed of midnight fog and purple lightning, swooping silently over dark gothic spires",
    210: "an ancient dread titan formed from cracked black obsidian and pulsing void energy, towering like a mountain over ruined plains",
    211: "an eerie eclipse ritual at midnight where dark cultists link hands, pulling the light out of the sun and painting the sky in violet horror",
    212: "the ultimate sovereign of shadows seated upon a throne of pure darkness, holding the severed strings of fate as reality warps around him",

    # ==================== TERRA (213 - 267) ====================
    213: "a young druidic acolyte with skin transforming into patterned oak bark, kneeling beside a clear forest spring ringed by glowing ferns",
    214: "a lively little seedling creature woven of green briars, moss, and tiny yellow blossoms scampering playfully over ancient tree roots",
    215: "a fierce forest predator with emerald eyes stalking silently through thick primeval underbrush, morning mist drifting over mossy logs",
    216: "an ancient horned stag made of intertwined living vines and blooming white orchids stepping gracefully through a moonlit glade",
    217: "thick green thorny briars erupting from the forest soil with immense speed, wrapping tightly around the ankles of an armored raider",
    218: "a brave forest warden in worn leather armor and leaf-cloaked tunic drawing an ironwood bow beneath the canopy of giant redwoods",
    219: "a resilient moss-covered sproutling breaking through a solid cracked granite boulder, glowing with green life-force energy",
    220: "an agile badger-like beast with stone claws and mossy fur burrowing beneath roots to evade a swinging enemy club",
    221: "a seasoned scout in bark-woven camouflage blending seamlessly against the trunk of a colossal mossy oak, observing from the branches",
    222: "a magnificent horned stag with stone-hard antlers charging forward to protect its herd, crushing stone beneath heavy hooves",
    223: "a wise druid in lichen robes weaving emerald vines and glowing green threads between ancient menhirs to mend a forest breach",
    224: "a wild boar with tusks of solid granite and moss-covered hide plowing through undergrowth with unstoppable primeval momentum",
    225: "a colossal grizzly bear with stone plating embedded into its thick brown fur roaring defiantly in a mountain river valley",
    226: "a young treant protector with blooming birch branches extending protective wooden arms over a cowering forest fawn",
    227: "an earthen ring of carved runic standing stones pulsing with deep emerald light, shielding a grove from arcane corruption",
    228: "a crystalline spring bubbling out of a mossy stone grotto, radiant green water glowing with restorative rejuvenation energy",
    229: "a weathered stone golem infused with ancient roots and glowing green lichen, standing watch over a forgotten forest shrine",
    230: "a towering ironwood treant with a beard of Spanish moss and deep-set amber eyes striding ponderously through an autumn forest",
    231: "a gigantic spider with emerald-patterned abdomen and legs like twisted thorn branches lurking in a web woven across towering pines",
    232: "a wild feral wolf leaping through autumn leaves with jaws glowing with green primal fury, ready to strike down an intruder",
    233: "an earth-shaman slamming a gnarled wooden staff into the ground, sending shockwaves through the earth that topple enemy barricades",
    234: "a primal roar echoing from a mountain summit, acoustic shockwaves rustling the entire forest and filling beasts with untamed ferocity",
    235: "a mighty horned stag with magnificent leaf-shaped antlers leaping across a rushing mountain stream bathed in dappled morning sunlight",
    236: "a massive prehistoric direwolf with moss-covered pelt and glowing green eyes leading a pack through snow-dusted pine woods",
    237: "a terrifying ancient basilisk with scales of green petrified wood and unblinking amber eyes, turning a stone statue in its lair",
    238: "a massive elemental composed of living loam, river boulders, and tangled roots emerging from the earth with unstoppable weight",
    239: "an ancient moss-covered drake with wings like gigantic autumn maple leaves resting atop a craggy forested mountain peak",
    240: "a dense subterranean network of glowing bioluminescent mycorrhizal fungi and tree roots pulsing with shared life energy underground",
    241: "a colossal subterranean earth-worm with armored stone scales burrowing up from the deep earth in a spray of dirt and boulders",
    242: "a fierce wild boar with armored stone plates and curving razor tusks charging headlong through an enemy shield line",
    243: "a grove of ancient trees wrapping massive living roots around a crumbling stone temple, preserving its sacred core from decay",
    244: "a monstrous chimera combining traits of bear, ram, and oak tree, standing triumphant atop a mountain ridge in a wilderness storm",
    245: "an elder forest warden whose body has become half ironwood, holding a massive stone-headed spear in defense of the Mother Tree",
    246: "a peaceful sacred clearing in the deep forest where wounded woodland creatures drink from a pool of shimmering green life-dew",
    247: "a sudden violent tectonic upheaval under an attacking enemy's feet, jagged spikes of granite erupting to impale and stun",
    248: "a protective carapace of thorny ironwood and spiked brambles hardening over a defender's skin like living natural plate armor",
    249: "divine nature spirits intervening to shield a dying druid with a dense dome of woven roots and fragrant blooming orchids",
    250: "a magnificent primeval dire-bear standing twelve feet tall with rocky spine ridges, defending a sacred river against corrupted invaders",
    251: "a carved wooden totem entwined with living ivy driven into the earth, roots expanding in all directions to entangle approaching foes",
    252: "an ancient curved hunting horn carved from the horn of a primeval beast, sounding a call that summons spectral wolves from the trees",
    253: "massive ancient roots of the World Tree delving deep into the molten core of the earth, anchored in ancient granite bedrock",
    254: "a catastrophic earthshatter fissure splitting the ground wide open, swallowing enemy war machines into deep rocky chasms",
    255: "an ancient canopy of colossal redwood trees so dense and high that an entire city of wooden walkways rests suspended in the green light",
    256: "an elder druid channeling a surge of pure primeval vitality, causing dead trees to burst into vibrant leaf and wild roses in seconds",
    257: "a massive granite behemoth formed from prehistoric cliff-faces and ancient moss, striding forward with earthquakes at each footfall",
    258: "the living green spirit of the forest itself, a luminous feminine dryad crowned with wild flowers and antlers, cradling a tiny seedling",
    259: "a colossal primordial stone golem fifty feet tall covered in ancient ivy and waterfalls, standing as an eternal guardian of the valley",
    260: "a swarm of razor-sharp thorny brambles spreading across a battleground like living barbed wire, ensnaring all who attempt to cross",
    261: "an ancient stone altar crowned with a massive glowing emerald geode, pulsing with the steady heartbeat of the living earth",
    262: "a legendary nature sovereign crowned with living oak branches and emerald vines, commanding the beasts and trees of the realm",
    263: "an earth-rending tremor shaking an entire canyon, dislodging massive stone avalanches that crush an invading legion below",
    264: "a magical metamorphosis where fallen soldiers dissolve into rich loam, giving birth to a grove of towering treant protectors",
    265: "an ancient stone monolith inscribed with primeval spiral petroglyphs, glowing with the deep resonance of tectonic power",
    266: "a colossal primordial dragon with hide of mossy granite and wings of interlocking autumn leaves soaring majestically over deep fjords",
    267: "the supreme World-Tree herself, Gaia the world-soul, a cosmic tree whose roots span continents and whose canopy cradles the starry heavens",

    # ==================== AETHER (268 - 322) ====================
    268: "a charming little winged celestial fox composed of pure starlight and cyan energy, curled up on an ancient leather-bound grimoire",
    269: "a hovering crystalline beacon projecting concentric rings of cobalt and cyan light into the night sky, charting planetary orbits",
    270: "an arcane scholar gazing into an intricate brass astrolabe, his eyes glowing with starlight as multiple timelines unfold before him",
    271: "a nimble chronomancer vanishing in a flash of geometric azure glyphs, leaving an ethereal afterimage as an arrow strikes empty air",
    272: "a young apprentice with glowing hands weaving crackling ribbons of blue static electricity between copper coils in a high-tech laboratory",
    273: "an intricate multi-faceted prism fashioned from a fallen star, refracting light into pure raw magical energy that charges mana batteries",
    274: "a sudden pulse of electromagnetic counter-energy bursting from an arcane gauntlet, shattering an incoming hostile spell into blue sparks",
    275: "a bolt of pure concentrated azure arcana streaking across a darkened chamber like blue lightning, striking a stone target with concussive force",
    276: "a translucent floating wisp of pure rift energy hovering over an arcane ley-line, emitting soft blue light and curiosity",
    277: "a delicate needle of crystalline mana penetrating an enemy's protective ward, unraveling their spellwork like pulled thread",
    278: "a violent burst of cyan mana dispelling all enchantments and shields from an enemy warrior, stripping them to bare armor in blue sparks",
    279: "a scholarly wizard in indigo robes floating above the floor of an immense circular library, surrounded by rings of rotating flying books",
    280: "a graceful weaver of arcane strings manipulating glowing blue threads of energy between her fingertips to knit a protective ward",
    281: "a glowing runic ward snapping closed over an enemy spellcaster's hands, violently neutralizing their cast in a shower of sapphire dust",
    282: "an ornate antique brass hourglass where luminous blue sand flows upwards against gravity, reversing minor events in time",
    283: "a raw jagged crystal of pure concentrated mana humming with stored energy on an intricate brass pedestal, ready to be tapped",
    284: "a glowing tear in the fabric of space revealing a star-filled cosmos, through which two luminous blue wisps emerge into the room",
    285: "an ethereal scout who can phase between dimensions slipping like a ghost through a solid wall of iron shields, dagger at the ready",
    286: "a curious miniature sprite formed from a tiny contained singularity, absorbing nearby spells and growing brighter with each pulse",
    287: "a celestial researcher kneeling on a platform of glowing star-maps, reading the cosmic alignments of the distant constellations",
    288: "twin bolts of crackling blue static electricity leaping from a mage's fingertips to jolt two separate mechanical automatons",
    289: "two allied warriors trading places instantaneously in twin columns of azure light, confusing their attackers with sudden repositioning",
    290: "an intense combat mage in combat robes with glowing blue eyes, casting rapid-fire energy darts from both hands simultaneously",
    291: "a barrage of five glowing arcane missiles tracing spiral trajectories through the air before slamming into enemy positions",
    292: "a powerful astral conjuror summoning twin wisps of living blue starlight from open palms, surrounded by floating geometric circles",
    293: "an ancient tome with a locked brass clasp glowing with forbidden arcane secrets, opening on its own to reveal shimmering cyan text",
    294: "a freezing blast of glacial blue arcana sweeping across the stone floor, encasing the feet and weapons of charging foes in ice",
    295: "a towering mechanical warden of gravity wielding a heavy brass pendulum, emitting localized gravitational waves that slow rushers",
    296: "a localized gravity anomaly tearing through the air, dragging enemies inward toward a dense blue vortex that crushes with arcane pressure",
    297: "a swift bladed dancer whose rapier cuts leave trails of blue arcane fire, striking in perfect synchronicity with her incantations",
    298: "a temporal duelist blinking backwards through time after every rapier thrust, leaving only a fading blue silhouette to absorb counterattacks",
    299: "a serene mystic channeling raw aether from an overhead rift into a floating crystal array, generating endless magical power",
    300: "a towering elemental entity formed from liquid blue mana, shifting geometric crystals, and crackling lightning, growing stronger with every spell",
    301: "an enigmatic illusionist whose form fractures into shimmering prismatic mirrors when targeted, misdirecting attacks harmlessly",
    302: "a devastating shockwave of blue arcane fire detonating outward from a central point, sending enemy infantry flying through the air",
    303: "converging beams of celestial blue and violet light focusing into a single cataclysmic point of energy on an enemy champion",
    304: "a majestic dragon with scales of deep indigo and wings that resemble nebulae and starfields, breathing a beam of concentrated starlight",
    305: "an ancient brass astrolabe suspended in midair with rotating gimbal rings and lenses that focus cosmic light to reduce spellcraft strain",
    306: "a wise chronomancer sage holding an hourglass staff, gesturing to reverse a mutated monster back into its humble base form",
    307: "an ethereal mirror duplicate of a heroic knight stepping forth from a pool of mercury, identical in every detail down to the blade",
    308: "a floating buckler of polished silver crystal that absorbs hostile spells and reflects them as harmless showers of colored sparks",
    309: "a powerful construct of dark brass and spinning gravity rings, pulling adversaries toward its crushing mechanical fists",
    310: "a localized sphere of frozen time where arrows hang suspended mid-flight and an enemy commander is trapped like an insect in amber",
    311: "a colossal golem constructed from floating arcane masonry and glowing blue mana conduits, powered by the spells of nearby wizards",
    312: "a dark spatial fracture opening in the battlefield, banishing an enemy beast into a cold void dimension between realities",
    313: "a massive cosmic titan stepping through a planetary rift, body shimmering with galaxy clusters as reality shatters under his tread",
    314: "a regal sovereign draped in robes of deep space and starlight, floating effortlessly above a circle of worshipful arcane mages",
    315: "a majestic time-warp dragon with twin pairs of gossamer wings, capable of accelerating through time to strike twice in the blink of an eye",
    316: "a noble drake of the high aether gliding through sea of clouds, its iridescent scales reflecting the aurora borealis",
    317: "the supreme arch-mage of the conclave floating in meditation, surrounded by orbiting elemental orbs that amplify his spells ten-fold",
    318: "a colossal leviathan swimming through the deep rift of space, its fins creating tidal waves of cyan light that freeze all they touch",
    319: "wisps of glowing violet and cyan energy weaving into an enemy warrior's mind, placing him under the total mental control of an aether mage",
    320: "an endless loop of glowing temporal rings replaying a cast spell in instantaneous succession, duplicating its reality without cost",
    321: "an enigmatic golden sphinx with wings of blue starlight and all-seeing eyes, gazing into the opponent's mind and revealing their cards",
    322: "the ultimate Aether Leviathan, a cosmic beast the size of a mountain floating through shattered flying islands, trailing auroras of raw magic"
}

def build_full_prompt(scene_desc, faction):
    palette = PALETTES.get(faction, PALETTES["Solari"])
    return f"Premium high-fantasy aether-punk trading-card illustration of {scene_desc}; {palette}; {POSTAMBLE}"

def main():
    print("=" * 70)
    print("Populating tailored high-fidelity image prompts for all 222 cards...")
    print("=" * 70)

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT id, collector_number, name, faction, card_type FROM cards2 ORDER BY collector_number ASC")
    cards = cur.fetchall()

    if len(cards) != 222:
        print(f"WARNING: Expected 222 cards in cards2, found {len(cards)}")

    updated = 0
    missing = []

    for c in cards:
        c_num = c["collector_number"]
        c_id = c["id"]
        c_name = c["name"]
        faction = c["faction"]

        if c_num not in CARD_SCENES:
            missing.append((c_num, c_name))
            continue

        scene = CARD_SCENES[c_num]
        full_prompt = build_full_prompt(scene, faction)

        cur.execute("""
            UPDATE cards2
            SET ai_art_prompt = %s,
                image_prompt = %s
            WHERE id = %s
        """, (full_prompt, full_prompt, c_id))
        updated += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"Successfully updated {updated} / {len(cards)} card prompts in NeonDB!")
    if missing:
        print(f"Missing scenes for {len(missing)} cards: {missing}")
    else:
        print("100% of cards have been assigned world-class tailored prompts!")

if __name__ == "__main__":
    main()
