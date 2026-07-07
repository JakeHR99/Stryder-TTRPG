// module/apps/taming-socket.mjs
// GM-authoritative beast dice for the Taming minigame.
//
// When a (non-GM) player starts the Subduing phase and a GM client is
// connected, the beast's dice are rolled and held ONLY on the designated GM's
// client. The player's app sends requests over the system socket; the GM
// client adjudicates and replies. Players physically cannot peek.
//
// The GM's "screen" is a stream of whispered chat cards: the full dice layout
// at duel start, then an updated strip after every event.
//
// Message types (all on `system.stryder`, filtered by `type`):
//   tamingStart     {userId, requestId, nDice, tamerName}   → GM rolls + stores
//   tamingShoot     {userId, requestId, beastNum, mv}       → adjudicates a shot
//   tamingForesight {userId, requestId, beastNum}           → reveals one die
//   tamingResolve   {userId, requestId, mySum}              → final sums, ends session
//   tamingCancel    {userId}                                → drops the session
//   tamingResponse  {targetUserId, requestId, payload}      → GM → player reply

const CHANNEL = 'system.stryder';
const REQUEST_TYPES = ['tamingStart', 'tamingShoot', 'tamingForesight', 'tamingResolve', 'tamingCancel'];

const _pending  = new Map();   // requestId → {resolve, reject, timer}   (player side)
const _sessions = new Map();   // playerUserId → {tamerName, dice:[…]}   (GM side)

/** True when a GM other than the current user is connected — remote mode available. */
export function tamingRemoteAvailable() {
  const gm = game.users.activeGM;
  return !!gm && gm.id !== game.user.id;
}

/** Player → GM request. Resolves with the GM's reply payload. */
export function tamingRequest(type, payload = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const requestId = foundry.utils.randomID(16);
    const timer = setTimeout(() => {
      _pending.delete(requestId);
      reject(new Error('The GM client did not respond.'));
    }, timeoutMs);
    _pending.set(requestId, { resolve, timer });
    game.socket.emit(CHANNEL, { type, requestId, userId: game.user.id, ...payload });
  });
}

/** Fire-and-forget session cancel (reset / window closed mid-duel). */
export function tamingCancel() {
  game.socket.emit(CHANNEL, { type: 'tamingCancel', userId: game.user.id });
}

export function registerTamingSocket() {
  game.socket.on(CHANNEL, async (data) => {
    if (!data?.type) return;

    // ── GM side — only the designated GM adjudicates ──
    if (REQUEST_TYPES.includes(data.type)) {
      if (!game.user.isGM || game.user !== game.users.activeGM) return;
      try { await _handleRequest(data); }
      catch (err) {
        console.error('Stryder | Taming GM adjudication failed:', err);
        if (data.requestId) _reply(data, { error: err.message });
      }
      return;
    }

    // ── Player side — targeted response ──
    if (data.type === 'tamingResponse' && data.targetUserId === game.user.id) {
      const p = _pending.get(data.requestId);
      if (p) { clearTimeout(p.timer); _pending.delete(data.requestId); p.resolve(data.payload); }
    }
  });
  console.log('Stryder | Taming GM-authoritative socket registered ✓');
}

// Self-register once the game is ready.
Hooks.once('ready', registerTamingSocket);

/* ── GM side ─────────────────────────────────────────────────────────────── */

function _reply(data, payload) {
  game.socket.emit(CHANNEL, { type: 'tamingResponse', requestId: data.requestId, targetUserId: data.userId, payload });
}

function _diceStrip(dice) {
  return dice.map(d => d.removed
    ? `<span style="opacity:.45;">#${d.num}:✕</span>`
    : `<b>#${d.num}:${d.v}</b>${d.buffed ? '<span style="color:var(--sty-crimson);">↑</span>' : ''}${d.revealed ? '👁' : ''}`
  ).join(' · ');
}

function _gmWhisper(title, body) {
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients('GM').map(u => u.id),
    content: `<div class="chat-message-card"><div class="chat-message-header">`
      + `<div class="chat-message-title">${title}</div></div>`
      + `<div class="chat-message-content" style="font-size:12px;">${body}</div></div>`,
  });
}

async function _handleRequest(data) {
  const playerName = game.users.get(data.userId)?.name ?? 'A player';

  if (data.type === 'tamingStart') {
    const n = Math.max(1, Math.min(30, Number(data.nDice) || 6));
    const roll = new Roll(`${n}d6`);
    await roll.evaluate();
    const dice = roll.dice[0].results.map((r, i) => ({ num: i + 1, v: r.result, removed: false, targeted: false, buffed: false, revealed: false }));
    _sessions.set(data.userId, { tamerName: data.tamerName ?? playerName, dice });
    _reply(data, { ok: true });
    _gmWhisper('Taming — Beast Dice (GM only)', `<b>${data.tamerName ?? playerName}</b> begins Subduing. The beast's hidden pool:<br>${_diceStrip(dice)}`);
    return;
  }

  const session = _sessions.get(data.userId);

  if (data.type === 'tamingCancel') {
    if (session) { _sessions.delete(data.userId); _gmWhisper('Taming', `${session.tamerName}'s duel was cancelled.`); }
    return;
  }
  if (!session) { if (data.requestId) _reply(data, { error: 'No active taming session on the GM client.' }); return; }
  const dice = session.dice;

  if (data.type === 'tamingShoot') {
    const die = dice.find(d => d.num === Number(data.beastNum));
    if (!die || die.removed || die.targeted) return _reply(data, { error: 'That Beast die cannot be shot.' });
    const mv = Number(data.mv) || 0;
    die.targeted = true;
    let payload;
    if (mv < die.v) {
      die.v += 1; die.buffed = true;
      payload = { outcome: 'hold', v: die.revealed ? die.v : null };
    } else if (mv === die.v) {
      die.removed = true;
      payload = { outcome: 'tie', v: die.v };
    } else {
      const broken = die.v;
      die.removed = true;
      payload = { outcome: 'break', v: broken };
    }
    _reply(data, payload);
    _gmWhisper('Taming — Shot', `${session.tamerName} fires a <b>${mv}</b> at #${die.num} — <b>${payload.outcome}</b>.<br>${_diceStrip(dice)}`);
    return;
  }

  if (data.type === 'tamingForesight') {
    const die = dice.find(d => d.num === Number(data.beastNum));
    if (!die || die.removed) return _reply(data, { error: 'That Beast die cannot be revealed.' });
    die.revealed = true;
    _reply(data, { v: die.v });
    _gmWhisper('Taming — Foresight', `${session.tamerName} reveals #${die.num} (a <b>${die.v}</b>).<br>${_diceStrip(dice)}`);
    return;
  }

  if (data.type === 'tamingResolve') {
    const beastSum = dice.filter(d => !d.removed).reduce((a, d) => a + d.v, 0);
    const values = dice.map(d => ({ num: d.num, v: d.v, removed: d.removed }));
    _sessions.delete(data.userId);
    _reply(data, { beastSum, values });
    const mySum = Number(data.mySum) || 0;
    _gmWhisper('Taming — Resolution', `${session.tamerName}: <b>${mySum}</b> vs beast <b>${beastSum}</b> — `
      + (mySum > beastSum ? '<span style="color:#79d18a;">tamer wins</span>.' : '<span style="color:#e2586a;">the beast resists</span>.')
      + `<br>${_diceStrip(dice)}`);
    return;
  }
}
