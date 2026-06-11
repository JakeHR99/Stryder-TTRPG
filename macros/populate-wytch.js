// Stryder Wytch Compendium Populator — run once as GM.
// Upserts the Wytch class item, both feature folders, and all 18 Wytch
// class features/hexes from the system's _source JSON files into
// the stryder-classes and stryder-class-features compendiums.
// Handles short legacy _ids (<16 chars) that Foundry v13 keepId rejects:
// falls back to a fresh id per document (grant code matches by name).

const CLS_PACK = "stryder.stryder-classes";
const CF_PACK  = "stryder.stryder-class-features";
const SRC      = "systems/stryder/_source";

const CLASS_FILE   = "stryder-classes/Wytch_WytchClass000001.json";
const FOLDER_FILES = [
  "stryder-class-features/Wytch_Class_Features_WytFeatFolder01.json",
  "stryder-class-features/Wytch_Hexes_WytHexFolder01.json",
];
const FEATURE_FILES = [
  "Magykal_Focus_WytAbil01MgFcs.json",
  "Hex_Wielding_WytAbil02HxWld.json",
  "Focus_and_Remains_WytAbil03FcsRmn.json",
  "The_Wytches_Eye_WytAbil04WytEye.json",
  "Hex_Mastery_WytAbil05HxMst.json",
  "True_Focus_Over_Remains_WytAbil06TrFcs.json",
  "Hex_Sicken_WytHex01Sck.json",
  "Hex_Bind_WytHex02Bnd.json",
  "Hex_Deny_WytHex03Dny.json",
  "Hex_Mutilate_WytHex04Mut.json",
  "Hex_Enrage_WytHex05Enr.json",
  "Hex_Panic_WytHex06Pnc.json",
  "Hex_Surge_WytHex07Srg.json",
  "Hex_Rise_WytHex08Rise.json",
  "Hex_Give_WytHex09Give.json",
  "Hex_Addle_WytHex10Add.json",
  "Hex_Suffer_WytHex11Sfr.json",
  "Hex_Delude_WytHex12Del.json",
].map(f => `stryder-class-features/${f}`);

const idOk = (id) => /^[a-zA-Z0-9]{16}$/.test(id || "");

async function fetchSource(path) {
  const resp = await fetch(`${SRC}/${path}`);
  if (!resp.ok) throw new Error(`Could not fetch ${path} (${resp.status})`);
  const data = await resp.json();
  delete data._key; // CLI-only field
  return data;
}

async function upsertItems(packName, datas) {
  const pack = game.packs.get(packName);
  if (!pack) return ui.notifications.error(`Pack not found: ${packName}`);
  const wasLocked = pack.locked;
  await pack.configure({ locked: false });

  const index = await pack.getIndex();
  // Remove stale copies by _id or name so we can recreate cleanly
  const staleIds = [];
  for (const d of datas) {
    for (const e of index) {
      if (e._id === d._id || e.name === d.name) staleIds.push(e._id);
    }
  }
  if (staleIds.length) await Item.deleteDocuments([...new Set(staleIds)], { pack: packName });

  // Split: valid 16-char ids keep their id; short legacy ids get fresh ones
  const keepers = datas.filter(d => idOk(d._id));
  const fresh   = datas.filter(d => !idOk(d._id)).map(d => {
    const { _id, ...rest } = d;
    console.warn(`Stryder | ${d.name}: legacy id "${_id}" (<16 chars) — creating with a fresh id`);
    return rest;
  });

  try {
    if (keepers.length) await Item.createDocuments(keepers, { pack: packName, keepId: true });
  } catch (err) {
    // Belt-and-braces: if keepId still throws, retry those without ids too
    console.warn(`Stryder | keepId batch failed (${err.message}) — retrying with fresh ids`);
    fresh.push(...keepers.map(({ _id, ...rest }) => rest));
    keepers.length = 0;
  }
  if (fresh.length) await Item.createDocuments(fresh, { pack: packName });

  await pack.configure({ locked: wasLocked });
  console.log(`Stryder | Upserted ${datas.length} document(s) into ${packName}`);
}

async function ensureFolder(packName, folderData) {
  const pack = game.packs.get(packName);
  const wasLocked = pack.locked;
  await pack.configure({ locked: false });
  const byId   = pack.folders?.get(folderData._id);
  const byName = pack.folders?.find(f => f.name === folderData.name);
  if (!byId && !byName) {
    try {
      await Folder.create(folderData, { pack: packName, keepId: idOk(folderData._id) });
    } catch (err) {
      const { _id, ...rest } = folderData;
      await Folder.create(rest, { pack: packName });
    }
    console.log(`Stryder | Created folder ${folderData.name} in ${packName}`);
  }
  await pack.configure({ locked: wasLocked });
  return (pack.folders?.get(folderData._id) ?? pack.folders?.find(f => f.name === folderData.name))?.id;
}

(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  try {
    // 1. Class item
    const classData = await fetchSource(CLASS_FILE);
    await upsertItems(CLS_PACK, [classData]);

    // 2. Feature folders (remap folder references in case folders got fresh ids)
    const folderMap = {};
    for (const f of FOLDER_FILES) {
      const folderData = await fetchSource(f);
      const realId = await ensureFolder(CF_PACK, folderData);
      folderMap[folderData._id] = realId;
    }

    // 3. Feature items (with folder remap)
    const featureDatas = await Promise.all(FEATURE_FILES.map(fetchSource));
    for (const d of featureDatas) {
      if (d.folder && folderMap[d.folder]) d.folder = folderMap[d.folder];
    }
    await upsertItems(CF_PACK, featureDatas);

    ui.notifications.info(`Wytch imported: class + ${featureDatas.length} features/hexes. Now open the Wytch's Growth page to trigger the grant, then check the Battle page.`);
  } catch (err) {
    console.error(err);
    ui.notifications.error(`Wytch import failed: ${err.message}`);
  }
})();
