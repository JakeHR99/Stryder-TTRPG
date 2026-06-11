// ============================================================
// STRYDER — Party Actor Sheet
// ============================================================
import { STRYDER } from '../helpers/config.mjs';
import { FishingMinigame } from '../apps/fishing-minigame.mjs';

export class StryderPartySheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['stryder', 'sheet', 'actor', 'party'],
      template: 'systems/stryder/templates/actor/actor-party-sheet.hbs',
      width: 920,
      height: 640,
      resizable: true,
      scrollY: ['.ps-content'],
      dragDrop: [{ dragSelector: '.ps-item', dropSelector: null }]
    });
  }

  get template() {
    return 'systems/stryder/templates/actor/actor-party-sheet.hbs';
  }

  async getData() {
    const context = await super.getData();
    const actor = this.actor;

    // Resolve member UUIDs → enriched display objects
    const memberIds = actor.system.members ?? [];
    const members = memberIds.map(uuid => {
      const a = fromUuidSync(uuid) ?? game.actors.get(uuid);
      if (!a) return null;

      const hv = a.system.health?.value  ?? 0;
      const hm = a.system.health?.max    ?? 0;
      const mv = a.system.mana?.value    ?? 0;
      const mm = a.system.mana?.max      ?? 0;
      const sv = a.system.stamina?.value ?? 0;
      const sm = a.system.stamina?.max   ?? 0;

      return {
        uuid,
        id:        a.id,
        name:      a.name,
        actorImg:  a.img,
        tokenImg:  a.prototypeToken?.texture?.src ?? a.img,
        className: a.system?.class?.name  ?? '',
        folkName:  a.system?.folk?.name   ?? '',
        level:     a.system?.attributes?.level?.value ?? 1,
        health:  { value: hv, max: hm, pct: hm > 0 ? Math.min(100, Math.round(hv / hm * 100)) : 0 },
        mana:    { value: mv, max: mm, pct: mm > 0 ? Math.min(100, Math.round(mv / mm * 100)) : 0 },
        stamina: { value: sv, max: sm, pct: sm > 0 ? Math.min(100, Math.round(sv / sm * 100)) : 0 },
      };
    }).filter(Boolean);

    // Split party actor items by role
    const campTasks = actor.items.filter(i => i.type === 'action' && i.system.isCampTask);
    const inventory = actor.items.filter(i => i.type !== 'action');

    // Always produce 8 slots (two carousel pages of 4) — empty ones get isEmpty:true
    const memberSlots = Array.from({ length: 8 }, (_, i) =>
      members[i] ?? { isEmpty: true, slotIndex: i }
    );

    context.members         = members;
    context.memberSlots     = memberSlots;
    context.hasOverflow     = members.length > 4;   // show arrow when 5+ members
    context.campTasks    = campTasks;
    context.inventory = inventory;
    context.system    = actor.system;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Drag-over highlight for item drops onto the inventory list
    const sheet = html[0] ?? html;
    sheet.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      html.find('.ps-item-list').addClass('ps-drop-active');
    }, false);
    sheet.addEventListener('dragleave', (ev) => {
      if (!sheet.contains(ev.relatedTarget)) {
        html.find('.ps-item-list').removeClass('ps-drop-active');
      }
    }, false);
    sheet.addEventListener('drop', () => {
      html.find('.ps-item-list').removeClass('ps-drop-active');
    }, false);

    // ── JRPG custom page navigation ───────────────────────────────────────
    // Use class toggling (not jQuery show/hide) so CSS flex layout works correctly
    const _showPSPage = (target) => {
      this._psPage = target;
      html.find('.ps-page').removeClass('ps-page-visible');
      html.find(`.ps-page[data-page="${target}"]`).addClass('ps-page-visible');
      html.find('.ps-nav-btn').removeClass('ps-nav-active');
      html.find(`.ps-nav-btn[data-target="${target}"]`).addClass('ps-nav-active');
    };

    _showPSPage(this._psPage || 'party');

    html.find('.ps-nav-btn').on('click', function() {
      _showPSPage($(this).data('target'));
    });

    // ── Party carousel ────────────────────────────────────────────────────
    const grid     = html.find('.ps-members-grid')[0];
    const leftBtn  = html.find('.ps-arrow-left');
    const rightBtn = html.find('.ps-arrow-right');

    if (grid) {
      // Restore page from last render, default 0
      if (this._carouselPage === undefined) this._carouselPage = 0;

      const totalMembers = this.actor.system.members?.length ?? 0;
      const totalPages   = totalMembers > 4 ? 2 : 1;

      const slideCarousel = () => {
        const wrapW = html.find('.ps-carousel-wrap').width() || 0;
        grid.style.transform = `translateX(-${this._carouselPage * wrapW}px)`;
        leftBtn.toggle(this._carouselPage > 0);
        rightBtn.toggle(this._carouselPage < totalPages - 1);
      };

      rightBtn.on('click', () => {
        if (this._carouselPage < totalPages - 1) { this._carouselPage++; slideCarousel(); }
      });
      leftBtn.on('click', () => {
        if (this._carouselPage > 0) { this._carouselPage--; slideCarousel(); }
      });

      slideCarousel();
    }

    // ── Member card click → open character sheet ───────────────────────────
    html.find('.ps-member-card').on('click', (ev) => {
      if (ev.target.closest('.ps-card-remove') || ev.target.classList.contains('ps-card-remove')) return;
      const uuid = ev.currentTarget.dataset.uuid;
      const memberActor = fromUuidSync(uuid) ?? game.actors.get(uuid);
      memberActor?.sheet?.render(true);
    });

    // ── Remove member — confirm before removing ───────────────────────────
    html.find('.ps-card-remove').on('click', async (ev) => {
      ev.stopPropagation();
      const uuid = ev.currentTarget.dataset.uuid;
      const memberActor = fromUuidSync(uuid) ?? game.actors.get(uuid);
      const name = memberActor?.name ?? 'this member';
      const partySheet = this;

      new Dialog({
        title: 'Abandon Party?',
        content: `<div style="padding:10px 6px;font-family:'Palatino Linotype',serif;">
          <p>Remove <strong>${name}</strong> from the party?</p>
        </div>`,
        buttons: {
          confirm: {
            icon: '<i class="fas fa-door-open"></i>',
            label: 'Abandon',
            callback: async () => {
              const current = foundry.utils.duplicate(partySheet.actor.system.members ?? []);
              await partySheet.actor.update({ 'system.members': current.filter(u => u !== uuid) });
            }
          },
          cancel: { label: 'Stay' }
        },
        default: 'cancel'
      }).render(true);
    });

    // ── Camp tasks / inventory item controls ───────────────────────────────
    html.find('.ps-item-roll').on('click', (ev) => {
      const li = ev.currentTarget.closest('.ps-item');
      this.actor.items.get(li.dataset.itemId)?.roll();
    });

    html.find('.ps-item-delete').on('click', async (ev) => {
      const li = ev.currentTarget.closest('.ps-item');
      await this.actor.items.get(li.dataset.itemId)?.delete();
    });

    // ── Challenges — launch mini-game ─────────────────────────────────────
    const self = this;
    html.find('.ch-play-btn[data-challenge]').on('click', async (ev) => {
      const challengeId = ev.currentTarget.dataset.challenge;
      const partyActor  = this.actor;

      const memberActors = (partyActor.system.members ?? [])
        .map(uuid => fromUuidSync(uuid) ?? game.actors.get(uuid))
        .filter(Boolean);

      if (!memberActors.length) {
        return ui.notifications.warn("Add party members before launching a challenge.");
      }

      if (memberActors.length === 1) {
        return self._launchChallenge(challengeId, memberActors[0], partyActor);
      }

      // ── JRPG-style member picker ────────────────────────────────────────────
      const challengeLabel = { fishing: 'Fishing', foraging: 'Foraging', mining: 'Mining' }[challengeId] ?? challengeId;
      const challengeIcon  = { fishing: '🎣', foraging: '🌿', mining: '⛏' }[challengeId] ?? '✦';

      const memberCards = memberActors.map((a, i) => {
        let statBadge = '';
        if (challengeId === 'fishing') {
          const lvl = parseInt(a.system?.life?.fishing?.value) || 0;
          statBadge = `<span style="font-family:'Rajdhani',sans-serif;font-size:10px;letter-spacing:.06em;color:rgba(130,200,160,0.75);background:rgba(30,80,50,0.5);border:1px solid rgba(60,160,90,0.3);border-radius:3px;padding:1px 5px;">Lv. ${lvl} Fishing</span>`;
        }
        return `
          <label class="ch-member-card" style="
            display:flex;align-items:center;gap:10px;
            padding:8px 10px;margin-bottom:5px;
            background:rgba(8,14,40,0.75);
            border:1px solid rgba(50,80,180,0.2);
            border-radius:5px;cursor:pointer;
            transition:background 0.15s, border-color 0.15s;
          " onmouseover="this.style.background='rgba(18,32,80,0.85)';this.style.borderColor='rgba(80,130,240,0.45)';"
             onmouseout="this.style.background='rgba(8,14,40,0.75)';this.style.borderColor='rgba(50,80,180,0.2)';">
            <input type="radio" name="ch-member" value="${a.id}" ${i === 0 ? 'checked' : ''} style="display:none;">
            <img src="${a.img}" width="38" height="38" style="border-radius:4px;object-fit:cover;object-position:top;border:1px solid rgba(80,120,200,0.35);flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <div style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:rgba(210,230,255,0.92);letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.name}</div>
              <div style="margin-top:3px;">${statBadge}</div>
            </div>
            <div class="ch-card-check" style="width:16px;height:16px;border-radius:50%;border:2px solid rgba(80,120,200,0.4);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#88c8a8;"></div>
          </label>`;
      }).join('');

      const content = `
        <style>
          input[type="radio"][name="ch-member"]:checked ~ * .ch-card-check { border-color:#4a9a6a !important; }
          .ch-member-card:has(input:checked) {
            background: rgba(18,50,32,0.7) !important;
            border-color: rgba(60,160,90,0.5) !important;
          }
          .ch-member-card:has(input:checked) .ch-card-check::after {
            content: '✦'; display:block;
          }
        </style>
        <div style="
          font-family:'Rajdhani',sans-serif;
          padding:4px 0 2px;
        ">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(50,80,180,0.2);">
            <span style="font-size:18px;">${challengeIcon}</span>
            <span style="font-family:'Cinzel',serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(150,185,235,0.65);">${challengeLabel}</span>
            <span style="margin-left:4px;font-size:11px;color:rgba(120,155,210,0.5);">— Choose your adventurer</span>
          </div>
          ${memberCards}
        </div>`;

      new Dialog({
        title: `${challengeLabel} — Choose Adventurer`,
        content,
        buttons: {
          play: {
            label: '▶ Begin',
            callback: (dlgHtml) => {
              const actorId = dlgHtml.find('input[name="ch-member"]:checked').val();
              const actor = game.actors.get(actorId);
              if (actor) self._launchChallenge(challengeId, actor, partyActor);
            }
          },
          cancel: { label: 'Cancel' }
        },
        default: 'play',
        render: (dlgHtml) => {
          // Clicking anywhere on a card checks its radio and highlights it
          dlgHtml.find('.ch-member-card').on('click', function() {
            const radio = $(this).find('input[type="radio"]');
            radio.prop('checked', true);
            dlgHtml.find('.ch-member-card').css({ background: 'rgba(8,14,40,0.75)', borderColor: 'rgba(50,80,180,0.2)' });
            dlgHtml.find('.ch-card-check').html('');
            $(this).css({ background: 'rgba(18,50,32,0.7)', borderColor: 'rgba(60,160,90,0.5)' });
            $(this).find('.ch-card-check').html('✦');
          });
          // Pre-select the first card
          dlgHtml.find('.ch-member-card').first().trigger('click');
        }
      }, { width: 360, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
    });
  }

  // ── Challenge dispatch ────────────────────────────────────────────────────
  _launchChallenge(id, actor, partyActor) {
    if (id === 'fishing') {
      FishingMinigame.open(actor, partyActor);
    } else {
      ui.notifications.info(`${id.charAt(0).toUpperCase() + id.slice(1)} is coming soon!`);
    }
  }

  // ── Drag & Drop — actors become members, items go to inventory ───────────
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);

    if (data.type === 'Actor') {
      const dropped = await fromUuid(data.uuid);
      if (!dropped) return;
      if (!['character', 'npc', 'lordling', 'familiar', 'pet'].includes(dropped.type)) {
        return ui.notifications.warn("Only character actors can be added as party members.");
      }
      const current = foundry.utils.duplicate(this.actor.system.members ?? []);
      if (current.includes(data.uuid)) {
        return ui.notifications.info(`${dropped.name} is already in the party.`);
      }
      current.push(data.uuid);
      await this.actor.update({ 'system.members': current });
      return;
    }

    if (data.type === 'Item') {
      return this._onDropItem(event, data);
    }

    return super._onDrop(event);
  }

  // ── Item drop — move item from source actor to party inventory ────────────
  async _onDropItem(event, data) {
    const item = await Item.fromDropData(data);
    if (!item) return;

    // Copy item to party actor
    const itemData = item.toObject();
    const [created] = await this.actor.createEmbeddedDocuments('Item', [itemData]);
    if (!created) return;

    // Delete from source actor if it came from another actor (not a compendium/world item)
    if (item.parent && item.parent.id !== this.actor.id) {
      await item.delete();
      ui.notifications.info(`${item.name} moved to party inventory.`);
    }

    // Switch to inventory page so the player sees the result
    const invPage = this.element?.find('.ps-page[data-page="inventory"]');
    if (invPage?.length) {
      this.element.find('.ps-page').removeClass('ps-page-visible');
      invPage.addClass('ps-page-visible');
      this.element.find('.ps-nav-btn').removeClass('ps-nav-active');
      this.element.find('.ps-nav-btn[data-target="inventory"]').addClass('ps-nav-active');
      this._psPage = 'inventory';
    }
  }

  // ── Drag-over highlight on the inventory page ─────────────────────────────
  _onDragOver(event) {
    super._onDragOver?.(event);
    // Highlight the inventory list as a drop target
    this.element?.find('.ps-item-list').addClass('ps-drop-active');
  }

  _onDragLeave(event) {
    this.element?.find('.ps-item-list').removeClass('ps-drop-active');
  }
}
