// Stryder Elixir Compendium Populator — run once as GM
const PACK_NAME = "stryder.stryder-elixirs";
const IMG = "systems/stryder/assets/items/item_067.png";

const ELIXIRS = [
  {
    name: "Elixir of Vitality",
    type: "elixir", img: IMG,
    system: {
      description: "<p>An elixir of pure life-essence. Drinking it floods the body with restorative energy, mending wounds from within.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "heal_hp_pct", effect_value: 25, effect_detail: "",
      ingredients: "5 Essence", success_value: 0, perfection_value: 0, duration: "Instant"
    }
  },
  {
    name: "Elixir of Recovery",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A brilliant blue elixir that restores the mana within your body. The user regains 2 Mana.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "restore_mana_flat", effect_value: 2, effect_detail: "",
      ingredients: "6 Raw Essence", success_value: 5, perfection_value: 7, duration: "Instant"
    }
  },
  {
    name: "Elixir of Anti-Venom",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A bitter green draught that neutralises all toxins in the blood. Removes all Poison conditions immediately.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "remove_condition", effect_value: 0, effect_detail: "Poison",
      ingredients: "6 Raw Essence", success_value: 0, perfection_value: 0, duration: "Instant"
    }
  },
  {
    name: "Elixir of Bravery",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A bold crimson tincture that steadies the nerves and steels the heart. Grants immunity to the Panicked condition for 10 minutes.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "5 Raw Essence", success_value: 0, perfection_value: 0, duration: "10 minutes"
    }
  },
  {
    name: "Elixir of Conduction",
    type: "elixir", img: IMG,
    system: {
      description: "<p>An insulating yellow elixir that regulates the body's electrical field. Grants immunity to the Shocked and Energized conditions for 10 minutes.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "5 Raw Essence", success_value: 0, perfection_value: 0, duration: "10 minutes"
    }
  },
  {
    name: "Elixir of Fervor",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A warm, spiced elixir that keeps the body's temperature regulated against extremes. Grants immunity to the Frozen and Soaked conditions for 10 minutes.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "4 Raw Essence", success_value: 0, perfection_value: 0, duration: "10 minutes"
    }
  },
  {
    name: "Elixir of Resilience",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A thick silver draught that fortifies the nervous system against disruption. Grants immunity to the Staggered and Stunned conditions for 10 minutes.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "3 Raw Essence", success_value: 0, perfection_value: 0, duration: "10 minutes"
    }
  },
  {
    name: "Elixir of Allure",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A sweet-smelling elixir that makes the drinker irresistible to nearby creatures. All non-party creatures within 3 spaces become Taunted (Magykal Resist 10) for 2 rounds.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "5 Raw Essence", success_value: 0, perfection_value: 0, duration: "2 rounds"
    }
  },
  {
    name: "Elixir of Immolation",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A blazing orange elixir that converts the drinker's life-force directly into stamina. For 3 rounds, you may spend 4 HP to gain 1 Stamina.</p>",
      sickness: 3, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "15 Essence", success_value: 0, perfection_value: 0, duration: "3 rounds"
    }
  },
  {
    name: "Elixir of Desperation",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A frantically fizzing elixir that supercharges the legs. Gain +5 Maximum Movement for 5 minutes.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "8 Essence", success_value: 0, perfection_value: 0, duration: "5 minutes"
    }
  },
  {
    name: "Elixir of Burgeoning Soul",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A deep violet elixir that temporarily amplifies the soul's power. Gain +2 to your Soul stat for 1 minute.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "7 Essence", success_value: 0, perfection_value: 0, duration: "1 minute"
    }
  },
  {
    name: "Elixir of Reflex",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A quicksilver elixir that sharpens reflexes to a razor's edge. Gain +1 to all Dodge and Evasion rolls for 1 minute.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "7 Essence", success_value: 0, perfection_value: 0, duration: "1 minute"
    }
  },
  {
    name: "Buzzy-Brew",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A crackling, effervescent brew that jolts the body into overdrive. Gain the Energized condition for 1 minute.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "9 Essence", success_value: 0, perfection_value: 0, duration: "1 minute"
    }
  },
  {
    name: "Elixir of Marked Prey",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A dark, pungent elixir that makes the drinker smell like prey claimed by a higher predator. Monsters must roll Instinct 10+ to target you instead of other creatures. Lasts 5 minutes.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "14 Essence", success_value: 0, perfection_value: 0, duration: "5 minutes"
    }
  },
  {
    name: "Elixir of Vanishing",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A nearly transparent elixir that dulls the drinker's presence to near-invisibility. Gain +3 to all Hide rolls for 10 minutes.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "9 Essence", success_value: 0, perfection_value: 0, duration: "10 minutes"
    }
  },
  {
    name: "Elixir of Wild Infusion",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A roiling green elixir that infuses the body with primal physical energy. Choose a Physical Talent — gain +3 to all rolls using that Talent for 1 hour.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "4 Essence", success_value: 0, perfection_value: 0, duration: "1 hour"
    }
  },
  {
    name: "Elixir of Gregarious Tongue",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A warm golden elixir that loosens the tongue and sharpens the wit. Choose a Social Talent — gain +3 to all rolls using that Talent for 1 hour.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "4 Essence", success_value: 0, perfection_value: 0, duration: "1 hour"
    }
  },
  {
    name: "Elixir of Awakened Mind",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A crystal-clear elixir that sharpens thought and expands perception. Choose a Mental Talent — gain +5 to all rolls using that Talent for 30 minutes.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "8 Essence", success_value: 0, perfection_value: 0, duration: "30 minutes"
    }
  },
  {
    name: "Elixir of Beast Sense",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A potent animal-essence draught that elevates the senses to bestial levels. Choose one of your Senses — it is raised to 5 for 1 hour.</p>",
      sickness: 3, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "8 Essence", success_value: 0, perfection_value: 0, duration: "1 hour"
    }
  },
  {
    name: "Elixir of Evolution",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A shimmering elixir that awakens dormant physical potential. Gain a movement Expertise of your choice for 1 hour.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "7 Essence", success_value: 0, perfection_value: 0, duration: "1 hour"
    }
  },
  {
    name: "Elixir of Transformation",
    type: "elixir", img: IMG,
    system: {
      description: "<p>An unstable, chaotic elixir with unpredictable results. Roll a d6:<br><strong>1</strong> — +1 attack range; hits deal 3 Bleeding Wounds.<br><strong>2</strong> — All attacks deal 2d6+1 and inflict Confused.<br><strong>3</strong> — +7 Movement; lose all movement Expertises.<br><strong>4</strong> — +2 Dodge/Evasion; auto-fail Magykal Resistance.<br><strong>5</strong> — Regain 8 HP.<br><strong>6</strong> — Regain 1 Mana per Player Phase.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "roll_d6", effect_value: 0, effect_detail: "",
      ingredients: "7 Raw Essence", success_value: 0, perfection_value: 0, duration: "Varies"
    }
  },
  {
    name: "Elixir of Presence-of-Mind",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A calm, centring elixir that fortifies the mind against disruption. Gain +4 to all Magykal Resistance rolls vs Confused, Panicked, Senseless, Stunned, and Unconscious for 10 minutes.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "14 Essence", success_value: 0, perfection_value: 0, duration: "10 minutes"
    }
  },
  {
    name: "Elixir of Mystic Resistance",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A silver elixir that hardens the soul against magical intrusion. Gain +2 to all Magykal Resistance rolls for 10 minutes.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "14 Essence", success_value: 0, perfection_value: 0, duration: "10 minutes"
    }
  },
  {
    name: "Elixir of Reinforcement",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A dense, iron-tasting elixir that temporarily hardens the body like armour. Gain +3 to Physical Resistance for 10 minutes.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "16 Essence", success_value: 19, perfection_value: 21, duration: "10 minutes"
    }
  },
  {
    name: "Elixir of Riptide Veins",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A crackling blue elixir that floods the veins with magical current. Gain +3 Magykal Potency for 5 minutes. Abilities requiring Magykal Resistance cost +1 Stamina while active.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "25 Essence", success_value: 0, perfection_value: 0, duration: "5 minutes"
    }
  },
  {
    name: "Elixir of Iron Soul",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A heavy, metallic elixir that converts all vitality into raw physical force. Gain +3 Physical Potency for 5 minutes. You cannot regain HP by any means while this is active.</p>",
      sickness: 2, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "18 Essence", success_value: 0, perfection_value: 0, duration: "5 minutes"
    }
  },
  {
    name: "Elixir of Reject Corruption",
    type: "elixir", img: IMG,
    system: {
      description: "<p>A pure white elixir that cleanses Grim corruption from the body. Halts all active Grim effects and restores any Stamina lost to Grim (HP is not restored). Lasts 4 hours.</p>",
      sickness: 1, elixir_type: "beneficial",
      effect_type: "none", effect_value: 0, effect_detail: "",
      ingredients: "16 Essence", success_value: 0, perfection_value: 0, duration: "4 hours"
    }
  },
  // ── Offensive ──────────────────────────────────────────────────────────────
  {
    name: "Incendiary Elixir",
    type: "elixir", img: IMG,
    system: {
      description: "<p><strong>Offensive.</strong> Throw at a target. On hit, inflicts the Burning condition. Does not apply Elixir Sickness to the user.</p>",
      sickness: 0, elixir_type: "offensive",
      effect_type: "apply_condition", effect_value: 0, effect_detail: "Burning",
      ingredients: "—", success_value: 0, perfection_value: 0, duration: "Until extinguished"
    }
  },
  {
    name: "Sludge Elixir",
    type: "elixir", img: IMG,
    system: {
      description: "<p><strong>Offensive.</strong> Throw at a target. On hit, inflicts the Trapped condition for 1 round. Does not apply Elixir Sickness to the user.</p>",
      sickness: 0, elixir_type: "offensive",
      effect_type: "apply_condition", effect_value: 0, effect_detail: "Trapped",
      ingredients: "—", success_value: 0, perfection_value: 0, duration: "1 round"
    }
  },
  {
    name: "Burst Elixir",
    type: "elixir", img: IMG,
    system: {
      description: "<p><strong>Offensive.</strong> Throw at a target. On hit, inflicts the Soaked condition for 1 minute. Does not apply Elixir Sickness to the user.</p>",
      sickness: 0, elixir_type: "offensive",
      effect_type: "apply_condition", effect_value: 0, effect_detail: "Soaked",
      ingredients: "—", success_value: 0, perfection_value: 0, duration: "1 minute"
    }
  },
  {
    name: "Polar Elixir",
    type: "elixir", img: IMG,
    system: {
      description: "<p><strong>Offensive.</strong> Throw at a target. On hit, inflicts the Frozen condition for 1 round. Does not apply Elixir Sickness to the user.</p>",
      sickness: 0, elixir_type: "offensive",
      effect_type: "apply_condition", effect_value: 0, effect_detail: "Frozen",
      ingredients: "—", success_value: 0, perfection_value: 0, duration: "1 round"
    }
  }
];

(async () => {
  const pack = game.packs.get(PACK_NAME);
  if (!pack) {
    ui.notifications.error(`Pack "${PACK_NAME}" not found.`);
    return;
  }
  await pack.configure({ locked: false });
  const existing = await pack.getDocuments();
  for (const doc of existing) await doc.delete();
  await pack.documentClass.createDocuments(ELIXIRS, { pack: PACK_NAME });
  await pack.configure({ locked: true });
  ui.notifications.info(`✅ ${ELIXIRS.length} elixirs created in compendium!`);
})();
