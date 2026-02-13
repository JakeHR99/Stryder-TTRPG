// Adds Floran-specific Quadrupedal and Tetrabrachial to the Floran folder.
// Paste into F12 console after the other imports.

(async () => {
  const PACK_ID = "stryder.stryder-folk-abilities";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error("Could not find Folk Abilities compendium!"); return; }
  await pack.configure({ locked: false });

  const floranFolder = pack.folders.find(f => f.name === "Floran");
  if (!floranFolder) { ui.notifications.error("Floran folder not found! Run the main import first."); return; }

  async function create(data) {
    await Item.create({
      name: data.name, type: "racial", folder: floranFolder.id, img: "icons/svg/aura.svg",
      system: {
        description: data.description || "", action_type: data.action_type || "",
        cooldown_value: 0, cooldown_unit: "", range: "", stamina_cost: 0, mana_cost: 0,
        other_restrictions: data.other_restrictions || "",
        charges: { max: 0, value: 0 }, uses_current: 0,
        tag1: "", tag2: "", tag3: "",
        isAttack: false, damage_type: "physical",
        customDamage: { poor: "", good: "", excellent: "" },
        roll: { diceBonus: 0, diceNum: 2, diceSize: 6 }
      }
    }, { pack: PACK_ID });
  }

  await create({
    name: "Optional Feature - Quadrupedal (Floran)",
    description: "<p>You choose to have four legs and gain +3 Movement and a +1 to Evasion. You also have a -1 penalty to all Resistance Rolls that would cause you to be dropped. You cannot gain Climbing Expertise and Climbing terrain spaces cost an additional 2 Movement to enter. This biological variation causes you to be unable to don Leg Equipment.</p>",
    action_type: "passive",
    other_restrictions: "Cannot don Leg Equipment, cannot gain Climbing Expertise"
  });

  await create({
    name: "Optional Feature - Tetrabrachial (Floran)",
    description: "<p>You have four arms and can perform two Interact actions for no cost each Round. You gain +1 bonus to Grapple Checks of any kind and gain +1 bonus to Finesse and Strength Rolls. This biological variation causes you to be unable to don Torso Equipment. You are still only able to don 2 pieces of Arm Equipment.</p>",
    action_type: "passive",
    other_restrictions: "Cannot don Torso Equipment, limited to 2 Arm Equipment pieces"
  });

  ui.notifications.info("Floran optional features added!");
})();
