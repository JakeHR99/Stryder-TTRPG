// module/apps/fishing-minigame.mjs
// States: idle → rolling (fish phase) → rolling (casts phase) → fishing → complete

const FISH_SPRITES = ['fish_00', 'fish_01', 'fish_03', 'fish_06', 'fish_08'];
const LARGE_SPRITE = 'fish_07';
const SPRITE_PATH  = 'systems/stryder/assets/fishing/';

export class FishingMinigame extends Application {

  constructor(actor = null, partyActor = null, options = {}) {
    super(options);
    this.fishingActor  = actor;
    this.partyActor    = partyActor;
    this._rewardsCollected = false;
    this._resetState();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:        'fishing-minigame',
      title:     '🎣 Fishing',
      template:  'systems/stryder/templates/apps/fishing-minigame.hbs',
      width:     700,
      height:    620,
      resizable: false,
      classes:   ['stryder', 'fishing-scene-app'],
    });
  }

  // ── State ─────────────────────────────────────────────────────────────────

  _resetState() {
    this.gameState         = 'idle';
    this._rollPhase        = 'fish';   // 'fish' | 'casts'
    this._rouletteTarget   = 0;
    this.grid              = [];
    this.castsRemaining    = 0;
    this.totalCasts        = 0;
    this.totalFish         = 0;
    this.fishCaught        = [];
    this.catchLog          = [];
    this.message           = '';
    this.fishingLevel      = this._readFishingLevel();
    this._rewardsCollected = false;
    this._announcedStart   = false;
  }

  _readFishingLevel() {
    const actor = this.fishingActor;
    if (!actor) return 0;
    return parseInt(actor.system?.life?.fishing?.value) || 0;
  }

  _randomSprite() {
    return FISH_SPRITES[Math.floor(Math.random() * FISH_SPRITES.length)];
  }

  // ── Template data ─────────────────────────────────────────────────────────

  getData() {
    const spriteLookup = {};
    for (const f of this.fishCaught) spriteLookup[f.idx] = `${SPRITE_PATH}${f.sprite}.png`;

    const showGrid = this.gameState === 'fishing';

    const grid = showGrid ? this.grid.map((cell, i) => {
      let cssClass = '', showWater = false, hasPearl = false, fishImg = '';
      const canClick = this.gameState === 'fishing' && this.castsRemaining > 0 && !cell.revealed;
      if (cell.revealed) {
        if (cell.hasFish) {
          cssClass = 'revealed-fish' + (cell.hasPearl ? ' has-pearl' : '');
          fishImg  = spriteLookup[i] ?? '';
          hasPearl = cell.hasPearl;
        } else {
          cssClass = 'revealed-empty';
        }
      } else {
        cssClass  = canClick ? 'unrevealed active' : 'unrevealed locked';
        showWater = true;
      }
      return { index: i, cssClass, showWater, hasPearl, fishImg };
    }) : [];

    const fishCaught = this.fishCaught.map(f => ({
      imgPath:  `${SPRITE_PATH}${f.sprite}.png`,
      isLarge:  f.isLarge  ?? false,
      hasPearl: f.hasPearl ?? false,
    }));

    return {
      isIdle:      this.gameState === 'idle',
      isRolling:   this.gameState === 'rolling',
      isFishing:   this.gameState === 'fishing',
      isComplete:  this.gameState === 'complete',
      showGrid,
      rollPhase:   this._rollPhase,
      grid,
      fishCaught,
      actorName:        this.fishingActor?.name ?? null,
      fishingLevel:     this.fishingLevel,
      castsRemaining:   this.castsRemaining,
      totalCasts:       this.totalCasts,
      totalFishCount:   this.totalFish,
      fishCaughtCount:  this.fishCaught.length,
      catchLog:         this.catchLog.slice(-12),
      message:          this.message,
      hasCatch:         this.fishCaught.length > 0,
      rewardsCollected: this._rewardsCollected,
    };
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  activateListeners(html) {
    super.activateListeners(html);

    html.find('input[name="fishing-level"]').change(ev => {
      this.fishingLevel = parseInt(ev.target.value) || 0;
    });

    html.find('.f-roll-btn').click(async () => await this._rollCasts());

    html.find('.fsc-cell.active').click(async ev => {
      await this._castOnCell(parseInt(ev.currentTarget.dataset.cellIdx));
    });

    html.find('.f-reward-btn').click(async () => {
      if (this._rewardsCollected) return;
      await this._collectReward();
    });

    html.find('.f-again-btn').click(() => { this._resetState(); this.render(); });
    html.find('.f-done-btn').click(() => this.close());

    // Trigger pearl animations whenever the complete screen is rendered
    if (this.gameState === 'complete' && this.fishCaught.length > 0) {
      setTimeout(() => this._runPearlAnimations(), 350);
    }
  }

  // ── Game logic ────────────────────────────────────────────────────────────

  async _rollCasts() {
    // Announce the start of a fishing session once (before the first roll)
    if (!this._announcedStart) {
      this._announcedStart = true;
      this._announceStart();
    }

    // Roll fish count
    const fishRoll = new Roll('1d6');
    await fishRoll.evaluate();
    this.totalFish = fishRoll.total;

    // Roll casts
    const castRoll = new Roll('1d6');
    await castRoll.evaluate();
    this.totalCasts     = castRoll.total + this.fishingLevel;
    this.castsRemaining = this.totalCasts;

    // Place fish on grid
    this.grid = Array(16).fill(null).map(() => ({ hasFish: false, revealed: false, hasPearl: false, isLarge: false }));
    const positions = Array.from({ length: 16 }, (_, i) => i).sort(() => Math.random() - 0.5);
    positions.slice(0, this.totalFish).forEach(p => { this.grid[p].hasFish = true; });
    if (this.totalFish > 0 && Math.random() < 0.2) this.grid[positions[0]].isLarge = true;

    // Phase 1: fish count roulette
    this._rollPhase      = 'fish';
    this._rouletteTarget = this.totalFish;
    this.gameState       = 'rolling';
    this.render();
    setTimeout(() => this._runRoulette(() => {
      // Phase 2: casts roulette
      this._rollPhase      = 'casts';
      this._rouletteTarget = this.totalCasts;
      this.render();
      setTimeout(() => this._runRoulette(() => this._beginFishing()), 60);
    }), 60);
  }

  async _runRoulette(onComplete) {
    const el = document.querySelector('#fishing-minigame .fsc-roulette-num');
    if (!el) { onComplete?.(); return; }

    // Spin then decelerate
    for (let i = 0; i < 22; i++) {
      el.textContent = Math.floor(Math.random() * Math.max(6, this._rouletteTarget + 2)) + 1;
      await new Promise(r => setTimeout(r, i < 12 ? 45 : 45 + (i - 12) * 18));
    }

    // Land
    el.textContent = this._rouletteTarget;
    el.style.color = '#7dd4f0';
    el.style.textShadow = '0 0 40px rgba(80,200,255,0.9), 0 0 80px rgba(40,150,220,0.5)';
    el.style.transform  = 'scale(1.1)';

    await new Promise(r => setTimeout(r, 950));
    onComplete?.();
  }

  _beginFishing() {
    this.gameState = 'fishing';
    this.message   = `${this.totalCasts} cast${this.totalCasts !== 1 ? 's' : ''} — click to cast your line!`;
    this.render();
  }

  async _castOnCell(idx) {
    if (this.gameState !== 'fishing') return;
    if (this.grid[idx].revealed || this.castsRemaining <= 0) return;

    this.castsRemaining--;
    this.grid[idx].revealed = true;

    if (this.grid[idx].hasFish) {
      if (this.grid[idx].isLarge) {
        await this._handleLargeFish(idx);
      } else {
        const pearlRoll = new Roll('2d6');
        await pearlRoll.evaluate();
        const hasPearl = pearlRoll.total >= 11;
        const sprite   = this._randomSprite();
        this.grid[idx].hasPearl = hasPearl;
        this.fishCaught.push({ idx, hasPearl, isLarge: false, sprite, pearlRoll: pearlRoll.total });
        this.catchLog.push(hasPearl
          ? `✨ Fish caught — holds a Mana Pearl! (2d6: ${pearlRoll.total})`
          : `🐟 Fish caught! (2d6: ${pearlRoll.total})`);
        this.message = hasPearl
          ? 'A Mana Pearl glows inside this fish!'
          : `Fish caught! ${this.castsRemaining} cast${this.castsRemaining !== 1 ? 's' : ''} left.`;
      }
    } else {
      this.catchLog.push(`💧 Nothing here... (${this.castsRemaining} left)`);
      this.message = `Empty water. ${this.castsRemaining} cast${this.castsRemaining !== 1 ? 's' : ''} remaining.`;
    }

    const fishLeft = this.grid.filter(c => c.hasFish && !c.revealed).length;
    if (this.castsRemaining <= 0 || fishLeft === 0) this._finishGame();
    this.render();
  }

  async _handleLargeFish(idx) {
    const rollResult = await new Promise(resolve => {
      new Dialog({
        title: '🐠 Mighty Reeling!',
        content: `<div style="font-family:Georgia,serif;padding:14px;background:#061520;color:#b8d8e8;border-radius:4px;border:1px solid rgba(60,130,180,0.3);">
          <p style="font-size:14px;font-weight:bold;margin:0 0 8px;color:#c8e8f8;">A Large Fish fights back!</p>
          <p style="margin:0 0 12px;font-size:12px;color:#7ab4cc;">
            Roll <strong>Strength</strong>, <strong>Endurance</strong>, or <strong>Survival</strong>.
            Target: <strong>8 or higher</strong>.
          </p>
          <label style="display:block;font-size:12px;margin-bottom:6px;color:#6a94a8;">Your Roll Result:</label>
          <input type="number" id="mr-result" min="1" max="30" placeholder="e.g. 9"
            style="width:100%;padding:8px;background:#040e18;color:#c8e8f8;border:1px solid rgba(60,130,180,0.4);border-radius:3px;font-size:16px;box-sizing:border-box;"/>
        </div>`,
        buttons: {
          reel: { label: 'Reel It In!', callback: html => resolve(parseInt(html.find('#mr-result').val()) || 0) },
          flee: { label: 'Let it go',   callback: () => resolve(0) }
        },
        default: 'reel', close: () => resolve(0),
      }).render(true);
    });

    if (rollResult >= 8) {
      const pearlRoll = new Roll('2d6');
      await pearlRoll.evaluate();
      const hasPearl = pearlRoll.total >= 11;
      this.grid[idx].hasPearl = hasPearl;
      this.fishCaught.push({ idx, hasPearl, isLarge: true, sprite: LARGE_SPRITE, pearlRoll: pearlRoll.total });
      this.catchLog.push(`🏆 Large Fish caught!${hasPearl ? ' ✨ Mana Pearl inside!' : ''}`);
      this.message = `Mighty Reeling success!${hasPearl ? ' And it holds a Mana Pearl!' : ''}`;
    } else {
      this.grid[idx].hasFish = false; this.grid[idx].isLarge = false;
      const unrevealed = this.grid.map((c, i) => ({ c, i })).filter(({ c, i }) => !c.revealed && i !== idx);
      if (unrevealed.length) {
        const t = unrevealed[Math.floor(Math.random() * unrevealed.length)].i;
        this.grid[t].hasFish = true; this.grid[t].isLarge = true;
      }
      this.catchLog.push('💦 The large fish broke free and moved! Fatigue −1.');
      this.message = 'It escaped! The large fish lurks elsewhere.';
      if (this.fishingActor) {
        const curr = this.fishingActor.system?.attributes?.fatigue ?? 0;
        await this.fishingActor.update({ 'system.attributes.fatigue': Math.max(0, curr - 1) });
      }
    }
  }

  _finishGame() {
    this.gameState = 'complete';
    const pearls = this.fishCaught.filter(f => f.hasPearl).length;
    this.catchLog.push('—');
    this.catchLog.push(`Session ended: ${this.fishCaught.length}/${this.totalFish} fish caught.${pearls ? ` ${pearls} Pearl(s)!` : ''}`);
    this._announceResults();
  }

  // ── Chat announcements ────────────────────────────────────────────────────

  _chatActor() {
    return this.fishingActor ?? this.partyActor ?? null;
  }

  _chatSpeaker() {
    const actor = this._chatActor();
    return actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker();
  }

  /** Shared card shell — uses the system's standard .chat-message-card so it
   *  matches every other card AND is exempt from the plain-message bubble rule
   *  (that rule forces dark text on any message lacking .chat-message-card). */
  _fishCard(title, inner) {
    return `<div class="chat-message-card">`
      + `<div class="chat-message-header"><div class="chat-message-title">${title}</div></div>`
      + `<div class="chat-message-content">${inner}</div>`
      + `</div>`;
  }

  _announceStart() {
    const who = this._chatActor()?.name ?? 'Someone';
    const lvl = this.fishingLevel;
    const body = `<b>${who}</b> casts a line at the Fishing Spot`
      + (lvl ? ` <span style="color:var(--sty-text-2);">(Fishing Lv. ${lvl})</span>` : '')
      + `&hellip;`;
    ChatMessage.create({ content: this._fishCard('Fishing', body), speaker: this._chatSpeaker() });
  }

  _announceResults() {
    const who   = this._chatActor()?.name ?? 'Someone';
    const n     = this.fishCaught.filter(f => !f.isLarge).length;
    const l     = this.fishCaught.filter(f => f.isLarge).length;
    const p     = this.fishCaught.filter(f => f.hasPearl).length;
    const total = this.fishCaught.length;
    const castsUsed = Math.max(0, this.totalCasts - this.castsRemaining);

    let body;
    if (total === 0) {
      body = `<b>${who}</b> packed up empty-handed &mdash; nothing was biting.`;
    } else {
      const rows = [];
      if (n) rows.push(`<li>${n} Fish</li>`);
      if (l) rows.push(`<li>${l} Large Fish</li>`);
      if (p) rows.push(`<li style="color:var(--sty-cyan-bright);">${p} Mana Pearl${p > 1 ? 's' : ''}</li>`);
      body = `<b>${who}</b> finished fishing with <b>${total}</b> catch${total !== 1 ? 'es' : ''}.`
        + `<ul style="margin:7px 0 0;padding-left:18px;list-style:disc;">${rows.join('')}</ul>`
        + `<div style="margin-top:7px;font-size:11px;color:var(--sty-text-2);letter-spacing:0.3px;">${castsUsed} cast${castsUsed !== 1 ? 's' : ''} used &middot; ${this.totalFish} fish were in the spot</div>`;
    }
    ChatMessage.create({ content: this._fishCard('Fishing Results', body), speaker: this._chatSpeaker() });
  }

  // ── Pearl reveal animations on complete screen ────────────────────────────

  async _runPearlAnimations() {
    const items = document.querySelectorAll('#fishing-minigame .fsc-showcase-item');
    for (let i = 0; i < items.length; i++) {
      const item     = items[i];
      const fish     = this.fishCaught[i];
      if (!fish) continue;

      const numEl    = item.querySelector('.fsc-pearl-roll-num');
      const rollDiv  = item.querySelector('.fsc-pearl-roll');
      const gemEl    = item.querySelector('.fsc-pearl-gem');
      if (!numEl) continue;

      // Stagger start per fish
      await new Promise(r => setTimeout(r, i * 280));

      // Spin
      const target = fish.pearlRoll ?? (fish.hasPearl ? 11 : 5);
      for (let j = 0; j < 14; j++) {
        numEl.textContent = Math.floor(Math.random() * 11) + 2;
        await new Promise(r => setTimeout(r, 30 + j * 9));
      }

      // Land
      numEl.textContent = target;
      if (fish.hasPearl) {
        rollDiv?.classList.add('pearl-hit');
        numEl.textContent = `✨ ${target}`;
        await new Promise(r => setTimeout(r, 200));
        if (gemEl) gemEl.classList.add('gem-appear');
      }
    }
  }

  // ── Reward collection ─────────────────────────────────────────────────────

  async _collectReward() {
    if (this._rewardsCollected) return;

    const targetActor = this.partyActor ?? this.fishingActor;
    if (!targetActor) {
      ui.notifications.warn('No linked character — control a character token before opening Fishing.');
      return;
    }

    const itemsToCreate = [];
    for (const fish of this.fishCaught) {
      itemsToCreate.push({
        name: fish.isLarge ? 'Large Fish' : 'Fish',
        type: 'ingredient',
        img:  'systems/stryder/assets/food/fish.png',
        system: {
          description: fish.isLarge
            ? '<p>A powerful fish hauled ashore after a Mighty Reeling struggle. Prepare it as a Protein or a Base on its sheet.</p>'
            : '<p>A fish caught at a Fishing Spot. Prepare it as a Protein or a Base on its sheet.</p>',
          ingredient_type: 'fish',
          quality:         'good',
          quality_modifier: 0,
          is_enchanted: false,
          enchant_type: '',
          sell_price:   fish.isLarge ? 3 : 1,
        }
      });
      if (fish.hasPearl) {
        itemsToCreate.push({
          name: 'Mana Pearl',
          type: 'loot',
          img:  `${SPRITE_PATH}mana_pearl.png`,
          system: {
            description: '<p>A sphere of coalesced mana found inside a fish. Used in elixir brewing and enchanting.</p>',
            inventory_size: 1,
            sell_price: 10,
          }
        });
      }
    }

    if (!itemsToCreate.length) {
      ui.notifications.info('Nothing to collect.');
      return;
    }

    try {
      await targetActor.createEmbeddedDocuments('Item', itemsToCreate);
      this._rewardsCollected = true;

      const fishCount  = itemsToCreate.filter(i => i.type === 'ingredient').length;
      const pearlCount = itemsToCreate.filter(i => i.name === 'Mana Pearl').length;
      let msg = `${fishCount} fish`;
      if (pearlCount) msg += ` and ${pearlCount} Mana Pearl${pearlCount > 1 ? 's' : ''}`;
      ui.notifications.info(`${msg} added to ${targetActor.name}.`);
    } catch(err) {
      console.error('Stryder | Fishing _collectReward failed:', err);
      ui.notifications.error('Failed to add fish to inventory — see console for details.');
    }

    this.render();
  }

  // ── Static opener ─────────────────────────────────────────────────────────

  static open(actor = null, partyActor = null) {
    const existing = Object.values(ui.windows).find(w => w.id === 'fishing-minigame');
    if (existing) { existing.bringToTop(); return existing; }
    const app = new FishingMinigame(actor, partyActor);
    app.render(true);
    return app;
  }
}
