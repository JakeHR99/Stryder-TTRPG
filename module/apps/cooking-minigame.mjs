// module/apps/cooking-minigame.mjs
// "The Camp Pot" — Cooking challenge minigame.
// States: prep → cooking (dice animation) → naming (result + name-your-dish)
//
// Reads ingredients + monster components from the PARTY inventory (or the cook's
// inventory if launched solo), consumes them on cook, and produces a named
// `consumable` meal item. The selected member supplies the Cooking life-skill level.

const QMOD   = { rotten:-2, bad:-1, good:0, great:1, gourmet:2 };
const QLABEL = { rotten:'Rotten', bad:'Bad', good:'Good', great:'Great', gourmet:'Gourmet' };
const QORDER = ['rotten','bad','good','great','gourmet'];

// Monster component enchant effects — Rank scales the effect (rulebook table).
const ENCHANT = {
  bones:      { prefix:'Hardy',       label:'Bones',      desc:r=>`Use the Rush Party Action without gaining Fatigue — ${rankUses(r)} use${rankUses(r)>1?'s':''}.` },
  eyes:       { prefix:'Watchful',    label:'Eyes',       desc:r=>`Raise a Perception result by ${rankUses(r)}.` },
  mana_veins: { prefix:'Restoration', label:'Mana Veins', desc:r=>`When spending Mana, restore ${rankUses(r)} Mana.` },
  heart:      { prefix:'Power',       label:'Heart',      desc:r=>`Grants a non-replenishing Ward of ${wardDur(r)} Durability.` },
};
const MONSTER_TYPES = ['bones','eyes','mana_veins','heart'];
function rankUses(r){ return String(r)==='mythic' ? 5 : 1 + Math.max(0, 4 - Number(r)); } // R4=1, +1 per rank above 4
function wardDur(r){ return ({ '4':5, '3':10, '2':15, '1':20, mythic:40 })[String(r)] ?? 5; }
function rankSort(r){ return String(r)==='mythic' ? 5 : (5 - Number(r)); } // weakest→strongest ordering key

const wait = ms => new Promise(res => setTimeout(res, ms));

export class CookingMinigame extends Application {

  constructor(cookActor = null, partyActor = null, options = {}) {
    super(options);
    this.cookActor  = cookActor;
    this.partyActor = partyActor;
    this._resetState();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:        'cooking-minigame',
      title:     '🍲 Cooking',
      template:  'systems/stryder/templates/apps/cooking-minigame.hbs',
      width:     780,
      height:    720,
      resizable: false,
      classes:   ['stryder', 'cooking-scene-app'],
    });
  }

  // ── State ──────────────────────────────────────────────────────────────────
  _resetState() {
    this.gameState    = 'prep';                 // prep | cooking | naming
    this.servings     = 1;
    this.cookingLevel = this._readCookingLevel();
    this.sel          = { main: [], sauce: null, monster: null }; // itemIds
    this.result       = null;
    this._cookStarted = false;
    this._served      = false;
  }

  _readCookingLevel() {
    return parseInt(this.cookActor?.system?.life?.cooking?.value) || 0;
  }

  /** Whose inventory the ingredients come from and where the meal is created. */
  _pantryActor() { return this.partyActor ?? this.cookActor; }

  _need() { return 3 * this.servings; }
  _canCook() { return this.sel.main.length === this._need(); }

  _qmod(it) {
    const q = it?.system?.quality;
    if (q in QMOD) return QMOD[q];
    return Number(it?.system?.quality_modifier) || 0;
  }
  _qkey(it) { return (it?.system?.quality in QMOD) ? it.system.quality : 'good'; }

  // ── Template data ───────────────────────────────────────────────────────────
  getData() {
    const a = this._pantryActor();
    const items = a ? Array.from(a.items) : [];

    // --- selected slots (look up live docs) ---
    const need = this._need();
    const mainSlots = [];
    for (let i = 0; i < need; i++) {
      const id = this.sel.main[i];
      const it = id ? a?.items?.get(id) : null;
      if (it) {
        mainSlots.push({
          filled: true, idx: i, img: it.img,
          catLabel: this._catLabel(it.system?.ingredient_type),
          qLabel: QLABEL[this._qkey(it)], qMod: this._fmt(this._qmod(it)), qClass: 'ckq-' + this._qkey(it),
        });
      } else {
        mainSlots.push({ filled: false });
      }
    }

    const sauceIt   = this.sel.sauce   ? a?.items?.get(this.sel.sauce)   : null;
    const monsterIt = this.sel.monster ? a?.items?.get(this.sel.monster) : null;
    const sauceSel = sauceIt ? {
      img: sauceIt.img, qLabel: QLABEL[this._qkey(sauceIt)], qMod: this._fmt(this._qmod(sauceIt)), qClass:'ckq-'+this._qkey(sauceIt),
    } : null;
    const monsterSel = monsterIt ? {
      img: monsterIt.img, label: ENCHANT[monsterIt.system.component_type]?.label ?? 'Component',
      rank: monsterIt.system.rank, prefix: ENCHANT[monsterIt.system.component_type]?.prefix ?? '',
    } : null;

    // --- pantry stacks (unselected only) ---
    const selectedIds = new Set([...this.sel.main, this.sel.sauce, this.sel.monster].filter(Boolean));
    const full = this.sel.main.length >= need;

    const ings = items.filter(i => i.type === 'ingredient' && !selectedIds.has(i.id));
    const comps = items.filter(i => i.type === 'component'
      && MONSTER_TYPES.includes(i.system?.component_type) && !selectedIds.has(i.id));

    // Main-slot ingredients: base / protein / spice / fish (fish usable as either)
    const mainCats = ['base','protein','spice','fish'];
    const mainStacks = this._stack(
      ings.filter(i => mainCats.includes(i.system?.ingredient_type)),
      i => `${i.system.ingredient_type}|${this._qkey(i)}`,
      (i, list) => ({
        key: `main:${list[0].id}`, addId: list[0].id,
        catLabel: this._catLabel(i.system.ingredient_type),
        qLabel: QLABEL[this._qkey(i)], qMod: this._fmt(this._qmod(i)), qClass: 'ckq-'+this._qkey(i),
        img: i.img, count: list.length, disabled: full,
        sortk: mainCats.indexOf(i.system.ingredient_type) * 10 + QORDER.indexOf(this._qkey(i)),
      })
    ).sort((x,y)=>x.sortk-y.sortk);

    const sauceStacks = this._stack(
      ings.filter(i => i.system?.ingredient_type === 'sauce'),
      i => this._qkey(i),
      (i, list) => ({
        key:`sauce:${list[0].id}`, addId:list[0].id, qLabel:QLABEL[this._qkey(i)],
        qMod:this._fmt(this._qmod(i)), qClass:'ckq-'+this._qkey(i), img:i.img, count:list.length,
        disabled: !!this.sel.sauce, sortk: QORDER.indexOf(this._qkey(i)),
      })
    ).sort((x,y)=>x.sortk-y.sortk);

    const monsterStacks = this._stack(
      comps,
      i => `${i.system.component_type}|${i.system.rank}`,
      (i, list) => ({
        key:`mon:${list[0].id}`, addId:list[0].id,
        label: ENCHANT[i.system.component_type]?.label ?? 'Component',
        rank: i.system.rank, img:i.img, count:list.length, disabled: !!this.sel.monster,
        sortk: (Object.keys(ENCHANT).indexOf(i.system.component_type)) * 10 + rankSort(i.system.rank),
      })
    ).sort((x,y)=>x.sortk-y.sortk);

    // --- naming/result view ---
    let result = null;
    if (this.gameState === 'naming' && this.result) {
      const r = this.result;
      const poison = r.poison;
      result = {
        qualityLabel: r.quality.label, qualityCls: r.quality.cls, tier: r.quality.tier,
        delicious: r.quality.key === 'delicious',
        servings: this.servings, per: r.per, total: r.total, dice: r.dice,
        sauceMod: this._fmt(r.sauceMod), hasSauce: r.hasSauce, cookingLevel: this.cookingLevel,
        dishIcon: poison ? '🤢' : (r.quality.tier >= 2 ? '🍲' : '🍛'),
        dishImg: r.mealImg,
        poison, effect: r.effectText, prefix: r.prefix, served: this._served,
        perClass: 'ckq-' + (r.quality.key==='gross'?'rotten':r.quality.key==='delicious'?'gourmet':r.quality.key==='good'?'great':'good'),
      };
    }

    return {
      isPrep:    this.gameState === 'prep',
      isCooking: this.gameState === 'cooking',
      isNaming:  this.gameState === 'naming',
      cookName:  this.cookActor?.name ?? 'Someone',
      cookingLevel: this.cookingLevel,
      servings: this.servings, need, filled: this.sel.main.length, canCook: this._canCook(),
      mainSlots, sauceSel, monsterSel,
      mainStacks, sauceStacks, monsterStacks,
      hasMain: mainStacks.length > 0, hasSauce: sauceStacks.length > 0, hasMonster: monsterStacks.length > 0,
      result, cookbook: this._cookbook(),
    };
  }

  _stack(list, keyFn, mapFn) {
    const groups = {};
    for (const it of list) { const k = keyFn(it); (groups[k] ??= []).push(it); }
    return Object.values(groups).map(g => mapFn(g[0], g));
  }
  _catLabel(t) { return ({ base:'Base', protein:'Protein', spice:'Spice', sauce:'Sauce', fish:'Fish' })[t] ?? 'Item'; }
  _fmt(n) { return (n >= 0 ? '+' : '') + n; }
  _cookbook() { return this.cookActor?.getFlag?.('stryder', 'cookbook') ?? []; }

  // ── Listeners ────────────────────────────────────────────────────────────────
  activateListeners(html) {
    super.activateListeners(html);

    html.find('.ck-serv-step').on('click', ev => {
      const d = Number(ev.currentTarget.dataset.step);
      this.servings = Math.max(1, Math.min(8, this.servings + d));
      while (this.sel.main.length > this._need()) this.sel.main.pop();
      this.render();
    });

    html.find('.ck-add[data-add]').on('click', ev => {
      const id = ev.currentTarget.dataset.add;
      if (this.sel.main.length >= this._need()) return;
      if (!this.sel.main.includes(id)) this.sel.main.push(id);
      this.render();
    });
    html.find('.ck-add-sauce[data-add]').on('click', ev => {
      if (!this.sel.sauce) this.sel.sauce = ev.currentTarget.dataset.add;
      this.render();
    });
    html.find('.ck-add-mon[data-add]').on('click', ev => {
      if (!this.sel.monster) this.sel.monster = ev.currentTarget.dataset.add;
      this.render();
    });

    html.find('.ck-slot.filled[data-clear]').on('click', ev => {
      this.sel.main.splice(Number(ev.currentTarget.dataset.clear), 1); this.render();
    });
    html.find('.ck-clear-sauce').on('click', ev => { ev.stopPropagation(); this.sel.sauce = null; this.render(); });
    html.find('.ck-clear-mon').on('click',  ev => { ev.stopPropagation(); this.sel.monster = null; this.render(); });

    html.find('.ck-cook-btn').on('click', () => {
      if (!this._canCook()) return;
      this.gameState = 'cooking'; this._cookStarted = false; this.render();
    });
    html.find('.ck-empty-btn').on('click', () => { this.sel = { main:[], sauce:null, monster:null }; this.render(); });

    // naming view
    html.find('.ck-cb-chip').on('click', ev => {
      const input = this.element[0].querySelector('.ck-name-input');
      if (input) input.value = ev.currentTarget.dataset.name;
    });
    html.find('.ck-serve-btn').on('click', () => this._serve());
    html.find('.ck-again-btn').on('click', () => {
      this.sel = { main:[], sauce:null, monster:null }; this.result = null; this._served = false;
      this.gameState = 'prep'; this.render();
    });
    html.find('.ck-done-btn').on('click', () => this.close());

    if (this.gameState === 'cooking' && !this._cookStarted) {
      this._cookStarted = true;
      this._runCook();
    }
  }

  // ── Cook sequence ─────────────────────────────────────────────────────────────
  async _runCook() {
    const a = this._pantryActor();
    const rootEl = this.element[0];
    const dice   = rootEl?.querySelector('.ck-dice');
    const tally  = rootEl?.querySelector('.ck-tally');
    const brew   = rootEl?.querySelector('.ck-brew');
    if (brew) { brew.style.setProperty('--bh', '#4a6ea0'); brew.style.setProperty('--bl', '#233a63'); }

    let run = 0;
    const many = this.sel.main.length > 6;

    for (const id of this.sel.main) {
      const it = a?.items?.get(id);
      if (!it) continue;
      const mod = this._qmod(it);

      const die = document.createElement('div');
      die.className = 'ck-die rolling';
      die.innerHTML = `<img class="ck-die-ic" src="${it.img}"/><span class="face">?</span>`;
      dice?.appendChild(die);

      const spins = many ? 6 : 11;
      for (let i = 0; i < spins; i++) {
        die.querySelector('.face').textContent = 1 + Math.floor(Math.random() * 6);
        await wait((many ? 28 : 48) + i * 5);
      }
      const roll = new Roll('1d6');
      await roll.evaluate();
      const r = roll.total;
      die.classList.remove('rolling');
      die.querySelector('.face').textContent = r;
      const m = document.createElement('span');
      m.className = 'ck-mod ' + ('ckq-' + this._qkey(it));
      m.textContent = this._fmt(mod);
      die.appendChild(m);

      run += r + mod;
      if (tally) tally.innerHTML = `Simmering&hellip; running total <b>${run}</b>`;
      await wait(many ? 150 : 320);
    }

    // sauce flat bonus
    let sauceMod = 0;
    const hasSauce = !!this.sel.sauce;
    if (hasSauce) {
      const s = a?.items?.get(this.sel.sauce);
      sauceMod = this._qmod(s);
      run += sauceMod;
      const chip = document.createElement('div');
      chip.className = 'ck-die ck-sauce-die';
      chip.innerHTML = `<img class="ck-die-ic" src="${s.img}"/><span>${this._fmt(sauceMod)}</span>`;
      dice?.appendChild(chip);
      if (tally) tally.innerHTML = `Sauce stirred in&hellip; total <b>${run}</b>`;
      await wait(460);
    }

    run += this.cookingLevel;
    if (tally) tally.innerHTML = `Chef's skill adds <b>+${this.cookingLevel}</b>&hellip;`;
    await wait(520);

    const per = run / this.servings;
    const quality = this._quality(per);
    const monsterIt = this.sel.monster ? a?.items?.get(this.sel.monster) : null;
    const poison = !!monsterIt && quality.tier < 2;
    let effectText = '', prefix = '';
    if (monsterIt) {
      const e = ENCHANT[monsterIt.system.component_type];
      prefix = poison ? '' : (e.prefix + ' ');
      effectText = poison
        ? `☠ Enchantment failed — the meal didn't reach Good and is Poisonous.`
        : `${e.prefix} — ${e.desc(monsterIt.system.rank)}`;
    }

    this.result = {
      total: run, per: Math.round(per * 10) / 10, dice: run - sauceMod - this.cookingLevel,
      sauceMod, hasSauce, quality, poison, effectText, prefix,
      mealImg: this._mealIcon(),
    };

    const tint = { gross:['#7a8a5a','#3e4a2a'], edible:['#5a86b8','#2a4a70'],
                   good:['#79d18a','#2e6b3e'], delicious:['#f0d488','#b8892a'] }[quality.key];
    if (brew) { brew.style.setProperty('--bh', tint[0]); brew.style.setProperty('--bl', tint[1]); }

    await wait(500);
    this.gameState = 'naming';
    this.render();
  }

  /** Meal icon from the composition of the main ingredients:
   *  more Protein → soup_1, balanced Protein/Base → soup_2, more Base → soup_3,
   *  and if Spices dominate the pot → randomize among the three. (Fish counts as Protein.) */
  _mealIcon() {
    const a = this._pantryActor();
    let P = 0, B = 0, S = 0;
    for (const id of this.sel.main) {
      const t = a?.items?.get(id)?.system?.ingredient_type;
      if (t === 'protein' || t === 'fish') P++;
      else if (t === 'base') B++;
      else if (t === 'spice') S++;
    }
    const dir = 'systems/stryder/assets/food/soups/';
    if (S > P && S > B) return dir + `soup_${1 + Math.floor(Math.random() * 3)}.png`;
    if (P > B)  return dir + 'soup_1.png';
    if (P === B) return dir + 'soup_2.png';
    return dir + 'soup_3.png';
  }

  _quality(perServing) {
    if (perServing <= 7)  return { key:'gross',     label:'Gross',     cls:'ck-q-gross',     tier:0 };
    if (perServing <= 12) return { key:'edible',    label:'Edible',    cls:'ck-q-edible',    tier:1 };
    if (perServing <= 17) return { key:'good',      label:'Good',      cls:'ck-q-good',      tier:2 };
    return                       { key:'delicious', label:'Delicious', cls:'ck-q-delicious', tier:3 };
  }

  // ── Serve — consume ingredients, create the meal ──────────────────────────────
  async _serve() {
    if (this._served) return;
    const a = this._pantryActor();
    if (!a) { ui.notifications.warn('No inventory to cook from.'); return; }

    const nameInput = this.element[0]?.querySelector('.ck-name-input');
    let name = (nameInput?.value || '').trim();
    if (!name) name = (this.result?.prefix || '') + 'House Special';

    const consumeIds = [...this.sel.main];
    if (this.sel.sauce)   consumeIds.push(this.sel.sauce);
    if (this.sel.monster) consumeIds.push(this.sel.monster);

    const r = this.result;
    const rarity = ({ 0:'common', 1:'common', 2:'uncommon', 3:'rare' })[r.quality.tier] ?? 'common';
    const enchantLine = this.sel.monster
      ? (r.poison ? '<p><b>☠ Poisonous</b> — the enchantment failed (below Good Quality).</p>'
                  : `<p><b>${r.prefix.trim()}</b> (enchanted): ${r.effectText.replace(/^.*? — /, '')}</p>`)
      : '';
    const mealData = {
      name,
      type: 'consumable',
      img: this.result?.mealImg ?? 'systems/stryder/assets/food/base.png',
      system: {
        rarity,
        nature: this.sel.monster ? (r.poison ? 'poison' : 'enchanted') : 'natural',
        charges: { value: this.servings, max: this.servings },
        sell_price: Math.max(1, r.quality.tier * 2 + (this.sel.monster ? 3 : 0)),
        description:
          `<p><b>${r.quality.label}</b> meal &middot; ${this.servings} serving${this.servings!==1?'s':''} `
          + `(cooked by ${this.cookActor?.name ?? 'a chef'}).</p>${enchantLine}`
          + `<p style="opacity:.75;font-size:12px;">Score: ${r.dice} dice`
          + `${r.hasSauce ? ` + sauce ${this._fmt(r.sauceMod)}` : ''} + Cooking Lv. +${this.cookingLevel} = ${r.total}`
          + ` ÷ ${this.servings} = ${r.per} per serving.</p>`,
      },
    };

    try {
      if (consumeIds.length) await a.deleteEmbeddedDocuments('Item', consumeIds);
      await a.createEmbeddedDocuments('Item', [mealData]);

      // save the name to the cook's personal cookbook
      if (this.cookActor) {
        const book = new Set(this.cookActor.getFlag('stryder', 'cookbook') ?? []);
        book.add(name);
        await this.cookActor.setFlag('stryder', 'cookbook', Array.from(book));
      }

      this._served = true;
      this._announceResult(name);
      ui.notifications.info(`${this.servings} serving${this.servings!==1?'s':''} of "${name}" added to ${a.name}.`);
    } catch (err) {
      console.error('Stryder | Cooking _serve failed:', err);
      ui.notifications.error('Failed to cook the meal — see console for details.');
    }
    this.render();
  }

  // ── Chat card ─────────────────────────────────────────────────────────────────
  _announceResult(name) {
    const r = this.result;
    const who = this.cookActor?.name ?? 'Someone';
    const speaker = ChatMessage.getSpeaker({ actor: this.cookActor ?? this.partyActor ?? undefined });
    const effect = this.sel.monster
      ? (r.poison ? `<div style="color:var(--sty-crimson);margin-top:5px;">☠ Poisonous — enchantment failed.</div>`
                  : `<div style="color:var(--sty-cyan-bright);margin-top:5px;">${r.effectText}</div>`)
      : '';
    const body = `<b>${who}</b> cooked <b>${name}</b> &mdash; `
      + `<span style="letter-spacing:.04em;">${r.quality.label}</span>`
      + ` for ${this.servings} serving${this.servings!==1?'s':''}.`
      + `<div style="margin-top:5px;font-size:11px;color:var(--sty-text-2);">${r.per} per serving (total ${r.total})</div>`
      + effect;
    const card = `<div class="chat-message-card"><div class="chat-message-header">`
      + `<div class="chat-message-title">Cooking</div></div>`
      + `<div class="chat-message-content">${body}</div></div>`;
    ChatMessage.create({ content: card, speaker });
  }

  // ── Static opener ─────────────────────────────────────────────────────────────
  static open(cookActor = null, partyActor = null) {
    const existing = Object.values(ui.windows).find(w => w.id === 'cooking-minigame');
    if (existing) { existing.bringToTop(); return existing; }
    const app = new CookingMinigame(cookActor, partyActor);
    app.render(true);
    return app;
  }
}
