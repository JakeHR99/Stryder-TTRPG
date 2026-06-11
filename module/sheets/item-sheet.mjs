import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class StryderItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['stryder', 'sheet', 'item'],
      width: 600,
      height: 480,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'description',
        },
      ],
    });
  }

  /** @override */
  get template() {
    const path = 'systems/stryder/templates/item';
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.hbs`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.hbs`.
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve base data structure.
    const context = super.getData();

    // Use a safe clone of the item data for further operations.
    const itemData = context.data;

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = this.item.getRollData();

    // Add the item's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;

    // Prepare active effects for easier access
    context.effects = prepareActiveEffectCategories(this.item.effects);

    // Rarity ribbon class for ornate item frames (Phase 3A)
    const type = this.item.type;
    const sys = context.system;
    let rarityClass = '';
    if (['loot', 'consumable', 'legacies', 'head', 'back', 'arms', 'legs', 'gems'].includes(type)) {
      const r = (sys.rarity ?? 'common').toLowerCase();
      const valid = ['common', 'uncommon', 'rare', 'legendary', 'unique'];
      rarityClass = 'sty-rarity-' + (valid.includes(r) ? r : 'common');
    } else if (type === 'component') {
      const gradeMap = { 'G4': 'common', 'G3': 'uncommon', 'G2': 'rare', 'G1': 'legendary', 'Mythic': 'unique' };
      rarityClass = 'sty-rarity-' + (gradeMap[sys.grade] ?? 'common');
    } else if (type === 'ingredient') {
      const qualMap = { 'rotten': 'common', 'bad': 'uncommon', 'good': 'rare', 'great': 'legendary', 'gourmet': 'unique' };
      rarityClass = 'sty-rarity-' + (qualMap[sys.quality] ?? 'rare');
    } else if (type === 'gear') {
      const gearMap = { 'prototype': 'common', 'standard': 'uncommon', 'refined': 'rare', 'masterwork': 'legendary', 'artifact': 'unique' };
      rarityClass = 'sty-rarity-' + (gearMap[sys.quality] ?? 'common');
    }
    context.rarityClass = rarityClass;

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers, click handlers, etc. would go here.

    // Active Effect management
    html.on('click', '.effect-control', (ev) =>
      onManageActiveEffect(ev, this.item)
    );
  }
}
