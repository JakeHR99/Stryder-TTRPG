// module/apps/taming-minigame.mjs
// "The Gentle Hand" — Taming challenge minigame.
// Four phases: Encounter → Wrangle/Soothe → Subduing → Resolution.
//   Resource: AP = 2 + Taming Level (system.life.taming.value), spent in Subduing.
//   Encounter: optionally throw a Snack (a Base or Protein ingredient from the
//     party/tamer inventory — consumed). Accuracy 2d6 + Finesse: 8+ → Foresight
//     boon; 5–7 nothing; ≤4 → beast gains +1 die.
//   Approach: commit to Wrangle (Strong: Str+End / Quick: Nimb+Fin) or Soothe
//     (Timid: Charm+Intimacy / Aggressive: Aggression+Deceit, one talent may be
//     swapped for Diplomacy). Tamer pool = 2 + the two talents (d6s).
//   Beast pool: 10 − Rank (R4→6 … R1→9), Mythic 15. Rolled hidden, numbered.
//   Subduing (1 AP each): Shoot — your die vs a numbered beast die (lower →
//     lose yours AND theirs +1 uncapped; equal → both removed; higher → theirs
//     removed). A beast die can only be shot once. Restore — regain a lost die,
//     rerolled, only while below the starting pool. Foresight (free, once) —
//     choose two beast dice to reveal.
//   Resolution: out of AP or ended early → compare remaining-pool sums; tamer
//     strictly higher wins → tamed (if tamable) else pacified.
// Talents are read live from the tamer actor (system.attributes.talent.*).
// GM View (GMs only) shows the hidden beast dice — the WM's screen.
//
// GM-AUTHORITATIVE MODE: when a non-GM player starts Subduing and a GM client
// is connected, the beast dice are rolled and held ONLY on the GM's client
// (see taming-socket.mjs) — this client stores no values until they're
// revealed by play. Falls back to local dice when no GM is connected.

import { tamingRemoteAvailable, tamingRequest, tamingCancel } from './taming-socket.mjs';

const wait = ms => new Promise(r => setTimeout(r, ms));
const d6roll = async (n) => {
  const roll = new Roll(`${n}d6`);
  await roll.evaluate();
  return roll.dice[0].results.map(r => r.result);
};

const PAIRS = {
  strong:     { label: 'Strong',     talents: ['strength', 'endurance'] },
  quick:      { label: 'Quick',      talents: ['nimbleness', 'finesse'] },
  timid:      { label: 'Timid',      talents: ['charm', 'intimacy'] },
  aggressive: { label: 'Aggressive', talents: ['aggression', 'deceit'] },
};
const TLABEL = {
  strength: 'Strength', endurance: 'Endurance', nimbleness: 'Nimbleness', finesse: 'Finesse',
  charm: 'Charm', intimacy: 'Intimacy', aggression: 'Aggression', deceit: 'Deceit', diplomacy: 'Diplomacy',
};
const MUSH_SHEETS = [
  'systems/stryder/assets/taming/Mushroom_Reg.png',
  'systems/stryder/assets/taming/Mushroom_spike.png',
  'systems/stryder/assets/taming/Mushroom_Spotted.png',
];
const SNACK_TYPES = ['base', 'protein'];
const QORDER = ['rotten', 'bad', 'good', 'great', 'gourmet']; // consume worst first

export class TamingMinigame extends Application {

  constructor(tamerActor = null, partyActor = null, options = {}) {
    super(options);
    this.tamerActor = tamerActor;
    this.partyActor = partyActor;
    this.mushSheet  = MUSH_SHEETS[Math.floor(Math.random() * MUSH_SHEETS.length)];

    this.phase = 'encounter';       // encounter | approach | subdue | result
    this.rank = '3';
    this.tamable = true;
    this.gmView = false;
    this.ap = 0;
    this.foresight = false; this.foresightUsed = false; this.foresightPicks = 0;
    this.beastBonus = 0;
    this.approach = null; this.temper = null; this.diploSwap = null;
    this.myDice = []; this.startPool = 0;
    this.beast = [];                // {num, v, revealed, targeted, removed, buffed}  (v=null in remote mode until revealed)
    this.remote = false;            // beast dice held on the GM client
    this.selDie = -1;
    this.logs = [];
    this.result = null;
    this.busy = false;
    this.encounterDone = false; this.encounterOutcome = '';
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:        'taming-minigame',
      title:     '🐾 Taming',
      template:  'systems/stryder/templates/apps/taming-minigame.hbs',
      width:     900,
      height:    'auto',
      resizable: false,
      classes:   ['stryder', 'taming-scene-app'],
    });
  }

  get level() { return parseInt(this.tamerActor?.system?.life?.taming?.value) || 0; }
  get apMax() { return 2 + this.level; }
  talent(key) { return parseInt(this.tamerActor?.system?.attributes?.talent?.[key]?.value) || 0; }

  _pantry() { return this.partyActor ?? this.tamerActor; }
  _snackItems() {
    const a = this._pantry();
    if (!a) return [];
    return a.items
      .filter(i => i.type === 'ingredient' && SNACK_TYPES.includes(i.system?.ingredient_type))
      .sort((x, y) => QORDER.indexOf(x.system?.quality) - QORDER.indexOf(y.system?.quality));
  }

  beastPoolSize() { return (this.rank === 'mythic' ? 15 : 10 - Number(this.rank)) + this.beastBonus; }
  effTalents() {
    if (!this.temper) return [];
    return PAIRS[this.temper].talents.map(t => t === this.diploSwap ? 'diplomacy' : t);
  }
  log(msg) { this.logs.push(msg); }

  getData() {
    return { tamerName: this.tamerActor?.name ?? 'Someone', level: this.level };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const stage = (html[0] ?? html).querySelector('.tm-stage');
    if (!stage) return;
    stage.addEventListener('click', ev => {
      const el = ev.target.closest('[data-action]');
      if (el) this._onAction(el.dataset.action, el);
    });
    stage.addEventListener('change', ev => {
      const el = ev.target.closest('[data-change]');
      if (!el) return;
      if (el.dataset.change === 'rank')    { this.rank = el.value; this._draw(); }
      if (el.dataset.change === 'tamable') { this.tamable = el.checked; }
      if (el.dataset.change === 'gmview')  { this.gmView = el.checked; this._draw(); }
    });
    this._draw();
  }

  _el(sel) { return this.element?.[0]?.querySelector(sel); }

  async _onAction(action, el) {
    if (action === 'throw-snack') return this._throwSnack();
    if (action === 'to-approach') { this.phase = 'approach'; return this._draw(); }
    if (action === 'approach')    return this._pickApproach(el.dataset.arg);
    if (action === 'swap')        { if (!this.busy) { this.diploSwap = el.dataset.arg || null; this._draw(); } return; }
    if (action === 'begin')       return this._startSubdue();
    if (action === 'sel-die')     { if (!this.busy && this.phase === 'subdue') { const i = Number(el.dataset.arg); this.selDie = (this.selDie === i ? -1 : i); this._draw(); } return; }
    if (action === 'beast')       return this._beastClick(Number(el.dataset.arg));
    if (action === 'restore')     return this._restore();
    if (action === 'foresight')   { if (this.foresight && !this.foresightUsed && !this.foresightPicks && this.phase === 'subdue') { this.foresightPicks = 2; this.log('👁 Foresight — choose <b>two</b> Beast dice to reveal.'); this._draw(); } return; }
    if (action === 'end')         return this._resolve();
    if (action === 'reset')       return this._reset();
  }

  // ── Encounter ──────────────────────────────────────────────────────────────
  async _throwSnack() {
    if (this.busy || this.encounterDone) return;
    const snacks = this._snackItems();
    if (!snacks.length) return ui.notifications.warn('No Bases or Proteins in the inventory to throw as a Snack.');
    this.busy = true; this.encounterDone = true;

    const snack = snacks[0]; // worst quality first
    const snackName = `${snack.system?.quality ?? ''} ${snack.name}`.trim();
    try { await snack.delete(); } catch (e) { console.warn('Stryder | Taming: snack consume failed', e); }

    const scene = this._el('.tm-scene');
    if (scene) { const s = document.createElement('div'); s.className = 'tm-snack-fly'; s.textContent = '🍖'; scene.appendChild(s); setTimeout(() => s.remove(), 950); }

    const fin = this.talent('finesse');
    const [a, b] = await d6roll(2);
    const out = this._el('.tm-enc-outcome');
    for (let t = 0; t < 8; t++) {
      if (out) out.innerHTML = `<span class="tm-oc-meh">🫳 tossing… ${1 + Math.floor(Math.random() * 6)} + ${1 + Math.floor(Math.random() * 6)} + ${fin}</span>`;
      await wait(80);
    }
    const total = a + b + fin;
    if (total >= 8) {
      this.foresight = true;
      this.encounterOutcome = `<span class="tm-oc-good">2d6 (${a}+${b}) + Finesse ${fin} = ${total} — it sniffs the ${snack.name.toLowerCase()} curiously. 👁 Foresight gained!</span>`;
      this._mushReact('a-hop', 1000);
    } else if (total >= 5) {
      this.encounterOutcome = `<span class="tm-oc-meh">2d6 (${a}+${b}) + Finesse ${fin} = ${total} — the snack sails past. No harm done.</span>`;
    } else {
      this.beastBonus = 1;
      this.encounterOutcome = `<span class="tm-oc-bad">2d6 (${a}+${b}) + Finesse ${fin} = ${total} — you bean it on the nose. It's riled: +1 Beast die!</span>`;
      this._mushReact('a-attack');
    }
    this._announceSnack(snackName, a, b, fin, total);
    this.busy = false;
    this._draw();
  }

  // ── Approach ───────────────────────────────────────────────────────────────
  _pickApproach(a) {
    if (this.busy) return;
    this.approach = a;
    const opts = a === 'wrangle' ? ['strong', 'quick'] : ['timid', 'aggressive'];
    this.temper = opts[Math.floor(Math.random() * 2)];
    this.diploSwap = null;
    this._draw();
  }

  async _startSubdue() {
    if (this.busy) return;
    this.busy = true;
    this.ap = this.apMax;
    const tal = this.effTalents();
    this.startPool = 2 + tal.reduce((s, t) => s + this.talent(t), 0);
    this.myDice = await d6roll(this.startPool);

    // GM-authoritative mode: the GM client rolls and keeps the beast's dice.
    this.remote = tamingRemoteAvailable();
    if (this.remote) {
      try {
        await tamingRequest('tamingStart', { nDice: this.beastPoolSize(), tamerName: this.tamerActor?.name ?? game.user.name });
        this.beast = Array.from({ length: this.beastPoolSize() }, (_, i) =>
          ({ num: i + 1, v: null, revealed: false, targeted: false, removed: false, buffed: false }));
      } catch (err) {
        console.warn('Stryder | Taming: remote start failed, falling back to local dice.', err);
        ui.notifications.warn('The GM client did not respond — running the beast locally.');
        this.remote = false;
      }
    }
    if (!this.remote) {
      const bvals = await d6roll(this.beastPoolSize());
      this.beast = bvals.map((v, i) => ({ num: i + 1, v, revealed: false, targeted: false, removed: false, buffed: false }));
    }

    this.selDie = -1; this.logs = []; this.foresightUsed = false; this.foresightPicks = 0;
    this.log(`The duel begins — your <b>${this.startPool}</b> dice vs the beast's <b>${this.beast.length}</b>. AP: <b>${this.ap}</b>.`
      + (this.remote ? ' <span class="tm-crimson">The World Master holds the beast\'s dice.</span>' : ''));
    this.phase = 'subdue';
    this.busy = false;
    this._draw();
  }

  // ── Subduing ───────────────────────────────────────────────────────────────
  async _beastClick(bi) {
    const b = this.beast[bi];
    if (!b || b.removed) return;
    // Foresight picking mode
    if (this.foresightPicks > 0) {
      if (b.revealed || this.busy) return;
      if (this.remote) {
        this.busy = true;
        let res;
        try { res = await tamingRequest('tamingForesight', { beastNum: b.num }); }
        catch (err) { ui.notifications.error(err.message); this.busy = false; return; }
        this.busy = false;
        if (res.error) return ui.notifications.error(res.error);
        b.v = res.v;
      }
      b.revealed = true; this.foresightPicks--;
      this.log(`👁 Foresight — Beast die #${b.num} is a <b>${b.v}</b>.`);
      if (this.foresightPicks <= 0) this.foresightUsed = true;
      return this._draw();
    }
    // Shoot
    if (this.phase !== 'subdue' || this.busy || this.selDie < 0 || this.ap <= 0 || b.targeted) return;
    this.busy = true;
    const mv = this.myDice[this.selDie];

    // Determine the outcome — GM client adjudicates in remote mode.
    let outcome, shownVal;
    if (this.remote) {
      let res;
      try { res = await tamingRequest('tamingShoot', { beastNum: b.num, mv }); }
      catch (err) { ui.notifications.error(err.message); this.busy = false; return; }
      if (res.error) { ui.notifications.error(res.error); this.busy = false; return; }
      outcome = res.outcome;
      shownVal = res.v;                       // null while a buffed die stays hidden
      if (outcome !== 'hold' || res.v !== null) b.v = res.v;
    } else {
      if (mv < b.v)      { outcome = 'hold';  b.v += 1; shownVal = b.v; }
      else if (mv === b.v) { outcome = 'tie';   shownVal = b.v; }
      else               { outcome = 'break'; shownVal = b.v; }
    }

    this.ap--; b.targeted = true;
    this._el('.tm-beast')?.classList.add('hit');
    await wait(300);
    if (outcome === 'hold') {
      this.myDice.splice(this.selDie, 1);
      b.buffed = true;
      this.log(`🎯 Shot #${b.num} with a <b>${mv}</b> — <span class="tm-crimson">it holds!</span> Your die is lost and #${b.num} grows +1.`);
      this._mushReact('a-attack');
    } else if (outcome === 'tie') {
      this.myDice.splice(this.selDie, 1);
      b.removed = true;
      this.log(`🎯 Shot #${b.num} with a <b>${mv}</b> — dead even (${shownVal}). Both dice shatter.`);
      this._mushReact('a-squash');
    } else {
      b.removed = true;
      this.log(`🎯 Shot #${b.num} with a <b>${mv}</b> — <span class="tm-green">it breaks (${shownVal})!</span> You keep your die.`);
      this._mushReact('a-squash');
    }
    this.selDie = -1;
    this.busy = false;
    if (this.ap <= 0) { this.log('Out of Action Points — resolving…'); this._draw(); await wait(900); return this._resolve(); }
    this._draw();
  }

  async _restore() {
    if (this.phase !== 'subdue' || this.busy || this.ap <= 0 || this.myDice.length >= this.startPool) return;
    this.busy = true; this.ap--;
    const [v] = await d6roll(1);
    this.myDice.push(v);
    this.log(`♻ Restored a die — it rerolls to a <b>${v}</b>.`);
    this.busy = false;
    if (this.ap <= 0) { this._draw(); await wait(900); return this._resolve(); }
    this._draw();
  }

  // ── Resolution ─────────────────────────────────────────────────────────────
  async _resolve() {
    if (this.phase !== 'subdue' || this.busy) return;
    const mySum = this.myDice.reduce((a, b) => a + b, 0);
    let bSum;
    if (this.remote) {
      this.busy = true;
      let res;
      try { res = await tamingRequest('tamingResolve', { mySum }); }
      catch (err) { ui.notifications.error(err.message); this.busy = false; return; }
      this.busy = false;
      if (res.error) return ui.notifications.error(res.error);
      for (const { num, v, removed } of res.values) {
        const b = this.beast.find(x => x.num === num);
        if (b) { b.v = v; b.removed = removed; }
      }
      bSum = res.beastSum;
      this.remote = false;                     // session closed on the GM client
    } else {
      bSum = this.beast.filter(b => !b.removed).reduce((a, b) => a + b.v, 0);
    }
    const win = mySum > bSum;
    this.result = win
      ? { win: true,  title: this.tamable ? '✦ Tamed! ✦' : 'Pacified',
          sub: `Your ${mySum} beats its ${bSum}. ${this.tamable ? "The beast lowers its head — it's yours." : 'Untamable — but it disregards you and your party now.'}` }
      : { win: false, title: 'It Resists!',
          sub: `Its ${bSum} beats your ${mySum}. The beast shakes you off and stays wild.` };
    this.log(`🏁 Reveal — you: <b>${mySum}</b> · beast: <b>${bSum}</b>. ${win ? '<span class="tm-green">Victory!</span>' : '<span class="tm-crimson">Defeat.</span>'}`);
    this.phase = 'result';
    this._announceResult(mySum, bSum, win);
    this._draw();
  }

  _reset() {
    if (this.remote) { tamingCancel(); this.remote = false; }
    this.mushSheet = MUSH_SHEETS[Math.floor(Math.random() * MUSH_SHEETS.length)];
    this.phase = 'encounter'; this.ap = 0;
    this.foresight = false; this.foresightUsed = false; this.foresightPicks = 0; this.beastBonus = 0;
    this.approach = null; this.temper = null; this.diploSwap = null;
    this.myDice = []; this.beast = []; this.selDie = -1; this.logs = []; this.result = null;
    this.encounterDone = false; this.encounterOutcome = '';
    this._draw();
  }

  // ── Sprite ─────────────────────────────────────────────────────────────────
  _mood() {
    return this.phase === 'result'
      ? (this.result?.win ? (this.tamable ? 'a-hearts' : 'a-idle') : 'a-attack-loop')
      : (this.beastBonus > 0 && this.phase !== 'subdue' ? 'a-hop' : 'a-idle');
  }
  _mushReact(name, ms = 850) {
    const m = this._el('.tm-mush');
    if (!m) return;
    m.className = 'tm-mush ' + name;
    setTimeout(() => { const mm = this._el('.tm-mush'); if (mm) mm.className = 'tm-mush ' + this._mood(); }, ms);
  }

  // ── Chat cards ─────────────────────────────────────────────────────────────
  _speaker() { return ChatMessage.getSpeaker({ actor: this.tamerActor ?? undefined }); }
  _announceSnack(snackName, a, b, fin, total) {
    const who = this.tamerActor?.name ?? 'Someone';
    const outcome = total >= 8 ? '👁 Foresight gained' : total >= 5 ? 'no effect' : 'the beast is riled (+1 die)';
    ChatMessage.create({ speaker: this._speaker(), content:
      `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">Taming — Snack Throw</div></div>`
      + `<div class="chat-message-content"><b>${who}</b> throws a ${snackName} — Accuracy 2d6 (${a}+${b}) + Finesse ${fin} = <b>${total}</b>: ${outcome}.</div></div>` });
  }
  _announceResult(mySum, bSum, win) {
    const who = this.tamerActor?.name ?? 'Someone';
    const rankLabel = this.rank === 'mythic' ? 'Mythic' : `Rank ${this.rank}`;
    const line = win
      ? (this.tamable ? `<span class="tm-green"><b>Tamed!</b></span> The ${rankLabel} beast is soothed.` : `<b>Pacified</b> — the ${rankLabel} beast disregards the party.`)
      : `<span style="color:var(--sty-crimson)"><b>It resists</b></span> and stays wild.`;
    ChatMessage.create({ speaker: this._speaker(), content:
      `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">Taming</div></div>`
      + `<div class="chat-message-content"><b>${who}</b> vs a ${rankLabel} beast (${PAIRS[this.temper]?.label ?? '?'}) — `
      + `final pools <b>${mySum}</b> vs <b>${bSum}</b>. ${line}</div></div>` });
  }

  // ══ DRAW — full stage redraw from state (delegated events survive) ═════════
  _draw() {
    const stage = this._el('.tm-stage');
    if (!stage) return;
    const p = this.phase;
    const showGmToggle = game.user.isGM;
    const snackCount = this._snackItems().length;

    const topbar = `
      <div class="tm-topbar">
        <div class="tm-who">Tamer <b>${this.tamerActor?.name ?? 'Someone'}</b>
          <span class="tm-badge">Taming Lv. ${this.level}</span>
          <span class="tm-badge">AP ${this.apMax}</span>
          <span class="tm-badge" title="Bases and Proteins in ${this._pantry()?.name ?? 'inventory'} — they count as Snacks">🍖 ${snackCount}</span>
          ${this.remote ? `<span class="tm-badge" title="The World Master's client holds the beast's dice — they cannot be peeked">🎩 GM-run beast</span>` : ''}
        </div>
        <div class="tm-ctls">
          <span class="tm-ctl">Beast Rank
            <select data-change="rank" ${p !== 'encounter' ? 'disabled' : ''}>
              ${['4', '3', '2', '1', 'mythic'].map(r => `<option value="${r}" ${this.rank === r ? 'selected' : ''}>${r === 'mythic' ? 'Mythic' : 'Rank ' + r}</option>`).join('')}
            </select>
          </span>
          <label class="tm-tog"><input type="checkbox" data-change="tamable" ${this.tamable ? 'checked' : ''} ${p !== 'encounter' ? 'disabled' : ''}><span class="box"></span><span class="lab">Tamable</span></label>
          ${showGmToggle ? `<label class="tm-tog"><input type="checkbox" data-change="gmview" ${this.gmView ? 'checked' : ''}><span class="box"></span><span class="lab">GM View</span></label>` : ''}
        </div>
      </div>`;

    let panel = '';
    if (p === 'encounter') {
      panel = `
        <div class="tm-phase-box">
          <div class="tm-phase-title">1 · Encounter</div>
          <div class="tm-phase-desc">You spot the creature. Throw a <b>Snack</b> to soften it up? Requires a <b>Base or Protein</b> in the inventory (consumed — worst quality first). Accuracy 2d6 + Finesse (${this.talent('finesse')}): <b>8+</b> wins 👁 Foresight; 4 or lower riles it (+1 die).</div>
          <div class="tm-row">
            <button type="button" class="tm-btn amber" data-action="throw-snack" ${this.busy || this.encounterDone || snackCount <= 0 ? 'disabled' : ''}>🫳 Throw Snack${snackCount <= 0 ? ' — none in inventory' : ''}</button>
            <button type="button" class="tm-btn ghost" data-action="to-approach" ${this.busy ? 'disabled' : ''}>${this.encounterDone ? 'Continue ›' : 'Skip — approach quietly'}</button>
          </div>
          <div class="tm-outcome tm-enc-outcome">${this.encounterOutcome}</div>
        </div>`;
    }
    else if (p === 'approach') {
      if (!this.approach) {
        panel = `
          <div class="tm-phase-box">
            <div class="tm-phase-title">2 · Wrangle or Soothe?</div>
            <div class="tm-phase-desc">Commit before you know the beast's nature. <b>Wrangle</b> — physical dominance (Strong or Quick). <b>Soothe</b> — social grace (Timid or Aggressive; you may swap one Talent for Diplomacy).</div>
            <div class="tm-row">
              <button type="button" class="tm-btn amber" data-action="approach" data-arg="wrangle">💪 Wrangle</button>
              <button type="button" class="tm-btn cyan" data-action="approach" data-arg="soothe">🕊 Soothe</button>
            </div>
          </div>`;
      } else {
        const pair = PAIRS[this.temper];
        const eff = this.effTalents();
        const pool = 2 + eff.reduce((s, t) => s + this.talent(t), 0);
        const diploRow = this.approach === 'soothe' ? `
          <div class="tm-row" style="margin-top:8px;">
            <span class="tm-note" style="margin:0;">Swap for Diplomacy (${this.talent('diplomacy')}):</span>
            <button type="button" class="tm-btn ghost sm" data-action="swap" data-arg="" ${this.diploSwap === null ? 'disabled' : ''}>No swap</button>
            ${pair.talents.map(t => `<button type="button" class="tm-btn ghost sm" data-action="swap" data-arg="${t}" ${this.diploSwap === t ? 'disabled' : ''}>Replace ${TLABEL[t]}</button>`).join('')}
          </div>` : '';
        panel = `
          <div class="tm-phase-box">
            <div class="tm-phase-title">2 · The beast is ${pair.label}!</div>
            <div class="tm-phase-desc">Relevant Talents: <b>${eff.map(t => `${TLABEL[t]} ${this.talent(t)}`).join(' + ')}</b> — your pool will be <b>2 + ${eff.map(t => this.talent(t)).join(' + ')} = ${pool}</b> dice vs the beast's <b>${this.beastPoolSize()}</b>.</div>
            ${diploRow}
            <div class="tm-row" style="margin-top:10px;"><button type="button" class="tm-btn amber" data-action="begin" ${this.busy ? 'disabled' : ''}>⚔ Begin Subduing</button></div>
          </div>`;
      }
    }
    else {
      const canRestore = this.ap > 0 && this.myDice.length < this.startPool && p === 'subdue' && !this.busy;
      const canShoot = this.ap > 0 && this.selDie >= 0 && p === 'subdue' && !this.busy;
      const showV = b => this.gmView || b.revealed || p === 'result';
      panel = `
        <div class="tm-phase-box">
          <div class="tm-pool-label"><span>Beast Pool — sum ${this.gmView || p === 'result' ? `<b>${this.beast.filter(b => !b.removed).reduce((a, b) => a + b.v, 0)}</b>` : 'hidden'}</span><span>${this.beast.filter(b => !b.removed).length} dice</span></div>
          <div class="tm-dice-row">
            ${this.beast.map((b, i) => b.removed
              ? `<div class="tm-bdie removed"><span class="b-num">#${b.num}</span><span class="b-val">✕</span></div>`
              : `<div class="tm-bdie ${showV(b) ? '' : 'hidden-val'} ${b.revealed && !this.gmView ? 'revealed' : ''} ${b.targeted ? 'targeted' : ''} ${(canShoot && !b.targeted) || (this.foresightPicks > 0 && !b.revealed) ? 'shootable' : ''} ${b.buffed ? 'buffed' : ''}"
                   data-action="beast" data-arg="${i}" title="${this.foresightPicks > 0 ? 'Reveal with Foresight' : b.targeted ? 'Already shot at' : 'Shoot with your selected die'}">
                   <span class="b-num">#${b.num}</span><span class="b-val">${showV(b) ? b.v : '?'}</span></div>`).join('')}
          </div>
          <div class="tm-pool-label" style="margin-top:8px;"><span>Your Pool — sum <b>${this.myDice.reduce((a, b) => a + b, 0)}</b></span><span>${this.myDice.length}/${this.startPool} dice</span></div>
          <div class="tm-dice-row">
            ${this.myDice.map((v, i) => `<div class="tm-tdie ${this.selDie === i ? 'sel' : ''}" data-action="sel-die" data-arg="${i}">${v}</div>`).join('') || '<span class="tm-note" style="margin:0;">No dice left — Restore or end.</span>'}
          </div>
          ${p === 'subdue' ? `
          <div class="tm-row" style="margin-top:6px;">
            <button type="button" class="tm-btn amber" data-action="restore" ${canRestore ? '' : 'disabled'}>♻ Restore (1 AP)</button>
            ${this.foresight && !this.foresightUsed ? `<button type="button" class="tm-btn cyan" data-action="foresight" ${this.busy || this.foresightPicks > 0 ? 'disabled' : ''}>👁 Foresight — reveal 2</button>` : ''}
            <button type="button" class="tm-btn ghost" data-action="end" ${this.busy ? 'disabled' : ''}>🏁 End — reveal &amp; resolve</button>
          </div>
          <div class="tm-note">Select one of your dice, then click a numbered Beast die to <b>Shoot</b> (1 AP). Lower loses your die and buffs theirs +1 (uncapped) · equal removes both · higher removes theirs.</div>` : ''}
        </div>
        <div class="tm-log">${this.logs.map(l => `<div>${l}</div>`).join('')}</div>
        ${p === 'result' ? `
        <div class="tm-banner ${this.result.win ? 'win' : 'lose'}">
          <div class="b-title">${this.result.title}</div>
          <div class="b-sub">${this.result.sub}</div>
          <div class="tm-row" style="justify-content:center;margin-top:14px;"><button type="button" class="tm-btn amber" data-action="reset">Another Beast</button></div>
        </div>` : ''}`;
    }

    stage.innerHTML = `
      ${topbar}
      <div class="tm-duel">
        <div class="tm-scene">
          <div class="tm-scene-cap">${p === 'result' ? (this.result.win ? '✦ Subdued ✦' : 'It got away…') : 'A wild creature'}</div>
          ${this.temper ? `<div class="tm-temper-chip">${PAIRS[this.temper].label}${this.foresight && !this.foresightUsed ? ' · 👁 Foresight ready' : ''}</div>` : (this.foresight ? `<div class="tm-temper-chip">👁 Foresight ready</div>` : '')}
          <div class="tm-beast"><div class="tm-mush ${this._mood()}" style="background-image:url('${this.mushSheet}')"></div></div>
          <div class="tm-ground"></div>
          ${p === 'subdue' ? `<div class="tm-ap-wrap">${Array.from({ length: this.apMax }, (_, i) => `<div class="tm-ap-pip ${i < this.apMax - this.ap ? 'spent' : ''}" title="Action Points"></div>`).join('')}</div>` : ''}
        </div>
        <div>${panel}</div>
      </div>`;
  }

  /** Closing the window mid-duel drops the GM-side session. */
  async close(options) {
    if (this.remote && this.phase === 'subdue') { tamingCancel(); this.remote = false; }
    return super.close(options);
  }

  // ── Static opener ─────────────────────────────────────────────────────────
  static open(tamerActor = null, partyActor = null) {
    const existing = Object.values(ui.windows).find(w => w.id === 'taming-minigame');
    if (existing) { existing.bringToTop(); return existing; }
    const app = new TamingMinigame(tamerActor, partyActor);
    app.render(true);
    return app;
  }
}
