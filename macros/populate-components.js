// Stryder Component Compendium Populator — run once as GM.
// Deletes the 20 old graded-name component entries from stryder-loot,
// then creates the 20 canon-named entries (4 types × 5 ranks).
// Uses keepId since all new IDs are exactly 16 alphanumeric chars.

const LOOT_PACK = "stryder.stryder-loot";
const SRC       = "systems/stryder/_source/stryder-loot";

// Old names to purge (graded-adjective AI-invented names)
const OLD_NAMES = [
  // Bones
  "Brittle Bones", "Common Bones", "Solid Bones", "Prime Bones", "Mythic Bones",
  // Eyes
  "Clouded Eye", "Common Eye", "Keen Eye", "Vivid Eye", "Mythic Eye",
  // Mana Veins
  "Frayed Mana Vein", "Common Mana Vein", "Intact Mana Vein", "Pulsing Mana Vein", "Mythic Mana Vein",
  // Hearts (old singular/plural mix)
  "Withered Heart", "Common Heart", "Vigorous Heart", "Potent Heart", "Mythic Heart",
];

// Old IDs to purge by ID (in case they were renamed in the DB)
const OLD_IDS = [
  "CmpBoneG4", "CmpBoneG3", "CmpBoneG2", "CmpBoneG1", "CmpBoneMythic",
  "CmpEyeG4",  "CmpEyeG3",  "CmpEyeG2",  "CmpEyeG1",  "CmpEyeMythic",
  "CmpVeinG4", "CmpVeinG3", "CmpVeinG2", "CmpVeinG1", "CmpVeinMythic",
  "CmpHrtG4",  "CmpHrtG3",  "CmpHrtG2",  "CmpHrtG1",  "CmpHrtMythic",
];

// New canon source filenames (20 files, 4 types × 5 ranks)
const NEW_FILES = [
  "Bones_Rank4_CmpBnR400000001.json",
  "Bones_Rank3_CmpBnR300000001.json",
  "Bones_Rank2_CmpBnR200000001.json",
  "Bones_Rank1_CmpBnR100000001.json",
  "Bones_Mythic_CmpBnRm00000001.json",
  "Eyes_Rank4_CmpEyR400000001.json",
  "Eyes_Rank3_CmpEyR300000001.json",
  "Eyes_Rank2_CmpEyR200000001.json",
  "Eyes_Rank1_CmpEyR100000001.json",
  "Eyes_Mythic_CmpEyRm00000001.json",
  "Mana_Veins_Rank4_CmpMvR400000001.json",
  "Mana_Veins_Rank3_CmpMvR300000001.json",
  "Mana_Veins_Rank2_CmpMvR200000001.json",
  "Mana_Veins_Rank1_CmpMvR100000001.json",
  "Mana_Veins_Mythic_CmpMvRm00000001.json",
  "Heart_Rank4_CmpHtR400000001.json",
  "Heart_Rank3_CmpHtR300000001.json",
  "Heart_Rank2_CmpHtR200000001.json",
  "Heart_Rank1_CmpHtR100000001.json",
  "Heart_Mythic_CmpHtRm00000001.json",
];

const idOk = (id) => /^[a-zA-Z0-9]{16}$/.test(id || "");

async function fetchSource(filename) {
  const resp = await fetch(`${SRC}/${filename}`);
  if (!resp.ok) throw new Error(`Could not fetch ${filename} (${resp.status})`);
  const data = await resp.json();
  delete data._key;
  return data;
}

(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  try {
    const pack = game.packs.get(LOOT_PACK);
    if (!pack) return ui.notifications.error(`Pack not found: ${LOOT_PACK}`);

    const wasLocked = pack.locked;
    await pack.configure({ locked: false });

    // ── 1. Delete old items by name and by legacy ID ──────────────
    const index = await pack.getIndex();
    const oldNameSet = new Set(OLD_NAMES);
    const oldIdSet   = new Set(OLD_IDS);
    const staleIds   = new Set();
    for (const entry of index) {
      if (oldNameSet.has(entry.name) || oldIdSet.has(entry._id)) staleIds.add(entry._id);
    }
    // Also delete by new names in case a prior run partially populated
    const newNames = new Set(NEW_FILES.map(f => {
      // Extract name from filename: e.g. "Bones_Rank4_..." → look it up after fetch isn't ideal;
      // we'll handle new-name dedup below alongside creation.
    }));
    if (staleIds.size) {
      await Item.deleteDocuments([...staleIds], { pack: LOOT_PACK });
      console.log(`[Stryder] populate-components: deleted ${staleIds.size} old component(s).`);
    }

    // ── 2. Fetch all 20 new source docs ───────────────────────────
    const datas = await Promise.all(NEW_FILES.map(fetchSource));

    // ── 3. Dedup new names in case of re-run ─────────────────────
    const reIndex   = await pack.getIndex(); // refreshed after deletion
    const existIds  = new Set();
    const newNameSet = new Set(datas.map(d => d.name));
    for (const entry of reIndex) {
      if (newNameSet.has(entry.name) || datas.some(d => d._id === entry._id)) {
        existIds.add(entry._id);
      }
    }
    if (existIds.size) {
      await Item.deleteDocuments([...existIds], { pack: LOOT_PACK });
      console.log(`[Stryder] populate-components: removed ${existIds.size} prior canon copies for clean re-create.`);
    }

    // ── 4. Create all 20 with keepId ─────────────────────────────
    const keepers = datas.filter(d => idOk(d._id));
    const fresh   = datas.filter(d => !idOk(d._id)).map(({ _id, ...rest }) => {
      console.warn(`[Stryder] ${rest.name}: id "${_id}" not 16 chars — creating with fresh id`);
      return rest;
    });

    try {
      if (keepers.length) await Item.createDocuments(keepers, { pack: LOOT_PACK, keepId: true });
    } catch (err) {
      console.warn(`[Stryder] keepId batch failed (${err.message}) — retrying without ids`);
      fresh.push(...keepers.map(({ _id, ...rest }) => rest));
      keepers.length = 0;
    }
    if (fresh.length) await Item.createDocuments(fresh, { pack: LOOT_PACK });

    await pack.configure({ locked: wasLocked });

    // ── 5. Report ─────────────────────────────────────────────────
    const idTable = datas.map(d => `  ${d._id.padEnd(18)} ${d.name}`).join('\n');
    console.log(`[Stryder] populate-components: created ${datas.length} components.\n${idTable}`);
    ui.notifications.info(`Components imported: ${datas.length} canon items (4 types × 5 ranks) — old graded names purged.`);

  } catch (err) {
    console.error(err);
    ui.notifications.error(`populate-components failed: ${err.message}`);
  }
})();
