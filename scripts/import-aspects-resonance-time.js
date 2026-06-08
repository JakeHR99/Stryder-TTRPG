// ============================================================
// STRYDER — Aspect Import: Resonance, Time
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
  ui.notifications.info("Starting Aspect import (Resonance, Time)…");

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

  // ── RESONANCE ─────────────────────────────────────────────
  const resonanceFolder = await getOrCreateFolder("Aspect of Resonance");
  const rId = resonanceFolder.id;

  // Core
  await upsertItem(ability(rId, 1, "Immutable Soul", "trigger", 0, 0, 0, "", "", "",
    `<strong>Trigger:</strong> You become Muted.</p><p>Roll a Magykal Resistance. If the result is 6 or higher, the Muted condition ends immediately.</p><p>While Muted, you cannot use any Resonance abilities.`));

  await upsertItem(ability(rId, 2, "Aural Barrage", "passive", 0, 0, 0, "", "", "",
    `You can replace any attack roll by having the target make a Magykal Resistance roll instead. Targets don't need to be in Line of Sight. This costs +1 Stamina unless the ability was a Focused Attack action.`));

  await upsertItem(ability(rId, 3, "Attached Effect", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Effect:</em> At the start of the first Player Phase of every Engagement, you may activate any one Resonance ability at no cost as a Swift Action.`));

  // Abilities
  await upsertItem(ability(rId, 4, "Bolero of Ruin", "swift", 2, 0, 0, "", "", "",
    `Your next attack deals +[2×Soul] additional damage.</p><p><em>Aria: Using this ability increases your Aria by 1.</em>`));

  await upsertItem(ability(rId, 5, "Elegy of Monsters", "trigger", 2, 0, 4, "", "", "",
    `Regain 1 Mana.</p><p><strong>Skill Passive:</strong> Your next Focused Attack also causes you to regain Health equal to half the damage dealt.</p><p><em>Aria: Using this ability increases your Aria by 1.</em>`));

  await upsertItem(ability(rId, 6, "March of The Hunter", "swift", 3, 0, 4, "", "", "",
    `All allies within range gain +4 Movement until the start of the next Phase.</p><p><strong>Skill Passive:</strong> The target of your next Focused Attack has their Movement reduced by 3 until the end of the next Challenger Phase.</p><p><em>Aria: Using this ability increases your Aria by 1.</em>`));

  await upsertItem(ability(rId, 7, "Malagena of Battle", "swift", 3, 0, 4, "", "", "",
    `All allies within range gain +2 to Reflex abilities and attack rolls until the end of the Round.</p><p><strong>Skill Passive:</strong> The target of your next Focused Attack gains +2 to their next attack roll but suffers −1 to Reflex rolls.</p><p><em>Aria: Using this ability increases your Aria by 1.</em>`));

  await upsertItem(ability(rId, 8, "Nocturne of Waning", "trigger", 5, 0, 4, "", "", "",
    `<strong>Trigger:</strong> A Phase begins.</p><p>All creatures within range suffer −2 to all attack rolls for that Phase.</p><p><strong>Skill Passive:</strong> The target of your next Focused Attack loses 1 Stamina on a hit.</p><p><em>Aria: Using this ability increases your Aria by 1.</em>`));

  await upsertItem(ability(rId, 9, "Crescendo of Victory", "swift", 7, 0, 1, "", "", "",
    `Your next attack deals additional damage equal to [4×Aria].</p><p><strong>Permanent Skill Passive:</strong> Each time you use any non-passive Resonance ability, your Aria increases by 1. Aria resets to 0 at the start of every Engagement.</p><p><em>Aria: Using this ability increases your Aria by 1.</em>`));

  await upsertItem(ability(rId, 10, "Sonata of Survival", "focused", 10, 0, 1, "", "", "",
    `Until the start of your next Player Phase: no creature can die or enter Last Breaths (their HP floors at 1). When this effect ends: all creatures within range regain 1 Health.</p><p><em>Aria: Using this ability increases your Aria by 1.</em>`));

  ui.notifications.info("Resonance imported ✓");

  // ── TIME ──────────────────────────────────────────────────
  const timeFolder = await getOrCreateFolder("Aspect of Time");
  const tId = timeFolder.id;

  // Core
  await upsertItem(ability(tId, 1, "Temporal Sands", "passive", 0, 0, 0, "", "", "",
    `Gain 1 Sand whenever a Focused Attack roll result is 6 or higher. Gain 2 Sands when an attack is Excellent. Sands are the primary resource for Time abilities.`));

  await upsertItem(ability(tId, 2, "Balance of Time", "swift", 1, 0, 0, "", "", "",
    `<strong>Cost:</strong> 1 Stamina + X Sands.</p><p>Choose one of the following effects:</p><ul><li><strong>Slowdown:</strong> The target's Movement is reduced by 2 per Sand spent until the end of the next Challenger Phase.</li><li><strong>Shatter:</strong> Your next Focused Attack deals +[2 × Sands spent] additional damage.</li><li><strong>Stasis:</strong> Spend 2 Sands. The target makes a Magykal Resistance roll. On a failure, they are Stunned.</li></ul>`));

  await upsertItem(ability(tId, 3, "Attached Effect", "passive", 0, 0, 0, "", "", "",
    `<em>Attached Effect:</em> You start every Engagement with 3 Sands.`));

  // Abilities
  await upsertItem(ability(tId, 4, "Chronal Reaping", "focused", 3, 0, 0, "", "", "",
    `Target a creature. They make a Magykal Resistance roll. On a failure, steal their time and gain 5 Sands.`));

  await upsertItem(ability(tId, 5, "Anachronist Steps", "swift", 2, 0, 0, "", "", "",
    `<strong>Cost:</strong> 2 Stamina + X Sands.</p><p>Grant a target one of the following:</p><ul><li><strong>Option A:</strong> +[X Sands] bonus to Reflex rolls until the start of the next Player Phase.</li><li><strong>Option B:</strong> +[2 × X Sands] Movement until the end of the current Phase.</li></ul>`));

  await upsertItem(ability(tId, 6, "Future-Bound", "swift", 1, 0, 3, "", "", "",
    `<strong>Cost:</strong> 1 Stamina + 3 Sands.</p><p>Until the start of your next Player Phase, you cannot act or move, but you are completely removed from combat — undetectable, untargetable, and unaffected by area effects.`));

  await upsertItem(ability(tId, 7, "Retrace", "swift", 1, 0, 0, "", "", "",
    `<strong>Cost:</strong> 1 Stamina + X Sands.</p><p>Target a creature. They make a Magykal Resistance roll. On a failure, they are moved backwards along their most recently moved path by [2 × Sands spent] spaces.`));

  await upsertItem(ability(tId, 8, "Unresolved Present", "trigger", 1, 0, 0, "", "", "",
    `<strong>Cost:</strong> 1 Stamina + 1 Sand &nbsp;|&nbsp; <strong>Trigger:</strong> A creature within range makes a d6 roll.</p><p>The target may reroll 1 d6 from that roll and gains +1 to the result.`));

  await upsertItem(ability(tId, 9, "Manifest Divergence", "focused", 3, 0, 2, "", "", "",
    `Summon a Divergent — a copy of yourself from another timeline with Health equal to yours at the moment of activation. The Divergent can take its own Focused and Swift Actions; you pay all of its costs. It carries no Gear.</p><p>The Divergent vanishes at the end of the current Phase unless you pay 4 Stamina to extend it until the end of the next Player Phase.`));

  await upsertItem(ability(tId, 10, "Seize The Moment", "focused", 20, 0, 1, "", "", "",
    `<strong>Cost:</strong> 20 Stamina + X Sands.</p><p>All Party Members gain +[Sands spent] to their next Magykal Resistance roll.</p><p>After the current Player Phase ends, a <strong>second Player Phase begins</strong> in which only you act. Party Members who succeeded their Magykal Resistance roll may also participate in this second Phase.`));

  ui.notifications.info("Time imported ✓");

  // ── Lock pack ─────────────────────────────────────────────
  await pack.configure({ locked: true });
  ui.notifications.info("✅ Import complete! Resonance & Time are in the compendium.");
})();
