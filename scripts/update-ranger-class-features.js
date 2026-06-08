// ============================================================
//  RANGER CLASS REWORK — Compendium Update Script
//  Paste into the Foundry console (F12) as GM and run.
//  Safe to run multiple times.
//
//  - Updates Create Weakness description (Wound-conditioned)
//  - Removes Slayer's Strike I / II and Tyrant Hunter
//  - Adds Behemoth Slayer, Behemoth Slayer II, Tyrant Executioner
//  - Updates the Ranger class item description
// ============================================================

(async () => {
  const cfPack = game.packs.get('stryder.stryder-class-features');
  const clPack = game.packs.get('stryder.stryder-classes');
  if (!cfPack) return ui.notifications.error('stryder-class-features pack not found!');

  const wasLockedCf = cfPack.locked;
  if (wasLockedCf) await cfPack.configure({ locked: false });
  const wasLockedCl = clPack?.locked;
  if (clPack && wasLockedCl) await clPack.configure({ locked: false });

  const cfDocs = await cfPack.getDocuments();
  const byId   = id => cfDocs.find(d => d._id === id);
  const byName = n  => cfDocs.find(d => d.name === n);

  // ── 1. Remove retired features ──────────────────────────────
  const RETIRED = [
    { id: 'RngrCls02SlI',  name: "Slayer's Strike I"  },
    { id: 'RngrCls04SlII', name: "Slayer's Strike II" },
    { id: 'RngrCls05TyHt', name: 'Tyrant Hunter'      },
  ];
  for (const r of RETIRED) {
    const doc = byId(r.id) ?? byName(r.name);
    if (doc) { await doc.delete(); console.log(`Removed: ${r.name}`); }
  }

  // ── 2. Update Create Weakness ───────────────────────────────
  const cw = byId('RngrCls01CrWk') ?? byName('Create Weakness');
  if (cw) {
    await cw.update({ 'system.description':
      "<p>Choose one of the following effects. If your next Focused attack inflicts a Wound, the target is afflicted with the chosen effect. The effect's strength is based on the attack's quality and lasts until the end of the next Challenger Phase.</p><p><strong>Cripple</strong> — Poor: 0 | Good: -2 Max Movement | Excellent: -5 Max Movement</p><p><strong>Weaken</strong> — Poor: 0 | Good: -1 Attack Roll | Excellent: -2 Attack Roll</p><p><strong>Drain</strong> — Poor: 0 | Good: -1 Stamina | Excellent: -1 Stamina</p><p><strong>Dispatch</strong> — Poor: 0 | Good: +3 additional damage | Excellent: +5 additional damage</p>"
    });
    console.log('Updated: Create Weakness');
  }

  // ── 3. Create the new features ──────────────────────────────
  const folderId = cw?.folder?.id ?? cfPack.folders.find(f => f.name === 'Ranger Class Features')?.id ?? null;
  const base = {
    type: 'action', img: 'icons/svg/aura.svg', folder: folderId,
    system: {
      action_type: 'passive',
      roll: { diceBonus: 0, diceNum: 2, diceSize: 6 },
      limit: { max: 0, value: 0 },
      stamina_cost: 0, mana_cost: 0, tactics_cost: 0,
      other_restrictions: '', hasReflexTag: false, tag1: '', tag2: '', tag3: '',
    },
  };
  const NEW_FEATURES = [
    foundry.utils.mergeObject(foundry.utils.deepClone(base), {
      _id: 'RngrCls02BhSl000', name: 'Behemoth Slayer',
      'system.tag1': 'persistent',
      'system.description': "<p><em>Gained at Level 4.</em></p><p>The more Wounds your target is afflicted with, the stronger you become. When a monster you attack has enough Wounds you gain the corresponding benefits:</p><ul><li><strong>3 Wounds:</strong> +1 to your Attack Rolls.</li><li><strong>6 Wounds:</strong> When you are the Leader of an attack, your target's Guard is reduced by 1.</li><li><strong>10 Wounds:</strong> When you use Create Weakness, choose two effects instead of one.</li></ul>",
    }),
    foundry.utils.mergeObject(foundry.utils.deepClone(base), {
      _id: 'RngrCls04BhSlII0', name: 'Behemoth Slayer II',
      'system.tag1': 'persistent',
      'system.description': "<p><em>Gained at Level 12.</em></p><p>Behemoth Slayer gains two new Wound amounts that grant you corresponding benefits:</p><ul><li><strong>15 Wounds:</strong> Whenever you inflict a Wound, inflict one additional Wound.</li><li><strong>21 Wounds:</strong> All Wounds you inflict are Deep Wounds, and all existing Wounds the monster had become Deep Wounds.</li></ul>",
    }),
    foundry.utils.mergeObject(foundry.utils.deepClone(base), {
      _id: 'RngrCls05TyEx000', name: 'Tyrant Executioner',
      'system.description': "<p><em>Gained at Level 15.</em></p><p>At the start of an engagement you Dash an amount of spaces equal to your maximum Movement. If there is a target within range of your Soul Armament when you end your Dash, you can use two Focused Actions this Round. If you inflict a Wound this Round, your target gains 3 additional Wounds.</p>",
    }),
  ];
  for (const data of NEW_FEATURES) {
    if (byId(data._id) ?? byName(data.name)) { console.log(`Already exists: ${data.name}`); continue; }
    await Item.create(data, { pack: cfPack.collection, keepId: true });
    console.log(`Created: ${data.name}`);
  }

  // ── 4. Update the Ranger class item ─────────────────────────
  if (clPack) {
    const clDocs = await clPack.getDocuments();
    const rangerClass = clDocs.find(d => d._id === 'RangerClass00001') ?? clDocs.find(d => d.name === 'Ranger');
    if (rangerClass) {
      await rangerClass.update({ 'system.description':
        "<p>Rangers are unique in their fighting styles, they focus less on raw might and more on how to more efficiently defeat their opponent. Rangers are those who devote themselves to honing their skill. Able to locate and target the weak points of their enemies and use special skills that give them an edge over enemies, Rangers are lethal combatants who overwhelm their enemies and outmaneuver them.</p><h3>Level 1 — Ranger Training I</h3><p>Your Health starts at 8, and you gain 2 Health every time you gain a level. You gain a Ranger Technique now and gain another at Levels 4, 8, 12 and 15.</p><h4>Create Weakness | Swift Action</h4><p>Choose one of the following effects. If your next Focused attack inflicts a Wound, the target is afflicted with the chosen effect. The effects strength is based on the attacks quality and lasts until the end of the next Challenger Phase.</p><p><strong>Cripple</strong> — Poor: 0 | Good: -2 Max Movement | Excellent: -5 Max Movement</p><p><strong>Weaken</strong> — Poor: 0 | Good: -1 Attack Roll | Excellent: -2 Attack Roll</p><p><strong>Drain</strong> — Poor: 0 | Good: -1 Stamina | Excellent: -1 Stamina</p><p><strong>Dispatch</strong> — Poor: 0 | Good: +3 additional damage | Excellent: +5 additional damage</p><h3>Level 4 — Ranger Training II</h3><p>Select a Ranger Technique to learn.</p><h4>Behemoth Slayer</h4><p>The more Wounds your target is afflicted with, the stronger you become. When a monster you attack has enough Wounds you gain the corresponding benefits:</p><p><strong>3:</strong> +1 to your Attack Rolls.</p><p><strong>6:</strong> When you are the Leader of an attack, your target's Guard is reduced by 1.</p><p><strong>10:</strong> When you use Create Weakness, choose two effects instead of one.</p><h3>Level 8 — Ranger Training III</h3><p>Select a Ranger Technique to learn.</p><h4>Exploit Weakness</h4><p>When you use a Focused Attack action on a target you have previously dealt damage to with Create Weakness, you can expend 4 Stamina to choose one of the following effects. Your target rolls Resistance. On failure they suffer the chosen effect. (Physical Resistance if your attack was made while channeling a Mortal Aspect, Magykal Resistance if you were channeling an Immortal Aspect)</p><p><strong>Cripple</strong> — The creature does not regain any Movement at the start of its next turn.</p><p><strong>Weaken</strong> — The creature is unable to use its Focused Action on its next turn.</p><p><strong>Drain</strong> — The creature recovers half its maximum Stamina at the start of its next turn.</p><p><strong>Dispatch</strong> — Deal additional 12 damage.</p><h3>Level 12 — Behemoth Slayer II</h3><p>Behemoth Slayer gains two new Wound amounts that grant you corresponding benefits:</p><p><strong>15:</strong> Whenever you inflict a Wound, inflict one additional Wound.</p><p><strong>21:</strong> All Wounds you inflict are Deep Wounds, and all existing Wounds the monster had become Deep Wounds.</p><h4>Ranger Training IV</h4><p>Select a Ranger Technique to learn.</p><h3>Level 15 — Ranger Training V</h3><p>Select a Ranger Technique to learn.</p><h4>Tyrant Executioner</h4><p>At the start of an engagement you Dash an amount of spaces equal to your maximum Movement. If there is a target within range of your Soul Armament when you end your Dash, you can use two Focused Actions this Round. If you inflict a Wound this Round, your target gains 3 additional Wounds.</p>"
      });
      console.log('Updated: Ranger class item');
    }
  }

  if (wasLockedCf) await cfPack.configure({ locked: true });
  if (clPack && wasLockedCl) await clPack.configure({ locked: true });
  ui.notifications.info('Ranger class rework: compendium update complete!');
})();
