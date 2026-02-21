import { SYSTEM_ID } from '../helpers/constants.mjs';

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class StryderActor extends Actor {
  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

	/** @override */
	static async create(data, options = {}) {
	  // Initialize default data for npcs
	  if (data.type === 'npc') {
		data = foundry.utils.mergeObject({
		  system: {
			health: { value: 8, max: 8 }
		  },
		  prototypeToken: {
			actorLink: true
		  }
		}, data);
	  }
	  // Initialize default data for monsters
	  if (data.type === 'monster') {
		data = foundry.utils.mergeObject({
		  system: {
			health: { value: 8, max: 8 },
			mana: { value: 3, max: 3 },
			stamina: { value: 2, max: 2 },
			armor: { value: 0, max: 0 }
		  },
		  prototypeToken: {
			actorLink: false
		  }
		}, data);
	  }
	  // Initialize default data for lordlings
	  if (data.type === 'lordling') {
		data = foundry.utils.mergeObject({
		  system: {
			health: { value: 0, max: 0 }
		  },
		  prototypeToken: {
			actorLink: true
		  }
		}, data);
	  }
	  // Initialize default data for familiars
	  if (data.type === 'familiar') {
		data = foundry.utils.mergeObject({
		  system: {
			health: { value: 0, max: 0 },
			stamina: { value: 2, max: 2 },
			appetite: { value: 0 }
		  },
		  prototypeToken: {
			actorLink: true
		  }
		}, data);
	  }
	  // Initialize default data for pets
	  if (data.type === 'pet') {
		data = foundry.utils.mergeObject({
		  system: {
			health: { value: 8, max: 8 },
			stamina: { value: 2, max: 2 }
		  },
		  prototypeToken: {
			actorLink: true
		  }
		}, data);
	  }
	  // For character type
	  if (data.type === 'character') {
		data = foundry.utils.mergeObject({
		  prototypeToken: {
			actorLink: true
		  }
		}, data);
	  }
	  
	  return super.create(data, options);
	}

  /**
   * @override
   * Augment the actor source data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.stryder || {};

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
    this._prepareFamiliarData(actorData);
    this._preparePetData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
	_prepareCharacterData(actorData) {
	  if (actorData.type !== 'character' && actorData.type !== 'lordling') return;

	  const systemData = actorData.system;

	  if (actorData.type === 'lordling') {
		const linkedCharacterId = systemData.linkedCharacterId;
		if (linkedCharacterId) {
		  const linkedCharacter = game.actors.get(linkedCharacterId);
		  if (linkedCharacter) {
			// Ensure health object exists
			if (!systemData.health) {
			  systemData.health = { value: 0, max: 0 };
			}
			
			// Get linked character's max health safely
			const linkedMaxHealth = linkedCharacter.system?.health?.max || 0;
			
			// Update lordling's health
			systemData.health.max = linkedMaxHealth;
			
			// Ensure current health doesn't exceed new max
			if (systemData.health.value > linkedMaxHealth) {
			  systemData.health.value = linkedMaxHealth;
			}

			// Sync mastery from linked character
			const linkedMastery = linkedCharacter.system?.attributes?.mastery || 0;
			systemData.attributes.mastery = linkedMastery;
		  }
		}
		return;
	  }

	  // Initialize talent values if they don't exist
	  if (!systemData.attributes.talent) {
		systemData.attributes.talent = {};
	  }

	  // Ensure all talents have a base value of 0
	  const talents = [
		"endurance", "nimbleness", "strength", "survival", "charm",
		"wit", "wisdom", "deceit", "diplomacy", "intimacy", "aggression"
	  ];

	  if (!actorData.system.life) {
		actorData.system.life = {
		  cooking: { value: 0 },
		  elixirbrewing: { value: 0 },
		  fishing: { value: 0 },
		  hunting: { value: 0 },
		  performing: { value: 0 },
		  scavenging: { value: 0 },
		  trading: { value: 0 }
		};
	  }
	  
	  talents.forEach(talent => {
		if (!systemData.attributes.talent[talent]) {
		  systemData.attributes.talent[talent] = { value: 0 };
		}
	  });

	  // Calculate ability modifiers
	  for (let [key, ability] of Object.entries(systemData.abilities)) {
		ability.mod = Math.floor((ability.value - 10) / 2);
	  }

	  // Calculate max HP
	  // DISABLED: Manual max value control - these calculations were overwriting player edits
	  // this._calculateMaxHP(actorData);
      // this._calculateMaxMana(actorData);
      // this._calculateMaxStamina(actorData);
      // this._calculateMaxFocus(actorData);

      // Calculate reduction bonuses from equipped armor
      // DISABLED: Manual reduction control - automatic calculation was overwriting player edits
      // this._calculateReductionBonuses(actorData);
	}

	/**
	 * Calculate the character's max HP based on class and Grit ability
	 * @param {Object} actorData The actor data to modify
	 */
	// Add this to the _calculateMaxHP method in actor.js
	_calculateMaxHP(actorData) {
	  const system = actorData.system;
	  const level = system.attributes.level?.value || 1;
	  const baseHP = system.class?.base_hp || 0;
	  const hpPerLevel = system.class?.hp_per_level || 0;
	  const gritValue = system.abilities?.Grit?.value || 0;
	  const hpMod = system.health?.max?.mod || 0;
	  
	  // Get burning and bloodloss health reduction from flags
	  const burningReduction = actorData.flags[SYSTEM_ID]?.burningHealthReduction || 0;
	  const bloodlossReduction = actorData.flags[SYSTEM_ID]?.bloodlossHealthReduction || 0;
	  const totalReduction = burningReduction + bloodlossReduction;

	  // Calculate base max HP from class
	  let maxHP = baseHP + (hpPerLevel * (level - 1)) + hpMod - totalReduction;

	  // Add Grit bonuses at levels 1, 5, 10, and 15
	  if (gritValue >= 1) {
		if (level >= 1) maxHP += gritValue;
		if (level >= 5) maxHP += gritValue;
		if (level >= 10) maxHP += gritValue;
		if (level >= 15) maxHP += gritValue;
	  }

	  // Ensure health exists
	  if (!system.health) {
		system.health = { 
		  value: 0, 
		  min: 0, 
		  max: 0,
		  max: {
			mod: 0
		  }
		};
	  }

	  // Update max HP, preserving current HP value but clamping it to new max
	  const currentHP = system.health.value || 0;
	  system.health.max = Math.max(0, maxHP); // Ensure max HP doesn't go below 0
	  system.health.value = Math.min(currentHP, system.health.max);
	  system.health.min = 0;
	}

	/**
	 * Calculate max Mana based on level and mod
	 */
	_calculateMaxMana(actorData) {
	  const system = actorData.system;
	  const level = system.attributes.level?.value || 0;
	  const manaMod = system.mana?.max?.mod || 0;

	  let baseMana = 0;
	  if (level <= 0) baseMana = 0;
	  else if (level <= 2) baseMana = 3;
	  else if (level === 3) baseMana = 4;
	  else if (level === 4) baseMana = 5;
	  else if (level <= 6) baseMana = 6;
	  else if (level <= 8) baseMana = 8;
	  else if (level <= 10) baseMana = 10;
	  else if (level <= 12) baseMana = 12;
	  else if (level <= 14) baseMana = 15;
	  else baseMana = 18; // level 15+

	  const maxMana = baseMana + manaMod;

	  // Ensure mana exists
	  if (!system.mana) {
		system.mana = { 
		  value: 0, 
		  min: 0, 
		  max: 0,
		  max: {
			mod: 0
		  }
		};
	  }

	  // Update max mana, preserving current value but clamping it
	  const currentMana = system.mana.value || 0;
	  system.mana.max = maxMana;
	  system.mana.value = Math.min(currentMana, maxMana);
	  system.mana.min = 0;
	}

	/**
	 * Calculate max Stamina based on level and mod
	 */
	_calculateMaxStamina(actorData) {
	  const system = actorData.system;
	  const level = system.attributes.level?.value || 0;
	  const staminaMod = system.stamina?.max?.mod || 0;

	  let baseStamina = 0;
	  if (level <= 0) baseStamina = 0;
	  else if (level <= 3) baseStamina = 2;
	  else if (level <= 6) baseStamina = 3;
	  else if (level <= 10) baseStamina = 4;
	  else baseStamina = 5; // level 11-15

	  // Get poison reduction from flags (stage 3+)
	  const poisonReduction = actorData.effects.find(e => 
		e.name.startsWith("Poisoned") && 
		(e.flags[SYSTEM_ID]?.poisonStage || 1) >= 3
	  ) ? 1 : 0;

	  const maxStamina = baseStamina + staminaMod - poisonReduction;

	  // Ensure stamina exists
	  if (!system.stamina) {
		system.stamina = { 
		  value: 0, 
		  min: 0, 
		  max: 0,
		  max: {
			mod: 0
		  }
		};
	  }

	  // Update max stamina, preserving current value but clamping it
	  const currentStamina = system.stamina.value || 0;
	  system.stamina.max = maxStamina;
	  system.stamina.value = Math.min(currentStamina, maxStamina);
	  system.stamina.min = 0;
	}

	/**
	 * Calculate max Focus based on level and mod
	 */
	_calculateMaxFocus(actorData) {
	  const system = actorData.system;
	  const level = system.attributes.level?.value || 0;
	  const focusMod = system.focus?.max?.mod || 0;

	  let baseFocus = 0;
	  if (level <= 0) baseFocus = 0;
	  else if (level <= 4) baseFocus = 3;
	  else if (level <= 9) baseFocus = 4;
	  else baseFocus = 5; // level 10-15

	  const maxFocus = baseFocus + focusMod;

	  // Ensure focus exists
	  if (!system.focus) {
		system.focus = { 
		  value: 0, 
		  min: 0, 
		  max: 0,
		  max: {
			mod: 0
		  }
		};
	  }

	  // Update max focus, preserving current value but clamping it
	  const currentFocus = system.focus.value || 0;
	  system.focus.max = maxFocus;
	  system.focus.value = Math.min(currentFocus, maxFocus);
	  system.focus.min = 0;
	}

	/**
	 * Calculate physical and magykal reduction bonuses from equipped armor
	 * @param {Object} actorData The actor data to modify
	 */
	_calculateReductionBonuses(actorData) {
	  const system = actorData.system;
	  
	  // Initialize reduction values
	  let physicalReductionBonus = 0;
	  let magykalReductionBonus = 0;
	  
	  // Armor item types that can provide reduction bonuses
	  const armorTypes = ['head', 'legs', 'arms', 'back', 'gems'];
	  
	  // Iterate through all items to find equipped armor
	  for (const item of actorData.items) {
		// Check if this item is an armor type and is equipped
		if (armorTypes.includes(item.type) && item.system?.equipped !== false) {
		  // Add physical reduction bonus
		  const physicalBonus = item.system?.physical_reduction_bonus || 0;
		  physicalReductionBonus += physicalBonus;
		  
		  // Add magykal reduction bonus
		  const magykalBonus = item.system?.magykal_reduction_bonus || 0;
		  magykalReductionBonus += magykalBonus;
		}
	  }
	  
	  // Update the actor's reduction values
	  system.physical_reduction = physicalReductionBonus;
	  system.magykal_reduction = magykalReductionBonus;
	}

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

    const systemData = actorData.system;
    systemData.xp = systemData.cr * systemData.cr * 100;

    // Ensure attributes object exists
    if (!systemData.attributes) systemData.attributes = {};

    // Initialize sense values if they don't exist
    if (!systemData.attributes.sense) systemData.attributes.sense = {};
    const senses = ['sight', 'hearing', 'smell', 'arcane', 'touch'];
    senses.forEach(sense => {
      if (!systemData.attributes.sense[sense]) {
        systemData.attributes.sense[sense] = { value: 0 };
      }
    });

    // Initialize talent values if they don't exist
    if (!systemData.attributes.talent) systemData.attributes.talent = {};
    const talents = [
      'endurance', 'nimbleness', 'finesse', 'strength', 'survival',
      'charm', 'wit', 'wisdom', 'deceit', 'diplomacy', 'intimacy',
      'aggression', 'threat'
    ];
    talents.forEach(talent => {
      if (!systemData.attributes.talent[talent]) {
        systemData.attributes.talent[talent] = { value: 0 };
      }
    });
  }

  /**
   * Prepare Familiar type specific data
   */
  _prepareFamiliarData(actorData) {
    if (actorData.type !== 'familiar') return;

    const systemData = actorData.system;

    // Calculate max HP for familiars
    this._calculateFamiliarMaxHP(actorData);
  }

  /**
   * Calculate the familiar's max HP based on familiar.base_hp
   * @param {Object} actorData The actor data to modify
   */
  _calculateFamiliarMaxHP(actorData) {
    const system = actorData.system;
    const baseHP = system.familiar?.base_hp || 0;
    const hpMod = system.health?.max?.mod || 0;
    
    // Get burning and bloodloss health reduction from flags
    const burningReduction = actorData.flags[SYSTEM_ID]?.burningHealthReduction || 0;
    const bloodlossReduction = actorData.flags[SYSTEM_ID]?.bloodlossHealthReduction || 0;
    const totalReduction = burningReduction + bloodlossReduction;

    // Calculate max HP from familiar base_hp
    let maxHP = baseHP + hpMod - totalReduction;

    // Ensure health exists
    if (!system.health) {
      system.health = { 
        value: 0, 
        min: 0, 
        max: 0,
        max: {
          mod: 0
        }
      };
    }

    // Update max HP, preserving current HP value but clamping it to new max
    const currentHP = system.health.value || 0;
    system.health.max = Math.max(0, maxHP); // Ensure max HP doesn't go below 0
    system.health.value = Math.min(currentHP, system.health.max);
    system.health.min = 0;
  }

  /**
   * Prepare Pet type specific data
   */
  _preparePetData(actorData) {
    if (actorData.type !== 'pet') return;

    const systemData = actorData.system;

    // Ensure attributes object exists
    if (!systemData.attributes) systemData.attributes = {};

    // Initialize sense values if they don't exist
    if (!systemData.attributes.sense) systemData.attributes.sense = {};
    const senses = ['sight', 'hearing', 'smell', 'arcane', 'touch'];
    senses.forEach(sense => {
      if (!systemData.attributes.sense[sense]) {
        systemData.attributes.sense[sense] = { value: 0 };
      }
    });

    // Initialize talent values if they don't exist
    if (!systemData.attributes.talent) systemData.attributes.talent = {};
    const talents = [
      'endurance', 'nimbleness', 'finesse', 'strength', 'survival',
      'charm', 'wit', 'wisdom', 'deceit', 'diplomacy', 'intimacy',
      'aggression', 'threat'
    ];
    talents.forEach(talent => {
      if (!systemData.attributes.talent[talent]) {
        systemData.attributes.talent[talent] = { value: 0 };
      }
    });
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    // Starts off by populating the roll data with `this.system`
    const data = { ...super.getRollData() };

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);
    this._getFamiliarRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== 'character') return;

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    if (data.abilities) {
      for (let [k, v] of Object.entries(data.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    // Add level for easier access, or fall back to 0.
    if (data.attributes.level) {
      data.lvl = data.attributes.level.value ?? 0;
    }
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== 'npc') return;

    // Process additional NPC data here.
  }

  /**
   * Prepare familiar roll data.
   */
  _getFamiliarRollData(data) {
    if (this.type !== 'familiar') return;

    // Process additional familiar data here.
    // For now, familiars don't need special roll data processing beyond what's in the base system
  }
}
