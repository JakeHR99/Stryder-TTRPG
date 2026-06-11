// Stryder Component World Migration — run once as GM after populate-components.js.
// Converts owned and world-directory component items from the old graded-adjective
// names to the new canon names, setting component_type, rank, and grade in sync.
// Does NOT touch RollTables or loot tables.

// ── Name → canon mapping ──────────────────────────────────────────────────────
// Weakest (G4/Rank 4) → Strongest (G1/Rank 1) → Mythic
const NAME_MAP = {
  // Bones
  'Brittle Bones':     { name: 'Bones (Rank 4)', component_type: 'bones',      rank: '4',      grade: 'G4'    },
  'Common Bones':      { name: 'Bones (Rank 3)', component_type: 'bones',      rank: '3',      grade: 'G3'    },
  'Solid Bones':       { name: 'Bones (Rank 2)', component_type: 'bones',      rank: '2',      grade: 'G2'    },
  'Prime Bones':       { name: 'Bones (Rank 1)', component_type: 'bones',      rank: '1',      grade: 'G1'    },
  'Mythic Bones':      { name: 'Bones (Mythic)', component_type: 'bones',      rank: 'mythic', grade: 'Mythic'},
  // Eyes
  'Clouded Eye':       { name: 'Eyes (Rank 4)',  component_type: 'eyes',       rank: '4',      grade: 'G4'    },
  'Common Eye':        { name: 'Eyes (Rank 3)',  component_type: 'eyes',       rank: '3',      grade: 'G3'    },
  'Keen Eye':          { name: 'Eyes (Rank 2)',  component_type: 'eyes',       rank: '2',      grade: 'G2'    },
  'Vivid Eye':         { name: 'Eyes (Rank 1)',  component_type: 'eyes',       rank: '1',      grade: 'G1'    },
  'Mythic Eye':        { name: 'Eyes (Mythic)',  component_type: 'eyes',       rank: 'mythic', grade: 'Mythic'},
  // Mana Veins
  'Frayed Mana Vein':  { name: 'Mana Veins (Rank 4)', component_type: 'mana_veins', rank: '4',      grade: 'G4'    },
  'Common Mana Vein':  { name: 'Mana Veins (Rank 3)', component_type: 'mana_veins', rank: '3',      grade: 'G3'    },
  'Intact Mana Vein':  { name: 'Mana Veins (Rank 2)', component_type: 'mana_veins', rank: '2',      grade: 'G2'    },
  'Pulsing Mana Vein': { name: 'Mana Veins (Rank 1)', component_type: 'mana_veins', rank: '1',      grade: 'G1'    },
  'Mythic Mana Vein':  { name: 'Mana Veins (Mythic)', component_type: 'mana_veins', rank: 'mythic', grade: 'Mythic'},
  // Heart (old names were "... Heart")
  'Withered Heart':    { name: 'Heart (Rank 4)', component_type: 'heart',      rank: '4',      grade: 'G4'    },
  'Common Heart':      { name: 'Heart (Rank 3)', component_type: 'heart',      rank: '3',      grade: 'G3'    },
  'Vigorous Heart':    { name: 'Heart (Rank 2)', component_type: 'heart',      rank: '2',      grade: 'G2'    },
  'Potent Heart':      { name: 'Heart (Rank 1)', component_type: 'heart',      rank: '1',      grade: 'G1'    },
  'Mythic Heart':      { name: 'Heart (Mythic)', component_type: 'heart',      rank: 'mythic', grade: 'Mythic'},
  // Wytch focus-item legacy names (hyphenated/pluralised; pre-new-name inventory items)
  'Eyes':        { name: 'Eyes (Rank 4)',       component_type: 'eyes',       rank: '4',      grade: 'G4'    },
  'Bones':       { name: 'Bones (Rank 4)',      component_type: 'bones',      rank: '4',      grade: 'G4'    },
  'Mana-veins':  { name: 'Mana Veins (Rank 4)', component_type: 'mana_veins', rank: '4',      grade: 'G4'    },
  'Hearts':      { name: 'Heart (Rank 4)',      component_type: 'heart',      rank: '4',      grade: 'G4'    },
};

(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  const conversions  = [];
  const unrecognized = [];
  let totalUpdated   = 0;

  // ── Helper: migrate items in a collection (actor.items or game.items) ─────
  async function migrateCollection(label, items) {
    for (const item of items) {
      if (item.type !== 'component') continue;
      const canon = NAME_MAP[item.name];
      if (!canon) {
        // Already canon or unknown
        const isKnownCanon = Object.values(NAME_MAP).some(v => v.name === item.name);
        if (!isKnownCanon) unrecognized.push({ label, name: item.name, id: item.id });
        continue;
      }
      await item.update({
        name:                        canon.name,
        'system.component_type':     canon.component_type,
        'system.rank':               canon.rank,
        'system.grade':              canon.grade,
      });
      conversions.push({ label, oldName: item.name, newName: canon.name });
      totalUpdated++;
    }
  }

  // ── 1. Migrate all actors' owned items ────────────────────────
  for (const actor of game.actors) {
    await migrateCollection(actor.name, actor.items);
  }

  // ── 2. Migrate world-directory items (Items sidebar) ─────────
  await migrateCollection('(World Items)', game.items);

  // ── 3. Report ─────────────────────────────────────────────────
  if (conversions.length) {
    console.group('[Stryder] migrate-components-world — conversions');
    const header = 'Owner'.padEnd(28) + 'Old Name'.padEnd(28) + 'New Name';
    console.log(header);
    console.log('-'.repeat(80));
    for (const c of conversions) {
      console.log(c.label.padEnd(28) + c.oldName.padEnd(28) + c.newName);
    }
    console.groupEnd();
  }

  if (unrecognized.length) {
    console.group('[Stryder] migrate-components-world — UNRECOGNIZED component items (not migrated)');
    for (const u of unrecognized) console.log(`  ${u.label}: "${u.name}" (id: ${u.id})`);
    console.groupEnd();
    ui.notifications.warn(`${unrecognized.length} component item(s) not recognized — see console for details.`);
  }

  const msg = totalUpdated
    ? `Component migration complete: ${totalUpdated} item(s) renamed. ${unrecognized.length ? unrecognized.length + ' unrecognized — see console.' : ''}`
    : `No old-name component items found — already migrated or world is clean.`;
  console.log(`[Stryder] ${msg}`);
  ui.notifications.info(msg);
})();
