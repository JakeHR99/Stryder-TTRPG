// module/helpers/supply-items.mjs
// Shared item definitions for scavenged supplies.
// Used by the Scavenging minigame (rewards) and the Box of Bandages unpack
// logic in item.mjs. Art is Foundry core placeholder SVG — swap freely.

export const BANDAGE = {
  name: 'Bandage',
  type: 'consumable',
  img: 'icons/svg/regen.svg',
  system: {
    rarity: 'common',
    nature: 'enchanted',
    charges: { value: 1, max: 1 },
    sell_price: 1,
    description: '<p>A simple silken cloth imbued with a minor healing balm. '
      + 'Use it to staunch a <b>Bleeding Wound</b>, removing it from a creature.</p>',
  },
};

export const BOX_OF_BANDAGES = {
  name: 'Box of Bandages',
  type: 'consumable',
  img: 'icons/svg/chest.svg',
  system: {
    rarity: 'common',
    nature: 'enchanted',
    charges: { value: 1, max: 1 },
    sell_price: 4,
    description: '<p>A slim wooden box holding five silken cloths imbued with a minor '
      + 'healing balm. <b>Use it to unpack 5 Bandages</b> into your inventory.</p>',
  },
  flags: { stryder: { unpackBandages: 5 } },
};

export const BOTTLE_OF_WATER = {
  name: 'Bottle of Water',
  type: 'consumable',
  img: 'icons/svg/waterfall.svg',
  system: {
    rarity: 'common',
    nature: 'natural',
    charges: { value: 1, max: 1 },
    sell_price: 0,
    description: '<p>A corked bottle of clean water. Refreshing, at least.</p>',
  },
};

/** Fetch an elixir from the elixirs compendium by name, as plain item data.
 *  Falls back to a generic elixir item if the pack entry is missing. */
export async function elixirData(name) {
  try {
    const pack = game.packs.get('stryder.stryder-elixirs');
    if (pack) {
      const index = await pack.getIndex();
      const entry = index.find(e => e.name === name);
      if (entry) {
        const doc = await pack.getDocument(entry._id);
        const data = doc.toObject();
        delete data._id;
        return data;
      }
    }
  } catch (err) {
    console.warn(`Stryder | supply-items: could not fetch "${name}" from elixirs pack`, err);
  }
  return {
    name,
    type: 'elixir',
    img: 'icons/svg/tankard.svg',
    system: { description: `<p>${name} (compendium entry not found — placeholder).</p>` },
  };
}
