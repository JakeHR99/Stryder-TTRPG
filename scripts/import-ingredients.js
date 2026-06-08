// ============================================================
// STRYDER — Ingredient Compendium Import
// ============================================================
// HOW TO USE:
// 1. Open Foundry VTT and load your Stryder world
// 2. Press F12 to open the developer console
// 3. Copy and paste this ENTIRE script into the console
// 4. Press Enter and wait for "Import complete!" notification
// ============================================================

(async () => {
  const PACK_ID = "stryder.stryder-ingredients";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error("Could not find stryder-ingredients compendium!"); return; }
  await pack.configure({ locked: false });
  await pack.getDocuments();
  ui.notifications.info("Starting Ingredients import…");

  const INGREDIENTS = [
    // ── Bases ──────────────────────────────────────────────────────────────
    {
      _id: "IngrBase01Grain",
      name: "Grain",
      type: "ingredient",
      img: "icons/consumables/grains/bun-bread-round-tan.webp",
      system: {
        description: "<p>A staple base ingredient. Grains include wheat, rice, oats, and similar crops harvested from cultivated fields or foraged from the wild. Forms the foundation of most hearty meals.</p>",
        ingredient_type: "base",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 1
      },
      sort: 100000
    },
    {
      _id: "IngrBase02Root",
      name: "Root Vegetable",
      type: "ingredient",
      img: "icons/consumables/plants/root-brown-orange.webp",
      system: {
        description: "<p>Hardy vegetables that grow underground — potatoes, turnips, carrots, and similar roots. Earthy in flavour and filling, making them excellent bases for stews and roasted dishes.</p>",
        ingredient_type: "base",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 1
      },
      sort: 200000
    },
    {
      _id: "IngrBase03Leaf",
      name: "Leafy Green",
      type: "ingredient",
      img: "icons/consumables/plants/leaf-green.webp",
      system: {
        description: "<p>Tender leafy vegetables such as spinach, wild greens, or cultivated cabbage. Light and nutritious, they complement heavier ingredients and add freshness to any dish.</p>",
        ingredient_type: "base",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 1
      },
      sort: 300000
    },
    // ── Proteins ───────────────────────────────────────────────────────────
    {
      _id: "IngrProt01Meat",
      name: "Meat",
      type: "ingredient",
      img: "icons/consumables/meat/steak-raw-beef-red.webp",
      system: {
        description: "<p>Raw cuts of animal meat — game, livestock, or fowl. A hearty protein that forms the centrepiece of many camp meals. Quality depends on the freshness of the cut and the skill of the hunter who procured it.</p>",
        ingredient_type: "protein",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 2
      },
      sort: 400000
    },
    {
      _id: "IngrProt02Fish",
      name: "Fish",
      type: "ingredient",
      img: "icons/consumables/fish/fish-teal-green.webp",
      system: {
        description: "<p>A fish caught at a Fishing Spot. A reliable source of protein for camp cooking. Quality improves with the skill of the Fisher who caught it.</p>",
        ingredient_type: "protein",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 1
      },
      sort: 500000
    },
    {
      _id: "IngrProt03LFish",
      name: "Large Fish",
      type: "ingredient",
      img: "icons/consumables/fish/fish-purple-orange.webp",
      system: {
        description: "<p>A powerful fish hauled ashore after a Mighty Reeling struggle. Yields more meat than a common catch and commands a higher price at market. Prized by camp cooks for its rich flavour.</p>",
        ingredient_type: "protein",
        quality: "great",
        quality_modifier: 1,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 3
      },
      sort: 600000
    },
    {
      _id: "IngrProt04Mush",
      name: "Wild Mushroom",
      type: "ingredient",
      img: "icons/consumables/plants/mushroom-spotted-tan.webp",
      system: {
        description: "<p>Mushrooms foraged from forest floors or cave systems. Earthy, umami-rich, and versatile — equally at home as a base or protein substitute. Must be properly identified before use.</p>",
        ingredient_type: "protein",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 2
      },
      sort: 700000
    },
    // ── Spices ─────────────────────────────────────────────────────────────
    {
      _id: "IngrSpice01Salt",
      name: "Salt",
      type: "ingredient",
      img: "icons/commodities/materials/salt-white.webp",
      system: {
        description: "<p>A mineral seasoning essential to any cook's pack. Enhances the natural flavour of all other ingredients and acts as a preservative. Sourced from salt flats, mines, or coastal trade.</p>",
        ingredient_type: "spice",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 1
      },
      sort: 800000
    },
    {
      _id: "IngrSpice02Pepper",
      name: "Black Pepper",
      type: "ingredient",
      img: "icons/commodities/materials/powder-black.webp",
      system: {
        description: "<p>Ground peppercorns that add warmth and mild heat to any dish. A common spice carried by travelling cooks. Traded widely across Alstoria and valued for its ability to mask the flavour of poorer ingredients.</p>",
        ingredient_type: "spice",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 1
      },
      sort: 900000
    },
    {
      _id: "IngrSpice03Herb",
      name: "Dried Herb",
      type: "ingredient",
      img: "icons/consumables/plants/herb-bundle-dried-green.webp",
      system: {
        description: "<p>A bundle of dried aromatic herbs — rosemary, thyme, sage, or local Alstoria flora. Adds depth and fragrance to cooked dishes. Foraged during travel or purchased from herbalists and markets.</p>",
        ingredient_type: "spice",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 1
      },
      sort: 1000000
    },
    // ── Sauces ─────────────────────────────────────────────────────────────
    {
      _id: "IngrSauce01Basic",
      name: "Basic Sauce",
      type: "ingredient",
      img: "icons/consumables/drinks/bottle-sauce-red.webp",
      system: {
        description: "<p>A simple prepared sauce — a reduction of stock, fat, and basic flavourings. Not required for cooking but adds a consistent bonus to the final dish. Most camp cooks keep a bottle in their pack at all times.</p>",
        ingredient_type: "sauce",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 2
      },
      sort: 1100000
    },
    {
      _id: "IngrSauce02Herb",
      name: "Herb Sauce",
      type: "ingredient",
      img: "icons/consumables/drinks/bottle-sauce-green.webp",
      system: {
        description: "<p>A fragrant sauce infused with fresh or dried herbs. More complex than a basic sauce and commands a higher price, but rewards skilled cooks with a superior bonus to the final dish quality.</p>",
        ingredient_type: "sauce",
        quality: "good",
        quality_modifier: 0,
        is_enchanted: false,
        enchant_type: "",
        sell_price: 3
      },
      sort: 1200000
    }
  ];

  // Check existing by name to avoid duplicates
  await pack.getDocuments();
  const existingNames = new Set(pack.contents.map(d => d.name));

  let created = 0;
  let skipped = 0;
  for (const data of INGREDIENTS) {
    if (existingNames.has(data.name)) {
      skipped++;
      continue;
    }
    // Strip _id and sort — let Foundry generate a valid 16-char ID
    const { _id, sort, _key, ...cleanData } = data;
    try {
      await pack.documentClass.create(cleanData, { pack: PACK_ID });
      created++;
    } catch(e) {
      console.error(`Failed to create ${data.name}:`, e);
    }
  }

  await pack.configure({ locked: true });
  ui.notifications.info(`Ingredients import complete! Created: ${created}, Skipped (already existed): ${skipped}.`);
})();
