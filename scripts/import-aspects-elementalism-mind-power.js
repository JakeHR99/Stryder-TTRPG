// ============================================================
// STRYDER — Aspect Import: Elementalism, Mind, Power
// ============================================================
// HOW TO USE:
// 1. Open Foundry VTT and load your Stryder world
// 2. Press F12 to open the developer console
// 3. Copy and paste this ENTIRE script into the console
// 4. Press Enter and wait for "Import complete!" notification
// ============================================================

(async () => {
  const PACK_ID = "stryder.stryder-actions";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error("Could not find stryder-actions compendium!"); return; }
  await pack.configure({ locked: false });
  await pack.getDocuments();
  ui.notifications.info("Starting Aspect import (Elementalism, Mind, Power)…");

  // ── Helpers ──────────────────────────────────────────────
  async function getOrCreateFolder(name, parentId = null) {
    let folder = pack.folders.find(f => f.name === name);
    if (folder) return folder;
    const data = { name, type: "Item", folder: parentId, sorting: "m", color: null };
    folder = await Folder.create(data, { pack: PACK_ID });
    return folder;
  }

  async function upsertItem(data) {
    const existing = pack.contents.find(i => i.name === data.name && i.folder?.id === data.folder);
    if (existing) {
      await existing.update(data);
      return existing;
    }
    return await Item.create(data, { pack: PACK_ID });
  }

  const stats = {
    compendiumSource: null, duplicateSource: null,
    coreVersion: "13.351", systemId: "stryder", systemVersion: "0.2.1",
    createdTime: null, modifiedTime: null, lastModifiedBy: null, exportSource: null
  };

  function ability(folderId, sortIdx, name, action_type, stamina, mana = 0, limit = 0, tag1 = "", tag2 = "", tag3 = "", description = "") {
    return {
      name, type: "action", img: "icons/svg/aura.svg",
      folder: folderId,
      sort: sortIdx * 100000,
      system: {
        description: `<p>${description}</p>`,
        action_type, stamina_cost: stamina, mana_cost: mana, tactics_cost: 0,
        other_restrictions: "",
        roll: { diceBonus: 0, diceNum: 2, diceSize: 6 },
        limit: { max: limit, value: 0 },
        hasReflexTag: false,
        isAspectAbility: true,
        tag1, tag2, tag3
      },
      effects: [], ownership: { default: 0 }, flags: {}, _stats: stats
    };
  }

  // ── ELEMENTALISM ──────────────────────────────────────────
  const elemFolder = await getOrCreateFolder("Aspect of Elementalism");
  const eId = elemFolder.id;

  // Core
  await upsertItem(ability(eId, 1, "Elemental Spark", "swift", 1, 0, 0, "", "", "",
    `Choose an element: Fire, Water, Earth, or Air. Your next Focused Attack or Skill gains that element's effect:</p><ul><li><strong>Fire:</strong> +Soul damage. On a Good or higher roll: target gains the Burning condition.</li><li><strong>Water:</strong> On a Good or higher roll: target is Soaked. On a failed Evasion: creatures within 1 space take half damage + Soaked.</li><li><strong>Earth:</strong> +2 base damage, damage becomes Physical. On an Excellent roll: regain 1 Stamina.</li><li><strong>Air:</strong> +2 range. Breach abilities made against it receive −1.</li></ul>`));

  await upsertItem(ability(eId, 2, "Natural Draw", "passive", 0, 0, 0, "", "", "",
    `You can use nearby natural element sources within range as your attack origin. Using a natural source does not consume a Skill Limit charge; however, the source is consumed if its Magnitude is 2 or less.`));

  await upsertItem(ability(eId, 3, "Attached Effect", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Effect:</em> The first Elemental Spark or Elemental Mastery you use each Round costs 1 less Stamina.`));

  // Abilities
  await upsertItem(ability(eId, 4, "Elemental Mastery", "swift", 2, 0, 0, "", "", "",
    `Upgrade your currently active element to its advanced form. Your next Focused Attack gains the advanced elemental effect:</p><ul><li><strong>Fire → Lightning:</strong> +[2×Soul] damage. On a Good or higher roll: target is Shocked.</li><li><strong>Water → Ice:</strong> On a Good or higher roll: the target and any nearby Soaked creatures become Frozen.</li><li><strong>Earth → Metal:</strong> +4 base damage, Physical damage type. On a Good or higher roll: target gains 1 Bleeding Wound.</li><li><strong>Air → Pressure:</strong> No Line of Sight required. On a Good or higher roll: target is Staggered.</li></ul>`));

  await upsertItem(ability(eId, 5, "Natural Mastery", "passive", 0, 0, 0, "", "", "",
    `Elemental Mastery also affects your next Skill (not just your next Focused Attack). Additional effects per element:</p><ul><li><strong>Lightning:</strong> +Soul damage; Burning → Shocked.</li><li><strong>Ice:</strong> Movement damage → +Soul + Frozen if target is Soaked.</li><li><strong>Metal:</strong> All damage becomes Physical; Good+ → Bleeding Wound.</li><li><strong>Pressure:</strong> Movement damage → +Soul + 2 extra spaces pushed.</li></ul>`));

  await upsertItem(ability(eId, 6, "Extract Element", "swift", 2, 0, 5, "", "", "",
    `Remove one of the following conditions from an ally within range: Burning, Soaked, Poisoned, or Shocked. You gain the corresponding Elemental Spark (Fire/Water/Earth/Air respectively).`));

  await upsertItem(ability(eId, 7, "Primordial Blast", "focused", 1, 0, 4, "", "", "",
    `Make a Focused Attack with base damage of [Soul + 3]. The elemental effects depend on your active element:</p><ul><li><strong>Fire:</strong> +[2×Soul] additional damage + Burning (Magykal Resist).</li><li><strong>Water:</strong> Target pushed 3 spaces + Soaked (Magykal Resist).</li><li><strong>Earth:</strong> +Soul additional damage + Trapped (Physical Resist).</li><li><strong>Air:</strong> No Line of Sight required + Dropped (Physical Resist).</li></ul>`));

  await upsertItem(ability(eId, 8, "Elemental Assault", "swift", 2, 0, 3, "", "", "",
    `Target a creature that currently has an elemental condition. Deal [Soul] damage and amplify their condition:</p><ul><li><strong>Burning → Suffocating</strong></li><li><strong>Soaked → Frozen</strong></li><li><strong>Poisoned →</strong> advance one Poison stage</li><li><strong>Shocked → Stunned</strong></li></ul>`));

  await upsertItem(ability(eId, 9, "Eruption", "focused", 3, 0, 2, "", "", "",
    `Select up to 3 spaces or a Magnitude 1 area. All creatures in the area must make an Evasion roll. On a failure: [Soul] damage + Stunned. Additional elemental effects:</p><ul><li><strong>Fire:</strong> Pillar of flame — +Soul damage, the space burns.</li><li><strong>Water:</strong> Geyser — Soaked + sent Airborne 2 spaces.</li><li><strong>Earth:</strong> Earthen pillar — Durability [2×Soul], lifts creatures upward.</li><li><strong>Air:</strong> Blow creatures Airborne 4 spaces + pushed 2 spaces.</li></ul>`));

  await upsertItem(ability(eId, 10, "Elemental Construct", "focused", 3, 0, 1, "", "", "",
    `Make 2 Quick Attacks at [Soul + 3] each. If both hit the same target, they are Dropped. Additional effects per element:</p><ul><li><strong>Fire:</strong> [2×Soul] + a third attack.</li><li><strong>Water:</strong> First hit → Soaked; both hit → Frozen.</li><li><strong>Earth:</strong> Both hit → Stunned.</li><li><strong>Air:</strong> First hit → Shocked; both hit → pushed 3 spaces.</li></ul>`));

  await upsertItem(ability(eId, 11, "Calamity", "focused", 6, 0, 2, "", "", "",
    `Create a Magnitude 3 area effect. Creatures who fail their Magykal Resistance cannot react (no Breach abilities against this). At the start of the next Phase: [2×Soul] damage + Staggered (failed Evasion). Additional elemental effects:</p><ul><li><strong>Fire:</strong> [4×Soul] + Burning.</li><li><strong>Water:</strong> Soaked + Dropped.</li><li><strong>Earth:</strong> [3×Soul] + Marching Terrain.</li><li><strong>Air:</strong> Airborne + pushed 5 spaces.</li></ul>`));

  ui.notifications.info("Elementalism imported ✓");

  // ── MIND ──────────────────────────────────────────────────
  const mindFolder = await getOrCreateFolder("Aspect of Mind");
  const mId = mindFolder.id;

  // Core
  await upsertItem(ability(mId, 1, "Whispering Schemes", "focused", 0, 0, 0, "", "", "",
    `Make a Focused Attack that deals half damage. The target makes a Magykal Resistance roll. On a failure, choose one condition to apply:</p><ul><li><strong>Panicked</strong></li><li><strong>Confused</strong></li><li><strong>Poisoned</strong> (Stage 1)</li></ul><p>The target can attempt to end the effect early during the following Challenger Phase (Focused Action), and re-rolls to resist at the start of each Challenger Phase.`));

  await upsertItem(ability(mId, 2, "Swaying Mind", "passive", 0, 0, 0, "", "", "",
    `Your Focused Attacks deal +1 additional damage per Harmful or Debilitating condition on the target (maximum +5).`));

  await upsertItem(ability(mId, 3, "Attached Effect", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Effect:</em> Your Focused Attacks ignore Armor.`));

  // Abilities
  await upsertItem(ability(mId, 4, "Horror, Consuming", "swift", 3, 0, 3, "", "", "",
    `<strong>Also usable as a Trigger Action (Trigger: Whispering Schemes applies Panicked).</strong></p><p>Target a creature that is Panicked. They make a Magykal Resistance roll. On a failure, they gain the <strong>Horrified</strong> condition — their attacks always deal Poor damage. This condition lasts as long as they remain Panicked.`));

  await upsertItem(ability(mId, 5, "Delusions, Worsening", "swift", 3, 0, 3, "", "", "",
    `<strong>Also usable as a Trigger Action (Trigger: Whispering Schemes applies Confused).</strong></p><p>Target a creature that is Confused. They make a Magykal Resistance roll. On a failure, they gain the <strong>Addled</strong> condition — they no longer regain resources lost from the Confused condition. This condition lasts as long as they remain Confused.`));

  await upsertItem(ability(mId, 6, "Sickness, Festering", "swift", 3, 0, 3, "", "", "",
    `<strong>Also usable as a Trigger Action (Trigger: Whispering Schemes applies Poisoned).</strong></p><p>Target a creature that is Poisoned. Advance their Poison by 1 stage, apply Draining Poison, and cause them to lose [Soul] Health per Challenger Phase. This condition lasts as long as they remain Poisoned.`));

  await upsertItem(ability(mId, 7, "Mind, Unraveling", "swift", 1, 0, 4, "", "", "",
    `<strong>Cost:</strong> 1–3 Stamina.</p><p>Target a creature with at least 1 Harmful or Debilitating condition. They make a Magykal Resistance roll. On a failure, deal [Soul] damage multiplied by the number of conditions they have.`));

  await upsertItem(ability(mId, 8, "Siphon Weakness", "swift", 2, 0, 3, "", "", "",
    `Remove the Confused, Panicked, or Stunned condition from a target within range. Gain +2 Magykal Potency until the end of the next Round.`));

  await upsertItem(ability(mId, 9, "Fool's Paradise", "focused", 3, 0, 2, "", "", "",
    `<strong>Cost:</strong> 3 Stamina per target.</p><p>Target up to [Soul] creatures. Each makes a Magykal Resistance roll. On a failure, they fall Unconscious in a pleasant dream-sleep. Any damage wakes them; they cannot be shaken awake by other means.`));

  await upsertItem(ability(mId, 10, "Sinner's Repose", "focused", 5, 0, 2, "", "", "",
    `Target a creature. They make a Magykal Resistance roll. On a failure, deal [Soul × 3] damage plus an additional [Soul] damage per Harmful or Debilitating condition they have. Unconscious targets automatically fail this resistance.`));

  ui.notifications.info("Mind imported ✓");

  // ── POWER ─────────────────────────────────────────────────
  const powerFolder = await getOrCreateFolder("Aspect of Power");
  const pwrId = powerFolder.id;

  // Core
  await upsertItem(ability(pwrId, 1, "Atlas Fist", "passive", 0, 0, 0, "", "", "",
    `All of your Focused Attacks gain the following modifications: the Excellent threshold decreases by 1; the Poor threshold decreases by 1; base damage is permanently +1.`));

  await upsertItem(ability(pwrId, 2, "Unbreakable", "swift", 1, 0, 5, "", "", "",
    `<strong>Cost:</strong> 1–3 Stamina.</p><p>Gain +1 Physical Damage Reduction per Stamina spent (maximum +3). This lasts until the start of your next Player Phase.`));

  await upsertItem(ability(pwrId, 3, "Attached Effect", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Effect:</em> Your base damage increases by an additional +1 (for a total of +2 from Core abilities alone).`));

  // Abilities
  await upsertItem(ability(pwrId, 4, "Thunderous Crash", "swift", 2, 0, 3, "", "", "",
    `Your next Focused Attack deals additional damage equal to [Soul + 3]. On a hit, the target must make a Physical Resistance roll. On a failure, they are sent flying Airborne (number of spaces equal to the damage taken).`));

  await upsertItem(ability(pwrId, 5, "Full Drive", "swift", 1, 0, 5, "", "", "",
    `Your Maximum Movement increases by +4. You can traverse Water and Marching Terrain, but cannot take actions while crossing until you reach stable ground.`));

  await upsertItem(ability(pwrId, 6, "Remove Limiter", "swift", 1, 0, 3, "", "", "",
    `<strong>Cost:</strong> 1–3 Stamina.</p><p>Gain +1 to Reflex Rolls per Stamina spent (maximum +3). Lasts until the start of your next Player Phase.`));

  await upsertItem(ability(pwrId, 7, "Falling Star", "focused", 3, 0, 2, "", "", "",
    `Leap at no cost (+3 to Leap distance, no fall damage). Crash down in a chosen space within 1 space of your target. All creatures within a Magnitude 1 area must make an Evasion roll. On a failure: take [2×Soul] damage, Dropped, and Stunned.`));

  await upsertItem(ability(pwrId, 8, "Body Flicker", "swift", 2, 0, 3, "", "", "",
    `Until the end of the Player Phase: your Maximum Movement increases by +2, and any movement you make breaks Line of Sight.`));

  await upsertItem(ability(pwrId, 9, "Rain of Domination", "focused", 4, 0, 5, "", "", "",
    `Regain Health equal to [Soul].`));

  await upsertItem(ability(pwrId, 10, "Starwalker", "swift", 4, 0, 2, "", "", "",
    `Until the end of the current Phase, all damage from your Aspect of Power abilities is doubled.`));

  ui.notifications.info("Power imported ✓");

  // ── Lock pack ─────────────────────────────────────────────
  await pack.configure({ locked: true });
  ui.notifications.info("✅ Import complete! Elementalism, Mind & Power are in the compendium.");
})();
