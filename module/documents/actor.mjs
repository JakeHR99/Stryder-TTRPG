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
	  if (data.type === 'character' || data.type === 'protocharacter') {
		data = foundry.utils.mergeObject({
		  prototypeToken: {
			actorLink: true
		  }
		}, data);
	  }
	  // Party actor — always defaults to the animated idle pawn
	  if (data.type === 'party') {
		data = foundry.utils.mergeObject({
		  prototypeToken: {
			actorLink: true,
			texture: { src: 'systems/stryder/assets/tokens/pawn-idle.webm' },
			width: 1,
			height: 1,
			disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL
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
    this._prepareSpiritBeastData(actorData);
  }

  /**
   * Prepare Spirit Beast type specific data.
   * Flattens health.max from the template's {value, mod} object into a
   * plain number (like characters get after derivation) so the sheet's
   * numeric bindings and progress bar work.
   */
  _prepareSpiritBeastData(actorData) {
    if (actorData.type !== 'spirit-beast') return;
    const health = actorData.system.health;
    if (health && typeof health.max === 'object' && health.max !== null) {
      health.max = Number(health.max.value ?? 0) + Number(health.max.mod ?? 0);
    }
  }

  /**
   * Prepare Character type specific data
   */
	_prepareCharacterData(actorData) {
	  if (actorData.type !== 'character' && actorData.type !== 'protocharacter' && actorData.type !== 'lordling') return;

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
		"endurance", "nimbleness", "finesse", "strength", "survival", "charm",
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

	  // Max HP/Mana/Stamina derivation is handled on the sheet side by
	  // StryderActorSheet._calcMaxStats (actor-sheet.mjs) and applied on every
	  // render via _syncComputedStats. Do not re-add derivation here — it would
	  // race with sheet writes and clobber Warlock bloodloss/sacrifice reductions.
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
    const hpMod = system.health?.bonus || 0;
    
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
    if (this.type !== 'character' && this.type !== 'protocharacter') return;

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
  }
}
