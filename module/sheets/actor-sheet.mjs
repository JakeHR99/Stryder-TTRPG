import { SYSTEM_ID } from '../helpers/constants.mjs';

import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class StryderActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['stryder', 'sheet', 'actor'],
      width: 600,
      height: 700,
      resizable: true,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'features',
        },
      ],
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

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
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
    const armament = [];
    const generic = [];
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
    const fantasms = [];
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
      // Append to armament.
      if (i.type === 'armament') {
        armament.push(i);
      }
      // Append to generic attack.
      if (i.type === 'generic') {
        generic.push(i);
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
      // Append to fantasms.
      if (i.type === 'fantasm') {
        fantasms.push(i);
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
    context.armament = armament;
    context.generic = generic;
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
    context.fantasms = fantasms;
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

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on('click', '.item-create', this._onItemCreate.bind(this));
    
    // Open Compendium
    html.on('click', '.item-control[data-action="compendium"]', this._onOpenCompendium.bind(this));

    // Delete Inventory Item
    html.on('click', '.item-delete', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      this._onItemDelete(item, li);
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
	  
	  const updates = {};
	  
	  switch(action) {
		case 'turnStart':
		  // Check if Spring of Life is active - if so, don't restore stamina
		  const springOfLifeActive = this.actor.getFlag(SYSTEM_ID, "springOfLifeActive");
		  if (!springOfLifeActive) {
		    updates['system.stamina.value'] = this.actor.system.stamina.max;
		  }
		  break;

		case 'tacticsReset':
		  updates['system.tactics.value'] = this.actor.system.tactics.max;
		  break;
		  
		case 'resting':
		  updates['system.stamina.value'] = this.actor.system.stamina.max;
		  updates['system.mana.value'] = this.actor.system.mana.max;
		  updates['system.focus.value'] = this.actor.system.focus.max;
		  // Clear Spring of Life flag to restore normal stamina functionality
		  updates[`flags.${SYSTEM_ID}.springOfLifeActive`] = null;
		  // Remove exhaustion effects
		  const { removeExhaustionEffects } = await import('../conditions/exhaustion.mjs');
		  await removeExhaustionEffects(this.actor);
		  // Remove haggard effects
		  const { removeHaggardEffects } = await import('../conditions/haggard.mjs');
		  await removeHaggardEffects(this.actor);
		  break;
		  
		case 'springOfLife':
		  // Get current burning and bloodloss health reduction
		  const burningReduction = this.actor.getFlag(SYSTEM_ID, "burningHealthReduction") || 0;
		  const bloodlossReduction = this.actor.getFlag(SYSTEM_ID, "bloodlossHealthReduction") || 0;
		  const totalReduction = burningReduction + bloodlossReduction;
		  
		  // Calculate how much health to restore (current max + reduction)
		  const newMax = this.actor.system.health.max + totalReduction;
		  
		  updates['system.health.value'] = newMax;
		  updates['system.mana.value'] = this.actor.system.mana.max;
		  updates['system.focus.value'] = this.actor.system.focus.max;
		  // Preserve current stamina instead of setting to 0
		  
		  // Set flag to indicate Spring of Life has been used
		  updates[`flags.${SYSTEM_ID}.springOfLifeActive`] = true;
		  
		  // Remove burning and bloodloss health reduction flags
		  updates[`flags.${SYSTEM_ID}.burningHealthReduction`] = null;
		  updates[`flags.${SYSTEM_ID}.bloodlossHealthReduction`] = null;
		  break;
	  }
	  
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

			case 'resting':
			  message = `${this.actor.name} has rested, regaining all Stamina, Mana, and Focus.`;
			  updates['system.stamina.value'] = this.actor.system.stamina.max;
			  updates['system.mana.value'] = this.actor.system.mana.max;
			  updates['system.focus.value'] = this.actor.system.focus.max;
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
				'system.focus.value': this.actor.system.focus.max,
				// Preserve current stamina instead of setting to 0
				[`flags.${SYSTEM_ID}.springOfLifeActive`]: true,
				[`flags.${SYSTEM_ID}.burningHealthReduction`]: null,
				[`flags.${SYSTEM_ID}.bloodlossHealthReduction`]: null
			  };

			  message = `${this.actor.name} has used Spring of Life, regaining all Health, Mana, and Focus. Stamina cannot be restored until the next Rest.`;

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

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }

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
}
