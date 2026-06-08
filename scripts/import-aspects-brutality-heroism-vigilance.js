// ============================================================
// STRYDER — Aspect Import: Brutality, Heroism, Vigilance
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
  ui.notifications.info("Starting Aspect import (Brutality, Heroism, Vigilance)…");

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

  // ── BRUTALITY ─────────────────────────────────────────────
  const brutalityFolder = await getOrCreateFolder("Aspect of Brutality");
  const bId = brutalityFolder.id;

  // Core
  await upsertItem(ability(bId, 1, "Impending Doom", "focused", 0, 0, 0, "", "", "",
    `Charge up your next attack. Your next Focused Attack on the following Round becomes a Swift Action, its base damage equals [2×Soul], and it gains +1 Ichor on a hit.</p><p><strong>Penalty:</strong> You suffer −1 to Dodge and Evasion rolls for the round you activate this ability.`));

  await upsertItem(ability(bId, 2, "Ichor's Edge", "swift", 0, 0, 0, "aid", "", "",
    `<strong>Cost:</strong> 1+ Ichor &nbsp;|&nbsp; Can also be used as a Trigger Action.</p><p>Consume any amount of Ichor. Your next attack deals +2 additional damage per Ichor consumed.`));

  await upsertItem(ability(bId, 3, "Ichor Form Passive", "passive", 0, 0, 0, "", "", "",
    `Gain 1 Ichor (max 8) whenever you deal or take at least 1 damage. At the end of every Engagement, you regain Health equal to your current Ichor amount.`));

  await upsertItem(ability(bId, 4, "Attached Bonus", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Bonus:</em> You begin every Engagement with 3 Ichor.`));

  // Abilities
  await upsertItem(ability(bId, 5, "Endless Thorns", "trigger", 1, 0, 0, "", "", "",
    `<strong>Trigger:</strong> You are dealt damage.</p><p>Consume 2 Ichor to make a Quick Attack against the creature that dealt the damage, provided they are within your Armament range.`));

  await upsertItem(ability(bId, 6, "Onset of Doom", "swift", 1, 0, 3, "", "", "",
    `Your next Focused Attack inflicts the Panicked condition on the target for 2 Rounds.</p><p><strong>Form Passive:</strong> Attacks against Panicked creatures give you +1 extra Ichor from Bleeding Ichor.`));

  await upsertItem(ability(bId, 7, "Gouging Claw", "swift", 3, 0, 3, "", "", "",
    `Before making your next Focused Attack: Dash up to 4 spaces and deal additional damage equal to [Soul + 3] with that attack.`));

  await upsertItem(ability(bId, 8, "Hellish Cleave", "swift", 2, 0, 0, "multi-target", "", "",
    `Your next attack can target additional creatures within range. For each 1 Ichor consumed, target 1 additional creature. All targets are hit on a failed Evasion roll.`));

  await upsertItem(ability(bId, 9, "Impenetrable Will", "trigger", 0, 0, 4, "", "", "",
    `<strong>Trigger:</strong> You are targeted by a [Control] ability.</p><p>Consume any amount of Ichor. Gain +2 to your Physical or Magykal Resistance roll against that ability per Ichor consumed.`));

  await upsertItem(ability(bId, 10, "Ichor Aura", "trigger", 3, 1, 1, "", "", "",
    `<strong>Trigger:</strong> You start the Player Phase with 8 Ichor.</p><p>Until the end of the Round, gain the following benefits: your Armament Range increases by +1; Bleeding Ichor generates 2 Ichor instead of 1; spend Ichor for +3 Movement per Ichor; if you are damaged while Impending Doom is active, immediately make a Focused Attack against the attacker.`));

  await upsertItem(ability(bId, 11, "Death or Glory", "trigger", 2, 1, 2, "", "", "",
    `<strong>Trigger:</strong> You would fall into Last Breaths.</p><p>Gain 4 Ichor (this can exceed your cap of 8). Choose how much Ichor to expend and regain 2 Health per Ichor spent.`));

  ui.notifications.info("Brutality imported ✓");

  // ── HEROISM ───────────────────────────────────────────────
  const heroismFolder = await getOrCreateFolder("Aspect of Heroism");
  const hId = heroismFolder.id;

  // Core
  await upsertItem(ability(hId, 1, "Master Cut", "swift", 1, 0, 0, "augment", "targeted", "",
    `Make a Quick Attack, altering the strike method. Cost increases by +1 Stamina after the first use within an Engagement.</p><p><strong>Method 1:</strong> +1 to Attack Roll.<br><strong>Method 2:</strong> −4 to Attack Roll, but the attack gains [Sunder].<br><strong>Method 3:</strong> Replace the Attack Roll with an Evasion roll.`));

  await upsertItem(ability(hId, 2, "Swift Step", "swift", 1, 0, 0, "aid", "", "",
    `<strong>Also usable as a Trigger Action (Trigger: You successfully Dodge).</strong></p><p>Dash up to 2 spaces. You may move through creature spaces, dealing damage equal to [Soul ÷ 2 (rounded up)] to any creature you pass through.</p><p><strong>As a Swift Action:</strong> Dash 2 spaces and move through spaces as above. Your next Focused or Quick Attack gains +1 to its attack roll.`));

  await upsertItem(ability(hId, 3, "Nightfall", "passive", 0, 0, 0, "aid", "", "",
    `Gain +1 Nightfall each time an attack lands. Your Nightfall count acts as a bonus to all attack rolls. Nightfall resets at the end of the current Phase.`));

  await upsertItem(ability(hId, 4, "Attached Bonus", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Bonus:</em> When you Dash, you move an extra 2 Spaces.`));

  // Abilities
  await upsertItem(ability(hId, 5, "High Thrust", "focused", 2, 0, 3, "", "", "",
    `Make a Focused Attack with base damage equal to [2×Soul]. You may Dash up to 3 spaces as part of this action.`));

  await upsertItem(ability(hId, 6, "Emerging Dawn", "swift", 1, 0, 3, "", "", "",
    `Make a Quick Attack. On a hit, the target must make a Physical Resistance roll. On a failure, they are Dropped.`));

  await upsertItem(ability(hId, 7, "Falling Dusk", "focused", 3, 0, 2, "", "", "",
    `Make a Focused Attack that ignores Wards and Armor. If the target is Dropped, deal additional damage equal to [Soul].`));

  await upsertItem(ability(hId, 8, "Variable Offense", "swift", 1, 0, 3, "aid", "", "",
    `Before making a Focused Attack, choose one of the following:</p><p><strong>Bastard Strike:</strong> Deal additional Soul damage (you must still make an attack this turn).<br><strong>Bash and Break:</strong> Make a Quick Attack with your free-hand item (no damage). On a hit, the target is Staggered.`));

  await upsertItem(ability(hId, 9, "Sweep", "focused", 1, 0, 3, "aid", "multi-target", "",
    `All creatures within range 1 must make an Evasion roll. On a failure, they take [2×Soul] damage, are knocked back, and are Dropped.`));

  await upsertItem(ability(hId, 10, "Finality", "focused", 6, 0, 1, "", "", "",
    `Make a Focused Attack with base damage of [2×Soul]. On a hit, your next Attack Roll cannot be lower than 12. Then make another Focused Attack with base damage of [4×Soul].`));

  ui.notifications.info("Heroism imported ✓");

  // ── VIGILANCE ─────────────────────────────────────────────
  const vigilanceFolder = await getOrCreateFolder("Aspect of Vigilance");
  const vId = vigilanceFolder.id;

  // Core
  await upsertItem(ability(vId, 1, "Chambered Ammunition", "passive", 0, 0, 0, "", "", "",
    `At combat start, choose which Ammo type to Chamber (1–4). Every Focused Attack automatically advances the Chamber by 1, looping back to 1 after 4.</p><p><strong>1. Full Metal:</strong> +4 additional damage.<br><strong>2. Boat Tail:</strong> +4 range.<br><strong>3. Soft Point:</strong> Range −2 (minimum 1), but Attack Roll +(same amount).<br><strong>4. Trick Shot:</strong> After attacking, Dash up to 2 spaces in any direction.`));

  await upsertItem(ability(vId, 2, "Primary Rotation", "swift", 1, 0, 0, "aid", "", "",
    `Manually select a different Ammo type to Chamber. Cycling continues from the new selection.`));

  await upsertItem(ability(vId, 3, "Attached Bonus", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Bonus:</em> Your Chamber goes up to 5, adding a fifth Ammo type:</p><p><strong>5. Explosive Round:</strong> Deals damage equal to [Soul] in a Magnitude 1 area on a failed Evasion.`));

  // Abilities
  await upsertItem(ability(vId, 4, "Eagle-Eye", "trigger", 1, 0, 4, "breach", "", "",
    `<strong>Trigger:</strong> You or a Party Member within Armament range is attacked.</p><p>Make a Quick Attack against the incoming Attack Roll. If your roll is equal to or higher than theirs, reduce the incoming attack's damage by your Soul Armament's damage.`));

  await upsertItem(ability(vId, 5, "Desperado Maneuvers", "passive", 0, 0, 0, "", "", "",
    `Gain 4 Maneuver Tokens at the start of each combat (all lost at combat end). Spend 1 Token + 1 Stamina per use:</p><p><strong>Showdown (Swift):</strong> +5 to your next Focused Attack roll.<br><strong>Put 'Em Down (Swift):</strong> Your next Focused Attack's base damage increases by [3×Soul].<br><strong>Fancy Footwork (Swift):</strong> Your Dodge and Evasion rolls gain +2 until the start of the next Player Phase.`));

  await upsertItem(ability(vId, 6, "Fan The Hammer", "focused", 3, 0, 2, "", "", "",
    `Make 3 Focused Attacks against the same or different targets. After this resolves, choose which Ammo type is Chambered.`));

  await upsertItem(ability(vId, 7, "Kneecapper", "swift", 1, 0, 4, "", "", "",
    `Make a Quick Attack within Armament range. On a hit, the target takes no damage but is forced back 2 spaces and Dropped on a failed Physical Resistance.`));

  await upsertItem(ability(vId, 8, "Line of Fire", "swift", 2, 0, 3, "aid", "", "",
    `Make a Quick Attack within Armament range with +2 to its Attack Roll.`));

  await upsertItem(ability(vId, 9, "Suppressive Fire", "trigger", 2, 0, 0, "aid", "", "",
    `<strong>Trigger:</strong> An enemy within Armament range attempts a Dodge, Evasion, or Attack Roll.</p><p>They suffer −2 to that roll.`));

  await upsertItem(ability(vId, 10, "Master of Arms", "passive", 0, 0, 0, "aid", "", "",
    `Primary Rotation costs no Stamina. Whenever an attack roll is Excellent, gain +1 to your next attack roll.`));

  ui.notifications.info("Vigilance imported ✓");

  // ── Lock pack ─────────────────────────────────────────────
  await pack.configure({ locked: true });
  ui.notifications.info("✅ Import complete! Brutality, Heroism & Vigilance are in the compendium.");
})();
