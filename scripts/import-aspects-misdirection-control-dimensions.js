// ============================================================
// STRYDER — Aspect Import: Misdirection, Control, Dimensions
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
  ui.notifications.info("Starting Aspect import (Misdirection, Control, Dimensions)…");

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

  // ── MISDIRECTION ──────────────────────────────────────────
  const misdirFolder = await getOrCreateFolder("Aspect of Misdirection");
  const mId = misdirFolder.id;

  // Core
  await upsertItem(ability(mId, 1, "Tricks of the Trade", "trigger", 1, 0, 0, "", "", "",
    `<strong>Trigger:</strong> You make a Focused Attack.</p><p>Choose one of the following:</p><ul><li><strong>Phenomenon:</strong> +2 to your Attack Roll if the opponent has not seen this maneuver this Engagement.</li><li><strong>Flick of the Wrist:</strong> Leap 3 spaces before attacking; gain +2 range; attack without Line of Sight if you had it before leaping; +2 Attack Roll against unseen targets.</li></ul><p><em>Attached Bonus: Tricks of the Trade costs no Stamina.</em>`));

  await upsertItem(ability(mId, 2, "Magician's Dance", "passive", 0, 0, 0, "", "", "",
    `When you Dodge, take −1 to your Dodge roll. If you succeed anyway: Dash through the attacker's space (regardless of their size), emerge on the other side, and then either gain the Energized condition OR cause the attacker to be Dropped.`));

  await upsertItem(ability(mId, 3, "Attached Bonus", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Bonus:</em> Tricks of the Trade costs no Stamina.`));

  // Abilities
  await upsertItem(ability(mId, 4, "Vanishing Act", "trigger", 3, 0, 3, "", "", "",
    `<strong>Trigger:</strong> You are targeted by an ability with an Attack Roll.</p><p>Make a Dodge roll (+1 bonus). On success: blink 6 spaces and make a Quick Attack (+2 to roll, +1 base damage).`));

  await upsertItem(ability(mId, 5, "High Misdirection", "swift", 2, 0, 0, "aid", "", "",
    `Immediately after making a melee Focused Attack: Dash 3 spaces and make 2 Quick Attacks (3 base damage, +3 to hit, both have [Sunder]).`));

  await upsertItem(ability(mId, 6, "Pick a Card", "swift", 2, 0, 3, "aid", "", "",
    `Choose the Passive effect directly, or roll a d6 for the Passive effect plus a Bonus:</p><ul><li><strong>1–2:</strong> +2 range / +2 damage</li><li><strong>3–4:</strong> +Soul damage / +1 roll</li><li><strong>5–6:</strong> +1 roll +2 base (no LoS bypass) / +3 base</li></ul><p>Your next Focused Attack gains the benefits of Flick of the Wrist.`));

  await upsertItem(ability(mId, 7, "Now You See It", "focused", 2, 0, 2, "", "", "",
    `All enemies within 3 spaces must make a Magykal Resistance roll against your Physical Potency. On a failure, they are distracted (+1 to your attack rolls against them). Then make a Focused Attack; on a hit, deal additional damage equal to [Soul].`));

  await upsertItem(ability(mId, 8, "Smoke and Mirrors", "swift", 1, 0, 4, "", "", "",
    `Use in sequence for enhanced effects:</p><ul><li><strong>Smoke:</strong> Break Line of Sight and attack without LoS (−3 roll, but target is Staggered against it). If used after Mirrors: −1 roll instead.</li><li><strong>Mirrors:</strong> Blink 2 spaces, roll attack +2, deal half damage. If used after Smoke: +4 roll instead.</li></ul>`));

  await upsertItem(ability(mId, 9, "Fools Facade", "trigger", 1, 0, 0, "breach", "", "",
    `<strong>Trigger:</strong> You benefit from Phenomenon.</p><p>Blink 6 spaces, gain the Energized condition, and your base damage increases by [Soul] until the start of the next Player Phase.`));

  await upsertItem(ability(mId, 10, "Night of a Thousand Fantasms", "swift", 8, 0, 4, "breach", "", "",
    `Make a Focused Attack (+3 roll, reroll up to 3 times). On a hit: ignore Armor, deal base damage equal to [5×Soul + 5], and the target is Senseless until the end of the Player Phase.`));

  ui.notifications.info("Misdirection imported ✓");

  // ── CONTROL ───────────────────────────────────────────────
  const controlFolder = await getOrCreateFolder("Aspect of Control");
  const cId = controlFolder.id;

  // Core
  await upsertItem(ability(cId, 1, "Establish Domain", "passive", 0, 0, 0, "", "", "",
    `At the start of combat, automatically establish a Magnitude 4 Domain centered on you. The Domain moves with you.</p><p>Within your Domain: you may interact with any space via telekinesis; Focused Attacks ignore Line of Sight; you substitute Soul for Stat/Talent rolls where applicable.</p><p>The Domain ends if you enter Last Breaths (re-establish for 1 Mana). While Senseless, you lose all Domain benefits until the condition ends.`));

  await upsertItem(ability(cId, 2, "Push and Pull", "focused", 0, 0, 0, "", "", "",
    `Push or pull a creature within your Domain. The target makes a Physical Resistance roll against your Potency. On a failure, they are pushed or pulled [Soul + 3] spaces.`));

  await upsertItem(ability(cId, 3, "Attached Effect", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Effect:</em> Your Potency is considered 1 higher for all Control skills.`));

  // Abilities
  await upsertItem(ability(cId, 4, "Mystic Artillery", "focused", 2, 0, 3, "", "", "",
    `Make a Focused Attack against a creature within your Domain. Gain +2 to your Attack Roll if the target is within Line of Sight. This attack deals [2×Soul] damage.`));

  await upsertItem(ability(cId, 5, "Willing Ward", "trigger", 1, 0, 5, "aid", "", "",
    `<strong>Cost:</strong> 1–3 Stamina &nbsp;|&nbsp; <strong>Trigger:</strong> A creature would take damage.</p><p>Ward a target within your Domain. The Ward's Durability equals [Soul × Stamina spent]. It disappears on the first hit and cannot be stacked.`));

  await upsertItem(ability(cId, 6, "Starwalker", "swift", 1, 0, 0, "", "", "",
    `<strong>Also usable as a Trigger Action (Trigger: You are targeted by an attack).</strong></p><p>Move yourself to any unoccupied location within your Domain.</p><p><strong>As a Trigger:</strong> Make a Dodge roll, substituting Soul instead of Reflex. On success: Dodge the attack and teleport. On failure: you stay and are Stunned.`));

  await upsertItem(ability(cId, 7, "Weight of Will", "focused", 3, 0, 2, "", "", "",
    `Target a creature within your Domain. They make a Magykal Resistance roll. On a failure, their Stamina and Movement become 0 until the end of the Player Phase.`));

  await upsertItem(ability(cId, 8, "Barrier", "swift", 1, 0, 4, "", "", "",
    `<strong>Cost:</strong> 1–3 Stamina.</p><p>Create an invisible barrier in an unoccupied space within your Domain. Its Durability equals [Will × Stamina spent]. Lasts 1 minute or until broken.`));

  await upsertItem(ability(cId, 9, "Crushing Vice", "focused", 3, 0, 2, "", "", "",
    `Target a creature within your Domain. They make a Magykal Resistance roll. On a failure, they take [2×Soul] damage and are Stunned.`));

  await upsertItem(ability(cId, 10, "Rain of Domination", "focused", 6, 0, 1, "", "", "",
    `All chosen creatures within your Domain must make a Magykal Resistance roll. On a failure, each takes [3×Soul] damage, is Dropped, and is Stunned.`));

  ui.notifications.info("Control imported ✓");

  // ── DIMENSIONS ────────────────────────────────────────────
  const dimFolder = await getOrCreateFolder("Aspect of Dimensions");
  const dimId = dimFolder.id;

  // Core
  await upsertItem(ability(dimId, 1, "Rift-Maker", "swift", 2, 0, 0, "", "", "",
    `Create a Rift within range. Rifts are immaterial (they do not block Line of Sight or movement). They persist until the end of the Engagement. Only 1 Rift can exist per space.`));

  await upsertItem(ability(dimId, 2, "Dimension Walker", "passive", 0, 0, 0, "", "", "",
    `When you enter a Rift, you immediately transpose to any other Rift within 15 spaces (the destination must be unoccupied or have an adjacent free space).`));

  await upsertItem(ability(dimId, 3, "Attached Effect", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Effect:</em> At the start of every Engagement, automatically create 2 Rifts within 4 spaces of you.`));

  // Abilities
  await upsertItem(ability(dimId, 4, "Distance is Irrelevant", "passive", 0, 0, 0, "", "", "",
    `You can target any Rift as your attack origin when selecting a target. The attack resolves as if you were attacking from that Rift's position.`));

  await upsertItem(ability(dimId, 5, "Crushing Vice", "focused", 2, 0, 3, "", "", "",
    `Your next attack deals additional damage equal to [2×Fracture].</p><p><strong>Passive:</strong> Entering a Rift gives you 1 Fracture (each Rift can only grant Fracture once per Round).`));

  await upsertItem(ability(dimId, 6, "Gates of Crossing", "swift", 3, 0, 3, "", "", "",
    `Create 2 Rifts within range. Select any 2 Rifts within 10 spaces to become Gates. Any creature can enter one Gate and immediately exit from the other.`));

  await upsertItem(ability(dimId, 7, "Rift Leap", "swift", 1, 0, 4, "", "", "",
    `Move into the nearest unoccupied Rift within [2×Armament Range] spaces.`));

  await upsertItem(ability(dimId, 8, "Spatial Rend", "swift", 4, 0, 3, "", "", "",
    `Select up to 4 unoccupied spaces within 10 spaces. Create a Rift in each selected space.`));

  await upsertItem(ability(dimId, 9, "Event Horizon", "focused", 8, 0, 2, "", "", "",
    `<strong>Cost:</strong> 8 + X additional Stamina (X = Rounds of duration).</p><p>Target up to [Soul] creatures. Each makes a Magykal Resistance roll. On a failure, they are removed from the Engagement into an external Magnitude 4 space for X Rounds, then return.`));

  await upsertItem(ability(dimId, 10, "Storm of Collapse", "focused", 12, 0, 1, "", "", "",
    `Detonate every Rift on the field. All creatures within 2 spaces of each Rift must make a Magykal Resistance roll. On a failure, they take [Soul] damage per Rift they were within range of. All Rifts are removed.`));

  ui.notifications.info("Dimensions imported ✓");

  // ── Lock pack ─────────────────────────────────────────────
  await pack.configure({ locked: true });
  ui.notifications.info("✅ Import complete! Misdirection, Control & Dimensions are in the compendium.");
})();
