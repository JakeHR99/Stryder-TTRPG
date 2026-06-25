import { SYSTEM_ID } from '../helpers/constants.mjs';

import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

// ---------------------------------------------------------------------------
// Stryder level-up tables
// ---------------------------------------------------------------------------
const STRYDER_STAMINA_BY_LEVEL = {
  1:3,  2:3,  3:3,  4:3,  5:3,
  6:4,  7:4,  8:4,  9:4,  10:4,
  11:5, 12:5, 13:5, 14:5, 15:5
};

const STRYDER_MANA_BY_LEVEL = {
  1:4,  2:4,  3:5,  4:5,  5:6,
  6:6,  7:7,  8:8,  9:8,  10:9,
  11:10, 12:11, 13:11, 14:12, 15:12
};

const STRYDER_CLASS_DATA = {
  'Warrior':  { base_hp: 8, hp_per_level: 2 },
  'Ranger':   { base_hp: 8, hp_per_level: 2 },
  'Warlock':  { base_hp: 8, hp_per_level: 2 },
  'Shaman':   { base_hp: 6, hp_per_level: 2 },
  'Summoner': { base_hp: 6, hp_per_level: 2 },
  'Wytch':    { base_hp: 6, hp_per_level: 2 },
};

// ---------------------------------------------------------------------------
// Stat Distribution Popup — shown when a Warrior aug grants extra stat points
// ---------------------------------------------------------------------------
async function _showStatDistributePopup(actor, pts) {
  const STATS   = ['Soul', 'Reflex', 'Grit', 'Will'];
  const MAX_VAL = 7;
  const deltas  = Object.fromEntries(STATS.map(s => [s, 0]));
  let remaining = pts;

  const rows = STATS.map(s => {
    const cur = actor.system.abilities?.[s]?.value ?? 0;
    return `<div class="sty-dlg-row">
      <span class="sty-dlg-row-label">${s}</span>
      <span class="sty-dlg-row-base" data-sdc-base="${s}">${cur}</span>
      <button type="button" class="sty-step-btn minus sdc-minus" data-stat="${s}">−</button>
      <span class="sty-dlg-row-val" data-sdc-val="${s}">${cur}</span>
      <button type="button" class="sty-step-btn plus sdc-plus" data-stat="${s}">+</button>
      <span class="sty-dlg-row-delta" data-sdc-delta="${s}"></span>
    </div>`;
  }).join('');

  const content = `<div class="sty-dlg-body">
    <p>Distribute <strong>${pts}</strong> new stat points (max 7 per stat).</p>
    <div class="sty-dlg-label" style="margin-bottom:14px;">
      Points remaining:&ensp;<strong id="sdc-remaining" class="sty-dlg-value">${pts}</strong>
    </div>
    ${rows}
  </div>`;

  return new Promise(resolve => {
    new Dialog({
      title: `Distribute +${pts} Stat Points`,
      content,
      buttons: {
        confirm: {
          label: 'Confirm',
          callback: async (html) => {
            const updates = {};
            for (const s of STATS) {
              if (deltas[s] !== 0)
                updates[`system.abilities.${s}.value`] = (actor.system.abilities?.[s]?.value ?? 0) + deltas[s];
            }
            if (Object.keys(updates).length) await actor.update(updates);
            resolve();
          }
        },
        skip: { label: 'Assign Later', callback: () => resolve() }
      },
      default: 'confirm',
      render: (html) => {
        html.find('.sdc-plus').on('click', function () {
          const s   = this.dataset.stat;
          const cur = actor.system.abilities?.[s]?.value ?? 0;
          if (remaining <= 0 || (cur + deltas[s]) >= MAX_VAL) return;
          deltas[s]++; remaining--;
          html.find(`[data-sdc-val="${s}"]`).text(cur + deltas[s]);
          html.find(`[data-sdc-delta="${s}"]`).text(`+${deltas[s]}`);
          html.find('#sdc-remaining').text(remaining);
        });
        html.find('.sdc-minus').on('click', function () {
          const s = this.dataset.stat;
          if (deltas[s] <= 0) return;
          const cur = actor.system.abilities?.[s]?.value ?? 0;
          deltas[s]--; remaining++;
          html.find(`[data-sdc-val="${s}"]`).text(cur + deltas[s]);
          html.find(`[data-sdc-delta="${s}"]`).text(deltas[s] > 0 ? `+${deltas[s]}` : '');
          html.find('#sdc-remaining').text(remaining);
        });
      }
    }, { width: 320, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });
}

// ---------------------------------------------------------------------------
// Class Augmentation Options
// Hardcoded per-class so the Growth panel never relies on compendium HTML.
// Each option: { label, sublabel, apply: async (actor) => {} }
// ---------------------------------------------------------------------------
const CLASS_AUG_OPTIONS = {
  // ── Warrior ──────────────────────────────────────────────────────────────
  WrrAbil02WaI: [
    {
      label: 'Excellent range becomes 10–12',
      sublabel: 'Attack roll quality extended',
      apply: async (actor) => {
        await actor.setFlag('stryder', 'augExcellentRange1012', true);
        ui.notifications.info(`${actor.name}: Excellent range is now 10–12.`);
      },
    },
    {
      label: '+2 Extra Stat Points',
      sublabel: 'Can exceed 5 (max 7) — distribute in Stats',
      apply: async (actor) => {
        const cur = actor.getFlag('stryder', 'augExtraStatPoints') ?? 0;
        await actor.setFlag('stryder', 'augExtraStatPoints', cur + 2);
        await _showStatDistributePopup(actor, 2);
      },
    },
    {
      label: '+2 Experience Points',
      sublabel: 'Granted immediately',
      apply: async (actor) => {
        const cur = actor.system.attributes?.xp?.value ?? 0;
        await actor.update({ 'system.attributes.xp.value': cur + 2 });
        ui.notifications.info(`${actor.name} gained 2 XP.`);
      },
    },
  ],
  WrrAbil03WaII: [
    {
      label: '+1 to Attack Rolls',
      sublabel: 'Applies to all 2d6 attack rolls',
      apply: async (actor) => {
        const cur = actor.getFlag('stryder', 'augAttackBonus') ?? 0;
        await actor.setFlag('stryder', 'augAttackBonus', cur + 1);
        ui.notifications.info(`${actor.name}: +1 to all attack rolls.`);
      },
    },
    {
      label: '+5 Maximum Health',
      sublabel: 'Permanent increase',
      apply: async (actor) => {
        // Store as a flag so _calcMaxStats can include it — a direct write to
        // health.max would be overwritten every render by _syncComputedStats.
        const cur = actor.getFlag('stryder', 'augHealthBonus') ?? 0;
        await actor.setFlag('stryder', 'augHealthBonus', cur + 5);
        ui.notifications.info(`${actor.name}: Maximum Health increased by 5.`);
      },
    },
    {
      label: '+2 Maximum Movement',
      sublabel: 'Running & Marching speeds',
      apply: async (actor) => {
        const move = actor.system.attributes?.move ?? {};
        await actor.update({
          'system.attributes.move.running.value':  (move.running?.value  ?? 7) + 2,
          'system.attributes.move.marching.value': (move.marching?.value ?? 4) + 2,
        });
        ui.notifications.info(`${actor.name}: Running +2, Marching +2.`);
      },
    },
  ],
  WrrAbil04WaIII: [
    {
      label: 'Poor range → 1 · Daily combat reroll',
      sublabel: 'Once per day while in combat',
      apply: async (actor) => {
        await actor.setFlag('stryder', 'augPoorRangeOverride', 1);
        await actor.setFlag('stryder', 'augDailyRerollAvailable', true);
        ui.notifications.info(`${actor.name}: Poor range is now 1. Daily reroll granted.`);
      },
    },
    {
      label: '+3 Extra Stat Points',
      sublabel: 'Can exceed 5 (max 7) — distribute in Stats',
      apply: async (actor) => {
        const cur = actor.getFlag('stryder', 'augExtraStatPoints') ?? 0;
        await actor.setFlag('stryder', 'augExtraStatPoints', cur + 3);
        await _showStatDistributePopup(actor, 3);
      },
    },
    {
      label: '+3 Experience Points',
      sublabel: 'Granted immediately',
      apply: async (actor) => {
        const cur = actor.system.attributes?.xp?.value ?? 0;
        await actor.update({ 'system.attributes.xp.value': cur + 3 });
        ui.notifications.info(`${actor.name} gained 3 XP.`);
      },
    },
  ],
  WrrAbil05WaIV: [
    {
      label: 'Double damage on Excellent Attacks',
      sublabel: 'All attacks',
      apply: async (actor) => {
        await actor.setFlag('stryder', 'augDoubleExcellentDamage', true);
        ui.notifications.info(`${actor.name}: Excellent Attacks now deal double damage.`);
      },
    },
    {
      label: '+5 Damage Reduction (all sources)',
      sublabel: 'Physical & Magykal',
      apply: async (actor) => {
        // _calculateReductionBonuses is disabled in actor.mjs (prevents armor overwrites),
        // so the flag alone would never be applied. Store the flag AND directly write to
        // the reduction fields which are manually managed.
        const cur = actor.getFlag('stryder', 'augDamageReduction') ?? 0;
        await actor.setFlag('stryder', 'augDamageReduction', cur + 5);
        const physCur = actor.system.physical_reduction ?? 0;
        const magyCur = actor.system.magykal_reduction  ?? 0;
        await actor.update({
          'system.physical_reduction': physCur + 5,
          'system.magykal_reduction':  magyCur + 5,
        });
        ui.notifications.info(`${actor.name}: +5 Damage Reduction from all sources.`);
      },
    },
    {
      label: '+2 Maximum Stamina',
      sublabel: 'Permanent increase',
      apply: async (actor) => {
        // Store as a flag so _calcMaxStats can include it — same reason as augHealthBonus.
        const cur = actor.getFlag('stryder', 'augStaminaBonus') ?? 0;
        await actor.setFlag('stryder', 'augStaminaBonus', cur + 2);
        ui.notifications.info(`${actor.name}: Maximum Stamina increased by 2.`);
      },
    },
  ],
};

const STRYDER_CLASS_FEATURES = {
  Warrior: [
    { level: 1,  feats: [{ id: 'WrrAbil01AugCmb', name: 'Augmented Combatant' }] },
    { level: 4,  feats: [{ id: 'WrrAbil02WaI',    name: 'Warrior Augmentations I',   isChoice: true }] },
    { level: 8,  feats: [{ id: 'WrrAbil03WaII',   name: 'Warrior Augmentations II',  isChoice: true }] },
    { level: 12, feats: [{ id: 'WrrAbil04WaIII',  name: 'Warrior Augmentations III', isChoice: true }] },
    { level: 15, feats: [{ id: 'WrrAbil05WaIV',   name: 'Warrior Augmentations IV',  isChoice: true }] },
  ],
  Ranger: [
    { level: 1,  feats: [{ id: 'RngrCls01CrWk',    name: 'Create Weakness' },     { id: null, name: 'Ranger Technique', isTechChoice: true }] },
    { level: 4,  feats: [{ id: 'RngrCls02BhSl000', name: 'Behemoth Slayer' },     { id: null, name: 'Ranger Technique', isTechChoice: true }] },
    { level: 8,  feats: [{ id: 'RngrCls03ExWk',    name: 'Exploit Weakness' },    { id: null, name: 'Ranger Technique', isTechChoice: true }] },
    { level: 12, feats: [{ id: 'RngrCls04BhSlII0', name: 'Behemoth Slayer II' },  { id: null, name: 'Ranger Technique', isTechChoice: true }] },
    { level: 15, feats: [{ id: 'RngrCls05TyEx000', name: 'Tyrant Executioner' },  { id: null, name: 'Ranger Technique', isTechChoice: true }] },
  ],
  Shaman: [
    { level: 1,  feats: [
      { id: 'ShmAbil01BndLv', name: 'Bonded Lives', noEmbed: true },
      { id: 'ShmTac01Atk',   name: 'Tactic: Attack' },
      { id: 'ShmTac02Heal',  name: 'Tactic: Heal' },
      { id: 'ShmTac03DgEv',  name: 'Tactic: Dodge/Evasion' },
      { id: 'ShmTac04Ret',   name: 'Tactic: Return' },
      { id: 'ShmTac05Met',   name: 'Tactic: Metamorph' },
      { id: null, name: 'Lordly Aspects (×3)', isLordlyChoice: true, count: 3, startIdx: 0 },
    ]},
    { level: 4,  feats: [
      { id: 'ShmAbil02ExpBnd', name: 'Expanding Bond' },
      { id: null, name: 'Mystic Blessings', isMysticBlessing: true },
      { id: 'ShmTac06Rtr',   name: 'Tactic: Retreat' },
      { id: 'ShmTac07TrTl',  name: 'Tactic: Transfer Talent' },
      { id: null, name: 'Lordly Aspect', isLordlyChoice: true, count: 1, startIdx: 3 },
    ]},
    { level: 8,  feats: [
      { id: 'ShmAbil02ExpBnd', name: 'Expanding Bond II', milestone: true },
      { id: 'ShmAbil03DspStr', name: 'Desperate Strength' },
      { id: null, name: 'Memories of Past Lives', isMasteryGrant: true, masteryAmount: 3 },
      { id: null, name: 'Lordly Aspects (×2)', isLordlyChoice: true, count: 2, startIdx: 4 },
    ]},
    { level: 12, feats: [
      { id: 'ShmAbil02ExpBnd', name: 'Expanding Bond III', milestone: true },
      { id: 'ShmAbil04SprArm', name: 'Spirit Armament' },
      { id: null, name: 'Lordly Aspect', isLordlyChoice: true, count: 1, startIdx: 6 },
    ]},
    { level: 15, feats: [
      { id: 'ShmAbil02ExpBnd', name: 'Unbreakable Bond', milestone: true },
      { id: 'ShmAbil05ApAsc', name: 'Approximate Ascension' },
      { id: null, name: 'Lordly Aspect', isLordlyChoice: true, count: 1, startIdx: 7 },
    ]},
  ],
  Summoner: [
    { level: 1,  feats: [
      { id: 'SmnAbil01BlsPhy', name: 'Blessed Physiology' },
      { id: 'SmnAbil02BndGt', name: 'The Binding Gates' },
    ]},
    { level: 4,  feats: [
      { id: 'SmnAbil03RefGt', name: 'Reinforced Gates' },
      { id: 'SmnAbil04MyrI',  name: 'Myriad Gates I' },
      { id: 'SmnAbil05SacRI', name: 'Sacrificed Remains I' },
    ]},
    { level: 8,  feats: [
      { id: 'SmnAbil06SzMt',  name: 'Size and Matter' },
      { id: 'SmnAbil07ImbStr', name: 'Imbuing Strength' },
      { id: 'SmnAbil08SacRII', name: 'Sacrificed Remains II' },
    ]},
    { level: 12, feats: [
      { id: 'SmnAbil09ChimGt', name: 'Chimeric Gate' },
      { id: 'SmnAbil10MyrII',  name: 'Myriad Gates II' },
    ]},
    { level: 15, feats: [{ id: 'SmnAbil11BstDis', name: 'Beast of Disaster' }] },
  ],
  Warlock: [
    { level: 1,  feats: [
      { id: 'WrlkAbil01BdWr',  name: 'Body of War' },
      { id: 'WrlkAbil02ScStr', name: 'Scarlet Strike' },
      { id: 'WrlkAbil03ScWrd', name: 'Scarlet Warden' },
    ]},
    { level: 4,  feats: [
      { id: 'WrlkAbil04SnSph', name: 'Sin Siphon' },
      { id: 'WrlkAbil05BlTth', name: 'Blood Tithes' },
    ]},
    { level: 8,  feats: [
      { id: 'WrlkAbil06SngIch', name: 'Sanguine Ichor' },
      { id: 'WrlkAbil07CrmCrn', name: 'Crimson Crown' },
    ]},
    { level: 12, feats: [
      { id: 'WrlkAbil08HmrLnc', name: 'Hemorrhaging Lance' },
      { id: 'WrlkAbil09SacWrl', name: 'Sacrifice' },
    ]},
    { level: 15, feats: [
      { id: 'WrlkAbil10BldEcl', name: 'Bloodied Eclipse' },
      { id: 'WrlkAbil11MscRtn', name: 'Masochistic Returns' },
    ]},
  ],
  Wytch: [
    { level: 1,  feats: [
      { id: 'WytAbil01MgFcs', name: 'Magykal Focus', noEmbed: true },
      { id: 'WytAbil02HxWld', name: 'Hex Wielding',  noEmbed: true },
      { id: 'WytHex01Sck',    name: 'Hex: Sicken' },
      { id: 'WytHex02Bnd',    name: 'Hex: Bind' },
      { id: 'WytHex03Dny',    name: 'Hex: Deny' },
    ]},
    { level: 4,  feats: [
      { id: 'WytAbil03FcsRmn', name: 'Focus and Remains' },
      { id: 'WytHex04Mut',     name: 'Hex: Mutilate' },
      { id: 'WytHex05Enr',     name: 'Hex: Enrage' },
      { id: 'WytHex06Pnc',     name: 'Hex: Panic' },
    ]},
    { level: 8,  feats: [
      { id: 'WytAbil04WytEye', name: "The Wytch's Eye" },
      { id: 'WytHex07Srg',     name: 'Hex: Surge' },
      { id: 'WytHex08Rise',    name: 'Hex: Rise' },
      { id: 'WytHex09Give',    name: 'Hex: Give' },
    ]},
    { level: 12, feats: [
      { id: 'WytHex10Add', name: 'Hex: Addle' },
      { id: 'WytHex11Sfr', name: 'Hex: Suffer' },
      { id: 'WytHex12Del', name: 'Hex: Delude' },
    ]},
    { level: 15, feats: [
      { id: 'WytAbil05HxMst',  name: 'Hex Mastery' },
      { id: 'WytAbil06TrFcs',  name: 'True Focus Over Remains' },
    ]},
  ],
};

// ---------------------------------------------------------------------------
// Stryder folk tables
// ---------------------------------------------------------------------------
const STRYDER_FOLK_DATA = {
  Feyfolk: {
    size: 'Medium', weight: 4,
    talents: { Intimacy: 2, Wisdom: 1, Nimbleness: 1 },
    senses:  { Arcane: 1, Hearing: 1 },
    passives: [],
    subfolks: null, freePoints: null
  },
  Remnant: {
    size: 'Medium', weight: 4,
    talents: { Nimbleness: 2, Deceit: 1, Wisdom: 1 },
    senses:  { Sight: 2 },
    passives: [],
    subfolks: null, freePoints: null
  },
  Sunborn: {
    size: 'Medium', weight: 4,
    talents: { Charm: 1, Intimacy: 1, Nimbleness: 1, Strength: 1 },
    senses:  { Sight: 1, Touch: 1 },
    passives: [],
    subfolks: null, freePoints: null
  },
  Oumen: {
    size: null, weight: null,
    talents: { Aggression: 2, Endurance: 1, Strength: 1 },
    senses:  { Arcane: 1, Hearing: 1 },
    passives: ['Divergent: Choose an origin folk for appearance and size only. You gain NONE of that folk\'s abilities.'],
    subfolks: null, freePoints: null,
    originFolkPicker: true,
    afflictionPicker: true,
  },
  Halfling: {
    size: 'Small', weight: 3,
    talents: { Wisdom: 2, Endurance: 1, Finesse: 1 },
    senses:  { Hearing: 1, Smell: 1 },
    passives: [],
    subfolks: null, freePoints: null
  },
  Smallfolk: {
    size: 'Small', weight: 3,
    talents: { Wisdom: 2, Endurance: 1, Finesse: 1 },
    senses:  { Hearing: 1, Smell: 1 },
    passives: [],
    subfolks: null, freePoints: null
  },
  Floran: {
    size: null, weight: 4,
    talents: { Survival: 2, Endurance: 1, Strength: 1 },
    senses:  { Arcane: 1, Touch: 1 },
    passives: [],
    subfolks: null, freePoints: null,
    sizeChoices: ['Sprout (Medium)', 'Tree (Huge)']
  },
  Descendants: {
    size: 'Medium', weight: 4,
    talents: { Charm: 1, Diplomacy: 1, Intimacy: 1, Wit: 1 },
    senses:  { Arcane: 2 },
    passives: [],
    subfolks: null, freePoints: null
  },
  Traveler: {
    size: 'Medium', weight: 4,
    talents: {}, senses: {},
    passives: ['The Greying: -1 to all Magykal Resists.'],
    subfolks: ['Dawnkeeper', 'Starchaser', 'Wavewatcher', 'Puck'],
    freePoints: { talentPool: 4, sensePool: 2 }
  },
  Colossus: {
    size: null, weight: null,
    talents: {}, senses: { Touch: 2 },
    passives: ['One With the Earth: +2 Physical Resistance.'],
    subfolks: ['Crag', 'Marbled'],
    freePoints: null,
    sizeChoices: ['Medium', 'Huge'],
    statChoice: true
  },
  Wildkin: {
    size: null, weight: 4,
    talents: {}, senses: {},
    passives: [],
    subfolks: null,
    freePoints: { talentPool: 4, talentTargets: ['Aggression','Endurance','Strength','Survival','Nimbleness','Wisdom'], talentCap: 5, senseChoice: ['Sight','Hearing'], adaptationCount: 3 },
    sizeChoices: ['Small', 'Medium'],
    adaptations: [
      { name: 'Land',                  description: '+2 Marching Speed; ignore movement penalties on difficult land terrain.' },
      { name: 'Sea',                   description: 'Gain Swimming expertise; Swimming Speed +3.' },
      { name: 'Sand',                  description: 'Ignore movement penalties in arid/desert terrain; +1 to Survival checks made in such environments.' },
      { name: 'Snow',                  description: 'Ignore movement penalties in tundra/snow terrain; +1 to Endurance checks made in such environments.' },
      { name: 'Jungle',                description: 'Gain Climbing expertise; +1 to Survival and Nimbleness checks in dense or overgrown terrain.' },
      { name: 'Sky',                   description: 'Glide: when falling you take no fall damage and may move horizontally 1 space for each space descended.' },
      { name: 'Powerful Build',        description: 'Count as one size larger for grappling and being forcibly moved; +1 Strength (applied to rolls, not to talent score).' },
      { name: 'Lithe',                 description: '+1 to all Dodge rolls; +1 Nimbleness (applied to rolls, not to talent score).' },
      { name: 'Night Hunter',          description: 'Nightvision: suffer no penalties in darkness or low-light conditions. +1 to Sight checks to detect hidden or invisible creatures.' },
      { name: 'Jaws',                  description: 'Natural bite attack (Swift | 1 Stamina): 2 base dmg + 1 Bleeding Wound. Can maintain a Grapple without using hands.' },
      { name: 'Claws',                 description: 'Natural claw attacks: Focused Attacks gain +1 base dmg. +2 to Climbing checks.' },
      { name: 'Stinger',               description: 'Sting attack (Swift | 1 Stamina | Range 1): 1 base dmg; target makes Physical Resist or gains Draining Poison.' },
      { name: 'Tail',                  description: '+1 to all Evasion rolls; immune to the Dropped condition from balance-altering effects.' },
      { name: 'Exoskeleton',           description: '1 Physical Damage Reduction (stacks with other DR); immune to Bleeding Wounds.' },
      { name: 'Bulk',                  description: '+4 Max HP; count as one size larger when resisting forced movement or knockback.' },
      { name: 'Echolocation',          description: 'Never Blinded by non-light effects. Automatically detect Hidden creatures within 5 spaces by sound.' },
      { name: 'Poisonous',             description: 'Creatures that deal melee damage to you must make a Physical Resist or suffer Draining Poison.' },
      { name: 'High Jumper',           description: 'Vertical jump distance = full Strength (not Strength ÷ 2); +2 to all Leap checks.' },
      { name: 'Burst',                 description: 'Once per engagement, gain +5 Movement for one Player Phase (Swift, costs no Stamina).' },
      { name: 'Self Defense Mechanism', description: 'Once per engagement when you take damage: reduce that damage by your Grit value (Trigger, no cost).' },
      { name: 'Beast Senses',          description: '+1 to two Senses of your choice (chosen when this adaptation is selected).' }
    ]
  }
};

const STRYDER_COLOSSUS_SUBFOLK = {
  Crag: {
    weight: 6,
    immunities: ['Bleeding Wound'],
    talents: { Aggression: 1, Survival: 1 }
  },
  Marbled: {
    weight: 5,
    immunities: ['Burning'],
    talents: { Diplomacy: 1, Charm: 1 }
  }
};

// Oumen affliction data — passive/active item definitions + AE changes per affliction
const STRYDER_OUMEN_AFFLICTIONS = {
  'Cursed Horns': {
    summary: '+2 Max Mana; laser beam (Swift, Limit 1)',
    aeChanges: [{ key: 'system.mana.max', mode: 2, value: '2', priority: 50 }],
    passive: {
      name: 'Cursed Horns (Passive)',
      description: '<p>Your horns are a conduit of power for your mana. You gain +2 Maximum Mana.</p>',
      cooldown_value: 0,
    },
    active: {
      name: 'Cursed Horns (Active)',
      description: '<p><strong>Swift Action</strong> | Range: 10 Spaces | Ahl Damage | Limit: 1</p><p>You charge a surge of the Other between your horns. At the start of your next turn you select a target within range and fire an impossibly fast laser that deals damage equal to 2× your Soul. This attack cannot be dodged.</p>',
      cooldown_value: 1,
    },
  },
  'Cursed Wing': {
    summary: 'Immune to fall damage; hover (Swift, Limit 3)',
    aeChanges: [],
    passive: {
      name: 'Cursed Wing (Passive)',
      description: '<p>Your wing reflexively snaps out to protect you if you fall, making you immune to falling or colliding damage so long as your wing is unbound so that it may unfurl and nullify your momentum before impact.</p>',
      cooldown_value: 0,
    },
    active: {
      name: 'Cursed Wing (Active)',
      description: '<p><strong>Swift Action</strong> | Limit: 3</p><p>Your wing emits a consistent flow of magyk that you can use to hover. While hovering, expending Movement ignores additional costs from Marching terrain as well as granting you the ability to cross open air between two points as if they were solid land, but you cannot end your turn in open air or you will begin to fall. This hover lasts until the start of your next turn.</p>',
      cooldown_value: 3,
    },
  },
  'Cursed Arm': {
    summary: 'Strength → 5; quick strike + knockback (Swift, Limit 2)',
    aeChanges: [{ key: 'system.attributes.talent.strength.value', mode: 4, value: '5', priority: 55 }],
    passive: {
      name: 'Cursed Arm (Passive)',
      description: '<p>Your Strength Talent increases to 5.</p>',
      cooldown_value: 0,
    },
    active: {
      name: 'Cursed Arm (Active)',
      description: '<p><strong>Swift Action</strong> | Limit: 2</p><p>While this ability is active you can make a 1 Stamina Quick Attack with the arm that deals 5 damage. On a failed Physical Resist vs your highest Potency, the target is sent flying a number of spaces equal to your Soul.</p>',
      cooldown_value: 2,
    },
  },
  'Cursed Leg': {
    summary: 'Movement +2, +1 Evasion; empowered leap (Swift, Limit 2)',
    aeChanges: [{ key: 'system.attributes.move.running.value', mode: 2, value: '2', priority: 50 }],
    passive: {
      name: 'Cursed Leg (Passive)',
      description: '<p>Your Movement increases by 2 and you gain a +1 bonus to Evasion.</p>',
      cooldown_value: 0,
    },
    active: {
      name: 'Cursed Leg (Active)',
      description: '<p><strong>Swift Action</strong> | Limit: 2</p><p>You can do an empowered version of the Leap Action. When you do, you travel twice as far and you do not suffer fall damage as a result of this ability.</p>',
      cooldown_value: 2,
    },
  },
};

// ── Lordly Aspect Features — categorised for the picker UI ──────────────────
// NOTE: Monkey Paw (LrdRylAbil03MnPw) and Tigers Pounce (LrdRylAbil05TgPn)
// have Royal-prefixed IDs in the source but are Wild Aspect features per the rulebook.
const LORDLY_ASPECT_FEATURES = {
  Wild: [
    { id: 'LrdWldAbil01StTg', name: 'Strike Together',        tag: 'Tactic — Swift'   },
    { id: 'LrdRylAbil03MnPw', name: 'Monkey Paw',             tag: 'Tactic — Focused' },
    { id: 'LrdRylAbil05TgPn', name: 'Tigers Pounce',          tag: 'Tactic — Focused' },
    { id: 'LrdWldAbil02AgMt', name: 'Agile Mount',            tag: 'Passive'          },
    { id: 'LrdWldAbil03StWd', name: 'Stride of the Wild Ones',tag: 'Passive'          },
    { id: 'LrdWldAbil04Bmbd', name: 'Bombardment',            tag: 'Tactic — Swift'   },
  ],
  Royal: [
    { id: 'LrdRylAbil01MrQk', name: 'Marching Quake',         tag: 'Tactic — Focused' },
    { id: 'LrdRylAbil02SgBs', name: 'Siege Beast',            tag: 'Passive'          },
    { id: 'LrdRylAbil04ImMt', name: 'Imposing Mount',         tag: 'Passive'          },
    { id: 'LrdRylAbil06Ftbl', name: 'Fastball',               tag: 'Tactic — Focused' },
    { id: 'LrdRylAbil07MyRj', name: 'Mystical Rejuvenation',  tag: 'Tactic — Focused' },
    { id: 'LrdRylAbil08RyDc', name: "Royal's Decree",         tag: 'Tactic — Swift'   },
  ],
  Spirit: [
    { id: 'LrdSprAbil01DbRm', name: 'Diamond Body, Reverent Mind', tag: 'Tactic — Swift' },
    { id: 'LrdSprAbil02RgAr', name: 'Ranged Arsenal',              tag: 'Passive'         },
    { id: 'LrdSprAbil03BlMs', name: 'Blink and Miss',              tag: 'Tactic — Focused'},
    { id: 'LrdSprAbil04FtMe', name: 'Fight Through Me',            tag: 'Passive'         },
  ],
};
const LORDLY_ASPECT_FEATURE_IDS = new Set(
  Object.values(LORDLY_ASPECT_FEATURES).flat().map(f => f.id)
);

// Register Handlebars helpers used by the inventory grid template
if (!Handlebars.helpers['gt']) {
  Handlebars.registerHelper('gt', (a, b) => a > b);
}

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class StryderActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['stryder', 'sheet', 'actor'],
      width: 1000,
      height: 700,
      resizable: true,
      scrollY: ['.jrpg-sub-content'],
      dragDrop: [{ dragSelector: '.item', dropSelector: null }],
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'features' }],
    });
  }

  /** Async — fetches compendium data and injects Growth page content. */
  async _buildGrowthPage(_html) {
    try {
      // Scope panel lookup to THIS sheet's DOM. Using global document.getElementById
      // here meant that with multiple sheets open (or rapid open/close re-renders)
      // the duplicate panel ids could resolve to a stale/other sheet's node, leaving
      // the live sheet stuck on its "Loading…" placeholder until a browser reload.
      const root = _html?.[0] ?? this.element?.[0] ?? document;
      const classPanel = root.querySelector('#jrpg-growth-class-panel');
      const buyPanel   = root.querySelector('#jrpg-growth-buy-panel');
      if (!classPanel || !buyPanel) {
        console.warn('[Growth] Panels not found in this sheet — skipping build');
        return;
      }

      // Inject ID-scoped styles — ID selectors (specificity 1,0,0) beat any Foundry class override
      {
        const existing = document.getElementById('gw-scoped-styles');
        if (existing) existing.remove();
        const s = document.createElement('style');
        s.id = 'gw-scoped-styles';
        s.textContent = `
          /* ── Flex fixes ── */
          #jrpg-growth-class-panel .gw-panel-header,
          #jrpg-growth-class-panel .gw-milestone,
          #jrpg-growth-class-panel .gw-milestone-lv,
          #jrpg-growth-class-panel .gw-feat,
          #jrpg-growth-class-panel .gw-feat-body,
          #jrpg-growth-class-panel .gw-aug-opt,
          #jrpg-growth-buy-panel .gw-panel-header,
          #jrpg-growth-buy-panel .gw-tabs,
          #jrpg-growth-buy-panel .gw-item,
          #jrpg-growth-buy-panel .gw-item-buy,
          #jrpg-growth-buy-panel .gw-xp-cost { display: flex !important; }

          /* ── Panel headers ── */
          #jrpg-growth-class-panel .gw-panel-header,
          #jrpg-growth-buy-panel   .gw-panel-header {
            align-items: center; gap: 10px;
            padding: 10px 16px 8px; flex-shrink: 0;
            background: rgba(6,10,26,0.8);
            border-bottom: 1px solid rgba(50,80,160,0.2);
          }
          #jrpg-growth-class-panel .gw-panel-label,
          #jrpg-growth-buy-panel   .gw-panel-label {
            font-family: 'Cinzel',serif; font-size: 10px; letter-spacing: .16em;
            text-transform: uppercase; color: rgba(220,230,255,0.45);
            text-shadow: 0 0 8px rgba(160,185,255,0.15);
          }
          #jrpg-growth-class-panel .gw-panel-class {
            font-family: 'Cinzel',serif; font-size: 12px;
            color: rgba(230,245,240,0.8); letter-spacing: .06em;
            text-shadow: 0 0 8px rgba(140,220,190,0.2);
          }
          #jrpg-growth-buy-panel .gw-panel-xp {
            margin-left: auto; align-items: center; gap: 5px;
            font-family: 'Cinzel',serif; font-size: 11px;
            color: rgba(210,240,230,0.8);
            text-shadow: 0 0 8px rgba(120,210,175,0.2);
          }

          /* ── Milestone rows ── */
          #jrpg-growth-class-panel .gw-milestone {
            align-items: flex-start; gap: 0;
            padding: 5px 12px 5px 10px;
          }
          #jrpg-growth-class-panel .gw-milestone--locked { opacity: 0.35; }
          #jrpg-growth-class-panel .gw-milestone-lv {
            flex-direction: column; align-items: center;
            width: 38px; flex-shrink: 0; padding-top: 6px; padding-right: 8px;
          }
          #jrpg-growth-class-panel .gw-lv-num {
            font-family: 'Cinzel',serif; font-size: 10px; font-weight: 600;
            color: rgba(225,235,255,0.7); letter-spacing: .04em;
            background: rgba(30,50,120,0.25);
            border: 1px solid rgba(80,110,200,0.2);
            border-radius: 3px; padding: 3px 6px;
            line-height: 1; white-space: nowrap;
            text-shadow: 0 0 8px rgba(160,185,255,0.2);
          }
          #jrpg-growth-class-panel .gw-lv-line {
            flex: 1; width: 1px; min-height: 12px; margin-top: 6px;
            background: rgba(60,95,180,0.15);
          }
          #jrpg-growth-class-panel .gw-milestone-feats {
            flex: 1; min-width: 0; padding-bottom: 4px;
          }

          /* ── Feature cards ── */
          #jrpg-growth-class-panel .gw-feat {
            align-items: flex-start; gap: 8px;
            padding: 8px 12px 8px 10px; margin-bottom: 4px;
            border-radius: 0 5px 5px 0;
            border-left: 2px solid transparent;
            background: rgba(12,20,48,0.55);
          }
          #jrpg-growth-class-panel .gw-feat--owned {
            border-left-color: rgba(50,160,110,0.55);
            background: rgba(12,28,52,0.65);
          }
          #jrpg-growth-class-panel .gw-feat--available {
            border-left-color: #3db87a;
            background: rgba(8,34,20,0.7);
          }
          #jrpg-growth-class-panel .gw-feat--locked {
            border-left-color: rgba(50,70,130,0.18);
            background: rgba(8,12,30,0.3);
            opacity: 0.4;
          }
          #jrpg-growth-class-panel .gw-feat--milestone {
            border-left-color: rgba(60,120,240,0.5);
            background: rgba(14,28,72,0.5);
          }

          /* ── Feature pip ── */
          #jrpg-growth-class-panel .gw-feat-pip {
            flex-shrink: 0; font-size: 12px; line-height: 1.5;
            width: 16px; text-align: center; margin-top: 1px;
          }
          #jrpg-growth-class-panel .gw-pip--check { color: #3db87a; }
          #jrpg-growth-class-panel .gw-pip--new   { color: #3db87a; }
          #jrpg-growth-class-panel .gw-pip--lock  { color: rgba(60,80,140,0.35); }
          #jrpg-growth-class-panel .gw-pip--up    { color: rgba(80,140,255,0.65); }

          /* ── Feature body ── */
          #jrpg-growth-class-panel .gw-feat-body {
            flex-direction: column; flex: 1; min-width: 0; gap: 3px;
          }
          #jrpg-growth-class-panel .gw-feat-name {
            font-family: 'Cinzel',serif; font-size: 13px;
            color: #c8d8f4; letter-spacing: .04em; line-height: 1.3; display: block;
          }
          #jrpg-growth-class-panel .gw-feat--available .gw-feat-name { color: #7de0b2; }
          #jrpg-growth-class-panel .gw-feat--locked    .gw-feat-name { color: rgba(80,100,155,0.6); }
          #jrpg-growth-class-panel .gw-feat-sub {
            font-size: 10px; color: rgba(120,155,210,0.55);
            font-style: italic; line-height: 1.4; display: block;
          }

          /* ── Collect / Confirm buttons ── */
          #jrpg-growth-class-panel button.gw-btn {
            width: auto !important; height: auto !important;
            flex: none !important; min-height: 0 !important;
            line-height: 1 !important; display: inline-block !important;
            font-family: 'Cinzel',serif !important; font-size: 9px !important;
            letter-spacing: .12em !important; text-transform: uppercase !important;
            padding: 4px 12px !important; margin-top: 6px !important;
            border-radius: 3px !important;
            border: 1px solid rgba(50,155,110,0.4) !important;
            background: rgba(14,55,36,0.6) !important;
            color: #60c898 !important; cursor: pointer !important;
          }
          #jrpg-growth-class-panel button.gw-btn--confirm {
            border-color: rgba(55,100,200,0.4) !important;
            background: rgba(14,35,80,0.6) !important;
            color: #88aadf !important;
          }

          /* ── Buy panel tabs ── */
          #jrpg-growth-buy-panel .gw-tabs {
            border-bottom: 1px solid rgba(50,80,160,0.2); flex-shrink: 0;
          }
          #jrpg-growth-buy-panel button.gw-tab {
            width: auto !important; height: auto !important;
            flex: none !important; min-height: 0 !important;
            line-height: 1 !important; display: inline-block !important;
            border: none !important; border-bottom: 2px solid transparent !important;
            background: transparent !important; padding: 8px 14px !important;
            font-family: 'Cinzel',serif !important; font-size: 10px !important;
            letter-spacing: .14em !important; text-transform: uppercase !important;
            color: rgba(215,225,255,0.45) !important; cursor: pointer !important;
            margin-bottom: -1px !important;
          }
          #jrpg-growth-buy-panel button.gw-tab.gw-tab--active {
            color: rgba(150,195,255,0.95) !important;
            border-bottom-color: rgba(90,160,255,0.7) !important;
          }
          #jrpg-growth-buy-panel button.gw-tab:hover:not(.gw-tab--active) {
            color: rgba(130,175,255,0.65) !important;
          }

          /* ── Tab body show/hide — scoped to beat any cached stryder.css ── */
          #jrpg-growth-buy-panel .gw-tab-body {
            display: none !important; overflow-y: auto; flex: 1; padding: 8px 10px 14px;
          }
          #jrpg-growth-buy-panel .gw-tab-body.gw-tab-body--active {
            display: block !important;
          }

          /* ── Buy panel item rows ── */
          #jrpg-growth-buy-panel .gw-item {
            align-items: center; gap: 10px;
            padding: 8px 12px; margin-bottom: 3px;
            border-radius: 4px;
            background: rgba(8,14,38,0.6);
            border: 1px solid rgba(40,65,140,0.14);
          }
          #jrpg-growth-buy-panel .gw-item:hover {
            background: rgba(12,22,55,0.85);
            border-color: rgba(60,95,190,0.28);
          }
          #jrpg-growth-buy-panel .gw-item--owned {
            border-left: 2px solid rgba(50,160,110,0.45);
          }
          #jrpg-growth-buy-panel .gw-item-info { flex: 1; min-width: 0; }
          #jrpg-growth-buy-panel .gw-item-name {
            font-family: 'Cinzel',serif; font-size: 13px;
            color: #b8ccec; display: block;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          #jrpg-growth-buy-panel .gw-item-type {
            font-family: 'Cinzel',serif; font-size: 9px;
            letter-spacing: .08em; text-transform: capitalize;
            color: rgba(95,130,195,0.5);
          }
          #jrpg-growth-buy-panel .gw-item-buy { align-items: center; gap: 8px; flex-shrink: 0; }
          #jrpg-growth-buy-panel .gw-item-owned-mark { color: #3db87a; font-size: 13px; }
          #jrpg-growth-buy-panel .gw-xp-cost {
            align-items: center; gap: 4px;
            font-family: 'Cinzel',serif; font-size: 11px; color: #7de8b8;
          }
          #jrpg-growth-buy-panel .gw-xp-gem {
            display: inline-block; width: 8px; height: 8px;
            border-radius: 50%; background: #50c090; flex-shrink: 0;
          }
          #jrpg-growth-buy-panel .gw-xp-gem--2xp { background: #c09038; }
          #jrpg-growth-buy-panel button.gw-btn--buy {
            width: auto !important; height: auto !important;
            flex: none !important; min-height: 0 !important;
            line-height: 1 !important; display: inline-block !important;
            font-family: 'Cinzel',serif !important; font-size: 9px !important;
            letter-spacing: .12em !important; text-transform: uppercase !important;
            padding: 5px 14px !important; border-radius: 3px !important;
            border: 1px solid rgba(50,155,110,0.35) !important;
            background: rgba(14,55,36,0.55) !important;
            color: #68d8a8 !important; cursor: pointer !important;
          }
          #jrpg-growth-buy-panel button.gw-btn--buy:hover {
            background: rgba(20,75,50,0.8) !important;
            border-color: rgba(55,175,115,0.55) !important;
          }
          #jrpg-growth-buy-panel button.gw-btn--buy-disabled {
            opacity: 0.28 !important; cursor: not-allowed !important;
          }
          #jrpg-growth-buy-panel .gw-empty {
            font-family: 'Cinzel',serif; font-size: 11px;
            color: rgba(210,222,255,0.38); padding: 20px;
            text-align: center; letter-spacing: .1em;
          }

          /* ── Choice UI ── */
          #jrpg-growth-class-panel .gw-tech-choice { margin-top: 7px; }
          #jrpg-growth-class-panel .gw-tech-select {
            font-family: 'Cinzel',serif; font-size: 10px;
            background: rgb(6,14,38) !important; color: #88acd8 !important;
            border: 1px solid rgba(50,90,200,0.45); border-radius: 3px;
            padding: 4px 8px; width: 100%; margin-bottom: 5px;
            appearance: none; -webkit-appearance: none;
            cursor: pointer;
          }
          #jrpg-growth-class-panel .gw-tech-select option {
            background: rgb(6,14,38) !important; color: #a8c8f0 !important;
            font-family: 'Cinzel',serif;
          }
          #jrpg-growth-class-panel .gw-tech-select option:checked,
          #jrpg-growth-class-panel .gw-tech-select option:hover {
            background: rgb(20,50,120) !important; color: #d0e8ff !important;
          }
          #jrpg-growth-class-panel .gw-aug-opt {
            align-items: flex-start; gap: 8px;
            padding: 4px 6px; border-radius: 2px; cursor: pointer; margin-bottom: 2px;
          }
          #jrpg-growth-class-panel .gw-aug-dot {
            width: 8px; height: 8px; border-radius: 50%;
            border: 1px solid rgba(70,110,190,0.5); flex-shrink: 0; margin-top: 3px;
          }
          #jrpg-growth-class-panel .gw-aug-dot.selected { background: #4888d0; border-color: #4888d0; }
          #jrpg-growth-class-panel .gw-aug-text {
            font-size: 10px; color: rgba(150,185,240,0.72); line-height: 1.45;
          }

          /* ── Lordly Aspect picker ── */
          #jrpg-growth-class-panel .gw-lordly-tabs {
            display: flex; gap: 3px; margin: 6px 0 4px;
          }
          #jrpg-growth-class-panel .gw-lordly-tab {
            flex: 1; padding: 4px 0; font-family: 'Cinzel',serif; font-size: 9px;
            letter-spacing: .08em; text-transform: uppercase; text-align: center;
            background: rgba(14,22,55,0.7); border: 1px solid rgba(50,80,180,0.25);
            border-radius: 3px; color: rgba(130,165,225,0.55); cursor: pointer;
          }
          #jrpg-growth-class-panel .gw-lordly-tab.active {
            background: rgba(25,45,110,0.85); border-color: rgba(80,130,240,0.45);
            color: #88b8f0;
          }
          #jrpg-growth-class-panel .gw-lordly-tab-body { display: none; }
          #jrpg-growth-class-panel .gw-lordly-tab-body.active { display: block; }
          #jrpg-growth-class-panel .gw-lordly-opt {
            display: flex; align-items: center; gap: 6px;
            padding: 3px 6px; border-radius: 2px; cursor: pointer; margin-bottom: 1px;
          }
          #jrpg-growth-class-panel .gw-lordly-opt:hover {
            background: rgba(35,65,150,0.3);
          }
          #jrpg-growth-class-panel .gw-lordly-opt input[type=radio] { flex-shrink: 0; }
          #jrpg-growth-class-panel .gw-lordly-opt-name {
            font-size: 10px; color: rgba(175,210,255,0.8); flex: 1;
          }
          #jrpg-growth-class-panel .gw-lordly-opt-tag {
            font-size: 9px; color: rgba(110,150,210,0.5); letter-spacing: .04em;
          }
          #jrpg-growth-class-panel .gw-lordly-slot { margin-bottom: 6px; padding: 5px 6px; background: rgba(10,16,42,0.6); border-radius: 3px; }
          #jrpg-growth-class-panel .gw-lordly-slot-label { font-size: 9px; color: rgba(100,140,210,0.5); letter-spacing: .08em; margin-bottom: 3px; }

          /* ── Aspect groups ── */
          #jrpg-growth-buy-panel .gw-aspect-group {
            margin-bottom: 3px;
            border: 1px solid rgba(45,70,150,0.2);
            border-radius: 4px;
            overflow: hidden;
          }
          #jrpg-growth-buy-panel .gw-aspect-header {
            display: flex !important; align-items: center; gap: 8px;
            padding: 7px 12px;
            background: rgba(18,28,65,0.75);
            border-bottom: 1px solid rgba(45,70,150,0.2);
          }
          #jrpg-growth-buy-panel .gw-aspect-name {
            font-family: 'Cinzel',serif; font-size: 11px; letter-spacing: .06em;
            color: #c0d4f0; flex: 1;
          }
          #jrpg-growth-buy-panel .gw-aspect-tag {
            font-family: 'Cinzel',serif; font-size: 7px; letter-spacing: .14em;
            text-transform: uppercase; padding: 2px 6px; border-radius: 2px;
          }
          #jrpg-growth-buy-panel .gw-aspect-tag--mortal {
            background: rgba(180,80,50,0.2); color: rgba(230,140,110,0.8);
            border: 1px solid rgba(180,80,50,0.3);
          }
          #jrpg-growth-buy-panel .gw-aspect-tag--immortal {
            background: rgba(80,50,200,0.2); color: rgba(160,140,255,0.8);
            border: 1px solid rgba(80,50,200,0.3);
          }
          #jrpg-growth-buy-panel .gw-aspect-unlocked {
            font-family: 'Cinzel',serif; font-size: 8px;
            color: rgba(60,190,120,0.7); letter-spacing: .06em;
          }
          #jrpg-growth-buy-panel .gw-aspect-items { padding: 4px 6px 6px; }
          #jrpg-growth-buy-panel .gw-core-badge {
            font-family: 'Cinzel',serif; font-size: 7px; letter-spacing: .1em;
            background: rgba(60,120,200,0.25); color: rgba(120,180,255,0.8);
            border: 1px solid rgba(60,120,200,0.35); border-radius: 2px;
            padding: 1px 5px; vertical-align: middle; margin-left: 5px;
          }
          #jrpg-growth-buy-panel .gw-item--locked {
            opacity: 0.38; cursor: not-allowed;
          }
          #jrpg-growth-buy-panel .gw-item-locked-mark {
            font-size: 11px; flex-shrink: 0;
          }
        `;
        document.head.appendChild(s);
      }

      const actor     = this.actor;
      const className = actor.system.class?.name ?? '';
      const level     = actor.system.attributes?.level?.value ?? 1;
      const xp        = actor.system.attributes?.xp?.value ?? 0;
      const ownedNames = new Set(actor.items.map(i => i.name));

      // ── Fetch compendium packs ──────────────────────────────────────────────
      // Auto-grant class features: non-choice features at or below current level
      // are granted automatically — no manual collect needed.
      const cfPack     = game.packs.get('stryder.stryder-class-features');
      const techPack   = game.packs.get('stryder.stryder-techniques');
      const aspectPack = game.packs.get('stryder.stryder-actions');
      const [cfDocs, techDocs, aspectDocs] = await Promise.all([
        cfPack     ? cfPack.getDocuments()     : [],
        techPack   ? techPack.getDocuments()   : [],
        aspectPack ? aspectPack.getDocuments() : [],
      ]);

      // Build folder map: id → { name, parentId }
      const aspectFolderMap = {};
      if (aspectPack) {
        (aspectPack.folders?.contents ?? []).forEach(f => {
          aspectFolderMap[f.id] = { name: f.name, parentId: typeof f.folder === 'string' ? f.folder : f.folder?.id ?? null };
        });
      }

      // Group aspect items by their Aspect folder (skip top-level Mortal/Immortal containers)
      const PARENT_FOLDERS = new Set(['MrtalAspFolder01', 'ImmrtAspFolder01', 'SprBstAbilFolder']);
      const aspectGroups = {}; // folderId → { name, tag, items[] }
      aspectDocs.forEach(item => {
        const folderId = typeof item.folder === 'string' ? item.folder : item.folder?.id ?? null;
        if (!folderId) return;
        const folderInfo = aspectFolderMap[folderId];
        if (!folderInfo) return;
        if (PARENT_FOLDERS.has(folderId)) return;
        if (!aspectGroups[folderId]) {
          const parentId = folderInfo.parentId;
          const tag = parentId === 'ImmrtAspFolder01' ? 'Immortal' : 'Mortal';
          aspectGroups[folderId] = { name: folderInfo.name, tag, items: [] };
        }
        aspectGroups[folderId].items.push(item);
      });
      // Sort items within each group by sort value; index 0 = Core
      Object.values(aspectGroups).forEach(g => g.items.sort((a,b) => (a.sort ?? 0) - (b.sort ?? 0)));
      // Sort groups: Mortal first, then Immortal, both alphabetically
      const sortedGroups = Object.values(aspectGroups).sort((a,b) => {
        if (a.tag !== b.tag) return a.tag === 'Mortal' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      const cfById   = Object.fromEntries(cfDocs.map(d => [d._id, d]));
      const cfByName = Object.fromEntries(cfDocs.map(d => [d.name, d]));
      // Ranger Techniques — identified by known IDs, folder name, or explicit flag.
      // Checking folder?.name alone is unreliable for compendium docs in v13 (folder may be a string ID).
      const RANGER_TECH_IDS = new Set([
        'RngrAbil01BckStp','RngrAbil02BhmHnt','RngrAbil03GdgStr','RngrAbil04LgtSrf',
        'RngrAbil05PrcFrm','RngrAbil06StlBrt','RngrAbil07TrlSht','RngrAbil08Vault0',
      ]);
      const rangerTechs = cfDocs.filter(d =>
        RANGER_TECH_IDS.has(d._id) ||
        d.folder?.name === 'Ranger Techniques' ||
        d.flags?.stryder?.isRangerTech
      ).sort((a, b) => a.name.localeCompare(b.name));

      // ── Retroactive migration: stamp aspectName on items bought before this feature ──
      // Runs every load but is a no-op once all items are stamped.
      {
        const stampUpdates = [];
        for (const group of sortedGroups) {
          const knownNames = new Set(group.items.map(i => i.name));
          for (const actorItem of actor.items) {
            if (actorItem.type === 'action'
                && !actorItem.flags?.stryder?.aspectName
                && !actorItem.flags?.stryder?.isTechnique
                && actorItem.flags?.stryder?.xpCost === undefined
                && knownNames.has(actorItem.name)) {
              stampUpdates.push(actorItem.update({ 'flags.stryder.aspectName': group.name }));
            }
          }
        }
        if (stampUpdates.length) await Promise.all(stampUpdates);
      }

      // ── Ranger rework migration: remove retired class features ──
      // Slayer's Strike I/II and Tyrant Hunter were replaced by Behemoth Slayer I/II
      // and Tyrant Executioner. Safe to run every load — no-op once cleaned.
      if (className === 'Ranger') {
        const RETIRED_RANGER_FEATURES = new Set(["Slayer's Strike I", "Slayer's Strike II", 'Tyrant Hunter']);
        const staleIds = actor.items.filter(i => RETIRED_RANGER_FEATURES.has(i.name)).map(i => i.id);
        if (staleIds.length) {
          await actor.deleteEmbeddedDocuments('Item', staleIds);
          ui.notifications.info(`${actor.name}: removed retired Ranger features (class rework).`);
        }
      }

      // Auto-grant non-choice class features at or below the actor's current level.
      await this._grantClassFeatures(actor);
      // Refresh ownedNames so the CLASS PATH PANEL below reflects any new grants.
      actor.items.forEach(i => ownedNames.add(i.name));

      // ── CLASS PATH PANEL ────────────────────────────────────────────────────
      const classMilestones = STRYDER_CLASS_FEATURES[className] ?? [];

      const featHTML = (feat, milestoneLevel) => {
        // Tech choice (Ranger)
        if (feat.isTechChoice) {
          const flagKey    = `techChoice_lv${milestoneLevel}`;
          const chosenName = actor.getFlag('stryder', flagKey);
          if (chosenName) return `
            <div class="gw-feat gw-feat--owned">
              <span class="gw-feat-pip gw-pip--check">✦</span>
              <div class="gw-feat-body"><span class="gw-feat-name">${chosenName}</span><span class="gw-feat-sub">Ranger Technique</span></div>
            </div>`;
          if (level >= milestoneLevel) {
            const opts = rangerTechs.map(t => `<option value="${t._id}">${t.name}</option>`).join('');
            return `
              <div class="gw-feat gw-feat--available">
                <span class="gw-feat-pip gw-pip--new">◈</span>
                <div class="gw-feat-body">
                  <span class="gw-feat-name">Choose a Ranger Technique</span>
                  <div class="gw-tech-choice">
                    <select class="gw-tech-select" data-flag-key="${flagKey}">
                      <option value="">— Pick a Technique —</option>${opts}
                    </select>
                    <button class="gw-btn gw-btn--confirm" data-flag-key="${flagKey}">Confirm</button>
                  </div>
                </div>
              </div>`;
          }
          return `<div class="gw-feat gw-feat--locked"><span class="gw-feat-pip gw-pip--lock">○</span><div class="gw-feat-body"><span class="gw-feat-name">Ranger Technique</span></div></div>`;
        }

        // Augmentation choice (Warrior and future classes)
        if (feat.isChoice) {
          const flagKey   = `augChoice_${feat.id}`;
          const chosen    = actor.getFlag('stryder', flagKey); // integer index or undefined
          const isOwned   = chosen !== undefined && chosen !== null;
          const avail     = level >= milestoneLevel;
          const cls       = isOwned ? 'gw-feat--owned' : avail ? 'gw-feat--available' : 'gw-feat--locked';
          const pip       = isOwned ? '<span class="gw-feat-pip gw-pip--check">✦</span>'
                          : avail   ? '<span class="gw-feat-pip gw-pip--new">◈</span>'
                                    : '<span class="gw-feat-pip gw-pip--lock">○</span>';

          // Try hardcoded options first, fall back to compendium description parsing
          const hardcodedOpts = CLASS_AUG_OPTIONS[feat.id];
          let inner = '';

          if (isOwned) {
            // Show which option was chosen
            const chosenLabel = hardcodedOpts?.[chosen]?.label ?? `Option ${chosen + 1}`;
            inner = `<span class="gw-feat-sub gw-aug-chosen">&#x2756; ${chosenLabel}</span>`;
          } else if (avail) {
            if (hardcodedOpts) {
              // Render from hardcoded data
              const opts = hardcodedOpts.map((o, i) =>
                `<div class="gw-aug-opt" data-opt="${i}">
                  <span class="gw-aug-dot"></span>
                  <span class="gw-aug-text">
                    <strong>${o.label}</strong>
                    ${o.sublabel ? `<em class="gw-aug-sub">${o.sublabel}</em>` : ''}
                  </span>
                </div>`
              ).join('');
              inner = `<div class="gw-aug-choices" data-flag-key="${flagKey}" data-feat-id="${feat.id}">${opts}<button class="gw-btn gw-btn--confirm" data-feat-id="${feat.id}" data-flag-key="${flagKey}">Confirm Augment</button></div>`;
            } else {
              // Fallback: parse <li> from compendium item description
              const doc  = (feat.id ? cfById[feat.id] : null) ?? cfByName[feat.name] ?? null;
              const desc = doc?.system?.description ?? '';
              const opts = [...desc.matchAll(/<li>(.*?)<\/li>/gs)].map((m, i) =>
                `<div class="gw-aug-opt" data-opt="${i}"><span class="gw-aug-dot"></span><span class="gw-aug-text">${m[1].replace(/<[^>]+>/g,'')}</span></div>`
              ).join('');
              if (opts) inner = `<div class="gw-aug-choices" data-flag-key="${flagKey}" data-feat-id="${feat.id}">${opts}<button class="gw-btn gw-btn--confirm" data-feat-id="${feat.id}" data-flag-key="${flagKey}">Confirm Augment</button></div>`;
            }
          }

          return `<div class="gw-feat ${cls}">${pip}<div class="gw-feat-body"><span class="gw-feat-name">${stripClassPrefix(feat.name)}</span>${inner}</div></div>`;
        }

        // ── Lordly Aspect Feature picker (Shaman) ──────────────────────────
        if (feat.isLordlyChoice) {
          const linkedLordling = game.actors.find(a => a.type === 'lordling' && a.system.linkedCharacterId === actor.id);
          if (!linkedLordling) {
            return `<div class="gw-feat gw-feat--locked">
              <span class="gw-feat-pip gw-pip--lock">○</span>
              <div class="gw-feat-body">
                <span class="gw-feat-name">${feat.name}</span>
                <span class="gw-feat-sub" style="color:rgba(200,120,80,0.7);">⚠ No Lordling linked — select Shaman on the Character page first</span>
              </div>
            </div>`;
          }
          const avail = level >= milestoneLevel;
          let html = `<div class="gw-feat ${avail ? 'gw-feat--available' : 'gw-feat--locked'}">
            <span class="gw-feat-pip ${avail ? 'gw-pip--new' : 'gw-pip--lock'}">${avail ? '◈' : '○'}</span>
            <div class="gw-feat-body"><span class="gw-feat-name">${feat.name}</span>`;
          if (avail) {
            for (let i = 0; i < feat.count; i++) {
              const slotIdx = feat.startIdx + i;
              const flagKey = `lordlyFeature_${slotIdx}`;
              const chosenName = actor.getFlag('stryder', flagKey);
              if (chosenName) {
                html += `<div class="gw-feat gw-feat--owned" style="margin:3px 0;">
                  <span class="gw-feat-pip gw-pip--check" style="font-size:9px;">✦</span>
                  <div class="gw-feat-body"><span class="gw-feat-name" style="font-size:10px;">${chosenName}</span><span class="gw-feat-sub">Lordly Feature</span></div>
                </div>`;
              } else {
                // Build tabbed picker for this slot
                const uid = `laf-${slotIdx}`;
                let tabHTML = `<div class="gw-lordly-slot" data-slot="${slotIdx}">
                  <div class="gw-lordly-slot-label">Pick ${i + 1}</div>
                  <div class="gw-lordly-tabs">
                    <button type="button" class="gw-lordly-tab active" data-tab="Wild" data-uid="${uid}">Wild</button>
                    <button type="button" class="gw-lordly-tab" data-tab="Royal" data-uid="${uid}">Royal</button>
                    <button type="button" class="gw-lordly-tab" data-tab="Spirit" data-uid="${uid}">Spirit</button>
                  </div>`;
                for (const [cat, feats] of Object.entries(LORDLY_ASPECT_FEATURES)) {
                  const isFirst = cat === 'Wild';
                  tabHTML += `<div class="gw-lordly-tab-body${isFirst ? ' active' : ''}" data-uid="${uid}" data-cat="${cat}">`;
                  for (const lf of feats) {
                    const alreadyChosen = [...Array(8).keys()].some(s => actor.getFlag('stryder', `lordlyFeature_${s}`) === lf.name);
                    tabHTML += `<label class="gw-lordly-opt">
                      <input type="radio" name="lordly-pick-${slotIdx}" value="${lf.id}" ${alreadyChosen ? 'disabled' : ''}>
                      <span class="gw-lordly-opt-name">${lf.name}</span>
                      <span class="gw-lordly-opt-tag">${lf.tag}</span>
                    </label>`;
                  }
                  tabHTML += `</div>`;
                }
                tabHTML += `<button class="gw-btn gw-btn--confirm" data-lordly-slot="${slotIdx}" style="margin-top:4px;">Confirm</button></div>`;
                html += tabHTML;
              }
            }
          }
          html += `</div></div>`;
          return html;
        }

        // ── Mystic Blessings (Shaman Lv4) ──────────────────────────────────
        if (feat.isMysticBlessing) {
          const avail   = level >= milestoneLevel;
          const senseKey = actor.getFlag('stryder', 'mysticBlessingsSense');
          if (senseKey) {
            return `<div class="gw-feat gw-feat--owned">
              <span class="gw-feat-pip gw-pip--check">✦</span>
              <div class="gw-feat-body">
                <span class="gw-feat-name">Mystic Blessings</span>
                <span class="gw-feat-sub">Movement +2 · ${senseKey} Sense +2</span>
              </div>
            </div>`;
          }
          if (!avail) return `<div class="gw-feat gw-feat--locked"><span class="gw-feat-pip gw-pip--lock">○</span><div class="gw-feat-body"><span class="gw-feat-name">Mystic Blessings</span></div></div>`;
          const senses = ['Arcane','Hearing','Sight','Smell','Touch'];
          const senseOpts = senses.map(s => `<option value="${s}">${s}</option>`).join('');
          return `<div class="gw-feat gw-feat--available">
            <span class="gw-feat-pip gw-pip--new">◈</span>
            <div class="gw-feat-body">
              <span class="gw-feat-name">Mystic Blessings</span>
              <span class="gw-feat-sub">+2 Movement (auto) · choose +2 Sense</span>
              <div class="gw-tech-choice" style="margin-top:5px;">
                <select class="gw-tech-select" id="mystic-sense-pick">
                  <option value="">— Choose Sense —</option>${senseOpts}
                </select>
                <button class="gw-btn gw-btn--confirm" data-action="mysticBlessings">Confirm</button>
              </div>
            </div>
          </div>`;
        }

        // ── Memories of Past Lives (Shaman Lv8) ────────────────────────────
        if (feat.isMasteryGrant) {
          const avail   = level >= milestoneLevel;
          const claimed = actor.getFlag('stryder', 'memoriesOfPastLivesClaimed') ?? false;
          if (claimed) return `<div class="gw-feat gw-feat--owned">
            <span class="gw-feat-pip gw-pip--check">✦</span>
            <div class="gw-feat-body"><span class="gw-feat-name">Memories of Past Lives</span><span class="gw-feat-sub">+${feat.masteryAmount} Mastery Points granted</span></div>
          </div>`;
          if (!avail) return `<div class="gw-feat gw-feat--locked"><span class="gw-feat-pip gw-pip--lock">○</span><div class="gw-feat-body"><span class="gw-feat-name">Memories of Past Lives</span></div></div>`;
          return `<div class="gw-feat gw-feat--available">
            <span class="gw-feat-pip gw-pip--new">◈</span>
            <div class="gw-feat-body">
              <span class="gw-feat-name">Memories of Past Lives</span>
              <span class="gw-feat-sub">Claim +${feat.masteryAmount} Mastery Points</span>
              <button class="gw-btn gw-btn--confirm" data-action="memoriesOfPastLives" data-mastery="${feat.masteryAmount}" style="margin-top:5px;">Claim</button>
            </div>
          </div>`;
        }

        // Milestone (passive upgrade marker)
        if (feat.milestone) {
          const active = level >= milestoneLevel;
          // Show the right subtitle for Shaman Bond milestones vs generic
          const bondMilestone = feat.name.includes('Bond') || feat.name.includes('Unbreakable');
          const sub = bondMilestone ? 'Bond range +2 · Tactic Points +1' : 'Passive upgrade';
          return `<div class="gw-feat ${active ? 'gw-feat--milestone' : 'gw-feat--locked'}">
            <span class="gw-feat-pip ${active ? 'gw-pip--up' : 'gw-pip--lock'}">${active ? '↑' : '○'}</span>
            <div class="gw-feat-body"><span class="gw-feat-name">${stripClassPrefix(feat.name)}</span><span class="gw-feat-sub">${sub}</span></div>
          </div>`;
        }

        // Standard feature — class path features are automatically granted at level.
        const doc       = (feat.id ? cfById[feat.id] : null) ?? cfByName[feat.name] ?? null;
        const granted   = level >= milestoneLevel;
        const cls       = granted ? 'gw-feat--owned' : 'gw-feat--locked';
        const pip       = granted
          ? '<span class="gw-feat-pip gw-pip--check">&#x2756;</span>'
          : '<span class="gw-feat-pip gw-pip--lock">&#x25CB;</span>';
        const shortDesc = doc?.system?.description
          ? doc.system.description.replace(/<[^>]+>/g,'').trim().slice(0, 72) + '...'
          : '';
        return `<div class="gw-feat ${cls}">
          ${pip}
          <div class="gw-feat-body">
            <span class="gw-feat-name">${stripClassPrefix(feat.name)}</span>
            ${shortDesc ? `<span class="gw-feat-sub">${shortDesc}</span>` : ''}
          </div>
        </div>`;
      };

      // Strip class name prefix from displayed feature names (e.g. "Warrior Augmentations I" → "Augmentations I")
      const stripClassPrefix = (name) =>
        className && name.startsWith(className + ' ') ? name.slice(className.length + 1) : name;

      let classHTML = `<div class="gw-panel-header"><span class="gw-panel-label">Class Path</span></div>`;

      if (!classMilestones.length) {
        classHTML += `<div class="gw-empty">No class path data for <em>${className || 'this class'}</em>.</div>`;
      } else {
        for (const ms of classMilestones) {
          const unlocked = level >= ms.level;
          classHTML += `
            <div class="gw-milestone ${unlocked ? 'gw-milestone--unlocked' : 'gw-milestone--locked'}">
              <div class="gw-milestone-lv">
                <span class="gw-lv-num">${ms.level}</span>
                <span class="gw-lv-line"></span>
              </div>
              <div class="gw-milestone-feats">
                ${ms.feats.map(f => featHTML(f, ms.level)).join('')}
              </div>
            </div>`;
        }
      }
      classPanel.innerHTML = `<div class="gw-scroll">${classHTML}</div>`;

      // ── PURCHASE PANEL ──────────────────────────────────────────────────────
      const itemRow = (item) => {
        const owned    = ownedNames.has(item.name);
        const type     = item.system?.action_type ?? '';
        const xpCost   = item.flags?.stryder?.xpCost ?? 1;
        const canAfford = (actor.system.attributes.xp?.value ?? 0) >= xpCost;
        const gemClass = xpCost > 1 ? 'gw-xp-gem gw-xp-gem--2xp' : 'gw-xp-gem';
        return `
          <div class="gw-item ${owned ? 'gw-item--owned' : ''}">
            <div class="gw-item-info">
              <span class="gw-item-name">${item.name}</span>
              <span class="gw-item-type">${type}</span>
            </div>
            ${owned
              ? '<span class="gw-item-owned-mark">✦</span>'
              : `<div class="gw-item-buy">
                   <span class="gw-xp-cost"><span class="${gemClass}"></span>${xpCost}</span>
                   <button class="gw-btn gw-btn--buy${!canAfford ? ' gw-btn--buy-disabled' : ''}"
                     data-item-uuid="${item.uuid}"
                     data-item-name="${item.name}"
                     data-xp-cost="${xpCost}"
                     data-is-technique="true"
                     ${!canAfford ? 'disabled' : ''}>Buy</button>
                 </div>`}
          </div>`;
      };

      // ── BUILD ASPECT ROWS ─────────────────────────────────────────────────
      // Core Skillset = all items up to and including "Attached Bonus" or "Attached Effect".
      // These are purchased together as one bundle for 1 XP.
      // For aspects with no Attached Bonus/Effect (e.g. Discipline) use the first 2 items.
      const CORE_END_NAMES = new Set(['Attached Bonus', 'Attached Effect']);
      const splitAspect = (items) => {
        const idx = items.findIndex(i => CORE_END_NAMES.has(i.name));
        const coreCount = idx === -1 ? Math.min(2, items.length) : idx + 1;
        return { coreItems: items.slice(0, coreCount), abilityItems: items.slice(coreCount) };
      };

      const aspectTabHTML = sortedGroups.map(group => {
        const { coreItems, abilityItems } = splitAspect(group.items);
        // Core is owned if the first core item is owned (they're always granted together)
        const coreOwned   = coreItems.length > 0 && ownedNames.has(coreItems[0].name);
        const canAffordCore = xp >= 1;

        // ── Core Skillset row ──
        const coreNames = coreItems.map(i => i.name).join(' · ');
        const coreUuids = coreItems.map(i => i.uuid).join(',');
        let coreSection = '';
        if (coreOwned) {
          coreSection = `
            <div class="gw-item gw-item--owned">
              <div class="gw-item-info">
                <span class="gw-item-name">Core Skillset <span class="gw-core-badge">CORE</span></span>
                <span class="gw-item-type">${coreNames}</span>
              </div>
              <span class="gw-item-owned-mark">&#x2756;</span>
            </div>`;
        } else {
          coreSection = `
            <div class="gw-item">
              <div class="gw-item-info">
                <span class="gw-item-name">Core Skillset <span class="gw-core-badge">CORE</span></span>
                <span class="gw-item-type">${coreNames}</span>
              </div>
              <div class="gw-item-buy">
                <span class="gw-xp-cost"><span class="gw-xp-gem"></span>1</span>
                <button class="gw-btn--buy gw-btn--core-buy${!canAffordCore ? ' gw-btn--buy-disabled' : ''}"
                  data-core-uuids="${coreUuids}"
                  data-aspect-name="${group.name}"
                  data-xp-cost="1"
                  ${!canAffordCore ? 'disabled' : ''}>Buy</button>
              </div>
            </div>`;
        }

        // ── Individual ability rows ──
        // Abilities are hidden until Core Skillset is purchased to reduce clutter.
        // Exception: show any ability the character already owns (e.g. from an older grant).
        const visibleAbilityItems = abilityItems.filter(item =>
          coreOwned || ownedNames.has(item.name)
        );
        const hiddenCount = abilityItems.length - visibleAbilityItems.length;

        const abilityRows = visibleAbilityItems.map(item => {
          const owned     = ownedNames.has(item.name);
          const canAfford = xp >= 1;
          const type      = item.system?.action_type ?? '';
          return `<div class="gw-item ${owned ? 'gw-item--owned' : ''}">
            <div class="gw-item-info">
              <span class="gw-item-name">${item.name}</span>
              <span class="gw-item-type">${type}</span>
            </div>
            ${owned
              ? '<span class="gw-item-owned-mark">&#x2756;</span>'
              : `<div class="gw-item-buy">
                   <span class="gw-xp-cost"><span class="gw-xp-gem"></span>1</span>
                   <button class="gw-btn--buy${!canAfford ? ' gw-btn--buy-disabled' : ''}"
                     data-item-uuid="${item.uuid}"
                     data-item-name="${item.name}"
                     data-aspect-name="${group.name}"
                     data-xp-cost="1"
                     ${!canAfford ? 'disabled' : ''}>Buy</button>
                 </div>`
            }
          </div>`;
        }).join('');

        // Show a subtle hint when abilities are hidden behind Core Skillset
        const lockedHint = (!coreOwned && hiddenCount > 0)
          ? `<div class="gw-locked-hint">${hiddenCount} ${hiddenCount === 1 ? 'ability' : 'abilities'} — purchase Core Skillset to unlock</div>`
          : '';

        return `<div class="gw-aspect-group">
          <div class="gw-aspect-header">
            <span class="gw-aspect-name">${group.name}</span>
            <span class="gw-aspect-tag gw-aspect-tag--${group.tag.toLowerCase()}">${group.tag}</span>
            ${coreOwned ? '<span class="gw-aspect-unlocked">&#x2756; Unlocked</span>' : ''}
          </div>
          <div class="gw-aspect-items">${coreSection}${abilityRows}${lockedHint}</div>
        </div>`;
      }).join('') || '<div class="gw-empty">No aspects found in compendium.</div>';

      // ── TECH ROWS ─────────────────────────────────────────────────────────
      const techTabHTML = techDocs.length
        ? techDocs.sort((a,b) => a.name.localeCompare(b.name)).map(i => itemRow(i)).join('')
        : '<div class="gw-empty">No techniques found &#8212; rebuild the stryder-techniques pack.</div>';

      // ── BUY PANEL ─────────────────────────────────────────────────────────
      buyPanel.innerHTML = `
        <div class="gw-panel-header">
          <span class="gw-panel-label">Purchase</span>
        </div>
        <div class="gw-tabs">
          <button class="gw-tab gw-tab--active" data-gtab="aspects">Aspects</button>
          <button class="gw-tab" data-gtab="techniques">Techniques</button>
        </div>
        <div class="gw-tab-body gw-tab-body--active" id="gtab-aspects">${aspectTabHTML}</div>
        <div class="gw-tab-body" id="gtab-techniques">${techTabHTML}</div>`;

      // Wire tabs — look up panel fresh on each click to avoid stale closure references
      buyPanel.querySelectorAll('.gw-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          const panel = document.getElementById('jrpg-growth-buy-panel');
          if (!panel) return;
          panel.querySelectorAll('.gw-tab').forEach(b => b.classList.remove('gw-tab--active'));
          panel.querySelectorAll('.gw-tab-body').forEach(c => c.classList.remove('gw-tab-body--active'));
          btn.classList.add('gw-tab--active');
          const target = panel.querySelector(`#gtab-${btn.dataset.gtab}`);
          if (target) target.classList.add('gw-tab-body--active');
        });
      });

      // Wire individual ability buy buttons
      buyPanel.querySelectorAll('.gw-btn--buy:not(.gw-btn--core-buy)').forEach(btn => {
        btn.addEventListener('click', async () => {
          const xpCost = parseInt(btn.dataset.xpCost ?? '1');
          const cur    = actor.system.attributes.xp?.value ?? 0;
          if (cur < xpCost) {
            ui.notifications.warn(`Not enough Experience Points (need ${xpCost}, have ${cur}).`);
            return;
          }
          const doc = await fromUuid(btn.dataset.itemUuid);
          if (!doc) return;
          const itemData = doc.toObject();
          // Tag technique purchases so they appear in the Techniques section of the Battle tab
          if (btn.dataset.isTechnique === 'true') {
            foundry.utils.setProperty(itemData, 'flags.stryder.isTechnique', true);
          } else if (btn.dataset.aspectName) {
            foundry.utils.setProperty(itemData, 'flags.stryder.aspectName', btn.dataset.aspectName);
          }
          await actor.createEmbeddedDocuments('Item', [itemData]);
          await actor.update({ 'system.attributes.xp.value': cur - xpCost });
        });
      });

      // Wire Core Skillset buy buttons — grants all core items at once for 1 XP
      buyPanel.querySelectorAll('.gw-btn--core-buy').forEach(btn => {
        btn.addEventListener('click', async () => {
          const xpCost    = parseInt(btn.dataset.xpCost ?? '1');
          const aspectName = btn.dataset.aspectName ?? null;
          const cur       = actor.system.attributes.xp?.value ?? 0;
          if (cur < xpCost) {
            ui.notifications.warn(`Not enough Experience Points (need ${xpCost}, have ${cur}).`);
            return;
          }
          const uuids = (btn.dataset.coreUuids ?? '').split(',').filter(Boolean);
          const docs  = await Promise.all(uuids.map(u => fromUuid(u)));
          const valid = docs.filter(Boolean);
          if (!valid.length) return;
          // Stamp each core item with the aspect name for battle-tab routing
          const itemsData = valid.map(d => {
            const data = d.toObject();
            if (aspectName) foundry.utils.setProperty(data, 'flags.stryder.aspectName', aspectName);
            return data;
          });
          await actor.createEmbeddedDocuments('Item', itemsData);
          await actor.update({ 'system.attributes.xp.value': cur - xpCost });
        });
      });

      // Wire collect buttons
      classPanel.querySelectorAll('.gw-btn--collect').forEach(btn => {
        btn.addEventListener('click', async () => {
          const doc = cfById[btn.dataset.featId];
          if (!doc) return;
          await actor.createEmbeddedDocuments('Item', [doc.toObject()]);
          ui.notifications.info(`${btn.dataset.featName} added to your sheet.`);
        });
      });

      // Wire ranger tech confirm
      classPanel.querySelectorAll('.gw-btn--confirm[data-flag-key]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const block  = btn.closest('.gw-feat--available');
          const select = block?.querySelector('.gw-tech-select');
          if (!select?.value) { ui.notifications.warn('Select a Technique first.'); return; }
          const doc = cfById[select.value];
          if (!doc) return;
          // Tag as a class feature so it routes to the Class Features section on the battle tab
          const itemData = doc.toObject();
          foundry.utils.setProperty(itemData, 'flags.stryder.isClassFeature', true);
          await actor.setFlag('stryder', btn.dataset.flagKey, doc.name);
          await actor.createEmbeddedDocuments('Item', [itemData]);
          ui.notifications.info(`${doc.name} added to your sheet.`);
        });
      });

      // ── Lordly Aspect tab switching ─────────────────────────────────────────
      classPanel.querySelectorAll('.gw-lordly-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const uid = tab.dataset.uid;
          const cat = tab.dataset.tab;
          classPanel.querySelectorAll(`.gw-lordly-tab[data-uid="${uid}"]`).forEach(t => t.classList.remove('active'));
          classPanel.querySelectorAll(`.gw-lordly-tab-body[data-uid="${uid}"]`).forEach(b => b.classList.remove('active'));
          tab.classList.add('active');
          classPanel.querySelector(`.gw-lordly-tab-body[data-uid="${uid}"][data-cat="${cat}"]`)?.classList.add('active');
        });
      });

      // ── Lordly Aspect confirm ───────────────────────────────────────────────
      classPanel.querySelectorAll('.gw-btn--confirm[data-lordly-slot]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const linkedLordling = game.actors.find(a => a.type === 'lordling' && a.system.linkedCharacterId === actor.id);
          if (!linkedLordling) {
            ui.notifications.warn('No Lordling linked. Go to the Character page, select Shaman as your class, and link or create a Lordling first.');
            return;
          }
          const slotIdx = parseInt(btn.dataset.lordlySlot);
          const slotBlock = btn.closest('.gw-lordly-slot');
          const checked = slotBlock?.querySelector(`input[name="lordly-pick-${slotIdx}"]:checked`);
          if (!checked?.value) { ui.notifications.warn('Select a Lordly Aspect Feature first.'); return; }
          const selectedId = checked.value;
          const selectedLaf = Object.values(LORDLY_ASPECT_FEATURES).flat().find(f => f.id === selectedId);
          const doc = cfById[selectedId] ?? (selectedLaf ? cfByName[selectedLaf.name] : null);
          if (!doc) { ui.notifications.warn('Feature not found in compendium.'); return; }
          await actor.setFlag('stryder', `lordlyFeature_${slotIdx}`, doc.name);
          const itemData = doc.toObject();
          foundry.utils.setProperty(itemData, 'flags.stryder.isLordlyFeature', true);
          await linkedLordling.createEmbeddedDocuments('Item', [itemData]);
          ui.notifications.info(`${doc.name} added to ${linkedLordling.name}.`);
        });
      });

      // ── Mystic Blessings confirm ────────────────────────────────────────────
      classPanel.querySelector('.gw-btn--confirm[data-action="mysticBlessings"]')?.addEventListener('click', async () => {
        const sensePick = classPanel.querySelector('#mystic-sense-pick')?.value;
        if (!sensePick) { ui.notifications.warn('Choose a Sense first.'); return; }
        await actor.setFlag('stryder', 'mysticBlessingsSense', sensePick);
        // Apply movement +2
        const curMove = actor.system.attributes.move.running.value ?? 7;
        await actor.update({ 'system.attributes.move.running.value': curMove + 2 });
        // Apply sense +2
        const senseKey = sensePick.toLowerCase();
        const curSense = actor.system.attributes.sense?.[senseKey]?.value ?? 0;
        await actor.update({ [`system.attributes.sense.${senseKey}.value`]: curSense + 2 });
        ui.notifications.info(`${actor.name}: Mystic Blessings — Movement +2, ${sensePick} Sense +2 applied.`);
      });

      // ── Memories of Past Lives claim ────────────────────────────────────────
      classPanel.querySelector('.gw-btn--confirm[data-action="memoriesOfPastLives"]')?.addEventListener('click', async () => {
        const amount = parseInt(classPanel.querySelector('[data-action="memoriesOfPastLives"]')?.dataset.mastery ?? '3');
        await actor.setFlag('stryder', 'memoriesOfPastLivesClaimed', true);
        const cur = actor.system.masteryPoints?.essence ?? 0;
        await actor.update({ 'system.masteryPoints.essence': cur + amount });
        ui.notifications.info(`${actor.name}: Memories of Past Lives — +${amount} Mastery Points.`);
      });

      // Wire augment choices
      classPanel.querySelectorAll('.gw-aug-choices').forEach(block => {
        block.querySelectorAll('.gw-aug-opt').forEach(opt => {
          opt.addEventListener('click', () => {
            block.querySelectorAll('.gw-aug-dot').forEach(d => d.classList.remove('selected'));
            opt.querySelector('.gw-aug-dot').classList.add('selected');
            block.dataset.selectedOpt = opt.dataset.opt;
          });
        });
        block.querySelector('.gw-btn--confirm')?.addEventListener('click', async () => {
          const idx    = block.dataset.selectedOpt;
          const featId = block.dataset.featId;
          if (idx === undefined) { ui.notifications.warn('Select an augment option first.'); return; }
          const optIndex = parseInt(idx);

          // Store the choice flag
          await actor.setFlag('stryder', block.dataset.flagKey, optIndex);

          // Apply hardcoded effect if available
          const applyFn = CLASS_AUG_OPTIONS[featId]?.[optIndex]?.apply;
          if (applyFn) {
            await applyFn(actor);
          }

          // Also add the compendium item to the sheet if present (for reference)
          const doc = cfById[featId];
          if (doc) {
            await actor.createEmbeddedDocuments('Item', [doc.toObject()]);
          }
        });
      });

    } catch(err) {
      console.error('[Growth] _buildGrowthPage failed:', err);
    }
  }

  /** Stub — collapse is handled by the renderStryderActorSheet hook below. */
  _restoreSectionStates(_html) {}

	/**
	 * Toggle the visibility of item lists in the actor sheet
	 * @param {HTMLElement} header - The header element that was clicked
	 */
	toggleItems(header) {
	  const listItem = header.closest('li.items-header');
	  const attributeHeader = header.closest('.attribute-modification-section .items-header');
	  const parentElement = listItem || attributeHeader;
	  if (!parentElement) return;
	  
	  const itemList = parentElement.parentElement;
	  let items;
	  const icon = header.querySelector('.toggle-icon');
	  const sectionName = header.textContent.trim().toLowerCase().replace(/\s+/g, '-');
	  
	  // Handle different container types
	  if (listItem) {
		// Standard item list sections
		items = Array.from(itemList.querySelectorAll('li:not(.items-header)'));
	  } else if (attributeHeader) {
		// Attribute modifications section
		items = Array.from(itemList.querySelectorAll('.attribute-inputs-container'));
	  }
	  
	  // Skip if elements aren't found
	  if (!items || !items.length || !icon) return;
	  
	  // Determine new state
	  const isCollapsed = items[0].style.display !== "none";
	  const newState = isCollapsed ? "collapsed" : "expanded";
	  
	  // Update display and icon
	  if (listItem) {
		items.forEach(item => item.style.display = isCollapsed ? "none" : "flex");
	  } else if (attributeHeader) {
		items.forEach(item => item.style.display = isCollapsed ? "none" : "block");
	  }
	  
	  icon.classList.toggle('fa-chevron-down', !isCollapsed);
	  icon.classList.toggle('fa-chevron-up', isCollapsed);
	  
	  // Store state in actor flags without triggering a full re-render
	  this.actor.setFlag('stryder', `section-${sectionName}`, newState).catch(err => {
		console.error("Error saving section state:", err);
	  });
	}

	async _restoreSectionStates(html) {
	  const flags = this.actor.flags.stryder || {};
	  
	  // Find all section headers
	  html.find('.items-header .item-name').each((i, header) => {
		const sectionName = header.textContent.trim().toLowerCase().replace(/\s+/g, '-');
		const sectionState = flags[`section-${sectionName}`];
		const listItem = header.closest('li.items-header');
		const attributeHeader = header.closest('.attribute-modification-section .items-header');
		const parentElement = listItem || attributeHeader;
		if (!parentElement) return;
		
		const itemList = parentElement.parentElement;
		let items;
		const icon = header.querySelector('.toggle-icon');
		
		// Handle different container types
		if (listItem) {
		  // Standard item list sections
		  items = Array.from(itemList.querySelectorAll('li:not(.items-header)'));
		} else if (attributeHeader) {
		  // Attribute modifications section
		  items = Array.from(itemList.querySelectorAll('.attribute-inputs-container'));
		}
		
		// Skip if elements aren't found
		if (!items || !items.length || !icon) return;
		
		if (sectionState === "collapsed") {
		  items.forEach(item => item.style.display = "none");
		  icon.classList.remove('fa-chevron-down');
		  icon.classList.add('fa-chevron-up');
		} else {
		  if (listItem) {
			items.forEach(item => item.style.display = "flex");
		  } else if (attributeHeader) {
			items.forEach(item => item.style.display = "block");
		  }
		  icon.classList.remove('fa-chevron-up');
		  icon.classList.add('fa-chevron-down');
		}
	  });
	}

  /** @override */
  get template() {
    return `systems/stryder/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /**
   * Override _onChangeInput to prevent Foundry's built-in form handler from
   * saving spark checkboxes. Without this, Foundry races our reset handler and
   * re-sets the last clicked spark back to true after our reset clears them all.
   * Our 'change .jrpg-spark' listener in activateListeners handles all spark
   * persistence instead.
   * @override
   */
  async _onChangeInput(event) {
    if (event.target.classList.contains('jrpg-spark')) return;
    return super._onChangeInput(event);
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.data;

	// Calculate jump distances
	const talent = actorData.system.attributes?.talent;
	const horizontalMod = actorData.system.attributes?.horizontal_leap?.mod ?? 0;
	const verticalMod = actorData.system.attributes?.vertical_leap?.mod ?? 0;
	context.verticalJumpDistance = (talent?.strength?.value ? Math.floor(talent.strength.value / 2) : 0) + verticalMod;
	context.horizontalJumpDistance = (talent?.nimbleness?.value ?? 0) + horizontalMod;

	// Apply Practiced Form bonuses if enabled
	if (actorData.system.booleans?.hasPracticedForm && talent) {
	  context.verticalJumpDistance += talent.nimbleness?.value ?? 0;
	  context.horizontalJumpDistance += talent.strength?.value ?? 0;
	}

	// Apply Unbound Leap multiplier if enabled
	if (actorData.system.booleans?.usingUnboundLeap && talent) {
	  context.verticalJumpDistance += talent.strength?.value ?? 1;
	  context.horizontalJumpDistance += talent.strength?.value ?? 1;
	}

	// Apply leap bonus
	const leapBonus = actorData.system.leap_bonus?.bonus || 0;
	context.verticalJumpDistance += leapBonus;
	context.horizontalJumpDistance += leapBonus;

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // ── Talent layering (base + effect bonus = total) ──
    // The talent inputs must bind to the SOURCE (base) value, not the derived
    // value. Otherwise an Active Effect (Folk bonus, condition, etc.) that adds
    // to system.attributes.talent.X.value makes the input show the boosted total,
    // and saving the sheet writes that total back to source — re-applying the
    // bonus on top of itself (the "Folk bonus double-counts" bug). Rolls keep
    // reading the derived value (= base + bonus = correct total) unchanged.
    {
      // base  = the player's own allocated points (source value, edited by +/-).
      // total = base + effect layer (Folk foundation + conditions + level-up picks).
      // bonus = total - base = the always-applied effect contribution (Folk floor).
      const tSrc = this.actor._source?.system?.attributes?.talent ?? {};
      const tDer = actorData.system?.attributes?.talent ?? {};
      context.talentLayers = {};
      for (const k of Object.keys(tDer)) {
        const base  = Number(tSrc[k]?.value ?? 0);
        const total = Number(tDer[k]?.value ?? 0);
        context.talentLayers[k] = { base, total, bonus: total - base };
      }
      // Senses use the same layered model; built as an array for the {{#each}} loop.
      const sSrc = this.actor._source?.system?.attributes?.sense ?? {};
      const sDer = actorData.system?.attributes?.sense ?? {};
      context.senseLayers = Object.keys(sDer).map(k => {
        const base  = Number(sSrc[k]?.value ?? 0);
        const total = Number(sDer[k]?.value ?? 0);
        return { key: k, base, total, bonus: total - base };
      });

      // Potency follows the book baseline: Physical = 2×Grit, Magykal = 2×Will.
      // A stored value > 0 is a manual override (set via +/-) that no longer
      // tracks the stat; a stored 0 means "use the formula" (auto, cyan-tinted).
      const gritV = Number(actorData.system?.abilities?.Grit?.value ?? 0);
      const willV = Number(actorData.system?.abilities?.Will?.value ?? 0);
      const pOvr  = Number(this.actor._source?.system?.attributes?.physical_potency?.value ?? 0);
      const mOvr  = Number(this.actor._source?.system?.attributes?.magykal_potency?.value ?? 0);
      const physical = { label: 'P. Potency', stat: 'physical_potency', formula: 2 * gritV, total: pOvr > 0 ? pOvr : 2 * gritV, isFormula: !(pOvr > 0) };
      const magykal  = { label: 'M. Potency', stat: 'magykal_potency', formula: 2 * willV, total: mOvr > 0 ? mOvr : 2 * willV, isFormula: !(mOvr > 0) };
      // The battle HUD shows only the potency for the attuned Aspect — Mortal
      // Aspects use Physical (2×Grit), Immortal use Magykal (2×Will). Hidden when
      // no Aspect is attuned. The Stats page shows both regardless.
      const MORTAL_ASPECTS   = ['Brutality','Heroism','Vigilance','Destruction','Precision','Pain','Discipline','Resilience','Misdirection'];
      const IMMORTAL_ASPECTS = ['Control','Dimensions','Elementalism','Mind','Power','Spirit','Resonance','Time'];
      const activeAspect = actorData.flags?.stryder?.activeAspect ?? '';
      let activePotency = null;
      if (activeAspect) {
        if (MORTAL_ASPECTS.some(a => activeAspect.includes(a)))        activePotency = physical;
        else if (IMMORTAL_ASPECTS.some(a => activeAspect.includes(a))) activePotency = magykal;
      }
      context.potency = {
        physical, magykal, active: activePotency,
        // legacy fields kept for any template still reading potency.total directly
        formula: physical.formula, total: physical.total, isFormula: physical.isFormula,
      };
    }

    // Pre-compute resource bar percentages for the main-menu player card.
    // Baking these into the template at render time is more reliable than
    // setting them via querySelector in activateListeners (which can silently
    // fail if the element isn't found or maxVal resolves to 0).
    const _pct = (val, max) => max > 0 ? Math.min(100, (val / max) * 100) : 0;
    context.hpPct  = _pct(actorData.system.health.value,  actorData.system.health.max);
    context.mpPct  = _pct(actorData.system.mana.value,    actorData.system.mana.max);
    context.staPct = _pct(actorData.system.stamina.value, actorData.system.stamina.max);

    // Lordling-specific context
    if (actorData.type === 'lordling') {
      // Spirit → Soul migration: copy legacy Spirit value to Soul if Soul is still 0/missing.
      // Read from _source (raw db data) because Spirit is no longer in template.json and
      // Foundry's data model strips it from the prepared actorData.
      const spiritVal = this.actor._source?.system?.abilities?.Spirit?.value ?? 0;
      const soulVal   = actorData.system.abilities?.Soul?.value   ?? 0;
      if (spiritVal > 0 && soulVal === 0) {
        this.actor.update({ 'system.abilities.Soul.value': spiritVal }).catch(() => {});
      }

      // Auto-apply TP max from linked Shaman's level milestones
      // (guard: skip while Approximate Ascension has doubled the max)
      const linkedId = actorData.system.linkedCharacterId;
      const linkedShaman = linkedId ? game.actors.get(linkedId) : null;
      if (linkedShaman && !linkedShaman.getFlag('stryder', 'approximateAscensionRounds')) {
        const lvl = linkedShaman.system.attributes?.level?.value ?? 1;
        let tpMax = 6;
        if (lvl >= 4)  tpMax += 1;
        if (lvl >= 8)  tpMax += 1;
        if (lvl >= 12) tpMax += 1;
        if (lvl >= 15) tpMax += 3;
        if (tpMax !== (actorData.system.tactics?.max ?? 6)) {
          this.actor.update({ 'system.tactics.max': tpMax }).catch(() => {});
        }
      }

      // H3 migration: stamp isLordlyFeature on embedded items that match pack names
      // but were created before the flag-stamping code existed in the Growth panel.
      {
        const { LORDLY_TACTIC_NAMES } = await import('../abilities/shaman-abilities.mjs');
        const unstamped = this.actor.items.filter(i =>
          i.type === 'action' && LORDLY_TACTIC_NAMES.includes(i.name)
          && !i.flags?.stryder?.isLordlyFeature
        );
        for (const it of unstamped) {
          it.setFlag('stryder', 'isLordlyFeature', true).catch(() => {});
        }
      }

      context.tpPct = _pct(actorData.system.tactics?.value, actorData.system.tactics?.max);
      context.linkedCharacterName = linkedId ? (game.actors.get(linkedId)?.name ?? '') : '';
      context.characters = game.actors.filter(a => a.type === 'character').map(a => ({ id: a.id, name: a.name }));
    }

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
      const computed = this._calcMaxStats(actorData);
      context.computedMaxHealth  = computed.maxHealth;
      context.computedMaxStamina = computed.maxStamina;
      context.computedMaxMana    = computed.maxMana;

      // Grit HP breakdown for display on the Character tab
      const grit  = actorData.system.abilities?.Grit?.value ?? 0;
      const level = Math.min(15, Math.max(1, actorData.system.attributes.level.value ?? 1));
      const gritMilestones = [1, 5, 10, 15].filter(m => level >= m).length;
      context.gritHpBonus          = grit * gritMilestones;
      context.gritMilestonesReached = gritMilestones;


      // Aspect active flags for template conditionals
      const _activeAspect = actorData.flags?.stryder?.activeAspect ?? '';
      context.isBrutalityActive = _activeAspect.includes('Brutality');

      // Warlock resource panels (Bloodloss / Manaburn)
      context.isWarlockClass   = (actorData.system.class?.name ?? '') === 'Warlock'
        || this.actor.items.some(i => i.type === 'class' && i.name === 'Warlock');
      context.warlockBloodloss = actorData.flags?.stryder?.bloodlossHealthReduction ?? 0;
      context.warlockManaburn  = actorData.flags?.stryder?.manaburn ?? 0;

      // Wytch resource panel (Hex count / Eye durability)
      context.isWytchClass        = (actorData.system.class?.name ?? '') === 'Wytch'
        || this.actor.items.some(i => i.type === 'class' && i.name === 'Wytch');
      context.wytchHexCount       = actorData.flags?.stryder?.hexCountThisPhase   ?? 0;
      context.wytchEyeDurability  = actorData.flags?.stryder?.wytchEyeDurability  ?? null;
      context.wytchEyeActive      = !!(actorData.flags?.stryder?.wytchEyeUsed);

      // Stat point pool for the Stats stepper UI
      const augStatBonus         = this.actor.getFlag('stryder', 'augExtraStatPoints') ?? 0;
      context.statPointTotal     = 9 + augStatBonus;
      context.statPointSpent     = ['Soul', 'Reflex', 'Grit', 'Will']
        .reduce((sum, k) => sum + (actorData.system.abilities?.[k]?.value ?? 0), 0);
      context.statPointRemaining = context.statPointTotal - context.statPointSpent;

      // Folk display context
      const folkName = actorData.system.folk?.name ?? '';
      const folkData = STRYDER_FOLK_DATA[folkName];
      context.folkDisplay = folkData ? {
        name:            folkName,
        size:            actorData.system.folk.size_choice || folkData.size || '—',
        weight:          folkData.weight ?? '—',
        passives:        folkData.passives || [],
        subfolks:        folkData.subfolks || null,
        currentSubfolk:  actorData.system.folk.subfolk || '',
        bonusesApplied:  actorData.system.folk.bonuses_applied ?? false
      } : null;

      // Inventory grid context (all item types → 44-slot visual grid)
      context.inventoryGrid = this._buildInventoryGrid(context.items || []);
      // Only count types that actually appear in the grid — same set as _buildInventoryGrid
      const INVENTORY_COUNT_TYPES = new Set(['loot','gear','consumable','component','elixir','miscellaneous','ingredient','head','back','arms','legs','gems','aegiscore','legacies']);
      const usedSlots = (context.items || [])
        .filter(i => INVENTORY_COUNT_TYPES.has(i.type))
        .reduce((sum, i) => {
          const s = i.system?.size ?? i.system?.inventory_size ?? 1;
          return sum + Math.max(1, Math.min(s, 11));
        }, 0);
      context.inventoryUsed = Math.min(44, usedSlots);
      context.inventoryMax  = 44;
      context.inventoryFull = usedSlots >= 44;

      // Favorites — stored as array of item IDs, exposed as object for HBS lookup
      const favArr = this.actor.getFlag('stryder', 'favorites') || [];
      context.favorites = Object.fromEntries(favArr.map(id => [id, true]));
    }

    if (actorData.type == 'lordling') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
		context.characters = game.actors.filter(a => a.type === 'character').map(a => ({
			id: a.id,
			name: a.name
		}));
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    if (actorData.type == 'monster') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    if (actorData.type == 'familiar') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    if (actorData.type == 'pet') {
      this._prepareItems(context);
    }

    if (actorData.type == 'spirit-beast') {
      this._prepareItems(context);
      // Summon-status context for spirit-beast-battle.hbs
      context.isSummoned   = this.actor.getActiveTokens().length > 0;
      context.summonedAt   = this.actor.getFlag('stryder', 'summonedAt') ?? null;
      const baseHP         = this.actor.getFlag('stryder', 'summonBaseMaxHP')   ?? null;
      const tempBonus      = this.actor.getFlag('stryder', 'summonTempMaxBonus') ?? 0;
      context.tempBonuses  = baseHP !== null
        ? { baseHP, tempBonus, totalHP: baseHP + tempBonus }
        : null;
      const summonerId     = actorData.system?.linkedCharacterId;
      const summoner       = summonerId ? game.actors.get(summonerId) : null;
      context.summonerName = summoner?.name ?? null;
      context.freePrimaryDefenseUsed = this.actor.getFlag('stryder', 'freePrimaryDefenseUsed') ?? false;
      context.gateChoices = {
        crimson: 'Crimson Gate',
        violet:  'Violet Gate',
        azure:   'Azure Gate',
        sage:    'Sage Gate',
      };
      context.creatureSizeChoices = {
        '0.25': 'Mini',
        '0.5':  'Small',
        '1':    'Normal',
        '2':    'Huge',
        '3':    'Massive',
      };
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    context.gearSlotsUsed = this._calculateGearSlotsUsed();
    context.lootSlotsUsed = this._calculateLootSlotsUsed();
    context.armsSlotsUsed = this._calculateArmsSlotsUsed();

	context.sectionStates = this.actor.flags.stryder || {};

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    // Check for Bangleless condition
    const { isActorBangleless } = await import('../conditions/bangleless.mjs');
    context.isBangleless = isActorBangleless(this.actor);

    // Soul Armament derived data
    if (actorData.type === 'character') {
      const sa = actorData.system.soul_armament || {};
      const saForm = sa.form || {};
      const saFormCosts   = { ingrained: 2, attached: 2, one_handed: 0, two_handed: 1, dual_wield: 2 };
      const saRangeCosts  = { range1: 0, range2: 1, range5: 2, range8: 3 };
      const saTemperCosts = { basic: 0, keen: 2, heavy: 2 };
      const saCapCosts    = { slot1: 0, slot2: 1, slot3: 2, slot4: 4 };
      let saDPSpent = 0;
      for (const [k, cost] of Object.entries(saFormCosts)) { if (saForm[k]) saDPSpent += cost; }
      saDPSpent += saRangeCosts[sa.range  ?? 'range1'] ?? 0;
      saDPSpent += saTemperCosts[sa.temper ?? 'basic']  ?? 0;
      saDPSpent += saCapCosts[sa.capacity  ?? 'slot1']  ?? 0;
      context.saDPSpent = saDPSpent;
      context.saDPMax   = 4;
      context.saDPPct   = Math.min(100, (saDPSpent / 4) * 100);
      context.saDPOver  = saDPSpent > 4;
      // Flags for radio-style single-choice fields
      context.saRangeIs   = { range1: (sa.range  ?? 'range1') === 'range1', range2: sa.range === 'range2', range5: sa.range === 'range5', range8: sa.range === 'range8' };
      context.saTemperIs  = { basic: (sa.temper ?? 'basic') === 'basic', keen: sa.temper === 'keen', heavy: sa.temper === 'heavy' };
      context.saCapIs     = { slot1: (sa.capacity ?? 'slot1') === 'slot1', slot2: sa.capacity === 'slot2', slot3: sa.capacity === 'slot3', slot4: sa.capacity === 'slot4' };
      // Summary strings for the identity panel
      const formParts = [];
      if (saForm.one_handed)  formParts.push('1 Handed');
      if (saForm.two_handed)  formParts.push('Two Handed');
      if (saForm.ingrained)   formParts.push('Ingrained');
      if (saForm.attached)    formParts.push('Attached');
      if (saForm.dual_wield)  formParts.push('Dual Wield');
      context.saSumForm     = formParts.join(', ') || '—';
      context.saSumRange    = { range1: 'Range 1', range2: 'Range 2', range5: 'Range 5', range8: 'Range 8' }[sa.range ?? 'range1'] ?? 'Range 1';
      context.saSumTemper   = { basic: 'Basic', keen: 'Keen', heavy: 'Heavy' }[sa.temper ?? 'basic'] ?? 'Basic';
      context.saSumCapacity = { slot1: '1 Slot', slot2: '2 Slots', slot3: '3 Slots', slot4: '4 Slots' }[sa.capacity ?? 'slot1'] ?? '1 Slot';
    }

    return context;
  }

  _calculateGearSlotsUsed() {
    const gearItems = this.actor.items.filter(i => i.type === 'gear');
    return gearItems.reduce((total, item) => {
      return total + parseInt(item.system.inventory_size || 1);
    }, 0);
  }

  _calculateLootSlotsUsed() {
    const lootItems = this.actor.items.filter(i => i.type === 'loot');
    return lootItems.reduce((total, item) => {
      return total + parseInt(item.system.inventory_size || 1);
    }, 0);
  }

  _calculateArmsSlotsUsed() {
    const armsItems = this.actor.items.filter(i => i.type === 'arms');
    return armsItems.reduce((total, item) => {
      return total + parseInt(item.system.slot_space || 1);
    }, 0);
  }

  /**
   * Build the 44-slot (11 × 4) inventory grid layout for gear items.
   * Items wider than the remaining columns on a row bump to the next row,
   * leaving intentional gap slots. All 44 cells are always returned.
   * @param {Array} items  Full items array from getData context
   * @returns {Array}      Flat array of 44 cell descriptor objects
   */
  _buildInventoryGrid(items) {
    // Only physical inventory types go into the grid
    const INVENTORY_TYPES = new Set(['loot','gear','consumable','component','elixir','miscellaneous','ingredient','head','back','arms','legs','gems','aegiscore','legacies']);
    const gearItems = items.filter(i => INVENTORY_TYPES.has(i.type));

    const COLS  = 11;
    const TOTAL = 44;
    const grid  = [];

    let col = 0;

    for (const item of gearItems) {
      // Use system.size if set; fall back to legacy inventory_size field
      const rawSize = item.system?.size ?? item.system?.inventory_size ?? 1;
      const size    = Math.max(1, Math.min(rawSize, COLS));

      // Bump to next row if item doesn't fit remaining columns
      if (col + size > COLS) {
        while (col < COLS) {
          grid.push({ empty: true, id: `empty-${grid.length}` });
          col++;
        }
        col = 0;
      }

      // Hard stop at 44 slots
      if (grid.length >= TOTAL) break;

      // Place item across `size` cells
      for (let i = 0; i < size; i++) {
        grid.push({
          empty:     false,
          itemId:    item._id,
          itemName:  item.name,
          itemImg:   item.img || '',
          itemSize:  size,
          itemDesc:  item.system?.description || '',
          itemQty:   item.system?.quantity    || 1,
          isStart:   i === 0,
          isMid:     i > 0 && i < size - 1,
          isSolo:    size === 1,
          isEnd:     i === size - 1 && size > 1,
          showIcon:  i === 0,
          clickable: i === 0,
          id:        `${item._id}-${i}`
        });
      }
      col += size;
      if (col >= COLS) col = 0;
    }

    // Pad remainder to exactly 44 cells
    while (grid.length < TOTAL) {
      grid.push({ empty: true, id: `empty-${grid.length}` });
    }

    return grid;
  }

	/**
	 * Update level-up talent active effects based on dropdown selections
	 * @param {string} dropdownId - The dropdown identifier (e.g., "level1", "level2")
	 * @param {string} talentKey - The selected talent key (e.g., "endurance")
	 */
	async _updateTalentEffect(dropdownId, talentKey) {
	  const effectName = `Level-Up Talent (Dropdown ${dropdownId.replace('level', '')})`;
	  
	  // Find the specific effect for this dropdown (using both name and flag)
	  const existingEffect = this.actor.effects.find(e => 
		e.flags?.stryder?.dropdownId === dropdownId
	  );
	  
	  // Remove existing effect if it exists and doesn't match the current selection
	  if (existingEffect) {
		if (!talentKey || talentKey === "" || existingEffect.changes[0]?.key !== `system.attributes.talent.${talentKey}.value`) {
		  await this.actor.deleteEmbeddedDocuments("ActiveEffect", [existingEffect.id]);
		} else {
		  // Effect already exists and matches current selection, no need to do anything
		  return;
		}
	  }
	  
	  // Create new effect if a talent is selected
	  if (talentKey && talentKey !== "") {
		const effectData = {
		  name: effectName,
		  label: effectName,
		  icon: "icons/logo-scifi-blank.png",
		  changes: [{
			key: `system.attributes.talent.${talentKey}.value`,
			mode: CONST.ACTIVE_EFFECT_MODES.ADD,
			value: 1,
			priority: 20
		  }],
		  disabled: false,
		  origin: this.actor.uuid,
		  transfer: false,
		  flags: {
			stryder: {
			  isLevelUpTalent: true,
			  dropdownId: dropdownId
			}
		  }
		};
		
		await this.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
	  }
	}

  /**
   * Calculate the correct max health, stamina, and mana for a character at
   * their current level, reading class base values from actorData.system.class.
   * @param {Object} actorData  Actor data object (or the Actor document itself)
   * @returns {{ maxHealth: number, maxStamina: number, maxMana: number }}
   */
  _calcMaxStats(actorData) {
    const level = actorData.system.attributes.level.value ?? 1;
    const clamped = Math.min(15, Math.max(1, level));

    // Try stored values first; fall back to lookup table by class name so that
    // existing characters whose HP fields were never populated still work.
    let baseHp     = actorData.system.class?.base_hp     ?? 0;
    let hpPerLevel = actorData.system.class?.hp_per_level ?? 0;

    if (!baseHp || !hpPerLevel) {
      const className = actorData.system.class?.name ?? '';
      const fallback  = STRYDER_CLASS_DATA[className];
      if (fallback) {
        baseHp     = fallback.base_hp;
        hpPerLevel = fallback.hp_per_level;
      } else {
        baseHp     = 6;
        hpPerLevel = 2;
      }
    }

    // Grit health bonus — Stat Perk 1 is automatic at Grit >= 1.
    // Each milestone level reached (1, 5, 10, 15) adds current Grit value to Max HP.
    const grit = actorData.system.abilities?.Grit?.value ?? 0;
    const gritMilestones = [1, 5, 10, 15].filter(m => clamped >= m).length;
    const gritHpBonus = grit * gritMilestones;

    // Warrior aug bonuses — stored as flags so _syncComputedStats doesn't clobber them.
    // Works whether actorData is the full document (has flags.stryder) or a getData() clone.
    const augHealthBonus  = actorData.flags?.stryder?.augHealthBonus  ?? 0;
    const augStaminaBonus = actorData.flags?.stryder?.augStaminaBonus ?? 0;

    // Warlock/burning max-HP reductions — flags are the single source of truth.
    // warlock-abilities.mjs writes these flags AND health.max directly for immediate
    // feedback; _syncComputedStats re-validates here on every render so the two paths
    // stay consistent and neither silently refunds a paid cost.
    const bloodlossReduction   = actorData.flags?.stryder?.bloodlossHealthReduction   ?? 0;
    const sacrificeReduction   = actorData.flags?.stryder?.sacrificeHealthReduction   ?? 0;
    const burningReduction     = actorData.flags?.stryder?.burningHealthReduction     ?? 0;
    const wytchRiseReduction   = actorData.flags?.stryder?.wytchRiseHealthReduction   ?? 0;

    const healthBonus = actorData.system.health?.bonus ?? 0;
    const maxHealth  = Math.max(1,
      baseHp + (hpPerLevel * (clamped - 1)) + gritHpBonus + augHealthBonus + healthBonus
      - bloodlossReduction - sacrificeReduction - burningReduction - wytchRiseReduction
    );
    const maxStamina = (STRYDER_STAMINA_BY_LEVEL[clamped] ?? 3) + augStaminaBonus;
    const maxMana    = STRYDER_MANA_BY_LEVEL[clamped]    ?? 4;

    return { maxHealth, maxStamina, maxMana };
  }

  /**
   * Write the correct max values back to the actor document whenever the sheet
   * renders, so the sheet self-corrects if level or class changes externally.
   * Called fire-and-forget (no await) at the end of activateListeners.
   */
  async _syncComputedStats() {
    if (this.actor.type !== 'character') return;
    const computed = this._calcMaxStats(this.actor);
    const sys = this.actor.system;
    const updates = {};

    // system.health.max is stored as an object {value, mod} — unwrap for comparison
    const currentHealthMax = (sys.health.max !== null && typeof sys.health.max === 'object')
      ? sys.health.max.value : sys.health.max;
    if (currentHealthMax !== computed.maxHealth) {
      updates['system.health.max'] = computed.maxHealth;
      if (sys.health.value > computed.maxHealth) {
        updates['system.health.value'] = computed.maxHealth;
      }
    }

    const currentStaMax = (sys.stamina.max !== null && typeof sys.stamina.max === 'object')
      ? sys.stamina.max.value : sys.stamina.max;
    if (currentStaMax !== computed.maxStamina) {
      updates['system.stamina.max'] = computed.maxStamina;
    }

    const currentManaMax = (sys.mana.max !== null && typeof sys.mana.max === 'object')
      ? sys.mana.max.value : sys.mana.max;
    if (currentManaMax !== computed.maxMana) {
      updates['system.mana.max'] = computed.maxMana;
    }

    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    // Handle ability scores.
    for (let [k, v] of Object.entries(context.system.abilities)) {
      v.label = game.i18n.localize(CONFIG.STRYDER.abilities[k]) ?? k;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const actions = [];
    const aspectAbilities = [];
    const playerActions = [];  // Universal Player Actions
    const generic = [];
    const armament = [];
    const aegiscore = [];
    const legacies = [];
    const head = [];
    const back = [];
    const arms = [];
    const legs = [];
    const gems = [];
    const loot = [];
    const component = [];
    const consumable = [];
    const gear = [];
    const hexes = [];
    const skills = [];
    const features = [];
    const racials = [];
    const statperks = [];
    const techniques = [];
    const professions = [];
    const bonds = [];
    const passive = [];
    const miscellaneous = [];
    const ingredient = [];
    const classchoice = [];
    const folk = [];
    const spells = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: [],
    };

    // Pre-build the set of feature names for this actor's class so we can
    // display auto-granted items without requiring the isClassFeature flag stamp.
    const _actorClassName    = context.system?.class?.name ?? '';
    const _classFeatureNames = new Set(
      (STRYDER_CLASS_FEATURES[_actorClassName] ?? []).flatMap(ms => ms.feats.map(f => f.name))
    );

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to actions.
      if (i.type === 'action') {
        // Class Features: explicitly tagged OR the item name is in this class's feature table
        // (auto-granted pack items lack the flag; widening here avoids needing a migration)
        if (i.flags?.stryder?.isClassFeature || _classFeatureNames.has(i.name)) {
          features.push(i);
        // Techniques: flagged isTechnique or have xpCost (techniques pack sets xpCost, aspect abilities don't)
        } else if (i.flags?.stryder?.isTechnique || i.flags?.stryder?.xpCost !== undefined) {
          techniques.push(i);
        // Aspect abilities: flagged with aspectName (new) or isAspectAbility (legacy)
        // Passives (Form Passive, Attached Bonus, etc.) are automated — don't show as clickable items
        } else if ((i.flags?.stryder?.aspectName || i.system?.isAspectAbility) && i.system?.action_type !== 'passive') {
          aspectAbilities.push(i);
        } else if (i.system?.isUniversalAction) {
          playerActions.push(i);
        } else {
          actions.push(i);
        }
      }
      // Append to generic attacks (monster offensive abilities).
      if (i.type === 'generic') {
        generic.push(i);
      }
      // Append to armament.
      if (i.type === 'armament') {
        armament.push(i);
      }
      // Append to aegiscore.
      if (i.type === 'aegiscore') {
        aegiscore.push(i);
      }
      // Append to legacies.
      if (i.type === 'legacies') {
        legacies.push(i);
      }
      // Append to head.
      if (i.type === 'head') {
        head.push(i);
      }
      // Append to back.
      if (i.type === 'back') {
        back.push(i);
      }
      // Append to arms.
      if (i.type === 'arms') {
        arms.push(i);
      }
      // Append to legs.
      if (i.type === 'legs') {
        legs.push(i);
      }
      // Append to gems.
      if (i.type === 'gems') {
        gems.push(i);
      }
      // Append to loot.
      if (i.type === 'loot') {
        loot.push(i);
      }
      // Append to component.
      if (i.type === 'component') {
        component.push(i);
      }
      // Append to consumable.
      if (i.type === 'consumable') {
        consumable.push(i);
      }
      // Append to gear.
      if (i.type === 'gear') {
        gear.push(i);
      }
      // Append to hexes.
      else if (i.type === 'hex') {
        hexes.push(i);
      }
      // Append to skills.
      else if (i.type === 'skill') {
        skills.push(i);
      }
      // Append to features.
      else if (i.type === 'feature') {
        features.push(i);
      }
      // Append to racials.
      else if (i.type === 'racial') {
        racials.push(i);
      }
      // Append to statperks.
      else if (i.type === 'statperk') {
        statperks.push(i);
      }
      // Append to techniques.
      else if (i.type === 'technique') {
        techniques.push(i);
      }
      // Append to professions.
      else if (i.type === 'profession') {
        professions.push(i);
      }
      // Append to bonds.
      else if (i.type === 'bonds') {
        bonds.push(i);
      }
      // Append to passives.
      else if (i.type === 'passive') {
        passive.push(i);
      }
      // Append to miscellaneous.
      else if (i.type === 'miscellaneous') {
        miscellaneous.push(i);
      }
      // Append to ingredient.
      else if (i.type === 'ingredient') {
        ingredient.push(i);
      }
      // Append to class.
      else if (i.type === 'class') {
        classchoice.push(i);
      }
      // Append to folk.
      else if (i.type === 'folk') {
        folk.push(i);
      }
      // Append to spells.
      else if (i.type === 'spell') {
        if (i.system.spellLevel != undefined) {
          spells[i.system.spellLevel].push(i);
        }
      }
    }

    // Assign and return
    context.actions = actions;

    // Aspect abilities — annotate each with isActiveAspect for battle-tab grey-out
    const activeAspect = context.actor?.flags?.stryder?.activeAspect ?? null;
    context.activeAspect = activeAspect;
    context.activeAspectLabel = activeAspect ? activeAspect.replace('Aspect of ', '') : '';
    for (const item of aspectAbilities) {
      const asp = item.flags?.stryder?.aspectName ?? null;
      item.isActiveAspect = !activeAspect || asp === activeAspect;
    }
    context.aspectAbilities = aspectAbilities;

    context.playerActions = playerActions.sort((a, b) => a.name.localeCompare(b.name));
    context.generic = generic;
    context.armament = armament;
    context.aegiscore = aegiscore;
    context.legacies = legacies;
    context.head = head;
    context.back = back;
    context.arms = arms;
    context.legs = legs;
    context.gems = gems;
    context.loot = loot;
    context.component = component;
    context.consumable = consumable;
    context.gear = gear;
    context.ingredient = ingredient;
    context.hexes = hexes;
    context.skills = skills;
    context.features = features;
    context.racials = racials;
    context.statperks = statperks;
    context.techniques = techniques;
    context.professions = professions;
    context.bonds = bonds;
    context.passive = passive;
    context.miscellaneous = miscellaneous;
    context.classchoice = classchoice;
    context.folk = folk;
    context.spells = spells;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Talent / sense +/- steppers. Adjusts the SOURCE (base) value only — the
    // player's own points. The Folk/effect layer is applied on top during
    // derivation and always remains the foundation, so the displayed total can
    // never drop below the Folk contribution (base clamps at 0). This never
    // touches or double-counts the effect bonus.
    html.on('click', '.jrpg-stat-step', async (ev) => {
      ev.preventDefault();
      const group = ev.currentTarget.dataset.group; // 'talent' | 'sense' | 'potency'
      const stat  = ev.currentTarget.dataset.stat;
      const step  = Number(ev.currentTarget.dataset.step) || 0;
      if (!group || !stat || !step) return;

      if (group === 'potency') {
        // Baseline follows the book (Physical = 2×Grit, Magykal = 2×Will). The
        // +/- OVERWRITE that baseline: seed from the formula on the first nudge,
        // then store an absolute value that no longer tracks the stat. Decrement
        // back to 0 to return to the auto formula.
        const gov     = stat === 'magykal_potency' ? 'Will' : 'Grit';
        const formula = 2 * Number(this.actor.system?.abilities?.[gov]?.value ?? 0);
        const stored  = Number(foundry.utils.getProperty(this.actor._source.system, `attributes.${stat}.value`) ?? 0);
        const current = stored > 0 ? stored : formula;
        await this.actor.update({ [`system.attributes.${stat}.value`]: Math.max(0, current + step) });
        return;
      }

      const path = `attributes.${group}.${stat}.value`;
      const base = Number(foundry.utils.getProperty(this.actor._source.system, path) ?? 0);
      await this.actor.update({ [`system.${path}`]: Math.max(0, base + step) });
    });

    // Lordling: set a narrow default window size on first open
    if (this.actor.type === 'lordling') {
      setTimeout(() => this.setPosition({ width: 420, height: 555 }), 80);
    }

    // ── Monster Field Guide — tabs, wound pips, guard thresholds ──
    if (this.actor.type === 'monster') {
      // Set default window size on first open
      if (!this._monsterSizeSet) {
        this._monsterSizeSet = true;
        setTimeout(() => this.setPosition({ width: 700, height: 520 }), 80);
      }

      // Tab drawer — click to open, click active tab again to close
      html.find('.ms-tab').on('click', function() {
        const page = $(this).data('page');
        const tabPages = html.find('.ms-tab-pages');
        const isAlreadyActive = $(this).hasClass('active') && tabPages.hasClass('is-open');
        if (isAlreadyActive) {
          // Collapse drawer
          tabPages.removeClass('is-open');
          $(this).removeClass('active');
        } else {
          // Switch page and open drawer
          html.find('.ms-tab').removeClass('active');
          $(this).addClass('active');
          html.find('.ms-page').hide();
          html.find(`.ms-page[data-page="${page}"]`).show();
          tabPages.addClass('is-open');
        }
      });

      // Wound pip renderer — 3 states: 0=empty, 1=wound, 2=grave wound
      // States stored in system.wounds.states (array of ints, length = max)
      const _getWoundStates = () => {
        const max = parseInt(this.actor.system.wounds?.max ?? 4);
        const raw = this.actor.system.wounds?.states ?? [];
        // Ensure array is always exactly `max` length
        const states = Array.from({ length: max }, (_, i) => raw[i] ?? 0);
        return states;
      };

      const STATE_CLASSES = ['', 'ms-wound-filled', 'ms-wound-grave'];
      const STATE_TITLES  = ['Empty', 'Wound', 'Grave Wound'];

      const renderWoundPips = () => {
        const max = parseInt(this.actor.system.wounds?.max ?? 4);
        const states = _getWoundStates();
        const container = html.find('.ms-wounds-pips')[0];
        if (!container) return;
        container.innerHTML = '';
        for (let i = 0; i < max; i++) {
          const s = states[i] ?? 0;
          const pip = document.createElement('div');
          pip.className = 'ms-wound-pip' + (STATE_CLASSES[s] ? ` ${STATE_CLASSES[s]}` : '');
          pip.dataset.index = i;
          pip.title = STATE_TITLES[s];
          container.appendChild(pip);
        }
        // Sync wounds.value to count of non-empty pips
        const filled = states.filter(s => s > 0).length;
        html.find('.ms-wounds-val').val(filled);
      };
      renderWoundPips();

      // Click cycles: empty(0) → wound(1) → grave(2) → empty(0)
      html.on('click', '.ms-wound-pip', async (ev) => {
        const idx = parseInt(ev.currentTarget.dataset.index);
        const states = _getWoundStates();
        states[idx] = (states[idx] + 1) % 3;
        const filled = states.filter(s => s > 0).length;
        await this.actor.update({
          'system.wounds.states': states,
          'system.wounds.value': filled
        });
      });

      // isAttack toggle on ability rows
      html.on('click', '.ms-atk-toggle', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const itemId = ev.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item) return;
        await item.update({ 'system.isAttack': !item.system.isAttack });
      });

      // Guard threshold display
      const renderGuardThresholds = () => {
        const guard = parseInt(this.actor.system.guard ?? 0);
        const el = html.find('.ms-guard-thresholds')[0];
        if (!el) return;
        if (guard > 0) {
          el.textContent = `Grave ≥ ${guard * 3}   ·   Extra ≥ ${guard * 4}`;
        } else {
          el.textContent = '';
        }
      };
      renderGuardThresholds();

      // Re-render thresholds when guard input changes
      html.on('change', 'input[name="system.guard"]', () => {
        setTimeout(renderGuardThresholds, 100);
      });
    }

    // Inject battle strip + Pokemon window styles once
    if (!document.getElementById('stryder-battle-system-styles')) {
      const style = document.createElement('style');
      style.id = 'stryder-battle-system-styles';
      style.textContent = `
        /* ── Armament + Battle Row ── */
        .jrpg-battle-armament-bar {
          padding: 4px 0 2px;
        }
        .jrpg-battle-engage-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          align-items: stretch;
          min-height: 60px;
          height: auto;
        }
        .jrpg-battle-left-btns {
          display: grid;
          grid-template-rows: 1fr 1fr;
          gap: 5px;
          min-height: 0;
        }

        /* Form Select Button */
        .jrpg-form-select-wrap {
          position: relative;
          min-height: 0;
        }
        .jrpg-form-select-btn {
          width: 100%; height: 100%;
          background: rgba(30,20,60,0.8);
          border: 1px solid rgba(100,80,180,0.45);
          border-radius: 5px;
          color: #c8b8f0;
          font-family: 'Cinzel', serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.09em; text-transform: uppercase;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 0 10px; box-sizing: border-box;
          transition: background 0.12s;
        }
        .jrpg-form-select-btn:hover { background: rgba(50,35,90,0.9); }
        .jrpg-form-select-icon { opacity: 0.55; font-size: 11px; }

        /* Aspect Select Button */
        .jrpg-aspect-select-btn {
          width: 100%; height: 100%;
          background: rgba(20,40,60,0.8);
          border: 1px solid rgba(60,120,200,0.4);
          border-radius: 5px;
          color: #a8d4ff;
          font-family: 'Cinzel', serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.09em; text-transform: uppercase;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 0 10px; box-sizing: border-box;
          transition: background 0.12s;
        }
        .jrpg-aspect-select-btn:hover { background: rgba(25,55,90,0.9); }
        .jrpg-aspect-select-icon { opacity: 0.55; font-size: 11px; }

        /* Shared dropdown */
        .jrpg-form-dropdown {
          display: none;
          position: absolute;
          top: calc(100% + 4px);
          left: 0; right: 0;
          z-index: 9999;
          background: #141c30;
          border: 1px solid rgba(100,80,200,0.5);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.75);
        }
        .jrpg-form-dropdown.open { display: block; }
        .jrpg-form-dropdown-item {
          padding: 7px 12px;
          font-family: 'Cinzel', serif;
          font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
          color: #c8b8f0; cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: background 0.1s;
        }
        .jrpg-form-dropdown-item:last-child { border-bottom: none; }
        .jrpg-form-dropdown-item:hover { background: rgba(255,255,255,0.07); }
        .jrpg-form-dropdown-item.active { background: rgba(100,80,180,0.15); }

        /* ── Battle! Button ── */
        .jrpg-battle-engage-btn {
          display: block; width: 100%; padding: 5px 0;
          background: linear-gradient(135deg, #c8960a 0%, #e8b822 40%, #a87008 100%);
          border: 1px solid rgba(255,220,80,0.75); border-radius: 6px;
          color: #1a0e00; font-size: 13px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          text-shadow: 0 1px 2px rgba(255,240,140,0.30); cursor: pointer;
          box-shadow: 0 0 12px rgba(220,160,20,0.45), inset 0 1px 0 rgba(255,240,120,0.35);
          transition: all 0.15s ease;
        }
        .jrpg-battle-engage-btn:hover {
          background: linear-gradient(135deg, #e0aa10 0%, #ffd740 40%, #c08000 100%);
          border-color: rgba(255,230,100,0.95); color: #0d0800;
          box-shadow: 0 0 22px rgba(240,180,20,0.70), inset 0 1px 0 rgba(255,250,150,0.45);
        }
        /* Right-side battle button group — fills the grid cell, stacks two buttons equally */
        .jrpg-battle-right-btns {
          display: grid;
          grid-template-rows: 1fr 1fr;
          gap: 5px;
          min-height: 0;
        }
        .jrpg-battle-right-btns > button {
          width: 100%;
          height: 100%;
          min-height: 26px;
          box-sizing: border-box;
        }

        /* ── Focused Attack Button ── */
        .jrpg-focused-atk-btn {
          display: block; width: 100%; padding: 5px 12px;
          background: linear-gradient(135deg, rgba(20,60,120,0.85) 0%, rgba(30,80,160,0.85) 50%, rgba(15,45,100,0.85) 100%);
          border: 1px solid rgba(100,170,255,0.55); border-radius: 6px;
          color: rgba(180,220,255,0.95); font-size: 12px; font-weight: 700;
          letter-spacing: 0.10em; text-transform: uppercase; cursor: pointer;
          box-shadow: 0 0 10px rgba(80,140,255,0.3), inset 0 1px 0 rgba(150,200,255,0.2);
          transition: all 0.15s ease; font-family: 'Cinzel', serif;
          white-space: nowrap;
        }
        .jrpg-focused-atk-btn:hover {
          background: linear-gradient(135deg, rgba(25,75,150,0.95) 0%, rgba(40,100,200,0.95) 50%, rgba(20,60,130,0.95) 100%);
          border-color: rgba(130,195,255,0.85);
          box-shadow: 0 0 18px rgba(100,170,255,0.5), inset 0 1px 0 rgba(180,220,255,0.3);
        }

        /* ── Summoner: The Binding Gates ── */
        .summoner-gates-row {
          display: flex; gap: 6px; margin: 0 0 8px 0;
        }
        .summoner-gates-row > button {
          flex: 1; padding: 6px 12px;
          border-radius: 6px; cursor: pointer;
          font-family: 'Cinzel', serif; font-size: 11px; font-weight: 700;
          letter-spacing: 0.10em; text-transform: uppercase;
          transition: all 0.15s ease; white-space: nowrap;
        }
        .summoner-btn-icon { opacity: 0.6; font-size: 10px; }
        .summoner-summon-button {
          background: linear-gradient(135deg, rgba(110,20,40,0.85) 0%, rgba(160,35,60,0.85) 50%, rgba(85,15,35,0.85) 100%);
          border: 1px solid rgba(255,110,140,0.55);
          color: rgba(255,195,210,0.95);
          box-shadow: 0 0 10px rgba(220,60,100,0.3), inset 0 1px 0 rgba(255,160,180,0.2);
        }
        .summoner-summon-button:hover {
          background: linear-gradient(135deg, rgba(140,25,50,0.95) 0%, rgba(200,45,80,0.95) 50%, rgba(110,20,45,0.95) 100%);
          border-color: rgba(255,140,170,0.85);
          box-shadow: 0 0 18px rgba(240,80,120,0.5), inset 0 1px 0 rgba(255,190,205,0.3);
        }
        .summoner-dismiss-button {
          background: linear-gradient(135deg, rgba(35,30,60,0.85) 0%, rgba(55,48,90,0.85) 50%, rgba(28,24,50,0.85) 100%);
          border: 1px solid rgba(150,130,220,0.40);
          color: rgba(200,184,240,0.90);
          box-shadow: 0 0 8px rgba(100,80,180,0.25), inset 0 1px 0 rgba(180,160,240,0.15);
        }
        .summoner-dismiss-button:hover {
          background: linear-gradient(135deg, rgba(48,40,82,0.95) 0%, rgba(72,62,118,0.95) 50%, rgba(38,32,68,0.95) 100%);
          border-color: rgba(175,155,245,0.70);
          box-shadow: 0 0 14px rgba(120,100,210,0.40), inset 0 1px 0 rgba(200,180,255,0.25);
        }
        .summoner-generate-button {
          background: linear-gradient(135deg, rgba(20,55,45,0.85) 0%, rgba(30,80,65,0.85) 50%, rgba(15,45,38,0.85) 100%);
          border: 1px solid rgba(80,180,140,0.40);
          color: rgba(160,230,200,0.90);
          box-shadow: 0 0 8px rgba(40,140,100,0.20), inset 0 1px 0 rgba(120,210,170,0.15);
        }
        .summoner-generate-button:hover {
          background: linear-gradient(135deg, rgba(28,72,58,0.95) 0%, rgba(42,105,85,0.95) 50%, rgba(22,60,50,0.95) 100%);
          border-color: rgba(100,210,165,0.70);
          box-shadow: 0 0 14px rgba(50,175,130,0.35), inset 0 1px 0 rgba(150,240,200,0.20);
        }

        /* ── Turn Start / Combat End — top bar ── */
        .jrpg-battle-turn-btns {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-left: 1px solid rgba(100,80,180,0.30);
          padding: 0 12px;
          gap: 6px;
        }

        /* ── Pokemon Battle Window ── */
        #stryder-pokemon-battle {
          position: fixed; bottom: 0; left: 0; right: 0;
          height: 26vh; min-height: 160px; max-height: 220px;
          z-index: 9000;
          background: linear-gradient(180deg, #0d1929 0%, #080f1a 100%);
          border-top: 2px solid rgba(80,160,255,0.35);
          box-shadow: 0 -8px 32px rgba(0,0,0,0.8), 0 -2px 0 rgba(80,160,255,0.15);
          display: flex; flex-direction: column;
          font-family: inherit; user-select: none;
          transition: max-height 0.2s ease;
        }
        #stryder-pokemon-battle.minimized {
          max-height: 32px; min-height: 32px;
        }

        /* Header */
        .spb-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 5px 12px 4px;
          border-bottom: 1px solid rgba(80,160,255,0.15);
          flex-shrink: 0; height: 32px; box-sizing: border-box;
        }
        .spb-actor-name {
          font-size: 11px; font-weight: 700; color: #a8d4ff;
          letter-spacing: 0.1em; text-transform: uppercase;
          text-shadow: 0 0 8px rgba(100,180,255,0.4);
        }
        .spb-initiative-badge {
          font-size: 10px; color: rgba(168,212,255,0.6);
          background: rgba(80,160,255,0.1); border: 1px solid rgba(80,160,255,0.2);
          border-radius: 4px; padding: 1px 7px; letter-spacing: 0.05em;
        }
        .spb-header-controls { display: flex; align-items: center; gap: 8px; }
        .spb-minimize-btn, .spb-close-btn {
          background: none; border: none;
          color: rgba(168,212,255,0.4); cursor: pointer;
          padding: 0 2px; line-height: 1;
        }
        .spb-minimize-btn { font-size: 16px; font-family: sans-serif; }
        .spb-close-btn    { font-size: 14px; }
        .spb-minimize-btn:hover { color: #a8d4ff; }
        .spb-close-btn:hover    { color: #ffaaaa; }

        /* Body — hides when minimized */
        .spb-body {
          flex: 1; overflow: hidden; display: flex; flex-direction: column;
        }
        #stryder-pokemon-battle.minimized .spb-body { display: none; }

        /* Main 2×2 button grid */
        .spb-main-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 10px;
          padding: 10px 12px 12px;
          flex: 1;
          min-height: 0;
        }
        .spb-big-btn {
          font-family: 'Cinzel', serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.10em; text-transform: uppercase;
          border-radius: 6px; cursor: pointer; border: 1px solid;
          transition: filter 0.12s ease;
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
        }
        .spb-big-btn:hover { filter: brightness(1.35); border-color: rgba(100,150,255,0.50); }
        .spb-big-btn.skills  { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #ff9090; }
        .spb-big-btn.defend  { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #90c8ff; }
        .spb-big-btn.items   { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #ffd880; }
        .spb-big-btn.actions { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #c890ff; }

        /* Sub-panels */
        .spb-panel {
          display: none; flex-direction: column; flex: 1; overflow: hidden;
        }
        .spb-panel.active { display: flex; }
        .spb-panel-header {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 10px; flex-shrink: 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .spb-panel-title {
          font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase;
        }
        .spb-panel.skills  .spb-panel-header { border-bottom-color: rgba(200,60,60,0.2); }
        .spb-panel.skills  .spb-panel-title  { color: #ffaaaa; }
        .spb-panel.defend  .spb-panel-header { border-bottom-color: rgba(50,120,200,0.2); }
        .spb-panel.defend  .spb-panel-title  { color: #a8d4ff; }
        .spb-panel.items   .spb-panel-header { border-bottom-color: rgba(180,120,20,0.25); }
        .spb-panel.items   .spb-panel-title  { color: #ffd880; }
        .spb-panel.actions .spb-panel-header { border-bottom-color: rgba(120,60,200,0.25); }
        .spb-panel.actions .spb-panel-title  { color: #d0a8ff; }

        .spb-back-btn {
          font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 2px 8px; border-radius: 4px;
          cursor: pointer; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12); color: rgba(200,220,255,0.6);
          transition: background 0.1s, color 0.1s;
        }
        .spb-back-btn:hover { background: rgba(255,255,255,0.10); color: #fff; }

        .spb-panel-list {
          flex: 1; overflow-y: auto; padding: 4px 8px;
        }
        .spb-panel-list::-webkit-scrollbar { width: 4px; }
        .spb-panel-list::-webkit-scrollbar-track { background: transparent; }
        .spb-panel-list::-webkit-scrollbar-thumb { background: rgba(80,160,255,0.25); border-radius: 2px; }

        /* Items inside panels */
        .spb-item {
          display: flex; align-items: center; gap: 8px;
          padding: 4px 6px; border-radius: 4px; cursor: pointer;
          transition: background 0.1s;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .spb-item:hover { background: rgba(255,255,255,0.06); }
        .spb-item img { width: 20px; height: 20px; object-fit: contain; border-radius: 2px; flex-shrink: 0; }
        .spb-item-name { font-size: 11px; color: rgba(200,230,255,0.85); flex: 1; }
        .spb-item-tag {
          font-size: 9px; color: rgba(140,200,255,0.55);
          background: rgba(80,160,255,0.07); border: 1px solid rgba(80,160,255,0.15);
          border-radius: 3px; padding: 0 4px; letter-spacing: 0.05em; text-transform: uppercase;
        }
        .spb-item-limit {
          font-size: 9px; color: rgba(255,200,100,0.65);
          background: rgba(255,160,40,0.08); border: 1px solid rgba(255,160,40,0.2);
          border-radius: 3px; padding: 0 4px;
        }

        /* Defense rows — big buttons */
        .spb-def-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 10px;
          padding: 10px 12px 12px;
          flex: 1;
          min-height: 0;
        }
        .spb-def-row {
          font-family: 'Cinzel', serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.10em; text-transform: uppercase;
          border-radius: 6px; cursor: pointer; border: 1px solid;
          transition: filter 0.12s ease;
          width: 100%; height: 100%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 6px;
        }
        .spb-def-row:hover { filter: brightness(1.35); border-color: rgba(100,150,255,0.50); }
        .spb-def-formula { font-size: 9px; font-family: monospace; opacity: 0.65; letter-spacing: 0.05em; text-transform: none; }
        .spb-def-row.spb-def-dodge   { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #80d4d4; }
        .spb-def-row.spb-def-evade   { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #80d4a4; }
        .spb-def-row.spb-def-mresist { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #d0a8ff; }
        .spb-def-row.spb-def-presist { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #a0c8d4; }

        /* Block button (Dual Wield) — lives inside spb-def-grid, spans both columns */
        .spb-def-grid.has-block { grid-template-rows: 1fr 1fr 1fr; }
        .spb-def-row.spb-block-btn { background: #080f1e; border-color: rgba(80,120,200,0.30); color: #a8d4ff; }

        .spb-empty {
          text-align: center; padding: 16px 0; font-size: 10px;
          color: rgba(140,200,255,0.3); letter-spacing: 0.05em;
        }
      `;
      document.head.appendChild(style);
    }

    // --- Battle Tab: Resource Pip Rendering ---
    function renderBattlePips(html) {
      // Elixir Sickness pips — orange diamonds (max 5)
      html.find('.jrpg-skull-pips').each(function() {
        const val = parseInt(this.dataset.val) || 0;
        const max = 5;
        this.innerHTML = '';
        for (let i = 0; i < max; i++) {
          const pip = document.createElement('div');
          pip.className = 'jrpg-pip jrpg-skull-pip' + (i < val ? ' filled' : '');
          this.appendChild(pip);
        }
      });
    }

    renderBattlePips(html);

    // Apply aspect-inactive styling based on data-active-aspect attribute
    html[0].querySelectorAll('[data-active-aspect]').forEach(li => {
      const isActive = li.dataset.activeAspect === 'true';
      li.classList.toggle('stryder-aspect-inactive', !isActive);
    });

    // JRPG Main Menu navigation — persist page across re-renders
    const _isTemperingSubPage = (t) => t === 'soul-armament' || t === 'growth';

    const _showPage = (target, label) => {
      this._jrpgPage = target;
      this._jrpgPageLabel = label;
      html.find('.jrpg-main-screen').hide();
      const subScreen = html.find('.jrpg-sub-screen');
      subScreen.show();
      subScreen.toggleClass('is-tempering', target === 'tempering' || _isTemperingSubPage(target));
      subScreen.toggleClass('is-growth', target === 'growth');
      html.find('.jrpg-sub-title').text(label);
      html.find('.jrpg-page').hide();
      html.find(`.jrpg-page[data-page="${target}"]`).show();
      // Show "← Tempering" only on soul-armament / growth; hide main back btn
      html.find('.jrpg-back-btn').toggle(!_isTemperingSubPage(target));
      html.find('.jrpg-back-to-tempering-btn').toggle(_isTemperingSubPage(target));
      if (target === 'growth') this._buildGrowthPage(html);
    };

    html.find('.jrpg-menu-btn').on('click', function() {
      _showPage($(this).data('target'), $(this).find('span').text());
    });

    // Tempering nav — Soul Armament and Growth are full _showPage() pages
    html.find('.jrpg-temp-nav-btn').click(ev => {
      const target = ev.currentTarget.dataset.temperingPage;
      const label = target === 'soul-armament' ? 'Soul Armament' : 'Growth';
      _showPage(target, label);
    });

    // Open Soul Armament page from Battle tab armament strip
    html.on('click', '[data-action="openSoulArmament"]', () => {
      _showPage('soul-armament', 'Soul Armament');
    });

    // ── Battle Form Select ──
    const FORM_LABELS = {
      one_handed: '1-Handed',
      two_handed: '2-Handed',
      dual_wield: 'Dual Wield',
      ingrained:  'Ingrained',
      attached:   'Attached',
    };

    const _getUnlockedForms = () => {
      const form = this.actor.system.soul_armament?.form ?? {};
      return Object.entries(FORM_LABELS)
        .filter(([key]) => !!form[key])
        .map(([key, label]) => ({ key, label }));
    };

    const _getActiveBattleForm = () =>
      this.actor.getFlag(SYSTEM_ID, 'activeBattleForm') ?? null;

    const _refreshFormBtn = () => {
      const btn = html.find('.jrpg-form-select-label')[0];
      if (!btn) return;
      const forms   = _getUnlockedForms();
      const active  = _getActiveBattleForm();
      const current = forms.find(f => f.key === active) ?? forms[0];
      btn.textContent = current ? current.label : 'No Form';
    };

    const _closeFormDropdown = () => {
      html.find('.jrpg-form-dropdown').removeClass('open');
    };

    _refreshFormBtn();

    html.on('click', '[data-action="toggleFormDropdown"]', (ev) => {
      ev.stopPropagation();
      const dropdown = html.find('#jrpg-form-dropdown');
      const isOpen   = dropdown.hasClass('open');

      if (!isOpen) {
        const forms  = _getUnlockedForms();
        const active = _getActiveBattleForm() ?? forms[0]?.key;
        dropdown.html(
          forms.map(f => `
            <div class="jrpg-form-dropdown-item ${f.key === active ? 'active' : ''}"
                 data-form-key="${f.key}">
              ⚔ ${f.label}
            </div>`).join('') ||
          '<div class="jrpg-form-dropdown-item" style="opacity:0.45;cursor:default;">No forms unlocked</div>'
        );
      }

      dropdown.toggleClass('open', !isOpen);
    });

    html.on('click', '.jrpg-form-dropdown-item', async (ev) => {
      ev.stopPropagation();
      const key = ev.currentTarget.dataset.formKey;
      if (!key) return;
      await this.actor.setFlag(SYSTEM_ID, 'activeBattleForm', key);
      _closeFormDropdown();
      _refreshFormBtn();
    });

    // Close dropdown when clicking outside
    $(document).on('click.battleFormDropdown', () => _closeFormDropdown());

    // ── Aspect Select ──
    // Update button label if an aspect is already active
    {
      const current = this.actor.getFlag('stryder', 'activeAspect') ?? null;
      const lbl = html[0].querySelector('.jrpg-aspect-select-label');
      if (lbl) lbl.textContent = current ? current.replace('Aspect of ', '') : 'Select Aspect';
    }

    html.on('click', '[data-action="openAspectSelect"]', async (ev) => {
      const actor = this.actor;

      // Derive unlocked aspects from stamped items
      const unlockedMap = new Map(); // aspectName → display label
      for (const item of actor.items) {
        const asp = item.flags?.stryder?.aspectName;
        if (asp && !unlockedMap.has(asp)) {
          unlockedMap.set(asp, asp.replace('Aspect of ', ''));
        }
      }

      // Fallback: if no stamped items yet, load compendium and match by name (migration path)
      if (!unlockedMap.size) {
        const aspectPack = game.packs.get('stryder.stryder-actions');
        if (aspectPack) {
          const aspectDocs = await aspectPack.getDocuments();
          // Build folder map
          const folderMap = {};
          (aspectPack.folders?.contents ?? []).forEach(f => {
            folderMap[f.id] = { name: f.name, parentId: f.folder?.id ?? null };
          });
          const PARENT_FOLDERS = new Set(['MrtalAspFolder01','ImmrtAspFolder01','SprBstAbilFolder']);

          // Group by aspect folder
          const groups = {};
          for (const doc of aspectDocs) {
            const fId = typeof doc.folder === 'string' ? doc.folder : doc.folder?.id ?? null;
            if (!fId || PARENT_FOLDERS.has(fId) || !folderMap[fId]) continue;
            if (!groups[fId]) groups[fId] = { name: folderMap[fId].name, names: new Set() };
            groups[fId].names.add(doc.name);
          }

          // Find actor items matching any aspect ability name and stamp them
          const stampPromises = [];
          for (const [fId, group] of Object.entries(groups)) {
            for (const actorItem of actor.items) {
              if (actorItem.type === 'action'
                  && !actorItem.flags?.stryder?.aspectName
                  && !actorItem.flags?.stryder?.isTechnique
                  && actorItem.flags?.stryder?.xpCost === undefined
                  && group.names.has(actorItem.name)) {
                stampPromises.push(actorItem.update({ 'flags.stryder.aspectName': group.name }));
                unlockedMap.set(group.name, group.name.replace('Aspect of ', ''));
              }
            }
          }
          if (stampPromises.length) await Promise.all(stampPromises);
        }
      }

      if (!unlockedMap.size) {
        // Self-heal pre-existing stuck state: an activeAspect flag with no
        // owning items (e.g. a Core Aspect was deleted before the deleteItem
        // hook existed). Clear it here so the sheet no longer needs a JSON edit.
        if (actor.getFlag('stryder', 'activeAspect')) {
          await actor.unsetFlag('stryder', 'activeAspect');
          const lbl = ev.currentTarget?.querySelector('.jrpg-aspect-select-label');
          if (lbl) lbl.textContent = 'Select Aspect';
          ui.notifications.info('Active Aspect cleared — no Aspect abilities remain on this sheet.');
        } else {
          ui.notifications.warn('No Aspects unlocked yet — purchase a Core Skillset from the Growth menu first.');
        }
        return;
      }

      // Toggle: close if already open
      const existing = document.getElementById('stryder-aspect-popover');
      if (existing) { existing.remove(); return; }

      const activeAspect = actor.getFlag('stryder', 'activeAspect') ?? null;
      const btn = ev.currentTarget;
      const rect = btn.getBoundingClientRect();

      const pop = document.createElement('div');
      pop.id = 'stryder-aspect-popover';
      Object.assign(pop.style, {
        position: 'fixed', zIndex: '10000',
        left: rect.left + 'px', top: (rect.bottom + 4) + 'px',
        minWidth: '200px',
        background: 'rgba(4,8,24,0.97)',
        border: '1px solid rgba(60,100,200,0.45)',
        borderRadius: '6px', padding: '6px',
        boxShadow: '0 6px 24px rgba(0,0,80,0.55)',
        fontFamily: "'Cinzel',serif",
      });

      // Header
      const header = document.createElement('div');
      header.textContent = 'Active Aspect';
      Object.assign(header.style, {
        fontSize: '9px', letterSpacing: '.18em', textTransform: 'uppercase',
        color: 'rgba(130,160,220,0.45)', padding: '4px 10px 6px',
        borderBottom: '1px solid rgba(50,80,180,0.2)', marginBottom: '4px',
      });
      pop.appendChild(header);

      // One row per unlocked aspect
      for (const [asp, label] of [...unlockedMap.entries()].sort((a,b) => a[0].localeCompare(b[0]))) {
        const row = document.createElement('button');
        row.type = 'button';
        row.textContent = label;
        const isActive = asp === activeAspect;
        Object.assign(row.style, {
          display: 'block', width: '100%',
          background: isActive ? 'rgba(35,70,170,0.45)' : 'transparent',
          border: isActive ? '1px solid rgba(80,140,255,0.5)' : '1px solid transparent',
          borderRadius: '4px', padding: '6px 12px', marginBottom: '2px',
          color: isActive ? '#b0d4ff' : 'rgba(180,210,255,0.72)',
          fontFamily: "'Cinzel',serif", fontSize: '11px',
          cursor: 'pointer', textAlign: 'left',
        });
        row.addEventListener('click', async () => {
          await actor.setFlag('stryder', 'activeAspect', asp);
          const lbl = btn.querySelector('.jrpg-aspect-select-label');
          if (lbl) lbl.textContent = label;
          pop.remove();
        });
        pop.appendChild(row);
      }

      // Clear selection
      if (activeAspect) {
        const clearRow = document.createElement('button');
        clearRow.type = 'button';
        clearRow.textContent = '— No Active Aspect';
        Object.assign(clearRow.style, {
          display: 'block', width: '100%',
          background: 'transparent',
          border: '1px solid rgba(120,50,50,0.35)',
          borderRadius: '4px', padding: '5px 12px', marginTop: '4px',
          color: 'rgba(200,110,100,0.65)',
          fontFamily: "'Cinzel',serif", fontSize: '10px',
          cursor: 'pointer', textAlign: 'left',
        });
        clearRow.addEventListener('click', async () => {
          await actor.unsetFlag('stryder', 'activeAspect');
          const lbl = btn.querySelector('.jrpg-aspect-select-label');
          if (lbl) lbl.textContent = 'Select Aspect';
          pop.remove();
        });
        pop.appendChild(clearRow);
      }

      document.body.appendChild(pop);

      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', function _close(e) {
          if (!pop.contains(e.target) && e.target !== btn) {
            pop.remove();
            document.removeEventListener('click', _close);
          }
        });
      }, 0);
    });

    // Soul Armament option row clicks
    html.find('.sa-option').click(async ev => {
      const opt = ev.currentTarget;
      const field = opt.dataset.field;
      const value = opt.dataset.value;
      if (field === 'form') {
        const current = this.actor.system.soul_armament?.form?.[value] ?? false;
        await this.actor.update({ [`system.soul_armament.form.${value}`]: !current });
      } else {
        await this.actor.update({ [`system.soul_armament.${field}`]: value });
      }
    });

    // XP bar fill
    const xpFill = html[0].querySelector('.jrpg-temp-xp-bar-fill');
    if (xpFill) {
      const xpVal = parseInt(xpFill.dataset.val) || 0;
      const xpMax = parseInt(xpFill.dataset.max) || 1;
      xpFill.style.width = Math.min(100, (xpVal / xpMax) * 100) + '%';
    }

    // Soul Armament — floating particle background.
    // Uses a deterministic hash keyed on particle index + salt so that
    // every re-render produces identical particle configs (no visual jump
    // when actor.update() triggers a sheet re-render mid-animation).
    const saParticlesWrap = html[0].querySelector('.sa-particles-wrap');
    if (saParticlesWrap) {
      // Deterministic [0,1) value for particle i with salt s
      const _saH = (i, s) =>
        (((i * 1664525 + s * 22695477 + 1013904223) & 0x7FFFFFFF) % 10000) / 10000;

      // Inject per-particle move keyframes once per document lifetime
      const _saStyleId = 'sa-particle-keyframes';
      if (!document.getElementById(_saStyleId)) {
        const style = document.createElement('style');
        style.id = _saStyleId;
        let css = '';
        for (let i = 1; i <= 100; i++) {
          const sX = Math.floor(_saH(i, 5) * 100);
          const eX = Math.floor(_saH(i, 6) * 100);
          const sY = 100 + Math.floor(_saH(i, 7) * 10);
          const eY = -(sY + Math.floor(_saH(i, 8) * 30));
          css += `@keyframes sa-move-frames-${i}{` +
                 `from{transform:translate3d(${sX}vw,${sY}vh,0)}` +
                 `to{transform:translate3d(${eX}vw,${eY}vh,0)}}`;
        }
        style.textContent = css;
        document.head.appendChild(style);
      }

      // (Re-)populate particle DOM — deterministic values mean this is
      // visually identical on every re-render
      saParticlesWrap.innerHTML = '';
      for (let i = 1; i <= 100; i++) {
        const sz  = 1 + Math.floor(_saH(i, 1) * 10);
        const dur = 7000 + Math.floor(_saH(i, 2) * 4000);
        const del = Math.floor(_saH(i, 3) * 11000);
        const cdl = Math.floor(_saH(i, 4) * 4000);
        const ctr = document.createElement('div');
        ctr.className = 'sa-circle-container';
        ctr.style.cssText =
          `width:${sz}px;height:${sz}px;` +
          `animation-name:sa-move-frames-${i};` +
          `animation-duration:${dur}ms;animation-delay:${del}ms;`;
        const circ = document.createElement('div');
        circ.className = 'sa-circle';
        circ.style.animationDelay = `${cdl}ms`;
        ctr.appendChild(circ);
        saParticlesWrap.appendChild(ctr);
      }
    }

    html.find('.jrpg-effects-btn').on('click', () => {
      _showPage('effects', 'Effects');
    });

    html.find('.jrpg-back-btn').on('click', () => {
      this._jrpgPage = null;
      this._jrpgPageLabel = null;
      html.find('.jrpg-sub-screen').hide();
      html.find('.jrpg-main-screen').show();
    });

    html.find('.jrpg-back-to-tempering-btn').on('click', () => {
      _showPage('tempering', 'Tempering');
    });

    // Restore sub-page if a re-render happened while one was open
    if (this._jrpgPage) {
      _showPage(this._jrpgPage, this._jrpgPageLabel || '');
      // Growth page needs async rebuild on every re-render
      if (this._jrpgPage === 'growth') this._buildGrowthPage(html);
    }

    // JRPG resource bar widths
    const _a = this.actor;
    const _resolveMax = (v) => (v !== null && typeof v === 'object') ? (v.value ?? 0) : (v ?? 0);
    const _bar = (sel, cur, max) => {
      const el = html[0].querySelector(sel);
      const maxVal = _resolveMax(max);
      if (el && maxVal > 0) el.style.width = Math.min(100, (cur / maxVal) * 100) + '%';
    };
    _bar('.hp-fill',  _a.system.health.value,  _a.system.health.max);
    _bar('.mp-fill',  _a.system.mana.value,    _a.system.mana.max);
    _bar('.sp-fill',  _a.system.stamina.value, _a.system.stamina.max);
    // *-pfill bars (main-menu card) now use baked-in inline styles from getData().

	this._restoreSectionStates(html);

	  html.find('.item-name').click(ev => {
		this.toggleItems(ev.currentTarget);
	  });

	  // Handle clicks on the entire items-header ONLY for attribute modifications section
	  html.find('.attribute-modification-section .items-header').click(ev => {
		// Only handle if the click wasn't already handled by .item-name
		if (ev.target.closest('.item-name')) return;
		this.toggleItems(ev.currentTarget.querySelector('.item-name'));
	  });

    // Skill favorite toggle — adds/removes from actor's favorites flag
    html.on('click', '.skill-favorite-toggle', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const itemId  = ev.currentTarget.dataset.itemId;
      const current = new Set(this.actor.getFlag('stryder', 'favorites') || []);
      if (current.has(itemId)) current.delete(itemId);
      else current.add(itemId);
      await this.actor.setFlag('stryder', 'favorites', [...current]);
    });

    // Right-click any item row → post its name + description to chat (RP / reference).
    // Resolves the nearest element carrying a data-item-id; left native menus in
    // text fields alone.
    html.on('contextmenu', '[data-item-id]', async (ev) => {
      if (ev.target.closest('input, textarea, [contenteditable="true"]')) return;
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      if (!item) return;
      ev.preventDefault();
      ev.stopPropagation();
      const desc = (item.system?.description ?? '').trim() || '<em>No description.</em>';
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="chat-message-card"><div class="chat-message-header"><h3 class="chat-message-title">${item.name}</h3></div><div class="chat-message-content">${desc}</div></div>`,
      });
    });

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });

    // Spirit Beast ability use — Stamina cost to linked Summoner + gate extras
    html.on('click', '.spirit-beast-ability-use', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ability = ev.currentTarget.dataset.ability;
      if (!ability) return;
      const { useSpiritAbility } = await import('../abilities/summoner-abilities.mjs');
      await useSpiritAbility(this.actor, ability);
    });

    // Summoner — The Binding Gates
    html.on('click', '.summoner-summon-button', async (ev) => {
      ev.preventDefault();
      const { openSummonDialog } = await import('../abilities/summoner-abilities.mjs');
      await openSummonDialog(this.actor);
    });
    html.on('click', '.summoner-dismiss-button', async (ev) => {
      ev.preventDefault();
      const { requestDismiss } = await import('../abilities/summoner-abilities.mjs');
      await requestDismiss(this.actor);
    });
    html.on('click', '.summoner-generate-button', async (ev) => {
      ev.preventDefault();
      const { generateSpiritBeasts } = await import('../abilities/summoner-abilities.mjs');
      await generateSpiritBeasts(this.actor);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Spark checkbox - when all 5 are checked, reset them and increment Mastery Points.
    // NOTE: Foundry's _onChangeInput is suppressed for .jrpg-spark inputs (see override
    // below), so this handler is solely responsible for persisting all spark changes.
    html.on('change', '.jrpg-spark', async (ev) => {
      const allSparks = html.find('.jrpg-spark');
      const allChecked = allSparks.toArray().every(cb => cb.checked);
      if (allChecked) {
        const currentMastery = this.actor.system.masteryPoints?.essence || 0;
        await this.actor.update({
          'system.sparks.spark1': false,
          'system.sparks.spark2': false,
          'system.sparks.spark3': false,
          'system.sparks.spark4': false,
          'system.sparks.spark5': false,
          'system.masteryPoints.essence': currentMastery + 1
        });
      } else {
        // Save individual spark toggle manually since Foundry's handler is bypassed
        const updateData = {};
        updateData[ev.currentTarget.name] = ev.currentTarget.checked;
        await this.actor.update(updateData);
      }
    });

    // Battle Tab resource inputs (HP/MP/STA) use data-field instead of name to avoid
    // duplicate-name conflicts with the Character tab's identical inputs. Both pages live
    // in the same <form> simultaneously; the hidden Character tab inputs would race with
    // these and snap values back. We own the update here, bypassing form submission.
    html.on('change', '.jrpg-battle-res-num[data-field]', foundry.utils.debounce(async (ev) => {
      const field = ev.currentTarget.dataset.field;
      const value = Number(ev.currentTarget.value) || 0;
      await this.actor.update({ [field]: value });
    }, 150));

    // Elixir Sickness pip click — clicking pip at index i sets value to i+1;
    // clicking the already-last-filled pip decrements by 1 (allows toggling down).
    html.on('click', '.jrpg-skull-pip', async (ev) => {
      const pip = ev.currentTarget;
      const pips = Array.from(pip.parentElement.querySelectorAll('.jrpg-skull-pip'));
      const index = pips.indexOf(pip);
      const currentVal = parseInt(this.actor.system.elixir_sickness?.value) || 0;
      const newVal = currentVal === index + 1 ? index : index + 1;
      await this.actor.update({ 'system.elixir_sickness.value': Math.max(0, Math.min(5, newVal)) });
    });

    // Add Inventory Item
    // Spirit Beast ability edit toggle
    html.on('click', '.spirit-beast-ability-edit', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ability = ev.currentTarget.dataset.ability;
      html.find(`.ability-editor[data-ability="${ability}"]`).toggle();
      html.find(`.ability-description-display[data-ability="${ability}"]`).toggle();
    });

    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // Inventory grid — click the icon/start cell to open item popup
    html.on('click', '.inv-slot.inv-item[data-clickable="true"]', this._onInventoryItemClick.bind(this));

    // Inventory slot hover glow — direct binding so mouseleave fires reliably
    html.find('.inv-slot.inv-empty').on('mouseenter', function() {
      this.style.transition  = 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease';
      this.style.background  = 'rgba(18,28,65,0.85)';
      this.style.borderColor = 'rgba(80,140,255,0.7)';
      this.style.boxShadow   = 'inset 0 0 0 1px rgba(80,140,255,0.4), inset 0 0 18px rgba(42,112,224,0.18)';
    }).on('mouseleave', function() {
      this.style.background  = 'rgba(8,14,35,0.6)';
      this.style.borderColor = 'rgba(60,90,160,0.18)';
      this.style.boxShadow   = 'none';
    });

    html.find('.inv-slot.inv-item').on('mouseenter', function() {
      this.style.transition = 'box-shadow 0.18s ease, filter 0.18s ease';
      this.style.boxShadow  = 'inset 0 0 0 1px rgba(55,138,221,0.6), inset 0 0 18px rgba(42,112,224,0.18)';
      this.style.filter     = 'brightness(1.2)';
    }).on('mouseleave', function() {
      this.style.boxShadow  = 'none';
      this.style.filter     = 'brightness(1)';
    });

    // Visual drag-over feedback on the inventory grid
    html.find('.jrpg-inv-grid').on('dragover', (e) => {
      e.preventDefault();
      html.find('.jrpg-inv-grid').addClass('drag-over');
    }).on('dragleave drop', () => {
      html.find('.jrpg-inv-grid').removeClass('drag-over');
    });

    // Inventory grid — empty slot click opens item creator dialog
    html.on('click', '[data-action="addItemFromSlot"]', async () => {
      const actor = this.actor;

      // ── Load compendium index ──────────────────────────────────────────────
      const INV_PACKS = ['stryder.stryder-loot', 'stryder.stryder-elixirs', 'stryder.stryder-armor'];
      const INV_TYPES = new Set(['gear','consumable','component','loot','head','back','arms','legs','gems']);
      const compItems = [];
      for (const packId of INV_PACKS) {
        const pack = game.packs.get(packId);
        if (!pack) continue;
        const idx = await pack.getIndex({ fields: ['name','type','img'] });
        for (const e of idx) compItems.push({ ...e, packId });
      }
      compItems.sort((a, b) => a.name.localeCompare(b.name));

      const rowHTML = (items) => items.length
        ? items.map(it => `
          <button type="button" class="inv-browse-row"
               data-pack-id="${it.packId}" data-item-id="${it._id}">
            <img src="${it.img || 'icons/svg/item-bag.svg'}">
            <span class="bname">${it.name}</span>
            <span class="btype">${it.type}</span>
          </button>`).join('')
        : `<div class="sty-dlg-hint" style="padding:10px;text-align:center;">No items found</div>`;

      const content = `<div>

        <!-- Compendium browse -->
        <div class="inv-add-section">
          <div class="sty-dlg-label">Browse Compendium</div>
          <input id="inv-search" type="text" placeholder="Search…">
          <div id="inv-browse-list" class="sty-dlg-scroll">${rowHTML(compItems)}</div>
        </div>

        <!-- Divider -->
        <div class="sty-dlg-divider">OR CREATE CUSTOM</div>

        <!-- Custom item -->
        <div class="inv-add-row">
          <div>
            <div class="sty-dlg-label">Name</div>
            <input id="new-item-name" type="text" placeholder="e.g. Iron Sword">
          </div>
          <div>
            <div class="sty-dlg-label">Size</div>
            <input id="new-item-size" type="number" min="1" max="11" value="1" class="inv-add-size">
          </div>
        </div>
      </div>`;

      const btnStyle = {
        'font-family': "'Cinzel',serif", 'font-size': '9px', 'font-weight': '600',
        'letter-spacing': '0.12em', 'text-transform': 'uppercase',
        padding: '5px 0', cursor: 'pointer', 'border-radius': '2px', flex: '1',
      };

      let dialogInstance;
      dialogInstance = new Dialog({
        title: 'Add Item to Inventory',
        content,
        buttons: {
          add: { label: 'Add Custom', callback: async (dlg) => {
            const name = dlg.find('#new-item-name').val().trim() || 'New Item';
            const size = Math.max(1, Math.min(11, parseInt(dlg.find('#new-item-size').val()) || 1));
            await Item.create({ name, type: 'gear', system: { size } }, { parent: actor });
          }},
          cancel: { label: 'Cancel' }
        },
        default: 'add',
        render: (dlg) => {
          // Style outer window
          const win = dlg.closest('.app,.window-app');
          win.css({ background:'linear-gradient(135deg,#0d1628 0%,#080e1c 100%)',
            border:'1px solid #1e4fa0', 'border-left':'3px solid #2a70e0',
            'box-shadow':'0 0 24px rgba(20,80,200,0.45)',
            'clip-path':'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' });
          win.find('.window-header').css({ background:'rgba(6,10,24,0.98)',
            'border-bottom':'1px solid rgba(42,112,224,0.28)', padding:'7px 12px' });
          win.find('.window-title').css({ color:'#a8c8e8', 'font-family':"'Cinzel',serif",
            'font-size':'11px', 'letter-spacing':'0.1em',
            'text-shadow':'0 0 8px rgba(42,112,224,0.4)' });
          win.find('.header-button.close').css({ color:'rgba(90,130,185,0.6)' });
          win.find('.window-content').css({ background:'transparent', padding:'0' });
          win.find('.dialog-buttons').css({ background:'rgba(4,8,20,0.95)',
            'border-top':'1px solid rgba(42,112,224,0.18)',
            padding:'7px 14px', gap:'8px', display:'flex' });
          win.find('[data-button="add"]').css({ ...btnStyle,
            background:'linear-gradient(135deg,#162e68 0%,#0d1e48 100%)',
            color:'#90c8ff', border:'1px solid rgba(42,112,224,0.55)' });
          win.find('[data-button="cancel"]').css({ ...btnStyle,
            background:'transparent', color:'rgba(90,130,185,0.6)',
            border:'1px solid rgba(42,112,224,0.18)' });

          // Delegate from the outer window (persists across re-renders) instead of dlg content
          win.off('input.invSearch click.invRow mouseenter.invRow mouseleave.invRow');

          win.on('input.invSearch', '#inv-search', function() {
            const q = this.value.toLowerCase();
            win.find('.inv-browse-row').each(function() {
              $(this).toggle($(this).find('span').first().text().toLowerCase().includes(q));
            });
          });

          win.on('mouseenter.invRow', '.inv-browse-row', function() {
            this.style.background = 'rgba(42,112,224,0.14)';
          }).on('mouseleave.invRow', '.inv-browse-row', function() {
            this.style.background = 'transparent';
          });

          win.on('click.invRow', '.inv-browse-row', async function() {
            const packId = this.dataset.packId;
            const itemId  = this.dataset.itemId;
            try {
              const uuid = `Compendium.${packId}.Item.${itemId}`;
              let doc = await fromUuid(uuid).catch(() => null);
              if (!doc) {
                const pack = game.packs.get(packId);
                if (pack) doc = await pack.getDocument(itemId).catch(() => null);
              }
              if (!doc) { ui.notifications.warn('Item not found in compendium.'); return; }
              await Item.create(doc.toObject(), { parent: actor });
              dialogInstance?.close();
            } catch(err) {
              console.error('Inventory import failed:', err);
              ui.notifications.error(`Failed to add item: ${err.message}`);
            }
          });

          dlg.find('#inv-search').focus();
        }
      }, { classes: ['inv-add-dialog'], width: 360 });

      dialogInstance.render(true);
    });

    // Open Compendium
    html.on('click', '.item-control[data-action="compendium"]', this._onOpenCompendium.bind(this));

    // Character page Class/Folk browse buttons
    html.on('click', '.jrpg-char-item-browse[data-action="compendium"]', this._onOpenCompendium.bind(this));

    // Delete Inventory Item
    html.on('click', '.item-delete', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      this._onItemDelete(item, li);
    });

    // Use Consumable Item (heals 25% max HP and removes item)
    html.on('click', '.item-use', async (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      if (item) await this._onUseConsumable(item);
    });

    // Duplicate Inventory Item
    html.on('click', '.item-duplicate', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      this._onItemDuplicate(item);
    });

    // Handle uses input changes
    let updateTimeout;
    html.on('input', '.uses-current', (ev) => {
      const input = ev.currentTarget;
      const itemId = input.dataset.itemId;
      const currentValue = parseInt(input.value);
      
      // Clear previous timeout
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      
      // Debounce the update to prevent too many rapid calls
      updateTimeout = setTimeout(() => {
        const item = this.actor.items.get(itemId);
        if (item && !isNaN(currentValue)) {
          item.update({'system.uses_current': currentValue}).catch(err => {
            console.error('Error updating uses_current:', err);
          });
        }
      }, 300); // 300ms delay
    });

    // Handle uses reset button clicks
    html.on('click', '.uses-reset-btn', (ev) => {
      const button = ev.currentTarget;
      const itemId = button.dataset.itemId;
      const item = this.actor.items.get(itemId);
      
      if (item && item.system.cooldown_value > 0) {
        item.update({'system.uses_current': item.system.cooldown_value}).catch(err => {
          console.error('Error resetting uses_current:', err);
        });
      }
    });

    // Active Effect management
    html.on('click', '.effect-control', (ev) => {
      const row = ev.currentTarget.closest('li');
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

	// Resource buttons
	html.on('click', '.resource-button, .fantasy-action-button, .jrpg-recovery-btn, .jrpg-focused-atk-btn, .lrd-action-btn', async (event) => {
	  event.preventDefault();
	  const button = event.currentTarget;
	  const action = button.dataset.action;
	  
		try {
		  let updates = {};
		  let message = '';

		  switch (action) {
			case 'turnStart':
			  // Check if Spring of Life is active - if so, don't restore stamina
			  const springOfLifeActive = this.actor.getFlag(SYSTEM_ID, "springOfLifeActive");
			  if (springOfLifeActive) {
			    message = `${this.actor.name} begins their turn. No Stamina was restored due to having utilized Spring of Life recently.`;
			  } else {
			    message = `${this.actor.name} has regained all Stamina at the start of their turn.`;
			    updates['system.stamina.value'] = this.actor.system.stamina.max;
			  }
			  // ── Brutality: Ichor Aura auto-trigger (8 Ichor at turn start) ──
			  if ((this.actor.getFlag(SYSTEM_ID, 'activeAspect') ?? '').includes('Brutality')) {
				const { getIchor, activateIchorAura } = await import('../abilities/brutality-abilities.mjs');
				if (getIchor(this.actor) >= 8 && !this.actor.getFlag(SYSTEM_ID, 'ichorAuraActive')) {
				  await activateIchorAura(this.actor, ChatMessage.getSpeaker({ actor: this.actor }),
					game.settings.get('core', 'rollMode'));
				}
				// Clear round-end flags (Impending Doom penalty clears at turn start)
				await this.actor.unsetFlag(SYSTEM_ID, 'impendingDoomPenalty');
				await this.actor.unsetFlag(SYSTEM_ID, 'ichorAuraActive');
			  }
			  // ── Warlock: Sanguine Ichor lasts 1 Round — clears at next turn start ──
			  {
				const { isWarlock } = await import('../abilities/warlock-abilities.mjs');
				if (isWarlock(this.actor) && this.actor.getFlag(SYSTEM_ID, 'sanguineIchorBonus')) {
				  await this.actor.unsetFlag(SYSTEM_ID, 'sanguineIchorBonus');
				  ui.notifications.info(`${this.actor.name}: Sanguine Ichor fades.`);
				}
			  }
			  break;

			case 'tacticsReset':
			  message = `${this.actor.name} has regained all their Tactics Points at the start of a new Engagement.`;
			  updates['system.tactics.value'] = this.actor.system.tactics.max;
			  break;

			case 'setLordlingAspect': {
			  const aspects = ['Wild', 'Royal', 'Spirit'];
			  const current = this.actor.getFlag(SYSTEM_ID, 'lordlingAspect') ?? '';
			  const chosen = await new Promise(resolve => {
			    new Dialog({
			      title: 'Set Lordling Aspect',
			      content: `<p>Choose the Lordling's Aspect:</p>`,
			      buttons: {
			        wild:   { label: '🌿 Wild',    callback: () => resolve('Wild')   },
			        royal:  { label: '👑 Royal',   callback: () => resolve('Royal')  },
			        spirit: { label: '✦ Spirit',   callback: () => resolve('Spirit') },
			        cancel: { label: 'Cancel',     callback: () => resolve(null)     },
			      },
			      default: 'wild',
			    }, { width: 300, classes: ['dialog','stryder-stat-popup'] }).render(true);
			  });
			  if (chosen) { await this.actor.setFlag(SYSTEM_ID, 'lordlingAspect', chosen); this.render(false); }
			  return;
			}

			case 'setLordlingForm': {
			  const chosen = await new Promise(resolve => {
			    new Dialog({
			      title: 'Set Lordling Form',
			      content: `<p>Choose the current battle form:</p>`,
			      buttons: {
			        wild:   { label: '🌿 Wild (Medium)',  callback: () => resolve('Wild (Medium)')   },
			        royal:  { label: '👑 Royal (Huge)',   callback: () => resolve('Royal (Huge)')    },
			        small:  { label: '🔸 Small (resting)',callback: () => resolve('Small (resting)') },
			        cancel: { label: 'Cancel',            callback: () => resolve(null)              },
			      },
			      default: 'wild',
			    }, { width: 320, classes: ['dialog','stryder-stat-popup'] }).render(true);
			  });
			  if (chosen) { await this.actor.setFlag(SYSTEM_ID, 'lordlingForm', chosen); this.render(false); }
			  return;
			}

			case 'limitReset':
			  const limitItems = this.actor.items.filter(item =>
				(item.type === 'skill' || item.type === 'action') &&
				item.system.limit?.max > 0 &&
				item.system.limit?.value > 0
			  );
			  for (const item of limitItems) {
				await item.update({'system.limit.value': 0});
			  }
			  message = limitItems.length > 0
				? `${this.actor.name} has reset all Limit counters. (${limitItems.length} ability${limitItems.length !== 1 ? ' limits' : ' limit'} reset)`
				: `${this.actor.name} has no Limit counters to reset.`;
			  break;

			case 'combatEnd': {
			  const combatLimitItems = this.actor.items.filter(item =>
				(item.type === 'action' || item.type === 'skill') &&
				item.system.limit?.max > 0 &&
				item.system.limit?.value > 0
			  );
			  for (const item of combatLimitItems) {
				await item.update({'system.limit.value': 0});
			  }
			  // Reset Discipline Flow and FBA type between combats
			  await this.actor.setFlag(SYSTEM_ID, 'flow', 0);
			  await this.actor.unsetFlag(SYSTEM_ID, 'lastFBAType');

			  // ── Brutality: end-of-engagement heal + flag cleanup ──
			  if ((this.actor.getFlag(SYSTEM_ID, 'activeAspect') ?? '').includes('Brutality')) {
				const { getIchor, setIchor } = await import('../abilities/brutality-abilities.mjs');
				const ichor = getIchor(this.actor);
				if (ichor > 0) {
				  const curHP = this.actor.system.health?.value ?? 0;
				  const maxHP = this.actor.system.health?.max   ?? 0;
				  const newHP = Math.min(maxHP, curHP + ichor);
				  await this.actor.update({ 'system.health.value': newHP });
				  await ChatMessage.create({
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					content: `<div class="chat-message-card" style="padding:6px 10px;">
					  <span class="aspect-label" style="font-family:'Cinzel';font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(200,140,60,0.85);text-transform:uppercase;">Brutality — Form Passive</span><br>
					  <span style="font-family:'Rajdhani';font-size:13px;color:rgba(210,230,255,0.8);">End of engagement: ${this.actor.name} heals <strong style="color:#5cb85c;">${ichor} HP</strong> from current Ichor (${curHP} → ${newHP}).</span>
					</div>`
				  });
				}
				// Clear all Brutality round/combat flags
				for (const flag of ['impendingDoomActive','impendingDoomPenalty','ichorEdgeBonus',
				  'onsetOfDoomActive','gougingClawActive','hellishCleaveTargets','ichorAuraActive']) {
				  await this.actor.unsetFlag(SYSTEM_ID, flag);
				}
				await setIchor(this.actor, 0);
			  }

			  // ── Warlock: end-of-engagement Bloodloss recovery + heal ──
			  {
				const { isWarlock, warlockEndOfEngagement } = await import('../abilities/warlock-abilities.mjs');
				if (isWarlock(this.actor)) {
				  await warlockEndOfEngagement(this.actor);
				}
			  }

			  message = combatLimitItems.length > 0
				? `${this.actor.name}'s combat has ended. All ability limits have been reset. (${combatLimitItems.length} reset)`
				: `${this.actor.name}'s combat has ended.`;
			  break;
			}

			case 'ichorIncrement': {
			  const { grantIchor } = await import('../abilities/brutality-abilities.mjs');
			  await grantIchor(this.actor, 1);
			  return;
			}

			case 'ichorDecrement': {
			  const { spendIchor } = await import('../abilities/brutality-abilities.mjs');
			  await spendIchor(this.actor, 1);
			  return;
			}

			case 'bloodlossIncrement': {
			  const { payBloodloss } = await import('../abilities/warlock-abilities.mjs');
			  await payBloodloss(this.actor, 1);
			  return;
			}

			case 'bloodlossDecrement': {
			  const { restoreBloodloss } = await import('../abilities/warlock-abilities.mjs');
			  await restoreBloodloss(this.actor, 1);
			  return;
			}

			case 'manaburnIncrement': {
			  const { grantManaburn } = await import('../abilities/warlock-abilities.mjs');
			  await grantManaburn(this.actor, 1);
			  return;
			}

			case 'manaburnDecrement': {
			  const { getManaburn, setManaburn } = await import('../abilities/warlock-abilities.mjs');
			  await setManaburn(this.actor, getManaburn(this.actor) - 1);
			  return;
			}

			case 'castHex': {
			  const actor = this.actor;
			  const speaker = ChatMessage.getSpeaker({ actor });
			  const rollMode = game.settings.get('core', 'rollMode');
			  const { handleHexWielding } = await import('../abilities/wytch-abilities.mjs');
			  return await handleHexWielding(null, actor, speaker, rollMode);
			}

			case 'focusedAttack': {
			  const actor = this.actor;
			  const speaker = ChatMessage.getSpeaker({ actor });
			  const rollMode = game.settings.get('core', 'rollMode');
			  const { resolveFocusedAttack, resolveTwinAttack } = await import('../helpers/aspect-attack.mjs');

			  // Check if Dual Wield is active → ask for twin attack
			  const activeBattleForm = actor.getFlag(SYSTEM_ID, 'activeBattleForm');
			  const isDualWield = activeBattleForm === 'dual_wield' && actor.system.soul_armament?.form?.dual_wield;

			  if (isDualWield) {
				const go = await Dialog.confirm({
				  title: 'Dual Wield — Twin Attack?',
				  content: `<p>Make a <strong>Twin Attack</strong> (two rolls, combined message)?</p>`,
				  yes: () => true, no: () => false, defaultYes: true,
				  options: { classes: ['dialog','stryder-stat-popup'], width: 320 }
				});
				if (go) {
				  return await resolveTwinAttack(actor, { speaker, rollMode });
				}
			  }

			  return await resolveFocusedAttack(actor, { speaker, rollMode });
			}

			case 'battleEngage': {
			  const actor = this.actor;
			  const combat = game.combat;

			  // No active encounter — tell player to wait
			  if (!combat) {
			    ui.notifications.warn(`No active encounter. Wait for the World Master to begin one.`);
			    _openPokemonBattleWindow(actor);
			    return;
			  }

			  // Resolve the best token document for this actor on the current scene
			  const sceneToken = actor.token
			    ?? canvas.tokens?.controlled.find(t => t.actor?.id === actor.id)?.document
			    ?? canvas.scene?.tokens?.find(t => t.actorId === actor.id);

			  // If already in the encounter, just open the battle window — no re-roll
			  const existingCombatant = combat.combatants.find(c =>
			    c.actorId === actor.id || (sceneToken && c.tokenId === sceneToken.id)
			  );
			  if (existingCombatant) {
			    _openPokemonBattleWindow(actor);
			    return;
			  }

			  // Roll initiative: 2d6 + highest Sense
			  const sys = actor.system;
			  const senses = sys.attributes?.sense ?? {};
			  const senseValues = Object.values(senses).map(s => (typeof s === 'object' ? (s.value ?? 0) : 0));
			  const highestSense = senseValues.length ? Math.max(...senseValues) : 0;
			  const initRoll = new Roll(`2d6 + ${highestSense}`);
			  await initRoll.evaluate();

			  // Add combatant to encounter with initiative
			  const combatantData = {
			    actorId: actor.id,
			    tokenId: sceneToken?.id ?? null,
			    sceneId: combat.scene?.id ?? canvas.scene?.id ?? null,
			  };
			  const created = await combat.createEmbeddedDocuments('Combatant', [combatantData]);
			  if (created.length) await combat.setInitiative(created[0].id, initRoll.total);

			  // Post initiative roll to chat
			  await initRoll.toMessage({
			    speaker: ChatMessage.getSpeaker({ actor }),
			    flavor: `<strong>${actor.name}</strong> enters the encounter! Initiative roll (2d6 + ${highestSense} Sense)`,
			  });

			  // ── Brutality: Attached Bonus — start engagement with 3 Ichor ──
			  if ((actor.getFlag(SYSTEM_ID, 'activeAspect') ?? '').includes('Brutality')) {
				const { getIchor, setIchor } = await import('../abilities/brutality-abilities.mjs');
				const curIchor = getIchor(actor);
				if (curIchor < 3) {
				  await setIchor(actor, 3);
				  await ChatMessage.create({
					speaker: ChatMessage.getSpeaker({ actor }),
					content: `<div class="chat-message-card" style="padding:6px 10px;">
					  <span class="aspect-label" style="font-family:'Cinzel';font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(200,140,60,0.85);text-transform:uppercase;">Brutality — Attached Bonus</span><br>
					  <span style="font-family:'Rajdhani';font-size:13px;color:rgba(210,230,255,0.8);">${actor.name} begins the engagement with <strong style="color:#c87a30;">3 Ichor</strong>.</span>
					</div>`
				  });
				}
			  }

			  _openPokemonBattleWindow(actor);
			  return;
			}

			case 'resting':
			  message = `${this.actor.name} has rested, regaining all Stamina and Mana.`;
			  updates['system.stamina.value'] = this.actor.system.stamina.max;
			  updates['system.mana.value'] = this.actor.system.mana.max;
			  // Clear Spring of Life flag to restore normal stamina functionality
			  updates[`flags.${SYSTEM_ID}.springOfLifeActive`] = null;
			  // Remove exhaustion effects
			  const { removeExhaustionEffects } = await import('../conditions/exhaustion.mjs');
			  await removeExhaustionEffects(this.actor);
			  // Remove haggard effects
			  const { removeHaggardEffects } = await import('../conditions/haggard.mjs');
			  await removeHaggardEffects(this.actor);
			  
			  // Reset uses for skills and folk abilities with perRest cooldown
			  const itemsToReset = this.actor.items.filter(item =>
				(item.type === 'skill' || item.type === 'racial') &&
				item.system.cooldown_unit === 'perRest' &&
				item.system.cooldown_value > 0
			  );

			  for (const item of itemsToReset) {
				await item.update({'system.uses_current': item.system.cooldown_value});
			  }

			  // Shaman: clear rest-scoped flags; also clear Lordling's essence drain
			  {
				const { isShamanClass } = await import('../abilities/shaman-abilities.mjs');
				if (isShamanClass(this.actor)) {
				  await this.actor.unsetFlag(SYSTEM_ID, 'spiritArmamentUsedToday');
				  const lordling = game.actors.find(a => a.type === 'lordling' && a.system.linkedCharacterId === this.actor.id);
				  if (lordling) await lordling.unsetFlag(SYSTEM_ID, 'lordlingEssenceDrained');
				}
			  }
			  break;

			case 'springOfLife': {
			  // 1. Calculate health restoration (incl. Warlock Sacrifice — only a
			  //    Spring of Life can restore Maximum Health paid to Sacrifice)
			  const burningReduction   = this.actor.getFlag(SYSTEM_ID, "burningHealthReduction")   || 0;
			  const bloodlossReduction = this.actor.getFlag(SYSTEM_ID, "bloodlossHealthReduction") || 0;
			  const sacrificeReduction = this.actor.getFlag(SYSTEM_ID, "sacrificeHealthReduction") || 0;
			  const wytchRiseReduction = this.actor.getFlag(SYSTEM_ID, "wytchRiseHealthReduction") || 0;
			  const totalReduction = burningReduction + bloodlossReduction + sacrificeReduction + wytchRiseReduction;
			  const newMax = this.actor.system.health.max + totalReduction;

			  // 2. Restore max HP directly (automatic max-HP derivation is disabled),
			  //    refill HP/MP and set springOfLifeActive flag
			  await this.actor.update({
				'system.health.max': newMax,
				'system.health.value': newMax,
				'system.mana.value': this.actor.system.mana.max,
				[`flags.${SYSTEM_ID}.springOfLifeActive`]: true,
				[`flags.${SYSTEM_ID}.burningHealthReduction`]: null,
				[`flags.${SYSTEM_ID}.bloodlossHealthReduction`]: null,
				[`flags.${SYSTEM_ID}.sacrificeHealthReduction`]: null,
				[`flags.${SYSTEM_ID}.wytchRiseHealthReduction`]: null,
			  });

			  // 3. Remove only CONDITION effects (status effects), preserving folk
			  //    bonuses, talent overrides, Warrior aug effects, and any other
			  //    non-condition / permanent Active Effect. Previously this deleted
			  //    EVERYTHING not flagged isPermanent, which wiped Folk bonuses etc.
			  const conditionKeys = new Set();
			  for (const se of (CONFIG.statusEffects ?? [])) {
			    if (se.id)    conditionKeys.add(String(se.id).toLowerCase());
			    if (se.label) conditionKeys.add(String(se.label).toLowerCase());
			    if (se.name)  conditionKeys.add(String(se.name).toLowerCase());
			  }
			  const isCondition = (e) => {
			    // Never treat permanent or system bonus effects as conditions
			    if (e.flags?.stryder?.isPermanent)    return false;
			    if (e.flags?.stryder?.isFolkBonus)    return false;
			    if (e.flags?.stryder?.isFolkAbility)  return false;
			    if (e.flags?.stryder?.isPlayerTalents) return false;
			    if (e.flags?.stryder?.isLevelUpTalent) return false;
			    // Foundry status-applied effects carry a statuses set / core.statusId
			    for (const s of (e.statuses ?? [])) {
			      if (conditionKeys.has(String(s).toLowerCase())) return true;
			    }
			    const coreStatus = e.flags?.core?.statusId;
			    if (coreStatus && conditionKeys.has(String(coreStatus).toLowerCase())) return true;
			    // Plain-AE conditions created by this system match a status label by name
			    const nm = (e.name ?? e.label ?? '').toLowerCase();
			    return conditionKeys.has(nm);
			  };
			  const effectIds = this.actor.effects.filter(isCondition).map(e => e.id);
			  if (effectIds.length) {
			    await this.actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
			  }

			  // 4. Reset perSpring cooldowns
			  const springItemsToReset = this.actor.items.filter(item =>
				(item.type === 'skill' || item.type === 'racial') &&
				item.system.cooldown_unit === 'perSpring' &&
				item.system.cooldown_value > 0
			  );
			  for (const item of springItemsToReset) {
				await item.update({'system.uses_current': item.system.cooldown_value});
			  }

			  // 5. Build and send chat message
			  let springMessage = `${this.actor.name} has used Spring of Life, restoring all Health and Mana, and clearing all conditions. Stamina cannot be restored until the next Rest.`;
			  if (totalReduction > 0) {
				const parts = [];
				if (burningReduction > 0)   parts.push(`${burningReduction} from burns`);
				if (bloodlossReduction > 0) parts.push(`${bloodlossReduction} from bloodloss`);
				if (sacrificeReduction > 0) parts.push(`${sacrificeReduction} from Sacrifice`);
				if (wytchRiseReduction > 0) parts.push(`${wytchRiseReduction} from Wytch Rise hex`);
				springMessage += ` Max Health restored by ${totalReduction} (${parts.join(', ')}).`;
			  }
			  await ChatMessage.create({
				user: game.user.id,
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				content: `<div class="chat-message-card"><div class="chat-message-header"><h3 class="chat-message-title">🌿 Spring of Life</h3></div><div class="chat-message-content">${springMessage}</div></div>`,
			  });

			  // 6. Ask if they also want to Rest
			  const doRest = await Dialog.confirm({
				title: "Rest After Spring of Life?",
				content: "<p>Would you also like to <strong>Rest</strong>? This will restore your Stamina and allow normal Stamina recovery on future turns.</p>",
				yes: () => true,
				no: () => false,
				defaultYes: false,
			  });
			  if (doRest) {
				await this.actor.update({
				  'system.stamina.value': this.actor.system.stamina.max,
				  'system.mana.value': this.actor.system.mana.max,
				  [`flags.${SYSTEM_ID}.springOfLifeActive`]: null,
				});
				const { removeExhaustionEffects } = await import('../conditions/exhaustion.mjs');
				await removeExhaustionEffects(this.actor);
				const haggardEffects = this.actor.effects.filter(e =>
				  e.name?.toLowerCase().includes('haggard') || e.label?.toLowerCase().includes('haggard')
				);
				if (haggardEffects.length) {
				  await this.actor.deleteEmbeddedDocuments('ActiveEffect', haggardEffects.map(e => e.id));
				}
				// Reset perRest cooldowns
				const restItems = this.actor.items.filter(item =>
				  (item.type === 'skill' || item.type === 'racial') &&
				  item.system.cooldown_unit === 'perRest' &&
				  item.system.cooldown_value > 0
				);
				for (const item of restItems) {
				  await item.update({'system.uses_current': item.system.cooldown_value});
				}
				await ChatMessage.create({
				  user: game.user.id,
				  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				  content: `<div class="chat-message-card"><div class="chat-message-header"><h3 class="chat-message-title">💤 Rest</h3></div><div class="chat-message-content">${this.actor.name} has rested, restoring all Stamina and Mana.</div></div>`,
				});
			  }
			  return; // skip shared updates/message block
			}

		  case 'resetHpMax': {
			await this.actor.update({ 'system.health.bonus': 0 });
			ui.notifications.info(`${this.actor.name}: Bonus HP removed.`);
			return;
		  }

		  case 'resetCharacter': {
			if (!this.actor.isOwner) {
			  ui.notifications.warn("You don't have permission to reset this character.");
			  return;
			}
			const confirmed = await Dialog.confirm({
			  title: `Reset ${this.actor.name}?`,
			  content: `<p>Resets this character to a blank <strong>Level 1</strong> for testing:</p>
				<ul style="margin:4px 0 8px 18px;font-size:12px;line-height:1.5;">
				  <li>Level, XP, Sparks, Mastery Points → 0</li>
				  <li>Abilities, Talents, Senses, Life Skills, Potency → 0</li>
				  <li>Class, Folk, and all Aspects removed</li>
				  <li>Granted class features, techniques, hexes, folk abilities, stat perks removed</li>
				  <li>All Active Effects and all <code>stryder</code> flags cleared</li>
				</ul>
				<p><strong>Kept:</strong> name, art, biography, inventory, Soul Armament, currency.</p>
				<p class="sty-dlg-warn">This cannot be undone.</p>`,
			  yes: () => true,
			  no: () => false,
			  defaultYes: false,
			});
			if (!confirmed) return;

			// 1. Delete build-defining items (keep physical inventory, armament, etc.)
			const BUILD_TYPES = new Set(['action','technique','hex','class','folk','racial','feature','statperk']);
			const buildItemIds = this.actor.items.filter(i =>
			  BUILD_TYPES.has(i.type)
			  || i.flags?.stryder?.aspectName
			  || i.flags?.stryder?.isClassFeature
			  || i.flags?.stryder?.isTechnique
			  || i.flags?.stryder?.isFolkAbility
			  || i.flags?.stryder?.isLordlyFeature
			).map(i => i.id);
			if (buildItemIds.length) await this.actor.deleteEmbeddedDocuments('Item', buildItemIds);

			// 2. Delete ALL Active Effects (folk bonuses, conditions, level-up picks, etc.)
			const allEffectIds = this.actor.effects.map(e => e.id);
			if (allEffectIds.length) await this.actor.deleteEmbeddedDocuments('ActiveEffect', allEffectIds);

			// 3. Zero build/system fields + clear the entire stryder flag namespace.
			const reset = {
			  'system.attributes.level.value': 1,
			  'system.attributes.xp.value': 3, // Level-1 starting XP (class bonuses, e.g. Warrior +2, re-apply on class re-selection)
			  'system.masteryPoints.essence': 0,
			  'system.gloryToken': false,
			  'system.health.bonus': 0,
			  'system.ward.value': 0,
			  'system.physical_reduction': 0,
			  'system.magykal_reduction': 0,
			  'system.physical_resist_mod': 0,
			  'system.magykal_resist_mod': 0,
			  'system.dodge.bonus': 0,
			  'system.evade.bonus': 0,
			  'system.reflex_tag.bonus': 0,
			  'system.leap_bonus.bonus': 0,
			  'system.class.name': '',
			  'system.folk.name': '',
			  'system.folk.subfolk': '',
			  'system.folk.size_choice': '',
			  'system.folk.traveler_boon': '',
			  'system.folk.wildkin_adaptations': [],
			  'system.folk.talent_free_points': {},
			  'system.folk.sense_free_choices': [],
			  'system.folk.oumen_affliction': '',
			  'system.folk.bonuses_applied': false,
			  'system.attributes.physical_potency.value': 0,
			  'system.attributes.physical_potency.mod': 0,
			  'system.attributes.magykal_potency.value': 0,
			  'system.attributes.magykal_potency.mod': 0,
			  'flags.-=stryder': null,
			};
			for (let i = 1; i <= 5; i++) reset[`system.sparks.spark${i}`] = false;
			for (const k of Object.keys(this.actor.system.abilities ?? {}))            reset[`system.abilities.${k}.value`] = 0;
			for (const k of Object.keys(this.actor.system.attributes?.talent ?? {}))   reset[`system.attributes.talent.${k}.value`] = 0;
			for (const k of Object.keys(this.actor.system.attributes?.sense ?? {}))    reset[`system.attributes.sense.${k}.value`] = 0;
			for (const k of Object.keys(this.actor.system.life ?? {}))                 reset[`system.life.${k}.value`] = 0;
			await this.actor.update(reset);

			// 4. Recompute max resources for the now-blank Level 1 and refill them.
			await this._syncComputedStats();
			const after = this._calcMaxStats(this.actor);
			await this.actor.update({
			  'system.health.value':  after.maxHealth,
			  'system.stamina.value': after.maxStamina,
			  'system.mana.value':    after.maxMana,
			});

			ui.notifications.info(`${this.actor.name} has been reset to a blank Level 1.`);
			this.render(false);
			return;
		  }

		  case 'trustIncrease': {
			const currentTrustPoints = this.actor.system.trust?.points ?? 0;
			const currentTrustLevel = this.actor.system.trust?.level ?? 'Stranger';
			const newTrustPoints = currentTrustPoints + 1;
			let newTrustLevel;
			if (newTrustPoints >= 40) newTrustLevel = 'Best Friend';
			else if (newTrustPoints >= 20) newTrustLevel = 'Comrade';
			else if (newTrustPoints >= 10) newTrustLevel = 'Friend';
			else newTrustLevel = 'Stranger';
			updates['system.trust.points'] = newTrustPoints;
			updates['system.trust.level'] = newTrustLevel;
			if (newTrustLevel !== currentTrustLevel) {
			  message = `${this.actor.name}'s trust has grown! They are now a ${newTrustLevel}.`;
			}
			break;
		  }

		  case 'trustDecrease': {
			const currentTrustPoints = this.actor.system.trust?.points ?? 0;
			const currentTrustLevel = this.actor.system.trust?.level ?? 'Stranger';
			const newTrustPoints = Math.max(0, currentTrustPoints - 1);
			let newTrustLevel;
			if (newTrustPoints >= 40) newTrustLevel = 'Best Friend';
			else if (newTrustPoints >= 20) newTrustLevel = 'Comrade';
			else if (newTrustPoints >= 10) newTrustLevel = 'Friend';
			else newTrustLevel = 'Stranger';
			updates['system.trust.points'] = newTrustPoints;
			updates['system.trust.level'] = newTrustLevel;
			if (newTrustLevel !== currentTrustLevel) {
			  message = `${this.actor.name}'s trust has decreased. They are now a ${newTrustLevel}.`;
			}
			break;
		  }

		  case 'levelUp': {
			const sys = this.actor.system;
			const currentLevel = sys.attributes.level.value ?? 1;
			if (currentLevel >= 15) {
			  ui.notifications.warn("Already at maximum level 15.");
			  break;
			}

			const newLevel = currentLevel + 1;

			// Build a lightweight stand-in to feed _calcMaxStats at the new level.
			// Include flags so Warlock bloodloss/sacrifice/burning reductions are preserved.
			const fakeActorData = {
			  system: {
			    ...sys,
			    attributes: { ...sys.attributes, level: { value: newLevel } }
			  },
			  flags: this.actor.flags,
			};
			const computed = this._calcMaxStats(fakeActorData);

			// XP is a spendable currency for buying Techniques in the Growth menu.
			const xpGain = 1;
			const currentXp = sys.attributes.xp?.value ?? 0;

			const lvlUpdates = {
			  'system.attributes.level.value': newLevel,
			  'system.health.max':            computed.maxHealth,
			  'system.health.value':           computed.maxHealth,
			  'system.stamina.max':            computed.maxStamina,
			  'system.stamina.value':          computed.maxStamina,
			  'system.mana.max':               computed.maxMana,
			  'system.mana.value':             computed.maxMana,
			  'system.attributes.xp.value':    currentXp + xpGain,
			};

			await this.actor.update(lvlUpdates);

			// Auto-grant class features unlocked at the new level, then notify.
			const { granted, hasWaitingChoice } = await this._grantClassFeatures(this.actor);
			const className = this.actor.system.class?.name ?? '';
			let notifyParts = [`<strong>${this.actor.name}</strong> advanced to <strong>Level ${newLevel}</strong>! Gained 1 XP.`];
			if (granted.length) {
			  notifyParts.push(`Gained: <em>${granted.join(', ')}</em>.`);
			}
			if (hasWaitingChoice) {
			  notifyParts.push(`<span class="sty-dlg-warn">You have a Class Path choice waiting — open Growth to claim it.</span>`);
			}
			await ChatMessage.create({
			  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			  content: `<div class="chat-message-card"><div class="chat-message-header"><h3 class="chat-message-title">Level Up${className ? ` — ${className}` : ''}</h3></div><div class="chat-message-content">${notifyParts.join('<br>')}</div></div>`,
			});
			break;
		  }
		  }

		  await this.actor.update(updates);

		  if (message) {
			ChatMessage.create({
			  speaker: ChatMessage.getSpeaker({actor: this.actor}),
			  content: `<div class="chat-message-card"><div class="chat-message-header"><h3 class="chat-message-title">${button.textContent.trim()}</h3></div><div class="chat-message-content">${message}</div></div>`,
			});
		  }

		} catch (err) {
		  console.error("Error in resource-button handler:", err);
		  ui.notifications.error("Failed to update resources!");
		}
	});

	// ── Lordling TP tracker +/− buttons ───────────────────────────────────────
	html.on('click', '.lrd-tp-adj', async (ev) => {
	  ev.preventDefault();
	  const delta = parseInt(ev.currentTarget.dataset.delta, 10);
	  if (!delta) return;
	  const cur  = this.actor.system.tactics?.value ?? 0;
	  const max  = this.actor.system.tactics?.max   ?? 6;
	  const next = Math.min(max, Math.max(0, cur + delta));
	  if (next !== cur) await this.actor.update({ 'system.tactics.value': next });
	});

	// ── Lordling quick tactic buttons ─────────────────────────────────────────
	html.on('click', '.lrd-tactic-quick', async (ev) => {
	  ev.preventDefault();
	  const tactic = ev.currentTarget.dataset.tactic;
	  if (!tactic) return;
	  const speaker  = ChatMessage.getSpeaker({ actor: this.actor });
	  const rollMode = game.settings.get('core', 'rollMode');
	  // Find the Shaman linked to this Lordling
	  const shaman = this.actor.type === 'lordling'
	    ? (game.actors.get(this.actor.system.linkedCharacterId) ?? this.actor)
	    : this.actor;
	  const { handleShamanAbility } = await import('../abilities/shaman-abilities.mjs').catch(() => ({ handleShamanAbility: null }));
	  if (!handleShamanAbility) return;
	  const tacticNameMap = { attack: 'Tactic: Attack', heal: 'Tactic: Heal', dodge: 'Tactic: Dodge/Evasion', metamorph: 'Tactic: Metamorph', retreat: 'Tactic: Retreat' };
	  const tacticName = tacticNameMap[tactic];
	  if (!tacticName) { console.warn(`[Stryder] lrd-tactic-quick: unknown tactic key "${tactic}"`); return; }
	  const fakeItem = { name: tacticName, system: { description: '' }, flags: { stryder: {} } };
	  await handleShamanAbility(fakeItem, shaman, speaker, rollMode);
	});

	// Life Skills functionality
	html.on('click', '.life-skill-header', function(ev) {
	  ev.stopPropagation();
	  const header = ev.currentTarget;
	  const description = header.nextElementSibling;
	  
	  html.find('.life-skill-description.expanded').not(description).removeClass('expanded');
	  
	  description.classList.toggle('expanded');
	});

	html.on('click', '.life-skill-btn', async (ev) => {
	  ev.stopPropagation();
	  const button = ev.currentTarget;
	  const skill = button.dataset.skill;
	  const isMinus = button.classList.contains('minus');
	  
	  const currentValue = parseInt(this.actor.system.life[skill]?.value || 0);
	  let newValue = isMinus ? Math.max(0, currentValue - 1) : Math.min(5, currentValue + 1);
	  
	  if (newValue !== currentValue) {
		await this.actor.update({
		  [`system.life.${skill}.value`]: newValue
		});
	  }
	});

	// Quick action click handler (Jump distances and Grapple)
	html.on('click', '.quick-action-item.rollable', async (ev) => {
		ev.preventDefault();
		const actionItem = ev.currentTarget;
		const jumpType = actionItem.dataset.jumpType;
		const actionType = actionItem.dataset.actionType;
		const actor = this.actor;
		
		if (jumpType) {
			// Handle jump actions
			// Calculate distances
		let verticalDistance = Math.floor(actor.system.attributes.talent.strength.value / 2);
		let horizontalDistance = actor.system.attributes.talent.nimbleness.value;
		
		// Apply leap modifiers
		const verticalMod = actor.system.attributes?.vertical_leap?.mod ?? 0;
		const horizontalMod = actor.system.attributes?.horizontal_leap?.mod ?? 0;
		verticalDistance += verticalMod;
		horizontalDistance += horizontalMod;
		
		// Apply Practiced Form bonuses if enabled
		if (actor.system.booleans?.hasPracticedForm) {
			verticalDistance += actor.system.attributes.talent.nimbleness.value;
			horizontalDistance += actor.system.attributes.talent.strength.value;
		}
		
		// Apply Unbound Leap multiplier if enabled
		if (actor.system.booleans?.usingUnboundLeap) {
			verticalDistance += actor.system.attributes.talent.strength.value;
			horizontalDistance += actor.system.attributes.talent.strength.value;
		}

		// Apply leap bonus
		const leapBonus = actor.system.leap_bonus?.bonus || 0;
		verticalDistance += leapBonus;
		horizontalDistance += leapBonus;

		const distance = jumpType === 'vertical' ? verticalDistance : horizontalDistance;
		const direction = jumpType === 'vertical' ? 'vertically' : 'horizontally';
		
		// Initialize linkedActor variable for potential use in message
		let linkedActor = null;
		let staminaText = actor.system.booleans?.usingUnboundLeap ? 
			"No Stamina was spent (Unbound Leap)." : 
			"1 Stamina was spent (Swift Action).";
		
		// Lordling-specific logic
		if (actor.type === 'lordling') {
			const linkedCharacterId = actor.system.linkedCharacterId;
			if (!linkedCharacterId) {
				return ui.notifications.warn(`Lordling has no Linked Actor, so a Leap could not be performed!`);
			}
			
			linkedActor = game.actors.get(linkedCharacterId);
			if (!linkedActor) {
				return ui.notifications.warn(`Linked Actor not found!`);
			}
			
		// Check stamina on linked actor instead of lordling
		if (!actor.system.booleans?.usingUnboundLeap) {
			const currentStamina = linkedActor.system.stamina.value;
			if (currentStamina < 1) {
				return ui.notifications.warn(`${linkedActor.name} doesn't have enough Stamina to leap!`);
			}
			
			// Check for Stunned condition
			const { handleStunnedStaminaSpend, removeStunnedEffect } = await import('../conditions/stunned.mjs');
			const stunnedResult = await handleStunnedStaminaSpend(linkedActor, 1, 'jump');
			if (!stunnedResult.shouldProceed) {
				return; // Error message already shown
			}
			
			await linkedActor.update({"system.stamina.value": currentStamina - stunnedResult.cost});
			staminaText = `${stunnedResult.cost} Stamina was spent by ${linkedActor.name} (Linked Actor).`;
			
			// Remove stunned effect if it was applied
			if (stunnedResult.cost > 1) {
				await removeStunnedEffect(linkedActor, stunnedResult.cost - 1);
			}
		}
		} 
		// Normal character logic
		else if (!actor.system.booleans?.usingUnboundLeap) {
			const currentStamina = actor.system.stamina.value;
			if (currentStamina < 1) {
				return ui.notifications.warn(`${actor.name} doesn't have enough Stamina to leap!`);
			}
			
			// Check for Stunned condition
			const { handleStunnedStaminaSpend, removeStunnedEffect } = await import('../conditions/stunned.mjs');
			const stunnedResult = await handleStunnedStaminaSpend(actor, 1, 'jump');
			if (!stunnedResult.shouldProceed) {
				return; // Error message already shown
			}
			
			await actor.update({"system.stamina.value": currentStamina - stunnedResult.cost});
			
			// Remove stunned effect if it was applied
			if (stunnedResult.cost > 1) {
				await removeStunnedEffect(actor, stunnedResult.cost - 1);
			}
		}
		
		// Create chat message
		const message = `
		<div class="chat-message-card-jump">
			<div class="chat-message-header">
				<img src="systems/stryder/assets/${jumpType}-jump-icon.svg" class="chat-message-icon-jump">
				<h3 class="chat-message-title-jump">${actor.name} Leaps ${direction}</h3>
			</div>
			
			<div class="chat-message-details-jump">
				<div class="chat-message-detail-row-jump">
					<span class="chat-message-detail-label-jump">Distance:</span>
					<span class="chat-distance-box-jump">${distance} spaces</span>
				</div>
			</div>
			
			<div class="chat-message-footer-jump">
				<div class="stamina-cost-jump">
					<img src="systems/stryder/assets/stamina-icon.svg" style="border: 0px;" width="20" height="20">
					<span>${staminaText}</span>
				</div>
			</div>
		</div>
		`;
		
		await ChatMessage.create({
			content: message,
			speaker: ChatMessage.getSpeaker({actor: actor})
		});
		} else if (actionType === 'grapple') {
			// Handle grapple action
			await this._handleGrappleAction(actor);
		}
	});

	// Talent dropdown changes
	html.find('.talent-select').on('change', foundry.utils.debounce(async (ev) => {
	  const dropdown = ev.currentTarget;
	  const dropdownId = dropdown.name.replace('system.talent.', '').replace('.selection', '');
	  const talentKey = dropdown.value;
	  
	  await this._updateTalentEffect(dropdownId, talentKey);
	  
	  // Update the actor data to store the selection
	  const updateData = {};
	  updateData[`system.talent.${dropdownId}.selection`] = talentKey;
	  await this.actor.update(updateData);
	}, 100));

    // Rollable abilities.
    html.on('click', '.rollable', this._onRoll.bind(this));

    // Talent manual-override: when the player edits a talent input, store the
    // value in the managed "Player Talents" UPGRADE effect so it wins over any
    // OVERRIDE effects from folk/passive abilities.
    if (this.actor.type === 'character' || this.actor.type === 'lordling') {
      html.find('input[name^="system.attributes.talent."][name$=".value"]').on('change', async (ev) => {
        const input = ev.currentTarget;
        const m = input.name.match(/^system\.attributes\.talent\.(\w+)\.value$/);
        if (!m) return;
        await this._updatePlayerTalentOverrides({ [m[1]]: Number(input.value) || 0 });
      });
    }

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });

      // Inventory grid items — make draggable so players can drop them onto the party sheet.
      // We set drag data directly rather than delegating to _onDragStart because these are
      // divs (not li.item) and child img elements grab the native image drag otherwise.
      html.find('.inv-slot.inv-item[data-item-id]').each((i, el) => {
        el.setAttribute('draggable', true);
        // Stop child images from hijacking the drag with browser-native image drag
        el.querySelectorAll('img').forEach(img => img.setAttribute('draggable', 'false'));
        el.addEventListener('dragstart', (ev) => {
          const itemId = el.dataset.itemId;
          const item = this.actor.items.get(itemId);
          if (!item) { ev.preventDefault(); return; }
          ev.dataTransfer.setData('text/plain', JSON.stringify(item.toDragData()));
        }, false);
      });
    }

	// Folk select — confirm then wipe old bonuses, open fresh popup
	html.find('.jrpg-folk-select').on('change', async (ev) => {
	  const folkName  = ev.currentTarget.value;
	  const oldFolk   = this.actor.system.folk?.name ?? '';
	  const hasBonuses = this.actor.effects.some(e => e.flags?.stryder?.isFolkBonus);

	  // Helper: delete ALL folk bonus effects (guard against duplicates)
	  const clearFolkEffects = async () => {
	    const effects = [...this.actor.effects].filter(e => e.flags?.stryder?.isFolkBonus);
	    for (const e of effects) await e.delete();
	    // Also remove any items granted by folk (e.g. Oumen affliction abilities)
	    const folkItems = [...this.actor.items].filter(i => i.flags?.stryder?.isFolkAbility);
	    for (const i of folkItems) await i.delete();
	  };

	  // Helper: wipe every stored folk field
	  const clearFolkData = (newName = '') => this.actor.update({
	    'system.folk.name':                newName,
	    'system.folk.bonuses_applied':     false,
	    'system.folk.subfolk':             '',
	    'system.folk.size_choice':         '',
	    'system.folk.colossus_stat_choice':'',
	    'system.folk.traveler_boon':       '',
	    'system.folk.wildkin_adaptations': [],
	    'system.folk.talent_free_points':  {},
	    'system.folk.sense_free_choices':  [],
	    'system.folk.sense_one_choice':    '',
	    'system.folk.oumen_affliction':    '',
	  });

	  // --- Clearing folk entirely ---
	  if (!folkName) {
	    if (hasBonuses || oldFolk) {
	      const ok = await Dialog.confirm({
	        title:   'Remove Folk',
	        content: `<p>Removing your folk will <strong>permanently delete all folk talent and sense bonuses</strong> from this character. Are you sure?</p>`
	      });
	      if (!ok) { this.render(false); return; }
	    }
	    await clearFolkEffects();
	    await clearFolkData('');
	    return;
	  }

	  // --- Switching to a different folk ---
	  if (oldFolk && oldFolk !== folkName) {
	    const ok = await Dialog.confirm({
	      title:   'Change Folk',
	      content: `<p>Changing from <strong>${oldFolk}</strong> to <strong>${folkName}</strong> will <strong>remove all current folk bonuses</strong> (talents, senses, passives). You will reconfigure your new folk in the next popup.</p><p class="sty-dlg-warn">This cannot be undone.</p>`
	    });
	    if (!ok) { this.render(false); return; }
	  }

	  // Wipe old effect + data, set new folk name, then open fresh popup
	  await clearFolkEffects();
	  await clearFolkData(folkName);
	  this._showFolkPopup(folkName, {});
	});

	// "Edit Folk Choices" reassign button
	html.find('[data-action="folkReassign"]').on('click', () => {
	  const folkName = this.actor.system.folk?.name;
	  if (!folkName) return;
	  const existing = this.actor.system.folk ?? {};
	  this._showFolkPopup(folkName, {
	    size:          existing.size_choice          || '',
	    subfolk:       existing.subfolk              || '',
	    colossusStat:  existing.colossus_stat_choice || '',
	    travelerBoon:  existing.traveler_boon        || '',
	    adaptations:   existing.wildkin_adaptations  || [],
	    talentPoints:  existing.talent_free_points   || {},
	    senseChoices:  existing.sense_free_choices   || [],
	    affliction:    existing.oumen_affliction      || '',
	  });
	});

	// Subfolk select — re-apply folk bonuses with updated subfolk
	html.find('.jrpg-subfolk-select').on('change', async (ev) => {
	  const folkName = this.actor.system.folk?.name;
	  if (!folkName) return;
	  const existing = this.actor.system.folk ?? {};
	  await this._applyFolkChoices(folkName, {
	    size:          existing.size_choice          || '',
	    subfolk:       ev.currentTarget.value,
	    colossusStat:  existing.colossus_stat_choice || '',
	    travelerBoon:  existing.traveler_boon        || '',
	    adaptations:   existing.wildkin_adaptations  || [],
	    talentPoints:  existing.talent_free_points   || {},
	    senseChoices:  existing.sense_free_choices   || [],
	    senseOneChoice: existing.sense_one_choice    || ''
	  });
	});

	// Class select — write HP data from lookup table and recalculate health max
	html.find('.jrpg-class-select').on('change', async (ev) => {
	  const className = ev.currentTarget.value;
	  const classData = STRYDER_CLASS_DATA[className];
	  if (!classData) return;

	  // ── Class swap: confirm + strip old features ──────────────────────────
	  const oldClassName = this.actor.system.class?.name ?? '';
	  if (oldClassName && oldClassName !== className) {
	    const ok = await Dialog.confirm({
	      title:   'Switch Class',
	      content: `<div class="sty-dlg-body"><p>Switching <strong>${oldClassName}</strong> → <strong>${className}</strong> will remove all ${oldClassName} class features and class-choice flags.</p><p class="sty-dlg-warn">XP-purchased Aspects and Techniques are kept. Some stat changes (Movement, DR) may need manual review.</p></div>`,
	      options: { classes: ['dialog', 'stryder-stat-popup'], width: 400 },
	    });
	    if (!ok) { this.render(false); return; }
	    await this._stripOldClassFeatures(this.actor, oldClassName);
	  }

	  const level = this.actor.system.attributes.level.value ?? 1;
	  const clamped = Math.min(15, Math.max(1, level));
	  const newMaxHealth = classData.base_hp + (classData.hp_per_level * (clamped - 1));

	  await this.actor.update({
	    'system.class.name':         className,
	    'system.class.base_hp':      classData.base_hp,
	    'system.class.hp_per_level': classData.hp_per_level,
	    'system.health.max':         newMaxHealth,
	    'system.health.value':       newMaxHealth,
	  });

	  ui.notifications.info(`Class set to ${className}. Max Health updated to ${newMaxHealth}.`);

	  // ── Shaman: prompt to link a Lordling ────────────────────────────────
	  if (className === 'Shaman') {
	    const alreadyLinked = game.actors.find(a => a.type === 'lordling' && a.system.linkedCharacterId === this.actor.id);
	    if (!alreadyLinked) {
	      await this._promptLordlingLink();
	    }
	  }

	  // ── Summoner: prompt to generate Spirit Beasts ──────────────────────
	  if (className === 'Summoner') {
	    const { generateSpiritBeasts, linkedSpirits } = await import('../abilities/summoner-abilities.mjs');
	    const hasBeasts = linkedSpirits(this.actor).length > 0;
	    if (!hasBeasts) {
	      await generateSpiritBeasts(this.actor);
	    }
	  }

	  // ── Auto-grant class features for the new class ───────────────────────
	  await this._grantClassFeatures(this.actor);
	});

	// Re-sync whenever Grit changes so the Grit HP bonus is recalculated immediately.
	// setTimeout(100) lets Foundry write the new value before we read it back.
	html.find('input[name="system.abilities.Grit.value"]').on('change', () => {
	  setTimeout(() => this._syncComputedStats(), 100);
	});

	// ── Stat stepper buttons (Character page) ──────────────────────────────
	if (this.actor.type === 'character') {
	  const STAT_KEYS  = ['Soul', 'Reflex', 'Grit', 'Will'];
	  const MAX_NORMAL = 5;
	  const MAX_AUG    = 7;

	  html.find('.stat-btn-up').on('click', async (ev) => {
	    const stat      = ev.currentTarget.dataset.stat;
	    if (!STAT_KEYS.includes(stat)) return;
	    const cur       = this.actor.system.abilities?.[stat]?.value ?? 0;
	    const augBonus  = this.actor.getFlag('stryder', 'augExtraStatPoints') ?? 0;
	    const maxVal    = augBonus > 0 ? MAX_AUG : MAX_NORMAL;
	    const spent     = STAT_KEYS.reduce((s, k) => s + (this.actor.system.abilities?.[k]?.value ?? 0), 0);
	    const remaining = (9 + augBonus) - spent;
	    if (remaining <= 0) { ui.notifications.warn('No stat points remaining.'); return; }
	    if (cur >= maxVal)  { ui.notifications.warn(`${stat} is already at maximum (${maxVal}).`); return; }
	    await this.actor.update({ [`system.abilities.${stat}.value`]: cur + 1 });
	  });

	  html.find('.stat-btn-down').on('click', async (ev) => {
	    const stat = ev.currentTarget.dataset.stat;
	    if (!STAT_KEYS.includes(stat)) return;
	    const cur  = this.actor.system.abilities?.[stat]?.value ?? 0;
	    if (cur <= 0) return;
	    await this.actor.update({ [`system.abilities.${stat}.value`]: cur - 1 });
	  });
	}

	// ── Lordling stat steppers (no point pool — just clamp 0–5) ───────────
	if (this.actor.type === 'lordling') {
	  const STAT_KEYS    = ['Soul', 'Reflex', 'Grit', 'Will'];
	  // Soul is the schema key; in-world display name is Spirit.
	  const DISPLAY_NAME = { Soul: 'Spirit' };
	  html.find('.stat-btn-up').on('click', async (ev) => {
	    const stat = ev.currentTarget.dataset.stat;
	    if (!STAT_KEYS.includes(stat)) return;
	    const cur = this.actor.system.abilities?.[stat]?.value ?? 0;
	    if (cur >= 5) { ui.notifications.warn(`${DISPLAY_NAME[stat] ?? stat} is already at maximum (5).`); return; }
	    await this.actor.update({ [`system.abilities.${stat}.value`]: cur + 1 });
	  });
	  html.find('.stat-btn-down').on('click', async (ev) => {
	    const stat = ev.currentTarget.dataset.stat;
	    if (!STAT_KEYS.includes(stat)) return;
	    const cur = this.actor.system.abilities?.[stat]?.value ?? 0;
	    if (cur <= 0) return;
	    await this.actor.update({ [`system.abilities.${stat}.value`]: cur - 1 });
	  });
	}

	// Sync computed max stats (level/class-driven) back to the document.
	// Fire-and-forget: no await so it doesn't block the listener setup.
	this._syncComputedStats();

	const inputmaxspeed = html.find("#running-speed")[0];
	if (!inputmaxspeed) return;

	const runningValue = getProperty(this.object.system, "attributes.move.running.value");
	inputmaxspeed.value = runningValue ?? "";

  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
	async _onItemCreate(event) {
	  event.preventDefault();
	  const header = event.currentTarget;

	  // Get the type of item to create.
	  const type = header.dataset.type;

	  // Check if the item is a loot and if adding it would exceed the limit
	  if (type === 'loot') {
		const lootItems = this.actor.items.filter(i => i.type === 'loot');
		if (lootItems.length >= 24) {
		  let message = game.i18n.localize('<b>Notice:</b> Your "Loot" slots are full! Please drop an item or move one to storage before adding another.');
		  ChatMessage.create({
			content: message,
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			whisper: [game.user.id]
		  });
		  return;
			}
		} else if (type === 'component') {
			const componentItems = this.actor.items.filter(i => i.type === 'component');
			if (componentItems.length >= 10) {
				let message = game.i18n.localize('<b>Notice:</b> Your "Component" slots are full! Please drop an item or move one to storage before adding another.');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'consumable') {
			const consumableItems = this.actor.items.filter(i => i.type === 'consumable');
			if (consumableItems.length >= 6) {
				let message = game.i18n.localize('<b>Notice:</b> Your "Consumable" slots are full! Please drop an item or move one to storage before adding another.');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'gear') {
			const gearItems = this.actor.items.filter(i => i.type === 'gear');
			const gearInventorySizeUsed = gearItems.reduce((acc, item) => {
				return acc + parseInt(item.system.inventory_size || 1);
			}, 0);

			const newItemSize = parseInt(header.dataset.inventorySize || 1);
			if (gearInventorySizeUsed + newItemSize > 4) {
				let message = game.i18n.localize('<b>Notice:</b> Your "Gear" slots are full! Please drop an item or move one to storage before adding another.');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'aegiscore') {
			const componentItems = this.actor.items.filter(i => i.type === 'aegiscore');
			if (componentItems.length >= 2) {
				let message = game.i18n.localize('<b>Notice:</b> You cannot hold more than 2 "Aegis Cores"! Please move one to storage before adding another.');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'legacies') {
			const legaciesItems = this.actor.items.filter(i => i.type === 'legacies');
			if (legaciesItems.length >= 3) {
				let message = game.i18n.localize('<b>Notice:</b> You cannot equip more than 3 Legacies!');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'class') {
			const classItems = this.actor.items.filter(i => i.type === 'class');
			if (classItems.length >= 1) {
				let message = game.i18n.localize('<b>Notice:</b> You cannot have more than 1 Class!');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'folk') {
			const folkItems = this.actor.items.filter(i => i.type === 'folk');
			if (folkItems.length >= 1) {
				let message = game.i18n.localize('<b>Notice:</b> You cannot be more than 1 type of Folk!');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'head') {
			const headItems = this.actor.items.filter(i => i.type === 'head');
			if (headItems.length >= 1) {
				let message = game.i18n.localize('<b>Notice:</b> You cannot equip more than 1 Head item in your Head Slot!');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'back') {
			const backItems = this.actor.items.filter(i => i.type === 'back');
			if (backItems.length >= 1) {
				let message = game.i18n.localize('<b>Notice:</b> You cannot equip more than 1 Back item in your Back Slot!');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'arms') {
			const armsItems = this.actor.items.filter(i => i.type === 'arms');
			const armsSlotsUsed = armsItems.reduce((acc, item) => {
				return acc + parseInt(item.system.slot_space || 1);
			}, 0);

			const newItemSize = parseInt(header.dataset.slotSpace || 1);
			if (armsSlotsUsed + newItemSize > 2) {
				let message = game.i18n.localize('<b>Notice:</b> Your "Arms" slots are full! Please drop an item or move one to storage before adding another.');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'legs') {
			const legsItems = this.actor.items.filter(i => i.type === 'legs');
			if (legsItems.length >= 1) {
				let message = game.i18n.localize('<b>Notice:</b> You cannot equip more than 1 Leg item in your Legs Slot!');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		} else if (type === 'gems') {
			const gemsItems = this.actor.items.filter(i => i.type === 'gems');
			if (gemsItems.length >= 2) {
				let message = game.i18n.localize('<b>Notice:</b> You cannot equip more than 2 Gems!');
				ChatMessage.create({
					content: message,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					whisper: [game.user.id]
				});
				return;
			}
		}

	  // Continue to create the item if it's not loot or doesn't exceed the limit
	  const data = duplicate(header.dataset);
	  const name = `New ${type.capitalize()}`;
	  const itemData = {
		name: name,
		type: type,
		system: data,
	  };
	  delete itemData.system['type'];

	  return await Item.create(itemData, { parent: this.actor });
	}

  /**
   * Handle duplicating an item.
   * @param {Item} item   The item to duplicate
   * @private
   */
  async _onItemDuplicate(item) {
    if (!item) return;

    // Generate a unique name for the duplicate
    const baseName = item.name;
    let duplicateName = `${baseName} (Copy)`;
    
    // Check if a duplicate name already exists and increment the number
    let counter = 1;
    while (this.actor.items.find(i => i.name === duplicateName)) {
      counter++;
      duplicateName = `${baseName} (Copy) (${counter})`;
    }

    // Create the duplicate item data. Copy flags too so a duplicated
    // Growth-imported item keeps its identity (aspectName / isTechnique /
    // isClassFeature) and stays categorised in the right Battle section.
    const duplicateData = {
      name: duplicateName,
      type: item.type,
      img: item.img,
      system: foundry.utils.deepClone(item.system),
      flags: foundry.utils.deepClone(item.flags ?? {})
    };

    // Create the duplicate item
    await Item.create(duplicateData, { parent: this.actor });
  }

  /**
   * Use a consumable item: applies its configured effect, optionally raises
   * Elixir Sickness, posts a chat message, then deletes the item.
   * @param {Item} item   The consumable item being used
   * @private
   */
  async _onUseConsumable(item) {
    const actor = this.actor;

    // Hex: Deny blocks Health recovery
    if (actor.getFlag(SYSTEM_ID, 'hexDenied')) {
      const healTypes = ['heal_hp', 'heal_hp_flat', 'heal_hp_pct'];
      if (healTypes.includes(item.system.effect_type)) {
        return ui.notifications.warn(`${actor.name} is under Hex: Deny and cannot regain Health until the start of the next Player Phase.`);
      }
    }

    const { effect_type, effect_value, is_elixir, elixir_sickness_amount } = item.system;
    const pct = (effect_value ?? 0) / 100;
    const updates = {};
    let effectLine = "";

    const flat = effect_value ?? 0;
    switch (effect_type) {
      case "heal_hp": {
        const maxHP = actor.system.health.max;
        const healAmount = Math.floor(maxHP * pct);
        const newHP = Math.min(actor.system.health.value + healAmount, maxHP);
        updates["system.health.value"] = newHP;
        effectLine = `Recovers <b>${healAmount}</b> HP`;
        break;
      }
      case "heal_mana": {
        const maxMana = actor.system.mana.max;
        const restoreAmount = Math.floor(maxMana * pct);
        const newMana = Math.min(actor.system.mana.value + restoreAmount, maxMana);
        updates["system.mana.value"] = newMana;
        effectLine = `Restores <b>${restoreAmount}</b> Mana`;
        break;
      }
      case "heal_stamina": {
        const maxStamina = actor.system.stamina.max;
        const restoreAmount = Math.floor(maxStamina * pct);
        const newStamina = Math.min(actor.system.stamina.value + restoreAmount, maxStamina);
        updates["system.stamina.value"] = newStamina;
        effectLine = `Restores <b>${restoreAmount}</b> Stamina`;
        break;
      }
      case "heal_hp_flat": {
        const maxHP = actor.system.health.max;
        const newHP = Math.min(actor.system.health.value + flat, maxHP);
        updates["system.health.value"] = newHP;
        effectLine = `Recovers <b>${flat}</b> HP`;
        break;
      }
      case "heal_mana_flat": {
        const maxMana = actor.system.mana.max;
        const newMana = Math.min(actor.system.mana.value + flat, maxMana);
        updates["system.mana.value"] = newMana;
        effectLine = `Restores <b>${flat}</b> Mana`;
        break;
      }
      case "heal_stamina_flat": {
        const maxStamina = actor.system.stamina.max;
        const newStamina = Math.min(actor.system.stamina.value + flat, maxStamina);
        updates["system.stamina.value"] = newStamina;
        effectLine = `Restores <b>${flat}</b> Stamina`;
        break;
      }
      default:
        effectLine = "No effect";
        break;
    }

    if (is_elixir) {
      const currentSickness = actor.system.elixir_sickness?.value ?? 0;
      const sicknessGain = elixir_sickness_amount ?? 1;
      updates["system.elixir_sickness.value"] = Math.min(5, currentSickness + sicknessGain);
    }

    if (Object.keys(updates).length > 0) await actor.update(updates);

    const newSickness = is_elixir
      ? Math.min(5, (actor.system.elixir_sickness?.value ?? 0) + (elixir_sickness_amount ?? 1))
      : null;
    const sicknessNote = newSickness !== null
      ? ` <i>(Elixir Sickness: ${newSickness}/5)</i>`
      : "";

    await ChatMessage.create({
      content: `<b>${actor.name}</b> uses <b>${item.name}</b>. ${effectLine}.${sicknessNote}`,
      speaker: ChatMessage.getSpeaker({ actor })
    });

    await item.delete();
  }

  /**
   * Handle deleting an item with confirmation dialog.
   * @param {Item} item   The item to delete
   * @param {jQuery} li   The list item element
   * @private
   */
  async _onItemDelete(item, li) {
    if (!item) return;

    // Use Dialog.confirm for proper handling
    const confirmed = await Dialog.confirm({
      title: game.i18n.localize("STRYDER.DOCUMENT.DeleteConfirm"),
      content: `<p>${game.i18n.format("STRYDER.DOCUMENT.DeleteConfirmMessage", { name: item.name })}</p>`,
      yes: async () => {
        await item.delete();
        li.slideUp(200, () => this.render(false));
        return true;
      },
      no: () => {
        return false;
      },
      defaultYes: false,
      options: {
        classes: ["stryder-delete-confirm"]
      }
    });

    // The dialog result is handled by the yes/no callbacks above
  }

  /**
   * Handle opening compendiums.
   * @param {Event} event   The originating click event
   * @private
   */
  async _onOpenCompendium(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const packName = button.dataset.pack;
    
    // Get the compendium pack
    const pack = game.packs.get(`stryder.${packName}`);
    if (pack) {
      pack.render(true);
    } else {
      console.warn(`Compendium pack stryder.${packName} not found`);
    }
  }

  /**
   * Handle grapple action
   * @param {Actor} actor   The actor initiating the grapple
   * @private
   */
  async _handleGrappleAction(actor) {
    // Roll the grapple check (2d6 + Strength)
    const grappleRoll = new Roll('2d6+@attributes.talent.strength.value', actor.getRollData());
    await grappleRoll.evaluate();
    
    // Create the grapple chat message with roll result and resistance button
    const content = `
      <div style="background: url('systems/stryder/assets/parchment.jpg'); 
                  background-size: cover; 
                  padding: 15px; 
                  border: 1px solid #c9a66b; 
                  border-radius: 3px;">
        <h3 style="margin-top: 0; border-bottom: 1px solid #c9a66b;"><strong>Grapple Check</strong></h3>
        <p><strong>${actor.name}</strong> has initiated a Grapple check!</p>
        <div style="margin: 10px 0; padding: 10px; background-color: rgba(0,0,0,0.1); border-radius: 3px;">
          <strong>Grapple Roll:</strong> ${grappleRoll.total}
        </div>
        <button class="grapple-resist-button" data-grapple-dc="${grappleRoll.total}" data-grappler-id="${actor.id}" 
                style="background-color: #8b5a2b; color: white; border: none; padding: 8px 16px; border-radius: 3px; cursor: pointer;">
          Roll to Resist
        </button>
      </div>
    `;
    
    await ChatMessage.create({
      content: content,
      speaker: ChatMessage.getSpeaker({actor: actor}),
      rolls: [grappleRoll]
    });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle jump actions from sidebar buttons
    if (dataset.jumpType) {
      return this._handleSidebarJump(dataset.jumpType);
    }

    // Handle grapple action from sidebar button
    if (dataset.actionType === 'grapple') {
      return this._handleGrappleAction(this.actor);
    }

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const row = element.closest('[data-item-id]');
        const itemId = row?.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    const formula = dataset.roll || dataset.customRoll;
    if (formula) {
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(formula, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  /**
   * Handle sidebar jump button clicks (Vertical/Horizontal leaps)
   * @param {string} jumpType  'vertical' or 'horizontal'
   * @private
   */
  async _handleSidebarJump(jumpType) {
    const actor = this.actor;
    const talent = actor.system.attributes?.talent;
    const leapBonus = actor.system.leap_bonus?.bonus || 0;

    let distance;
    if (jumpType === 'vertical') {
      distance = Math.floor((talent?.strength?.value || 0) / 2);
    } else {
      distance = talent?.nimbleness?.value || 0;
    }

    // Apply leap modifiers
    const verticalMod = actor.system.attributes?.vertical_leap?.mod ?? 0;
    const horizontalMod = actor.system.attributes?.horizontal_leap?.mod ?? 0;
    distance += jumpType === 'vertical' ? verticalMod : horizontalMod;

    // Apply Practiced Form bonuses if enabled
    if (actor.system.booleans?.hasPracticedForm) {
      distance += jumpType === 'vertical'
        ? (talent?.nimbleness?.value ?? 0)
        : (talent?.strength?.value ?? 0);
    }

    // Apply Unbound Leap multiplier if enabled
    if (actor.system.booleans?.usingUnboundLeap) {
      distance += talent?.strength?.value ?? 0;
    }

    // Apply leap bonus
    distance += leapBonus;

    const direction = jumpType === 'vertical' ? 'vertically' : 'horizontally';

    let staminaText = actor.system.booleans?.usingUnboundLeap ?
      "No Stamina was spent (Unbound Leap)." :
      "1 Stamina was spent (Swift Action).";

    // Spend stamina unless Unbound Leap
    if (!actor.system.booleans?.usingUnboundLeap) {
      const currentStamina = actor.system.stamina.value;
      if (currentStamina < 1) {
        return ui.notifications.warn(`${actor.name} doesn't have enough Stamina to leap!`);
      }

      // Check for Stunned condition
      const { handleStunnedStaminaSpend, removeStunnedEffect } = await import('../conditions/stunned.mjs');
      const stunnedResult = await handleStunnedStaminaSpend(actor, 1, 'jump');
      if (!stunnedResult.shouldProceed) {
        return;
      }

      await actor.update({"system.stamina.value": currentStamina - stunnedResult.cost});

      if (stunnedResult.cost > 1) {
        await removeStunnedEffect(actor, stunnedResult.cost - 1);
      }
    }

    const message = `
    <div class="chat-message-card-jump">
      <div class="chat-message-header">
        <img src="systems/stryder/assets/${jumpType}-jump-icon.svg" class="chat-message-icon-jump">
        <h3 class="chat-message-title-jump">${actor.name} Leaps ${direction}</h3>
      </div>
      <div class="chat-message-details-jump">
        <div class="chat-message-detail-row-jump">
          <span class="chat-message-detail-label-jump">Distance:</span>
          <span class="chat-distance-box-jump">${distance} spaces</span>
        </div>
      </div>
      <div class="chat-message-footer-jump">
        <div class="stamina-cost-jump">
          <img src="systems/stryder/assets/stamina-icon.svg" style="border: 0px;" width="20" height="20">
          <span>${staminaText}</span>
        </div>
      </div>
    </div>
    `;

    await ChatMessage.create({
      content: message,
      speaker: ChatMessage.getSpeaker({actor: actor})
    });
  }

  // ---------------------------------------------------------------------------
  // Talent manual-override system
  // ---------------------------------------------------------------------------
  // Talent values can be set by folk/passive Active Effects (typically OVERRIDE
  // mode). To let players raise a talent above what an effect grants, every
  // character carries one system-managed "Player Talents" effect that uses
  // UPGRADE mode (only applies when its value is higher than the current one)
  // with high priority (runs after folk effects). When the player types a new
  // value into a talent box, we update this effect instead of the raw actor
  // data, so the normal folk-effect OVERRIDE is correctly superseded.

  static TALENT_KEYS = [
    "endurance", "nimbleness", "finesse", "strength", "survival",
    "charm", "wit", "wisdom", "deceit", "diplomacy", "intimacy", "aggression"
  ];

  // ---------------------------------------------------------------------------
  // Folk bonus application
  // ---------------------------------------------------------------------------

  /**
   * Apply all folk-derived talent/sense bonuses as a single "Folk Bonuses"
   * ActiveEffect (ADD mode, priority 50).  Replaces any previous folk effect.
   */
  /**
   * Auto-grant non-choice class features the actor has not yet received.
   * Skips milestones, choices, and technique/lordly picks — those are player-driven
   * in the Growth panel.  Loads from the class-features pack (pack is cached by
   * Foundry so repeated calls within a session are cheap).
   *
   * @param {StryderActor} actor
   * @returns {Promise<{granted: string[], hasWaitingChoice: boolean}>}
   */
  async _grantClassFeatures(actor) {
    const className = actor.system.class?.name ?? '';
    const level     = actor.system.attributes?.level?.value ?? 1;
    if (!className) return { granted: [], hasWaitingChoice: false };

    const cfPack = game.packs.get('stryder.stryder-class-features');
    if (!cfPack) return { granted: [], hasWaitingChoice: false };
    const cfDocs = await cfPack.getDocuments();

    // ── Wytch dedupe migration ─────────────────────────────────────────────
    // Pre-C1 the table used em-dash names ('Hex — Sicken') which mismatched the
    // pack ('Hex: Sicken') — every Growth render re-granted by ID, accumulating
    // duplicates. Run once per open; no-op if no duplicates exist.
    if (className === 'Wytch') {
      const wytchNames = new Set((STRYDER_CLASS_FEATURES.Wytch ?? []).flatMap(ms => ms.feats.map(f => f.name)));
      const byName = {};
      for (const item of actor.items) {
        if (!wytchNames.has(item.name)) continue;
        (byName[item.name] ??= []).push(item);
      }
      const dupIds = [];
      for (const items of Object.values(byName)) {
        if (items.length <= 1) continue;
        items.sort((a, b) => (a.id < b.id ? -1 : 1)); // oldest ID first
        dupIds.push(...items.slice(1).map(i => i.id));
      }
      if (dupIds.length) {
        await actor.deleteEmbeddedDocuments('Item', dupIds);
        console.log(`[Stryder] Wytch dedupe: removed ${dupIds.length} duplicate feature item(s) from ${actor.name}.`);
        ui.notifications.info(`${actor.name}: removed ${dupIds.length} duplicate Wytch feature(s).`);
      }

      // noEmbed migration: delete any previously-granted 'Magykal Focus' / 'Hex Wielding' items.
      // These are now passive rules and must not exist as sheet items.
      const noEmbedNames = new Set(
        (STRYDER_CLASS_FEATURES.Wytch ?? []).flatMap(ms => ms.feats.filter(f => f.noEmbed).map(f => f.name))
      );
      const noEmbedIds = actor.items.filter(i => noEmbedNames.has(i.name)).map(i => i.id);
      if (noEmbedIds.length) {
        await actor.deleteEmbeddedDocuments('Item', noEmbedIds);
        console.log(`[Stryder] Wytch noEmbed migration: removed ${noEmbedIds.length} item(s) from ${actor.name}.`);
        ui.notifications.info(`${actor.name}: removed ${noEmbedIds.length} Wytch passive rule item(s) (now shown in the Battle panel).`);
      }
    }

    const cfById   = Object.fromEntries(cfDocs.map(d => [d._id, d]));
    const cfByName = Object.fromEntries(cfDocs.map(d => [d.name,  d]));
    const ownedNames = new Set(actor.items.map(i => i.name));
    const milestones = STRYDER_CLASS_FEATURES[className] ?? [];
    const toGrant = [];
    let hasWaitingChoice = false;

    for (const ms of milestones) {
      if (ms.level > level) break;
      for (const feat of ms.feats) {
        // milestone = version bump on an existing item (Expanding Bond II/III), not a grant
        if (feat.milestone) continue;
        // noEmbed = passive rule (no sheet item); handled by class panel on the Battle page
        if (feat.noEmbed) continue;

        if (feat.isChoice || feat.isTechChoice || feat.isLordlyChoice ||
            feat.isMysticBlessing || feat.isMasteryGrant) {
          // Detect unclaimed choice at or below current level
          let claimed = true;
          if (feat.isChoice) {
            const v = actor.getFlag('stryder', `augChoice_${feat.id}`);
            claimed = (v !== undefined && v !== null);
          } else if (feat.isTechChoice) {
            const v = actor.getFlag('stryder', `techChoice_lv${ms.level}`);
            claimed = (v !== undefined && v !== null);
          } else if (feat.isLordlyChoice) {
            const { count = 1, startIdx = 0 } = feat;
            claimed = true;
            for (let s = startIdx; s < startIdx + count; s++) {
              if (!actor.getFlag('stryder', `lordlyFeature_${s}`)) { claimed = false; break; }
            }
          } else if (feat.isMysticBlessing) {
            claimed = !!actor.getFlag('stryder', 'mysticBlessingsSense');
          }
          if (!claimed) hasWaitingChoice = true;
          continue;
        }

        if (ownedNames.has(feat.name)) continue;
        const doc = (feat.id && cfById[feat.id]) || cfByName[feat.name];
        if (doc) toGrant.push(doc);
      }
    }

    if (toGrant.length) {
      await actor.createEmbeddedDocuments('Item', toGrant.map(d => d.toObject()));
    }

    // ── Summoner: sync beast sheets to level after feature grants ──────────
    // Fires on level-up, class select, and Growth open — all paths that call
    // _grantClassFeatures — so Size and Matter (L8) is applied immediately.
    if (className === 'Summoner' && game.user.isGM) {
      const { syncSpiritBeastsToLevel } = await import('../abilities/summoner-abilities.mjs');
      await syncSpiritBeastsToLevel(actor);
    }

    return { granted: toGrant.map(d => d.name), hasWaitingChoice };
  }

  /**
   * Strip all items and flags associated with oldClassName from actor.
   * Called before granting a new class so stale features never accumulate.
   * Does NOT touch XP-purchased items (identified by aspectName or isTechnique flags).
   *
   * @param {StryderActor} actor
   * @param {string} oldClassName
   */
  async _stripOldClassFeatures(actor, oldClassName) {
    const milestones = STRYDER_CLASS_FEATURES[oldClassName] ?? [];
    const featureNamesToStrip = new Set();

    for (const ms of milestones) {
      for (const feat of ms.feats) {
        if (feat.name && !feat.milestone) featureNamesToStrip.add(feat.name);
      }
    }

    // Include Ranger technique names chosen via Growth
    if (oldClassName === 'Ranger') {
      for (const ms of milestones) {
        const chosen = actor.getFlag('stryder', `techChoice_lv${ms.level}`);
        if (chosen) featureNamesToStrip.add(chosen);
      }
    }
    // Include Shaman lordly feature names chosen via Growth
    if (oldClassName === 'Shaman') {
      for (let s = 0; s < 8; s++) {
        const lf = actor.getFlag('stryder', `lordlyFeature_${s}`);
        if (lf) featureNamesToStrip.add(lf);
      }
    }

    // Delete embedded items that match (skip XP-purchased aspects/techniques)
    const idsToRemove = actor.items
      .filter(i =>
        featureNamesToStrip.has(i.name) &&
        !i.flags?.stryder?.aspectName &&
        !i.flags?.stryder?.isTechnique &&
        i.flags?.stryder?.xpCost === undefined
      )
      .map(i => i.id);

    if (idsToRemove.length) {
      await actor.deleteEmbeddedDocuments('Item', idsToRemove);
    }

    // Build flag-clear update: null every class-specific flag family
    const u = {};
    const S = 'stryder';

    // Warrior aug choice + aug stat flags
    for (const feat of [
      'WrrAbil02WaI', 'WrrAbil03WaII', 'WrrAbil04WaIII', 'WrrAbil05WaIV',
    ]) u[`flags.${S}.augChoice_${feat}`] = null;
    for (const f of [
      'augExcellentRange1012', 'augAttackBonus', 'augHealthBonus', 'augStaminaBonus',
      'augExtraStatPoints', 'augPoorRangeOverride', 'augDailyRerollAvailable',
      'augDoubleExcellentDamage', 'augDamageReduction',
    ]) u[`flags.${S}.${f}`] = null;

    // Ranger tech-choice flags
    for (const ms of STRYDER_CLASS_FEATURES.Ranger ?? []) {
      u[`flags.${S}.techChoice_lv${ms.level}`] = null;
    }

    // Shaman lordly + blessing flags
    for (let s = 0; s < 8; s++) u[`flags.${S}.lordlyFeature_${s}`] = null;
    u[`flags.${S}.mysticBlessingsSense`] = null;

    // Warlock/Wytch health-reduction flags
    u[`flags.${S}.bloodlossHealthReduction`]  = null;
    u[`flags.${S}.sacrificeHealthReduction`]  = null;
    u[`flags.${S}.burningHealthReduction`]    = null;
    u[`flags.${S}.wytchRiseHealthReduction`]  = null;
    u[`flags.${S}.springOfLifeActive`]        = null;
    // Wytch transient flags
    u[`flags.${S}.hexCountThisPhase`]   = null;
    u[`flags.${S}.wytchEyeDurability`]  = null;
    u[`flags.${S}.wytchEyeUsed`]        = null;
    u[`flags.${S}.focusEyes`]           = null;
    u[`flags.${S}.focusBones`]          = null;
    u[`flags.${S}.focusManaVeins`]      = null;
    u[`flags.${S}.magykalPotencyBonus`] = null;

    // Revert Warrior Aug IV DR direct-write if applicable
    const augDR = actor.getFlag(S, 'augDamageReduction') ?? 0;
    if (augDR > 0) {
      u['system.physical_reduction'] = Math.max(0, (actor.system.physical_reduction ?? 0) - augDR);
      u['system.magykal_reduction']  = Math.max(0, (actor.system.magykal_reduction  ?? 0) - augDR);
    }

    await actor.update(u);
  }

  /**
   * Called when Shaman is selected as a class. Shows a dialog to link an
   * existing Lordling actor or create a new one.
   */
  async _promptLordlingLink() {
    const actor = this.actor;

    // Find Lordling actors this user owns that aren't already linked to someone else
    const available = game.actors.filter(a =>
      a.type === 'lordling' &&
      a.isOwner &&
      (!a.system.linkedCharacterId || a.system.linkedCharacterId === actor.id)
    );

    const hasLordlings = available.length > 0;

    // Build option list HTML
    const optionRows = hasLordlings
      ? available.map(l =>
          `<label class="sty-dlg-option-row">
            <input type="radio" name="lordling-pick" value="${l.id}">
            <img src="${l.img}" width="24" height="24">
            <span class="sty-name">${l.name}</span>
          </label>`
        ).join('')
      : `<p class="sty-dlg-hint">No Lordling actors found. Create one below.</p>`;

    const content = `
      <div class="sty-dlg-body">
        <p>As a Shaman, <strong>${actor.name}</strong> requires a linked <strong>Lordling</strong> sheet
          to track their companion's stats, Tactic Points, and Aspect Features.</p>
        ${hasLordlings ? `<div style="margin-bottom:10px;">${optionRows}</div>` : optionRows}
      </div>`;

    const choice = await new Promise(resolve => {
      new Dialog({
        title: 'Link a Lordling',
        content,
        buttons: {
          ...(hasLordlings ? {
            link: {
              label: '🔗 Link Selected',
              callback: (html) => {
                const picked = html.find('input[name="lordling-pick"]:checked').val();
                resolve({ action: 'link', lordlingId: picked ?? null });
              }
            }
          } : {}),
          create: {
            label: '✦ Create New Lordling',
            callback: () => resolve({ action: 'create' })
          },
          skip: {
            label: 'Skip for Now',
            callback: () => resolve({ action: 'skip' })
          }
        },
        default: hasLordlings ? 'link' : 'create',
      }, { width: 420, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
    });

    if (!choice || choice.action === 'skip') {
      ui.notifications.info('You can link a Lordling later from their sheet by setting the Linked Character field.');
      return;
    }

    if (choice.action === 'link') {
      if (!choice.lordlingId) { ui.notifications.warn('No Lordling selected.'); return; }
      const lordling = game.actors.get(choice.lordlingId);
      if (!lordling) return;
      await lordling.update({ 'system.linkedCharacterId': actor.id });
      ui.notifications.info(`${lordling.name} is now linked to ${actor.name}.`);
      lordling.sheet?.render(true);
      return;
    }

    if (choice.action === 'create') {
      // Create a new Lordling actor with sensible defaults, linked to this Shaman
      const lordlingData = {
        name:   `${actor.name}'s Lordling`,
        type:   'lordling',
        img:    'icons/creatures/mammals/beast-giant-bear-growl.webp',
        system: {
          linkedCharacterId: actor.id,
          tactics: { value: 6, min: 0, max: 6 },
          health:  { value: actor.system.health?.max ?? 8, max: actor.system.health?.max ?? 8 },
        },
        ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      };
      const [newLordling] = await Actor.createDocuments([lordlingData]);
      ui.notifications.info(`${newLordling.name} created and linked to ${actor.name}. Configure their stats on the Lordling sheet.`);
      newLordling.sheet?.render(true);
    }
  }

  async _applyFolkChoices(folkName, choices) {
    const folkData = STRYDER_FOLK_DATA[folkName];
    if (!folkData) return;

    // --- Build talent bonus map ---
    const talentBonuses = { ...folkData.talents };

    // Free-choice talent points (Traveler, Wildkin)
    if (choices.talentPoints) {
      for (const [t, pts] of Object.entries(choices.talentPoints)) {
        talentBonuses[t] = (talentBonuses[t] || 0) + Number(pts);
      }
    }

    // Colossus stat choice (+3 primary, +1 secondary)
    if (choices.colossusStat) {
      const primary   = choices.colossusStat;
      const secondary = primary === 'Strength' ? 'Endurance' : 'Strength';
      talentBonuses[primary]   = (talentBonuses[primary]   || 0) + 3;
      talentBonuses[secondary] = (talentBonuses[secondary] || 0) + 1;
    }

    // Colossus subfolk extra talents
    if (choices.subfolk && STRYDER_COLOSSUS_SUBFOLK[choices.subfolk]) {
      for (const [t, v] of Object.entries(STRYDER_COLOSSUS_SUBFOLK[choices.subfolk].talents)) {
        talentBonuses[t] = (talentBonuses[t] || 0) + v;
      }
    }

    // --- Build sense bonus map ---
    const senseBonuses = { ...folkData.senses };

    // Traveler free sense choices (2 different senses, +1 each)
    if (choices.senseChoices && Array.isArray(choices.senseChoices)) {
      for (const s of choices.senseChoices) {
        senseBonuses[s] = (senseBonuses[s] || 0) + 1;
      }
    }

    // Wildkin sense choice (+2 to one)
    if (choices.senseOneChoice) {
      senseBonuses[choices.senseOneChoice] = (senseBonuses[choices.senseOneChoice] || 0) + 2;
    }

    // --- Build ActiveEffect changes ---
    const changes = [];
    for (const [talent, bonus] of Object.entries(talentBonuses)) {
      // Folk data keys talents with capitalised names (e.g. "Intimacy"), but the
      // schema/talent paths are lowercase ("intimacy"). Lowercase the key so the
      // ADD lands on the real field — otherwise the Folk talent bonus writes to a
      // phantom "talent.Intimacy.value" and never shows (the sense loop below
      // already lowercases, which is why senses worked but talents didn't).
      if (bonus) changes.push({
        key:   `system.attributes.talent.${talent.toLowerCase()}.value`,
        mode:  CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(bonus),
        priority: 50
      });
    }
    for (const [sense, bonus] of Object.entries(senseBonuses)) {
      if (bonus) changes.push({
        key:   `system.attributes.sense.${sense.toLowerCase()}.value`,
        mode:  CONST.ACTIVE_EFFECT_MODES.ADD,
        value: String(bonus),
        priority: 50
      });
    }

    // --- Oumen: grant affliction items + Demon Slayer ---
    if (folkName === 'Oumen') {
      // Remove any previously granted folk ability items
      const oldFolkItems = [...this.actor.items].filter(i => i.flags?.stryder?.isFolkAbility);
      for (const i of oldFolkItems) await i.delete();

      const itemsToCreate = [];

      // Demon Slayer — all Oumen receive this
      itemsToCreate.push({
        name: 'Demon Slayer', type: 'racial', img: 'icons/svg/aura.svg',
        system: {
          description: '<p>By nature of your ability to overcome the affect of the Other you are also given a bolstered physical ability to overcome Demons. When dealt damage by any Attack, Skill, or Monster magyk by a Demon you reduce the damage dealt to you by 4.</p>',
          roll: { diceBonus: 0, diceNum: 2, diceSize: 6 },
          cooldown_type: 'perRest', cooldown_value: 0, uses_current: 0,
        },
        flags: { stryder: { isFolkAbility: true } },
      });

      // Affliction-specific pair
      const aff = choices.affliction ? STRYDER_OUMEN_AFFLICTIONS[choices.affliction] : null;
      if (aff) {
        // Apply affliction passive AE changes (e.g. +2 mana, Strength → 5, +2 move)
        for (const c of aff.aeChanges) changes.push(c);

        itemsToCreate.push({
          name: aff.passive.name, type: 'racial', img: 'icons/svg/aura.svg',
          system: {
            description: aff.passive.description,
            roll: { diceBonus: 0, diceNum: 2, diceSize: 6 },
            cooldown_type: 'perRest', cooldown_value: 0, uses_current: 0,
          },
          flags: { stryder: { isFolkAbility: true } },
        });
        itemsToCreate.push({
          name: aff.active.name, type: 'racial', img: 'icons/svg/aura.svg',
          system: {
            description: aff.active.description,
            roll: { diceBonus: 0, diceNum: 2, diceSize: 6 },
            cooldown_type: 'perRest',
            cooldown_value: aff.active.cooldown_value,
            uses_current: aff.active.cooldown_value,
          },
          flags: { stryder: { isFolkAbility: true } },
        });
      }

      if (itemsToCreate.length) {
        await this.actor.createEmbeddedDocuments('Item', itemsToCreate);
      }
    }

    // Rebuild AE now that affliction changes may have been appended
    if (changes.length > 0) {
      const existingEffects2 = [...this.actor.effects].filter(e => e.flags?.stryder?.isFolkBonus);
      for (const e of existingEffects2) await e.delete();
      await this.actor.createEmbeddedDocuments('ActiveEffect', [{
        name: `Folk Bonuses (${folkName})`,
        icon: 'icons/svg/aura.svg',
        changes,
        disabled: false,
        transfer: false,
        flags: { stryder: { isFolkBonus: true } }
      }]);
    }

    // Persist folk choices to actor
    await this.actor.update({
      'system.folk.name':                folkName,
      'system.folk.subfolk':             choices.subfolk             || '',
      'system.folk.size_choice':         choices.size                || folkData.size || '',
      'system.folk.colossus_stat_choice': choices.colossusStat       || '',
      'system.folk.traveler_boon':       choices.travelerBoon        || '',
      'system.folk.wildkin_adaptations': choices.adaptations         || [],
      'system.folk.talent_free_points':  choices.talentPoints        || {},
      'system.folk.sense_free_choices':  choices.senseChoices        || (choices.senseOneChoice ? [choices.senseOneChoice] : []),
      'system.folk.oumen_affliction':    choices.affliction           || '',
      'system.folk.bonuses_applied':     true
    });

    this.render(false);
  }

  /**
   * Show the folk assignment popup for the given folk.
   * Fixed-bonus folk get a read-only confirmation; complex folk get pickers.
   */
  _showFolkPopup(folkName, existingChoices = {}) {
    const folkData = STRYDER_FOLK_DATA[folkName];
    if (!folkData) return;

    const isFixed = !folkData.freePoints && !folkData.statChoice && !folkData.sizeChoices && !folkData.originFolkPicker;

    let content = `<div class="folk-popup-card">`;
    content += `<div class="folk-popup-title">${folkName}</div>`;

    // --- Fixed-bonus folk: read-only summary ---
    if (isFixed) {
      const talentLines = Object.entries(folkData.talents).map(([k,v]) => `${k} +${v}`).join(', ');
      const senseLines  = Object.entries(folkData.senses ).map(([k,v]) => `${k} +${v}`).join(', ');
      content += `<p>Talents: <span style="color:var(--sty-stagger);">${talentLines || '—'}</span></p>`;
      content += `<p>Senses: <span style="color:var(--sty-stagger);">${senseLines || '—'}</span></p>`;
      if (folkData.passives.length) {
        folkData.passives.forEach(p => {
          content += `<p>⚑ ${p}</p>`;
        });
      }
    }

    // --- Oumen: origin folk picker ---
    if (folkData.originFolkPicker) {
      const others = Object.keys(STRYDER_FOLK_DATA).filter(f => f !== 'Oumen');
      const curOrigin = existingChoices.originFolk || '';
      content += `<div class="folk-popup-section"><label>Origin Folk (appearance only)</label>`;
      content += `<div class="fp-custom-select" data-fpid="fp-origin">`;
      content += `<button type="button" class="fp-cs-trigger">${curOrigin || '— Choose —'}<span class="fp-cs-arrow">▾</span></button>`;
      content += `<div class="fp-cs-options">`;
      content += `<div class="fp-cs-option" data-value="">— Choose —</div>`;
      others.forEach(f => {
        const sel = curOrigin === f ? ' fp-cs-selected' : '';
        content += `<div class="fp-cs-option${sel}" data-value="${f}">${f}</div>`;
      });
      content += `</div><input type="hidden" id="fp-origin" value="${curOrigin}"></div></div>`;
    }

    // --- Oumen: affliction picker ---
    if (folkData.afflictionPicker) {
      const curAffliction = existingChoices.affliction || '';
      content += `<div class="folk-popup-section"><label>Affliction <span class="sty-dlg-hint">— which body part was corrupted by the Other?</span></label>`;
      Object.entries(STRYDER_OUMEN_AFFLICTIONS).forEach(([name, aff]) => {
        const chk = curAffliction === name ? 'checked' : '';
        content += `<label class="sty-dlg-option">
          <input type="radio" name="fp-affliction" value="${name}" ${chk}>
          <strong>${name}</strong>
          <span class="sty-dlg-hint">— ${aff.summary}</span>
        </label>`;
      });
      content += `</div>`;
    }

    // --- Size picker ---
    if (folkData.sizeChoices) {
      content += `<div class="folk-popup-section"><label>Size</label>`;
      folkData.sizeChoices.forEach(sz => {
        const chk = (existingChoices.size === sz) ? 'checked' : '';
        content += `<label class="sty-dlg-option"><input type="radio" name="fp-size" value="${sz}" ${chk}> ${sz}</label>`;
      });
      content += `</div>`;
    }

    // --- Colossus subfolk + stat choice ---
    if (folkData.subfolks && folkName === 'Colossus') {
      content += `<div class="folk-popup-section"><label>Subfolk</label>`;
      folkData.subfolks.forEach(sf => {
        const sub = STRYDER_COLOSSUS_SUBFOLK[sf];
        const chk = (existingChoices.subfolk === sf) ? 'checked' : '';
        const note = sub ? ` — Immune to ${sub.immunities.join(', ')}; +${Object.entries(sub.talents).map(([k,v])=>`${v} ${k}`).join(', ')}` : '';
        content += `<label class="sty-dlg-option"><input type="radio" name="fp-subfolk" value="${sf}" ${chk}> ${sf}${note}</label>`;
      });
      content += `</div>`;
      content += `<div class="folk-popup-section"><label>Assign +3 to Stat (+1 to the other)</label>`;
      ['Strength','Endurance'].forEach(st => {
        const chk = (existingChoices.colossusStat === st) ? 'checked' : '';
        content += `<label class="sty-dlg-option"><input type="radio" name="fp-stat" value="${st}" ${chk}> ${st}</label>`;
      });
      content += `</div>`;
    }

    // --- Traveler subfolk + talent distribution + sense picks ---
    if (folkName === 'Traveler') {
      content += `<div class="folk-popup-section"><label>Boon (Subfolk)</label>`;
      folkData.subfolks.forEach(sf => {
        const chk = (existingChoices.travelerBoon === sf || existingChoices.subfolk === sf) ? 'checked' : '';
        content += `<label class="sty-dlg-option"><input type="radio" name="fp-boon" value="${sf}" ${chk}> ${sf}</label>`;
      });
      content += `</div>`;

      const allTalents = ['Aggression','Charm','Deceit','Diplomacy','Endurance','Finesse','Intimacy','Nimbleness','Strength','Survival','Wisdom','Wit'];
      content += `<div class="folk-popup-section"><label>Distribute 4 Talent Points <span id="fp-talent-remaining">(4 remaining)</span></label>`;
      content += `<div class="sty-dlg-grid-2">`;
      allTalents.forEach(t => {
        const cur = existingChoices.talentPoints?.[t] ?? 0;
        content += `<div class="sty-dlg-talent-row"><span class="tlabel">${t}</span><input type="number" class="fp-talent-input sty-dlg-num-input" data-talent="${t}" value="${cur}" min="0" max="4"></div>`;
      });
      content += `</div></div>`;

      const senses = ['Arcane','Hearing','Sight','Smell','Touch'];
      ['1','2'].forEach(n => {
        const cur = existingChoices.senseChoices?.[Number(n)-1] ?? '';
        content += `<div class="folk-popup-section"><label>Sense Pick ${n}</label>`;
        content += `<div class="fp-custom-select" data-fpidx="${n}">`;
        content += `<button type="button" class="fp-cs-trigger">${cur || '— Choose —'}<span class="fp-cs-arrow">▾</span></button>`;
        content += `<div class="fp-cs-options">`;
        content += `<div class="fp-cs-option" data-value="">— Choose —</div>`;
        senses.forEach(s => {
          const sel = cur === s ? ' fp-cs-selected' : '';
          content += `<div class="fp-cs-option${sel}" data-value="${s}">${s}</div>`;
        });
        content += `</div><input type="hidden" class="fp-sense-pick" data-sense-idx="${n}" value="${cur}"></div></div>`;
      });
    }

    // --- Wildkin: talent distribution + sense choice + adaptations ---
    if (folkName === 'Wildkin') {
      const fp = folkData.freePoints;
      content += `<div class="folk-popup-section"><label>Distribute 4 Talent Points (max 5 per talent) <span id="fp-talent-remaining">(4 remaining)</span></label>`;
      content += `<div class="sty-dlg-grid-2">`;
      fp.talentTargets.forEach(t => {
        const cur = existingChoices.talentPoints?.[t] ?? 0;
        content += `<div class="sty-dlg-talent-row"><span class="tlabel">${t}</span><input type="number" class="fp-talent-input sty-dlg-num-input" data-talent="${t}" value="${cur}" min="0" max="5"></div>`;
      });
      content += `</div></div>`;

      content += `<div class="folk-popup-section"><label>Sense Bonus (+2 to one)</label>`;
      fp.senseChoice.forEach(s => {
        const cur = existingChoices.senseChoices?.[0] ?? existingChoices.senseOneChoice ?? '';
        content += `<label class="sty-dlg-option"><input type="radio" name="fp-sense-one" value="${s}" ${cur===s?'checked':''}> ${s} +2</label>`;
      });
      content += `</div>`;

      const chosen = existingChoices.adaptations || [];
      content += `<div class="folk-popup-section"><label>Choose 3 Adaptations <span id="fp-adapt-count">(${chosen.length}/3 chosen)</span></label>`;
      content += `<div class="folk-adapt-list">`;
      folkData.adaptations.forEach(a => {
        const chk = chosen.includes(a.name) ? 'checked' : '';
        const dis = (!chk && chosen.length >= 3) ? 'disabled' : '';
        content += `<label class="folk-adapt-item"><input type="checkbox" class="fp-adapt-cb" value="${a.name}" ${chk} ${dis}><span><span class="aname">${a.name}</span><br><span class="adesc">${a.description}</span></span></label>`;
      });
      content += `</div></div>`;
    }

    content += `</div>`;

    new Dialog({
      title: `Choose Folk: ${folkName}`,
      content,
      buttons: {
        confirm: {
          label: 'Confirm',
          callback: (html) => {
            const choices = {};

            // Size
            const sizeEl = html.find('input[name="fp-size"]:checked');
            if (sizeEl.length) choices.size = sizeEl.val();

            // Oumen origin folk
            const originEl = html.find('#fp-origin');
            if (originEl.length) choices.originFolk = originEl.val();

            // Oumen affliction
            const afflictionEl = html.find('input[name="fp-affliction"]:checked');
            if (afflictionEl.length) choices.affliction = afflictionEl.val();

            // Colossus
            const subfolkEl = html.find('input[name="fp-subfolk"]:checked');
            if (subfolkEl.length) choices.subfolk = subfolkEl.val();
            const statEl = html.find('input[name="fp-stat"]:checked');
            if (statEl.length) choices.colossusStat = statEl.val();

            // Traveler boon
            const boonEl = html.find('input[name="fp-boon"]:checked');
            if (boonEl.length) { choices.subfolk = boonEl.val(); choices.travelerBoon = boonEl.val(); }

            // Talent free points
            const talentInputs = html.find('.fp-talent-input');
            if (talentInputs.length) {
              choices.talentPoints = {};
              talentInputs.each((_, el) => {
                const v = parseInt(el.value) || 0;
                if (v > 0) choices.talentPoints[el.dataset.talent] = v;
              });
            }

            // Traveler sense picks
            const sensePicks = html.find('.fp-sense-pick');
            if (sensePicks.length) {
              choices.senseChoices = [];
              sensePicks.each((_, el) => { if (el.value) choices.senseChoices.push(el.value); });
            }

            // Wildkin sense one-choice
            const senseOne = html.find('input[name="fp-sense-one"]:checked');
            if (senseOne.length) choices.senseOneChoice = senseOne.val();

            // Wildkin adaptations
            const adaptCbs = html.find('.fp-adapt-cb:checked');
            if (adaptCbs.length) {
              choices.adaptations = [];
              adaptCbs.each((_, el) => choices.adaptations.push(el.value));
            }

            this._applyFolkChoices(folkName, choices);
          }
        },
        cancel: { label: 'Cancel' }
      },
      default: 'confirm',
      render: (html) => {
        // Live talent-pool counter
        const updateTalentCounter = () => {
          const pool = folkName === 'Traveler' ? 4 : 4;
          const used = html.find('.fp-talent-input').toArray().reduce((s, el) => s + (parseInt(el.value)||0), 0);
          const rem  = pool - used;
          html.find('#fp-talent-remaining').text(`(${rem >= 0 ? rem : 0} remaining)`).css('color', rem < 0 ? '#e05050' : '#c8a03c');
        };
        html.find('.fp-talent-input').on('input', updateTalentCounter);
        updateTalentCounter();

        // Live Wildkin adaptation counter
        html.find('.fp-adapt-cb').on('change', function() {
          const checked = html.find('.fp-adapt-cb:checked');
          html.find('#fp-adapt-count').text(`(${checked.length}/3 chosen)`);
          if (checked.length >= 3) {
            html.find('.fp-adapt-cb:not(:checked)').prop('disabled', true);
          } else {
            html.find('.fp-adapt-cb').prop('disabled', false);
          }
        });

        // Custom dropdown — open/close trigger
        html.find('.fp-cs-trigger').on('click', function(ev) {
          ev.stopPropagation();
          const parent = $(this).closest('.fp-custom-select');
          const isOpen = parent.hasClass('fp-cs-open');
          // Close all open dropdowns first
          html.find('.fp-custom-select.fp-cs-open').each(function() {
            $(this).removeClass('fp-cs-open').find('.fp-cs-options').hide();
          });
          if (!isOpen) {
            const rect = this.getBoundingClientRect();
            const opts = parent.find('.fp-cs-options');
            opts.css({ top: (rect.bottom + 1) + 'px', left: rect.left + 'px', width: rect.width + 'px', display: 'block' });
            parent.addClass('fp-cs-open');
          }
        });

        // Custom dropdown — option selection
        html.find('.fp-cs-option').on('click', function(ev) {
          ev.stopPropagation();
          const val   = $(this).data('value');
          const label = val || '— Choose —';
          const parent = $(this).closest('.fp-custom-select');
          // Update trigger text
          parent.find('.fp-cs-trigger').html(`${label}<span class="fp-cs-arrow">▾</span>`);
          // Update hidden input (by id or by sense-idx)
          const fpid  = parent.data('fpid');
          const fpidx = parent.data('fpidx');
          if (fpid)  parent.find(`#${fpid}`).val(val);
          if (fpidx) parent.find('.fp-sense-pick').val(val);
          // Mark selected
          parent.find('.fp-cs-option').removeClass('fp-cs-selected');
          if (val) $(this).addClass('fp-cs-selected');
          // Close
          parent.removeClass('fp-cs-open').find('.fp-cs-options').hide();
        });

        // Close all custom dropdowns on click outside
        $(document).on('click.fpcs', function() {
          html.find('.fp-custom-select.fp-cs-open').each(function() {
            $(this).removeClass('fp-cs-open').find('.fp-cs-options').hide();
          });
        });
      }
    }, { width: 480, classes: ['stryder', 'dialog', 'folk-popup'] }).render(true);
  }

  /**
   * Create or update the "Player Talents" effect so each talent in
   * talentUpdates is stored as an UPGRADE change with priority 100.
   * The UPGRADE mode means the change only applies when its value is
   * greater than whatever the folk/passive effects already set.
   */
  async _updatePlayerTalentOverrides(talentUpdates) {
    const actor = this.actor;
    const existing = actor.effects.find(e => e.flags?.stryder?.isPlayerTalents);

    if (!existing) {
      // First edit — build the full 12-talent effect, seeding from current
      // source values so existing manual data isn't lost.
      const src = foundry.utils.getProperty(actor.toObject(false), 'system.attributes.talent') ?? {};
      const changes = StryderActorSheet.TALENT_KEYS.map(talent => ({
        key: `system.attributes.talent.${talent}.value`,
        mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, // 5 — always wins; lets players set any value
        value: String(talentUpdates[talent] ?? Number(src[talent]?.value ?? 0)),
        priority: 200
      }));
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name: "Player Talents",
        icon: "icons/svg/upgrade.svg",
        changes,
        disabled: false,
        transfer: false,
        flags: { stryder: { isPlayerTalents: true } }
      }]);
    } else {
      // Update only the changed keys; also migrate mode/priority to OVERRIDE/200 if needed.
      const changes = existing.changes.map(change => {
        const m = change.key.match(/^system\.attributes\.talent\.(\w+)\.value$/);
        const updatedValue = m && talentUpdates[m[1]] !== undefined
          ? { value: String(talentUpdates[m[1]]) }
          : {};
        return {
          ...change,
          ...updatedValue,
          mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, // 5 — always wins
          priority: 200
        };
      });
      await existing.update({ changes });
    }
  }

  /**
   * Override _onDropItem so the inventory grid accepts any item type from
   * the world, compendium, or other actors.  Preserves the item's size field
   * (defaulting to 1 if absent) and skips re-embedding if the item already
   * lives on this actor.
   * @override
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    const item = await Item.fromDropData(data);
    if (!item) return false;

    // Prevent re-embedding an item that already belongs to this actor
    if (item.parent?.id === this.actor.id) return false;

    // ── Class item drop: route through the same selection path as the dropdown ──
    if (item.type === 'class') {
      const className = item.name;
      const classData = STRYDER_CLASS_DATA[className];
      if (!classData) {
        ui.notifications.warn(`Unknown class "${className}" — embedding as a plain item.`);
      } else {
        const oldClassName = this.actor.system.class?.name ?? '';
        if (oldClassName && oldClassName !== className) {
          const ok = await Dialog.confirm({
            title:   'Switch Class',
            content: `<div class="sty-dlg-body"><p>Dropping <strong>${className}</strong> will replace <strong>${oldClassName}</strong> and remove its class features and choice flags.</p><p class="sty-dlg-warn">XP-purchased Aspects and Techniques are kept.</p></div>`,
            options: { classes: ['dialog', 'stryder-stat-popup'], width: 400 },
          });
          if (!ok) return false;
          await this._stripOldClassFeatures(this.actor, oldClassName);
        }

        const level   = this.actor.system.attributes.level.value ?? 1;
        const clamped = Math.min(15, Math.max(1, level));
        const newMax  = classData.base_hp + (classData.hp_per_level * (clamped - 1));
        await this.actor.update({
          'system.class.name':         className,
          'system.class.base_hp':      classData.base_hp,
          'system.class.hp_per_level': classData.hp_per_level,
          'system.health.max':         newMax,
          'system.health.value':       newMax,
        });

        if (className === 'Shaman') {
          const alreadyLinked = game.actors.find(a => a.type === 'lordling' && a.system.linkedCharacterId === this.actor.id);
          if (!alreadyLinked) await this._promptLordlingLink();
        }

        await this._grantClassFeatures(this.actor);
        ui.notifications.info(`Class set to ${className} via item drop. Max Health updated to ${newMax}.`);

        // Embed the class item as the visible record of the chosen class
        const itemData = item.toObject();
        return this.actor.createEmbeddedDocuments('Item', [itemData]);
      }
    }

    const itemData = item.toObject();

    // Ensure every dropped item has a size field
    if (!itemData.system) itemData.system = {};
    if (itemData.system.size === undefined || itemData.system.size === null) {
      itemData.system.size = 1;
    }

    return this.actor.createEmbeddedDocuments('Item', [itemData]);
  }

  /**
   * Handle clicking the icon/start cell of an inventory grid item.
   * Opens a compact detail popup with Full Details, Discard, and Close actions.
   * @param {PointerEvent} event
   */
  async _onInventoryItemClick(event) {
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const itemImg = item.img || '';
    const itemName = item.name;
    const itemSize = item.system?.size || 1;
    const strippedDescription = (item.system?.description ?? '').replace(/<[^>]+>/g, '');

    const content = `
      <div class="inv-popup">
        <!-- Icon + slot -->
        <div class="inv-popup-img-row">
          <div class="inv-popup-img-wrap" data-action="changeIcon">
            ${itemImg
              ? `<img src="${itemImg}" alt="${itemName}">`
              : `<i class="fas fa-box inv-img-placeholder"></i>`}
          </div>
          <div>
            <div class="inv-popup-slot">${itemSize} slot${itemSize !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <!-- Description -->
        <div class="inv-popup-body">${strippedDescription || '<span class="inv-popup-body-empty">No description.</span>'}</div>

        <!-- Action Buttons -->
        <div class="inv-popup-actions">
          <button type="button" class="inv-action-btn inv-btn-use" data-action="use">✦ USE</button>
          <button type="button" class="inv-action-btn inv-btn-inspect" data-action="inspect">INSPECT</button>
          <button type="button" class="inv-action-btn inv-btn-discard" data-action="discard">DISCARD</button>
        </div>
      </div>
    `;

    const dialog = new Dialog({
      title: item.name,
      content,
      buttons: {},
      render: (html) => {
        // Style the Foundry dialog window chrome
        const win = html.closest('.dialog');
        if (win.length) {
          win.css({
            'background': '#0a1628',
            'border': '1px solid rgba(80,160,255,0.3)',
            'border-radius': '12px',
            'box-shadow': '0 0 30px rgba(60,130,255,0.2), 0 4px 24px rgba(0,0,0,0.7)',
          });
          win.find('.window-header, .dialog-header').css({
            'background': 'transparent',
            'border-bottom': '1px solid rgba(80,160,255,0.15)',
            'color': '#a8d4ff',
            'text-shadow': '0 0 12px rgba(100,180,255,0.5)',
            'font-size': '13px',
            'letter-spacing': '0.08em',
            'text-transform': 'uppercase',
            'padding': '10px 14px',
          });
          win.find('.window-header .close, .dialog-header .close').css({
            'color': 'rgba(168,212,255,0.5)',
          });
          win.find('.dialog-buttons').hide();
        }

        // Use button
        html.find('[data-action="use"]').on('click', async () => {
          if (item.type === 'elixir') {
            dialog.close();
            return this._useElixir(item);
          }
          // Placeholder: future "use" logic for other item types
          ui.notifications.info(`You used ${item.name}.`);
          dialog.close();
          if (item.system.is_consumable) {
            await item.delete();
            Object.values(ui.windows).forEach(w => {
              if (w.options?.classes?.includes('inv-item-dialog')) w.close();
            });
          }
        });

        // Icon click → icon picker
        html.find('[data-action="changeIcon"], .inv-popup-img-wrap').on('click', () => {
          this._showIconPicker(item, dialog);
        });

        // Inspect button
        html.find('[data-action="inspect"]').on('click', () => {
          item.sheet.render(true);
          dialog.close();
        });

        // Discard button
        html.find('[data-action="discard"]').on('click', async () => {
          dialog.close();
          const confirmed = await Dialog.confirm({
            title: 'Discard Item',
            content: `<p>Remove <strong>${item.name}</strong> from your inventory?</p>`,
          });
          if (confirmed) await item.delete();
        });
      }
    }, {
      classes: ['dialog', 'inv-item-dialog'],
      width: 260,
      height: 'auto'
    });

    dialog.render(true);
  }

  /**
   * Execute an elixir's effect on the owning actor, post a chat card,
   * apply Elixir Sickness, and close the inventory popup.
   * @param {Item} item  The elixir item embedded on this actor
   */
  async _useElixir(item) {
    const actor = this.actor;
    const sys = item.system;
    const name = item.name;

    // ── Apply effect ────────────────────────────────────────────────────────
    let effectMsg = sys.description?.replace(/<[^>]+>/g, '') ?? '';

    if (sys.effect_type === 'heal_hp_pct') {
      const maxHp = actor.system.health.max?.value ?? actor.system.health.max;
      const heal = Math.floor(maxHp * (sys.effect_value / 100));
      const current = actor.system.health.value;
      const newVal = Math.min(current + heal, maxHp);
      await actor.update({ 'system.health.value': newVal });
      effectMsg = `Restored ${newVal - current} HP (${sys.effect_value}% of max).`;

    } else if (sys.effect_type === 'restore_mana_flat') {
      const maxMana = actor.system.mana.max?.value ?? actor.system.mana.max;
      const current = actor.system.mana.value;
      const newVal = Math.min(current + sys.effect_value, maxMana);
      await actor.update({ 'system.mana.value': newVal });
      effectMsg = `Restored ${newVal - current} Mana.`;

    } else if (sys.effect_type === 'restore_stamina_flat') {
      const maxStam = actor.system.stamina.max?.value ?? actor.system.stamina.max;
      const current = actor.system.stamina.value;
      const newVal = Math.min(current + sys.effect_value, maxStam);
      await actor.update({ 'system.stamina.value': newVal });
      effectMsg = `Restored ${newVal - current} Stamina.`;

    } else if (sys.effect_type === 'roll_d6') {
      // Transformation elixir
      const roll = new Roll('1d6');
      await roll.evaluate();
      const r = roll.total;
      const outcomes = {
        1: '+1 to attack range; hits deal 3 Bleeding Wounds.',
        2: 'All attacks deal 2d6+1 damage and inflict Confused.',
        3: '+7 Maximum Movement; lose all movement Expertises.',
        4: '+2 to Dodge/Evasion rolls; auto-fail all Magykal Resistance.',
        5: 'Regain 8 HP.',
        6: 'Regain 1 Mana at the start of each Player Phase.'
      };
      if (r === 5) {
        const maxHp = actor.system.health.max?.value ?? actor.system.health.max;
        const current = actor.system.health.value;
        await actor.update({ 'system.health.value': Math.min(current + 8, maxHp) });
      }
      effectMsg = `Rolled a ${r}: ${outcomes[r]}`;

    } else {
      // none / remove_condition / apply_condition — post description to chat; GM applies manually
    }

    // ── Apply Elixir Sickness ───────────────────────────────────────────────
    if (sys.sickness > 0) {
      const currentSickness = actor.system.elixir_sickness?.value ?? 0;
      await actor.update({ 'system.elixir_sickness.value': currentSickness + sys.sickness });
    }

    // ── Post chat card ──────────────────────────────────────────────────────
    const sicknessLine = sys.sickness > 0
      ? `<p style="color:#a04040;font-size:11px;margin-top:6px;">⚠ Elixir Sickness +${sys.sickness} applied.</p>`
      : '';
    const durationLine = sys.duration
      ? `<p style="font-size:11px;color:#555;"><strong>Duration:</strong> ${sys.duration}</p>`
      : '';

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div style="border:1px solid #8b6a3a;border-radius:6px;padding:10px;background:#fdf8ee;">
          <p style="font-weight:bold;font-size:14px;margin:0 0 6px;">${actor.name} uses ${name}</p>
          <p style="margin:0;font-size:13px;">${effectMsg}</p>
          ${durationLine}
          ${sicknessLine}
        </div>
      `
    });

    // ── Close any open inventory popup ──────────────────────────────────────
    Object.values(ui.windows).forEach(w => {
      if (w.options?.classes?.includes('inv-item-dialog')) w.close();
    });

    // ── Remove item if elixir type or flagged as consumable ─────────────────
    if (item.type === 'elixir' || item.system.is_consumable) {
      await item.delete();
    }
  }

  /**
   * Opens a grid of item icons the player can pick from to assign to an item.
   * After selection the item's img is updated and the parent popup refreshes.
   * @param {Item}   item         The embedded item to update
   * @param {Dialog} parentDialog The popup to close/reopen after selection
   */
  _showIconPicker(item, parentDialog) {
    const TOTAL_ICONS = 96;
    const BASE_PATH = 'systems/stryder/assets/items';

    // Build icon grid HTML
    let iconsHtml = '';
    for (let i = 1; i <= TOTAL_ICONS; i++) {
      const num = String(i).padStart(3, '0');
      const path = `${BASE_PATH}/item_${num}.png`;
      iconsHtml += `
        <div class="icon-pick-cell" data-path="${path}" title="item_${num}">
          <img src="${path}" alt="item ${num}">
        </div>
      `;
    }

    const content = `
      <div class="icon-picker-wrap">
        <div class="icon-picker-search-row">
          <input class="icon-picker-search" type="text" placeholder="Filter by number…" />
          <span class="icon-picker-count">${TOTAL_ICONS} icons</span>
        </div>
        <div class="icon-picker-grid">
          ${iconsHtml}
        </div>
      </div>
    `;

    const picker = new Dialog({
      title: 'Choose Icon',
      content,
      buttons: {},
      render: (html) => {
        // Filter icons by number as player types
        html.find('.icon-picker-search').on('input', (e) => {
          const val = e.target.value.trim().toLowerCase();
          html.find('.icon-pick-cell').each(function() {
            const title = $(this).attr('title').toLowerCase();
            $(this).toggle(!val || title.includes(val));
          });
        });

        // Click an icon to assign it
        html.find('.icon-pick-cell').on('click', async (e) => {
          const path = e.currentTarget.dataset.path;
          await item.update({ img: path });
          picker.close();
          // Close and reopen the parent popup to reflect new icon
          if (parentDialog) parentDialog.close();
          this._onInventoryItemClick({ currentTarget: { dataset: { itemId: item._id } } });
        });
      }
    }, {
      classes: ['icon-picker-dialog'],
      width: 420,
      height: 500,
      resizable: false
    });

    picker.render(true);
  }
}

// ── Section collapse via MutationObserver ──────────────────────────────────────
// Watches the live document for .stryder-section-header insertions, bypassing
// all hook and activateListeners timing issues. localStorage preserves state
// across re-renders without touching actor data.
function _initCollapseHeader(header) {
  if (header.dataset.sectionCollapseInit) return;
  header.dataset.sectionCollapseInit = '1';

  const title = header.querySelector('.stryder-section-title')?.textContent?.trim() || 'section';
  const lsKey = `stryder-collapse|${title}`;
  const details = header.closest('details.stryder-section');
  if (!details) return;

  // Restore collapsed state from localStorage
  if (localStorage.getItem(lsKey) === '1') details.open = false;

  // Persist state whenever the browser toggles the <details>
  details.addEventListener('toggle', () => {
    localStorage.setItem(lsKey, details.open ? '0' : '1');
  });
}

Hooks.once('ready', () => {
  const obs = new MutationObserver(mutations => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList?.contains('stryder-section-header')) _initCollapseHeader(node);
        node.querySelectorAll?.('.stryder-section-header').forEach(_initCollapseHeader);
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
});

// Grant starting class XP bonus when a class is first selected on a Level 1 character.
// Warriors get +2 XP from Augmented Combatant at Level 1.
const CLASS_STARTING_XP = { Warrior: 2 };
Hooks.on('updateActor', async (actor, changes) => {
  const newClass = changes?.system?.class?.name;
  if (!newClass || !CLASS_STARTING_XP[newClass]) return;
  if (actor.type !== 'character') return;
  if ((actor.system.attributes?.level?.value ?? 1) !== 1) return;
  const flagKey = `startingXpGranted_${newClass}`;
  if (actor.getFlag('stryder', flagKey)) return; // already granted
  const bonus = CLASS_STARTING_XP[newClass];
  const current = actor.system.attributes?.xp?.value ?? 0;
  await actor.update({ 'system.attributes.xp.value': current + bonus });
  await actor.setFlag('stryder', flagKey, true);
  ui.notifications.info(`${actor.name} received ${bonus} bonus XP from ${newClass} class feature (${newClass === 'Warrior' ? 'Augmented Combatant' : 'class bonus'}).`);
});

// When an Aspect item is removed, clear the `activeAspect` combat flag if the
// actor no longer owns ANY item belonging to that aspect. Without this, deleting
// a Core Aspect (or all of an aspect's abilities) left activeAspect pointing at a
// now-absent aspect with no UI path to clear it — forcing a JSON edit or a brand
// new sheet, and leaving aspect-keyed behaviour (e.g. Brutality) firing.
Hooks.on('deleteItem', async (item, options, userId) => {
  if (game.user.id !== userId) return;                 // only the deleting client acts
  const actor = item.parent;
  if (!actor || actor.type !== 'character') return;
  if (!item.flags?.stryder?.aspectName) return;        // only react to aspect items
  const activeAspect = actor.getFlag('stryder', 'activeAspect');
  if (!activeAspect) return;
  // deleteItem fires after removal, so actor.items already excludes the deleted item
  const stillOwned = actor.items.some(i => i.flags?.stryder?.aspectName === activeAspect);
  if (!stillOwned) {
    await actor.unsetFlag('stryder', 'activeAspect');
    ui.notifications?.info(`${actor.name}: Active Aspect cleared — no ${activeAspect.replace('Aspect of ', '')} abilities remain.`);
  }
});

/**
 * Opens (or re-focuses) the Pokemon-style battle window for the given actor.
 * Creates a fixed-position div anchored to the bottom of the viewport.
 * Destroys and recreates any existing window so item lists stay fresh.
 */
function _openPokemonBattleWindow(actorRef) {
  // Re-derive synthetic actors from their token to pick up latest actorDelta changes
  const actor = actorRef.token?.actor ?? actorRef;
  const existing = document.getElementById('stryder-pokemon-battle');
  if (existing) existing.remove();

  // Known aspect ability names (matches item.mjs routing — name-based, no flag dependency)
  const ASPECT_ABILITY_NAMES = new Set([
    // Spirit
    'Hallowed-Arsenal','Revitalize','Enhance Prowess','Rapid Repair',
    'Life for a Life','Undeath','Ruin Mana','Healing Wave','Starwalker',
    // Resilience
    'Armored Soul','Deep Guard','Attached Bonus','Ancient Armor',
    'Irresistible Rage','Full Brace','Revenge Shield','Sacrifice','Unbreakable','Atlas Resilience',
    // Discipline
    'Full-Body Assault','Flow',
    'Light Breakdown','Grab Breakdown','Heavy Breakdown',
    'Light Combo','Grab Combo','Heavy Combo',
    'Light Counter: Intercepting Strike','Heavy Counter: Crushing Blow','Grab Counter: Redirecting Grab',
    'Light Finishers','Heavy Finishers','Grab Finishers',
  ]);

  const isAspectAction = (i) =>
    i.type === 'action' && (i.system?.isAspectAbility || ASPECT_ABILITY_NAMES.has(i.name));

  // Favorites filter — only show starred items in Skills / Actions panels
  const favoriteIds   = new Set(actor.getFlag('stryder', 'favorites') || []);
  const isFav         = (i) => favoriteIds.has(i.id);

  const skills        = actor.items.filter(i => isFav(i) && (
    i.type === 'skill'
    || isAspectAction(i)
    || i.type === 'technique' || i.flags?.stryder?.isTechnique
    || i.type === 'racial'
    || i.type === 'feature'   || i.flags?.stryder?.isClassFeature
  ));
  const playerActions = actor.items.filter(i => isFav(i) && i.type === 'action' && !isAspectAction(i));
  const elixirs      = actor.items.filter(i => i.type === 'elixir');
  const consumes     = actor.items.filter(i => i.type === 'consumable');
  const items        = [...elixirs, ...consumes];

  const defRows = [
    { label: 'Dodge',     cls: 'dodge',   formula: '1d6 + Reflex', roll: `1d6+${actor.system.abilities?.Reflex?.value ?? 0}`, label2: 'Dodge Roll' },
    { label: 'Evade',     cls: 'evade',   formula: '2d6 + Reflex', roll: `2d6+${actor.system.abilities?.Reflex?.value ?? 0}`, label2: 'Evade Roll' },
    { label: 'M. Resist', cls: 'mresist', formula: '2d6 + Will',   roll: `2d6+${actor.system.abilities?.Will?.value ?? 0}`,   label2: 'Magykal Resistance' },
    { label: 'P. Resist', cls: 'presist', formula: '2d6 + Grit',   roll: `2d6+${actor.system.abilities?.Grit?.value ?? 0}`,   label2: 'Physical Resistance' },
  ];

  // Check if Dual Wield is unlocked and currently the active battle form
  const hasDualWield = actor.system.soul_armament?.form?.dual_wield === true;
  const activeBattleFormDW = actor.getFlag('stryder', 'activeBattleForm');
  const dualWieldActive = hasDualWield && activeBattleFormDW === 'dual_wield';

  // Determine Block reduction value: highest ability score (Soul, Arcana, Grit, Reflex, Will, Intuition)
  const blockReductionStat = Math.max(
    actor.system.abilities?.Soul?.value ?? 0,
    actor.system.abilities?.Arcana?.value ?? 0,
    actor.system.abilities?.Grit?.value ?? 0,
    actor.system.abilities?.Reflex?.value ?? 0,
    actor.system.abilities?.Will?.value ?? 0,
    actor.system.abilities?.Intuition?.value ?? 0
  );

  const _renderItems = (list, showTag = false) => {
    if (!list.length) return `<div class="spb-empty">None</div>`;
    return list.map(item => {
      const limitMax = item.system.limit?.max ?? 0;
      const limitVal = item.system.limit?.value ?? 0;
      const tag   = showTag && item.system.action_type ? `<span class="spb-item-tag">${item.system.action_type}</span>` : '';
      const limit = limitMax > 0 ? `<span class="spb-item-limit">${limitVal}/${limitMax}</span>` : '';
      return `
        <div class="spb-item" data-item-id="${item.id}">
          <img src="${item.img}" alt="${item.name}" />
          <span class="spb-item-name">${item.name}</span>
          ${tag}${limit}
        </div>`;
    }).join('');
  };

  const _renderDefense = () => `
    <div class="spb-def-grid ${dualWieldActive ? 'has-block' : ''}">
      ${defRows.map(d => `
      <button class="spb-def-row spb-def-${d.cls}" data-roll="${d.roll}" data-label="${d.label2}">
        <span class="spb-def-label">${d.label}</span>
        <span class="spb-def-formula">${d.formula}</span>
      </button>`).join('')}
      ${dualWieldActive ? `
      <button class="spb-def-row spb-block-btn" data-block-reduction="${blockReductionStat}" style="grid-column: 1 / -1;">
        <span class="spb-def-label">Block</span>
        <span class="spb-def-formula">-${blockReductionStat}</span>
      </button>` : ''}
    </div>`;

  // Build window element
  const initiative = game.combat?.combatants.find(
    c => c.actorId === actor.id
  )?.initiative ?? '—';

  const win = document.createElement('div');
  win.id = 'stryder-pokemon-battle';
  win.innerHTML = `
    <div class="spb-header">
      <span class="spb-actor-name">${actor.name}</span>
      <span class="spb-initiative-badge">Init ${initiative}</span>
      <div class="spb-header-controls">
        <button class="spb-minimize-btn" title="Minimise">−</button>
        <button class="spb-close-btn" title="Close">✕</button>
      </div>
    </div>
    <div class="spb-body">
      <div class="spb-main-grid">
        <button class="spb-big-btn skills" data-panel="skills">⚔ Skills</button>
        <button class="spb-big-btn defend" data-panel="defend">🛡 Defend</button>
        <button class="spb-big-btn items"  data-panel="items">🧪 Items</button>
        <button class="spb-big-btn actions" data-panel="actions">✦ Actions</button>
      </div>
      <div class="spb-panel skills">
        <div class="spb-panel-header">
          <button class="spb-back-btn">◀ Back</button>
          <span class="spb-panel-title">Skills</span>
        </div>
        <div class="spb-panel-list">${_renderItems(skills, true)}</div>
      </div>
      <div class="spb-panel defend">
        <div class="spb-panel-header">
          <button class="spb-back-btn">◀ Back</button>
          <span class="spb-panel-title">Defend</span>
        </div>
        ${_renderDefense()}
      </div>
      <div class="spb-panel items">
        <div class="spb-panel-header">
          <button class="spb-back-btn">◀ Back</button>
          <span class="spb-panel-title">Items</span>
        </div>
        <div class="spb-panel-list">${_renderItems(items)}</div>
      </div>
      <div class="spb-panel actions">
        <div class="spb-panel-header">
          <button class="spb-back-btn">◀ Back</button>
          <span class="spb-panel-title">Actions</span>
        </div>
        <div class="spb-panel-list">${_renderItems(playerActions, true)}</div>
      </div>
    </div>
  `;
  document.body.appendChild(win);

  // Big buttons → show sub-panel
  win.querySelectorAll('.spb-big-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      win.querySelector('.spb-main-grid').style.display = 'none';
      win.querySelectorAll('.spb-panel').forEach(p => p.classList.remove('active'));
      win.querySelector(`.spb-panel.${btn.dataset.panel}`).classList.add('active');
    });
  });

  // Back → return to main grid
  win.querySelectorAll('.spb-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      win.querySelectorAll('.spb-panel').forEach(p => p.classList.remove('active'));
      win.querySelector('.spb-main-grid').style.display = '';
    });
  });

  // Minimize / close
  win.querySelector('.spb-minimize-btn').addEventListener('click', () => win.classList.toggle('minimized'));
  win.querySelector('.spb-close-btn').addEventListener('click', () => win.remove());

  // Item / skill / action rolls
  win.querySelectorAll('.spb-item[data-item-id]').forEach(el => {
    el.addEventListener('click', () => {
      const item = actor.items.get(el.dataset.itemId);
      if (item) item.roll();
    });
  });

  // Defense rolls
  win.querySelectorAll('.spb-def-row[data-roll]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const roll = new Roll(btn.dataset.roll, actor.getRollData());
      await roll.evaluate();
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `<strong>${actor.name}</strong> — ${btn.dataset.label}`,
      });
    });
  });

  // Block (dual wield)
  win.querySelectorAll('.spb-def-row[data-block-reduction]').forEach(btn => {
    btn.addEventListener('click', () => {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<strong>${actor.name}</strong> blocks — damage reduced by <strong>${btn.dataset.blockReduction}</strong>.`,
      });
    });
  });
}
