// ============================================================
// STRYDER - Folk Abilities Compendium Import Script (Part 2)
// ============================================================
// Adds NEW abilities only — skips any that already exist.
// Paste this into the F12 console in Foundry VTT.
// ============================================================

(async () => {
  const PACK_ID = "stryder.stryder-folk-abilities";
  const pack = game.packs.get(PACK_ID);

  if (!pack) {
    ui.notifications.error("Could not find Folk Abilities compendium!");
    return;
  }

  await pack.configure({ locked: false });

  // Load all existing documents to check for duplicates
  const existingDocs = await pack.getDocuments();
  const existingNames = new Set(existingDocs.map(d => d.name));

  let created = 0;
  let skipped = 0;

  ui.notifications.info("Starting Folk Abilities import (Part 2)... This may take a moment.");

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

  async function createAbility(folderObj, data) {
    if (existingNames.has(data.name)) {
      console.log(`SKIPPED (duplicate): ${data.name}`);
      skipped++;
      return;
    }
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
    existingNames.add(data.name);
    created++;
  }

  function parseTags(tagString) {
    if (!tagString) return {};
    const tags = tagString.split(",").map(t => t.trim()).filter(Boolean);
    return { tag1: tags[0] || "", tag2: tags[1] || "", tag3: tags[2] || "" };
  }

  // ============================================================
  // COLOSSUS — new abilities
  // ============================================================
  const colossusFolder = await getOrCreateFolder("Colossus");

  await createAbility(colossusFolder, {
    name: "One With the Earth",
    description: "<p>Colossus have a +2 bonus to Physical Resistance.</p>",
    action_type: "passive"
  });

  await createAbility(colossusFolder, {
    name: "Organically Inorganic",
    description: "<p>Colossus don't need to breathe, however they do need to eat and sleep. Colossus are uniquely immune to Suffocating.</p>",
    action_type: "passive"
  });

  await createAbility(colossusFolder, {
    name: "Dense Folk",
    description: "<p>Colossus sink whenever in water, they have a Swimming Movement of zero but can walk around whenever they reach the bottom of the water, should the water pressure not be immobilizing. A Colossus with Swimming Expertise has a Swimming Movement of 2.</p>",
    action_type: "passive"
  });

  await createAbility(colossusFolder, {
    name: "Mountain or Hill",
    description: "<p>Choose whether you are a Crag or Marbled Colossus, and whether you are Medium or Huge size. Your Weight Class is determined by being Crag or Marbled.</p>",
    action_type: "passive",
    other_restrictions: "Crag = Weight Class 6, Marbled = Weight Class 5"
  });

  await createAbility(colossusFolder, {
    name: "Crag Colossus Traits",
    description: "<p>You are immune to the Bleeding Wound condition. +1 Aggression, +1 Survival. Weight Class: 6</p>",
    action_type: "passive",
    other_restrictions: "Only for Crag Colossus variant"
  });

  await createAbility(colossusFolder, {
    name: "Marbled Colossus Traits",
    description: "<p>You can withstand Torrid Heat with no detriments and cannot suffer the Burning condition. +1 Diplomacy, +1 Charm. Weight Class: 5</p>",
    action_type: "passive",
    other_restrictions: "Only for Marbled Colossus variant"
  });

  // Beating Stone Heart — SKIP (already exists)

  await createAbility(colossusFolder, {
    name: "Optional Feature - Quadrupedal",
    description: "<p>You choose to have four legs and gain +3 Movement and a +1 to Evasion. You also have a -1 penalty to all Resistance Rolls that would cause you to be dropped. You cannot gain Climbing Expertise and Climbing terrain spaces cost an additional 2 Movement to enter. This biological variation causes you to be unable to don Leg Equipment.</p>",
    action_type: "passive",
    other_restrictions: "Cannot don Leg Equipment, cannot gain Climbing Expertise"
  });

  await createAbility(colossusFolder, {
    name: "Optional Feature - Tetrabrachial",
    description: "<p>You have four arms and can perform two Interact actions for no cost each Round. You gain +1 bonus to Grapple Checks of any kind and gain +1 bonus to Finesse and Strength Rolls. This biological variation causes you to be unable to don Torso Equipment. You are still only able to don 2 pieces of Arm Equipment.</p>",
    action_type: "passive",
    other_restrictions: "Cannot don Torso Equipment, limited to 2 Arm Equipment pieces"
  });

  console.log("Colossus new abilities done.");

  // ============================================================
  // FEYFOLK — new abilities
  // ============================================================
  const feyfolkFolder = await getOrCreateFolder("Feyfolk");

  await createAbility(feyfolkFolder, {
    name: "Olde Magyk",
    description: "<p>Feyfolk have 5 Golden Mana which exclusively fuels their Olde Magyks and can only be recovered by rest. Olde Magyks consist of: Illusioncraft, Magykal Parody, and Spiritstride.</p>",
    action_type: "passive",
    other_restrictions: "Golden Mana only recovers by rest",
    charges_max: 5
  });

  console.log("Feyfolk new abilities done.");

  // ============================================================
  // FLORAN — new abilities
  // ============================================================
  const floranFolder = await getOrCreateFolder("Floran");

  await createAbility(floranFolder, {
    name: "Sprout or Tree",
    description: "<p>Choose whether you are Medium or Huge size. Your Weight Class is 4.</p>",
    action_type: "passive"
  });

  await createAbility(floranFolder, {
    name: "Photosynthesis",
    description: "<p>As long as a Floran remain in direct sunlight for at least three hours a day and has access to flowing water, they are considered fully fed and do not require a meal at the end of the day. Provided they are able to eat and drink their fill for the day, if a Floran is maimed or wounded enough to lose a limb, it will naturally grow back over the course of 1 Hour.</p>",
    action_type: "passive",
    other_restrictions: "Requires 3 hours direct sunlight and flowing water daily"
  });

  await createAbility(floranFolder, {
    name: "Environmental Adaption",
    description: "<p>Floran ignore all detriments from Environmental Hazards as your plant body adapts almost instantaneously to survive them.</p>",
    action_type: "passive"
  });

  // Note: Floran also gets Quadrupedal/Tetrabrachial but those have the same name as Colossus ones.
  // The duplicate check will skip them since the names match. If you want separate Floran versions,
  // rename them (e.g., "Optional Feature - Quadrupedal (Floran)") and re-run.

  console.log("Floran new abilities done.");

  // ============================================================
  // OUMEN — new abilities
  // ============================================================
  const oumenFolder = await getOrCreateFolder("Oumen");

  await createAbility(oumenFolder, {
    name: "Divergent Folk",
    description: "<p>While you may have once been another Folk, your encounter with the Other has irreparably changed you. Choose another Folk to be your original Folk. You base your appearance and Size on your original Folk, but gain none of it's abilities.</p>",
    action_type: "passive",
    other_restrictions: "Choose original Folk, gain none of their abilities"
  });

  await createAbility(oumenFolder, {
    name: "Demon Slayer",
    description: "<p>By nature of your ability to overcome the affect of the Other you are also given a bolstered physical ability to overcome Demons. When dealt damage by any Attack, Skill, or Monster magyk by a Demon you reduce the damage dealt to you by 4.</p>",
    action_type: "passive",
    other_restrictions: "Only vs Demon sources"
  });

  await createAbility(oumenFolder, {
    name: "Cursed Horns - Passive",
    description: "<p>Your horns are a focal point of mana, you can evoke Hexes from them instead of using your hands.</p>",
    action_type: "passive"
  });

  await createAbility(oumenFolder, {
    name: "Cursed Wing - Passive",
    description: "<p>Your wing reflexively snap out to protect you if you fall, making you immune to falling or colliding damage so long as your wing is unbound so that it may unfurl and nullify your momentum before impact.</p>",
    action_type: "passive",
    other_restrictions: "Wing must be unbound"
  });

  await createAbility(oumenFolder, {
    name: "Cursed Arm - Passive",
    description: "<p>Your Strength Talent increases to 5.</p>",
    action_type: "passive"
  });

  await createAbility(oumenFolder, {
    name: "Cursed Leg - Passive",
    description: "<p>Your Movement increases by 2 and you gain a +1 bonus to Evasion.</p>",
    action_type: "passive"
  });

  console.log("Oumen new abilities done.");

  // ============================================================
  // REMNANT — new abilities
  // ============================================================
  const remnantFolder = await getOrCreateFolder("Remnant");

  await createAbility(remnantFolder, {
    name: "The Hunted",
    description: "<p>As a result of constant threat from shadoweaters in their original home world Remnants are extremely adept at keeping watch during night time. You gain +2 to Sight and Hearing when performing the Keeping Watch task.</p>",
    action_type: "passive",
    other_restrictions: "Only applies during Keeping Watch task"
  });

  await createAbility(remnantFolder, {
    name: "Night Vision",
    description: "<p>Remnants relationship to the dark and their strengthened eyes allows them to see clearly in the dark.</p>",
    action_type: "passive"
  });

  await createAbility(remnantFolder, {
    name: "The Shadow Within",
    description: "<p>Remnants can harness their Shadow, and use it to great effect. Their Shadow protects them from the Sunlight which damages their bodies, and can also be wielded in combat through practice and training. Remnants can use the following Shadow techniques, but doing so risks Sun-burn. The energy they use for these techniques is referred to as Darkness and Remnants have 5 Darkness. Darkness is refilled whenever a Remnant visits a goddess fountain.</p>",
    action_type: "passive",
    other_restrictions: "Darkness refills at Goddess Fountains or via Brooding",
    charges_max: 5
  });

  await createAbility(remnantFolder, {
    name: "Brooding",
    description: "<p>Brooding can be done whenever the party is Camping, or resting while not in the Wilds. Remnants must sit or stand alone and think of dark thoughts to restore the negative energy of the Darkness. Brooding takes one hour and restores Darkness to full.</p>",
    action_type: "passive",
    other_restrictions: "Must be Camping or resting outside the Wilds, takes 1 hour"
  });

  await createAbility(remnantFolder, {
    name: "Sun-Burn",
    description: "<p>While Dark Binding or Dread-night Cloak is active during Daytime, you lose 2 maximum Health every round. Your maximum Health is restored to its initial value when you rest at a Goddess Fountain.</p>",
    action_type: "passive",
    other_restrictions: "Only occurs during daytime when using Dark Binding or Dread-night Cloak"
  });

  console.log("Remnant new abilities done.");

  // ============================================================
  // SMALLFOLK (HEARTH) — new abilities
  // ============================================================
  const hearthFolder = await getOrCreateFolder("Smallfolk (Hearth)");

  await createAbility(hearthFolder, {
    name: "Pint Sized Heroes",
    description: "<p>Smallfolk are a diminutive Folk and the only one to exclusively be Small size, granting them the benefits and detriments there of. Your Weight Class is 3.</p>",
    action_type: "passive"
  });

  await createAbility(hearthFolder, {
    name: "Spiritual Branchlers",
    description: "<p>You can generally communicate ideas to non-hostile spirits as well as understand them loosely due to your stronger connection to spiritual things.</p>",
    action_type: "passive",
    other_restrictions: "Only with non-hostile spirits"
  });

  await createAbility(hearthFolder, {
    name: "Small But Fierce",
    description: "<p>Hearth Smallfolk do not suffer the detriment to their Movement due to being Small. Creatures larger than Medium suffer a -2 when attempting to Detect a Hidden Hearth Smallfolk.</p>",
    action_type: "passive"
  });

  console.log("Smallfolk (Hearth) new abilities done.");

  // ============================================================
  // SMALLFOLK (INTREPID) — new abilities
  // ============================================================
  const intrepidFolder = await getOrCreateFolder("Smallfolk (Intrepid)");

  await createAbility(intrepidFolder, {
    name: "Pint Sized Heroes (Intrepid)",
    description: "<p>Smallfolk are a diminutive Folk and the only one to exclusively be Small size, granting them the benefits and detriments there of. Your Weight Class is 3.</p>",
    action_type: "passive"
  });

  await createAbility(intrepidFolder, {
    name: "Spiritual Branchlers (Intrepid)",
    description: "<p>You can generally communicate ideas to non-hostile spirits as well as understand them loosely due to your stronger connection to spiritual things.</p>",
    action_type: "passive",
    other_restrictions: "Only with non-hostile spirits"
  });

  await createAbility(intrepidFolder, {
    name: "Arcane Genius",
    description: "<p>Intrepid Smallfolk start with 1 extra Mastery Point.</p>",
    action_type: "passive"
  });

  await createAbility(intrepidFolder, {
    name: "Gizmodius",
    description: "<p>An integral part of an Intrepids adventure, created to be malleable and change shape - this item can become a different enchanted item by using a Swift Action and 1 Mana. Some items might need a refresh of 1 Mana after a certain number of uses.</p>",
    action_type: "passive",
    mana_cost: 1,
    other_restrictions: "Swift Action to change shape, costs 1 Mana"
  });

  console.log("Smallfolk (Intrepid) new abilities done.");

  // ============================================================
  // SUNBORN — new abilities
  // ============================================================
  const sunbornFolder = await getOrCreateFolder("Sunborn");

  await createAbility(sunbornFolder, {
    name: "Too Bright to Hide",
    description: "<p>As a Sunborn you naturally emit low levels of light. Unfortunately, this means you're less than proficient at stealth. Your Hide checks have a -2 when used against Sight but you can always see within 1 space of you.</p>",
    action_type: "passive",
    range: "1"
  });

  await createAbility(sunbornFolder, {
    name: "Born of Flames",
    description: "<p>You are resistant to external \"fire\" and \"heat\". If a skill, effect or magyk has fire included in its name or description the amount of damage you take is reduced by half. You are also immune to the Burning Condition. Lava does not count as fire. If you become Soaked, you cannot use your Flamedance until the Soaked condition is removed.</p>",
    action_type: "passive"
  });

  await createAbility(sunbornFolder, {
    name: "Sunborn Flamedance",
    description: "<p>Each Sunborn can store up to 4 Embers. Embers are used to fuel the different Flares of the Flamedance and are restored by resting by fire for 1 Hour, using Fire Eater or touching a Spring of Life.</p>",
    action_type: "passive",
    other_restrictions: "Restored by 1 hour rest by fire, Fire Eater ability, or Spring of Life",
    charges_max: 4
  });

  console.log("Sunborn new abilities done.");

  // ============================================================
  // TRAVELER — new abilities
  // ============================================================
  const travelerFolder = await getOrCreateFolder("Traveler");

  await createAbility(travelerFolder, {
    name: "A Gift of the Heart",
    description: "<p>Travelers awakens in Alstoria with a boon, a blessing that represents their nature, drive, or their purpose in this new world. While Travelers might not have as many influences from the World as other Folk, their boon makes them a powerful force against the threats of the World. Choose one of the four boons: Dawnkeeper, Starchaser, Wavewatcher, or Puck.</p>",
    action_type: "passive",
    other_restrictions: "Choose one boon at character creation"
  });

  await createAbility(travelerFolder, {
    name: "The Greying",
    description: "<p>The sense of loss is a deep one within Travelers, regardless of how they arrived there is always a sense of longing for home, deep within them. This creates an opening for assaults on their mind; whenever a Traveler attempts to resist effects, magykal and otherwise, that target their mind they have a -1 penalty to their roll.</p>",
    action_type: "passive"
  });

  await createAbility(travelerFolder, {
    name: "Boon of Starchaser - Light-Footed",
    description: "<p>Whenever your Movement is increased via this Boons active ability, a Hex, an Elixir, or Skill, you become immune to any effects or conditions that would reduce your Movement.</p>",
    action_type: "passive",
    other_restrictions: "Only applies when Movement is increased"
  });

  console.log("Traveler new abilities done.");

  // ============================================================
  // WILDKIN — new abilities
  // ============================================================
  const wildkinFolder = await getOrCreateFolder("Wildkin");

  await createAbility(wildkinFolder, {
    name: "Adaptive Size",
    description: "<p>Choose whether you are Small or Medium size. Your Weight Class is 4.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Beast Speech",
    description: "<p>You can generally communicate ideas to non-hostile animals as well as understand them loosely, as animal thought is simpler than those of Folk.</p>",
    action_type: "passive",
    other_restrictions: "Only with non-hostile animals"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Land",
    description: "<p>You gain +3 Maximum Movement.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Sea",
    description: "<p>You can breathe underwater and gain Swimming Expertise.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Sand and Snow",
    description: "<p>When you take this adaptation, choose whether to be Immune to Torrid Heat or Freezing Wind and gain Marching Expertise.</p>",
    action_type: "passive",
    other_restrictions: "Choose immunity: Torrid Heat OR Freezing Wind"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Jungle",
    description: "<p>You gain Climbing Expertise and any checks made to detect you are made with a -3.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Sky",
    description: "<p>You have wings. You are immune to falling damage as long as you are not restrained or grappled. The distance you fall is reduced by half and can move in any horizontal direction while falling up to the amount of spaces you'd fall. You move in this direction and fall at the same time.</p>",
    action_type: "passive",
    other_restrictions: "Cannot be restrained or grappled for falling immunity"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Powerful Build",
    description: "<p>You gain +2 to any Strength and Endurance Rolls.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Lithe",
    description: "<p>You gain +2 to any Nimbleness and Finesse Rolls.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Night Hunter",
    description: "<p>You gain Nightvison, allowing you to see as clear in the dark as you do in the day up to 10 spaces and your eyes are reflective.</p>",
    action_type: "passive",
    range: "10"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Tail",
    description: "<p>You have a tail and can use it to Cling to a surface without using your hands, so long as you aren't moving. You gain an additional free item interaction.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Exoskeleton",
    description: "<p>You have +3 Maximum Health and 1 Physical Damage Reduction.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Bulk",
    description: "<p>You gain 6 Maximum Health.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Echolocation",
    description: "<p>You gain use your Hearing Sense in place of your Sight and Touch Senses.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Poisonous",
    description: "<p>If a creature inflicts the Bleeding Wounds condition on you and is within 1 Space or bites you, you inflict them with Draining Poison.</p>",
    action_type: "passive",
    range: "1",
    other_restrictions: "Trigger: creature inflicts Bleeding Wounds on you or bites you"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - High Jumper",
    description: "<p>Your Nimbleness and Strength increase by 1 and your Leap Height/Distance gain a +3.</p>",
    action_type: "passive"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Beast Senses (Single)",
    description: "<p>Choose one Sense. You roll that Sense with a +2. You can take this adaptation twice and cannot choose the same sense for the +2 option.</p>",
    action_type: "passive",
    other_restrictions: "Can be taken twice, cannot duplicate sense choices"
  });

  await createAbility(wildkinFolder, {
    name: "Wildkin Adaptation - Beast Senses (Dual)",
    description: "<p>Choose two Senses. You roll both with a +1. You can take this adaptation twice and cannot choose the same sense for the +2 option.</p>",
    action_type: "passive",
    other_restrictions: "Can be taken twice"
  });

  console.log("Wildkin new abilities done.");

  // ============================================================
  // DONE
  // ============================================================
  ui.notifications.info(`Folk Abilities import (Part 2) complete! ${created} new abilities added, ${skipped} duplicates skipped.`);
  console.log(`=== IMPORT COMPLETE === Created: ${created}, Skipped: ${skipped}`);

})();
