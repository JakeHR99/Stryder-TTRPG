import { SYSTEM_ID } from '../helpers/constants.mjs';
import { handleConfusedApplication, handleConfusedRollIntercept, confusedState } from '../conditions/confused.mjs';
import { isActorPanicked, getPanickedRollQuality } from '../conditions/panicked.mjs';
import { isActorHorrified, getHorrifiedRollQuality } from '../conditions/horrified.mjs';

export function getFantasmActionType(item) {
  if (item.name.includes("Hyper Sense") || item.name.includes("Unbound Leap") || item.actor?.system?.booleans?.hasFantastic) {
    return "Swift";
  }
  return "Focused";
}

// Tag descriptions for tooltips
const tagDescriptions = {
  "aid": "Abilities with this tag bestow a beneficial defensive effect, such as defense boosts or healing.",
  "area": "Abilities with this tag target a number of spaces rather than a specific target.",
  "augment": "Abilities with this tag bestow a beneficial offensive effect, such as damage boosts or accuracy increases.",
  "breach": "Abilities with this tag are able to affect the action that occurred before them and can be used in reaction to them.",
  "control": "Abilities with this tag inflict impairing or disabling effects on enemies hit.",
  "reflex": "This tag marks specific defensive actions or abilities that can be enhanced or debuffed.",
  "persistent": "Abilities with this tag inflict an effect that tends to linger after the usage of the ability itself.",
  "sunder": "Abilities with this tag are unable to be reacted to and [Breach] abilities cannot be activated against them.",
  "targeted": "Abilities with this tag target a number of specific creatures rather than an area.",
  "multi-target": "Abilities with this tag target a number of specific creatures rather than an area.",
  "pierce": "Abilities with this tag ignore armor when dealing damage, but still respect physical and magykal reduction."
};

// Helper function to create tag HTML with tooltip
function createTagHTML(tagValue) {
  if (!tagValue) return '';
  const description = tagDescriptions[tagValue.toLowerCase()] || '';
  return `<span class="chat-message-tag" style="cursor: help;" title="${description}">${tagValue}</span>`;
}

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class StryderItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
    
    // Ensure uses_current is properly set for rendering
    if ((this.type === 'skill' || this.type === 'racial') && this.system.cooldown_value > 0) {
      if (this.system.uses_current === undefined || this.system.uses_current === null) {
        this.system.uses_current = this.system.cooldown_value;
      }
    } else if ((this.type === 'skill' || this.type === 'racial') && this.system.cooldown_value === 0) {
      this.system.uses_current = 0;
    }
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    
    // Set default damage_type if not already set
    if (!this.system.damage_type) {
      if (this.type === 'armament') {
        this.system.damage_type = 'physical';
      } else if (this.type === 'generic') {
        this.system.damage_type = 'ahl';
      } else if (this.type === 'hex') {
        this.system.damage_type = 'magykal';
      }
    }
    
    // Initialize uses_current for skills and racial items
    if ((this.type === 'skill' || this.type === 'racial') && this.system.cooldown_value > 0) {
      if (this.system.uses_current === undefined || this.system.uses_current === null) {
        this.system.uses_current = this.system.cooldown_value;
        console.log(`Initializing ${this.type} ${this.name}: setting uses_current to ${this.system.cooldown_value}`);
      }
    } else if ((this.type === 'skill' || this.type === 'racial') && this.system.cooldown_value === 0) {
      // If cooldown_value is 0, ensure uses_current is also 0
      this.system.uses_current = 0;
    }
  }


  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with `this.system`
    const rollData = { ...super.getRollData() };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {

    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `${item.name}`;

	// Blinded handling now done in stryder.mjs

	// Confused handling now done in stryder.mjs at message level

	let actionType = "";
	if (item.system.action_type === "focused" || item.system.action_type === undefined) {
		actionType = "Focused";
	} else if (item.system.action_type === "swift") {
		actionType = "Swift";
	} else if (item.system.action_type === "passive") {
		actionType = "Passive";
	}

	let cooldown = "";
	if (item.system.cooldown_value === null || item.system.cooldown_value === undefined) {
		cooldown = `No cooldown entered.`;
	} else if (item.system.cooldown_value === 0) {
		cooldown = `None.`;
	} else if (item.system.cooldown_unit === "turn") {
		cooldown = `${item.system.cooldown_value} Turn(s)`;
	} else if (item.system.cooldown_unit === "round") {
		cooldown = `${item.system.cooldown_value} Round(s)`;
	} else if (item.system.cooldown_unit === "perRest") {
		cooldown = `${item.system.cooldown_value} per Rest`;
	} else if (item.system.cooldown_unit === "perTurn") {
		cooldown = `${item.system.cooldown_value} per Turn`;
	} else if (item.system.cooldown_unit === "perRound") {
		cooldown = `${item.system.cooldown_value} per Round`;
	} else if (item.system.cooldown_unit === "perSpring") {
		cooldown = `${item.system.cooldown_value} per Spring of Life`;
	}

	let range = "";
	if (item.system.range === 0) {
		range = "<strong>Range:</strong> Melee<br>";
	} else if (item.system.range > 0) {
		range = `<strong>Range:</strong> ${item.system.range} meters<br>`;
	} else if (item.system.range === null || item.system.range === undefined) {
		range = ``;
	}

	let manacost = "";
	if (item.system.mana_cost === null || item.system.mana_cost === 0 || item.system.mana_cost === undefined) {
		manacost = "0 mana";
	} else if (item.system.mana_cost > 0) {
		manacost = `${item.system.mana_cost} mana`;
	}

	let staminacost = "";
	if (item.system.stamina_cost === null || item.system.stamina_cost === 0 || item.system.stamina_cost === undefined) {
		staminacost = "0 stamina";
	} else if (item.system.stamina_cost > 0) {
		staminacost = `${item.system.stamina_cost} stamina`;
	}

	let othercost = "";
	if (item.system.other_restrictions === null || item.system.other_restrictions === 0 || item.system.other_restrictions === "" || item.system.other_restrictions === undefined) {
		othercost = "";
	} else {
		othercost = `, ${item.system.other_restrictions}`;
	}

	let tag1 = "";
	if (item.system.tag1 === null || item.system.tag1 === "" || item.system.tag1 === undefined) {
		tag1 = "";
	} else {
		tag1 = `${item.system.tag1}`;
	}

	let tag2 = "";
	if (item.system.tag2 === null || item.system.tag2 === "" || item.system.tag2 === undefined) {
		tag2 = "";
	} else {
		tag2 = `${item.system.tag2}`;
	}

	let tag3 = "";
	if (item.system.tag3 === null || item.system.tag3 === "" || item.system.tag3 === undefined) {
		tag3 = "";
	} else {
		tag3 = `${item.system.tag3}`;
	}

	// If hasReflexTag is checked and reflex isn't already in a tag slot, add it as a displayed tag
	if (item.system.hasReflexTag && tag1.toLowerCase() !== 'reflex' && tag2.toLowerCase() !== 'reflex' && tag3.toLowerCase() !== 'reflex') {
		if (!tag1) { tag1 = "Reflex"; }
		else if (!tag2) { tag2 = "Reflex"; }
		else if (!tag3) { tag3 = "Reflex"; }
	}

	let itemType = item.type === "feature"       ? "Class Feature"   :
				   item.type === "racial"        ? "Folk Ability"    :
				   item.type === "hex"           ? "Hex"             :
				   item.type === "skill"         ? "Skill"           :
				   item.type === "statperk"      ? "Stat Perk"       :
				   item.type === "technique"     ? "Technique"       :
				   item.type === "profession"    ? "Profession"      :
				   item.type === "action"        ? "Action"          :
				   item.type === "fantasm"       ? "Fantasm"         :
				   item.type === "armament"      ? "Soul Armament"   :
				   item.type === "generic"       ? "Attack"          :
				   item.type === "loot"          ? "Loot"            :
				   item.type === "component"     ? "Component"       :
				   item.type === "consumable"    ? "Consumable"      :
				   item.type === "gear"          ? "Gear"            :
				   item.type === "aegiscore"     ? "Aegis Core"      :
				   item.type === "legacies"      ? "Soul Stone & Legacy" :
				   item.type === "head"          ? "Head Item"       :
				   item.type === "back"          ? "Back Item"       :
				   item.type === "arms"          ? "Arms Item"       :
				   item.type === "legs"          ? "Legs Item"       :
				   item.type === "gems"          ? "Gem"             :
				   item.type === "bonds"         ? "Bond"            :
				   item.type === "passive"       ? "Passive"         :
				   item.type === "miscellaneous" ? "Miscellaneous"   :
				   item.type === "class"         ? "Class"           :
				   item.type === "folk"          ? "Folk"            :
				   "";

	let hexAspect = "";
	if (item.system.aspect === null || item.system.aspect === undefined || item.system.aspect === "") {
		hexAspect = "None.";
	} else {
		hexAspect = `${item.system.aspect}`;
	}

	let hexElement = "";
	if (item.system.element === null || item.system.element === undefined || item.system.element === "") {
		hexElement = "None.";
	} else {
		hexElement = `${item.system.element}`;
	}

	let professionLevel = "";
	if (item.system.profession_level === null || item.system.profession_level === undefined || item.system.profession_level === 0) {
		professionLevel = "No experience.";
	} else {
		professionLevel = `${item.system.profession_level}`;
	}

	let bondLevel = "Esoteric";
	if (item.system.bond && item.system.bond.level) {
	  bondLevel = item.system.bond.level;
	}

	let bondFolk = "Unknown";
	if (item.system.bond && item.system.bond.folk) {
	  bondFolk = item.system.bond.folk;
	}

	let bondGender = "Unknown";
	if (item.system.bond && item.system.bond.gender) {
	  bondGender = item.system.bond.gender;
	}

	let bondAge = "No Age Entered";
	if (item.system.bond && item.system.bond.age) {
	  bondAge = item.system.bond.age;
	}

	let miscellaneous_type = "Unknown";
	if (item.system.itemtype) {
	  miscellaneous_type = item.system.itemtype;
	}

	let armamentForm = "";
	if (item.system.form === null || item.system.form === undefined || item.system.form === "") {
		armamentForm = "Formless";
	} else {
		armamentForm = `${item.system.form}`;
	}

	let parentAbility = "";
	if (item.system.parent_ability === null || item.system.parent_ability === undefined || item.system.parent_ability === "") {
		parentAbility = "No derived ability.";
	} else {
		parentAbility = `${item.system.parent_ability}`;
	}

	let rarity = "";
	if (item.system.rarity === null || item.system.rarity === undefined || item.system.rarity === "") {
		rarity = "No Rarity";
	} else if (item.system.rarity === "common") {
		rarity = `Common`;
	} else if (item.system.rarity === "uncommon") {
		rarity = `Uncommon`;
	} else if (item.system.rarity === "rare") {
		rarity = `Rare`;
	} else if (item.system.rarity === "mythic") {
		rarity = `Legendary`;
	} else if (item.system.rarity === "one of a kind") {
		rarity = `One of a Kind`;
	}

	let grade_rank = "";
	if (item.system.grade === null || item.system.grade === undefined || item.system.grade === "") {
		grade_rank = "Gradeless.";
	} else if (item.system.grade === "G4") {
		grade_rank = `Rank 4`;
	} else if (item.system.grade === "G3") {
		grade_rank = `Rank 3`;
	} else if (item.system.grade === "G2") {
		grade_rank = `Rank 2`;
	} else if (item.system.grade === "G1") {
		grade_rank = `Rank 1`;
	} else if (item.system.grade === "G0") {
		grade_rank = `Mythic`;
	}

	let nature = "";
	if (item.system.nature === null || item.system.nature === undefined || item.system.nature === "") {
		nature = "Esoteric";
	} else if (item.system.nature === "enchanted") {
		nature = `Enchanted`;
	} else if (item.system.nature === "magytech") {
		nature = `Magytech`;
	} else if (item.system.nature === "other") {
		nature = `Other`;
	}

	let quality = "";
	if (item.system.quality === null || item.system.quality === undefined || item.system.quality === "") {
		quality = "Qualityless";
	} else if (item.system.quality === "prototype") {
		quality = `Prototype`;
	} else if (item.system.quality === "improved") {
		quality = `Improved`;
	} else if (item.system.quality === "perfect") {
		quality = `Perfect`;
	}

	let charges = "";
	if (item.system.charges && (item.system.charges.max === null || item.system.charges.max === undefined || item.system.charges.max === 0)) {
		charges = "";
	} else if (item.system.charges) {
		charges = `<strong>Charges:</strong> ` + item.system.charges.value + `/` + item.system.charges.max + `<br />`;
	}

	let sell_price = "";
	if (item.system.sell_price === null || item.system.sell_price === undefined || item.system.sell_price === 0) {
		sell_price = "No value.";
	} else {
		sell_price = `${item.system.sell_price} Grail`;
	}

	let contentHTML = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
		${(tag1 || tag2 || tag3) ? `
		  <div class="chat-message-tags">
			${createTagHTML(tag1)}
			${createTagHTML(tag2)}
			${createTagHTML(tag3)}
		  </div>
		` : ''}
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Action:</span>
		  <span>${actionType}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cooldown:</span>
		  <span>${cooldown}</span>
		</div>
		${range ? `
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Range:</span>
			<span>${range.replace('<strong>Range:</strong> ', '').replace('<br>', '')}</span>
		  </div>
		` : ''}
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cost:</span>
		  <span>${manacost}, ${staminacost}${othercost}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLhex = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
		${(tag1 || tag2 || tag3) ? `
		  <div class="chat-message-tags">
			${createTagHTML(tag1)}
			${createTagHTML(tag2)}
			${createTagHTML(tag3)}
		  </div>
		` : ''}
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Aspect:</span>
		  <span>${hexAspect}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Element:</span>
		  <span>${hexElement}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Action:</span>
		  <span>${actionType}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cooldown:</span>
		  <span>${cooldown}</span>
		</div>
		${range ? `
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Range:</span>
			<span>${range.replace('<strong>Range:</strong> ', '').replace('<br>', '')}</span>
		  </div>
		` : ''}
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cost:</span>
		  <span>${manacost}, ${staminacost}${othercost}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div><br />
	`;

	let contentHTMLracial = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
		${(tag1 || tag2 || tag3) ? `
		  <div class="chat-message-tags">
			${createTagHTML(tag1)}
			${createTagHTML(tag2)}
			${createTagHTML(tag3)}
		  </div>
		` : ''}
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Action:</span>
		  <span>${actionType}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cooldown:</span>
		  <span>${cooldown}</span>
		</div>
		${charges ? `
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Charges:</span>
			<span>${charges.replace('<strong>Charges:</strong> ', '').replace('<br />', '')}</span>
		  </div>
		` : ''}
		${range ? `
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Range:</span>
			<span>${range.replace('<strong>Range:</strong> ', '').replace('<br>', '')}</span>
		  </div>
		` : ''}
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cost:</span>
		  <span>${manacost}, ${staminacost}${othercost}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLstat = `
	<div class="chat-message-card" style="text-align: center;">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-content" style="padding: 0 15px;">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	async function createCollapsibleSection(title, content) {
	  if (!content) return '';
	  const enriched = await TextEditor.enrichHTML(content, {async: true});
	  return `
		<div class="collapsible-section">
		  <button type="button" class="collapsible-toggle">${title} <i class="fas fa-caret-down"></i></button>
		  <div class="collapsible-content" style="display: none;">
			<div class="collapsible-inner">${enriched}</div>
		  </div>
		</div>
	  `;
	}

	function createResourceSpendButton(item) {
	  console.log("Creating resource button for item type:", item.type);
	  
	  let buttonsHTML = '';
	  
	  // Handle fantasm items
	  if (item.type === "fantasm" || item.type === "ITEM.TypeFantasm") {
		buttonsHTML += `
		<div class="resource-spend-container" style="margin: 5px 0; text-align: center;">
		  <button class="resource-spend-button" 
				  data-focus-cost="1">
			Spend <span style="font-family: 'Varela Round';">1</span> <span style="color: #d4af37; font-weight: bold;">Focus</span>
		  </button>
		</div>
		`;
	  }
	  // Handle mana, stamina, and tactic points costs
	  else {
		const hasStaminaCost = item.system.stamina_cost > 0;
		const hasManaCost = item.system.mana_cost > 0;
		const hasTacticsCost = item.system.tactics_cost > 0;
		const canOverflow = item.type === "hex" && item.system.hex?.canOverflow;
		
		if (hasStaminaCost || hasManaCost || hasTacticsCost) {
		  let buttonText = 'Spend Resources';
		  const resourceParts = [];
		  
		  if (hasStaminaCost) {
			resourceParts.push(`<span style="font-family: 'Varela Round';">${item.system.stamina_cost}</span> <span style="color: #147c32; font-weight: bold;">Stamina</span>`);
		  }
		  if (hasManaCost) {
			resourceParts.push(`<span style="font-family: 'Varela Round';">${item.system.mana_cost}</span> <span style="color: #08acff; font-weight: bold;">Mana</span>`);
		  }
		  if (hasTacticsCost) {
			resourceParts.push(`<span style="font-family: 'Varela Round';">${item.system.tactics_cost}</span> <span style="color: #FFFF00; font-weight: bold;">Tactic Points</span>`);
		  }
		  
		  if (resourceParts.length > 0) {
			buttonText = `Spend ${resourceParts.join(' and ')}`;
		  }

		  buttonsHTML += `
		  <div class="resource-spend-container" style="margin: 5px 0; text-align: center;">
			<button class="resource-spend-button" 
					data-stamina-cost="${item.system.stamina_cost || 0}"
					data-mana-cost="${item.system.mana_cost || 0}"
					data-tactics-cost="${item.system.tactics_cost || 0}"
					data-can-overflow="${canOverflow}"
					data-item-id="${item.id}">
			  ${buttonText}
			</button>
		  </div>
		  `;
		}
	  }

	  // Add Unbound Leap effect button if item name contains "Unbound Leap"
	  if (item.name.includes("Unbound Leap")) {
		buttonsHTML += `
		<div class="resource-spend-container" style="margin: 5px 0; text-align: center;">
		  <button class="unbound-leap-button" 
				  style="background: linear-gradient(to bottom, #8b5a2b, #5c3a21); color: white; border: none; border-radius: 20px; padding: 8px 15px; font-family: 'Cinzel Decorative', cursive; font-size: 14px; cursor: pointer; margin: 10px auto; display: block; text-align: center; transition: all 0.3s ease;">
			Apply Effect
		  </button>
		</div>
		`;
	  }

	  return buttonsHTML;
	}

	function createDamageButton(damage, damageType = 'ahl', hasPierce = false) {
	  return `
	  <div class="damage-apply-container" style="margin: 5px 0; text-align: center;">
		<button class="damage-apply-button" 
				data-damage="${damage}"
				data-damage-type="${damageType}"
				data-has-pierce="${hasPierce}">
		  Apply <span style="color: #dc3545; font-weight: bold;">${damage}</span> Damage
		</button>
	  </div>
	  `;
	}

	function createBloodlossSpendButton(item) {
	  console.log("Creating bloodloss button for item:", item.name);
	  
	  const hasBloodlossCost = item.system.blood_cost > 0;
	  
	  if (!hasBloodlossCost) {
		return '';
	  }
	  
	  const buttonText = `Spend <span style="font-family: 'Varela Round';">${item.system.blood_cost}</span> <span style="color: #8b0000; font-weight: bold;">Bloodloss</span>`;
	  
	  return `
		<div class="resource-spend-container" style="margin: 5px 0; text-align: center;">
		  <button class="bloodloss-spend-button" 
				  data-bloodloss-cost="${item.system.blood_cost}"
				  data-item-id="${item.id}">
			${buttonText}
		  </button>
		</div>
	  `;
	}

	async function showOverflowDialog() {
	  const content = await renderTemplate('systems/stryder/templates/item/hex-overflow-dialog.hbs');
	  
	  return new Promise((resolve) => {
		const dialog = new Dialog({
		  title: "Hex Overflow",
		  content: content,
		  buttons: {
			confirm: {
			  label: "Confirm",
			  callback: (html) => {
				const inputValue = html.find('.overflow-mana-input').val();
				const overflowAmount = parseInt(inputValue) || 0;
				resolve(overflowAmount);
			  }
			},
			cancel: {
			  label: "Cancel",
			  callback: () => {
				resolve(null);
			  }
			}
		  },
		  default: "cancel",
		  close: () => {
			resolve(null);
		  }
		});
		
		dialog.render(true);
	  });
	}

	async function handleResourceSpend(event) {
	  event.preventDefault();
	  const button = event.currentTarget;
	  const staminaCost = parseInt(button.dataset.staminaCost) || 0;
	  const manaCost = parseInt(button.dataset.manaCost) || 0;
	  const tacticsCost = parseInt(button.dataset.tacticsCost) || 0;
	  const focusCost = parseInt(button.dataset.focusCost) || 0;
	  const canOverflow = button.dataset.canOverflow === "true";
	  const itemId = button.dataset.itemId;

	  // Get the currently controlled tokens
	  const controlledTokens = canvas.tokens.controlled;
	  
	  if (controlledTokens.length === 0) {
		ui.notifications.warn("No character selected! Please select a token first.");
		return;
	  }

	  const token = controlledTokens[0];
	  let actor = token.actor;
	  
	  if (!actor) {
		ui.notifications.error("Selected token has no associated actor!");
		return;
	  }

	  // Handle Lordling case - Tactic Points come from Lordling, others from linked character
	  let linkedActor = null;
	  if (actor.type === 'lordling') {
		const linkedCharacterId = actor.system.linkedCharacterId;
		
		// Check if we need linked actor for stamina/mana/focus
		const needsLinkedActor = staminaCost > 0 || manaCost > 0 || focusCost > 0;
		
		if (needsLinkedActor) {
		  if (!linkedCharacterId) {
			let resourceMessage = "";
			if (staminaCost > 0) resourceMessage += "stamina";
			if (manaCost > 0) {
			  if (resourceMessage) resourceMessage += "/";
			  resourceMessage += "mana";
			}
			if (focusCost > 0) {
			  if (resourceMessage) resourceMessage += "/";
			  resourceMessage += "focus";
			}
			
			ui.notifications.error(`Lordling has no Linked Actor, so ${resourceMessage} could not be subtracted!`);
			return;
		  }
		  
		  // Get the linked actor for stamina/mana/focus
		  linkedActor = game.actors.get(linkedCharacterId);
		  if (!linkedActor) {
			ui.notifications.error("Linked Actor not found!");
			return;
		  }
		}
	  }

	  // Check if the actor has enough resources
	  let canAfford = true;
	  let warningMessage = "";
	  let adjustedStaminaCost = null; // For stunned condition handling

	  if (staminaCost > 0) {
		const staminaActor = linkedActor || actor;
		if (staminaActor.system.stamina?.value === undefined) {
		  ui.notifications.warn("Selected character doesn't have stamina to spend!");
		  return;
		}
		
		// Check for Stunned condition
		const { handleStunnedStaminaSpend } = await import('../conditions/stunned.mjs');
		const stunnedResult = await handleStunnedStaminaSpend(staminaActor, staminaCost, 'resource');
		if (!stunnedResult.shouldProceed) {
		  return; // Error message already shown
		}
		
		// Use the stunned-adjusted cost for the rest of the function
		adjustedStaminaCost = stunnedResult.cost;
		
		if (staminaActor.system.stamina.value < adjustedStaminaCost) {
		  canAfford = false;
		  warningMessage += `Not enough Stamina (${staminaActor.system.stamina.value}/${adjustedStaminaCost})`;
		}
	  }

	  if (manaCost > 0) {
		const manaActor = linkedActor || actor;
		if (manaActor.system.mana?.value === undefined) {
		  ui.notifications.warn("Selected character doesn't have mana to spend!");
		  return;
		}
		if (manaActor.system.mana.value < manaCost) {
		  canAfford = false;
		  if (warningMessage) warningMessage += " and ";
		  warningMessage += `Not enough Mana (${manaActor.system.mana.value}/${manaCost})`;
		}
	  }

	  if (tacticsCost > 0) {
		// Tactics always come from the original actor (Lordling), not linked character
		const tacticsActor = actor;
		if (tacticsActor.system.tactics?.value === undefined) {
		  ui.notifications.warn(`Selected character (${tacticsActor.name}, type: ${tacticsActor.type}) doesn't have tactic points to spend!`);
		  return;
		}
		if (tacticsActor.system.tactics.value < tacticsCost) {
		  canAfford = false;
		  if (warningMessage) warningMessage += " and ";
		  warningMessage += `Not enough Tactic Points (${tacticsActor.system.tactics.value}/${tacticsCost})`;
		}
	  }

	  if (focusCost > 0) {
		const focusActor = linkedActor || actor;
		if (focusActor.system.focus?.value === undefined) {
		  ui.notifications.warn("Selected character doesn't have focus to spend!");
		  return;
		}
		if (focusActor.system.focus.value < focusCost) {
		  canAfford = false;
		  if (warningMessage) warningMessage += " and ";
		  warningMessage += `Not enough Focus (${focusActor.system.focus.value}/${focusCost})`;
		}
	  }

	  if (!canAfford) {
		ui.notifications.warn(`Not enough resources to spend! ${warningMessage}`);
		return;
	  }

	  // Handle overflow dialog for hexes
	  if (canOverflow) {
		const overflowAmount = await showOverflowDialog();
		
		if (overflowAmount === null) {
		  // User cancelled
		  return;
		}
		
		// If overflow amount is 0, undefined, or null, proceed with normal behavior
		if (overflowAmount > 0) {
		  const manaActor = linkedActor || actor;
		  // Check if actor has enough mana for overflow
		  if (manaActor.system.mana.value < manaCost + overflowAmount) {
			ui.notifications.warn(`Not enough Mana for overflow! Need ${manaCost + overflowAmount}, have ${manaActor.system.mana.value}`);
			return;
		  }
		  
		  // Spend resources with overflow - need to update multiple actors
		  const updates = {};
		  updates['system.mana.value'] = Math.max(0, manaActor.system.mana.value - manaCost - overflowAmount);
		  
		  let stunnedAdditionalCost = 0;
		  if (staminaCost > 0) {
			const staminaActor = linkedActor || actor;
			if (staminaActor.system.stamina?.value !== undefined) {
			  // Use the stunned-adjusted cost if we calculated it earlier
			  const finalStaminaCost = adjustedStaminaCost || staminaCost;
			  stunnedAdditionalCost = finalStaminaCost - staminaCost;
			  
			  updates['system.stamina.value'] = Math.max(0, staminaActor.system.stamina.value - finalStaminaCost);
			}
		  }
		  
		  if (focusCost > 0) {
			const focusActor = linkedActor || actor;
			if (focusActor.system.focus?.value !== undefined) {
			  updates['system.focus.value'] = Math.max(0, focusActor.system.focus.value - focusCost);
			}
		  }
		  
		  // Update the main actor (linked actor for stamina/mana/focus, or original actor)
		  const mainActor = linkedActor || actor;
		  mainActor.update(updates).then(async () => {
			// If tactics need to be spent from original actor, update separately
			if (tacticsCost > 0 && actor.system.tactics?.value !== undefined) {
			  const tacticsUpdates = {};
			  tacticsUpdates['system.tactics.value'] = Math.max(0, actor.system.tactics.value - tacticsCost);
			  await actor.update(tacticsUpdates);
			}
			ui.notifications.info(`Resources spent with overflow for ${actor.name}!`);
			button.disabled = true;
			button.textContent = "Resources Spent";
			
			// Remove stunned effect if additional stamina was spent
			if (stunnedAdditionalCost > 0) {
			  const { removeStunnedEffect } = await import('../conditions/stunned.mjs');
			  await removeStunnedEffect(actor, stunnedAdditionalCost);
			}
			
			// Create overflow chat message
			let messageContent;
			const resourceParts = [];
			if (staminaCost > 0) resourceParts.push(`${staminaCost} Stamina`);
			if (manaCost > 0) resourceParts.push(`${manaCost} Mana`);
			if (tacticsCost > 0) resourceParts.push(`${tacticsCost} Tactic Points`);
			
			if (resourceParts.length > 0) {
			  // For Lordlings, show which resources come from linked character
			  if (actor.type === 'lordling' && linkedActor) {
				const linkedResources = [];
				const lordlingResources = [];
				
				if (staminaCost > 0) linkedResources.push(`${staminaCost} Stamina`);
				if (manaCost > 0) linkedResources.push(`${manaCost} Mana`);
				if (tacticsCost > 0) lordlingResources.push(`${tacticsCost} Tactic Points`);
				
				let messageParts = [];
				if (linkedResources.length > 0) {
				  messageParts.push(`${actor.name} spent ${linkedResources.join(' and ')} from ${linkedActor.name}`);
				}
				if (lordlingResources.length > 0) {
				  messageParts.push(`${actor.name} spent ${lordlingResources.join(' and ')}`);
				}
				
				messageContent = messageParts.join(' and ') + ` and ${overflowAmount} Overflow Mana.`;
			  } else {
				messageContent = `${actor.name} spent ${resourceParts.join(' and ')} and ${overflowAmount} Overflow Mana.`;
			  }
			} else {
			  messageContent = `${actor.name} spent ${overflowAmount} Overflow Mana.`;
			}
			
			const chatData = {
			  user: game.user.id,
			  speaker: ChatMessage.getSpeaker({ actor: actor }),
			  content: messageContent,
			  type: CONST.CHAT_MESSAGE_TYPES.OTHER,
			  sound: CONFIG.sounds.notification,
			  flags: {
				core: {
				  canPopout: true
				}
			  }
			};
			
			chatData.content = `
			  <div style="background: url('systems/stryder/assets/parchment.jpg'); 
						  background-size: cover; 
						  padding: 15px; 
						  border: 1px solid #c9a66b; 
						  border-radius: 3px;">
				<h3 style="margin-top: 0; border-bottom: 1px solid #c9a66b;"><strong>Resource Expenditure</strong></h3>
				<p>${messageContent}</p>
			  </div>
			`;
			
			ChatMessage.create(chatData);
			
		  }).catch(err => {
			console.error("Error spending resources with overflow:", err);
			ui.notifications.error("Failed to spend resources with overflow!");
		  });
		  
		  return;
		}
	  }

	  // Prepare updates for different actors
	  const mainUpdates = {}; // For stamina/mana/focus (linked actor or original)
	  const tacticsUpdates = {}; // For tactics (always original actor)
	  let hasResources = false;
	  let stunnedAdditionalCost = 0;

	  if (staminaCost > 0) {
		const staminaActor = linkedActor || actor;
		if (staminaActor.system.stamina?.value !== undefined) {
		  // Use the stunned-adjusted cost if we calculated it earlier
		  const finalStaminaCost = adjustedStaminaCost || staminaCost;
		  stunnedAdditionalCost = finalStaminaCost - staminaCost;
		  
		  mainUpdates['system.stamina.value'] = Math.max(0, staminaActor.system.stamina.value - finalStaminaCost);
		  hasResources = true;
		}
	  }

	  if (manaCost > 0) {
		const manaActor = linkedActor || actor;
		if (manaActor.system.mana?.value !== undefined) {
		  mainUpdates['system.mana.value'] = Math.max(0, manaActor.system.mana.value - manaCost);
		  hasResources = true;
		}
	  }

	  if (tacticsCost > 0) {
		if (actor.system.tactics?.value !== undefined) {
		  tacticsUpdates['system.tactics.value'] = Math.max(0, actor.system.tactics.value - tacticsCost);
		  hasResources = true;
		}
	  }

	  if (focusCost > 0) {
		const focusActor = linkedActor || actor;
		if (focusActor.system.focus?.value !== undefined) {
		  mainUpdates['system.focus.value'] = Math.max(0, focusActor.system.focus.value - focusCost);
		  hasResources = true;
		}
	  }

	  // Apply updates if there are any
	  if (hasResources) {
		const mainActor = linkedActor || actor;
		const updatePromises = [];
		
		// Update main actor (stamina/mana/focus)
		if (Object.keys(mainUpdates).length > 0) {
		  updatePromises.push(mainActor.update(mainUpdates));
		}
		
		// Update original actor for tactics (if different from main actor)
		if (Object.keys(tacticsUpdates).length > 0) {
		  updatePromises.push(actor.update(tacticsUpdates));
		}
		
		Promise.all(updatePromises).then(async () => {
		  ui.notifications.info(`Resources spent for ${actor.name}!`);
		  // Disable the button after clicking
		  button.disabled = true;
		  button.textContent = "Resources Spent";
		  
		  // Remove stunned effect if additional stamina was spent
		  if (stunnedAdditionalCost > 0) {
			const { removeStunnedEffect } = await import('../conditions/stunned.mjs');
			await removeStunnedEffect(actor, stunnedAdditionalCost);
		  }
		  
		  // Create chat message content
		  let messageContent;
		  const resourceParts = [];
		  if (staminaCost > 0) resourceParts.push(`${staminaCost} Stamina`);
		  if (manaCost > 0) resourceParts.push(`${manaCost} Mana`);
		  if (tacticsCost > 0) resourceParts.push(`${tacticsCost} Tactic Points`);
		  if (focusCost > 0) resourceParts.push(`${focusCost} Focus`);
		  
		  if (resourceParts.length > 0) {
			// For Lordlings, show which resources come from linked character
			if (actor.type === 'lordling' && linkedActor) {
			  const linkedResources = [];
			  const lordlingResources = [];
			  
			  if (staminaCost > 0) linkedResources.push(`${staminaCost} Stamina`);
			  if (manaCost > 0) linkedResources.push(`${manaCost} Mana`);
			  if (focusCost > 0) linkedResources.push(`${focusCost} Focus`);
			  if (tacticsCost > 0) lordlingResources.push(`${tacticsCost} Tactic Points`);
			  
			  let messageParts = [];
			  if (linkedResources.length > 0) {
				messageParts.push(`${actor.name} spent ${linkedResources.join(' and ')} from ${linkedActor.name}`);
			  }
			  if (lordlingResources.length > 0) {
				messageParts.push(`${actor.name} spent ${lordlingResources.join(' and ')}`);
			  }
			  
			  messageContent = messageParts.join(' and ') + '.';
			} else {
			  messageContent = `${actor.name} spent ${resourceParts.join(' and ')}.`;
			}
		  } else {
			messageContent = `${actor.name} spent resources.`;
		  }
		  
		  // Create chat message
		  const chatData = {
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({ actor: actor }),
			content: messageContent,
			type: CONST.CHAT_MESSAGE_TYPES.OTHER,
			sound: CONFIG.sounds.notification,
			flags: {
			  core: {
				canPopout: true
			  }
			}
		  };
		  
		  chatData.content = `
			<div style="background: url('systems/stryder/assets/parchment.jpg'); 
						background-size: cover; 
						padding: 15px; 
						border: 1px solid #c9a66b; 
						border-radius: 3px;">
			  <h3 style="margin-top: 0; border-bottom: 1px solid #c9a66b;"><strong>Resource Expenditure</strong></h3>
			  <p>${messageContent}</p>
			</div>
		  `;
		  
		  ChatMessage.create(chatData);
		  
		}).catch(err => {
		  console.error("Error spending resources:", err);
		  ui.notifications.error("Failed to spend resources!");
		});
	  }
	}


	async function handleBloodlossSpend(event) {
	  event.preventDefault();
	  const button = event.currentTarget;
	  const bloodlossCost = parseInt(button.dataset.bloodlossCost) || 0;
	  const itemId = button.dataset.itemId;
	  
	  if (!itemId) {
		console.error("No item ID found for bloodloss button");
		return;
	  }
	  
	  // Get the currently controlled tokens
	  const controlledTokens = canvas.tokens.controlled;
	  
	  if (controlledTokens.length === 0) {
		ui.notifications.warn("No character selected! Please select a token first.");
		return;
	  }

	  const token = controlledTokens[0];
	  let actor = token.actor;
	  
	  if (!actor) {
		ui.notifications.error("Selected token has no associated actor!");
		return;
	  }

	  // Handle Lordling case
	  if (actor.type === 'lordling') {
		const linkedCharacterId = actor.system.linkedCharacterId;
		if (!linkedCharacterId) {
		  ui.notifications.warn("Lordling has no Linked Actor, so this action could not be performed!");
		  return;
		}
		
		const linkedActor = game.actors.get(linkedCharacterId);
		if (!linkedActor) {
		  ui.notifications.warn("Linked Actor not found!");
		  return;
		}
		actor = linkedActor; // Use linked actor instead
	  }
	  
	  // Get current bloodloss reduction
	  const currentBloodlossReduction = actor.getFlag(SYSTEM_ID, "bloodlossHealthReduction") || 0;
	  const newBloodlossReduction = currentBloodlossReduction + bloodlossCost;
	  
	  // Calculate what the new max HP would be
	  const currentMaxHP = actor.system.health.max;
	  const newMaxHP = currentMaxHP - bloodlossCost;
	  
	  if (newMaxHP <= 0) {
		ui.notifications.error(`${actor.name} cannot pay the bloodloss cost - it would reduce their maximum HP to ${newMaxHP} or below!`);
		return;
	  }
	  
	  // Update actor's bloodloss flag (the _calculateMaxHP function will handle the HP calculation)
	  await actor.update({
		[`flags.${SYSTEM_ID}.bloodlossHealthReduction`]: newBloodlossReduction
	  });
	  
	  // Send notification
	  const messageContent = `
	  <div class="chat-message-card">
		<div class="chat-message-header">
		  <h3 class="chat-message-title">${actor.name} paid <strong>${bloodlossCost}</strong> Bloodloss cost</h3>
		</div>
		
		<div class="chat-message-details">
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Maximum HP Lost:</span>
			<span class="chat-health-box">${bloodlossCost}</span>
		  </div>
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">New Maximum HP:</span>
			<span class="chat-health-box">${newMaxHP}</span>
		  </div>
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Total Bloodloss Reduction:</span>
			<span class="chat-health-box">${newBloodlossReduction}</span>
		  </div>
		</div>
	  </div>
	  `;

	  await ChatMessage.create({
		user: game.user.id,
		speaker: ChatMessage.getSpeaker({actor}),
		content: messageContent,
		type: CONST.CHAT_MESSAGE_TYPES.OTHER
	  });
	}

	Hooks.once('renderChatMessage', (message, html, data) => {
	  html.find('.resource-spend-button').click(handleResourceSpend);
	  html.find('.bloodloss-spend-button').click(handleBloodlossSpend);
	});

	let section1 = await createCollapsibleSection("Level 1 - Novice", item.system.novice);
	let section2 = await createCollapsibleSection("Level 2 - Journeyman", item.system.journeyman);
	let section3 = await createCollapsibleSection("Level 3 - Master", item.system.master);
	let section4 = await createCollapsibleSection("Profession Kit", item.system.extra);

	let contentHTMLprofession = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Level:</span>
		  <span>${professionLevel}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	  
	  ${section1}
	  ${section2}
	  ${section3}
	  ${section4}
	</div>
	`;

	let contentHTMLbonds = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details" style="text-align: center;">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Bond Level:</span>
		  <span>${bondLevel}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content" style="text-align: center;">
		${item.system.description ?? ''}
	  </div>
	  
	  <div style="font-size: 13px; color: #5c3a21; border-top: 1px solid #c0a070; padding-top: 10px; margin-top: 15px; display: flex; justify-content: space-around; gap: 10px; font-family: 'MedievalSharp', cursive;">
		<div><strong>Folk:</strong> ${bondFolk}</div>
		<div><strong>Gender:</strong> ${bondGender}</div>
		<div><strong>Age:</strong> ${bondAge}</div>
	  </div>
	</div>
	`;

	let fantasmActionType = getFantasmActionType(item);

	let contentHTMLfantasm = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Action:</span>
		  <span>${fantasmActionType}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cost:</span>
		  <span>1 Focus</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLaction = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
		${(tag1 || tag2 || tag3) ? `
		  <div class="chat-message-tags">
			${createTagHTML(tag1)}
			${createTagHTML(tag2)}
			${createTagHTML(tag3)}
		  </div>
		` : ''}
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Action:</span>
		  <span>${actionType}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cost:</span>
		  <span>${manacost}, ${staminacost}${othercost}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div><br />
	`;

	let contentHTMLarmament = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Form:</span>
		  <span>${armamentForm}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div><br />
	`;

	let contentHTMLgeneric = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
		${(tag1 || tag2 || tag3) ? `
		  <div class="chat-message-tags">
			${createTagHTML(tag1)}
			${createTagHTML(tag2)}
			${createTagHTML(tag3)}
		  </div>
		` : ''}
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Parent Ability:</span>
		  <span>${parentAbility}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Action:</span>
		  <span>${actionType}</span>
		</div>
		${range ? `
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Range:</span>
			<span>${range.replace('<strong>Range:</strong> ', '').replace('<br>', '')}</span>
		  </div>
		` : ''}
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cost:</span>
		  <span>${manacost}, ${staminacost}${othercost}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div><br />
	`;

	let contentHTMLpassive = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">Passive Ability</div>
	  </div>
	  
	  <div class="chat-message-content" style="text-align: center; font-style: italic;">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLmiscellaneous = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Type:</span>
		  <span>${miscellaneous_type}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLclassandfolk = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLloot = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Rarity:</span>
		  <span style="color: ${getRarityColor(rarity)}; font-weight: bold;">${rarity}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Value:</span>
		  <span>${sell_price}</span>
		</div>
	  </div
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLcomponent = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Grade:</span>
		  <span style="font-family: 'Cinzel Decorative'; font-weight: bold;">${grade_rank}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Value:</span>
		  <span>${sell_price}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLconsumable = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Rarity:</span>
		  <span style="color: ${getRarityColor(rarity)}; font-weight: bold;">${rarity}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Nature:</span>
		  <span>${nature}</span>
		</div>
		${charges ? `
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Charges:</span>
			<span>${charges.replace('<strong>Charges:</strong> ', '').replace('<br />', '')}</span>
		  </div>
		` : ''}
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Value:</span>
		  <span>${sell_price}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLgear = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Quality:</span>
		  <span style="font-weight: bold;">${quality}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Nature:</span>
		  <span>${nature}</span>
		</div>
		${charges ? `
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Charges:</span>
			<span>${charges.replace('<strong>Charges:</strong> ', '').replace('<br />', '')}</span>
		  </div>
		` : ''}
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Value:</span>
		  <span>${sell_price}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-details" style="margin-top: 15px; border-top: 1px dashed #c0a070; padding-top: 10px;">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Action:</span>
		  <span>${actionType}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cooldown:</span>
		  <span>${cooldown}</span>
		</div>
		${range ? `
		  <div class="chat-message-detail-row">
			<span class="chat-message-detail-label">Range:</span>
			<span>${range.replace('<strong>Range:</strong> ', '').replace('<br>', '')}</span>
		  </div>
		` : ''}
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Cost:</span>
		  <span>${manacost}, ${staminacost}${othercost}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	let contentHTMLaegiscore = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-content" style="text-align: center; font-style: italic;">
		${item.system.description ?? ''}
	  </div>
	</div>
	`;

	function getRarityColor(rarity) {
	  const colors = {
		common: '#7a7a7a',
		uncommon: '#2e8b57',
		rare: '#4169e1',
		legendary: '#d4af37',
		'one of a kind': '#008080'
	  };
	  return colors[rarity.toLowerCase()] || '#5c2b0a';
	}

	let contentHTMLlegacies = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Rarity:</span>
		  <span style="color: ${getRarityColor(rarity)}; font-weight: bold;">${rarity}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Nature:</span>
		  <span>${nature}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	  
	  <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #c0a070; font-size: 12px; color: #5c3a21; text-align: center;">
		<i class="fas fa-scroll"></i> Soul Item - Bound to Character's Soul
	  </div>
	</div>
	`;

	let contentHTMLequippable = `
	<div class="chat-message-card">
	  <div class="chat-message-header">
		<div style="text-align: center; margin-bottom: 10px;">
		  <img src="${item.img}" style="width: 50px; height: 50px; border: 2px solid #8b5a2b; border-radius: 50%; object-fit: cover; background: rgba(255, 248, 220, 0.8);">
		</div>
		<div class="chat-message-title">${item.name}</div>
		<div class="chat-message-subtitle">${itemType}</div>
	  </div>
	  
	  <div class="chat-message-details">
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Rarity:</span>
		  <span style="color: ${getRarityColor(rarity)}">${rarity}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Nature:</span>
		  <span>${nature}</span>
		</div>
		<div class="chat-message-detail-row">
		  <span class="chat-message-detail-label">Value:</span>
		  <span>${sell_price}</span>
		</div>
	  </div>
	  
	  <div class="chat-message-content">
		${item.system.description ?? ''}
	  </div>
	  
	  <div style="margin-top: 15px; padding: 8px; background: rgba(139, 90, 43, 0.1); border-radius: 4px; text-align: center; font-family: 'MedievalSharp', cursive; font-size: 14px;">
		<i class="fas fa-tshirt"></i> Equippable Item - ${getEquipmentSlot(item.type)}
	  </div>
	</div>
	`;

	function getEquipmentSlot(itemType) {
	  const slots = {
		head: "Head Slot",
		back: "Back Slot", 
		arms: "Arms Slot",
		legs: "Legs Slot",
		gems: "Gem Socket"
	  };
	  return slots[itemType] || "Equipment Slot";
	}

	Hooks.on("renderChatMessage", (message, html, data) => {
	  html[0].querySelectorAll(".collapsible-toggle").forEach(button => {
		button.addEventListener("click", () => {
		  const content = button.nextElementSibling;
		  if (content) {
			content.classList.toggle("hidden");
		  }
		});
	  });
	});

    // If there's no roll data, send a chat message.
		if (item.type === "feature" || item.type === "skill" || item.type === "technique") {
		  // Check uses for skills
		  if (item.type === "skill" && item.system.cooldown_value > 0) {
			// Initialize uses_current if it doesn't exist
			if (item.system.uses_current === undefined || item.system.uses_current === null) {
			  await item.update({'system.uses_current': item.system.cooldown_value});
			  console.log(`Initialized skill ${item.name}: uses_current set to ${item.system.cooldown_value}`);
			}
			
			const currentUses = item.system.uses_current;
			console.log(`Skill ${item.name}: currentUses=${currentUses}, cooldown_value=${item.system.cooldown_value}`);
			if (currentUses <= 0) {
			  ui.notifications.error("This ability has been used the maximum number of times!");
			  return;
			}
			// Decrement uses
			const newUses = Math.max(0, currentUses - 1);
			await item.update({'system.uses_current': newUses});
		  }
		  
		  const resourceButton = createResourceSpendButton(item);
		  const bloodlossButton = createBloodlossSpendButton(item);

		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			flavor: contentHTML + resourceButton + bloodlossButton,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'utility'
				}
		  });
		}
		// Handle the case where item.type is "hex"
		else if (item.type === "hex_old") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLhex
		  });
		}
		else if (item.type === "hex") {
			// Retrieve the necessary properties to construct the roll formula.
			const diceNum = item.system.roll.diceNum;
			const diceSize = item.system.roll.diceSize;
			const diceBonus = item.system.roll.diceBonus;

			const resourceButton = createResourceSpendButton(item);
			const bloodlossButton = createBloodlossSpendButton(item);

			// Check if alwaysRolls12 is enabled and modify formula accordingly
			let formula;
			let roll;
			
			if (item.system.hex.alwaysRollsTwelve) {
				// Force the roll to always be 12 (6+6 for 2d6)
				formula = "2d6";
				roll = new Roll(formula);
				
				// Manually set the dice results to show 6, 6 for visual consistency
				roll.terms = [new Die({number: 2, faces: 6, results: [
					{result: 6, active: true},
					{result: 6, active: true}
				]})];
				
				// Recalculate the total after setting the dice results
				roll._total = 12;
				roll._evaluated = true;
			} else {
				// Construct the roll formula normally.
				formula = `${diceNum}d${diceSize}` + (diceBonus ? `+${diceBonus}` : '');
				roll = new Roll(formula);
				await roll.evaluate({async: true}); // Evaluate the roll asynchronously.
			}

			// Send the result of the roll to the chat.
			roll.toMessage({
				speaker: speaker,
				flavor: contentHTMLhex + resourceButton + bloodlossButton,
				rollMode: rollMode,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'attack'
				}
			});

			// If rollsQuality is true, proceed with quality messages.
			if (item.system.hex.rollsQuality) {
				let result = roll.total;
				let quality, damageMultiplier;
				
				// Check if alwaysRollsTwelve is true and create special message
				if (item.system.hex.alwaysRollsTwelve) {
					quality = "Excellent";
					damageMultiplier = 1.5;
					
					if (!item.actor || !item.actor.system.abilities.Arcana) {
						console.error("Actor or Arcana ability not found for this item.");
						return;
					}

					const panickedPrefix = isActorPanicked(item.actor) ? `<strong>${item.actor.name} is Panicked!</strong> ` : "";
					
					// Check if damage should also be rolled
					if (item.system.hex.rollsDamage) {
						let arcanaValue = item.actor.system.abilities.Arcana.value;
						let masteryBonus = item.system.hex.addsMastery ? item.actor.system.attributes.mastery : 0;
						let baseDamage = Math.ceil(arcanaValue * damageMultiplier);
						const totalDamage = baseDamage + masteryBonus;

						const hasPierce = item.system.tag1 === 'pierce' || item.system.tag2 === 'pierce' || item.system.tag3 === 'pierce';
						const damageButton = createDamageButton(totalDamage, item.system.damage_type || 'magykal', hasPierce);
						const combinedMessage = `
						<div style="margin-bottom: 5px;">
							<div class="hex-quality-message" style="
							  background: rgba(75, 0, 130, 0.15);
							  border: 1px solid #4b0082;
							  border-radius: 5px;
							  padding: 8px 12px;
							  margin-bottom: 5px;
							  text-align: center;
							  font-family: 'Cinzel Decorative', cursive;
							  color: #4b0082;
							  text-shadow: 0 0 3px rgba(255, 255, 255, 0.5);
							">
							  <strong>Always Rolls a Twelve</strong> - Hex evoked at maximum efficiency.
							</div>
							<div class="damage-quality excellent">
							  ${panickedPrefix}You casted a <strong>${quality} Hex!</strong> If the Hex deals damage, you did <strong>${totalDamage}</strong> damage.
							</div>
							${damageButton}
						</div>
						`;
						
						ChatMessage.create({
							speaker: speaker,
							content: combinedMessage,
							whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
						});
					} else {
						// Only show quality, no damage
						const qualityMessage = `
						<div style="margin-bottom: 5px;">
							<div class="hex-quality-message" style="
							  background: rgba(75, 0, 130, 0.15);
							  border: 1px solid #4b0082;
							  border-radius: 5px;
							  padding: 8px 12px;
							  margin-bottom: 5px;
							  text-align: center;
							  font-family: 'Cinzel Decorative', cursive;
							  color: #4b0082;
							  text-shadow: 0 0 3px rgba(255, 255, 255, 0.5);
							">
							  <strong>Always Rolls a Twelve</strong> - Hex evoked at maximum efficiency.
							</div>
							<div class="damage-quality excellent">
							  ${panickedPrefix}You casted a <strong>${quality} Hex!</strong>
							</div>
						</div>
						`;
						
						ChatMessage.create({
							speaker: speaker,
							content: qualityMessage,
							whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
						});
					}
					return;
				}
				
				// Check if alwaysRollsExcellent is true
				if (item.system.hex.alwaysRollsExcellent) {
					quality = "Excellent";
					damageMultiplier = 1.5;
					
					if (!item.actor || !item.actor.system.abilities.Arcana) {
						console.error("Actor or Arcana ability not found for this item.");
						return;
					}

					// Check if damage should also be rolled
					if (item.system.hex.rollsDamage) {
						let arcanaValue = item.actor.system.abilities.Arcana.value;
						let masteryBonus = item.system.hex.addsMastery ? item.actor.system.attributes.mastery : 0;
						let baseDamage = Math.ceil(arcanaValue * damageMultiplier);
						const totalDamage = baseDamage + masteryBonus;

						const hasPierce = item.system.tag1 === 'pierce' || item.system.tag2 === 'pierce' || item.system.tag3 === 'pierce';
						const damageButton = createDamageButton(totalDamage, item.system.damage_type || 'magykal', hasPierce);
						const combinedMessage = `
						<div style="margin-bottom: 5px;">
							<div class="hex-quality-message" style="
							  background: rgba(75, 0, 130, 0.15);
							  border: 1px solid #4b0082;
							  border-radius: 5px;
							  padding: 8px 12px;
							  margin-bottom: 5px;
							  text-align: center;
							  font-family: 'Cinzel Decorative', cursive;
							  color: #4b0082;
							  text-shadow: 0 0 3px rgba(255, 255, 255, 0.5);
							">
							  <strong>Always Excellent Hex</strong> - Perfect execution guaranteed.
							</div>
							<div class="damage-quality excellent">
							  You casted a <strong>${quality} Hex!</strong> If the Hex deals damage, you did <strong>${totalDamage}</strong> damage.
							</div>
							${damageButton}
						</div>
						`;
						
						ChatMessage.create({
							speaker: speaker,
							content: combinedMessage,
							whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
						});
					} else {
						// Only show quality, no damage
						const qualityMessage = `
						<div style="margin-bottom: 5px;">
							<div class="hex-quality-message" style="
							  background: rgba(75, 0, 130, 0.15);
							  border: 1px solid #4b0082;
							  border-radius: 5px;
							  padding: 8px 12px;
							  margin-bottom: 5px;
							  text-align: center;
							  font-family: 'Cinzel Decorative', cursive;
							  color: #4b0082;
							  text-shadow: 0 0 3px rgba(255, 255, 255, 0.5);
							">
							  <strong>Always Excellent Hex</strong> - Perfect execution guaranteed.
							</div>
							<div class="damage-quality excellent">
							  You casted a <strong>${quality} Hex!</strong>
							</div>
						</div>
						`;
						
						ChatMessage.create({
							speaker: speaker,
							content: qualityMessage,
							whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
						});
					}
				} else {
					// Determine quality based on roll result
					// Check if actor is horrified first (horrified overrides everything)
					if (isActorHorrified(item.actor)) {
						const horrifiedQuality = getHorrifiedRollQuality(result, "hex", item.system);
						if (horrifiedQuality) {
							quality = horrifiedQuality.quality;
							damageMultiplier = horrifiedQuality.damageMultiplier;
						} else {
							// Hex doesn't roll damage, use normal logic
							if (result <= 4) {
								quality = "Poor";
								damageMultiplier = 0.5;
							} else if (result >= 5 && result <= 10) {
								quality = "Good";
								damageMultiplier = 1.0;
							} else if (result >= 11) {
								quality = "Excellent";
								damageMultiplier = 1.5;
							}
						}
					} else if (isActorPanicked(item.actor)) {
						// Check if actor is panicked and apply panicked quality logic
						const panickedQuality = getPanickedRollQuality(result, "hex", item.system);
						if (panickedQuality) {
							quality = panickedQuality.quality;
							damageMultiplier = panickedQuality.damageMultiplier;
						} else {
							// Hex doesn't roll damage, use normal logic
							if (result <= 4) {
								quality = "Poor";
								damageMultiplier = 0.5;
							} else if (result >= 5 && result <= 10) {
								quality = "Good";
								damageMultiplier = 1.0;
							} else if (result >= 11) {
								quality = "Excellent";
								damageMultiplier = 1.5;
							}
						}
					} else {
						// Normal quality logic
						if (result <= 4) {
							quality = "Poor";
							damageMultiplier = 0.5;
						} else if (result >= 5 && result <= 10) {
							quality = "Good";
							damageMultiplier = 1.0;
						} else if (result >= 11) {
							quality = "Excellent";
							damageMultiplier = 1.5;
						}
					}

					if (!item.actor || !item.actor.system.abilities.Arcana) {
						console.error("Actor or Arcana ability not found for this item.");
						return;
					}

					const horrifiedPrefix = isActorHorrified(item.actor) ? `<strong>${item.actor.name} is Horrified!</strong> ` : "";
					const panickedPrefix = isActorPanicked(item.actor) ? `<strong>${item.actor.name} is Panicked!</strong> ` : "";
					const statusPrefix = horrifiedPrefix || panickedPrefix;
					
					// Check if damage should also be rolled
					if (item.system.hex.rollsDamage) {
						let arcanaValue = item.actor.system.abilities.Arcana.value;
						let masteryBonus = item.system.hex.addsMastery ? item.actor.system.attributes.mastery : 0;
						let baseDamage = Math.floor(arcanaValue * damageMultiplier);
						if (quality === "Excellent") {
							baseDamage = Math.ceil(arcanaValue * damageMultiplier);
						}
						const totalDamage = baseDamage + masteryBonus;

						const hasPierce = item.system.tag1 === 'pierce' || item.system.tag2 === 'pierce' || item.system.tag3 === 'pierce';
						const damageButton = createDamageButton(totalDamage, item.system.damage_type || 'magykal', hasPierce);
						const qualityMessage = `
						<div class="damage-quality ${quality.toLowerCase()}">
						  ${statusPrefix}You casted a <strong>${quality} Hex!</strong> If the Hex deals damage, you did <strong>${totalDamage}</strong> damage.
						</div>
						${damageButton}
						`;
						ChatMessage.create({
							speaker: speaker,
							content: qualityMessage,
							whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
						});
					} else {
						// Only show quality, no damage
						const qualityMessage = `
						<div class="damage-quality ${quality.toLowerCase()}">
						  ${statusPrefix}You casted a <strong>${quality} Hex!</strong>
						</div>
						`;
						ChatMessage.create({
							speaker: speaker,
							content: qualityMessage,
							whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
						});
					}
				}
			}

			// Return the roll object for further processing if necessary.
			return roll;
		}
		else if (item.type === "passive") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			flavor: contentHTMLpassive,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'utility'
				}
		  });
		}
		else if (item.type === "miscellaneous") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			flavor: contentHTMLmiscellaneous
		  });
		}
		else if (item.type === "class" || item.type === "folk") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			flavor: contentHTMLclassandfolk
		  });
		}
		else if (item.type === "racial") {
		  // Check uses for folk abilities
		  if (item.system.cooldown_value > 0) {
			// Initialize uses_current if it doesn't exist
			if (item.system.uses_current === undefined || item.system.uses_current === null) {
			  await item.update({'system.uses_current': item.system.cooldown_value});
			  console.log(`Initialized racial ${item.name}: uses_current set to ${item.system.cooldown_value}`);
			}

			const currentUses = item.system.uses_current;
			console.log(`Racial ${item.name}: currentUses=${currentUses}, cooldown_value=${item.system.cooldown_value}`);
			if (currentUses <= 0) {
			  ui.notifications.error("This ability has been used the maximum number of times!");
			  return;
			}
			// Decrement uses
			const newUses = Math.max(0, currentUses - 1);
			await item.update({'system.uses_current': newUses});
		  }

		  const resourceButton = createResourceSpendButton(item);
		  const bloodlossButton = createBloodlossSpendButton(item);

		  if (item.system.isAttack) {
			// Roll as an attack, similar to Generic Attacks
			const actor = item.actor;
			if (!actor) {
				console.error("No actor associated with this item:", item);
				return;
			}

			const diceNum = item.system.roll?.diceNum || 2;
			const diceSize = item.system.roll?.diceSize || 6;
			let diceBonus = item.system.roll?.diceBonus || 0;

			if (typeof diceBonus === 'string' && isNaN(parseInt(diceBonus))) {
				const attributeMapping = {
					mastery: "attributes.mastery",
					soul: "abilities.Soul.value",
					reflex: "abilities.Reflex.value",
					grit: "abilities.Grit.value",
					arcana: "abilities.Arcana.value",
					intuition: "abilities.Intuition.value",
					will: "abilities.Will.value"
				};
				const attributePath = attributeMapping[diceBonus] || `attributes.talent.${diceBonus}.value`;
				const attributeValue = getProperty(actor.system, attributePath);
				diceBonus = attributeValue !== undefined ? attributeValue : 0;
			} else {
				diceBonus = parseInt(diceBonus) || 0;
			}

			const formula = `${diceNum}d${diceSize}` + (diceBonus ? `+${diceBonus}` : '');
			const roll = new Roll(formula);
			await roll.evaluate({async: true});
			roll.toMessage({
				speaker: speaker,
				flavor: contentHTMLracial + resourceButton + bloodlossButton,
				rollMode: rollMode,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'attack'
				}
			});

			let result = roll.total;
			let quality;
			let damageMultiplier;

			if (isActorHorrified(actor)) {
				const horrifiedQuality = getHorrifiedRollQuality(result, "generic", item.system);
				quality = horrifiedQuality.quality;
				damageMultiplier = horrifiedQuality.damageMultiplier;
			} else if (isActorPanicked(actor)) {
				const panickedQuality = getPanickedRollQuality(result, "generic", item.system);
				quality = panickedQuality.quality;
				damageMultiplier = panickedQuality.damageMultiplier;
			} else {
				if (result <= 4) {
					quality = "Poor";
					damageMultiplier = 0.5;
				} else if (result >= 5 && result <= 10) {
					quality = "Good";
					damageMultiplier = 1.0;
				} else if (result >= 11) {
					quality = "Excellent";
					damageMultiplier = 1.5;
				}
			}

			let totalDamage;
			// Use custom damage values if provided
			const customVal = item.system.customDamage?.[quality.toLowerCase()];
			if (customVal !== null && customVal !== undefined && customVal !== "") {
				totalDamage = parseInt(customVal);
			} else {
				// Fallback: use Soul for Physical, Arcana for Magykal
				let powerValue = 0;
				const racialDamageType = item.system.damage_type;
				if (racialDamageType === 'physical') {
					powerValue = actor.system.abilities?.Soul?.value || 0;
				} else if (racialDamageType === 'magykal') {
					powerValue = actor.system.abilities?.Arcana?.value || 0;
				}
				if (quality === "Excellent") {
					totalDamage = Math.ceil(powerValue * damageMultiplier);
				} else {
					totalDamage = Math.floor(powerValue * damageMultiplier);
				}
			}

			const horrifiedPrefix = isActorHorrified(actor) ? `<strong>${actor.name} is Horrified!</strong> ` : "";
			const panickedPrefix = isActorPanicked(actor) ? `<strong>${actor.name} is Panicked!</strong> ` : "";
			const statusPrefix = horrifiedPrefix || panickedPrefix;
			const hasPierce = item.system.tag1 === 'pierce' || item.system.tag2 === 'pierce' || item.system.tag3 === 'pierce';
			const damageButton = createDamageButton(totalDamage, item.system.damage_type || 'physical', hasPierce);
			const qualityMessage = `
			<div class="damage-quality ${quality.toLowerCase()}">
			  ${statusPrefix}<strong>${quality} Attack!</strong> The attack did <strong>${totalDamage}</strong> damage.
			</div>
			${damageButton}
			`;
			ChatMessage.create({
				speaker: speaker,
				content: qualityMessage,
				whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
			});

			return roll;
		  } else {
			// Normal non-attack folk ability
			ChatMessage.create({
				speaker: speaker,
				rollMode: rollMode,
				flavor: contentHTMLracial + resourceButton + bloodlossButton,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'utility'
				}
			});
		  }
		}
		else if (item.type === "statperk") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLstat
		  });
		}
		else if (item.type === "profession") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLprofession
		  });
		}
		else if (item.type === "bonds") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLbonds
		  });
		}
		else if (item.type === "fantasm") {
		  const resourceButton = createResourceSpendButton(item);
		  const bloodlossButton = createBloodlossSpendButton(item);
		  
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLfantasm + resourceButton + bloodlossButton,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'utility'
				}
		  });
		}
		else if (item.type === "loot") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLloot
		  });
		}
		else if (item.type === "component") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLcomponent
		  });
		}
		else if (item.type === "consumable") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLconsumable,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'utility'
				}
		  });
		}
		else if (item.type === "gear") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLgear
		  });
		}
		else if (item.type === "aegiscore") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLaegiscore
		  });
		}
		else if (item.type === "legacies") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLlegacies
		  });
		}
		else if (item.type === "head" || item.type === "back" || item.type === "arms" || item.type === "legs" || item.type === "gems") {
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: contentHTMLequippable
		  });
		}
		else if (item.type === "action") {
		  // Check limit
		  const actionLimitMax = item.system.limit?.max || 0;
		  if (actionLimitMax > 0) {
			const actionLimitValue = item.system.limit?.value || 0;
			if (actionLimitValue >= actionLimitMax) {
			  return ui.notifications.warn(`${item.name} has reached its limit of ${actionLimitMax} uses!`);
			}
			await item.update({'system.limit.value': actionLimitValue + 1});
		  }

		  const diceNum = item.system.roll.diceNum;
		  const diceSize = item.system.roll.diceSize;
		  let diceBonus = item.system.roll.diceBonus;

		  const resourceButton = createResourceSpendButton(item);
		  const bloodlossButton = createBloodlossSpendButton(item);

		  const shouldSkipRoll = !diceNum || diceNum === 0;

		  if (shouldSkipRoll) {
			const cleanedContent = contentHTMLaction.replace(/<br \/>$/, '');
			
			ChatMessage.create({
			  speaker: speaker,
			  rollMode: rollMode,
			  content: cleanedContent + resourceButton + bloodlossButton,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'utility'
				}
			});
			return;
		  }

		  const actor = game.actors.get(speaker.actor);

		  if (actor) {
			if (isNaN(diceBonus) && typeof diceBonus === 'string') {
			  let attributePath;
			  if (diceBonus === "mastery") {
				attributePath = "attributes.mastery";
			  } else if (diceBonus === "might" || diceBonus === "magyk" || diceBonus === "speed" || diceBonus === "instinct") {
				attributePath = `abilities.${diceBonus}.value`;
			  } else if (diceBonus === "soul") {
				attributePath = `abilities.Soul.value`;
			  } else if (diceBonus === "reflex") {
				attributePath = `abilities.Reflex.value`;
			  } else if (diceBonus === "grit") {
				attributePath = `abilities.Grit.value`;
			  } else if (diceBonus === "arcana") {
				attributePath = `abilities.Arcana.value`;
			  } else if (diceBonus === "intuition") {
				attributePath = `abilities.Intuition.value`;
			  } else if (diceBonus === "will") {
				attributePath = `abilities.Will.value`;
			  } else {
				attributePath = `attributes.talent.${diceBonus}.value`;
			  }

			  const attributeValue = getProperty(actor.system, attributePath);

			  if (attributeValue !== undefined) {
				diceBonus = attributeValue;
			  } else {
				console.error(`Attribute ${diceBonus} not found on actor. Path tried: ${attributePath}`);
				console.log(`Actor system object:`, actor.system);
				diceBonus = 0;
			  }
			}
		  } else {
			console.error("Actor not found for the speaker with ID:", speaker.actor);
			diceBonus = 0;
		  }

		  // Apply reflex tag bonus if the item has the reflex tag
		  const hasReflexTagAction = item.system.hasReflexTag || item.system.tag1 === 'reflex' || item.system.tag2 === 'reflex' || item.system.tag3 === 'reflex';
		  let reflexTagBonusAction = 0;
		  if (hasReflexTagAction && actor) {
			reflexTagBonusAction = actor.system.reflex_tag?.bonus || 0;
		  }
		  const totalActionBonus = diceBonus + reflexTagBonusAction;

		  const formula = `${diceNum}d${diceSize}` + (totalActionBonus ? `+${totalActionBonus}` : '');
		  const roll = new Roll(formula);
		  await roll.evaluate({async: true});
		  roll.toMessage({
			speaker: speaker,
			flavor: contentHTMLaction.replace(/<br \/>$/, '') + resourceButton + bloodlossButton, // Remove last <br /> here too
			rollMode: rollMode
		  });

		  return roll;
		}
		else if (item.type === "armament") {
			// Retrieve the necessary properties to construct the roll formula.
			const diceNum = item.system.roll.diceNum;
			const diceSize = item.system.roll.diceSize;
			const diceBonus = item.system.roll.diceBonus;
			const baseDamageAmp = item.system.roll.baseDamageAmp || 0;
			const rawDamageAmp = item.system.roll.rawDamageAmp || 0;

			const actor = item.actor || game.actors.get(speaker.actor) || null;
			if (!actor) {
				console.error("No actor found for armament:", item);
				return;
			}

			const token = actor.token || canvas.tokens.get(speaker.token) || null;

			// Construct the roll formula.
			const formula = `${diceNum}d${diceSize}` + (diceBonus ? `+${diceBonus}` : '');

			// Create the roll using the constructed formula.
			const roll = new Roll(formula);
			await roll.evaluate({async: true}); // Evaluate the roll asynchronously.

			// Send the result of the roll to the chat.
			roll.toMessage({
				speaker: speaker,
				flavor: contentHTMLarmament,
				rollMode: rollMode,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'attack'
				}
			});

			// Determine the quality of the roll based on the total, unless alwaysRollsExcellent is true
			let result = roll.total;
			let quality;
			let damageMultiplier;
			if (item.system.armament.alwaysRollsExcellent) {
				quality = "Excellent";
				damageMultiplier = 1.5;
			} else {
				// Check if actor is horrified first (horrified overrides everything)
				if (isActorHorrified(actor)) {
					const horrifiedQuality = getHorrifiedRollQuality(result, "armament", item.system);
					quality = horrifiedQuality.quality;
					damageMultiplier = horrifiedQuality.damageMultiplier;
				} else if (isActorPanicked(actor)) {
					// Check if actor is panicked and apply panicked quality logic
					const panickedQuality = getPanickedRollQuality(result, "armament", item.system);
					quality = panickedQuality.quality;
					damageMultiplier = panickedQuality.damageMultiplier;
				} else {
					// Normal quality logic
					if (result <= 4) {
						quality = "Poor";
						damageMultiplier = 0.5;
					} else if (result >= 5 && result <= 10) {
						quality = "Good";
						damageMultiplier = 1.0;
					} else if (result >= 11) {
						quality = "Excellent";
						damageMultiplier = 1.5;
					}
				}
			}

			if (!item.actor || (!item.actor.system.abilities.Power && !item.actor.system.abilities.Arcana)) {
				console.error("Actor or necessary abilities not found for this item.");
				return;
			}

			// Validate if armament is a Witchblade to choose the correct ability
			const abilityType = item.system.armament.isWitchblade ? "Arcana" : "Soul";
			const abilityValue = item.actor.system.abilities[abilityType].value;

			let baseDamage;
			const adjustedPower = abilityValue + baseDamageAmp; // Add baseDamageAmp before multiplier
			if (quality === "Poor") {
				baseDamage = Math.floor(adjustedPower * damageMultiplier);
			} else if (quality === "Excellent") {
				baseDamage = Math.ceil(adjustedPower * damageMultiplier);
			} else {
				baseDamage = Math.floor(adjustedPower * damageMultiplier);
			}

			// Add mastery bonus if applicable
			const masteryBonus = item.system.armament.addsMastery ? item.actor.system.attributes.mastery : 0;
			const totalDamage = baseDamage + rawDamageAmp + masteryBonus; // Add rawDamageAmp and mastery bonus after multiplier

			// Create follow-up chat message with damage button
			const horrifiedPrefix = isActorHorrified(actor) ? `<strong>${actor.name} is Horrified!</strong> ` : "";
			const panickedPrefix = isActorPanicked(actor) ? `<strong>${actor.name} is Panicked!</strong> ` : "";
			const statusPrefix = horrifiedPrefix || panickedPrefix;
			const hasPierce = item.system.tag1 === 'pierce' || item.system.tag2 === 'pierce' || item.system.tag3 === 'pierce';
			const damageButton = createDamageButton(totalDamage, item.system.damage_type || 'physical', hasPierce);
			const qualityMessage = `
			<div class="damage-quality ${quality.toLowerCase()}">
			  ${statusPrefix}<strong>${quality} Attack!</strong> The attack did <strong>${totalDamage}</strong> damage.
			</div>
			${damageButton}
			`;
			ChatMessage.create({
				speaker: speaker,
				content: qualityMessage,
				whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
			});

			// Return the roll object for further processing if necessary
			return roll;
		}
		else if (item.type === "generic") {
			// Check limit
			const genericLimitMax = item.system.limit?.max || 0;
			if (genericLimitMax > 0) {
				const genericLimitValue = item.system.limit?.value || 0;
				if (genericLimitValue >= genericLimitMax) {
					return ui.notifications.warn(`${item.name} has reached its limit of ${genericLimitMax} uses!`);
				}
				await item.update({'system.limit.value': genericLimitValue + 1});
			}

			const diceNum = item.system.roll.diceNum;
			const diceSize = item.system.roll.diceSize;
			let diceBonus = item.system.roll.diceBonus;
			const baseDamageAmp = item.system.roll.baseDamageAmp || 0;
			const rawDamageAmp = item.system.roll.rawDamageAmp || 0;

			const resourceButton = createResourceSpendButton(item);
			const bloodlossButton = createBloodlossSpendButton(item);

			const actor = item.actor;
			if (!actor) {
				console.error("No actor associated with this item:", item);
				return;
			}

			if (typeof diceBonus === 'string' && isNaN(parseInt(diceBonus))) {
				let attributePath;
				const attributeMapping = {
					mastery: "attributes.mastery",
					might: "abilities.might.value",
					magyk: "abilities.magyk.value",
					speed: "abilities.speed.value",
					instinct: "abilities.instinct.value",
					soul: "abilities.Soul.value",
					reflex: "abilities.Reflex.value",
					grit: "abilities.Grit.value",
					arcana: "abilities.Arcana.value",
					intuition: "abilities.Intuition.value",
					will: "abilities.Will.value"
				};

				attributePath = attributeMapping[diceBonus] || `attributes.talent.${diceBonus}.value`;

				const attributeValue = getProperty(actor.system, attributePath);
				diceBonus = attributeValue !== undefined ? attributeValue : 0;
				if (attributeValue === undefined) {
					console.error(`Attribute ${diceBonus} not found on actor. Path tried: ${attributePath}`);
					console.log(`Actor system object:`, actor.system);
				}
			} else {
				diceBonus = parseInt(diceBonus) || 0;
			}

			// Apply reflex tag bonus if the item has the reflex tag
			const hasReflexTagGeneric = item.system.hasReflexTag || item.system.tag1 === 'reflex' || item.system.tag2 === 'reflex' || item.system.tag3 === 'reflex';
			let reflexTagBonusGeneric = 0;
			if (hasReflexTagGeneric && actor) {
				reflexTagBonusGeneric = actor.system.reflex_tag?.bonus || 0;
			}
			const totalGenericBonus = diceBonus + reflexTagBonusGeneric;

			const formula = `${diceNum}d${diceSize}` + (totalGenericBonus ? `+${totalGenericBonus}` : '');
			const roll = new Roll(formula);
			await roll.evaluate({async: true});
			roll.toMessage({
				speaker: speaker,
				flavor: contentHTMLgeneric + resourceButton + bloodlossButton,
				rollMode: rollMode,
				flags: {
					'stryder.itemId': item.id,
					'stryder.rollType': 'attack'
				}
			});

			let result = roll.total;
			let quality;
			let damageMultiplier;
			
			// Check if actor is horrified first (horrified overrides everything)
			if (isActorHorrified(actor)) {
				const horrifiedQuality = getHorrifiedRollQuality(result, "generic", item.system);
				quality = horrifiedQuality.quality;
				damageMultiplier = horrifiedQuality.damageMultiplier;
			} else if (isActorPanicked(actor)) {
				// Check if actor is panicked and apply panicked quality logic
				const panickedQuality = getPanickedRollQuality(result, "generic", item.system);
				quality = panickedQuality.quality;
				damageMultiplier = panickedQuality.damageMultiplier;
			} else {
				// Normal quality logic
				if (result <= 4) {
					quality = "Poor";
					damageMultiplier = 0.5;
				} else if (result >= 5 && result <= 10) {
					quality = "Good";
					damageMultiplier = 1.0;
				} else if (result >= 11) {
					quality = "Excellent";
					damageMultiplier = 1.5;
				}
			}

			let totalDamage;
			// Use Soul for Physical damage, Arcana for Magykal damage
			let powerValue = 0;
			const genericDamageType = item.system.damage_type;
			if (genericDamageType === 'physical') {
				powerValue = actor.system.abilities?.Soul?.value || 0;
			} else if (genericDamageType === 'magykal') {
				powerValue = actor.system.abilities?.Arcana?.value || 0;
			}
			if (item.system.enableCustomDamage && item.system.customDamage[quality.toLowerCase()] !== null && item.system.customDamage[quality.toLowerCase()] !== undefined && item.system.customDamage[quality.toLowerCase()] !== "") {
				totalDamage = parseInt(item.system.customDamage[quality.toLowerCase()]);
			} else {
				const adjustedPower = powerValue + baseDamageAmp;
				if (quality === "Excellent") {
					totalDamage = Math.ceil(adjustedPower * damageMultiplier);
				} else {
					totalDamage = Math.floor(adjustedPower * damageMultiplier);
				}
			}
			totalDamage += rawDamageAmp;

			const horrifiedPrefix = isActorHorrified(actor) ? `<strong>${actor.name} is Horrified!</strong> ` : "";
			const panickedPrefix = isActorPanicked(actor) ? `<strong>${actor.name} is Panicked!</strong> ` : "";
			const statusPrefix = horrifiedPrefix || panickedPrefix;
			const hasPierce = item.system.tag1 === 'pierce' || item.system.tag2 === 'pierce' || item.system.tag3 === 'pierce';
			const damageButton = createDamageButton(totalDamage, item.system.damage_type || 'ahl', hasPierce);
			const qualityMessage = `
			<div class="damage-quality ${quality.toLowerCase()}">
			  ${statusPrefix}<strong>${quality} Attack!</strong> The attack did <strong>${totalDamage}</strong> damage.
			</div>
			${damageButton}
			`;
			ChatMessage.create({
				speaker: speaker,
				content: qualityMessage,
				whisper: rollMode === "blindroll" ? ChatMessage.getWhisperRecipients("GM") : []
			});

			return roll;
		}
		// Handle all other cases that don't match the above conditions
		else {
		  // This could be a default action or error handling
		  console.log("Unhandled item type:", item.type);
		  // Optionally, you can create a generic chat message or take no action
		  ChatMessage.create({
			speaker: speaker,
			rollMode: rollMode,
			content: "An item of an unspecified type was used."
		  });
		}
  }
}

// Damage application handler - moved outside class for export
async function handleDamageApply(event) {
  event.preventDefault();
  const button = event.currentTarget;
  const damage = parseInt(button.dataset.damage) || 0;
  const damageType = button.dataset.damageType || 'ahl'; // Default to ahl if not specified
  const hasPierce = button.dataset.hasPierce === 'true'; // Check if Pierce tag is present
  
  if (damage < 0) {
	console.error("Invalid damage amount:", damage);
	return;
  }
  
  // Get the currently controlled tokens
  const controlledTokens = canvas.tokens.controlled;
  let targetActors = [];
  
  if (controlledTokens.length > 0) {
	// Use all controlled tokens
	targetActors = controlledTokens.map(token => token.actor).filter(actor => actor);
  } else {
	// Check if user has a player character selected in Foundry user configuration
	const userCharacter = game.user.character;
	if (userCharacter) {
	  targetActors = [userCharacter];
	} else {
	  ui.notifications.error("Please select an Actor to damage!");
	  return;
	}
  }
  
  if (targetActors.length === 0) {
	ui.notifications.error("No valid targets found!");
	return;
  }
  
  // Process damage for all target actors
  const damageResults = [];
  const actorUpdates = [];
  
  for (const targetActor of targetActors) {
	// Calculate damage reduction based on damage type
	let finalDamage = damage;
	let reductionAmount = 0;
	let reductionType = '';
	
	if (damageType === 'physical') {
	  reductionAmount = targetActor.system.physical_reduction || 0;
	  reductionType = 'Physical';
	} else if (damageType === 'magykal') {
	  reductionAmount = targetActor.system.magykal_reduction || 0;
	  reductionType = 'Magykal';
	}
	
	// Apply reduction
	if (reductionAmount > 0) {
	  finalDamage = Math.max(0, damage - reductionAmount);
	}
	
	// Calculate damage breakdown for this actor
	let armorDamage = 0;
	let wardDamage = 0;
	let healthDamage = 0;
	let remainingDamage = finalDamage;
	let infoTitle = '';
	
	// Check for ward first (actors cannot have both ward and armor)
	const currentWard = targetActor.system.ward?.value || 0;
	if (currentWard > 0 && !hasPierce) {
	  // Damage ward first, then health (unless Pierce tag is present)
	  wardDamage = Math.min(remainingDamage, currentWard);
	  remainingDamage -= wardDamage;
	} else if (currentWard > 0 && hasPierce) {
	  infoTitle = 'Ward was ignored due to Pierce tag.';
	} else if (targetActor.type === "monster" && !hasPierce) {
	  // For monsters, damage armor first, then health (unless Pierce tag is present)
	  const currentArmor = targetActor.system.armor?.value || 0;
	  if (currentArmor > 0) {
		armorDamage = Math.min(remainingDamage, currentArmor);
		remainingDamage -= armorDamage;
	  }
	}
	
	// Calculate health damage
	if (remainingDamage > 0) {
	  healthDamage = remainingDamage;
	}
	
	// Prepare updates for this actor
	let updates = {};
	if (wardDamage > 0) {
	  updates['system.ward.value'] = Math.max(0, currentWard - wardDamage);
	}
	if (armorDamage > 0) {
	  const currentArmor = targetActor.system.armor?.value || 0;
	  updates['system.armor.value'] = Math.max(0, currentArmor - armorDamage);
	}
	if (healthDamage > 0) {
	  const currentHealth = targetActor.system.health?.value || 0;
	  updates['system.health.value'] = Math.max(0, currentHealth - healthDamage);
	}
	
	// Store damage result and updates
	damageResults.push({
	  actor: targetActor,
	  armorDamage: armorDamage,
	  wardDamage: wardDamage,
	  healthDamage: healthDamage,
	  totalDamage: armorDamage + wardDamage + healthDamage,
	  originalDamage: damage,
	  finalDamage: finalDamage,
	  reductionAmount: reductionAmount,
	  reductionType: reductionType,
	  hasPierce: hasPierce,
	  infoTitle: infoTitle
	});
	
	actorUpdates.push({
	  actor: targetActor,
	  updates: updates
	});
  }
  
  // Apply updates to all actors
  try {
	for (const { actor, updates } of actorUpdates) {
	  await actor.update(updates);
	}
	
	// Disable the button after clicking
	button.disabled = true;
	button.textContent = "Damage Applied";
	
	// Apply disabled styling
	button.style.background = "linear-gradient(to bottom, #6c757d, #545b62)";
	button.style.cursor = "not-allowed";
	
	// Store reference to this button for potential undo
	button.dataset.damageApplied = "true";
	
	// Create chat message
	let damageMessage;
	let undoButton = "";
	
	if (damage === 0 || damageResults.every(result => result.finalDamage === 0)) {
	  if (targetActors.length === 1) {
		damageMessage = `${targetActors[0].name} took no damage.`;
	  } else {
		damageMessage = `The following took no damage:<br>• ${targetActors.map(actor => actor.name).join('<br>• ')}`;
	  }
	  
	  // Add combined info icon for Pierce and/or reduction even for no damage
	  const hasAnyModifier = damageResults.some(result => result.hasPierce || result.reductionAmount > 0);
	  if (hasAnyModifier) {
		const result = damageResults[0]; // For no damage, we can use the first result
		let infoTitle = "";
		if (result.hasPierce && result.reductionAmount > 0) {
		  infoTitle = `Armor ignored due to Pierce tag. -${result.reductionAmount} less damage from ${result.reductionType} reduction.`;
		} else if (result.hasPierce) {
		  infoTitle = "Armor ignored due to Pierce tag.";
		} else if (result.reductionAmount > 0) {
		  infoTitle = `-${result.reductionAmount} less damage from ${result.reductionType} reduction.`;
		}
		
		damageMessage += ` <span class="reduction-info-container" style="margin-left: 5px;">
		  <i class="fas fa-info-circle reduction-info" 
			 title="${infoTitle}" 
			 style="color: #17a2b8; cursor: help; font-size: 14px;"></i>
		</span>`;
	  }
	} else {
	  if (targetActors.length === 1) {
		const result = damageResults[0];
		damageMessage = `${result.actor.name} took ${result.finalDamage} damage`;
		
		// Add damage breakdown
		if (result.wardDamage > 0) {
		  damageMessage += ` (${result.wardDamage} to ward, ${result.healthDamage} to health)`;
		} else if (result.actor.type === "monster" && result.armorDamage > 0) {
		  damageMessage += ` (${result.armorDamage} to armor, ${result.healthDamage} to health)`;
		}
		damageMessage += ".";
		
		// Add combined info icon for Pierce and/or reduction
		if (result.infoTitle || result.reductionAmount > 0) {
		  let infoTitle = result.infoTitle || "";
		  if (result.reductionAmount > 0) {
		    if (infoTitle) infoTitle += " ";
			infoTitle += `-${result.reductionAmount} less damage from ${result.reductionType} reduction.`;
		  }
		  
		  damageMessage += ` <span class="reduction-info-container" style="margin-left: 5px;">
			<i class="fas fa-info-circle reduction-info" 
			   title="${infoTitle}" 
			   style="color: #17a2b8; cursor: help; font-size: 14px;"></i>
		  </span>`;
		}
	  } else {
		damageMessage = `The following took damage:<br>`;
		damageMessage += damageResults.map(result => {
		  if (result.finalDamage === 0) {
			return `• ${result.actor.name}: no damage`;
		  }
		  let line = `• ${result.actor.name}: ${result.finalDamage} damage`;
		  
		  // Add damage breakdown
		  if (result.wardDamage > 0) {
		    line += ` (${result.wardDamage} to ward, ${result.healthDamage} to health)`;
		  } else if (result.actor.type === "monster" && result.armorDamage > 0) {
		    line += ` (${result.armorDamage} to armor, ${result.healthDamage} to health)`;
		  }
		  
		  // Add combined info icon for Pierce and/or reduction
		  if (result.infoTitle || result.reductionAmount > 0) {
		    let infoTitle = result.infoTitle || "";
		    if (result.reductionAmount > 0) {
		      if (infoTitle) infoTitle += " ";
		      infoTitle += `-${result.reductionAmount} less damage from ${result.reductionType} reduction.`;
			}
			
			line += ` <span class="reduction-info-container" style="margin-left: 5px;">
			  <i class="fas fa-info-circle reduction-info" 
				 title="${infoTitle}" 
				 style="color: #17a2b8; cursor: help; font-size: 14px;"></i>
			</span>`;
		  }
		  return line;
		}).join('<br>');
	  }
	  
	  // Add undo button for non-zero damage
	  undoButton = `
		<span class="damage-undo-container" style="margin-left: 5px;">
		  <i class="fas fa-undo-alt damage-undo" 
			 data-actor-ids="${damageResults.map(r => r.actor.id).join(',')}" 
			 data-ward-damages="${damageResults.map(r => r.wardDamage).join(',')}" 
			 data-armor-damages="${damageResults.map(r => r.armorDamage).join(',')}" 
			 data-health-damages="${damageResults.map(r => r.healthDamage).join(',')}"
			 title="Undo Damage" 
			 style="color: #6c757d; cursor: pointer; font-size: 14px;"></i>
		</span>
	  `;
	  
	}
	
	ChatMessage.create({
	  user: game.user.id,
	  speaker: ChatMessage.getSpeaker({actor: targetActors[0]}),
	  content: `
		<div style="background: url('systems/stryder/assets/parchment.jpg'); 
					background-size: cover; 
					padding: 15px; 
					border: 1px solid #c9a66b; 
					border-radius: 3px;">
		  <h3 style="margin-top: 0; border-bottom: 1px solid #c9a66b; color: #dc3545;"><strong>Damage Applied</strong></h3>
		  <p style="margin-bottom: 0;"><span class="damage-text">${damageMessage}</span>${undoButton}</p>
		</div>
	  `,
	  type: CONST.CHAT_MESSAGE_TYPES.OTHER
	});
	
	if (damage > 0) {
	  if (targetActors.length === 1) {
		ui.notifications.info(`Applied ${damage} damage to ${targetActors[0].name}!`);
	  } else {
		ui.notifications.info(`Applied ${damage} damage to ${targetActors.length} targets!`);
	  }
	} else {
	  if (targetActors.length === 1) {
		ui.notifications.info(`${targetActors[0].name} took no damage.`);
	  } else {
		ui.notifications.info(`${targetActors.length} targets took no damage.`);
	  }
	}
	
  } catch (err) {
	console.error("Error applying damage:", err);
	ui.notifications.error("Failed to apply damage!");
  }
}

// Damage undo handler
async function handleDamageUndo(event) {
  event.preventDefault();
  const undoIcon = event.currentTarget;
  const actorIds = undoIcon.dataset.actorIds;
  const wardDamages = undoIcon.dataset.wardDamages;
  const armorDamages = undoIcon.dataset.armorDamages;
  const healthDamages = undoIcon.dataset.healthDamages;
  
  if (!actorIds) {
	console.error("No actor IDs found for undo button");
	return;
  }
  
  // Parse the comma-separated values
  const actorIdList = actorIds.split(',');
  const wardDamageList = wardDamages ? wardDamages.split(',').map(d => parseInt(d) || 0) : [];
  const armorDamageList = armorDamages.split(',').map(d => parseInt(d) || 0);
  const healthDamageList = healthDamages.split(',').map(d => parseInt(d) || 0);
  
  const targetActors = actorIdList.map(id => game.actors.get(id)).filter(actor => actor);
  
  if (targetActors.length === 0) {
	ui.notifications.error("No valid targets found!");
	return;
  }
  
  // Prepare restoration updates for all actors
  const actorUpdates = [];
  
  for (let i = 0; i < targetActors.length; i++) {
	const targetActor = targetActors[i];
	const wardDamage = wardDamageList[i] || 0;
	const armorDamage = armorDamageList[i] || 0;
	const healthDamage = healthDamageList[i] || 0;
	
	let updates = {};
	
	// Restore ward if damaged
	if (wardDamage > 0) {
	  const currentWard = targetActor.system.ward?.value || 0;
	  updates['system.ward.value'] = currentWard + wardDamage;
	}
	
	// Restore armor if damaged
	if (armorDamage > 0) {
	  const currentArmor = targetActor.system.armor?.value || 0;
	  const maxArmor = targetActor.system.armor?.max || currentArmor + armorDamage;
	  updates['system.armor.value'] = Math.min(maxArmor, currentArmor + armorDamage);
	}
	
	// Restore health if damaged
	if (healthDamage > 0) {
	  const currentHealth = targetActor.system.health?.value || 0;
	  const maxHealth = targetActor.system.health?.max || currentHealth + healthDamage;
	  updates['system.health.value'] = Math.min(maxHealth, currentHealth + healthDamage);
	}
	
	actorUpdates.push({
	  actor: targetActor,
	  updates: updates,
	  wardDamage: wardDamage,
	  armorDamage: armorDamage,
	  healthDamage: healthDamage
	});
  }
  
  // Apply restoration updates
  try {
	for (const { actor, updates } of actorUpdates) {
	  await actor.update(updates);
	}
	
	// Create restoration message
	const restoredTypes = new Set();
	for (const update of actorUpdates) {
	  if (update.wardDamage) restoredTypes.add("Ward");
	  if (update.armorDamage) restoredTypes.add("Armor");
	  if (update.healthDamage) restoredTypes.add("Health");
	}
	const uniqueRestorations = Array.from(restoredTypes);
	const tooltipText = uniqueRestorations.length > 0 
	  ? `Restored: ${uniqueRestorations.join(", ")}`
	  : "Damage Restored";
	
	// Disable the undo button and add visual feedback
	undoIcon.style.color = "#28a745";
	undoIcon.style.cursor = "not-allowed";
	undoIcon.title = tooltipText;
	
	// Find the parent paragraph and add strikethrough to the damage text
	const parentParagraph = undoIcon.closest('p');
	if (parentParagraph) {
	  const damageTextSpan = parentParagraph.querySelector('.damage-text');
	  if (damageTextSpan) {
		damageTextSpan.style.textDecoration = "line-through";
		damageTextSpan.style.opacity = "0.6";
	  }
	}
	
	// Find and re-enable the original damage button
	// Look through recent chat messages to find the original damage button
	const totalDamage = actorUpdates.reduce((sum, { armorDamage, healthDamage }) => sum + armorDamage + healthDamage, 0);
	const recentMessages = game.messages.contents.slice(-10); // Check last 10 messages
	for (const message of recentMessages) {
	  const messageContent = message.content;
	  if (messageContent && messageContent.includes('damage-apply-button')) {
		// Parse the HTML content to find the damage button
		const parser = new DOMParser();
		const doc = parser.parseFromString(messageContent, 'text/html');
		const damageButton = doc.querySelector('.damage-apply-button');
		if (damageButton && parseInt(damageButton.dataset.damage) === totalDamage) {
		  // Found the matching damage button - re-enable it
		  damageButton.disabled = false;
		  damageButton.textContent = damageButton.textContent.replace("Damage Applied", "Apply " + damageButton.dataset.damage + " Damage");
		  damageButton.style.background = "linear-gradient(to bottom, #dc3545, #b02a37)";
		  damageButton.style.cursor = "pointer";
		  
		  // Update the actual DOM element in the chat
		  const chatMessageElement = document.querySelector(`[data-message-id="${message.id}"]`);
		  if (chatMessageElement) {
			const actualButton = chatMessageElement.querySelector('.damage-apply-button');
			if (actualButton) {
			  actualButton.disabled = false;
			  actualButton.textContent = actualButton.textContent.replace("Damage Applied", "Apply " + actualButton.dataset.damage + " Damage");
			  actualButton.style.background = "linear-gradient(to bottom, #dc3545, #b02a37)";
			  actualButton.style.cursor = "pointer";
			}
		  }
		  break;
		}
	  }
	}
	
	// Create restoration chat message
	const totalRestored = actorUpdates.reduce((sum, { armorDamage, wardDamage, healthDamage }) => 
	  sum + (armorDamage || 0) + (wardDamage || 0) + (healthDamage || 0), 0);
	let restorationMessage;
	
	if (targetActors.length === 1) {
	  const { wardDamage, armorDamage, healthDamage } = actorUpdates[0];
	  restorationMessage = `Restored ${totalRestored} damage to ${targetActors[0].name}`;
	  
	  // Build detailed damage breakdown
	  const parts = [];
	  if (wardDamage > 0) parts.push(`${wardDamage} ward`);
	  if (armorDamage > 0) parts.push(`${armorDamage} armor`);
	  if (healthDamage > 0) parts.push(`${healthDamage} health`);
	  
	  if (parts.length > 0) {
	    restorationMessage += ` (${parts.join(", ")})`;
	  }
	  restorationMessage += ".";
	} else {
	  restorationMessage = `Restored damage to ${targetActors.length} targets:<br>`;
	  restorationMessage += actorUpdates.map(({ actor, wardDamage, armorDamage, healthDamage }) => {
		const total = (wardDamage || 0) + (armorDamage || 0) + (healthDamage || 0);
		let line = `• ${actor.name}: ${total} damage restored`;
		
		// Build detailed damage breakdown
		const parts = [];
		if (wardDamage > 0) parts.push(`${wardDamage} ward`);
		if (armorDamage > 0) parts.push(`${armorDamage} armor`);
		if (healthDamage > 0) parts.push(`${healthDamage} health`);
		
		if (parts.length > 0) {
		  line += ` (${parts.join(", ")})`;
		}
		return line;
	  }).join('<br>');
	}
	
	ChatMessage.create({
	  user: game.user.id,
	  speaker: ChatMessage.getSpeaker({actor: targetActors[0]}),
	  content: `
		<div style="background: url('systems/stryder/assets/parchment.jpg'); 
					background-size: cover; 
					padding: 15px; 
					border: 1px solid #c9a66b; 
					border-radius: 3px;">
		  <h3 style="margin-top: 0; border-bottom: 1px solid #c9a66b; color: #28a745;"><strong>Damage Restored</strong></h3>
		  <p style="margin-bottom: 0;">${restorationMessage}</p>
		</div>
	  `,
	  type: CONST.CHAT_MESSAGE_TYPES.OTHER
	});
	
	if (targetActors.length === 1) {
	  ui.notifications.info(`Restored ${totalRestored} damage to ${targetActors[0].name}!`);
	} else {
	  ui.notifications.info(`Restored damage to ${targetActors.length} targets!`);
	}
	
  } catch (err) {
	console.error("Error restoring damage:", err);
	ui.notifications.error("Failed to restore damage!");
  }
}

// Export the damage application and undo handlers
export { handleDamageApply, handleDamageUndo };
