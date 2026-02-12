// ============================================================
// STRYDER - Folk Abilities Compendium Import Script
// ============================================================
// HOW TO USE:
// 1. Open Foundry VTT and load your Stryder world
// 2. Press F12 to open the developer console
// 3. Copy and paste this ENTIRE script into the console
// 4. Press Enter to run it
// 5. Wait for the "Import complete!" notification
// ============================================================

(async () => {
  const PACK_ID = "stryder.stryder-folk-abilities";
  const pack = game.packs.get(PACK_ID);

  if (!pack) {
    ui.notifications.error("Could not find Folk Abilities compendium!");
    return;
  }

  // Unlock the pack for editing
  await pack.configure({ locked: false });

  ui.notifications.info("Starting Folk Abilities import... This may take a moment.");

  // ---- Helper to create a folder if it doesn't already exist ----
  async function getOrCreateFolder(name) {
    const existing = pack.folders.find(f => f.name === name);
    if (existing) return existing;
    const folder = await Folder.create({
      name: name,
      type: "Item",
      pack: PACK_ID
    });
    return folder;
  }

  // ---- Helper to create a racial item in the compendium ----
  async function createAbility(folderObj, data) {
    const itemData = {
      name: data.name,
      type: "racial",
      folder: folderObj.id,
      img: "icons/svg/aura.svg",
      system: {
        description: data.description || "",
        action_type: data.action_type || "",
        cooldown_value: data.cooldown_value || 0,
        cooldown_unit: data.cooldown_unit || "",
        range: data.range || "",
        stamina_cost: data.stamina_cost || 0,
        mana_cost: data.mana_cost || 0,
        other_restrictions: data.other_restrictions || "",
        charges: {
          max: data.charges_max || 0,
          value: data.charges_max || 0
        },
        uses_current: data.cooldown_value || 0,
        tag1: data.tag1 || "",
        tag2: data.tag2 || "",
        tag3: data.tag3 || "",
        isAttack: data.isAttack || false,
        damage_type: data.damage_type || "physical",
        customDamage: {
          poor: data.custom_poor || "",
          good: data.custom_good || "",
          excellent: data.custom_excellent || ""
        },
        roll: {
          diceBonus: data.diceBonus || 0,
          diceNum: data.diceNum || 2,
          diceSize: data.diceSize || 6
        }
      }
    };

    await Item.create(itemData, { pack: PACK_ID });
  }

  // Helper to parse tags string into tag1, tag2, tag3
  function parseTags(tagString) {
    if (!tagString) return {};
    const tags = tagString.split(",").map(t => t.trim()).filter(Boolean);
    return {
      tag1: tags[0] || "",
      tag2: tags[1] || "",
      tag3: tags[2] || ""
    };
  }

  // ============================================================
  // COLOSSUS
  // ============================================================
  const colossusFolder = await getOrCreateFolder("Colossus");

  await createAbility(colossusFolder, {
    name: "Beating Stone Heart",
    description: "<p>Colossus endure. It is what they do. The moment a Colossus takes damage that would kill them, their Stone Heart begins thudding loud enough to be heard outside of its body and the Colossus will curl up and enter a stone cocoon form. This cocoon has Health equal to your level. If the cocoon still has any remaining Health at the end of the engagement, the cocoon hatches. The Colossus is now a Pebbling and has half of its former Health, Stamina and Mana. The Pebbling can become a Colossus again if they go through the Chiseling once more.</p>",
    action_type: "passive",
    other_restrictions: "Once per transformation to Colossus form"
  });

  console.log("Colossus abilities created.");

  // ============================================================
  // DESCENDANT
  // ============================================================
  const descendantFolder = await getOrCreateFolder("Descendant");

  await createAbility(descendantFolder, {
    name: "Mana Recovery",
    description: "<p>You can open yourself to the Mana in your surroundings and regain 2 Mana instantly. This ability may be used once between rejuvenation at a Spring of Life.</p>",
    action_type: "swift",
    cooldown_value: 1,
    cooldown_unit: "perSpring",
    range: "Self",
    stamina_cost: 0,
    mana_cost: 0,
    other_restrictions: "Once per Spring of Life visit",
    charges_max: 1
  });

  await createAbility(descendantFolder, {
    name: "Manasoul Strike",
    description: "<p>When making a Focused, Quick, or Hex Attack you can funnel mana into your Attack at its strongest, when you land an Excellent Attack you can use 1 Mana to change its damage from 1.5x to 2x.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perTurn",
    range: "Self",
    mana_cost: 1,
    other_restrictions: "Must be used when landing an Excellent Attack, 3x per day",
    charges_max: 3,
    ...parseTags("augment")
  });

  await createAbility(descendantFolder, {
    name: "Adaptive Defense",
    description: "<p>When a creature targets you with an ability or attack it has used before you can adapt accordingly. Adaptive Defense can be used to raise your Dodge, Evasion, or Resistance by 3. You can only choose to benefit from this ability if the ability being used against you has been used before during the current combat. You can only benefit from this ability 3 times between visits to the Spring of Life.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perSpring",
    range: "Self",
    other_restrictions: "Ability being defended against must have been used earlier in current combat",
    charges_max: 3
  });

  await createAbility(descendantFolder, {
    name: "Swiftfoot",
    description: "<p>Your ability to stay light on your feet while maintaining considerable strength allows you to Evade without reducing your own Movement to do so.</p>",
    action_type: "passive"
  });

  console.log("Descendant abilities created.");

  // ============================================================
  // FEYFOLK
  // ============================================================
  const feyfolkFolder = await getOrCreateFolder("Feyfolk");

  await createAbility(feyfolkFolder, {
    name: "Illusioncraft - Fear",
    description: "<p>This Magyk afflicts a target with vivid visions that feel undeniably real. The target sees a source of fear of their own making. As their deepest fear takes form within their line of sight they can't help but become Panicked until the end of their next turn when the Illusion fades.</p>",
    action_type: "swift",
    range: "5",
    other_restrictions: "Uses 1 Golden Mana, target must fail Magykal Resist vs your Magykal or Physical Potency",
    ...parseTags("targeted"),
    damage_type: "magykal"
  });

  await createAbility(feyfolkFolder, {
    name: "Illusioncraft - Darkness",
    description: "<p>An all enveloping darkness envelops the target, rendering it Blinded until the end of its next turn.</p>",
    action_type: "swift",
    range: "5",
    other_restrictions: "Uses 1 Golden Mana, target must fail Magykal Resist vs your Magykal or Physical Potency",
    ...parseTags("targeted"),
    damage_type: "magykal"
  });

  await createAbility(feyfolkFolder, {
    name: "Illusioncraft - Ice",
    description: "<p>Visions of crawling ice and freezing winds convince the target it is Frozen, making the Frozen condition take hold of them for their next two turns.</p>",
    action_type: "swift",
    range: "5",
    other_restrictions: "Uses 1 Golden Mana, target must fail Magykal Resist vs your Magykal or Physical Potency",
    ...parseTags("targeted"),
    damage_type: "magykal"
  });

  await createAbility(feyfolkFolder, {
    name: "Illusioncraft - Memory",
    description: "<p>As your Olde Magyk delves deep into a creatures mind it finds the most shocking thing it could possibly imagine appearing before it, perhaps a fallen loved one, something lost from their past, or the very ground falling away. This causes the target to be Stunned.</p>",
    action_type: "swift",
    range: "5",
    other_restrictions: "Uses 1 Golden Mana, target must fail Magykal Resist vs your Magykal or Physical Potency",
    ...parseTags("targeted"),
    damage_type: "magykal"
  });

  await createAbility(feyfolkFolder, {
    name: "Illusioncraft - Fervor",
    description: "<p>A Magyk that affects the creatures auditory and visual senses to have it envision you doing something so horrid that it must target you, causing it to become Taunted.</p>",
    action_type: "swift",
    range: "5",
    other_restrictions: "Uses 1 Golden Mana, target must fail Magykal Resist vs your Magykal or Physical Potency",
    ...parseTags("targeted"),
    damage_type: "magykal"
  });

  await createAbility(feyfolkFolder, {
    name: "Magykal Parody",
    description: "<p>Using your more unrefined Golden Mana you can emulate and evoke a Hex of any Aspect that you've seen in the last day. Its damage is based off your Power or Soul stat, whichever is higher. Warriors can evoke these hexes as they use their Golden Mana as a conduit to cast. When you do so you must pay the Hexes cost, including Action, Mana, or Stamina, as well as this abilities 2 Golden Mana. You must have seen the hex within the last 24 hours.</p>",
    action_type: "swift",
    range: "varies",
    other_restrictions: "Uses 2 Golden Mana, must have seen hex within last 24 hours, must pay original hex costs",
    damage_type: "magykal"
  });

  await createAbility(feyfolkFolder, {
    name: "Spiritstride",
    description: "<p>This unique Magyk allows Feyfolk to become immaterial during the phase it was activated on and use their Movement to traverse through solid objects and creatures. The only walls that Feyfolk can not cross through are those of personal dwellings.</p>",
    action_type: "swift",
    range: "Self",
    other_restrictions: "Uses 1 Golden Mana, cannot cross walls of personal dwellings"
  });

  console.log("Feyfolk abilities created.");

  // ============================================================
  // FLORAN
  // ============================================================
  const floranFolder = await getOrCreateFolder("Floran");

  await createAbility(floranFolder, {
    name: "Paralyzing Pollen",
    description: "<p>Every adjacent space to you is filled with an almost translucent pollen you release from your body and hangs in the air. Any creature besides you that enters one of the affected spaces must roll Physical Resistance. If their roll is lower than your highest potency they become Stunned.</p>",
    action_type: "focused",
    cooldown_value: 2,
    cooldown_unit: "round",
    range: "Adjacent spaces",
    other_restrictions: "1x per day",
    charges_max: 1,
    ...parseTags("multi-target, persistent"),
    damage_type: "physical"
  });

  await createAbility(floranFolder, {
    name: "Grasping Limbs",
    description: "<p>Make a quick attack that attempts to grapple an enemy within 6 spaces. Your arms are flooded with mana as they expand and reach through and beneath the terrain and out at your targets location. If your attack lands your target is automatically Grappled by you.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perRest",
    range: "6",
    other_restrictions: "3x between rests",
    charges_max: 3,
    ...parseTags("targeted"),
    isAttack: true,
    damage_type: "physical",
    custom_excellent: "Automatic Grapple"
  });

  await createAbility(floranFolder, {
    name: "Alstorias Blessing",
    description: "<p>Born of the World to serve the World, you can draw mana directly from the earth to heal your wounds. You recover 10 Health instantly and end any negative conditions on yourself.</p>",
    action_type: "swift",
    cooldown_value: 1,
    cooldown_unit: "perRest",
    range: "Self",
    other_restrictions: "1x between rests",
    charges_max: 1
  });

  console.log("Floran abilities created.");

  // ============================================================
  // OUMEN
  // ============================================================
  const oumenFolder = await getOrCreateFolder("Oumen");

  await createAbility(oumenFolder, {
    name: "Cursed Horns - Active",
    description: "<p>You charge a surge of the Other between your horns. At the start of your next turn you select a target within range and fire an impossibly fast laser that deals damage equal to 2x your Arcana or Soul. This attack cannot be dodged.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "turn",
    range: "10",
    other_restrictions: "3x per Full Rest, 3 turn cooldown",
    charges_max: 3,
    ...parseTags("targeted, breach"),
    isAttack: true,
    damage_type: "ahl",
    custom_poor: "2x Arcana or Soul",
    custom_good: "2x Arcana or Soul",
    custom_excellent: "2x Arcana or Soul"
  });

  await createAbility(oumenFolder, {
    name: "Cursed Wing - Hover",
    description: "<p>Your wing emits a consistent flow of magyk that you can use to hover. While hovering, expending Movement ignores additional costs from Marching terrain as well as granting you the ability to cross open air between two points as if it were solid land, but you can not end your turn in open air or you will begin to fall. This hover lasts until the start of your next turn.</p>",
    action_type: "swift",
    cooldown_value: 5,
    cooldown_unit: "perRest",
    range: "Self",
    other_restrictions: "5x per Full Rest, cannot end turn in open air",
    charges_max: 5
  });

  await createAbility(oumenFolder, {
    name: "Cursed Arm - Active",
    description: "<p>While this ability is active you can make a 1 Stamina Swift Action Quick Attack with the arm that deals damage equal to your Arcana or Soul. On a failed Physical Resist vs your highest Potency, the target is sent flying a number of spaces equal to your Arcana or Soul.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perRest",
    range: "Melee",
    stamina_cost: 1,
    other_restrictions: "3x per Full Rest",
    charges_max: 3,
    ...parseTags("targeted"),
    isAttack: true,
    damage_type: "physical",
    custom_poor: "Arcana or Soul",
    custom_good: "Arcana or Soul",
    custom_excellent: "Arcana or Soul + knockback"
  });

  await createAbility(oumenFolder, {
    name: "Cursed Leg - Empowered Leap",
    description: "<p>You can do an empowered version of the Leap Action, when you do you travel twice as far, you do not suffer fall damage as a result of this ability.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perRest",
    range: "Self",
    other_restrictions: "3x per Full Rest",
    charges_max: 3
  });

  console.log("Oumen abilities created.");

  // ============================================================
  // REMNANT
  // ============================================================
  const remnantFolder = await getOrCreateFolder("Remnant");

  await createAbility(remnantFolder, {
    name: "Dark Binding",
    description: "<p>You command your Shadow forwards onto a target creature within 6 spaces. The target can attempt to resist by rolling magykal resistance vs your highest Potency. If you are victorious the targets Movement is reduced to 0, but so long as Dark Binding is in effect you can not move further away from the ensnared target. This effect lasts three phases if the contested check is won, and ends early if the target goes unconscious. You can end this effect early by recalling your Shadow as a Swift action.</p>",
    action_type: "focused",
    range: "6",
    other_restrictions: "Uses 2 Darkness",
    ...parseTags("targeted, persistent"),
    damage_type: "magykal"
  });

  await createAbility(remnantFolder, {
    name: "Shadow Jump",
    description: "<p>Choose an ally's shadow, if the chosen shadow is within 6 spaces you can immediately step backwards through your own Shadow, reappearing within 1 space of your chosen ally. If there is no unoccupied space around your ally your Shadow Jump will fail. You can only activate Shadow Jump when your Shadow is not being used for any other abilities.</p>",
    action_type: "swift",
    range: "6",
    other_restrictions: "Uses 1 Darkness, requires unoccupied space near ally"
  });

  await createAbility(remnantFolder, {
    name: "Dread-Night Cloak",
    description: "<p>You command your Shadow forth to shroud you, exposing you but granting you strength. Doing so causes it to become a fearsome armor and weapon, augmenting you defensively and offensively. Your dodge and attack rolls gain a bonus of 3. Dread-night Cloak lasts 5 rounds.</p>",
    action_type: "swift",
    range: "Self",
    other_restrictions: "Uses 3 Darkness, lasts 5 rounds, causes Sun-Burn if used during daytime",
    ...parseTags("augment, persistent")
  });

  console.log("Remnant abilities created.");

  // ============================================================
  // SMALLFOLK (HEARTH)
  // ============================================================
  const hearthFolder = await getOrCreateFolder("Smallfolk (Hearth)");

  await createAbility(hearthFolder, {
    name: "Unyielding Determination",
    description: "<p>Hearth Smallfolk are able to overcome many obstacles and challenges through sheer force of determination. Twice between rest they can add a +3 to any Detection, Physical Talent, or Resistance rolls they make.</p>",
    action_type: "passive",
    cooldown_value: 2,
    cooldown_unit: "perRest",
    range: "Self",
    other_restrictions: "2x between rests",
    charges_max: 2
  });

  await createAbility(hearthFolder, {
    name: "Glyph of the Hearth - Lightning",
    description: "<p>As a Swift Action these Smallfolk can draw glyphs on a space. Once an enemy creature enters a space with a glyph drawn on it, the glyphs effect will activate. Every creature on and within 1 space of this Glyph are shocked with lightning which deals damage equal to Arcana or Power + 3 and become Shocked.</p>",
    action_type: "swift",
    cooldown_value: 2,
    cooldown_unit: "perTurn",
    range: "0",
    other_restrictions: "Can create up to 2 Glyphs per combat, Evasion Value 10, only visible to creatures with 4+ Arcana",
    charges_max: 2,
    isAttack: true,
    damage_type: "magykal",
    custom_poor: "Arcana or Power + 3",
    custom_good: "Arcana or Power + 3",
    custom_excellent: "Arcana or Power + 3"
  });

  await createAbility(hearthFolder, {
    name: "Glyph of the Hearth - Earth",
    description: "<p>Every creature on and within 1 space of this Glyph are dropped into a pit 3 spaces deep. The walls of this pit are steep and are Climbing Terrain.</p>",
    action_type: "swift",
    cooldown_value: 2,
    cooldown_unit: "perTurn",
    range: "0",
    other_restrictions: "Can create up to 2 Glyphs per combat, Evasion Value 10, only visible to creatures with 4+ Arcana",
    charges_max: 2,
    damage_type: "physical"
  });

  await createAbility(hearthFolder, {
    name: "Glyph of the Hearth - Poison",
    description: "<p>Every creature on and within 1 space of this Glyph are afflicted by a Draining poison that lasts until removed or the end of an Engagement.</p>",
    action_type: "swift",
    cooldown_value: 2,
    cooldown_unit: "perTurn",
    range: "0",
    other_restrictions: "Can create up to 2 Glyphs per combat, Evasion Value 10, only visible to creatures with 4+ Arcana",
    charges_max: 2,
    damage_type: "physical"
  });

  await createAbility(hearthFolder, {
    name: "Glyph of the Hearth - Barrier",
    description: "<p>Every creature on and within 1 space of this Glyph are trapped in to their current space by a wall of magyk. The barrier created by this glyph has 10 Health. Until the barrier is down the trapped creature(s) can not make attacks past it, but they can also not be targeted by attacks.</p>",
    action_type: "swift",
    cooldown_value: 2,
    cooldown_unit: "perTurn",
    range: "0",
    other_restrictions: "Can create up to 2 Glyphs per combat, Evasion Value 10, only visible to creatures with 4+ Arcana",
    charges_max: 2,
    damage_type: "magykal"
  });

  console.log("Smallfolk (Hearth) abilities created.");

  // ============================================================
  // SMALLFOLK (INTREPID)
  // ============================================================
  const intrepidFolder = await getOrCreateFolder("Smallfolk (Intrepid)");

  await createAbility(intrepidFolder, {
    name: "Gizmodius - Blowtorch",
    description: "<p>When in danger you can draw your Blowtorch from your Gizmo and set an enemy ablaze. Select a space within 1 space of you. If a creature is in this space it makes an Evasion roll against your highest potency. On a failure the target is ignited as long as they have something flammable on their person (clothing, flammable items, etc) and will begin Burning at the start of their next turn. Out of combat you may use the Blowtorch to ignite or melt objects.</p>",
    action_type: "focused",
    cooldown_value: 3,
    cooldown_unit: "perRest",
    range: "1",
    other_restrictions: "3 uses per rest",
    charges_max: 3,
    ...parseTags("targeted"),
    isAttack: true,
    damage_type: "magykal",
    custom_excellent: "Apply Burning condition"
  });

  await createAbility(intrepidFolder, {
    name: "Gizmodius - Oddly Specific Key",
    description: "<p>This key fits EVERY lock\u2026.. well, more accurately it COULD fit in every lock, you just don't know which lock the key will open whenever you activate it from your Gizmodius. You and your DM write down a number from 1-24. You both reveal the number simultaneously, if the number is the same, this key fits that lock. You can attempt to use this key up to 3 times between repairs during rest. If it successfully opens a lock, it only fits that lock until it can be reshaped during rest.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perRest",
    range: "0",
    other_restrictions: "3 uses per rest, requires matching DM roll",
    charges_max: 3
  });

  await createAbility(intrepidFolder, {
    name: "Gizmodius - Bubble Blower",
    description: "<p>As a Focused Action you can cause it to create a super dense field of bubbles around you. Every space around yours becomes enshrouded in bubbles, making it impossible to detect you with Sight, Smell or Arcana and blocking Line of Sight. These bubbles last in the spot they were summoned until the end of the next round of combat.</p>",
    action_type: "focused",
    cooldown_value: 2,
    cooldown_unit: "perRest",
    range: "Adjacent spaces",
    other_restrictions: "2 uses per rest",
    charges_max: 2
  });

  await createAbility(intrepidFolder, {
    name: "Gizmodius - Zapper",
    description: "<p>Select a target within 2 spaces. Make an attack at the target, if your attack lands the enemy rolls a Magyk Resist equal to their highest potency to attempt to resist the powerful electrical current that begins to flow through your Gizmo. On a failed resist they become Stunned.</p>",
    action_type: "swift",
    cooldown_value: 1,
    cooldown_unit: "perRest",
    range: "2",
    other_restrictions: "1 use per rest",
    charges_max: 1,
    ...parseTags("targeted"),
    isAttack: true,
    damage_type: "magykal",
    custom_excellent: "Apply Stunned condition"
  });

  await createAbility(intrepidFolder, {
    name: "Gizmodius - Magic Hex Bally",
    description: "<p>Said to channel prophesy from a unique blend of the Aspects of Time and Space your Hex Bally can potentially reveal past present and future secrets and truths to you, but whether it is to be believed\u2026.. that's up to you. You can shake the Gizmodius after asking a question out loud. The DM must then answer the stated question with a Yes, No or Maybe but they do not need to tell the truth.</p>",
    action_type: "focused",
    cooldown_value: 2,
    cooldown_unit: "perRest",
    range: "0",
    other_restrictions: "2 uses per rest, DM may lie",
    charges_max: 2
  });

  console.log("Smallfolk (Intrepid) abilities created.");

  // ============================================================
  // SUNBORN
  // ============================================================
  const sunbornFolder = await getOrCreateFolder("Sunborn");

  await createAbility(sunbornFolder, {
    name: "Dance of the Firefly - Ignite",
    description: "<p>Sunborn can expel flame from their bodies to grant them superior mobility and versatility. You increase a Dodge or Evasion Roll by 2 after seeing its result.</p>",
    action_type: "swift",
    range: "Self",
    other_restrictions: "Uses 1 Ember, Trigger: You Dodge or Evade"
  });

  await createAbility(sunbornFolder, {
    name: "Dance of the Firefly - Spark",
    description: "<p>You increase your Movement by 5 until the end of the current Phase.</p>",
    action_type: "swift",
    range: "Self",
    other_restrictions: "Uses 1 Ember"
  });

  await createAbility(sunbornFolder, {
    name: "Dance of the Firefly - Blitz",
    description: "<p>You increase your next attack roll by 2.</p>",
    action_type: "swift",
    range: "Self",
    other_restrictions: "Uses 1 Ember",
    ...parseTags("augment")
  });

  await createAbility(sunbornFolder, {
    name: "Feral Flare",
    description: "<p>With a rapid motion a Sunborn can set a space within range into a sudden blaze. This burst of fire deals damage equal to a Sunborn's Arcana or Soul on a failed Evasion of 11.</p>",
    action_type: "swift",
    range: "3",
    other_restrictions: "Uses 1 Ember",
    ...parseTags("targeted"),
    isAttack: true,
    damage_type: "magykal",
    custom_poor: "Arcana or Soul",
    custom_good: "Arcana or Soul",
    custom_excellent: "Arcana or Soul"
  });

  await createAbility(sunbornFolder, {
    name: "Flicker",
    description: "<p>As a capricious plume of a fire Sunborn can momentarily turn to flame, this effect lasts but a moment. When they are attacked with a weapon (swords, claws, arrows) they can make themselves immaterial, resulting in the attack dealing no damage. When a DM declares an attack the player must declare their use of Flicker Flare before seeing the result of the enemies Attack Roll.</p>",
    action_type: "passive",
    range: "Self",
    other_restrictions: "Uses 2 Embers, must be declared before seeing attack roll result, Trigger: When targeted by Attack Roll",
    ...parseTags("breach")
  });

  await createAbility(sunbornFolder, {
    name: "Fire Eaters",
    description: "<p>Sunborns can swallow flames, making them harmless and restoring all of their Embers. They can use this against a triggering fire ability to nullify damage or eat a passive source of fire, but it cannot be generated by their own hands. This can be done once, then the Sunborn must visit a Spring of Life to do so again. Using this against an oncoming fire ability is a [Breach] Trigger Action that costs 3 Stamina.</p>",
    action_type: "passive",
    cooldown_value: 1,
    cooldown_unit: "perSpring",
    range: "Self",
    stamina_cost: 3,
    other_restrictions: "1x per Spring of Life, can be used as Trigger Action vs fire abilities, cannot be used on own flames",
    charges_max: 1,
    ...parseTags("breach")
  });

  console.log("Sunborn abilities created.");

  // ============================================================
  // TRAVELER
  // ============================================================
  const travelerFolder = await getOrCreateFolder("Traveler");

  await createAbility(travelerFolder, {
    name: "Boon of Dawnkeeper - Soul Drive",
    description: "<p>When your Attack Roll is Excellent you gain a +2 to attack rolls and +2 Movement until the end of the next Player Phase.</p>",
    action_type: "passive",
    range: "Self",
    other_restrictions: "Triggers on Excellent Attack Roll"
  });

  await createAbility(travelerFolder, {
    name: "Boon of Dawnkeeper - Bravery",
    description: "<p>Your next attack roll will automatically be rolled as a 12. This ability can only be used once between visits to a Spring of Life.</p>",
    action_type: "swift",
    cooldown_value: 1,
    cooldown_unit: "perSpring",
    range: "Self",
    other_restrictions: "1x per Spring of Life",
    charges_max: 1
  });

  await createAbility(travelerFolder, {
    name: "Boon of Starchaser - Freedom",
    description: "<p>Your desire given breath, when you activate this boon you double your Movement for 3 Rounds. This boon can be used three times between visits to a Spring of Life.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perSpring",
    range: "Self",
    other_restrictions: "3x per Spring of Life, lasts 3 rounds",
    charges_max: 3,
    ...parseTags("augment, persistent")
  });

  await createAbility(travelerFolder, {
    name: "Boon of Wavewatcher - Stalwart Defense",
    description: "<p>Whenever you would be reduced to 0 Health, your Health remains at 1. This effect occurs twice between rests.</p>",
    action_type: "passive",
    cooldown_value: 2,
    cooldown_unit: "perRest",
    range: "Self",
    other_restrictions: "2x between rests",
    charges_max: 2
  });

  await createAbility(travelerFolder, {
    name: "Boon of Wavewatcher - Endurance",
    description: "<p>Once you have been targeted by an attack, ability or Hex, you automatically succeed a Dodge, Evasion, or Resistance required to avoid harm from the attack or ability. This boon can be activated three times visits to a Spring of Life.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perSpring",
    range: "Self",
    other_restrictions: "3x per Spring of Life, automatic success",
    charges_max: 3
  });

  await createAbility(travelerFolder, {
    name: "Boon of Puck - Lucky",
    description: "<p>Your luck is supernatural. When you encounter a random roll for acquiring something such as looting or gathering, once per Spring of Life you can choose exactly which item from the table you get when looting.</p>",
    action_type: "passive",
    cooldown_value: 1,
    cooldown_unit: "perSpring",
    range: "Self",
    other_restrictions: "1x per Spring of Life, only for loot/gather rolls",
    charges_max: 1
  });

  await createAbility(travelerFolder, {
    name: "Boon of Puck - Death is for the Unlucky",
    description: "<p>You have supernatural luck, you can change a d6 result to any other number three times per visit to a Spring of Life.</p>",
    action_type: "passive",
    cooldown_value: 3,
    cooldown_unit: "perSpring",
    range: "Self",
    other_restrictions: "3x per Spring of Life, only affects d6 rolls",
    charges_max: 3
  });

  console.log("Traveler abilities created.");

  // ============================================================
  // WILDKIN
  // ============================================================
  const wildkinFolder = await getOrCreateFolder("Wildkin");

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Burst",
    description: "<p>As a Swift Action you increase your Maximum Movement by 4 until the end of the Round.</p>",
    action_type: "swift",
    cooldown_value: 2,
    cooldown_unit: "perRest",
    range: "Self",
    other_restrictions: "2 uses per rest",
    charges_max: 2
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Self Defense Mechanism",
    description: "<p>As a Trigger Action, the Trigger being you are the target of an Attack Roll, you can reduce the Attack Roll by 5 and the damage dealt by 2.</p>",
    action_type: "passive",
    cooldown_value: 1,
    cooldown_unit: "perRest",
    range: "Self",
    other_restrictions: "1 use per rest, Trigger: targeted by Attack Roll",
    charges_max: 1
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Jaws",
    description: "<p>You have powerful jaws and can use them as a natural weapon. Make a Focused Attack with a base damage of 8, on a roll of 8 or higher you inflict the Bleeding Wounds condition.</p>",
    action_type: "focused",
    cooldown_value: 3,
    cooldown_unit: "perRest",
    range: "Melee",
    other_restrictions: "3 uses per rest",
    charges_max: 3,
    isAttack: true,
    damage_type: "physical",
    custom_poor: "8",
    custom_good: "8",
    custom_excellent: "8 + Bleeding Wounds"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Claws",
    description: "<p>You have sharp claws and can use them as a natural weapon. Make a Quick Attack with a base damage of 5, on an Excellent attack you inflict the Bleeding Wounds condition.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perRest",
    range: "Melee",
    other_restrictions: "3 uses per rest",
    charges_max: 3,
    isAttack: true,
    damage_type: "physical",
    custom_poor: "5",
    custom_good: "5",
    custom_excellent: "5 + Bleeding Wounds"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Stinger",
    description: "<p>You have a stinger and can use it as a natural weapon. Make a Quick Attack with a base damage of 3, it ignores armor and on an Excellent Attack, you inflict the target with Draining Poison.</p>",
    action_type: "swift",
    cooldown_value: 3,
    cooldown_unit: "perRest",
    range: "Melee",
    other_restrictions: "3 uses per rest, ignores armor",
    charges_max: 3,
    ...parseTags("breach"),
    isAttack: true,
    damage_type: "physical",
    custom_poor: "3",
    custom_good: "3",
    custom_excellent: "3 + Draining Poison"
  });

  console.log("Wildkin abilities created.");

  // ============================================================
  // DONE
  // ============================================================
  ui.notifications.info(`Folk Abilities import complete! 42 abilities added across 10 folk folders.`);
  console.log("=== IMPORT COMPLETE ===");
  console.log("Folders created: Colossus, Descendant, Feyfolk, Floran, Oumen, Remnant, Smallfolk (Hearth), Smallfolk (Intrepid), Sunborn, Traveler, Wildkin");

})();
