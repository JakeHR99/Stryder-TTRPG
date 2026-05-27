// ============================================================
// STRYDER — Party Actor Sheet
// ============================================================
import { STRYDER } from '../helpers/config.mjs';

export class StryderPartySheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['stryder', 'sheet', 'actor', 'party'],
      template: 'systems/stryder/templates/actor/actor-party-sheet.hbs',
      width: 720,
      height: 600,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'members' }],
      dragDrop: [{ dragSelector: '.item-list .item', dropSelector: null }]
    });
  }

  get template() {
    return 'systems/stryder/templates/actor/actor-party-sheet.hbs';
  }

  async getData() {
    const context = await super.getData();
    const actor = this.actor;

    // Resolve member actor UUIDs → actor objects with display data
    const memberIds = actor.system.members ?? [];
    const members = memberIds.map(uuid => {
      // Support both UUID and plain ID for backwards compat
      const memberActor = fromUuidSync(uuid) ?? game.actors.get(uuid);
      if (!memberActor) return null;
      return {
        uuid,
        id: memberActor.id,
        name: memberActor.name,
        img: memberActor.img,
        type: memberActor.type,
        health:  { value: memberActor.system.health?.value  ?? 0, max: memberActor.system.health?.max  ?? 0 },
        stamina: { value: memberActor.system.stamina?.value ?? 0, max: memberActor.system.stamina?.max ?? 0 },
        mana:    { value: memberActor.system.mana?.value    ?? 0, max: memberActor.system.mana?.max    ?? 0 },
      };
    }).filter(Boolean);

    // Split items
    const actions   = actor.items.filter(i => i.type === 'action' && !i.system.isCampTask);
    const campTasks = actor.items.filter(i => i.type === 'action' &&  i.system.isCampTask);

    context.members   = members;
    context.actions   = actions;
    context.campTasks = campTasks;
    context.system    = actor.system;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Remove member
    html.find('.member-remove').click(async (ev) => {
      const uuid = ev.currentTarget.dataset.uuid;
      const current = foundry.utils.duplicate(this.actor.system.members ?? []);
      const updated = current.filter(u => u !== uuid);
      await this.actor.update({ 'system.members': updated });
    });

    // Click member portrait → open their sheet
    html.find('.member-portrait').click((ev) => {
      const uuid = ev.currentTarget.dataset.uuid;
      const memberActor = fromUuidSync(uuid) ?? game.actors.get(uuid);
      memberActor?.sheet?.render(true);
    });

    // Item roll / use
    html.find('.item-roll').click((ev) => {
      const li = ev.currentTarget.closest('.item');
      const item = this.actor.items.get(li.dataset.itemId);
      item?.roll();
    });

    // Item delete
    html.find('.item-delete').click(async (ev) => {
      const li = ev.currentTarget.closest('.item');
      const item = this.actor.items.get(li.dataset.itemId);
      await item?.delete();
    });
  }

  // ── Drag & Drop — accept dropped actors (to add as members) and items ──
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);

    // Dropped actor → add as member
    if (data.type === 'Actor') {
      const droppedActor = await fromUuid(data.uuid);
      if (!droppedActor) return;
      // Only allow character-type actors
      if (!['character', 'npc', 'lordling', 'familiar', 'pet'].includes(droppedActor.type)) {
        return ui.notifications.warn("Only character actors can be added as party members.");
      }
      const current = foundry.utils.duplicate(this.actor.system.members ?? []);
      if (current.includes(data.uuid)) {
        return ui.notifications.info(`${droppedActor.name} is already in the party.`);
      }
      current.push(data.uuid);
      await this.actor.update({ 'system.members': current });
      return;
    }

    // Dropped item → use default handler
    return super._onDrop(event);
  }
}
