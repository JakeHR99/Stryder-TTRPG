// ============================================================
//  UNIVERSAL PLAYER ACTIONS — Direct Actor Embed Script
//  Paste into Foundry console and run.
//  Embeds all 16 UPAs directly onto every character actor.
//  Safe to run multiple times — skips already-present actions.
// ============================================================

const UPAs = [
  // ── Focused Actions ──────────────────────────────────────────────────────
  { name:'Focused Attack', img:'icons/svg/sword.svg', system:{ description:'<p>Make an attack at a target within your weapon\'s range.</p>', action_type:'focused', stamina_cost:0, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Weapon Range', isUniversalAction:true }},
  { name:'Disarm', img:'icons/svg/item-bag.svg', system:{ description:'<p>As a Focused action you may attempt to disarm another. The target rolls Physical Resistance or Finesse against your Physical Potency. On failure the creature\'s weapon is dropped immediately below them.</p>', action_type:'focused', stamina_cost:0, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Melee', isUniversalAction:true }},
  { name:'Defensive Focus', img:'icons/svg/shield.svg', system:{ description:'<p>You shift your focus from the battlefield onto yourself. Until the start of the next Challenger Phase you gain: <strong>+1 to Physical and Magykal Resistance, +2 to Dodge and Evasion.</strong></p>', action_type:'focused', stamina_cost:0, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
  { name:'Grapple', img:'icons/svg/pawprint.svg', system:{ description:'<p>Requires both hands free. Roll Strength vs. the target\'s Strength, Nimbleness, or Physical Resistance. If higher, you and your target are locked into the grapple until broken. While Grappling: Dodge and Evasion −2, Movement affected by Carrying Burden. Release as a Swift Action at no cost.</p>', action_type:'focused', stamina_cost:1, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:2,diceSize:6,diceBonus:'strength'}, limit:{value:0,max:0}, range:'Melee', isUniversalAction:true }},

  // ── Swift Actions ─────────────────────────────────────────────────────────
  { name:'Detect', img:'icons/svg/eye.svg', system:{ description:'<p>Select a Sense to roll. If the result is higher than a Hidden creature\'s Hide Roll you become aware of their location. Range equals the number of spaces rolled. <em>1× per Round.</em></p>', action_type:'swift', stamina_cost:1, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:1}, range:'Rolled Sense', isUniversalAction:true }},
  { name:'Get Down', img:'icons/svg/falling.svg', system:{ description:'<p>Force yourself to the ground, becoming <strong>[Dropped]</strong> and allowing use of smaller obstructions to break LoS.</p>', action_type:'swift', stamina_cost:0, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
  { name:'Hide', img:'icons/svg/mystery-man.svg', system:{ description:'<p>Roll Nimbleness. On 8+ you become <strong>Hidden</strong> and that result is your Hide Roll. While enemies have LoS, they each make a Sense roll — you must beat all of them to successfully hide. You must have somewhere reasonable to hide or this action fails.</p>', action_type:'swift', stamina_cost:1, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:2,diceSize:6,diceBonus:'nimbleness'}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
  { name:'Interact', img:'icons/svg/item-bag.svg', system:{ description:'<p>Safely interact with, stow, pick up, or draw an elixir, item, or other object. If you have a hand free, your <strong>first Interact each Round has no cost.</strong></p>', action_type:'swift', stamina_cost:1, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Reach', isUniversalAction:true }},
  { name:'Leap', img:'icons/svg/wing.svg', system:{ description:'<p>Cross a distance in a single jump. Vertical distance = Strength ÷ 2 (rounded down). Horizontal = Nimbleness. No Falling damage as long as you don\'t exceed your leap distance. Diagonal leaps halve both distances (rounded up).</p>', action_type:'swift', stamina_cost:1, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
  { name:'Re-Arm', img:'icons/svg/regen.svg', system:{ description:'<p>Change the Aspect your Soul Armament is attuned to. You are immediately considered attuned to the new Aspect, removing access to Skills from the previous Aspect.</p>', action_type:'swift', stamina_cost:1, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
  { name:'Throw', img:'icons/svg/throw.svg', system:{ description:'<p>Throw a creature or object. Creatures must first be <strong>Grappled</strong>; a thrown creature is <strong>Airborne</strong>. See charts for Throwing Range and Aim.</p>', action_type:'swift', stamina_cost:1, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'See Chart', isUniversalAction:true }},

  // ── Trigger Actions ───────────────────────────────────────────────────────
  { name:'Boost', img:'icons/svg/upgrade.svg', system:{ description:'<p><strong>Trigger:</strong> A Party Member enters your space. They may immediately use Leap at no cost and gain <strong>+1 to Vertical and Horizontal Leap distance.</strong></p>', action_type:'trigger', stamina_cost:1, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Your Space', isUniversalAction:true }},
  { name:'Block', img:'icons/svg/shield.svg', system:{ description:'<p><em>Requires an ability or item that grants Block.</em><br><strong>Trigger:</strong> When you are the target of a [Targeted] Attack. Reduce incoming damage by an amount determined by your Equipment.</p>', action_type:'trigger', stamina_cost:1, mana_cost:0, tag1:'breach', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
  { name:'Dodge', img:'icons/svg/lightning.svg', system:{ description:'<p><strong>Trigger:</strong> When you are the target of a [Targeted] Attack or Ability. Roll 1d6 + Reflex. If equal to or higher than the incoming attack, you avoid it and receive <strong>0 damage.</strong> You must decide to Dodge before knowing the exact roll number.</p>', action_type:'trigger', stamina_cost:1, mana_cost:0, tag1:'breach', tag2:'reflex', tag3:'', roll:{diceNum:1,diceSize:6,diceBonus:'reflex'}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
  { name:'Evade', img:'icons/svg/run.svg', system:{ description:'<p><strong>Trigger:</strong> When in a space targeted by an effect with an <strong>Evasion Value</strong>. Roll 2d6 + Reflex. If equal to or higher than the Evasion Value and you have enough Movement, reposition to an adjacent unoccupied space and avoid the effect. On failure you suffer the effect but don\'t expend Stamina or Movement.</p>', action_type:'trigger', stamina_cost:1, mana_cost:0, tag1:'breach', tag2:'reflex', tag3:'', roll:{diceNum:2,diceSize:6,diceBonus:'reflex'}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
  { name:'Body Block', img:'icons/svg/tower.svg', system:{ description:'<p><strong>Trigger:</strong> When targeted by an Attack or Ability while grappling a creature. Roll Strength, Nimbleness, or Physical Resistance. If the grappled creature fails, they become the target of the attack instead.</p>', action_type:'trigger', stamina_cost:2, mana_cost:0, tag1:'', tag2:'', tag3:'', roll:{diceNum:0,diceSize:6,diceBonus:0}, limit:{value:0,max:0}, range:'Self', isUniversalAction:true }},
];

// Embed on all character actors (skip if already present)
const characters = game.actors.filter(a => a.type === 'character' && a.isOwner);
let totalAdded = 0;

for (const actor of characters) {
  const existing = new Set(actor.items.filter(i => i.system?.isUniversalAction).map(i => i.name));
  const toAdd = UPAs.filter(u => !existing.has(u.name)).map(u => ({ ...u, type: 'action' }));
  if (toAdd.length === 0) {
    console.log(`${actor.name}: all UPAs already present, skipping.`);
    continue;
  }
  await actor.createEmbeddedDocuments('Item', toAdd);
  console.log(`${actor.name}: added ${toAdd.length} Player Actions.`);
  totalAdded += toAdd.length;
}

console.log(`✅ Done! Added ${totalAdded} UPAs across ${characters.length} character(s).`);
ui.notifications.info(`Player Actions imported — ${totalAdded} items added across ${characters.length} character(s).`);
