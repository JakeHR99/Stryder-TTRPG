// Stryder Component Compendium Populator — run once as GM.
// FULL WIPE: deletes EVERYTHING in stryder-loot, then creates the 20 canon
// component entries (Bones / Eyes / Mana Veins / Heart × Rank 4/3/2/1/Mythic).
// The pack holds components and nothing else — anything not in the canon 20
// is fluff by definition.
// Uses keepId since all new IDs are exactly 16 alphanumeric chars.

const LOOT_PACK = "stryder.stryder-loot";
const SRC       = "systems/stryder/_source/stryder-loot";

// Canon source filenames (20 files, 4 types × 5 ranks)
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

    // Confirm the full wipe before touching anything
    const index = await pack.getIndex();
    const preNames = index.map(e => e.name).sort().join(", ") || "(empty)";
    const confirmed = await Dialog.confirm({
      title: "Rebuild Components Compendium?",
      content: `<p>This will <strong>delete ALL ${index.size}</strong> item(s) currently in the pack:</p>
        <p style="font-size:11px;color:#888;">${preNames}</p>
        <p>…and replace them with the <strong>20 canon components</strong> (Bones, Eyes, Mana Veins, Heart × Rank 4–1 + Mythic).</p>`,
      yes: () => true, no: () => false, defaultYes: false,
    });
    if (!confirmed) return;

    const wasLocked = pack.locked;
    await pack.configure({ locked: false });

    // ── 1. Full wipe ───────────────────────────────────────────────
    const staleIds = index.map(e => e._id);
    if (staleIds.length) {
      await Item.deleteDocuments(staleIds, { pack: LOOT_PACK });
      console.log(`[Stryder] populate-components: wiped ${staleIds.length} existing item(s).`);
    }

    // ── 2. Fetch all 20 canon source docs ──────────────────────────
    const datas = await Promise.all(NEW_FILES.map(fetchSource));

    // ── 3. Create all 20 with keepId ───────────────────────────────
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

    // ── 4. Report ───────────────────────────────────────────────────
    const idTable = datas.map(d => `  ${d._id.padEnd(18)} ${d.name}`).join("\n");
    console.log(`[Stryder] populate-components: created ${datas.length} components.\n${idTable}`);
    ui.notifications.info(`Components rebuilt: pack wiped, ${datas.length} canon items created (4 types × 5 ranks).`);

  } catch (err) {
    console.error(err);
    ui.notifications.error(`populate-components failed: ${err.message}`);
  }
})();
