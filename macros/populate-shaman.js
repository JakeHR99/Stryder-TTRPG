// Stryder Shaman Compendium Populator — run once as GM.
// Imports all Shaman class features and Lordly Aspect features (plus folder docs)
// into stryder.stryder-class-features, replacing any stale copies by name or legacy ID.
// Uses the idOk pattern: exactly 16 alphanumeric chars → keepId; short/legacy IDs get fresh ids.

const CF_PACK = "stryder.stryder-class-features";
const SRC     = "systems/stryder/_source/stryder-class-features";

// ── Folder docs (must be imported first so items can reference them) ──────────
const FOLDER_FILES = [
  "Shaman_Class_Features_ShmClsFolder01.json",
  "Lordly_Aspect_Wild_LrdlyWldFolder01.json",
  "Lordly_Aspect_Royal_LrdlyRylFolder01.json",
  "Lordly_Aspect_Spirit_LrdlySprFolder01.json",
];

// ── Shaman class feature items ─────────────────────────────────────────────────
const SHAMAN_ITEM_FILES = [
  "Bonded_Lives_ShmAbil01BndLv.json",
  "Expanding_Bond_ShmAbil02ExpBnd.json",
  "Desperate_Strength_ShmAbil03DspStr.json",
  "Spirit_Armament_ShmAbil04SprArm.json",
  "Approximate_Ascension_ShmAbil05ApAsc.json",
  "Tactic_Attack_ShmTac01Atk.json",
  "Tactic_Heal_ShmTac02Heal.json",
  "Tactic_Dodge_Evasion_ShmTac03DgEv.json",
  "Tactic_Return_ShmTac04Ret.json",
  "Tactic_Metamorph_ShmTac05Met.json",
  "Tactic_Retreat_ShmTac06Rtr.json",
  "Tactic_Transfer_Talent_ShmTac07TrTl.json",
  "Spirits_Wrath_ShmSpWrth000001a.json",
  "Spirits_Compassion_ShmSpComp0000001.json",
];

// ── Lordly Aspect feature items ────────────────────────────────────────────────
const LORDLY_ITEM_FILES = [
  // Wild
  "Strike_Together_LrdWldAbil01StTg.json",
  "Agile_Mount_LrdWldAbil02AgMt.json",
  "Stride_of_the_Wild_Ones_LrdWldAbil03StWd.json",
  "Bombardment_LrdWldAbil04Bmbd.json",
  "Monkey_Paw_LrdRylAbil03MnPw.json",
  "Tigers_Pounce_LrdRylAbil05TgPn.json",
  // Royal
  "Marching_Quake_LrdRylAbil01MrQk.json",
  "Siege_Beast_LrdRylAbil02SgBs.json",
  "Imposing_Mount_LrdRylAbil04ImMt.json",
  "Fastball_LrdRylAbil06Ftbl.json",
  "Mystical_Rejuvenation_LrdRylAbil07MyRj.json",
  "Royals_Decree_LrdRylAbil08RyDc.json",
  // Spirit
  "Diamond_Body_Reverent_Mind_LrdSprAbil01DbRm.json",
  "Ranged_Arsenal_LrdSprAbil02RgAr.json",
  "Blink_and_Miss_LrdSprAbil03BlMs.json",
  "Fight_Through_Me_LrdSprAbil04FtMe.json",
];

const ALL_ITEM_FILES = [...SHAMAN_ITEM_FILES, ...LORDLY_ITEM_FILES];

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
    const pack = game.packs.get(CF_PACK);
    if (!pack) return ui.notifications.error(`Pack not found: ${CF_PACK}`);

    const wasLocked = pack.locked;
    await pack.configure({ locked: false });

    // ── 1. Import / update folder documents ────────────────────────────────
    const folderDatas = await Promise.all(FOLDER_FILES.map(fetchSource));
    const existingFolders = await pack.folders;
    for (const fd of folderDatas) {
      const exists = existingFolders.find(f => f._id === fd._id || f.name === fd.name);
      if (!exists) {
        // Foundry v12/v13: create folder in pack
        try {
          await Folder.create(fd, { pack: CF_PACK });
        } catch (e) {
          console.warn(`[Stryder] populate-shaman: folder "${fd.name}" create failed (${e.message}) — may already exist`);
        }
      }
    }

    // ── 2. Fetch all item source docs ───────────────────────────────────────
    const datas = await Promise.all(ALL_ITEM_FILES.map(fetchSource));

    // ── 3. Delete stale copies by name or ID (clean re-import) ─────────────
    const index = await pack.getIndex();
    const newNameSet = new Set(datas.map(d => d.name));
    const newIdSet   = new Set(datas.map(d => d._id));
    const staleIds   = new Set();
    for (const entry of index) {
      if (newNameSet.has(entry.name) || newIdSet.has(entry._id)) staleIds.add(entry._id);
    }
    if (staleIds.size) {
      await Item.deleteDocuments([...staleIds], { pack: CF_PACK });
      console.log(`[Stryder] populate-shaman: deleted ${staleIds.size} stale item(s).`);
    }

    // ── 4. Create items — keepId for 16-char IDs, fresh IDs for short ones ──
    const keepers = datas.filter(d => idOk(d._id));
    const fresh   = datas.filter(d => !idOk(d._id)).map(({ _id, ...rest }) => {
      console.warn(`[Stryder] populate-shaman: "${rest.name}" id "${_id}" is not 16 chars — using fresh id`);
      return rest;
    });

    let created = 0;
    try {
      if (keepers.length) {
        await Item.createDocuments(keepers, { pack: CF_PACK, keepId: true });
        created += keepers.length;
      }
    } catch (err) {
      console.warn(`[Stryder] keepId batch failed (${err.message}) — retrying without ids`);
      fresh.push(...keepers.map(({ _id, ...rest }) => rest));
    }
    if (fresh.length) {
      await Item.createDocuments(fresh, { pack: CF_PACK });
      created += fresh.length;
    }

    await pack.configure({ locked: wasLocked });

    // ── 5. Report ──────────────────────────────────────────────────────────
    const table = datas.map(d => `  ${(d._id ?? '(fresh)').padEnd(18)} ${d.name}`).join('\n');
    console.log(`[Stryder] populate-shaman: created/updated ${created} item(s).\n${table}`);
    ui.notifications.info(`Shaman pack populated: ${created} items (${SHAMAN_ITEM_FILES.length} class features + ${LORDLY_ITEM_FILES.length} Lordly Aspects).`);

  } catch (err) {
    console.error(err);
    ui.notifications.error(`populate-shaman failed: ${err.message}`);
  }
})();
