/**
 * Character Creation flow for the `protocharacter` actor type.
 *
 * Two views per step, toggled by [data-view] on the root form:
 *   browse — a carousel of big holographic cards; click one to
 *   reveal — the chosen card enlarged beside its details (and, for choice folk,
 *            an inline allocator), with Choose / Back.
 * Confirming the last step flips `flags.stryder.creation.complete`.
 *
 * Folk step: fixed folk apply talents/senses immediately via the shared
 * _applyFolkChoices pipeline; choice folk (Colossus, Floran, Traveler, Wildkin)
 * render an inline allocator whose values feed the same pipeline. Oumen's
 * allocator (origin + affliction) is a later pass.
 */

const FLAG_SCOPE = 'stryder';
const FLAG_KEY = 'creation';
const FOLK_PACK = 'stryder.stryder-folk';

/** Folk name (lowercased) → card art file under systems/stryder/assets/folk/. */
const FOLK_ART_DIR = 'systems/stryder/assets/folk';
const FOLK_ART = {
  colossus: 'colossus.png',
  descendant: 'descendant.png',
  feyfolk: 'feyfolk.png',
  floran: 'floran.png',
  halfling: 'halfling.png',
  oumen: 'oumen.png',
  remnant: 'remnant.png',
  smallfolk: 'smallfolk.png',
  sunborn: 'sunborn.png',
  traveler: 'traveler.png',
  wildkin: 'wildkin.png',
};
function folkArt(name) {
  const file = FOLK_ART[String(name ?? '').trim().toLowerCase()];
  return file ? `${FOLK_ART_DIR}/${file}` : null;
}

/** Ordered creation steps. `id` matches the choices key stored on the actor. */
export const CREATION_STEPS = [
  { id: 'folk',           noun: 'Folk',        title: 'Choose your Folk',            subtitle: 'The people you were born to.' },
  { id: 'life-origin',    noun: 'Life Origin', title: 'Choose your Life Origin',     subtitle: 'Who you were before you took the mantle.' },
  { id: 'stryder-origin', noun: 'Loadout',     title: 'Spend your Origin Points',    subtitle: 'Where your journey as a Stryder begins.' },
  { id: 'armament',       noun: 'Path',        title: 'Create your Soul Armament',   subtitle: 'or perhaps, travel a different road…' },
  { id: 'stats',          noun: 'Spread',      title: 'Choose your Stats',           subtitle: 'Distribute your potential.' },
  { id: 'xp',             noun: 'Plan',        title: 'Spend Experience',            subtitle: 'Hone your talents and senses.' },
  { id: 'mastery',        noun: 'Plan',        title: 'Spend Mastery',               subtitle: 'Refine what you have mastered.' },
];

/* -------------------------------------------- */
/*  State helpers                               */
/* -------------------------------------------- */

export function getCreationState(actor) {
  const data = actor?.getFlag(FLAG_SCOPE, FLAG_KEY);
  return foundry.utils.mergeObject(
    { complete: false, stepIndex: 0, choices: {} },
    data ?? {},
    { inplace: false }
  );
}

export function isCreationComplete(actor) {
  return getCreationState(actor)?.complete === true;
}

/* -------------------------------------------- */
/*  Step data                                   */
/* -------------------------------------------- */

/** Load selectable Folk from the compendium (+ any world folk items). */
async function getFolkCards() {
  const out = [];
  try {
    const pack = game.packs.get(FOLK_PACK);
    if (pack) {
      const docs = await pack.getDocuments();
      for (const d of docs) if (d.type === 'folk') out.push(d);
    }
  } catch (err) {
    console.warn('[Stryder Creation] Could not load folk pack:', err);
  }
  for (const i of (game.items?.filter(i => i.type === 'folk') ?? [])) out.push(i);

  const toCard = (d) => {
    const contain = String(d.name).trim().toLowerCase() === 'colossus';
    return {
      id: d.id,
      uuid: d.uuid,
      name: d.name,
      img: folkArt(d.name) || d.img || 'icons/svg/mystery-man.svg',
      tagline: 'Folk',
      description: d.system?.description || '<p>No description provided.</p>',
      contain,
      fit: contain ? 'contain' : 'cover',
    };
  };
  const cards = out.map(toCard);

  if (!cards.some(c => c.name?.trim().toLowerCase() === 'smallfolk')) {
    cards.push({
      id: 'smallfolk-placeholder',
      uuid: '',
      name: 'Smallfolk',
      img: folkArt('Smallfolk') || 'icons/svg/mystery-man.svg',
      tagline: 'Folk',
      description: '<p><em>Placeholder card.</em> Smallfolk are a small-statured folk, distinct from Halflings. A proper compendium entry is coming.</p>',
      contain: false,
      fit: 'cover',
    });
  }

  cards.sort((a, b) => a.name.localeCompare(b.name));
  return cards;
}

/** A single placeholder card for steps that aren't built yet. */
function wipCards(step) {
  return [{
    id: 'wip',
    uuid: '',
    name: step.title,
    img: 'icons/svg/mystery-man.svg',
    tagline: step.noun,
    description: `<p><em>This step isn't built yet.</em> It's a placeholder so the whole flow can be walked end to end. Choose to continue.</p>`,
    contain: false,
    fit: 'cover',
  }];
}

/* -------------------------------------------- */
/*  Life Origin (step 2) — data + cards         */
/* -------------------------------------------- */

/**
 * Origin Points granted scale INVERSELY with the star rank: simpler pasts
 * hand you more points to spend as a Stryder, complex pasts fewer.
 */
const ORIGIN_POINTS_BY_RANK = { 1: 20, 2: 10, 3: 5 };

/** Fallback card art per rank if a per-origin placeholder is missing. */
const LO_RANK_ICON = {
  1: 'icons/svg/item-bag.svg',
  2: 'icons/svg/aura.svg',
  3: 'icons/svg/upgrade.svg',
};

/** Placeholder icons sliced from the fantasy inventory sheet, one per origin. */
const LIFE_ORIGIN_ART_DIR = 'systems/stryder/assets/origin';
const loSlug = (name) => String(name ?? '').trim().toLowerCase().replace(/\s+/g, '-');

/**
 * Canonical Life Origin content (Stryder Design Doc). ★ origins are fully
 * specced (bundle + Unique Skill + Talents + Challenges); ★★/★★★ carry the
 * Unique-Skill/effect blurbs that exist so far — some are name-only and marked
 * `wip` until their write-ups land. `img` may be set later to real art.
 */
const LIFE_ORIGIN_DATA = [
  // ── ★ Origins | 20 Origin Points ──
  {
    name: 'Farmer', rank: 1,
    skill: { name: 'Green Thumb', text: 'Whenever you make a 2d6 roll involving plants of any kind, roll an additional d6 and add it to the roll. If you roll two d6’s on such a roll, you gain a Glory Token. You can also harvest two components from Aldrova-type monsters when looting.' },
    bundle: { name: 'Farmer’s Bundle', slots: 1, items: ['10× Great Bases', '10× Great Spices', '5× Great Sauces', '1× Foraging Knife', '1× Cooking Pot', '1× Spiriseed', '1× Traveler’s Pot', '1× Small Tent', '50 ft of Rope'] },
    talents: { Survival: 2, Wisdom: 1, Endurance: 1 },
    challenges: { Foraging: 3, Cooking: 1 },
  },
  {
    name: 'Laborer', rank: 1,
    skill: { name: 'Tireless', text: 'Your Vault’s limit increases to 50 Slots. You ignore the effects of the first two levels of Exhaustion. Whenever you roll to save against the Stunned or Exhausted condition, roll an additional d6. You perform Camp Tasks at half speed.' },
    bundle: { name: 'Laborer’s Bundle', slots: 1, items: ['5× Good Bases', '5× Good Protein', '5× Good Sauces', '1× Small Tent', '1× Crowbar', '50 ft of Rope'] },
    talents: { Endurance: 3, Strength: 2 },
    challenges: { note: 'Pick any 2 Challenges to gain 1 level in.' },
  },
  {
    name: 'Cook', rank: 1,
    skill: { name: 'Gourmand', text: 'When you perform the Cooking Challenge, your food result can never be lower than Edible. Roll an additional d6 during the final cooking phase. You can tell when a food item has been poisoned with a Wisdom or Smell roll of 9 or higher.' },
    bundle: { name: 'Cook’s Bundle', slots: 1, items: ['10× Gourmet Bases', '10× Great Proteins', '10× Gourmet Spices', '10× Great Sauces', '1× Small Tent', '1× Cooking Pot'] },
    talents: { Wisdom: 2, Finesse: 1, Intimacy: 1 },
    challenges: { Cooking: 3, Foraging: 1 },
  },
  {
    name: 'Carpenter', rank: 1,
    skill: { name: 'Wood Worker', text: 'Any roll made to interact with wood gains an additional 2d6. Attacks against wooden structures deal an additional 10 damage.' },
    bundle: { name: 'Carpenter’s Bundle', slots: 1, items: ['1× Hammer', '10× Wooden Boards', '1× Bag of Nails (100)', '1× Small Tent', '3× Good Bases', '3× Good Protein', '3× Good Spices'] },
    talents: { Finesse: 2, Strength: 1, Wisdom: 1 },
    challenges: { Scavenging: 1 },
  },
  {
    name: 'Hunter', rank: 1,
    skill: { name: 'Stalker', text: 'You gain a +2 to all Stealth rolls made within the Wilds and an additional d6 during each phase of the Hunting Challenge.' },
    bundle: { name: 'Hunter’s Bundle', slots: 1, items: ['1× Hunting Bow', '1× Foraging Knife', '10× Great Protein', '5× Good Spices', '5× Good Sauces'] },
    talents: { Survival: 2, Nimbleness: 1, Finesse: 1 },
    challenges: { Hunting: 3, Scavenging: 1 },
  },
  {
    name: 'Blacksmith', rank: 1,
    skill: { name: 'Forgeman', text: 'You gain a bonus d6 to all rolls made to work with metal, and you can tap a weapon of any kind — material or soul — to grant it +1 Base Damage or +1 Attack roll for 1 hour. Once per Rest.' },
    bundle: { name: 'Blacksmith Bundle', slots: 1, items: ['1× Smithing Hammer', 'Metal Scraps (10 steel, 10 iron)', '1× Small Tent', '1× Common Tool (your choice, must contain metal)'] },
    talents: { Strength: 2, Wisdom: 1, Endurance: 1 },
    challenges: {},
  },
  {
    name: 'Mason', rank: 1,
    skill: { name: 'Stone Worker', text: 'Gain a bonus d6 to any roll involving stone or minerals, and you can always spot a Construct’s Synthcore without needing to roll.' },
    bundle: { name: 'Mason Bundle', slots: 1, items: ['1× Chisel'] },
    talents: { Strength: 2, Wisdom: 1, Endurance: 1 },
    challenges: {},
  },
  {
    name: 'Scoundrel', rank: 1, wip: true,
    skill: { name: 'Ragamuffin', text: 'Design in progress — the full effect hasn’t been written yet.' },
    bundle: null,
    talents: {},
    challenges: {},
  },

  // ── ★★ Origins | 10 Origin Points ──
  {
    name: 'Alchemist', rank: 2,
    skill: { name: 'Brewer', text: 'Gain 1 extra base die for the Alchemy Challenge and your maximum Elixir Sickness is 7. You start with Alchemist’s Supplies (lets you perform the Elixir Brewing Challenge without a facility) and 5 Elixirs of a set rating. Elixir essence costs are reduced by 2.' },
    bundle: null, talents: {}, challenges: {},
  },
  { name: 'Healer',    rank: 2, wip: true },
  { name: 'Speaker',   rank: 2, wip: true },
  { name: 'Outlander', rank: 2, wip: true },
  { name: 'Nomad',     rank: 2, wip: true },
  { name: 'Gleeman',   rank: 2, wip: true },
  { name: 'Runner',    rank: 2, wip: true },

  // ── ★★★ Origins | 5 Origin Points ──
  {
    name: 'Ranger', rank: 3,
    skill: { name: 'The Wylder', text: 'Rangers start with a unique enchanted multi-tool, the Wylder, which has several forms — each offering its own special effects.' },
    effects: [
      'Increase every Physical and Mental Talent by 1.',
      'Gain 7 Mastery Points.',
      'Choose two Talents to Limit Break — they may be raised past 5, but not past 7.',
    ],
  },
  {
    name: 'Academy Graduate', rank: 3,
    effects: [
      'Start with 2 additional Experience Points.',
      'Gain 1 Uncommon or 2 Common Equipment from the Academy Graduate List.',
      'Gain additional Design Points for your Soul Armament.',
    ],
  },
  {
    name: 'Exorcist', rank: 3,
    effects: [
      'Bear Warden Rites: you lose your own Arcane Sensing and instead sense through your Rites (Arcane Sense counts as 6).',
      'Infused with a Warden Spirit: see into the Spirit Realm, see in the dark, and see invisible creatures.',
      'Cannot be affected by spells that would affect the mind.',
      'Gain 2 Common Equipment.',
    ],
  },
  {
    name: 'Seeker', rank: 3,
    effects: [
      '+1 bonus to any combat roll made against Folk.',
      'Increase each Social Talent by 1.',
      'Limit Break 1 Talent — it may be raised past 5, but not past 7.',
      'Gain 1 Uncommon Equipment.',
    ],
  },
  {
    name: 'Wizard', rank: 3,
    effects: [
      'Start with a conduit (Spell Ring, Wand, or Staff) and a Spellbook holding three spells of casting cost 2 Essence or lower.',
      'Gain 3 empty Spell Crystals.',
    ],
  },
];

/** Look up a Life Origin's data by display name. */
export function getLifeOrigin(name) {
  return LIFE_ORIGIN_DATA.find(o => o.name === name) ?? null;
}

const starStr = (rank) => '★'.repeat(Math.max(0, rank | 0));

/** Build the rich description HTML shown on a Life Origin card + reveal. */
function lifeOriginDescription(o) {
  const pts = ORIGIN_POINTS_BY_RANK[o.rank] ?? 0;
  let h = `<p class="sty-cc-lo-meta"><span class="sty-cc-lo-stars">${starStr(o.rank)}</span> Life Origin · <strong>${pts} Origin Points</strong></p>`;

  const nameOnly = o.wip && !o.skill && !o.effects;
  if (nameOnly) {
    h += `<p><em>This origin’s write-up is still in progress. Choosing it records your pick so the flow can continue; its bonuses apply once the details are added.</em></p>`;
    return h;
  }

  if (o.skill) h += `<p><strong>Unique Skill — ${o.skill.name}:</strong> ${o.skill.text}</p>`;

  if (Array.isArray(o.effects) && o.effects.length) {
    h += `<p><strong>Starting Effects:</strong></p><ul>${o.effects.map(e => `<li>${e}</li>`).join('')}</ul>`;
  }

  if (o.bundle) {
    const slot = o.bundle.slots ? ` | ${o.bundle.slots} Slot` : '';
    h += `<p><strong>${o.bundle.name}${slot}:</strong> ${o.bundle.items.join(', ')}.</p>`;
  }

  const tal = o.talents ? Object.entries(o.talents).map(([k, v]) => `${k} +${v}`).join(', ') : '';
  if (tal) h += `<p><strong>Talents:</strong> ${tal}</p>`;

  if (o.challenges) {
    if (o.challenges.note) {
      h += `<p><strong>Challenges:</strong> ${o.challenges.note}</p>`;
    } else {
      const ch = Object.entries(o.challenges).map(([k, v]) => `${k} ${v}`).join(', ');
      if (ch) h += `<p><strong>Challenges:</strong> ${ch}</p>`;
    }
  }

  if (o.wip) h += `<p><em>Note: some mechanics for this origin are still being finalized.</em></p>`;
  return h;
}

/** Cards for the Life Origin step, sorted by rank then name. */
function buildLifeOriginCards() {
  const cards = LIFE_ORIGIN_DATA.map(o => {
    const slug = loSlug(o.name);
    return {
      id: `life-origin:${slug}`,
      uuid: '',
      name: o.name,
      // Placeholder item art sits centered on the card's dark backing
      // (contain, not full-bleed), reading like an item in a slot.
      img: o.img || `${LIFE_ORIGIN_ART_DIR}/${slug}.png`,
      tagline: `${starStr(o.rank)} · ${ORIGIN_POINTS_BY_RANK[o.rank] ?? 0} OP`,
      description: lifeOriginDescription(o),
      contain: true,
      fit: 'contain',
      rank: o.rank,
      points: ORIGIN_POINTS_BY_RANK[o.rank] ?? 0,
    };
  });
  cards.sort((a, b) => (a.rank - b.rank) || a.name.localeCompare(b.name));
  return cards;
}

/* -------------------------------------------- */
/*  Stryder Origin (step 3) — point-buy shop     */
/* -------------------------------------------- */

/**
 * The Stryder Origin "shop" (Stryder Design Doc). You spend the Origin Points
 * your Life Origin granted. Costs are per-category. `max` caps the total
 * quantity bought across a whole category (Pet is max 1). Items flagged
 * `wip` are placeholders whose contents aren't written yet.
 */
const STRYDER_ORIGIN_CATEGORIES = [
  {
    id: 'bundles', name: 'Bundles', cost: 3,
    blurb: 'Kits of gear every Stryder needs on the road.',
    items: [
      { id: 'exploration-a', name: 'Exploration Bundle A', desc: 'Cooking Utensils, 10× Great Bases, 10× Great Proteins, 30 ft of Rope, 1 Small Tent, and more.' },
      { id: 'exploration-b', name: 'Exploration Bundle B', desc: 'Contents still being written.', wip: true },
      { id: 'exploration-c', name: 'Exploration Bundle C', desc: 'Contents still being written.', wip: true },
    ],
  },
  {
    id: 'pet', name: 'Pet', cost: 5, max: 1,
    blurb: 'A companion that starts the journey at your side — Trust begins at Friend. Choose one.',
    items: [
      { id: 'pet-dog', name: 'Dog', desc: 'A loyal hound, ever at your heel.' },
      { id: 'pet-cat', name: 'Cat', desc: 'Aloof, clever, and quietly devoted.' },
      { id: 'pet-other', name: 'Other Companion', desc: 'More companions coming.', wip: true },
    ],
  },
  {
    id: 'common-equipment', name: 'Common Equipment', cost: 6,
    blurb: 'Common-ranked enchanted gear.',
    items: [
      { id: 'common-equipment-pick', name: 'Common Enchanted Item', desc: 'A Common-ranked enchanted item of your choice. The catalog is still being written — buy as many as you can afford.', wip: true },
    ],
  },
  {
    id: 'survival', name: 'Survival Items', cost: 2,
    blurb: 'Everyday gear for life out in the Wilds.',
    items: [
      { id: 'foraging-knife', name: 'Foraging Knife', desc: 'A small knife tied to a pouch by a flexible string. +2 to Foraging Rolls.' },
      { id: 'travelers-pot', name: 'Traveler’s Pot', desc: 'A hand-sized pot filled with Spirit-blessed dirt — plant a Spiriseed and it will grow.' },
      { id: 'cooking-pot', name: 'Cooking Pot', desc: 'Tools for cutting, crushing, and stirring attached to the side. Required to cook while camping.' },
      { id: 'hunting-bow', name: 'Hunting Bow', desc: 'A minorly enchanted bow that forms a weak arrow from the air. Used for the Hunting Challenge.' },
    ],
  },
  {
    id: 'tents', name: 'Tents',
    blurb: 'A proper tent staves off a Poor Night’s Sleep — the finer the tent, the better the rest.',
    items: [
      { id: 'tent-small', name: 'Small Tent', cost: 1, desc: 'A basic one-person shelter.' },
      { id: 'tent-medium', name: 'Medium Tent', cost: 2, desc: 'Room for a couple of travelers.' },
      { id: 'tent-large', name: 'Large Tent', cost: 3, desc: 'Comfortable shelter for the whole party.' },
      { id: 'tent-enchanted', name: 'Enchanted Tent', cost: 4, desc: 'Warded canvas that shrugs off the weather.', wip: true },
      { id: 'tent-luxury', name: 'Luxury Enchanted Tent', cost: 5, desc: 'The finest rest coin can buy.', wip: true },
    ],
  },
  {
    id: 'consumables', name: 'Consumables', cost: 1,
    blurb: 'Handy expendables for the road.',
    items: [
      { id: 'spiriseed', name: 'Spiriseed', desc: 'Planted in blessed soil and tended by someone with 2+ Survival, it yields a Base of its quality every 24 hours.' },
      { id: 'wooden-boards', name: 'Wooden Boards (×5)', desc: 'Sturdy 3ft planks, Object Class 3 — good for a hundred jobs.' },
    ],
  },
  {
    id: 'tools', name: 'Tools', cost: 1,
    blurb: 'Common implements — and a few special ones.',
    items: [
      { id: 'hammer', name: 'Hammer', desc: '+3 to any roll to build something from wood.' },
      { id: 'crowbar', name: 'Crowbar', desc: '+3 to force something open or move something heavy.' },
      { id: 'smithing-hammer', name: 'Smithing Hammer', cost: 2, desc: 'Enchanted hammer that briefly superheats metal for smithing on the go. Without Forgeman (or 5 Strength & 5 Finesse) it deals 5 damage to use.' },
    ],
  },
];

/** Build the point-buy shop context (budget from the chosen Life Origin). */
function buildStryderOriginShop(state) {
  const budget = Number(state.choices?.['life-origin']?.points ?? 20);
  const saved = state.choices?.['stryder-origin']?.picks ?? {};
  let spent = 0;
  const categories = STRYDER_ORIGIN_CATEGORIES.map(cat => {
    const items = cat.items.map(it => {
      const cost = Number(it.cost ?? cat.cost ?? 0);
      const qty = Math.max(0, Number(saved[it.id] ?? 0));
      spent += qty * cost;
      return {
        id: it.id, name: it.name, desc: it.desc, wip: !!it.wip,
        cost, catId: cat.id, catMax: cat.max ?? 0, qty,
      };
    });
    // Uniform-cost category → "N OP each"; mixed → "min–max OP".
    const costs = items.map(i => i.cost);
    const min = Math.min(...costs), max = Math.max(...costs);
    const costLabel = min === max ? `${min} OP each` : `${min}–${max} OP`;
    return { id: cat.id, name: cat.name, max: cat.max ?? 0, blurb: cat.blurb, costLabel, items };
  });
  const remaining = budget - spent;
  const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  return { budget, spent, remaining, pct, categories };
}

/* -------------------------------------------- */
/*  Soul Armament / Alter Path (step 4) — fork   */
/* -------------------------------------------- */

const CREATION_ART_DIR = 'systems/stryder/assets/creation';

/**
 * The dramatic fork: forge a Soul Armament (the warm, recommended path) OR
 * turn away from the forge and walk an Alter Path (darker, edgier). Two big
 * variant cards in the carousel — `variant` drives their aura + framing.
 */
function buildArmamentCards() {
  return [
    {
      id: 'soul-armament',
      uuid: '',
      name: 'Soul Armament',
      img: `${CREATION_ART_DIR}/spirit-blacksmith.png`,
      tagline: 'Wield the power of your Soul!',
      description:
        `<p class="sty-cc-arm-lead">Every Stryder channels their soul into a weapon of their own making.</p>` +
        `<p>Choose a <strong>Form</strong> and a <strong>Reach</strong>, then spend <strong>Design Points</strong> on Effects and an Affinity until the armament is unmistakably <em>yours</em> — modular in the making, yet wholly personal in the end.</p>` +
        `<p class="sty-cc-arm-note">The path most Stryders walk.</p>`,
      contain: false,
      fit: 'cover',
      variant: 'armament',
    },
    {
      id: 'alter-path',
      uuid: '',
      name: 'Alter Path',
      img: `${CREATION_ART_DIR}/spirit-sword.png`,
      tagline: 'a road less traveled on…',
      description:
        `<p class="sty-cc-arm-lead">Some souls refuse the forge.</p>` +
        `<p>Cast aside a Soul Armament entirely and walk an <strong>Alter Path</strong> — a fundamentally different way to fight, and a fundamentally different way to <em>be</em>.</p>` +
        `<ul class="sty-cc-arm-paths"><li>Inverted Essence</li><li>Shaman</li><li>Summoner</li></ul>` +
        `<p class="sty-cc-arm-warn">Not for first-time Stryders. The Path reshapes your whole sheet — and there is no easy way back.</p>`,
      contain: true,
      fit: 'contain',
      variant: 'alter',
    },
  ];
}

/* -------------------------------------------- */
/*  Soul Armament DESIGNER (the forge)          */
/* -------------------------------------------- */

const THREE_DIR = 'systems/stryder/lib/three';
const FORGE_MODEL = 'systems/stryder/assets/creation/soul-armament-sword.glb';
const FORGE_GUN_MODEL = 'systems/stryder/assets/creation/soul-armament-gun.glb';

/** Starting Design Point pool (placeholder; Academy Graduate grants more). */
const SA_DESIGN_POINTS = 6;

const SA_FORMS = [
  { id: 'one-handed',   name: 'One Handed',          desc: 'No cost to summon or store.' },
  { id: 'two-handed',   name: 'Two Handed',          desc: 'Costs an item interaction to summon or store.' },
  { id: 'hybrid',       name: 'Hybrid',              desc: 'Special Reload — Range 1 and Range 4; Range 4 consumes Ammo.' },
  { id: 'attached',     name: 'Attached',            desc: 'Costs an item interaction to summon or store.' },
  { id: 'floating-1h',  name: 'Floating, One Handed', desc: '1 Stamina to summon and maintain.' },
  { id: 'floating-2h',  name: 'Floating, Two Handed', desc: '2 Stamina to summon and store.' },
  { id: 'transforming', name: 'Transforming',        desc: 'Choose two Forms and shift between them.' },
];

const SA_REACHES = [
  { id: 'r1',     name: 'Reach 1' },
  { id: 'r2',     name: 'Reach 2' },
  { id: 'r4',     name: 'Reach 4' },
  { id: 'r8',     name: 'Reach 8' },
  { id: 'switch', name: 'Range Switch' },
];

const SA_EFFECTS = [
  { id: 'enhance', name: 'Enhance Armament', cost: 2, desc: 'Pass your free hand over the weapon for an affinity-based bonus effect.' },
  { id: 'twin',    name: 'Summon Small Arm', cost: 2, desc: 'Create an off-hand twin of your weapon — gain the Twin Attack effect.' },
  { id: 'shield',  name: 'Summon Shield',    cost: 2, desc: 'Create an off-hand shield: gain the Block action and negate X damage.' },
  { id: 'warp',    name: 'Warp Point',       cost: 3, desc: 'Spend 1 Mana; weapons become spatially empowered — teleport to them.' },
];

const SA_AFFINITIES = [
  { id: 'flicker-edge', name: 'Flicker Edge', desc: 'Spend 1 Mana; when you Attack, roll a d6 — on a 5–6 the attack gains the Sunder tag.' },
  { id: 'affinity-more', name: 'More Affinities', desc: 'The affinity list is still being written.', wip: true },
];

/** Build the designer render context (revolving sword + current picks). */
function buildDesignerContext(state) {
  const saved = state.choices?.armament?.design ?? {};
  const selForm = saved.form || '';
  const selReach = saved.reach || '';
  const selAff = saved.affinity || '';
  const selEffects = new Set(saved.effects || []);

  const forms = SA_FORMS.map(f => ({ ...f, sel: f.id === selForm }));
  const reaches = SA_REACHES.map(r => ({ ...r, sel: r.id === selReach }));
  const affinities = SA_AFFINITIES.map(a => ({ ...a, sel: a.id === selAff }));

  let spent = 0;
  const effects = SA_EFFECTS.map(e => {
    const sel = selEffects.has(e.id);
    if (sel) spent += e.cost;
    return { ...e, sel };
  });

  return {
    model: FORGE_MODEL,
    threeDir: THREE_DIR,
    dp: SA_DESIGN_POINTS,
    spent,
    remaining: SA_DESIGN_POINTS - spent,
    forms, reaches, effects, affinities,
  };
}

/* -------------------------------------------- */
/*  Point allocators (Stats / Experience / Mastery) */
/* -------------------------------------------- */

const titleCase = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

/** The 4 combat Stats + the Stat Perks they unlock (rulebook v3.5). */
const COMBAT_STATS = [
  { id: 'soul', name: 'Soul', desc: 'The strength of your Soul Armament — your attacks and Skills scale off Soul.', perks: [] },
  { id: 'reflex', name: 'Reflex', desc: 'Combat reflexes and evasiveness — Dodge and Evade scale off Reflex.', perks: [
    { at: 1, text: '+1 Nimbleness and Finesse' }, { at: 3, text: 'Learn Second Chance' }, { at: 5, text: 'All [Reflex] abilities gain +1' },
  ] },
  { id: 'grit', name: 'Grit', desc: 'Physical prowess and endurance — Physical Resistance and Potency scale off Grit.', perks: [
    { at: 1, text: 'Bonus Health equal to Grit at levels 1, 5, 10, 15' }, { at: 3, text: 'Ignore the first Debilitating Condition each day' }, { at: 5, text: 'Learn Resilience' },
  ] },
  { id: 'will', name: 'Will', desc: 'Focus and Magykal control — Magykal Resistance and Potency scale off Will.', perks: [
    { at: 1, text: 'Win ties on Talent Checks' }, { at: 3, text: 'Ignore the first Exhausted/Haggard point each day' }, { at: 5, text: 'Learn Resolute Focus' },
  ] },
];

const TALENT_KEYS = ['strength', 'nimbleness', 'finesse', 'endurance', 'survival', 'wit', 'wisdom', 'diplomacy', 'charm', 'intimacy', 'deceit', 'aggression'];
const SENSE_KEYS = ['sight', 'hearing', 'smell', 'touch', 'arcane'];

const MASTERY_SKILLS = [
  { id: 'alchemy-1', name: 'Alchemy I', cost: 1, desc: 'Begin brewing elixirs.' },
  { id: 'cartography', name: 'Cartography', cost: 1, desc: 'Chart the wilds as you explore them.' },
  { id: 'inspirational', name: 'Inspirational', cost: 1, desc: 'Lift your party with a rousing word.' },
  { id: 'monster-cooking', name: 'Monster Cooking', cost: 1, desc: 'Cook with Monster Parts.' },
  { id: 'scout-ahead', name: 'Scout Ahead', cost: 2, desc: 'Perform the Scout Ahead party action.' },
  { id: 'team-training', name: 'Team Training', cost: 2, desc: 'Train together for shared gains.' },
  { id: 'specialization', name: 'Specialization', cost: 3, desc: 'Specialize a Talent for quick, roll-free shortcuts.' },
];

/** Per-step allocator specs. NOTE: XP/Mastery pools are POC placeholders. */
const ALLOT_SPECS = {
  stats: () => ({
    pool: 9, meterLabel: 'Stat Points', placeholder: false,
    hint: 'Distribute 9 points across your Stats — up to 5 each. Perks unlock as you invest.',
    groups: [{ title: 'Combat Stats', items: COMBAT_STATS.map(s => ({ id: s.id, name: s.name, desc: s.desc, cost: 1, max: 5, perks: s.perks })) }],
  }),
  xp: () => ({
    pool: 5, meterLabel: 'Experience', placeholder: true,
    hint: 'Hone your Talents and Senses. (Starting Experience is a placeholder for now.)',
    groups: [
      { title: 'Talents', items: TALENT_KEYS.map(k => ({ id: 'talent.' + k, name: titleCase(k), cost: 1, max: 5 })) },
      { title: 'Senses', items: SENSE_KEYS.map(k => ({ id: 'sense.' + k, name: titleCase(k), cost: 1, max: 5 })) },
    ],
  }),
  mastery: () => ({
    pool: 3, meterLabel: 'Mastery', placeholder: true,
    hint: 'Spend Mastery Points on Adventure Skills. (Starting Mastery is a placeholder for now.)',
    groups: [{ title: 'Adventure Skills', items: MASTERY_SKILLS.map(s => ({ id: s.id, name: s.name, desc: s.desc, cost: s.cost, max: 1 })) }],
  }),
};

/** Build the render context for a pool-allocation step. */
function buildAllot(state, stepId) {
  const spec = ALLOT_SPECS[stepId] && ALLOT_SPECS[stepId]();
  if (!spec) return null;
  const saved = state.choices?.[stepId]?.alloc ?? {};
  let spent = 0;
  const groups = spec.groups.map(g => ({
    title: g.title,
    items: g.items.map(it => {
      const value = Math.max(0, Math.min(it.max, Number(saved[it.id] ?? 0)));
      spent += value * it.cost;
      const perks = (it.perks || []).map(p => ({ at: p.at, text: p.text, unlocked: value >= p.at }));
      return { id: it.id, name: it.name, desc: it.desc || '', cost: it.cost, max: it.max, value, perks, hasPerks: perks.length > 0 };
    }),
  }));
  const pct = spec.pool ? Math.min(100, Math.round((spent / spec.pool) * 100)) : 0;
  return {
    stepId, pool: spec.pool, spent, remaining: spec.pool - spent, pct,
    meterLabel: spec.meterLabel, hint: spec.hint, placeholder: !!spec.placeholder, groups,
  };
}

/**
 * Build the render context for the current creation step.
 * Receives the sheet so folk cards can be enriched with their allocator spec.
 */
export async function getCreationContext(sheet) {
  const actor = sheet.actor;
  const state = getCreationState(actor);
  const stepIndex = Math.max(0, Math.min(state.stepIndex ?? 0, CREATION_STEPS.length - 1));
  const step = CREATION_STEPS[stepIndex];

  let cards = [];
  let mode = 'select';
  if (step.id === 'folk') {
    cards = await getFolkCards();
    if (!cards.length) { mode = 'wip'; cards = wipCards(step); }
  } else if (step.id === 'life-origin') {
    cards = buildLifeOriginCards();
    if (!cards.length) { mode = 'wip'; cards = wipCards(step); }
  } else if (step.id === 'stryder-origin') {
    mode = 'shop';
    cards = [];
  } else if (step.id === 'armament') {
    if (state.choices?.armament?.designing) { mode = 'designer'; cards = []; }
    else cards = buildArmamentCards();
  } else if (step.id === 'stats' || step.id === 'xp' || step.id === 'mastery') {
    mode = 'allot'; cards = [];
  } else {
    mode = 'wip';
    cards = wipCards(step);
  }

  // Enrich folk cards with allocator specs + flags.
  for (const c of cards) {
    let alloc = [];
    let needsChoices = false;
    if (step.id === 'folk' && c.id !== 'wip' && typeof sheet._folkChoiceInfo === 'function') {
      const info = sheet._folkChoiceInfo(c.name);
      needsChoices = info.needsChoices;
      alloc = (info.needsChoices && info.key && typeof sheet._folkAllocatorSpec === 'function')
        ? sheet._folkAllocatorSpec(info.key) : [];
    }
    c.needsChoices = needsChoices;
    c.hasAllocator = alloc.length > 0;
    c.pending = needsChoices && alloc.length === 0; // e.g. Oumen (allocator TBD)
    c.allocJson = JSON.stringify(alloc);
  }

  // Life Origin browses as tier bands (★ / ★★ / ★★★) instead of one flat
  // carousel. Group the already-enriched card objects by rank.
  let groups = null;
  if (step.id === 'life-origin' && mode !== 'wip') {
    const byRank = new Map();
    for (const c of cards) {
      const r = c.rank ?? 0;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r).push(c);
    }
    groups = [...byRank.keys()].sort((a, b) => a - b).map(rank => ({
      rank,
      stars: '★'.repeat(Math.max(1, rank)),
      op: ORIGIN_POINTS_BY_RANK[rank] ?? 0,
      cards: byRank.get(rank),
    }));
  }

  const shop = step.id === 'stryder-origin' ? buildStryderOriginShop(state) : null;
  const designer = mode === 'designer' ? buildDesignerContext(state) : null;
  const allot = mode === 'allot' ? buildAllot(state, step.id) : null;

  const isLast = stepIndex === CREATION_STEPS.length - 1;
  const chooseLabel = isLast
    ? 'Confirm & Finish'
    : step.id === 'stryder-origin'
      ? 'Confirm Loadout'
      : mode === 'allot'
        ? 'Confirm'
        : (mode === 'wip' ? 'Continue' : `Choose this ${step.noun}`);

  return {
    stepIndex,
    stepNumber: stepIndex + 1,
    totalSteps: CREATION_STEPS.length,
    step,
    mode,
    cards,
    groups,
    shop,
    designer,
    allot,
    chooseLabel,
    chosenId: state.choices?.[step.id]?.id ?? '',
    isFirst: stepIndex === 0,
    isLast,
    steps: CREATION_STEPS.map((s, i) => ({
      id: s.id, title: s.title, num: i + 1,
      current: i === stepIndex, done: i < stepIndex,
    })),
  };
}

/* -------------------------------------------- */
/*  Math (ported from the holographic card pen)  */
/* -------------------------------------------- */

const round  = (v, p = 3) => parseFloat(v.toFixed(p));
const clamp  = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const adjust = (v, fromMin, fromMax, toMin, toMax) =>
  round(toMin + ((toMax - toMin) * (v - fromMin)) / (fromMax - fromMin));

function attachHolo(card) {
  const wrap = card.closest('.sty-cc-holo');
  if (!wrap) return;
  const onMove = (e) => {
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = clamp((100 / rect.width) * (e.clientX - rect.left), 0, 100);
    const py = clamp((100 / rect.height) * (e.clientY - rect.top), 0, 100);
    const cx = px - 50;
    const cy = py - 50;
    const s = wrap.style;
    s.setProperty('--pointer-x', `${px}%`);
    s.setProperty('--pointer-y', `${py}%`);
    s.setProperty('--background-x', `${adjust(px, 0, 100, 35, 65)}%`);
    s.setProperty('--background-y', `${adjust(py, 0, 100, 35, 65)}%`);
    s.setProperty('--pointer-from-center', `${clamp(Math.hypot(py - 50, px - 50) / 50, 0, 1)}`);
    s.setProperty('--pointer-from-top', `${py / 100}`);
    s.setProperty('--pointer-from-left', `${px / 100}`);
    s.setProperty('--rotate-x', `${round(-(cx / 5))}deg`);
    s.setProperty('--rotate-y', `${round(cy / 4)}deg`);
    wrap.classList.add('is-holo');
    card.classList.add('active');
  };
  const onLeave = () => {
    card.classList.remove('active');
    wrap.classList.remove('is-holo');
    const s = wrap.style;
    s.setProperty('--pointer-from-center', '0');
    s.setProperty('--rotate-x', '0deg');
    s.setProperty('--rotate-y', '0deg');
    s.setProperty('--pointer-x', '50%');
    s.setProperty('--pointer-y', '50%');
    s.setProperty('--background-x', '50%');
    s.setProperty('--background-y', '50%');
  };
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerleave', onLeave);
}

/* -------------------------------------------- */
/*  Allocator (choice-folk inline choices)      */
/* -------------------------------------------- */

/** Render the allocator controls for a spec into a container. */
function buildAllocator(container, spec) {
  container.innerHTML = '';
  for (const ctrl of spec) {
    const block = document.createElement('div');
    block.className = 'sty-cc-alloc-block';
    block.dataset.kind = ctrl.kind;
    block.dataset.key = ctrl.key;
    if (ctrl.pool != null) block.dataset.pool = String(ctrl.pool);
    if (ctrl.cap != null) block.dataset.cap = String(ctrl.cap);
    if (ctrl.max != null) block.dataset.max = String(ctrl.max);
    if (ctrl.format) block.dataset.format = ctrl.format;

    const head = document.createElement('div');
    head.className = 'sty-cc-alloc-label';
    head.textContent = `${ctrl.label} `;
    if (ctrl.kind === 'pool' || ctrl.kind === 'multi') {
      const rem = document.createElement('span');
      rem.className = 'sty-cc-alloc-remain';
      head.appendChild(rem);
    }
    block.appendChild(head);

    if (ctrl.kind === 'pick') {
      const hasDesc = ctrl.options.some(o => o.desc);
      const row = document.createElement('div');
      row.className = hasDesc ? 'sty-cc-alloc-opts is-stacked' : 'sty-cc-alloc-opts';
      for (const o of ctrl.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sty-cc-alloc-pick';
        b.dataset.value = o.value;
        if (o.desc) {
          b.innerHTML = `<span class="sty-cc-pick-name">${o.label}</span><span class="sty-cc-pick-desc">${o.desc}</span>`;
        } else {
          b.textContent = o.label;
        }
        row.appendChild(b);
      }
      block.appendChild(row);
    } else if (ctrl.kind === 'pool') {
      const list = document.createElement('div');
      list.className = 'sty-cc-alloc-steppers';
      for (const o of ctrl.options) {
        const st = document.createElement('div');
        st.className = 'sty-cc-alloc-stepper';
        st.dataset.value = o.value;
        st.innerHTML =
          `<button type="button" class="sty-cc-step" data-d="-1">&minus;</button>` +
          `<span class="sty-cc-step-n">0</span>` +
          `<button type="button" class="sty-cc-step" data-d="1">+</button>` +
          `<label>${o.label}</label>`;
        list.appendChild(st);
      }
      block.appendChild(list);
    } else if (ctrl.kind === 'multi') {
      const grid = document.createElement('div');
      grid.className = 'sty-cc-alloc-grid';
      for (const o of ctrl.options) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sty-cc-alloc-chip';
        chip.dataset.value = o.value;
        chip.innerHTML =
          `<span class="sty-cc-chip-name">${o.label}</span>` +
          (o.desc ? `<span class="sty-cc-chip-desc">${o.desc}</span>` : '');
        grid.appendChild(chip);
      }
      block.appendChild(grid);
    }
    container.appendChild(block);
  }
}

/** Update counters + disabled states across an allocator; returns validity. */
function refreshAllocator(root) {
  const box = root.querySelector('.sty-cc-reveal-alloc');
  const chooseBtn = root.querySelector('[data-action="choose"]');
  const hasAlloc = root.dataset.pendingHasAlloc === '1';
  if (!box || !hasAlloc) { if (chooseBtn) chooseBtn.disabled = false; return true; }

  let allValid = true;
  box.querySelectorAll('.sty-cc-alloc-block').forEach(block => {
    const kind = block.dataset.kind;
    if (kind === 'pick') {
      if (!block.querySelector('.sty-cc-alloc-pick.is-sel')) allValid = false;
    } else if (kind === 'pool') {
      const pool = Number(block.dataset.pool);
      const cap = Number(block.dataset.cap);
      let sum = 0;
      block.querySelectorAll('.sty-cc-step-n').forEach(n => sum += Number(n.textContent) || 0);
      const remaining = pool - sum;
      block.querySelectorAll('.sty-cc-alloc-stepper').forEach(st => {
        const n = Number(st.querySelector('.sty-cc-step-n').textContent) || 0;
        const minus = st.querySelector('[data-d="-1"]');
        const plus = st.querySelector('[data-d="1"]');
        if (minus) minus.disabled = n <= 0;
        if (plus) plus.disabled = remaining <= 0 || n >= cap;
      });
      const rem = block.querySelector('.sty-cc-alloc-remain');
      if (rem) rem.textContent = `${remaining} left`;
      if (remaining !== 0) allValid = false;
    } else if (kind === 'multi') {
      const max = Number(block.dataset.max);
      const sel = block.querySelectorAll('.sty-cc-alloc-chip.is-sel').length;
      const remaining = max - sel;
      block.querySelectorAll('.sty-cc-alloc-chip').forEach(chip => {
        if (!chip.classList.contains('is-sel')) chip.classList.toggle('is-disabled', remaining <= 0);
      });
      const rem = block.querySelector('.sty-cc-alloc-remain');
      if (rem) rem.textContent = `${remaining} left`;
      if (sel !== max) allValid = false;
    }
  });

  if (chooseBtn) chooseBtn.disabled = !allValid;
  return allValid;
}

/** Read an allocator's controls into a `choices` object for _applyFolkChoices. */
function collectChoices(box) {
  const choices = {};
  box.querySelectorAll('.sty-cc-alloc-block').forEach(block => {
    const key = block.dataset.key;
    const kind = block.dataset.kind;
    if (kind === 'pick') {
      const sel = block.querySelector('.sty-cc-alloc-pick.is-sel');
      if (sel) choices[key] = sel.dataset.value;
    } else if (kind === 'pool') {
      if (block.dataset.format === 'array') {
        const arr = [];
        block.querySelectorAll('.sty-cc-alloc-stepper').forEach(st => {
          const n = Number(st.querySelector('.sty-cc-step-n').textContent) || 0;
          for (let i = 0; i < n; i++) arr.push(st.dataset.value);
        });
        choices[key] = arr;
      } else {
        const map = {};
        block.querySelectorAll('.sty-cc-alloc-stepper').forEach(st => {
          const n = Number(st.querySelector('.sty-cc-step-n').textContent) || 0;
          if (n > 0) map[st.dataset.value] = n;
        });
        choices[key] = map;
      }
    } else if (kind === 'multi') {
      choices[key] = [...block.querySelectorAll('.sty-cc-alloc-chip.is-sel')].map(c => c.dataset.value);
    }
  });
  return choices;
}

/* -------------------------------------------- */
/*  Interaction                                 */
/* -------------------------------------------- */

/** Populate the reveal view from a browse card and switch to it. */
function openReveal(root, wrap) {
  const d = wrap.dataset;
  const img   = root.querySelector('.sty-cc-reveal-img');
  const name  = root.querySelector('.sty-cc-reveal-name');
  const title = root.querySelector('.sty-cc-reveal-title');
  const desc  = root.querySelector('.sty-cc-reveal-desc');
  const descNode = wrap.querySelector('.sty-cc-carddesc');

  if (img)   { img.src = d.cardImg || ''; img.alt = d.cardName || ''; }
  if (name)  name.textContent = d.cardName || '';
  if (title) title.textContent = d.cardName || '';
  if (desc)  desc.innerHTML = descNode ? descNode.innerHTML : '';

  const revealArt = root.querySelector('.sty-cc-reveal-card .sty-cc-art');
  if (revealArt) revealArt.classList.toggle('is-contain', d.cardFit === 'contain');

  // Allocator (choice folk)
  let spec = [];
  const src = wrap.querySelector('.sty-cc-alloc-src');
  if (src) { try { spec = JSON.parse(src.textContent || '[]'); } catch (e) { spec = []; } }
  const allocBox = root.querySelector('.sty-cc-reveal-alloc');
  if (allocBox) {
    if (spec.length) {
      buildAllocator(allocBox, spec);
      allocBox.style.display = '';
    } else if (d.cardPending === '1') {
      allocBox.innerHTML = `<div class="sty-cc-alloc-note">This folk's allocator isn't built yet — choosing it records your pick; bonuses apply once it's added.</div>`;
      allocBox.style.display = '';
    } else {
      allocBox.innerHTML = '';
      allocBox.style.display = 'none';
    }
  }

  // Variant (Soul Armament vs Alter Path) colours the reveal card + title.
  const variant = d.cardVariant || '';
  root.dataset.revealVariant = variant;
  const revealCard = root.querySelector('.sty-cc-reveal-card');
  if (revealCard) {
    revealCard.classList.remove('is-armament', 'is-alter');
    if (variant) revealCard.classList.add(`is-${variant}`);
  }

  root.dataset.pendingId = d.cardId || '';
  root.dataset.pendingName = d.cardName || '';
  root.dataset.pendingImg = d.cardImg || '';
  root.dataset.pendingUuid = d.cardUuid || '';
  root.dataset.pendingHasAlloc = spec.length ? '1' : '';
  refreshAllocator(root);
  root.dataset.view = 'reveal';
}

/* -------------------------------------------- */
/*  Stryder Origin shop interaction             */
/* -------------------------------------------- */

/** Recompute spend/remaining, gate + buttons, and refresh the budget meter. */
function refreshShop(root) {
  const shop = root.querySelector('.sty-cc-shop');
  if (!shop) return;
  const budget = Number(shop.dataset.budget) || 0;
  const items = [...shop.querySelectorAll('.sty-cc-shop-item')];

  let spent = 0;
  const catCount = {};
  for (const it of items) {
    const q = Number(it.querySelector('.sty-cc-shop-qty')?.textContent) || 0;
    const cost = Number(it.dataset.cost) || 0;
    spent += q * cost;
    const cat = it.dataset.cat;
    catCount[cat] = (catCount[cat] || 0) + q;
  }
  const remaining = budget - spent;

  for (const it of items) {
    const q = Number(it.querySelector('.sty-cc-shop-qty')?.textContent) || 0;
    const cost = Number(it.dataset.cost) || 0;
    const cat = it.dataset.cat;
    const catMax = Number(it.dataset.catMax) || 0;
    const minus = it.querySelector('[data-d="-1"]');
    const plus = it.querySelector('[data-d="1"]');
    let canPlus = cost <= remaining;
    if (catMax > 0 && (catCount[cat] || 0) >= catMax) canPlus = false;
    if (minus) minus.disabled = q <= 0;
    if (plus) plus.disabled = !canPlus;
    it.classList.toggle('is-owned', q > 0);
  }

  const numEl = shop.querySelector('.sty-cc-budget-num');
  if (numEl) numEl.textContent = String(remaining);
  const spentEl = shop.querySelector('.sty-cc-budget-spent');
  if (spentEl) spentEl.textContent = String(spent);
  const fill = shop.querySelector('.sty-cc-budget-fill');
  if (fill) fill.style.width = `${budget ? Math.min(100, (spent / budget) * 100) : 0}%`;
}

/** Read the shop's chosen quantities into a picks map + total spend. */
function collectShop(root) {
  const picks = {};
  let spent = 0;
  root.querySelectorAll('.sty-cc-shop-item').forEach(it => {
    const q = Number(it.querySelector('.sty-cc-shop-qty')?.textContent) || 0;
    if (q > 0) {
      picks[it.dataset.itemId] = q;
      spent += q * (Number(it.dataset.cost) || 0);
    }
  });
  return { picks, spent };
}

/* -------------------------------------------- */
/*  Point-allocator interaction (stats/xp/mastery) */
/* -------------------------------------------- */

/** Recompute pool spend, gate steppers, light unlocked perks, refresh meter. */
function refreshAllot(root) {
  const box = root.querySelector('.sty-cc-allot');
  if (!box) return;
  const pool = Number(box.dataset.pool) || 0;
  const items = [...box.querySelectorAll('.sty-cc-allot-item')];
  let spent = 0;
  for (const it of items) spent += (Number(it.querySelector('.sty-cc-allot-val')?.textContent) || 0) * (Number(it.dataset.cost) || 1);
  const remaining = pool - spent;

  for (const it of items) {
    const v = Number(it.querySelector('.sty-cc-allot-val')?.textContent) || 0;
    const cost = Number(it.dataset.cost) || 1;
    const max = Number(it.dataset.max) || 99;
    const minus = it.querySelector('[data-d="-1"]');
    const plus = it.querySelector('[data-d="1"]');
    if (minus) minus.disabled = v <= 0;
    if (plus) plus.disabled = v >= max || cost > remaining;
    it.classList.toggle('is-active', v > 0);
    it.querySelectorAll('.sty-cc-allot-perk').forEach(pk => pk.classList.toggle('is-on', v >= (Number(pk.dataset.at) || 99)));
  }

  const numEl = box.querySelector('.sty-cc-allot-num');
  if (numEl) numEl.textContent = String(remaining);
  const spentEl = box.querySelector('.sty-cc-allot-spent');
  if (spentEl) spentEl.textContent = String(spent);
  const fill = box.querySelector('.sty-cc-allot-fill');
  if (fill) fill.style.width = `${pool ? Math.min(100, (spent / pool) * 100) : 0}%`;
}

/** Read the allocator's per-item values into an alloc map. */
function collectAllot(root) {
  const alloc = {};
  root.querySelectorAll('.sty-cc-allot-item').forEach(it => {
    const v = Number(it.querySelector('.sty-cc-allot-val')?.textContent) || 0;
    if (v > 0) alloc[it.dataset.itemId] = v;
  });
  return alloc;
}

/** Confirm the pending card as this step's choice and advance (or finish). */
async function onChoose(sheet, root) {
  const actor = sheet.actor;
  const state = getCreationState(actor);
  const stepIndex = Math.max(0, Math.min(state.stepIndex ?? 0, CREATION_STEPS.length - 1));
  const step = CREATION_STEPS[stepIndex];

  // ── Stryder Origin: collect the point-buy loadout (no card pick) ──
  if (step.id === 'stryder-origin') {
    const { picks, spent } = collectShop(root);
    const choices = foundry.utils.deepClone(state.choices ?? {});
    choices['stryder-origin'] = { id: 'stryder-origin', name: 'Loadout', picks, spent };
    const isLastShop = stepIndex >= CREATION_STEPS.length - 1;
    await actor.setFlag(FLAG_SCOPE, FLAG_KEY, {
      complete: isLastShop,
      stepIndex: isLastShop ? stepIndex : stepIndex + 1,
      choices,
    });
    ui.notifications?.info(`Loadout saved — ${spent} Origin Point${spent === 1 ? '' : 's'} spent.`);
    sheet.render(false);
    return;
  }

  // ── Stats / Experience / Mastery: record the allocation and advance ──
  if (step.id === 'stats' || step.id === 'xp' || step.id === 'mastery') {
    const alloc = collectAllot(root);
    const choices = foundry.utils.deepClone(state.choices ?? {});
    choices[step.id] = { id: step.id, name: step.title, alloc };
    const isLastAllot = stepIndex >= CREATION_STEPS.length - 1;
    await actor.setFlag(FLAG_SCOPE, FLAG_KEY, {
      complete: isLastAllot,
      stepIndex: isLastAllot ? stepIndex : stepIndex + 1,
      choices,
    });
    ui.notifications?.info(isLastAllot ? `${actor.name} — character creation complete!` : 'Saved.');
    sheet.render(false);
    return;
  }

  // ── Soul Armament / Alter Path fork ──
  if (step.id === 'armament') {
    const path = root.dataset.pendingId; // 'soul-armament' | 'alter-path'
    if (!path) { ui.notifications?.warn('Pick a path first.'); return; }
    const choices = foundry.utils.deepClone(state.choices ?? {});
    if (path === 'soul-armament') {
      // Enter the designer (stay on this step, re-render into the forge).
      choices.armament = { id: 'soul-armament', name: 'Soul Armament', path, designing: true, design: choices.armament?.design };
      await actor.setFlag(FLAG_SCOPE, FLAG_KEY, { ...state, stepIndex, choices, complete: false });
      sheet.render(false);
      return;
    }
    choices.armament = { id: 'alter-path', name: 'Alter Path', path };
    const lastA = stepIndex >= CREATION_STEPS.length - 1;
    await actor.setFlag(FLAG_SCOPE, FLAG_KEY, { complete: lastA, stepIndex: lastA ? stepIndex : stepIndex + 1, choices });
    sheet.render(false);
    return;
  }

  const id = root.dataset.pendingId;
  if (!id) { ui.notifications?.warn('Pick a card first.'); return; }

  const pendingName = root.dataset.pendingName;

  // ── Apply real effects for the Folk step ──
  if (step.id === 'folk' && id !== 'wip' && typeof sheet._applyCreationFolk === 'function') {
    let choices = null;
    if (root.dataset.pendingHasAlloc === '1') {
      if (!refreshAllocator(root)) { ui.notifications?.warn(`Finish allocating ${pendingName}'s choices first.`); return; }
      const box = root.querySelector('.sty-cc-reveal-alloc');
      choices = collectChoices(box);
    }
    try {
      const res = await sheet._applyCreationFolk(pendingName, choices);
      if (res.applied) {
        ui.notifications?.info(`${pendingName} applied${res.summary ? ` — ${res.summary}` : ''}.`);
      } else if (res.needsChoices) {
        ui.notifications?.warn(`${pendingName} recorded — its allocator is coming in a later pass.`);
      } else {
        ui.notifications?.warn(`No folk data found for ${pendingName} — pick recorded only.`);
      }
    } catch (err) {
      console.error('[Stryder Creation] Folk apply failed:', err);
      ui.notifications?.error(`Could not apply ${pendingName} — see console.`);
    }
  }

  const choices = foundry.utils.deepClone(state.choices ?? {});
  const choiceObj = {
    id,
    name: pendingName,
    img: root.dataset.pendingImg,
    uuid: root.dataset.pendingUuid || '',
  };

  // Life Origin: record the star rank + Origin Points so the Stryder Origin
  // step (point-buy) has a budget to spend.
  if (step.id === 'life-origin') {
    const lo = getLifeOrigin(pendingName);
    if (lo) {
      choiceObj.rank = lo.rank;
      choiceObj.points = ORIGIN_POINTS_BY_RANK[lo.rank] ?? 0;
    }
  }

  choices[step.id] = choiceObj;

  const isLast = stepIndex >= CREATION_STEPS.length - 1;
  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, {
    complete: isLast,
    stepIndex: isLast ? stepIndex : stepIndex + 1,
    choices,
  });

  if (isLast) ui.notifications?.info(`${actor.name} — character creation complete!`);
  sheet.render(false);
}

/**
 * Step the flow backward/forward. Navigating BACK onto a step undoes that
 * step's applied effects so it can be redone cleanly — folk is the only step
 * that applies effects so far, so returning to it strips its talents/senses.
 */
async function onNav(sheet, dir) {
  const actor = sheet.actor;
  const state = getCreationState(actor);
  const cur = state.stepIndex ?? 0;
  const next = Math.max(0, Math.min(cur + dir, CREATION_STEPS.length - 1));
  const choices = foundry.utils.deepClone(state.choices ?? {});

  if (dir < 0) {
    const folkIndex = CREATION_STEPS.findIndex(s => s.id === 'folk');
    if (next <= folkIndex && choices.folk && typeof sheet._clearCreationFolk === 'function') {
      await sheet._clearCreationFolk();
      delete choices.folk;
    }
  }

  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, { ...state, stepIndex: next, choices, complete: false });
  sheet.render(false);
}

/* -------------------------------------------- */
/*  Soul Armament designer interaction          */
/* -------------------------------------------- */

/** Recompute the Design-Point meter + gate effects that can't be afforded. */
function refreshForgeDP(root) {
  const box = root.querySelector('.sty-cc-forge-effects');
  if (!box) return;
  const dp = Number(box.dataset.dp) || 0;
  let spent = 0;
  box.querySelectorAll('.sty-cc-forge-effect.is-sel').forEach(e => spent += Number(e.dataset.cost) || 0);
  const rem = dp - spent;
  box.querySelectorAll('.sty-cc-forge-effect').forEach(e => {
    if (!e.classList.contains('is-sel')) e.classList.toggle('is-disabled', (Number(e.dataset.cost) || 0) > rem);
  });
  const n = root.querySelector('.sty-cc-forge-dp-n');
  if (n) n.textContent = String(rem);
}

/** Read the designer's current picks into a design object. */
function collectDesign(root) {
  const pick = (g) => root.querySelector(`.sty-cc-forge-group[data-pick="${g}"] .sty-cc-forge-chip.is-sel`)?.dataset.id || '';
  return {
    form: pick('form'),
    reach: pick('reach'),
    affinity: pick('affinity'),
    effects: [...root.querySelectorAll('.sty-cc-forge-effect.is-sel')].map(e => e.dataset.id),
  };
}

/** Leave the designer, returning to the Soul Armament / Alter Path fork. */
async function onForgeBack(sheet) {
  const actor = sheet.actor;
  const state = getCreationState(actor);
  const choices = foundry.utils.deepClone(state.choices ?? {});
  delete choices.armament; // reset the fork so both cards show again
  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, { ...state, choices, complete: false });
  sheet.render(false);
}

/** Confirm the forged armament and advance to the next step. */
async function onForgeConfirm(sheet, root) {
  const actor = sheet.actor;
  const state = getCreationState(actor);
  const stepIndex = Math.max(0, Math.min(state.stepIndex ?? 0, CREATION_STEPS.length - 1));
  const design = collectDesign(root);
  const choices = foundry.utils.deepClone(state.choices ?? {});
  choices.armament = { id: 'soul-armament', name: 'Soul Armament', path: 'soul-armament', designed: true, design };
  const isLast = stepIndex >= CREATION_STEPS.length - 1;
  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, { complete: isLast, stepIndex: isLast ? stepIndex : stepIndex + 1, choices });
  ui.notifications?.info('Soul Armament forged.');
  sheet.render(false);
}

/**
 * Mount the revolving 3D weapon in the designer. Dynamically imports the
 * system-vendored three.js (patched for Foundry — no import map needed) and
 * loads the converted PBR GLBs (sword + revolver). The weapon SWAPS with the
 * player's picks — a lone sword by default, its off-hand twin on "Summon Small
 * Arm", and the revolver on Reach 4 — each transition punctuated by a flash +
 * sparkle burst. The animation loop self-cancels when the canvas leaves the
 * DOM (sheet re-render) so WebGL contexts don't leak.
 */
async function mountForge(root) {
  const host = root.querySelector('.sty-cc-forge');
  if (!host || host.dataset.mounted === '1') return;
  host.dataset.mounted = '1';
  const canvas = host.querySelector('.sty-cc-forge-canvas');
  const flashEl = host.querySelector('.sty-cc-forge-flash');
  if (!canvas) return;

  let THREE, GLTFLoader;
  try {
    THREE = await import(`/${THREE_DIR}/three.module.js`);
    ({ GLTFLoader } = await import(`/${THREE_DIR}/GLTFLoader.js`));
  } catch (err) {
    console.error('[Stryder Forge] Failed to load three.js:', err);
    host.classList.add('is-failed');
    return;
  }

  const sizeOf = () => {
    const r = canvas.getBoundingClientRect();
    return [Math.max(120, r.width | 0), Math.max(160, r.height | 0)];
  };
  let [W, H] = sizeOf();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  cam.position.set(0, 0, 8);

  scene.add(new THREE.AmbientLight(0x556088, 0.9));
  const key = new THREE.DirectionalLight(0xffe9c2, 4.2); key.position.set(4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd0ff, 3.2); rim.position.set(-5, 2, -4); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xff9d5a, 2.0); rim2.position.set(5, -2, -3); scene.add(rim2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(0, -4, 3); scene.add(fill);
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    const es = new THREE.Scene();
    es.add(new THREE.HemisphereLight(0xaac2ff, 0x3a2408, 1.4));
    scene.environment = pm.fromScene(es, 0.03).texture;
  } catch (e) { /* env is optional */ }

  const TARGET = 4.0;
  const pivot = new THREE.Group(); scene.add(pivot);
  let swordRig = null, gunRig = null, swordTwin = null;
  let mode = 'sword';
  let popRig = null, popStart = 0;

  const applyMode = (silent) => {
    if (!swordRig && !gunRig) return;
    const wantGun = mode === 'gun';
    if (swordRig) { swordRig.visible = !wantGun; if (swordTwin) swordTwin.visible = (mode === 'sword-twin'); }
    if (gunRig) gunRig.visible = wantGun;
    if (!silent) { spawnBurst(); flashDom(); popRig = wantGun ? gunRig : swordRig; popStart = performance.now(); }
  };
  host.__setForgeMode = (m) => { if (m === mode) return; mode = m; applyMode(false); };

  // sword — centre on the PRIMARY blade so a lone sword sits dead-centre and
  // its off-hand twin flanks it when revealed.
  new GLTFLoader().load(`/${FORGE_MODEL}`, (gltf) => {
    const sword = gltf.scene;
    sword.rotation.set(-Math.PI / 2, 0, 0);
    sword.updateMatrixWorld(true);
    // The GLB holds two blade meshes. three sanitises node names on import, so
    // getObjectByName('Box.026') is unreliable — identify them by position:
    // the two blades are offset along X, so sort meshes left→right, keep the
    // left one as the lone/primary blade and hide the right one (the twin).
    const meshes = [];
    sword.traverse(o => { if (o.isMesh) meshes.push(o); });
    const centerX = (m) => new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).x;
    meshes.sort((a, b) => centerX(a) - centerX(b));
    const primary = meshes[0] || sword;
    swordTwin = meshes.length > 1 ? meshes[meshes.length - 1] : null;
    const pbox = new THREE.Box3().setFromObject(primary);
    const ps = pbox.getSize(new THREE.Vector3());
    sword.position.sub(pbox.getCenter(new THREE.Vector3()));
    swordRig = new THREE.Group(); swordRig.add(sword);
    swordRig.scale.setScalar(TARGET / Math.max(ps.x, ps.y, ps.z));
    swordRig.userData.baseScale = swordRig.scale.x;
    if (swordTwin) swordTwin.visible = false;
    pivot.add(swordRig);
    host.classList.add('is-ready');
    applyMode(true);
  }, undefined, (err) => {
    console.error('[Stryder Forge] Failed to load sword GLB:', err);
    host.classList.add('is-failed');
  });

  // revolver
  new GLTFLoader().load(`/${FORGE_GUN_MODEL}`, (gltf) => {
    const gun = gltf.scene;
    gun.rotation.set(0.16, 0, Math.PI / 2 + 0.12); // barrel up, jaunty tilt
    gun.updateMatrixWorld(true);
    const gbox = new THREE.Box3().setFromObject(gun);
    const gs = gbox.getSize(new THREE.Vector3());
    gun.position.sub(gbox.getCenter(new THREE.Vector3()));
    gunRig = new THREE.Group(); gunRig.add(gun);
    gunRig.scale.setScalar(TARGET / Math.max(gs.x, gs.y, gs.z));
    gunRig.userData.baseScale = gunRig.scale.x;
    gunRig.visible = false;
    pivot.add(gunRig);
    applyMode(true);
  }, undefined, (err) => console.error('[Stryder Forge] Failed to load gun GLB:', err));

  // ---- sparkle bursts (additive points) ----
  const bursts = [];
  function spawnBurst() {
    const N = 150;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
    const c1 = new THREE.Color(0xffd98a), c2 = new THREE.Color(0x8fe0ff);
    for (let i = 0; i < N; i++) {
      const d = new THREE.Vector3(Math.random() * 2 - 1, (Math.random() * 2 - 1) * 1.6, Math.random() * 2 - 1)
        .normalize().multiplyScalar(1.6 + Math.random() * 3);
      vel.push(d);
      const c = Math.random() < 0.5 ? c1 : c2;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    bursts.push({ pts, vel, born: performance.now(), life: 720 });
  }
  function flashDom() {
    if (!flashEl) return;
    flashEl.classList.remove('is-flash');
    void flashEl.offsetWidth; // restart the CSS animation
    flashEl.classList.add('is-flash');
  }

  const t0 = performance.now();
  let raf = 0;
  const loop = () => {
    if (!document.body.contains(canvas)) { cancelAnimationFrame(raf); renderer.dispose(); return; }
    const [w, h] = sizeOf();
    if (Math.abs(w - W) > 2 || Math.abs(h - H) > 2) {
      W = w; H = h; renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
    }
    const now = performance.now();
    pivot.rotation.set(0, 0.5 + (now - t0) / 1000 * 0.35, 0.12); // slow turntable

    if (popRig) { // scale-pop the freshly summoned weapon
      const pt = Math.min(1, (now - popStart) / 260);
      const base = popRig.userData.baseScale || popRig.scale.x;
      popRig.scale.setScalar(base * (0.72 + 0.28 * pt) * (1 + 0.14 * Math.sin(pt * Math.PI)));
      if (pt >= 1) { popRig.scale.setScalar(base); popRig = null; }
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      const bt = (now - b.born) / b.life;
      if (bt >= 1) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); continue; }
      const arr = b.pts.geometry.attributes.position.array;
      const dt = 1 / 60;
      for (let j = 0; j < b.vel.length; j++) {
        arr[j * 3] += b.vel[j].x * dt; arr[j * 3 + 1] += b.vel[j].y * dt; arr[j * 3 + 2] += b.vel[j].z * dt;
        b.vel[j].multiplyScalar(0.93);
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = 1 - bt;
      b.pts.material.size = 0.14 * (1 - bt * 0.4);
    }

    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  loop();
}

/**
 * Attach all creation listeners. Called by the actor sheet's activateListeners
 * when the sheet is an uncreated protocharacter (normal wiring is skipped).
 */
export function activateCreationListeners(sheet, html) {
  const root = html?.[0] ?? html;
  if (!root) return;

  root.querySelectorAll('.sty-cc-card').forEach(card => attachHolo(card));

  root.querySelectorAll('.sty-cc-stage .sty-cc-cardwrap').forEach(wrap => {
    wrap.addEventListener('click', () => openReveal(root, wrap));
  });

  // Allocator interactions (delegated on the reveal allocator box).
  const allocBox = root.querySelector('.sty-cc-reveal-alloc');
  allocBox?.addEventListener('click', (e) => {
    const pick = e.target.closest('.sty-cc-alloc-pick');
    const step = e.target.closest('.sty-cc-step');
    const chip = e.target.closest('.sty-cc-alloc-chip');
    if (pick) {
      const block = pick.closest('.sty-cc-alloc-block');
      block.querySelectorAll('.sty-cc-alloc-pick').forEach(b => b.classList.remove('is-sel'));
      pick.classList.add('is-sel');
    } else if (step) {
      if (step.disabled) return;
      const st = step.closest('.sty-cc-alloc-stepper');
      const block = step.closest('.sty-cc-alloc-block');
      const nEl = st.querySelector('.sty-cc-step-n');
      const pool = Number(block.dataset.pool);
      const cap = Number(block.dataset.cap);
      let sum = 0;
      block.querySelectorAll('.sty-cc-step-n').forEach(x => sum += Number(x.textContent) || 0);
      let n = Number(nEl.textContent) || 0;
      if (Number(step.dataset.d) > 0 && sum < pool && n < cap) n++;
      else if (Number(step.dataset.d) < 0 && n > 0) n--;
      nEl.textContent = String(n);
    } else if (chip) {
      const block = chip.closest('.sty-cc-alloc-block');
      const max = Number(block.dataset.max);
      const sel = block.querySelectorAll('.sty-cc-alloc-chip.is-sel').length;
      if (chip.classList.contains('is-sel')) chip.classList.remove('is-sel');
      else if (sel < max) chip.classList.add('is-sel');
    } else {
      return;
    }
    refreshAllocator(root);
  });

  // Stryder Origin shop (+/- steppers on a point budget).
  const shop = root.querySelector('.sty-cc-shop');
  if (shop) {
    shop.addEventListener('click', (e) => {
      const btn = e.target.closest('.sty-cc-shop-btn');
      if (!btn || btn.disabled) return;
      const item = btn.closest('.sty-cc-shop-item');
      const qEl = item.querySelector('.sty-cc-shop-qty');
      let q = Number(qEl.textContent) || 0;
      const d = Number(btn.dataset.d);
      if (d > 0) q += 1;
      else if (d < 0 && q > 0) q -= 1;
      qEl.textContent = String(q);
      refreshShop(root);
    });
    refreshShop(root);
  }

  // Point allocators (Stats / Experience / Mastery).
  const allot = root.querySelector('.sty-cc-allot');
  if (allot) {
    allot.addEventListener('click', (e) => {
      const btn = e.target.closest('.sty-cc-allot-btn');
      if (!btn || btn.disabled) return;
      const item = btn.closest('.sty-cc-allot-item');
      const val = item.querySelector('.sty-cc-allot-val');
      let v = Number(val.textContent) || 0;
      const d = Number(btn.dataset.d);
      if (d > 0) v += 1;
      else if (d < 0 && v > 0) v -= 1;
      val.textContent = String(v);
      refreshAllot(root);
    });
    refreshAllot(root);
  }

  // Soul Armament designer (the forge): 3D sword + Form/Reach/Effect/Affinity.
  const designer = root.querySelector('.sty-cc-designer');
  if (designer) {
    designer.addEventListener('click', (e) => {
      const chip = e.target.closest('.sty-cc-forge-chip');
      const eff = e.target.closest('.sty-cc-forge-effect');
      if (chip) {
        if (chip.classList.contains('is-wip')) return;
        const group = chip.closest('.sty-cc-forge-group');
        group.querySelectorAll('.sty-cc-forge-chip').forEach(c => c.classList.remove('is-sel'));
        chip.classList.add('is-sel');
      } else if (eff) {
        if (eff.classList.contains('is-sel')) {
          eff.classList.remove('is-sel');
        } else {
          const box = eff.closest('.sty-cc-forge-effects');
          const dp = Number(box.dataset.dp) || 0;
          let spent = 0;
          box.querySelectorAll('.sty-cc-forge-effect.is-sel').forEach(x => spent += Number(x.dataset.cost) || 0);
          if ((Number(eff.dataset.cost) || 0) + spent <= dp) eff.classList.add('is-sel');
        }
        refreshForgeDP(root);
      } else {
        return;
      }
      // Swap the 3D weapon to match the picks: Reach 4 → revolver, otherwise
      // sword (twin blades while "Summon Small Arm" is active).
      const reach = root.querySelector('.sty-cc-forge-group[data-pick="reach"] .sty-cc-forge-chip.is-sel')?.dataset.id;
      const twinOn = !!root.querySelector('.sty-cc-forge-effect.is-sel[data-id="twin"]');
      const weaponMode = reach === 'r4' ? 'gun' : (twinOn ? 'sword-twin' : 'sword');
      root.querySelector('.sty-cc-forge')?.__setForgeMode?.(weaponMode);
    });
    root.querySelector('[data-action="forge-back"]')?.addEventListener('click', () => onForgeBack(sheet));
    root.querySelector('[data-action="forge-confirm"]')?.addEventListener('click', () => onForgeConfirm(sheet, root));
    refreshForgeDP(root);
    mountForge(root);
  }

  root.querySelector('[data-action="back-list"]')?.addEventListener('click', () => { root.dataset.view = 'browse'; });
  root.querySelector('[data-action="back-step"]')?.addEventListener('click', () => onNav(sheet, -1));
  root.querySelector('[data-action="choose"]')?.addEventListener('click', () => onChoose(sheet, root));
}
