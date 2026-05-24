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
  6:6,  7:7,  8:7,  9:8,  10:8,
  11:9, 12:9, 13:10, 14:11, 15:12
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
    originFolkPicker: true
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
    });
  }

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

    // Pre-compute resource bar percentages for the main-menu player card.
    // Baking these into the template at render time is more reliable than
    // setting them via querySelector in activateListeners (which can silently
    // fail if the element isn't found or maxVal resolves to 0).
    const _pct = (val, max) => max > 0 ? Math.min(100, (val / max) * 100) : 0;
    context.hpPct  = _pct(actorData.system.health.value,  actorData.system.health.max);
    context.mpPct  = _pct(actorData.system.mana.value,    actorData.system.mana.max);
    context.staPct = _pct(actorData.system.stamina.value, actorData.system.stamina.max);

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
      const usedSlots       = (context.items || []).reduce((sum, i) => {
        const s = i.system?.size ?? i.system?.inventory_size ?? 1;
        return sum + Math.max(1, Math.min(s, 11));
      }, 0);
      context.inventoryUsed = Math.min(44, usedSlots);
      context.inventoryMax  = 44;
      context.inventoryFull = usedSlots >= 44;
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
    // All item types go into the grid
    const gearItems = items;

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

    const maxHealth  = baseHp + (hpPerLevel * (clamped - 1)) + gritHpBonus;
    const maxStamina = STRYDER_STAMINA_BY_LEVEL[clamped] ?? 3;
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

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to actions.
      if (i.type === 'action') {
        actions.push(i);
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
          height: 60px;
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
        /* Force the engage button to fill its grid cell height */
        .jrpg-battle-engage-row > .jrpg-battle-engage-btn {
          height: 100% !important;
          margin-top: 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
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

    // JRPG Main Menu navigation — persist page across re-renders
    const _showPage = (target, label) => {
      this._jrpgPage = target;
      this._jrpgPageLabel = label;
      html.find('.jrpg-main-screen').hide();
      const subScreen = html.find('.jrpg-sub-screen');
      subScreen.show();
      subScreen.toggleClass('is-tempering', target === 'tempering' || target === 'soul-armament' || target === 'growth');
      html.find('.jrpg-sub-title').text(label);
      html.find('.jrpg-page').hide();
      html.find(`.jrpg-page[data-page="${target}"]`).show();
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

    // ── Aspect Select (placeholder) ──
    html.on('click', '[data-action="openAspectSelect"]', () => {
      ui.notifications.info('Aspect switching coming soon!');
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

    // Restore sub-page if a re-render happened while one was open
    if (this._jrpgPage) {
      _showPage(this._jrpgPage, this._jrpgPageLabel || '');
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

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });

    // Spirit Beast ability use — post to chat
    html.on('click', '.spirit-beast-ability-use', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const ability = ev.currentTarget.dataset.ability;
      if (!ability) return;
      const actor = this.actor;
      const content = ability === 'primary' ? actor.system.abilities.primary : actor.system.abilities.defense;
      const title = ability === 'primary' ? 'Primary Ability' : 'Defense Ability';
      if (!content) return;
      const gateColors = { crimson: '#8B0000', violet: '#6A0DAD', azure: '#00539C', sage: '#2E7D32' };
      const borderColor = gateColors[actor.system.gate] ?? '#c9a66b';
      await ChatMessage.create({
        content: `<div style="background: url('systems/stryder/assets/parchment.jpg'); background-size: cover; padding: 15px; border: 2px solid ${borderColor}; border-radius: 4px;">
          <h3 style="margin-top: 0; border-bottom: 1px solid ${borderColor}; color: ${borderColor};">${actor.name} — ${title}</h3>
          ${content}
        </div>`,
        speaker: ChatMessage.getSpeaker({ actor: actor })
      });
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

    // Visual drag-over feedback on the inventory grid
    html.find('.jrpg-inv-grid').on('dragover', (e) => {
      e.preventDefault();
      html.find('.jrpg-inv-grid').addClass('drag-over');
    }).on('dragleave drop', () => {
      html.find('.jrpg-inv-grid').removeClass('drag-over');
    });

    // Inventory grid — empty slot click opens item creator dialog
    html.on('click', '[data-action="addItemFromSlot"]', async () => {
      const content = `
        <div style="display:flex;flex-direction:column;gap:10px;padding:4px 0;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:12px;color:rgba(160,185,220,0.7);">Item Name</label>
            <input id="new-item-name" type="text" placeholder="e.g. Iron Sword"
              style="background:rgba(8,14,35,0.9);border:1px solid rgba(60,90,160,0.4);border-radius:4px;color:rgba(200,220,255,0.9);padding:4px 8px;font-size:13px;" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:12px;color:rgba(160,185,220,0.7);">Slot Size (1–11)</label>
            <input id="new-item-size" type="number" min="1" max="11" value="1"
              style="background:rgba(8,14,35,0.9);border:1px solid rgba(60,90,160,0.4);border-radius:4px;color:rgba(200,220,255,0.9);padding:4px 8px;font-size:13px;width:80px;" />
          </div>
        </div>
      `;
      new Dialog({
        title: 'Add Item to Inventory',
        content,
        buttons: {
          add: {
            label: 'Add to Inventory',
            callback: async (html) => {
              const name = html.find('#new-item-name').val().trim() || 'New Item';
              const size = Math.max(1, Math.min(11, parseInt(html.find('#new-item-size').val()) || 1));
              await Item.create(
                { name, type: 'gear', system: { size } },
                { parent: this.actor }
              );
            }
          },
          cancel: { label: 'Cancel' }
        },
        default: 'add',
        render: (html) => html.find('#new-item-name').focus()
      }, {
        classes: ['inv-item-dialog'],
        width: 300
      }).render(true);
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
	html.on('click', '.resource-button, .fantasy-action-button', async (event) => {
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
			  break;

			case 'tacticsReset':
			  message = `${this.actor.name} has regained all their Tactics Points at the start of a new Engagement.`;
			  updates['system.tactics.value'] = this.actor.system.tactics.max;
			  break;

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
			  message = combatLimitItems.length > 0
				? `${this.actor.name}'s combat has ended. All ability limits have been reset. (${combatLimitItems.length} reset)`
				: `${this.actor.name}'s combat has ended.`;
			  break;
			}

			case 'battleEngage': {
			  const actor = this.actor;
			  const sys   = actor.system;

			  // Compute highest Sense value
			  const senses = sys.attributes?.sense ?? {};
			  const senseValues = Object.values(senses).map(s => (typeof s === 'object' ? (s.value ?? 0) : 0));
			  const highestSense = senseValues.length ? Math.max(...senseValues) : 0;

			  // Roll 2d6 + highest Sense (Perception Roll)
			  const initRoll = new Roll(`2d6 + ${highestSense}`);
			  await initRoll.evaluate();

			  // If in an active combat, set initiative on the combatant
			  const combat = game.combat;
			  if (combat) {
			    const combatant = combat.getCombatantByActor(actor.id);
			    if (combatant) {
			      await combatant.update({ initiative: initRoll.total });
			    } else {
			      const created = await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id, tokenId: actor.token?.id ?? null }]);
			      if (created.length) await combat.setInitiative(created[0].id, initRoll.total);
			    }
			  }

			  // Post roll to chat
			  await initRoll.toMessage({
			    speaker: ChatMessage.getSpeaker({ actor }),
			    flavor: `<strong>${actor.name}</strong> enters combat! Initiative roll (2d6 + ${highestSense} Sense)`,
			  });

			  // Open the Pokemon-style battle window
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
			  break;

			case 'springOfLife':
			  const burningReduction = this.actor.getFlag(SYSTEM_ID, "burningHealthReduction") || 0;
			  const bloodlossReduction = this.actor.getFlag(SYSTEM_ID, "bloodlossHealthReduction") || 0;
			  const totalReduction = burningReduction + bloodlossReduction;
			  const newMax = this.actor.system.health.max + totalReduction;

			  updates = {
				'system.health.value': newMax,
				'system.mana.value': this.actor.system.mana.max,
				[`flags.${SYSTEM_ID}.springOfLifeActive`]: true,
				[`flags.${SYSTEM_ID}.burningHealthReduction`]: null,
				[`flags.${SYSTEM_ID}.bloodlossHealthReduction`]: null
			  };

			  message = `${this.actor.name} has used Spring of Life, regaining all Health and Mana. Stamina cannot be restored until the next Rest.`;

			  if (totalReduction > 0) {
				let restorationMessage = `<br><br>In addition, the Spring of Life has healed wounds that ${this.actor.name} sustained, restoring their Max Health by ${totalReduction}.`;
				if (burningReduction > 0 && bloodlossReduction > 0) {
				  restorationMessage = `<br><br>In addition, the Spring of Life has healed burns and bloodloss that ${this.actor.name} sustained, restoring their Max Health by ${totalReduction} (${burningReduction} from burns, ${bloodlossReduction} from bloodloss).`;
				} else if (burningReduction > 0) {
				  restorationMessage = `<br><br>In addition, the Spring of Life has healed burns that ${this.actor.name} sustained, restoring their Max Health by ${burningReduction}.`;
				} else if (bloodlossReduction > 0) {
				  restorationMessage = `<br><br>In addition, the Spring of Life has healed bloodloss that ${this.actor.name} sustained, restoring their Max Health by ${bloodlossReduction}.`;
				}
				message += restorationMessage;
			  }
			  
			  // Reset uses for skills and folk abilities with perSpring cooldown
			  const springItemsToReset = this.actor.items.filter(item => 
				(item.type === 'skill' || item.type === 'racial') && 
				item.system.cooldown_unit === 'perSpring' && 
				item.system.cooldown_value > 0
			  );
			  
			  for (const item of springItemsToReset) {
				await item.update({'system.uses_current': item.system.cooldown_value});
			  }
			  break;

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

			// Build a lightweight stand-in to feed _calcMaxStats at the new level
			const fakeActorData = {
			  system: {
			    ...sys,
			    attributes: { ...sys.attributes, level: { value: newLevel } }
			  }
			};
			const computed = this._calcMaxStats(fakeActorData);

			// XP is a spendable currency for buying Techniques in the Growth menu.
			// Placeholder: 2 XP per level; tune once Growth menu is built.
			const xpGain = 2;
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
			ui.notifications.info(
			  `${this.actor.name} advanced to Level ${newLevel}! Gained ${xpGain} XP to spend on Techniques.`
			);
			break;
		  }
		  }

		  await this.actor.update(updates);

		  if (message) {
			ChatMessage.create({
			  content: `
				<div style="background: url('systems/stryder/assets/parchment.jpg'); 
							background-size: cover; 
							padding: 15px; 
							border: 1px solid #c9a66b; 
							border-radius: 3px;">
				  <h3 style="margin-top: 0; border-bottom: 1px solid #c9a66b;"><strong>${button.textContent.trim()}</strong></h3>
				  <p style="margin-bottom: 0;">${message}</p>
				</div>
			  `,
			  speaker: ChatMessage.getSpeaker({actor: this.actor})
			});
		  }

		} catch (err) {
		  console.error("Error in resource-button handler:", err);
		  ui.notifications.error("Failed to update resources!");
		}
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
	    'system.folk.sense_one_choice':    ''
	  });

	  // --- Clearing folk entirely ---
	  if (!folkName) {
	    if (hasBonuses || oldFolk) {
	      const ok = await Dialog.confirm({
	        title:   'Remove Folk',
	        content: `<p style="margin:0;padding:8px 0;">Removing your folk will <strong>permanently delete all folk talent and sense bonuses</strong> from this character. Are you sure?</p>`
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
	      content: `<p style="margin:0;padding:8px 0;">Changing from <strong>${oldFolk}</strong> to <strong>${folkName}</strong> will <strong>remove all current folk bonuses</strong> (talents, senses, passives). You will reconfigure your new folk in the next popup.</p><p style="margin:4px 0 0;padding:0;color:#e05050;">This cannot be undone.</p>`
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
	    senseChoices:  existing.sense_free_choices   || []
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

	  const level = this.actor.system.attributes.level.value ?? 1;
	  const clamped = Math.min(15, Math.max(1, level));
	  const newMaxHealth = classData.base_hp + (classData.hp_per_level * clamped);

	  await this.actor.update({
	    'system.class.name':         className,
	    'system.class.base_hp':      classData.base_hp,
	    'system.class.hp_per_level': classData.hp_per_level,
	    'system.health.max':         newMaxHealth,
	    'system.health.value':       newMaxHealth,
	  });

	  ui.notifications.info(`Class set to ${className}. Max Health updated to ${newMaxHealth}.`);
	});

	// Re-sync whenever Grit changes so the Grit HP bonus is recalculated immediately.
	// setTimeout(100) lets Foundry write the new value before we read it back.
	html.find('input[name="system.abilities.Grit.value"]').on('change', () => {
	  setTimeout(() => this._syncComputedStats(), 100);
	});

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

    // Create the duplicate item data
    const duplicateData = {
      name: duplicateName,
      type: item.type,
      img: item.img,
      system: foundry.utils.deepClone(item.system)
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
      content: `
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 16px; margin-bottom: 20px;">
            ${game.i18n.format("STRYDER.DOCUMENT.DeleteConfirmMessage", { name: item.name })}
          </p>
        </div>
      `,
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
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[ability] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
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
      if (bonus) changes.push({
        key:   `system.attributes.talent.${talent}.value`,
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

    // Remove ALL previous folk effects (guard against duplicates), then create new one
    const existingEffects = [...this.actor.effects].filter(e => e.flags?.stryder?.isFolkBonus);
    for (const e of existingEffects) await e.delete();

    if (changes.length > 0) {
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

    let content = `<div class="folk-popup-card" style="padding:14px;font-family:'Rajdhani',sans-serif;background:#0f0c1e;color:#ddd;border-radius:2px;">`;
    content += `<div class="folk-popup-title" style="font-size:15px;font-weight:bold;margin-bottom:10px;color:#c8a03c;">${folkName}</div>`;

    // --- Fixed-bonus folk: read-only summary ---
    if (isFixed) {
      const talentLines = Object.entries(folkData.talents).map(([k,v]) => `${k} +${v}`).join(', ');
      const senseLines  = Object.entries(folkData.senses ).map(([k,v]) => `${k} +${v}`).join(', ');
      content += `<p style="margin:4px 0;color:#ddd;">Talents: <span style="color:#e0c87a;">${talentLines || '—'}</span></p>`;
      content += `<p style="margin:4px 0;color:#ddd;">Senses: <span style="color:#e0c87a;">${senseLines || '—'}</span></p>`;
      if (folkData.passives.length) {
        folkData.passives.forEach(p => {
          content += `<p style="margin:6px 0;font-size:11px;color:#c0955a;">⚑ ${p}</p>`;
        });
      }
    }

    // --- Oumen: origin folk picker ---
    if (folkData.originFolkPicker) {
      const others = Object.keys(STRYDER_FOLK_DATA).filter(f => f !== 'Oumen');
      const curOrigin = existingChoices.originFolk || '';
      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Origin Folk (appearance only)</label>`;
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

    // --- Size picker ---
    if (folkData.sizeChoices) {
      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Size</label>`;
      folkData.sizeChoices.forEach(sz => {
        const chk = (existingChoices.size === sz) ? 'checked' : '';
        content += `<label style="display:block;color:#e0c87a;margin:2px 0;"><input type="radio" name="fp-size" value="${sz}" ${chk}> ${sz}</label>`;
      });
      content += `</div>`;
    }

    // --- Colossus subfolk + stat choice ---
    if (folkData.subfolks && folkName === 'Colossus') {
      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Subfolk</label>`;
      folkData.subfolks.forEach(sf => {
        const sub = STRYDER_COLOSSUS_SUBFOLK[sf];
        const chk = (existingChoices.subfolk === sf) ? 'checked' : '';
        const note = sub ? ` — Immune to ${sub.immunities.join(', ')}; +${Object.entries(sub.talents).map(([k,v])=>`${v} ${k}`).join(', ')}` : '';
        content += `<label style="display:block;color:#e0c87a;margin:2px 0;font-size:11px;"><input type="radio" name="fp-subfolk" value="${sf}" ${chk}> ${sf}${note}</label>`;
      });
      content += `</div>`;
      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Assign +3 to Stat (+1 to the other)</label>`;
      ['Strength','Endurance'].forEach(st => {
        const chk = (existingChoices.colossusStat === st) ? 'checked' : '';
        content += `<label style="display:block;color:#e0c87a;margin:2px 0;"><input type="radio" name="fp-stat" value="${st}" ${chk}> ${st}</label>`;
      });
      content += `</div>`;
    }

    // --- Traveler subfolk + talent distribution + sense picks ---
    if (folkName === 'Traveler') {
      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Boon (Subfolk)</label>`;
      folkData.subfolks.forEach(sf => {
        const chk = (existingChoices.travelerBoon === sf || existingChoices.subfolk === sf) ? 'checked' : '';
        content += `<label style="display:block;color:#e0c87a;margin:2px 0;"><input type="radio" name="fp-boon" value="${sf}" ${chk}> ${sf}</label>`;
      });
      content += `</div>`;

      const allTalents = ['Aggression','Charm','Deceit','Diplomacy','Endurance','Finesse','Intimacy','Nimbleness','Strength','Survival','Wisdom','Wit'];
      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Distribute 4 Talent Points <span id="fp-talent-remaining" style="color:#c8a03c;">(4 remaining)</span></label>`;
      content += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">`;
      allTalents.forEach(t => {
        const cur = existingChoices.talentPoints?.[t] ?? 0;
        content += `<div style="display:flex;align-items:center;gap:4px;"><span style="color:#bbb;font-size:11px;flex:1;">${t}</span><input type="number" class="fp-talent-input" data-talent="${t}" value="${cur}" min="0" max="4" style="width:40px;background:#1a1630;color:#e0c87a;border:1px solid #5a4a20;text-align:center;"></div>`;
      });
      content += `</div></div>`;

      const senses = ['Arcane','Hearing','Sight','Smell','Touch'];
      ['1','2'].forEach(n => {
        const cur = existingChoices.senseChoices?.[Number(n)-1] ?? '';
        content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Sense Pick ${n}</label>`;
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
      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Distribute 4 Talent Points (max 5 per talent) <span id="fp-talent-remaining" style="color:#c8a03c;">(4 remaining)</span></label>`;
      content += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">`;
      fp.talentTargets.forEach(t => {
        const cur = existingChoices.talentPoints?.[t] ?? 0;
        content += `<div style="display:flex;align-items:center;gap:4px;"><span style="color:#bbb;font-size:11px;flex:1;">${t}</span><input type="number" class="fp-talent-input" data-talent="${t}" value="${cur}" min="0" max="5" style="width:40px;background:#1a1630;color:#e0c87a;border:1px solid #5a4a20;text-align:center;"></div>`;
      });
      content += `</div></div>`;

      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Sense Bonus (+2 to one)</label>`;
      fp.senseChoice.forEach(s => {
        const cur = existingChoices.senseChoices?.[0] ?? existingChoices.senseOneChoice ?? '';
        content += `<label style="display:block;color:#e0c87a;margin:2px 0;"><input type="radio" name="fp-sense-one" value="${s}" ${cur===s?'checked':''}> ${s} +2</label>`;
      });
      content += `</div>`;

      const chosen = existingChoices.adaptations || [];
      content += `<div class="folk-popup-section"><label style="color:#ddd;display:block;margin-bottom:4px;">Choose 3 Adaptations <span id="fp-adapt-count" style="color:#c8a03c;">(${chosen.length}/3 chosen)</span></label>`;
      content += `<div class="folk-adapt-list" style="max-height:220px;overflow-y:auto;border:1px solid #3a2e10;padding:6px;background:#0f0c1e;">`;
      folkData.adaptations.forEach(a => {
        const chk = chosen.includes(a.name) ? 'checked' : '';
        const dis = (!chk && chosen.length >= 3) ? 'disabled' : '';
        content += `<label class="folk-adapt-item" style="display:flex;gap:8px;align-items:flex-start;margin:4px 0;cursor:pointer;"><input type="checkbox" class="fp-adapt-cb" value="${a.name}" ${chk} ${dis} style="margin-top:2px;flex-shrink:0;"><span><strong style="color:#e0c87a;">${a.name}</strong><br><span style="font-size:10px;color:#aaa;">${a.description}</span></span></label>`;
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
        mode: CONST.ACTIVE_EFFECT_MODES.UPGRADE, // 4 — only applies if higher
        value: String(talentUpdates[talent] ?? Number(src[talent]?.value ?? 0)),
        priority: 100
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
      // Update only the changed keys; leave the rest as-is.
      const changes = existing.changes.map(change => {
        const m = change.key.match(/^system\.attributes\.talent\.(\w+)\.value$/);
        if (m && talentUpdates[m[1]] !== undefined) {
          return { ...change, value: String(talentUpdates[m[1]]) };
        }
        return change;
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
      <div class="inv-popup" style="
        background: linear-gradient(160deg, #0a1628 0%, #0d1f3c 60%, #081020 100%);
        border: 1px solid rgba(80,160,255,0.25);
        border-radius: 10px;
        padding: 18px 18px 10px;
        color: #a8d4ff;
        font-family: inherit;
        min-width: 220px;
      ">
        <!-- Icon -->
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
          <div class="inv-popup-img-wrap" style="
            width:64px;height:64px;flex-shrink:0;
            background:rgba(80,160,255,0.08);
            border:1px solid rgba(80,160,255,0.2);
            border-radius:8px;
            display:flex;align-items:center;justify-content:center;
            cursor:pointer;
          " data-action="changeIcon">
            ${itemImg
              ? `<img src="${itemImg}" alt="${itemName}" style="width:52px;height:52px;object-fit:contain;image-rendering:pixelated;">`
              : `<i class="fas fa-box" style="font-size:24px;color:rgba(80,160,255,0.4);"></i>`}
          </div>
          <div>
            <div style="
              font-size:11px;
              color:rgba(140,200,255,0.55);
              letter-spacing:0.08em;
              text-transform:uppercase;
              margin-bottom:3px;
            ">${itemSize} slot${itemSize !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <!-- Description -->
        <div style="
          font-size:12px;
          color:rgba(180,220,255,0.8);
          line-height:1.5;
          margin-bottom:14px;
          padding:10px 12px;
          background:rgba(80,160,255,0.06);
          border-radius:6px;
          border-left:2px solid rgba(80,160,255,0.3);
          text-shadow: 0 0 8px rgba(100,180,255,0.3);
          min-height:36px;
        ">${strippedDescription || '<span style="opacity:0.35;font-style:italic;">No description.</span>'}</div>

        <!-- Action Buttons -->
        <div class="inv-popup-actions" style="display:flex;flex-direction:column;gap:6px;">
          <button type="button" class="inv-action-btn inv-btn-use" data-action="use" style="
            background:rgba(80,160,255,0.12);
            border:1px solid rgba(80,160,255,0.35);
            border-radius:6px;
            color:#a8d4ff;
            font-size:12px;
            font-weight:600;
            letter-spacing:0.06em;
            padding:7px 0;
            cursor:pointer;
            text-shadow:0 0 10px rgba(100,180,255,0.6);
            width:100%;
          ">✦ USE</button>
          <button type="button" class="inv-action-btn inv-btn-inspect" data-action="inspect" style="
            background:rgba(80,160,255,0.07);
            border:1px solid rgba(80,160,255,0.2);
            border-radius:6px;
            color:rgba(168,212,255,0.75);
            font-size:12px;
            font-weight:500;
            letter-spacing:0.06em;
            padding:7px 0;
            cursor:pointer;
            width:100%;
          ">INSPECT</button>
          <button type="button" class="inv-action-btn inv-btn-discard" data-action="discard" style="
            background:rgba(255,80,80,0.06);
            border:1px solid rgba(255,80,80,0.2);
            border-radius:6px;
            color:rgba(255,160,160,0.65);
            font-size:12px;
            font-weight:500;
            letter-spacing:0.06em;
            padding:7px 0;
            cursor:pointer;
            width:100%;
          ">DISCARD</button>
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
            content: `<p style="padding:8px 0;">Remove <strong>${item.name}</strong> from your inventory?</p>`,
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
        <div class="icon-pick-cell" data-path="${path}" title="item_${num}"
             style="aspect-ratio:1/1;min-width:0;background:rgba(10,18,45,0.7);border:1px solid rgba(55,90,160,0.2);border-radius:5px;display:flex;align-items:center;justify-content:center;padding:4px;box-sizing:border-box;cursor:pointer;overflow:hidden;">
          <img src="${path}" alt="item ${num}" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated;">
        </div>
      `;
    }

    const content = `
      <div class="icon-picker-wrap" style="display:flex;flex-direction:column;height:100%;">
        <div class="icon-picker-search-row">
          <input class="icon-picker-search" type="text" placeholder="Filter by number…" />
          <span class="icon-picker-count">${TOTAL_ICONS} icons</span>
        </div>
        <div class="icon-picker-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:10px;overflow-y:auto;max-height:400px;box-sizing:border-box;">
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

/**
 * Opens (or re-focuses) the Pokemon-style battle window for the given actor.
 * Creates a fixed-position div anchored to the bottom of the viewport.
 * Destroys and recreates any existing window so item lists stay fresh.
 */
function _openPokemonBattleWindow(actor) {
  const existing = document.getElementById('stryder-pokemon-battle');
  if (existing) existing.remove();

  const skills       = actor.items.filter(i => i.type === 'skill');
  const playerActions = actor.items.filter(i => i.type === 'action');
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
        <div class="spb-item" data-item-id="${item.id}" data-action="spb-roll-item">
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
        <span class="spb-def-label">🛡 Block</span>
        <span class="spb-def-formula">Trigger · 1 Stamina · [Breach] · Reduces ${blockReductionStat} dmg</span>
      </button>` : ''}
    </div>`;

  const win = document.createElement('div');
  win.id = 'stryder-pokemon-battle';
  win.innerHTML = `
    <div class="spb-header">
      <span class="spb-actor-name">${actor.name}</span>
      <span class="spb-initiative-badge">In Battle</span>
      <div class="spb-header-controls">
        <button class="spb-minimize-btn" id="spb-minimize" title="Minimize">—</button>
        <button class="spb-close-btn"    id="spb-close"    title="Leave Battle">✕</button>
      </div>
    </div>
    <div class="spb-body">
      <div class="spb-main-grid" id="spb-main">
        <button class="spb-big-btn skills"  data-spb-nav="skills">⚔ Skills</button>
        <button class="spb-big-btn defend"  data-spb-nav="defend">🛡 Defend</button>
        <button class="spb-big-btn items"   data-spb-nav="items">⚗ Items</button>
        <button class="spb-big-btn actions" data-spb-nav="actions">✦ Actions</button>
      </div>
      <div class="spb-panel skills" id="spb-panel-skills">
        <div class="spb-panel-header">
          <button class="spb-back-btn" data-spb-back>← Back</button>
          <span class="spb-panel-title">Skills</span>
        </div>
        <div class="spb-panel-list">${_renderItems(skills, true)}</div>
      </div>
      <div class="spb-panel defend" id="spb-panel-defend">
        <div class="spb-panel-header">
          <button class="spb-back-btn" data-spb-back>← Back</button>
          <span class="spb-panel-title">Defense</span>
        </div>
        ${_renderDefense()}
      </div>
      <div class="spb-panel items" id="spb-panel-items">
        <div class="spb-panel-header">
          <button class="spb-back-btn" data-spb-back>← Back</button>
          <span class="spb-panel-title">Items</span>
        </div>
        <div class="spb-panel-list">${_renderItems(items)}</div>
      </div>
      <div class="spb-panel actions" id="spb-panel-actions">
        <div class="spb-panel-header">
          <button class="spb-back-btn" data-spb-back>← Back</button>
          <span class="spb-panel-title">Actions</span>
        </div>
        <div class="spb-panel-list">${_renderItems(playerActions, true)}</div>
      </div>
    </div>
  `;

  document.body.appendChild(win);

  // Navigate to a sub-panel
  win.querySelectorAll('[data-spb-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      win.querySelector('#spb-main').style.display = 'none';
      win.querySelectorAll('.spb-panel').forEach(p => p.classList.remove('active'));
      win.querySelector(`#spb-panel-${btn.dataset.spbNav}`).classList.add('active');
    });
  });

  // Back to main grid
  win.querySelectorAll('[data-spb-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      win.querySelectorAll('.spb-panel').forEach(p => p.classList.remove('active'));
      win.querySelector('#spb-main').style.display = 'grid';
    });
  });

  // Minimize toggle
  let minimized = false;
  win.querySelector('#spb-minimize').addEventListener('click', () => {
    minimized = !minimized;
    win.classList.toggle('minimized', minimized);
    win.querySelector('#spb-minimize').textContent = minimized ? '▲' : '—';
    win.querySelector('#spb-minimize').title = minimized ? 'Expand' : 'Minimize';
  });

  // Close
  win.querySelector('#spb-close').addEventListener('click', () => win.remove());

  // Item left-click → roll; right-click → open sheet
  win.querySelectorAll('[data-action="spb-roll-item"]').forEach(el => {
    el.addEventListener('click', async () => {
      const item = actor.items.get(el.dataset.itemId);
      if (!item) return;
      if (typeof item.roll === 'function') await item.roll();
      else item.sheet.render(true);
    });
    el.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      actor.items.get(el.dataset.itemId)?.sheet.render(true);
    });
  });

  // Defense roll clicks
  win.querySelectorAll('.spb-def-row').forEach(el => {
    el.addEventListener('click', async () => {
      const roll = new Roll(el.dataset.roll);
      await roll.evaluate();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `<strong>${actor.name}</strong> — ${el.dataset.label}`,
      });
    });
  });

  // Block button click (Dual Wield)
  const blockBtn = win.querySelector('.spb-block-btn');
  if (blockBtn) {
    blockBtn.addEventListener('click', async () => {
      const reduction = parseInt(blockBtn.dataset.blockReduction) || 0;
      const currentStamina = actor.system.resources?.stamina?.value ?? 0;
      if (currentStamina < 1) {
        ui.notifications.warn(`${actor.name} doesn't have enough Stamina to Block!`);
        return;
      }
      await actor.update({ 'system.resources.stamina.value': currentStamina - 1 });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `
          <div class="chat-message-card">
            <div class="chat-message-header">
              <div class="chat-message-title">🛡 Block</div>
              <div class="chat-message-subtitle">Trigger · [Breach]</div>
            </div>
            <div class="chat-message-details">
              <div class="chat-message-detail-row">
                <span class="chat-message-detail-label">Trigger:</span>
                <span>Targeted Attack against ${actor.name}</span>
              </div>
              <div class="chat-message-detail-row">
                <span class="chat-message-detail-label">Reduces damage by:</span>
                <span><strong>${reduction}</strong></span>
              </div>
              <div class="chat-message-detail-row">
                <span class="chat-message-detail-label">Cost:</span>
                <span>1 Stamina (spent)</span>
              </div>
            </div>
          </div>`
      });
    });
  }
}
