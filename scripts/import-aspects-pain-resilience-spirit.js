// ============================================================
// STRYDER — Aspect Import: Pain, Resilience, Spirit
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
  ui.notifications.info("Starting Aspect import (Pain, Resilience, Spirit)…");

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

  // ── PAIN ─────────────────────────────────────────────────
  const painFolder = await getOrCreateFolder("Aspect of Pain");
  const pId = painFolder.id;

  await upsertItem(ability(pId, 1, "Mark of Death", "passive", 0, 0, 0, "aid", "persistent", "",
    `When you make an attack against a creature, you can choose to inflict them with the Mark of Death. This mark is the foundation of your other skills. Whenever you attack a new creature, you can choose to transfer your Mark of Death from the previous bearer to your new target.</p><p><strong>Target:</strong> You can also use a Swift Action to point at a creature you can see and apply your Mark of Death to them. You can only do this once per phase.`));

  await upsertItem(ability(pId, 2, "Shadow Walker", "passive", 0, 0, 0, "aid", "", "",
    `When you break Line of Sight with a creature that has the Mark of Death, you become Invisible to them until the end of the current Player Phase or until you deal damage to them.`));

  await upsertItem(ability(pId, 3, "Harvest", "passive", 0, 0, 0, "", "", "",
    `When you target a creature who cannot see you with a Focused Attack or Reaper Strike while you are Hidden or Invisible, select a Magnitude 1 Area that includes the space your target is on. Your Attack or Skill targets and affects all chosen spaces.</p><p>When you proc Harvest on a creature that possesses your Mark of Death it gains a Bleeding Wound. If your target already has 5 Bleeding Wounds, deal additional damage equal to [Soul] instead of inflicting a Bleeding Wound.`));

  await upsertItem(ability(pId, 4, "Attached Bonus", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Bonus:</em> You can use Target twice per phase.`));

  await upsertItem(ability(pId, 5, "Soul Charge", "swift", 2, 0, 0, "", "", "",
    `Make a Quick Attack at a target within range. On a hit, no damage is dealt but the creature is pulled up to 2 Spaces closer to you and is inflicted with 1 Bleeding Wound.`));

  await upsertItem(ability(pId, 6, "Executioners Technique", "swift", 2, 0, 3, "", "", "",
    `This effect can only be applied on creatures that bear your Mark of Death. Activating this effect consumes your Mark of Death, removing it from your target.</p><p>Cause the afflicted creatures to be Dropped and your next attack against this creature deals additional damage equal to [2x Soul] on a failed Physical Resist.`));

  await upsertItem(ability(pId, 7, "Reaper's Strike", "swift", 3, 0, 2, "", "", "",
    `Make a Quick Attack. On an attack roll of Good or higher they are rendered Senseless until the end of the Player Phase.`));

  await upsertItem(ability(pId, 8, "Ruptured Veins", "swift", 3, 0, 2, "", "", "",
    `All Bleeding Wounds on a target creature within 3 Spaces immediately activate twice, causing the target to lose Health equal to [2 x the number of Bleeding Wounds they have]. If the Target had 5 Bleeding Wounds they also lose 1 Stamina. This Skill can only target creatures with the Mark of Death.`));

  await upsertItem(ability(pId, 9, "Killer's Stride", "swift", 2, 0, 3, "augment", "", "",
    `Move up to 5 spaces. Any movement made by this Skill ignores obstructions and creatures. If this Skill results in you being within 1 space of an enemy creature with your Mark of Death, you make a Quick Attack at them. If this attack lands you may move 3 spaces in any direction without reducing your Movement or if your Movement is already at 0.`));

  await upsertItem(ability(pId, 10, "The Grim Scythe", "swift", 3, 0, 3, "", "", "",
    `Your next Focused Attack's base damage increases by a number equal to [2x Soul]. If this attack reduces your targets Health to 0, you regain 7 Health.</p><p><strong>Form Passive:</strong> The powerful energies from your weapon are also able to detect when a creature has 30 Health or less, your eyes seeing an aura of red surround them.`));

  await upsertItem(ability(pId, 11, "Death Comes For Us All", "focused", 5, 0, 3, "", "", "",
    `Make three Quick attacks. Each has a different effect on a hit. These attacks can target the same or separate creatures.</p><p><strong>First Attack, Weaken:</strong> Your attack deals base damage equal to [2x Soul].<br><strong>Second Attack, Overwhelm:</strong> Your attack Staggers the enemy.<br><strong>Final Attack, Annihilate:</strong> Your attack inflicts 5 stacks of Bleeding Wounds and benefits from Backstab.</p><p>You may not activate any other Skills until this Ultimate is resolved.`));

  ui.notifications.info("Pain imported ✓");

  // ── RESILIENCE ────────────────────────────────────────────
  const rslncFolder = await getOrCreateFolder("Aspect of Resilience");
  const rId = rslncFolder.id;

  await upsertItem(ability(rId, 1, "Armored Soul", "passive", 0, 0, 0, "aid", "persistent", "",
    `While utilizing this aspect, you become covered with armor of the soul. At the beginning of each Player Phase, choose which Form to shift your armor to and gain its benefits.</p><ul><li><strong>Material Form:</strong> You gain 2 Physical Damage Reduction.</li><li><strong>Magykal Form:</strong> You gain 2 Magykal Damage Reduction.</li></ul>`));

  await upsertItem(ability(rId, 2, "Deep Guard", "trigger", 1, 0, 0, "breach", "", "",
    `<strong>Trigger:</strong> You are the target of an attack roll that would deal damage to you.</p><p>Reduce the amount of damage taken by an amount equal to [Soul + Known Aspect of Resilience abilities]. This does not include your Aspect of Resilience Core Abilities.`));

  await upsertItem(ability(rId, 3, "Attached Bonus", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Bonus:</em> Your Focused Attacks deal additional damage equal to your Damage Reduction.`));

  await upsertItem(ability(rId, 4, "Ancient Armor", "trigger", 1, 0, 3, "", "", "",
    `<strong>Trigger:</strong> You make a Resistance Roll.</p><p>Once activated your roll gains a bonus equal to [Soul] to its result.`));

  await upsertItem(ability(rId, 5, "Irresistible Rage", "swift", 2, 0, 3, "", "", "",
    `<strong>Range:</strong> 3 &nbsp;|&nbsp; <strong>Duration:</strong> 1 Round</p><p>You expel aggravating mana out towards all enemy creatures within range of your Armament. On a failed Magykal Resistance, all creatures are Taunted until the end of the next Challenger Phase.`));

  await upsertItem(ability(rId, 6, "Full Brace", "trigger", 2, 0, 3, "breach", "", "",
    `<strong>Trigger:</strong> You are forced to Evade.</p><p>Use Deep Guard immediately at no cost. When activated from this Skill, Deep Guard can be used in place of the Evade action, and gains additional damage mitigation equal to [Soul] when used via this Ability.</p><p>After using this Ability, your Movement is reduced by 3 for the duration of the next Player Phase.`));

  await upsertItem(ability(rId, 7, "Revenge Shield", "trigger", 1, 0, 3, "breach", "", "",
    `<strong>Trigger:</strong> Your previous action was Deep Guard.</p><p>The amount of damage reduced by the Triggering Deep Guard becomes your <strong>Revenge</strong> amount.</p><p>Your next Focused Attack will deal additional damage equal to Revenge. If you use Sacrifice on an ally you can choose to give their next Focused Attack the benefit instead.`));

  await upsertItem(ability(rId, 8, "Sacrifice", "trigger", 0, 0, 0, "aid", "breach", "",
    `<strong>Range:</strong> 5 &nbsp;|&nbsp; <strong>Trigger:</strong> An ally within range is about to take damage.</p><p>You take the damage an ally would have taken.`));

  await upsertItem(ability(rId, 9, "Unbreakable", "swift", 5, 0, 1, "aid", "", "",
    `Until the end of the current Encounter, Excellent Attacks made against you deal damage as if they were Good.`));

  await upsertItem(ability(rId, 10, "Atlas Resilience", "focused", 5, 0, 1, "aid", "", "",
    `You gain the following buffs until the end of the current Engagement while using the Aspect of Resilience.</p><ul><li><strong>Unwavering Resistance:</strong> Your Physical and Magykal Resistance rolls gain +2.</li><li><strong>Skybearing Resilience:</strong> Your Armored Soul burgeons with strength. Armored Souls damage reduction increases by 2 and applies to both Physical and Magykal damage simultaneously.</li></ul>`));

  ui.notifications.info("Resilience imported ✓");

  // ── SPIRIT ────────────────────────────────────────────────
  const spiritFolder = await getOrCreateFolder("Aspect of Spirit");
  const sId = spiritFolder.id;

  await upsertItem(ability(sId, 1, "Hallowed-Arsenal", "passive", 0, 0, 0, "", "", "",
    `At the start of the Player Phase, choose a passive to gain until the start of the next Player Phase.</p><ul><li><strong>Survival:</strong> If your Focused Attack lands you regain Health equal to your [Soul].</li><li><strong>Restoration:</strong> Your Focused Attack deals no damage. The target of your attack regains Health equal to your Soul and you reduce your Health by the same amount.</li></ul>`));

  await upsertItem(ability(sId, 2, "Revitalize", "swift", 1, 0, 4, "", "", "",
    `Choose a target creature within range of your item. You remove the Poison, Burning or Bleeding Wound Condition from them.`));

  await upsertItem(ability(sId, 3, "Attached Effect", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Effect:</em> Your Survival Mode attacks restore 2 additional Health.`));

  await upsertItem(ability(sId, 4, "Enhance Prowess", "swift", 3, 0, 3, "", "", "",
    `Choose a target creature within range of your Armament and raise one of their Physical Talents by an amount equal to your Soul. They cannot surpass their natural limit of 5 this way. This effect lasts until the end of the Engagement or 1 Minute.`));

  await upsertItem(ability(sId, 5, "Rapid Repair", "trigger", 1, 0, 2, "", "", "",
    `<strong>Trigger:</strong> You take damage.</p><p>You restore your own health equal to half the damage taken.`));

  await upsertItem(ability(sId, 6, "Life for a Life", "swift", 2, 0, 3, "", "", "",
    `You may choose to take any amount of damage, you then deal that damage as additional damage on your next Survival Mode Focused Attack.`));

  await upsertItem(ability(sId, 7, "Undeath", "trigger", 3, 0, 4, "", "", "",
    `<strong>Trigger:</strong> A creature within range would take lethal damage or be reduced to 0 Health.</p><p>Once this ability is active on a creature their Health can go into negatives, the limit being 3x Soul. Should the target reach this negative Health limit, they will die without entering Last Breaths. If the target exits an engagement before this happens, the targets Health will be set to 1 Health. However the targets Maximum Health will be reduced by half of the amount of negative Health they had at the end of the engagement.`));

  await upsertItem(ability(sId, 8, "Ruin Mana", "trigger", 3, 0, 3, "", "", "",
    `<strong>Trigger:</strong> A creature uses an ability that costs Stamina or Mana within range of your item.</p><p>You attempt to cancel out the triggering ability. You and the target roll 2d6. If your roll is higher the ability is canceled. If your roll is lower, you lose 3 Health and the ability is not canceled.`));

  await upsertItem(ability(sId, 9, "Healing Wave", "focused", 6, 0, 3, "", "", "",
    `You heal all creatures of your choice within range for an amount equal to Soul + 3.`));

  await upsertItem(ability(sId, 10, "Starwalker", "swift", 1, 1, 3, "", "", "",
    `<strong>Cost:</strong> 1–3 Stamina, 1–X Mana &nbsp;|&nbsp; Can also be used as a Trigger Action.</p><p>You heal a creature within range for an amount equal to Soul × Stamina expended and invigorate them, causing their next Focused Attack to deal additional damage equal to their Soul + amount of Mana expended. This also cleanses all Harmful Conditions.`));

  ui.notifications.info("Spirit imported ✓");

  // ── Lock pack ─────────────────────────────────────────────
  await pack.configure({ locked: true });
  ui.notifications.info("✅ Import complete! Pain, Resilience & Spirit are in the compendium.");
})();
