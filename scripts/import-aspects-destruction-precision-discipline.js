// ============================================================
// STRYDER — Aspect Import: Destruction, Precision, Discipline
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
  ui.notifications.info("Starting Aspect import (Destruction, Precision, Discipline)…");

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

  // ── DESTRUCTION ───────────────────────────────────────────
  const destroyFolder = await getOrCreateFolder("Aspect of Destruction");
  const dId = destroyFolder.id;

  // Core
  await upsertItem(ability(dId, 1, "Pierce", "swift", 2, 0, 5, "augment", "", "",
    `Your next Focused Attack ignores Armor and deals +3 additional damage.`));

  await upsertItem(ability(dId, 2, "Annihilate", "focused", 3, 0, 3, "aid", "", "",
    `Convert your Focused Attack into a Trigger Action ("You decide to make an Attack"), which must fire before the start of the next Player Phase.</p><p>While charging: all Destruction ability Stamina costs are reduced by 2.</p><p>Base damage equals [Soul × the number of abilities used while charging] (Annihilate itself counts as 1).</p><p><em>If Heart Killer is fired while Annihilate is active, Heart Killer fails but Annihilate's base damage increases by [6×Soul].</em>`));

  await upsertItem(ability(dId, 3, "Attached Bonus", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Bonus:</em> Annihilate becomes a Swift Action instead of a Focused Action.`));

  // Abilities
  await upsertItem(ability(dId, 4, "Kickback", "swift", 2, 0, 4, "", "", "",
    `All enemies within Armament range must make a Physical Resistance roll. On a failure, they take damage equal to [Soul], are knocked back 1 space, and are Dropped.`));

  await upsertItem(ability(dId, 5, "Sunder the Ranks", "swift", 4, 0, 4, "", "", "",
    `Make a Quick Attack against every enemy in a straight line up to [2×Armament Range] long.`));

  await upsertItem(ability(dId, 6, "Meteor Shower", "swift", 3, 0, 3, "", "", "",
    `Dash airborne up to [Soul] spaces (no fall damage). Before landing, make a Focused Attack with additional damage equal to [Soul], doubled range, and an Excellent threshold of −1.`));

  await upsertItem(ability(dId, 7, "Blitzbreak", "swift", 3, 0, 4, "aid", "", "",
    `Make a Quick Attack at half damage. On a hit, you may recast this ability once more at 1 Stamina (this second use does not consume a Limit charge).`));

  await upsertItem(ability(dId, 8, "Prodigious Assault", "swift", 1, 0, 3, "aid", "", "",
    `<strong>Cost:</strong> 1–3 Stamina.</p><p>Reroll your next Focused Attack roll up to the number of Stamina points spent.`));

  await upsertItem(ability(dId, 9, "Rending Pierce", "swift", 3, 0, 3, "aid", "", "",
    `Upgrade to Pierce: the next Pierce you use this turn deals additional damage equal to [2×Soul + 3] instead of its normal bonus.`));

  await upsertItem(ability(dId, 10, "Heart Killer", "focused", 8, 0, 2, "", "", "",
    `The target must make an Evasion roll against your Physical Potency. On a failure, deal [6×Soul] damage (+1 Potency per size category above Medium).</p><p><strong>Special:</strong> If Annihilate is currently active, this ability fails but Annihilate's base damage increases by [6×Soul] instead.`));

  ui.notifications.info("Destruction imported ✓");

  // ── PRECISION ─────────────────────────────────────────────
  const precisionFolder = await getOrCreateFolder("Aspect of Precision");
  const pId = precisionFolder.id;

  // Core
  await upsertItem(ability(pId, 1, "Soul Shards", "passive", 0, 0, 0, "aid", "persistent", "",
    `Every Focused Attack from your Soul Armament embeds 1 Soul Shard into the target (max 5 per creature). You gain +1 to Attack Rolls against a creature per Shard they carry.</p><p>You may also spend 1 Stamina as a Swift Action to fire a Shard into an unoccupied space (a Buried Shard).</p><p>Creatures can rip loose 1 Shard as a Swift Action, paying 1 Stamina + 1 Health per Shard removed.`));

  await upsertItem(ability(pId, 2, "Shatter", "trigger", 0, 0, 0, "breach", "persistent", "targeted",
    `<strong>Trigger:</strong> A Shard-embedded creature within Armament range makes an attack.</p><p>Burst all Shards on that creature: reduce their Attack Roll by a number equal to the Shards they had. All Shards are removed.`));

  await upsertItem(ability(pId, 3, "Attached Bonus", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Bonus:</em> You always Detect creatures who carry one of your Shards.`));

  // Abilities
  await upsertItem(ability(pId, 4, "Soul Charge", "swift", 2, 0, 3, "", "", "",
    `Your next Focused Attack embeds no Shard. Instead, its base damage equals [2×Soul].`));

  await upsertItem(ability(pId, 5, "Deadly Harvest", "swift", 3, 0, 4, "", "", "",
    `<strong>Range:</strong> 10 spaces.</p><p>Every Shard in the target convulses: the target loses Health equal to [3 × Shard count]. All Shards are removed.`));

  await upsertItem(ability(pId, 6, "Deadeye", "swift", 2, 0, 3, "", "", "",
    `Until the end of the Round, gain the following effects: <strong>Shard Resonance</strong> — +2 base damage per Shard on the target; <strong>Inescapable</strong> — +2 range.`));

  await upsertItem(ability(pId, 7, "Final Reaping", "trigger", 2, 0, 0, "", "", "",
    `<strong>Trigger:</strong> You make an Excellent Attack against a creature with 3 or more Shards.</p><p>That attack deals 2.5× damage instead of the normal 1.5×.`));

  await upsertItem(ability(pId, 8, "Final Flourish", "swift", 3, 0, 1, "", "", "",
    `Fire up to [Soul] Shards (range 10). Each can embed into a creature (auto-hit, no damage) or become a Buried Shard in an unoccupied space.`));

  await upsertItem(ability(pId, 9, "Hunting Shard", "swift", 1, 0, 4, "augment", "", "",
    `<strong>Also usable as a Trigger Action (Trigger: Your attack is dodged by a Shard-embedded creature).</strong></p><p><strong>As Trigger:</strong> Reroll the attack with +1. Whether hit or miss, remove 1 Shard from the target.<br><strong>As Swift Action:</strong> Your next attack ignores Line of Sight (target must have at least 1 Shard). You ignore the Blinded penalty against Shard-carriers.`));

  await upsertItem(ability(pId, 10, "Ingenuity", "swift", 1, 0, 0, "area", "", "",
    `<strong>Range:</strong> 10 spaces.</p><p>Detonate a Buried Shard. All creatures within a Magnitude 1 explosion must make an Evasion roll. On a failure, they take [Soul + 3] damage. If they fail by 3 or more, their Movement is reduced by 4.`));

  ui.notifications.info("Precision imported ✓");

  // ── DISCIPLINE ────────────────────────────────────────────
  const disciplineFolder = await getOrCreateFolder("Aspect of Discipline");
  const discId = disciplineFolder.id;

  // Core
  await upsertItem(ability(discId, 1, "Full-Body Assault", "passive", 0, 0, 0, "", "", "",
    `All Focused Attacks must be declared as a specific strike type before rolling:</p><ul><li><strong>Light:</strong> +1 to Attack Roll, −1 to Base Damage.</li><li><strong>Heavy:</strong> +1 to Base Damage, −1 to Attack Roll.</li><li><strong>Grab:</strong> On a hit, automatically grapple the target (normal grapple rules; maintainable one-handed).</li></ul><p>All Discipline grapples can be maintained one-handed. Making an FBA attack raises Flow by 1.</p><p><em>Note: Characters with the Ingrained Soul Armament Form also gain access to Full-Body Assault and Flow while using any other Aspect.</em>`));

  await upsertItem(ability(discId, 2, "Flow", "passive", 0, 0, 0, "", "", "",
    `Flow is a counter starting at 0. It increases by 1 with each Full-Body Assault attack and from some Combo abilities. Discipline abilities spend Flow as a resource. Flow persists until spent.`));

  // Breakdown Abilities
  await upsertItem(ability(discId, 3, "Light Breakdown", "swift", 2, 0, 2, "", "", "",
    `<strong>Flow Cost:</strong> 2</p><p>Target must make a Physical Resistance roll. On a failure, they are Staggered. You gain +1 Flow.`));

  await upsertItem(ability(discId, 4, "Grab Breakdown", "swift", 1, 0, 4, "", "", "",
    `<strong>Flow Cost:</strong> 1</p><p>Dash up to 2 spaces. If you end adjacent to the target, your next Skill gains +2 to its attack roll or +1 to Potency.`));

  await upsertItem(ability(discId, 5, "Heavy Breakdown", "swift", 3, 0, 4, "", "", "",
    `<strong>Flow Cost:</strong> 1 + X additional</p><p>Target must make a Physical Resistance roll. On a failure, they take [2×Soul] damage and are Dropped. +2 to the Resistance Value per additional Flow spent.`));

  // Combo Abilities
  await upsertItem(ability(discId, 6, "Light Combo", "trigger", 1, 0, 4, "", "", "",
    `<strong>Trigger:</strong> You make a Full-Body Assault attack or use a Counter ability. Flow Gain: +1.</p><p>Make a Quick Attack (−1 roll, +1 damage).</p><ul><li><strong>If triggered by Light:</strong> If the triggering hit landed, this attack gains [Sunder].</li><li><strong>If triggered by Heavy:</strong> If both this and the trigger hit, the target's Movement is reduced by 5.</li><li><strong>If triggered by Grab:</strong> If this roll is greater than 8, the target is Staggered and remains grappled.</li></ul>`));

  await upsertItem(ability(discId, 7, "Grab Combo", "swift", 1, 0, 4, "", "", "",
    `<strong>Trigger:</strong> You make a Full-Body Assault attack or use a Counter ability. Flow Gain: +1.</p><p>Attempt to Grab the target (Physical Resistance).</p><ul><li><strong>If triggered by Light:</strong> 5 damage + Grappled.</li><li><strong>If triggered by Heavy:</strong> [Soul + 3] damage + Staggered (grapple released).</li><li><strong>If triggered by Grab:</strong> Only if the trigger hit — [2×Soul] damage, grapple maintained.</li></ul>`));

  await upsertItem(ability(discId, 8, "Heavy Combo", "trigger", 1, 0, 4, "", "", "",
    `<strong>Trigger:</strong> You make a Full-Body Assault attack or use a Counter ability. Flow Gain: +1.</p><p>Make a Quick Attack (+1 roll, −1 damage).</p><ul><li><strong>If triggered by Light:</strong> If both this and the trigger hit, gain +1 Flow.</li><li><strong>If triggered by Heavy:</strong> +3 additional damage.</li><li><strong>If triggered by Grab:</strong> If the triggering Grab succeeded, this attack gains [Sunder] but the grapple is released.</li></ul>`));

  // Counter Abilities
  await upsertItem(ability(discId, 9, "Light Counter: Intercepting Strike", "trigger", 1, 0, 4, "aid", "breach", "",
    `<strong>Trigger:</strong> An adjacent creature makes an Attack.</p><p><strong>Flow Cost:</strong> X</p><p>Make a Quick Attack. The triggering creature's Attack Roll is reduced by [2 + Flow expended].`));

  await upsertItem(ability(discId, 10, "Heavy Counter: Crushing Blow", "trigger", 3, 0, 2, "breach", "", "",
    `<strong>Trigger:</strong> A creature moves to within 1 space of you.</p><p><strong>Flow Cost:</strong> 1</p><p>Target must make a Physical Resistance roll. On a failure: take [2×Soul] damage, knocked back 1 space, and Dropped. Potency is raised by Flow expended.`));

  await upsertItem(ability(discId, 11, "Grab Counter: Redirecting Grab", "trigger", 2, 0, 0, "breach", "", "",
    `<strong>Trigger:</strong> An adjacent creature makes an Attack.</p><p><strong>Flow Cost:</strong> X</p><p>Target must make a Physical Resistance roll. On a failure: move the target to any space around you and the incoming attack deals 0 damage. Target must be within 1 size category of you. Potency is raised by Flow expended.`));

  // Finisher Abilities
  await upsertItem(ability(discId, 12, "Light Finishers", "trigger", 3, 0, 2, "", "", "",
    `<strong>Trigger:</strong> You make any Full-Body Assault or Combo attack. Flow Cost: 4.</p><p>The effect depends on the type of FBA that triggered this:</p><ul><li><strong>Light:</strong> +3 to roll, [2×Soul] damage, Physical Resist → Staggered.</li><li><strong>Heavy:</strong> [3×Soul] damage, you are Dropped, Physical Resist → target Stunned.</li><li><strong>Grab:</strong> [Soul] damage, loop Quick Attacks on a failed Physical Resist.</li></ul>`));

  await upsertItem(ability(discId, 13, "Heavy Finishers", "trigger", 3, 0, 2, "", "", "",
    `<strong>Trigger:</strong> You make any Full-Body Assault or Combo attack. Flow Cost: 4.</p><p>The effect depends on the type of FBA that triggered this:</p><ul><li><strong>Light:</strong> [3×Soul] damage — Excellent roll → Senseless.</li><li><strong>Heavy:</strong> [Sunder] + [2×Soul] damage, ignores Armor and Wards.</li><li><strong>Grab:</strong> [2×Soul] damage, Physical Resist → Stunned + 5 uncleansable Bleeding Wounds.</li></ul>`));

  await upsertItem(ability(discId, 14, "Grab Finishers", "trigger", 2, 0, 2, "", "", "",
    `<strong>Trigger:</strong> You make any Full-Body Assault or Combo attack. Flow Cost: 3.</p><p>The effect depends on the type of FBA that triggered this:</p><ul><li><strong>Light (Lariat):</strong> Physical Resist → Stunned + Staggered + Grappled.</li><li><strong>Heavy (DDT):</strong> Physical Resist → Suffocating + Grappled (gains stages each Phase).</li><li><strong>Grab (Full-Soul Suplex):</strong> [2×Soul] damage, Physical Resist → Dropped + −1 max Stamina for the Engagement.</li></ul>`));

  ui.notifications.info("Discipline imported ✓");

  // ── Lock pack ─────────────────────────────────────────────
  await pack.configure({ locked: true });
  ui.notifications.info("✅ Import complete! Destruction, Precision & Discipline are in the compendium.");
})();
