// module/apps/scavenging-minigame.mjs
// "The Wilds' Bounty" — Scavenging challenge minigame.
// Two modes, both find-roll → quality-roll → loot:
//   Forage (Region): choose Base or Spice; Food Roll 2d6+Lv sets QUANTITY
//     (×1 / ×2 / ×3), Quality Roll 4d6−2+Lv sets ingredient quality.
//   Supplies (Area — Camping/Treasure Site or WM prompt): Supplies Roll
//     4d6+Lv picks the category, Quality Roll 4d6−4+Lv the tier.
// First time in an area: −2 on the find roll only (consumed after one roll).
// Items land in the PARTY inventory (or the scavenger's, solo); Essence and
// Grail go to the party currency pools (system.grail / system.essence).

import { BANDAGE, BOTTLE_OF_WATER, elixirData } from '../helpers/supply-items.mjs';

const wait = ms => new Promise(r => setTimeout(r, ms));

/* ── Rules data — all band bounds are on the FINAL total ─────────────────── */

const FORAGE_BANDS = [
  { name: '×1', qty: 1, lo: -99, hi: 5,  range: '0–5',  icon: '🌿', color: '#8aa6cc' },
  { name: '×2', qty: 2, lo: 6,   hi: 10, range: '6–10', icon: '🌿', color: '#79d18a' },
  { name: '×3', qty: 3, lo: 11,  hi: 99, range: '11+',  icon: '🌿', color: '#f0d488' },
];
const SUPPLY_BANDS = [
  { name: 'Bandages', key: 'bandages', lo: -99, hi: 12, range: '2–12',  icon: '🩹', color: '#8aa6cc' },
  { name: 'Treasure', key: 'treasure', lo: 13,  hi: 15, range: '13–15', icon: '💠', color: '#7dd4f0' },
  { name: 'Food',     key: 'food',     lo: 16,  hi: 20, range: '16–20', icon: '🍲', color: '#79d18a' },
  { name: 'Elixirs',  key: 'elixirs',  lo: 21,  hi: 22, range: '21–22', icon: '⚗️', color: '#a97dff' },
  { name: 'Cache',    key: 'cache',    lo: 23,  hi: 99, range: '23–24', icon: '📦', color: '#f0d488' },
];
const FORAGE_QUALITY = [
  { key: 'rotten',  name: 'Rotten',  lo: -99, hi: 4,  range: '2–4',   color: '#e2586a' },
  { key: 'bad',     name: 'Bad',     lo: 5,   hi: 10, range: '5–10',  color: '#8aa6cc' },
  { key: 'good',    name: 'Good',    lo: 11,  hi: 18, range: '11–18', color: '#79d18a' },
  { key: 'great',   name: 'Great',   lo: 19,  hi: 23, range: '19–23', color: '#7dd4f0' },
  { key: 'gourmet', name: 'Gourmet', lo: 24,  hi: 99, range: '24+',   color: '#f0d488' },
];
const SUPPLY_QUALITY = [
  { key: 'crap',   name: 'Crap',   lo: -99, hi: 1,  range: '≤1',    color: '#e2586a' },
  { key: 'meh',    name: 'Meh',    lo: 2,   hi: 12, range: '2–12',  color: '#8aa6cc' },
  { key: 'good',   name: 'Good',   lo: 13,  hi: 20, range: '13–20', color: '#79d18a' },
  { key: 'great',  name: 'Great',  lo: 21,  hi: 23, range: '21–23', color: '#7dd4f0' },
  { key: 'wicked', name: 'Wicked', lo: 24,  hi: 99, range: '24+',   color: '#f0d488' },
];

const QLABEL   = { rotten: 'Rotten', bad: 'Bad', good: 'Good', great: 'Great', gourmet: 'Gourmet' };
const QCOLOR   = { rotten: '#e2586a', bad: '#8aa6cc', good: '#79d18a', great: '#7dd4f0', gourmet: '#f0d488' };
const ING_TYPES = [
  { key: 'base',  label: 'Base',  icon: '🥔', img: 'systems/stryder/assets/food/base.png' },
  { key: 'spice', label: 'Spice', icon: '🌶', img: 'systems/stryder/assets/food/spice.png' },
];

// Supplies "Food" result — raw ingredients by quality tier (type random per ingredient)
const FOOD_TIER_LOOT = [
  [{ q: 'bad',  n: 2 }],                                            // Crap
  [{ q: 'good', n: 2 }],                                            // Meh
  [{ q: 'great', n: 1 }],                                           // Good
  [{ q: 'great', n: 3 }],                                           // Great
  [{ q: 'good', n: 2 }, { q: 'great', n: 1 }, { q: 'gourmet', n: 1 }], // Wicked
];
const BANDAGE_COUNT = [1, 2, 3, 4, 10];
const ESSENCE_AMT   = [1, 4, 10, 20, 30];
const ELIXIR_COUNT  = [0, 1, 2, 3, 4];    // Crap → Bottle of Water instead
// Cache bundles per tier — ingredients get a random type each
const CACHE_TIERS = [
  { bandages: 1, grail: 1,  ings: { q: 'bad',     n: 2 } },
  { bandages: 2, grail: 5,  ings: { q: 'good',    n: 2 } },
  { elixirs: 1,  essence: 10, ings: { q: 'good',    n: 4 } },
  { elixirs: 2,  essence: 15, ings: { q: 'great',   n: 4 }, bandages: 4 },
  { elixirs: 3,  essence: 30, ings: { q: 'gourmet', n: 4 } },
];

const bandFor = (arr, total) => arr.find(b => total >= b.lo && total <= b.hi);

/* ── Item-data resolution — always prefer the real compendium/world art ──── */

const _ingTemplateCache = {};

/** Base/Spice template cloned from the Ingredients compendium (art included).
 *  Falls back to a code-built item only if the pack entry is missing. */
async function ingredientTemplate(typeKey) {
  if (_ingTemplateCache[typeKey]) return _ingTemplateCache[typeKey];
  const t = ING_TYPES.find(x => x.key === typeKey);
  let data = null;
  try {
    const pack = game.packs.get('stryder.stryder-ingredients');
    if (pack) {
      const docs = await pack.getDocuments();
      const doc = docs.find(d => d.type === 'ingredient' && d.system?.ingredient_type === typeKey);
      if (doc) { data = doc.toObject(); delete data._id; delete data._stats; }
    }
  } catch (err) {
    console.warn(`Stryder | Scavenging: could not read ingredients pack for "${typeKey}"`, err);
  }
  if (!data) {
    data = {
      name: t.label, type: 'ingredient', img: t.img,
      system: { ingredient_type: t.key, quality: 'good', quality_modifier: 0, is_enchanted: false, enchant_type: '', sell_price: 1 },
    };
  }
  _ingTemplateCache[typeKey] = data;
  return data;
}

async function ingredientData(typeKey, quality) {
  const tpl = await ingredientTemplate(typeKey);
  const data = foundry.utils.duplicate(tpl);
  data.system.quality = quality;
  return data;
}

/** Named supply item — a world item of the same name (custom art/mechanics)
 *  wins over the built-in definition. */
function namedItemData(name, fallback) {
  const world = game.items?.getName?.(name);
  if (world) { const d = world.toObject(); delete d._id; delete d._stats; return d; }
  return foundry.utils.duplicate(fallback);
}

export class ScavengingMinigame extends Application {

  constructor(scavActor = null, partyActor = null, options = {}) {
    super(options);
    this.scavActor  = scavActor;
    this.partyActor = partyActor;
    this.state      = 'select';        // select | play
    this.mode       = null;            // forage | supplies
    this.forageType = 'base';          // base | spice
    this.firstTime  = true;            // −2 on the next find roll
    this.busy       = false;
    this.satchel    = [];              // {icon,text,color} chips found this session
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:        'scavenging-minigame',
      title:     '🌿 Scavenging',
      template:  'systems/stryder/templates/apps/scavenging-minigame.hbs',
      width:     860,
      height:    'auto',
      resizable: false,
      classes:   ['stryder', 'scavenging-scene-app'],
    });
  }

  get level() { return parseInt(this.scavActor?.system?.life?.scavenging?.value) || 0; }

  /** Items land here (party first, scavenger solo). */
  _stashActor()    { return this.partyActor ?? this.scavActor; }
  /** Grail/Essence land here (party currency pools per design ruling). */
  _currencyActor() { return this.partyActor ?? this.scavActor; }

  // ── Template data ─────────────────────────────────────────────────────────
  getData() {
    const forage = this.mode === 'forage';
    const m = forage
      ? { findDice: 2, findLabel: 'Food Roll — how many do you find?',     bands: FORAGE_BANDS, qualFlat: -2, quality: FORAGE_QUALITY, verb: 'Forage',   cap: 'Region — The Wilds' }
      : { findDice: 4, findLabel: 'Supplies Roll — what do you find?',     bands: SUPPLY_BANDS, qualFlat: -4, quality: SUPPLY_QUALITY, verb: 'Scavenge', cap: 'Area — Site of Interest' };
    return {
      isSelect: this.state === 'select',
      isForage: forage,
      scavName: this.scavActor?.name ?? 'Someone',
      level: this.level,
      firstTime: this.firstTime,
      forageTypeBase: this.forageType === 'base',
      mode: m,
      findMath: `${m.findDice}d6 + Lv ${this.firstTime ? '− 2' : ''}`,
      qualMath: `4d6 ${m.qualFlat} + Lv`,
      satchel: this.satchel,
      satchelCount: this.satchel.length,
      stashName: this._stashActor()?.name ?? 'the party',
    };
  }

  // ── Listeners ─────────────────────────────────────────────────────────────
  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0] ?? html;

    html.find('.sv-mode[data-mode]').on('click', ev => {
      this.mode = ev.currentTarget.dataset.mode;
      this.state = 'play';
      this.render();
    });
    html.find('.sv-first').on('change', ev => { this.firstTime = ev.currentTarget.checked; this._syncPenaltyUI(); });
    html.find('.sv-type-btn[data-type]').on('click', ev => {
      if (this.busy) return;
      this.forageType = ev.currentTarget.dataset.type;
      html.find('.sv-type-btn').removeClass('on');
      ev.currentTarget.classList.add('on');
    });
    html.find('.sv-back').on('click', () => {
      if (this.busy) return;
      this.state = 'select'; this.mode = null; this.render();
    });
    html.find('.sv-go').on('click', () => this._run());
  }

  _el(sel) { return this.element?.[0]?.querySelector(sel); }
  _els(sel) { return this.element?.[0]?.querySelectorAll(sel) ?? []; }

  _syncPenaltyUI() {
    const chip = this._el('.sv-penalty-chip');
    if (chip) chip.style.display = this.firstTime ? '' : 'none';
    const math = this._el('.sv-find-math');
    if (math && !this.busy) {
      const n = this.mode === 'forage' ? 2 : 4;
      math.innerHTML = `${n}d6 + Lv ${this.firstTime ? '− 2' : ''}`;
    }
  }

  // ── Dice + track DOM helpers (surgical — no re-render during play) ────────
  async _rollAnimated(nDice, trayEl, gold, extraChips) {
    const roll = new Roll(`${nDice}d6`);
    await roll.evaluate();
    const finals = roll.dice[0].results.map(r => r.result);

    const draw = vals => {
      if (!trayEl) return;
      trayEl.innerHTML = vals.map(v => `<div class="sv-die ${gold ? 'q' : ''} rolling">${v}</div>`).join('') + extraChips;
    };
    for (let t = 0; t < 9; t++) { draw(finals.map(() => 1 + Math.floor(Math.random() * 6))); await wait(60); }
    for (let i = 1; i <= finals.length; i++) {
      draw(finals.slice(0, i).concat(Array.from({ length: finals.length - i }, () => 1 + Math.floor(Math.random() * 6))));
      await wait(130);
    }
    if (trayEl) trayEl.innerHTML = finals.map(v => `<div class="sv-die ${gold ? 'q' : ''}">${v}</div>`).join('') + extraChips;
    return finals;
  }

  _highlight(trackEl, bands, hit) {
    if (!trackEl) return;
    [...trackEl.children].forEach((seg, i) => {
      seg.classList.toggle('hit', bands[i] === hit);
      seg.classList.toggle('dim', bands[i] !== hit);
    });
  }

  // ── Foliage particles ─────────────────────────────────────────────────────
  _setRustle(on) { this._el('.sv-scene')?.classList.toggle('rustling', on); }

  _spawnLeaf() {
    const scene = this._el('.sv-scene');
    if (!scene) return;
    const l = document.createElement('div');
    l.className = 'sv-leaf'; l.textContent = '🍃';
    const spots = this.mode === 'forage' ? [12, 50, 88] : [12, 88];
    l.style.left = (spots[Math.floor(Math.random() * spots.length)] + Math.random() * 10 - 5) + '%';
    l.style.bottom = (85 + Math.random() * 35) + 'px';
    l.style.setProperty('--dx', (Math.random() * 70 - 35) + 'px');
    l.style.setProperty('--t', (0.8 + Math.random() * 0.5) + 's');
    scene.appendChild(l); setTimeout(() => l.remove(), 1500);
  }

  _spawnLoot(chips) {
    const scene = this._el('.sv-scene');
    if (!scene) return;
    chips.forEach((c, i) => {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'sv-pop';
        const side = i % 2 ? 1 : -1;
        p.style.setProperty('--dx',   (side * (34 + Math.random() * 96)).toFixed(0) + 'px');
        p.style.setProperty('--peak', -(70 + Math.random() * 55).toFixed(0) + 'px');
        p.style.setProperty('--spin', (side * (14 + Math.random() * 18)).toFixed(0) + 'deg');
        p.style.setProperty('--t',    (0.75 + Math.random() * 0.3).toFixed(2) + 's');
        const n = (c.text.match(/×(\d+)/) || [])[1];
        const face = c.img ? `<img class="sv-pop-img" src="${c.img}" />` : c.icon;
        p.innerHTML = `<span class="px"><span class="py">${face}${n > 1 ? `<span class="cnt">×${n}</span>` : ''}</span></span>`;
        scene.appendChild(p); setTimeout(() => p.remove(), 3200);
      }, i * 160);
    });
  }

  // ── The scavenge sequence ─────────────────────────────────────────────────
  async _run() {
    if (this.busy) return;
    this.busy = true;
    const forage = this.mode === 'forage';
    const bands   = forage ? FORAGE_BANDS   : SUPPLY_BANDS;
    const quality = forage ? FORAGE_QUALITY : SUPPLY_QUALITY;
    const findDiceN = forage ? 2 : 4;
    const qualFlat  = forage ? -2 : -4;
    const usedFirst = this.firstTime;

    const goBtn = this._el('.sv-go');
    if (goBtn) { goBtn.disabled = true; goBtn.textContent = 'Rummaging…'; }
    const resPanel = this._el('.sv-result');
    if (resPanel) resPanel.innerHTML = `<span class="sv-res-idle">Rummaging…</span>`;
    this._els('.sv-track .seg').forEach(s => s.classList.remove('hit', 'dim'));

    this._setRustle(true);
    const leafTimer = setInterval(() => this._spawnLeaf(), 170);

    try {
      // ── 1 · find roll ──
      const findChips = `<span class="sv-chip lv">+${this.level} Lv</span>`
        + (usedFirst ? `<span class="sv-chip pen">−2 first time</span>` : '');
      await wait(200);
      const fv = await this._rollAnimated(findDiceN, this._el('.sv-find-tray'), false, findChips);
      const findTotal = fv.reduce((a, b) => a + b, 0) + this.level + (usedFirst ? -2 : 0);
      const findBand = bandFor(bands, findTotal);
      const fMath = this._el('.sv-find-math');
      if (fMath) fMath.innerHTML = `${findDiceN}d6 + Lv ${usedFirst ? '− 2' : ''} = <b>${findTotal}</b>`;
      this._highlight(this._el('.sv-find-track'), bands, findBand);

      // ── 2 · quality roll ──
      const qualChips = `<span class="sv-chip lv">+${this.level} Lv</span><span class="sv-chip flat">${qualFlat} flat</span>`;
      await wait(480);
      const qv = await this._rollAnimated(4, this._el('.sv-qual-tray'), true, qualChips);
      const qualTotal = qv.reduce((a, b) => a + b, 0) + this.level + qualFlat;
      const qualTier = bandFor(quality, qualTotal);
      const tierIdx = quality.indexOf(qualTier);
      const qMath = this._el('.sv-qual-math');
      if (qMath) qMath.innerHTML = `4d6 ${qualFlat} + Lv = <b>${qualTotal}</b>`;
      this._highlight(this._el('.sv-qual-track'), quality, qualTier);

      clearInterval(leafTimer);
      this._setRustle(false);

      // ── 3 · build + award loot ──
      const { chips, headline } = await this._awardLoot(forage, findBand, qualTier, tierIdx);

      // first-time penalty consumed
      if (this.firstTime) {
        this.firstTime = false;
        const box = this._el('.sv-first'); if (box) box.checked = false;
        this._syncPenaltyUI();
      }

      // ── 4 · show result ──
      if (resPanel) {
        resPanel.innerHTML = `
          <div class="sv-res-head" style="color:${qualTier.color}">${headline}</div>
          <div class="sv-res-items">${chips.map(c => this._chipHTML(c)).join('')}</div>
          <div class="sv-res-note">Stashed with ${this._stashActor()?.name ?? 'the party'}.</div>`;
      }
      this.satchel.push(...chips);
      const list = this._el('.sv-satchel-list');
      if (list) list.innerHTML = this.satchel.map(c => this._chipHTML(c)).join('');
      const cnt = this._el('.sv-satchel-count');
      if (cnt) cnt.textContent = `${this.satchel.length} find${this.satchel.length === 1 ? '' : 's'}`;

      this._spawnLoot(chips);
      this._announce(headline, chips);
    } catch (err) {
      console.error('Stryder | Scavenging run failed:', err);
      ui.notifications.error('Scavenging failed — see console for details.');
    } finally {
      clearInterval(leafTimer);
      this._setRustle(false);
      this.busy = false;
      if (goBtn) {
        goBtn.disabled = false;
        goBtn.textContent = (this.mode === 'forage' ? 'Forage Again' : 'Scavenge Again');
      }
    }
  }

  /** Loot chip — real item art when the chip has one, emoji otherwise. */
  _chipHTML(c) {
    const face = c.img ? `<img class="sv-loot-img" src="${c.img}" />` : `<span>${c.icon}</span>`;
    return `<div class="sv-loot" style="color:${c.color};border-color:${c.color}55;background:${c.color}12">${face}${c.text}</div>`;
  }

  // ── Loot builders — creates real items / adjusts currency, returns chips ──
  async _awardLoot(forage, findBand, qualTier, tierIdx) {
    const stash = this._stashActor();
    const chips = [];
    const items = [];
    let grail = 0, essence = 0;
    let headline;

    const addIngredients = async (spec, fixedType) => {
      const merged = new Map();
      for (const e of spec) {
        for (let i = 0; i < e.n; i++) {
          const t = fixedType ?? ING_TYPES[Math.floor(Math.random() * ING_TYPES.length)];
          const k = `${e.q}|${t.key}`;
          if (!merged.has(k)) merged.set(k, { q: e.q, t, n: 0 });
          merged.get(k).n++;
        }
      }
      for (const e of merged.values()) {
        const data = await ingredientData(e.t.key, e.q);
        for (let i = 0; i < e.n; i++) items.push(foundry.utils.duplicate(data));
        chips.push({ icon: e.t.icon, img: data.img, text: `${QLABEL[e.q]} ${e.t.label} ×${e.n}`, color: QCOLOR[e.q] });
      }
    };
    const addBandages = n => {
      const data = namedItemData('Bandage', BANDAGE);
      for (let i = 0; i < n; i++) items.push(foundry.utils.duplicate(data));
      chips.push({ icon: '🩹', img: data.img, text: `Bandage ×${n}`, color: qualTier.color });
    };
    const addElixirs = async n => {
      const names = await this._chooseElixirs(n);
      const counts = {};
      for (const name of names) counts[name] = (counts[name] ?? 0) + 1;
      for (const [name, count] of Object.entries(counts)) {
        const data = await elixirData(name);
        for (let i = 0; i < count; i++) items.push(foundry.utils.duplicate(data));
        chips.push({ icon: '⚗️', img: data.img, text: `${name} ×${count}`, color: qualTier.color });
      }
    };

    if (forage) {
      const t = ING_TYPES.find(x => x.key === this.forageType);
      const q = qualTier.key;                      // rotten..gourmet
      await addIngredients([{ q, n: findBand.qty }], t);
      headline = `${qualTier.name} ${t.label} ×${findBand.qty}!`;
    } else {
      headline = `${qualTier.name} ${findBand.name}!`;
      switch (findBand.key) {
        case 'bandages': addBandages(BANDAGE_COUNT[tierIdx]); break;
        case 'treasure':
          essence += ESSENCE_AMT[tierIdx];
          chips.push({ icon: '💠', text: `Essence ×${ESSENCE_AMT[tierIdx]}`, color: qualTier.color });
          break;
        case 'food': await addIngredients(FOOD_TIER_LOOT[tierIdx], null); break;
        case 'elixirs':
          if (tierIdx === 0) {
            const data = namedItemData('Bottle of Water', BOTTLE_OF_WATER);
            items.push(data);
            chips.push({ icon: '💧', img: data.img, text: 'Bottle of Water ×1', color: qualTier.color });
          } else await addElixirs(ELIXIR_COUNT[tierIdx]);
          break;
        case 'cache': {
          const c = CACHE_TIERS[tierIdx];
          if (c.bandages) addBandages(c.bandages);
          if (c.grail)    { grail += c.grail;     chips.push({ icon: '🪙', text: `Grail ×${c.grail}`,     color: qualTier.color }); }
          if (c.essence)  { essence += c.essence; chips.push({ icon: '💠', text: `Essence ×${c.essence}`, color: qualTier.color }); }
          if (c.elixirs)  await addElixirs(c.elixirs);
          if (c.ings)     await addIngredients([c.ings], null);
          break;
        }
      }
    }

    // ── Apply ──
    if (stash && items.length) await stash.createEmbeddedDocuments('Item', items);
    if (grail || essence) {
      const cur = this._currencyActor();
      if (cur) {
        await cur.update({
          'system.grail':   (Number(cur.system.grail)   || 0) + grail,
          'system.essence': (Number(cur.system.essence) || 0) + essence,
        });
      }
    }
    return { chips, headline };
  }

  /** "Vitality or Recovery Elixir ×N" — let the finder choose the mix. */
  async _chooseElixirs(n) {
    if (n <= 0) return [];
    const V = 'Elixir of Vitality', R = 'Elixir of Recovery';
    const rows = Array.from({ length: n }, (_, i) => `
      <div style="display:flex;align-items:center;gap:10px;margin:5px 0;">
        <span style="font-family:'Rajdhani',sans-serif;color:#8aa6cc;font-size:12px;">Elixir ${i + 1}</span>
        <select name="elx-${i}" style="flex:1;">
          <option value="${V}">${V}</option>
          <option value="${R}">${R}</option>
        </select>
      </div>`).join('');
    return new Promise(resolve => {
      new Dialog({
        title: 'Choose Your Elixirs',
        content: `<div style="padding:6px 2px;font-family:'Rajdhani',sans-serif;">
          <p style="font-size:12px;color:#8aa6cc;">You found <b>${n}</b> elixir${n > 1 ? 's' : ''} — Vitality or Recovery, your pick.</p>
          ${rows}</div>`,
        buttons: {
          ok: {
            label: 'Take Them',
            callback: dlg => resolve(Array.from({ length: n }, (_, i) => dlg.find(`[name="elx-${i}"]`).val() || V)),
          },
        },
        default: 'ok',
        close: () => resolve(Array.from({ length: n }, () => V)),
      }, { classes: ['dialog', 'stryder-stat-popup'] }).render(true);
    });
  }

  // ── Chat card ─────────────────────────────────────────────────────────────
  _announce(headline, chips) {
    const who = this.scavActor?.name ?? 'Someone';
    const verb = this.mode === 'forage' ? 'foraged' : 'scavenged';
    const speaker = ChatMessage.getSpeaker({ actor: this.scavActor ?? this.partyActor ?? undefined });
    const list = chips.map(c => `<span style="color:${c.color};">${c.icon} ${c.text}</span>`).join(' · ');
    const card = `<div class="chat-message-card"><div class="chat-message-header">`
      + `<div class="chat-message-title">Scavenging</div></div>`
      + `<div class="chat-message-content"><b>${who}</b> ${verb} — <b>${headline}</b>`
      + `<div style="margin-top:5px;font-size:12px;">${list}</div>`
      + `<div style="margin-top:4px;font-size:11px;color:var(--sty-text-2);">Stashed with ${this._stashActor()?.name ?? 'the party'}.</div>`
      + `</div></div>`;
    ChatMessage.create({ content: card, speaker });
  }

  // ── Static opener ─────────────────────────────────────────────────────────
  static open(scavActor = null, partyActor = null) {
    const existing = Object.values(ui.windows).find(w => w.id === 'scavenging-minigame');
    if (existing) { existing.bringToTop(); return existing; }
    const app = new ScavengingMinigame(scavActor, partyActor);
    app.render(true);
    return app;
  }
}
