// module/apps/elixir-brewing-mgame.mjs
// "The Alchemist's Cauldron" — Elixir Brewing challenge minigame.
// States: select (recipe) → brew (push-your-luck dice) → result (name/serve)
//
// Reads the brewer's known elixir recipes (owned `elixir` items with a
// perfection_value), spends `system.essence` currency (blue marbles), rolls the
// Alchemy Dice pool (= elixirbrewing life-skill level) one die at a time toward
// the Success–Perfection band, and produces vials (copies of the recipe elixir).

const wait = ms => new Promise(res => setTimeout(res, ms));

// Every alchemist gets a base pool of Alchemy Dice on top of their Brewing Level
// (so brewing is playable even at Level 0). Per rulebook update 2026-07-02.
const BASE_DICE = 2;

export class BrewingMinigame extends Application {

  constructor(brewerActor = null, partyActor = null, options = {}) {
    super(options);
    this.brewerActor = brewerActor;
    this.partyActor  = partyActor;
    this._resetState();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:        'elixir-brewing-minigame',
      title:     '⚗ Elixir Brewing',
      template:  'systems/stryder/templates/apps/elixir-brewing-mgame.hbs',
      width:     820,
      height:    720,
      resizable: false,
      classes:   ['stryder', 'brewing-scene-app'],
    });
  }

  // ── State ──────────────────────────────────────────────────────────────────
  _resetState() {
    this.gameState    = 'select';        // select | brew | result
    this.brewingLevel = this._readBrewingLevel();
    this.recipeId     = null;
    this.pool         = 0;               // Alchemy Dice remaining
    this.dice         = [];             // rolled values on the table
    this.result       = null;
    this._busy        = false;
    this._brewStarted = false;
    this._recipeDocs  = new Map();   // id → elixir recipe doc (loaded from the pack)
  }

  _readBrewingLevel() { return parseInt(this.brewerActor?.system?.life?.elixirbrewing?.value) || 0; }

  /** Alchemy Dice pool = Brewing Level + base dice (playable at Level 0). */
  _dicePool() { return this.brewingLevel + BASE_DICE; }

  /** Essence balance, recipe ownership, and vial output all live on the brewer. */
  _actor() { return this.brewerActor ?? this.partyActor; }
  _essence() { return Number(this._actor()?.system?.essence) || 0; }

  /** Load all elixir recipes from the compendium (everyone "knows" them for now).
   *  Recipe knowledge/tracking is deferred — see memory `elixir-brewing`. */
  async _loadRecipes() {
    this._recipeDocs = new Map();
    const pack = game.packs.get('stryder.stryder-elixirs');
    if (!pack) return;
    const docs = await pack.getDocuments();
    for (const d of docs) {
      if (d.type === 'elixir' && Number(d.system?.perfection_value) > 0) this._recipeDocs.set(d.id, d);
    }
  }
  /** Known recipes = every elixir recipe in the pack with a Perfection Value. */
  _recipes() { return Array.from(this._recipeDocs.values()); }
  _recipe() { return this.recipeId ? this._recipeDocs.get(this.recipeId) : null; }

  _recipeCost(it) { return Number(it?.system?.essence_cost) || 0; }
  _recipeColor(it) {
    // deterministic hue from the name, tinted by elixir type
    const s = it?.name || '';
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    if (it?.system?.elixir_type === 'offensive') h = 5 + (h % 40);      // warm reds/oranges
    return `hsl(${h},72%,55%)`;
  }

  _sum() { return this.dice.reduce((a, d) => a + d, 0); }

  // ── Template data ───────────────────────────────────────────────────────────
  getData() {
    const a = this._actor();
    if (this.gameState === 'brew' || this.gameState === 'result') return this._brewData();

    // SELECT
    const essence = this._essence();
    const recipes = this._recipes().map(it => {
      const cost = this._recipeCost(it);
      return {
        id: it.id, name: it.name, img: it.img, color: this._recipeColor(it),
        success: Number(it.system.success_value) || 0,
        perfection: Number(it.system.perfection_value) || 0,
        cost, affordable: essence >= cost,
        offensive: it.system.elixir_type === 'offensive',
      };
    }).sort((x, y) => x.perfection - y.perfection || x.name.localeCompare(y.name));

    return {
      isSelect: true, isBrew: false, isResult: false,
      brewerName: this.brewerActor?.name ?? 'Someone',
      brewingLevel: this.brewingLevel, dicePool: this._dicePool(), essence,
      recipes, hasRecipes: recipes.length > 0,
    };
  }

  _brewData() {
    const it = this._recipe();
    const success = Number(it?.system?.success_value) || 0;
    const perfection = Number(it?.system?.perfection_value) || 1;
    const color = this._recipeColor(it);
    const s = this._sum();
    const fillPct = Math.min(115, (s / perfection) * 100);
    const perfState = s === perfection, overState = s > perfection;

    const gaugeMax = perfection * 1.15;
    const succLeft = (success / gaugeMax) * 100;
    const perfLeft = (perfection / gaugeMax) * 100;
    const gFill = Math.min(100, (s / gaugeMax) * 100);

    const pips = [];
    for (let i = 0; i < this._dicePool(); i++) pips.push({ spent: i >= this.pool });

    let statusColor = 'var(--bw-text-2)', statusMsg = 'Roll an Alchemy Die to begin.';
    if (overState) { statusColor = 'var(--bw-crimson)'; statusMsg = `Boiling over! Remove ${s - perfection} to save the brew.`; }
    else if (perfState) { statusColor = 'var(--bw-gold-b)'; statusMsg = 'PERFECT — bank it now for 2 vials!'; }
    else if (s >= success) { statusColor = 'var(--bw-green)'; statusMsg = `Success! Bank it, or push toward ${perfection} for a Perfect double.`; }
    else if (s > 0) { statusColor = 'var(--bw-text-2)'; statusMsg = `Keep going — need ${success - s} more to succeed.`; }

    const base = {
      recipeName: it?.name ?? 'Elixir', recipeImg: it?.img, color,
      success, perfection, sum: s, fillPct,
      perfState, overState,
      brewingLevel: this.brewingLevel,
    };

    if (this.gameState === 'result') {
      const r = this.result;
      return {
        isSelect: false, isBrew: false, isResult: true, ...base,
        res: {
          key: r.key, title: r.title, cls: r.cls, sub: r.sub, vials: r.vials,
          delicious: r.key === 'perfect', ruined: r.key === 'ruin',
          resFill: r.key === 'ruin' ? 0 : Math.min(100, (r.sum / perfection) * 100),
          served: this._served,
        },
        vialArr: Array.from({ length: r.vials }, () => 1),
      };
    }

    return {
      isSelect: false, isBrew: true, isResult: false, ...base,
      statusColor, statusMsg,
      pool: this.pool, pips,
      dice: this.dice.map((d, i) => ({ v: d, i })),
      hasDice: this.dice.length > 0,
      canRoll: this.pool > 0 && !this._busy,
      canFinish: this.dice.length > 0 && !this._busy,
      gaugeBandLeft: succLeft, gaugeBandWidth: perfLeft - succLeft, gaugeFill: gFill,
    };
  }

  // ── Listeners ────────────────────────────────────────────────────────────────
  activateListeners(html) {
    super.activateListeners(html);

    html.find('.bw-recipe[data-recipe]').on('click', ev => this._begin(ev.currentTarget.dataset.recipe));
    html.find('.bw-roll-btn').on('click', () => this._rollDie());
    html.find('.bw-die[data-remove]').on('click', ev => { ev.stopPropagation(); this._removeDie(Number(ev.currentTarget.dataset.remove)); });
    html.find('.bw-finish-btn').on('click', () => this._finish());
    html.find('.bw-serve-btn').on('click', () => this._serve());
    html.find('.bw-again-btn').on('click', () => { this.gameState = 'select'; this.recipeId = null; this.dice = []; this.result = null; this._served = false; this.render(); });
    html.find('.bw-done-btn').on('click', () => this.close());

    if (this.gameState === 'brew' && !this._brewStarted) {
      this._brewStarted = true;
      const brew = this.element?.[0]?.querySelector('.bw-brew');
      if (brew) { const b = brew.querySelector('.bw-brew-liquid'); if (b) { b.style.setProperty('--bh', this._recipeColor(this._recipe())); } }
    }
  }

  // ── Flow ──────────────────────────────────────────────────────────────────────
  async _begin(id) {
    const a = this._actor();
    const it = this._recipeDocs.get(id);
    if (!it) return;
    const cost = this._recipeCost(it);
    if (this._essence() < cost) { ui.notifications.warn(`Not enough Essence — need ${cost}.`); return; }
    if (cost > 0) await a.update({ 'system.essence': this._essence() - cost });

    this.recipeId = id;
    this.pool = this._dicePool();
    this.dice = [];
    this.result = null;
    this._served = false;
    this.gameState = 'brew';
    this.render();
  }

  async _rollDie() {
    if (this.pool <= 0 || this._busy) return;
    this._busy = true; this.pool--;
    const tray = this.element?.[0]?.querySelector('.bw-tray');
    if (this.dice.length === 0 && tray) tray.innerHTML = '';
    const die = document.createElement('div');
    die.className = 'bw-die rolling';
    die.textContent = '?';
    tray?.appendChild(die);
    for (let i = 0; i < 11; i++) { die.textContent = 1 + Math.floor(Math.random() * 6); await wait(50 + i * 6); }
    const roll = new Roll('1d6');
    await roll.evaluate();
    die.textContent = roll.total;
    die.classList.remove('rolling');
    this.dice.push(roll.total);
    this._busy = false;
    this.render();
  }

  _removeDie(i) {
    if (this._busy || this.pool <= 0) return;    // spending a die to remove a die
    this.pool--; this.dice.splice(i, 1);
    this.render();
  }

  _finish() {
    const it = this._recipe();
    const success = Number(it?.system?.success_value) || 0;
    const perfection = Number(it?.system?.perfection_value) || 0;
    const s = this._sum();
    let o;
    if (s > perfection)       o = { key: 'ruin',    title: 'Ruined',           cls: 'bw-r-ruin',    vials: 0, refund: 0 };
    else if (s === perfection) o = { key: 'perfect', title: 'Perfect Brew!',    cls: 'bw-r-perfect', vials: 2, refund: 0 };
    else if (s >= success)     o = { key: 'good',    title: 'Brew Successful',  cls: 'bw-r-good',    vials: 1, refund: 0 };
    else                       o = { key: 'fail',    title: 'Failed Brew',      cls: 'bw-r-fail',    vials: 0, refund: 2 };

    const name = it?.name ?? 'the elixir';
    o.sub = {
      perfect: `Your total hit exactly ${perfection}. Two vials of ${name} sealed away.`,
      good:    `Total ${s} landed in the band. One vial of ${name} brewed.`,
      fail:    `Total ${s} fell short of Success (${success}). The brew failed — 2 Essence salvaged.`,
      ruin:    `Total ${s} boiled past Perfection (${perfection}). The elixir is ruined; components wasted.`,
    }[o.key];
    o.sum = s;
    this.result = o;
    this.gameState = 'result';
    this.render();
  }

  async _serve() {
    if (this._served) return;
    const a = this._actor();
    const it = this._recipe();
    const r = this.result;
    if (!a || !it || !r) return;

    try {
      if (r.refund) await a.update({ 'system.essence': this._essence() + r.refund });
      if (r.vials > 0) {
        const vialData = it.toObject();
        delete vialData._id;
        const toCreate = Array.from({ length: r.vials }, () => foundry.utils.deepClone(vialData));
        await a.createEmbeddedDocuments('Item', toCreate);
      }
      this._served = true;
      this._announce();
      const msg = r.vials > 0
        ? `${r.vials} vial${r.vials !== 1 ? 's' : ''} of ${it.name} added to ${a.name}.`
        : (r.refund ? `Brew failed — ${r.refund} Essence salvaged.` : `Brew ruined — nothing salvaged.`);
      ui.notifications.info(msg);
    } catch (err) {
      console.error('Stryder | Brewing _serve failed:', err);
      ui.notifications.error('Failed to bottle the brew — see console for details.');
    }
    this.render();
  }

  _announce() {
    const it = this._recipe();
    const r = this.result;
    const who = this.brewerActor?.name ?? 'Someone';
    const speaker = ChatMessage.getSpeaker({ actor: this.brewerActor ?? this.partyActor ?? undefined });
    const line = {
      perfect: `<span style="color:var(--sty-gold-bright,#f0d488);">Perfect brew — 2 vials!</span>`,
      good:    `<span style="color:var(--sty-cyan-bright,#7dd4f0);">Success — 1 vial.</span>`,
      fail:    `<span style="color:var(--sty-text-2,#8aa6cc);">Failed — 2 Essence salvaged.</span>`,
      ruin:    `<span style="color:var(--sty-crimson,#e2586a);">Ruined — components wasted.</span>`,
    }[r.key];
    const body = `<b>${who}</b> brewed <b>${it?.name ?? 'an elixir'}</b> &mdash; total ${r.sum} `
      + `(Success ${it?.system?.success_value} / Perfection ${it?.system?.perfection_value}).<div style="margin-top:5px;">${line}</div>`;
    const card = `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">Elixir Brewing</div></div>`
      + `<div class="chat-message-content">${body}</div></div>`;
    ChatMessage.create({ content: card, speaker });
  }

  // ── Static opener ─────────────────────────────────────────────────────────────
  static open(brewerActor = null, partyActor = null) {
    const existing = Object.values(ui.windows).find(w => w.id === 'elixir-brewing-minigame');
    if (existing) { existing.bringToTop(); return existing; }
    const app = new BrewingMinigame(brewerActor, partyActor);
    app._loadRecipes().then(() => app.render(true));   // load pack recipes, then show
    return app;
  }
}
