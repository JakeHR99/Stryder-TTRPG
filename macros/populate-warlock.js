// Stryder Warlock Compendium Populator — run once as GM.
// Upserts the Warlock class item and all 11 Warlock class features
// (plus their pack folder) from the system's _source JSON files into
// the stryder-classes and stryder-class-features compendiums.

const CLS_PACK = "stryder.stryder-classes";
const CF_PACK  = "stryder.stryder-class-features";
const SRC      = "systems/stryder/_source";

const CLASS_FILE = "stryder-classes/Warlock_WarlockClass0001.json";
const FOLDER_FILE = "stryder-class-features/Warlock_Class_Features_WrlkFeatFolder01.json";
const FEATURE_FILES = [
  "Body_of_War_WrlkAbil01BdWr.json",
  "Scarlet_Strike_WrlkAbil02ScStr.json",
  "Scarlet_Warden_WrlkAbil03ScWrd.json",
  "Sin_Siphon_WrlkAbil04SnSph.json",
  "Blood_Tithes_WrlkAbil05BlTth.json",
  "Sanguine_Ichor_WrlkAbil06SngIch.json",
  "Crimson_Crown_WrlkAbil07CrmCrn.json",
  "Hemorrhaging_Lance_WrlkAbil08HmrLnc.json",
  "Sacrifice_WrlkAbil09SacWrl.json",
  "Bloodied_Eclipse_WrlkAbil10BldEcl.json",
  "Masochistic_Returns_WrlkAbil11MscRtn.json",
].map(f => `stryder-class-features/${f}`);

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
  // Remove stale copies by _id or name so we can recreate with keepId
  const staleIds = [];
  for (const d of datas) {
    for (const e of index) {
      if (e._id === d._id || e.name === d.name) staleIds.push(e._id);
    }
  }
  if (staleIds.length) await Item.deleteDocuments([...new Set(staleIds)], { pack: packName });

  await Item.createDocuments(datas, { pack: packName, keepId: true });
  await pack.configure({ locked: wasLocked });
  console.log(`Stryder | Upserted ${datas.length} document(s) into ${packName}`);
}

async function ensureFolder(packName, folderData) {
  const pack = game.packs.get(packName);
  const wasLocked = pack.locked;
  await pack.configure({ locked: false });
  const existing = pack.folders?.get(folderData._id);
  if (!existing) {
    await Folder.create(folderData, { pack: packName, keepId: true });
    console.log(`Stryder | Created folder ${folderData.name} in ${packName}`);
  }
  await pack.configure({ locked: wasLocked });
}

(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  try {
    // 1. Class item
    const classData = await fetchSource(CLASS_FILE);
    await upsertItems(CLS_PACK, [classData]);

    // 2. Feature folder
    const folderData = await fetchSource(FOLDER_FILE);
    await ensureFolder(CF_PACK, folderData);

    // 3. Feature items
    const featureDatas = await Promise.all(FEATURE_FILES.map(fetchSource));
    await upsertItems(CF_PACK, featureDatas);

    ui.notifications.info(`Warlock imported: class + ${featureDatas.length} class features. Reload the world if the Class Path panel doesn't update.`);
  } catch (err) {
    console.error(err);
    ui.notifications.error(`Warlock import failed: ${err.message}`);
  }
})();
