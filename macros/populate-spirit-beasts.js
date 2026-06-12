// ============================================================
// Macro: Populate / Refresh Spirit Beasts Compendium
// ============================================================
// Run as GM to update the stryder-spirit-beasts compendium
// pack with the canonical ability text. Safe to run multiple
// times — idempotent, never overwrites existing non-empty data
// unless FORCE_OVERWRITE = true.
//
// Run this after closing and reopening Foundry if you want the
// compendium entries themselves to carry the ability text.
// (The generation code already has a built-in fallback, so
// this macro is only needed for pack hygiene.)
// ============================================================

const FORCE_OVERWRITE = false; // set true to always overwrite abilities

const PACK_ID = 'stryder.stryder-spirit-beasts';

// Canonical ability text (matches _source/stryder-spirit-beasts/*.json)
const GATE_ABILITIES = {
  SprBstCrim01: {
    primary: '<p>Make an attack with a range of 1 that deals <strong>5 damage</strong>.</p>',
    defense: '<p>When your Spirit takes damage, make a counter attack dealing <strong>3 damage</strong> to the creature that harmed it.</p>',
  },
  SprBstVllt02: {
    primary: '<p>If the Spirit is within 7 spaces of a creature who is the target of an Attack, it moves to the creature\'s side and takes the damage instead, then enters the nearest unoccupied space.</p>',
    defense: '<p>By bracing itself this Spirit takes <strong>3 less damage</strong> from the oncoming attack.</p>',
  },
  SprBstAzur03: {
    primary: '<p>If the Spirit is within 10 spaces of an ally that must make an Evasion roll, it swoops in and tries to fly them out of the affected area. The ally must still make an Evasion Roll but does not need to expend movement to do so.</p><p><strong>Primary II:</strong> You can evoke Hexes from this Spirit\'s location. You can also make Sense or Perception Checks from this Spirit\'s location; you gain a +2 when you do this.</p>',
    defense: '<p>This Spirit can use Dodge and Evasion. Its Dodge is equal to <strong>[1d6 + 4]</strong>.</p>',
  },
  SprBstSage04: {
    primary: '<p>The Spirit inflicts the <strong>Energized</strong> Condition on 1 or 2 creatures within 3 Spaces.</p>',
    defense: '<p>When it becomes the target of an attack, its attacker becomes <strong>Shocked</strong>.</p>',
  },
};

// ── Main ──────────────────────────────────────────────────────

const pack = game.packs.get(PACK_ID);
if (!pack) {
  ChatMessage.create({ content: `<p style="color:#c44;">Pack "${PACK_ID}" not found.</p>`, whisper: [game.user.id] });
} else {
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  const docs    = await pack.getDocuments();
  const lines   = [`<h3>Spirit Beast Pack Update${FORCE_OVERWRITE ? ' (FORCE)' : ''}</h3>`];
  let   updated = 0;

  for (const doc of docs) {
    const canon = GATE_ABILITIES[doc._id];
    if (!canon) { lines.push(`<li style="color:#aaa;">${doc.name} — no canonical data (skipped)</li>`); continue; }

    const curPrimary = doc.system?.abilities?.primary ?? '';
    const curDefense = doc.system?.abilities?.defense ?? '';
    const updates    = {};

    if (FORCE_OVERWRITE || !curPrimary.trim()) updates['system.abilities.primary'] = canon.primary;
    if (FORCE_OVERWRITE || !curDefense.trim()) updates['system.abilities.defense'] = canon.defense;

    if (Object.keys(updates).length) {
      await doc.update(updates);
      updated++;
      lines.push(`<li style="color:#4a4;">✓ ${doc.name} — updated: ${Object.keys(updates).map(k => k.endsWith('primary') ? 'Primary' : 'Defense').join(', ')}</li>`);
    } else {
      lines.push(`<li style="color:#aaa;">− ${doc.name} — already has abilities (skipped)</li>`);
    }
  }

  if (wasLocked) await pack.configure({ locked: true });

  lines.push(`<p><strong>${updated}</strong> of ${docs.length} entries updated.</p>`);
  if (FORCE_OVERWRITE) lines.push('<p style="color:#c84; font-style:italic;">FORCE_OVERWRITE was enabled — non-empty fields were also replaced.</p>');

  ChatMessage.create({ content: lines.join('\n'), whisper: [game.user.id] });
}
