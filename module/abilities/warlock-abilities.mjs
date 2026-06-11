// ============================================================
// STRYDER — Warlock Class Handler
// ============================================================
// Resources:
//   • Bloodloss  — payment of Maximum Health. Tracked via the existing
//     flags.stryder.bloodlossHealthReduction flag (max-HP calc already
//     subtracts it). Restored at end of engagement; the Warlock then
//     heals for HALF the restored amount (FULL with Bloodied Eclipse).
//   • Manaburn   — flags.stryder.manaburn. +1 per 1 Mana expended
//     (updateActor hook in stryder.mjs). All Manaburn is lost at the
//     start of the following Phase (phaseChange combat event).
//   • Sacrifice  — flags.stryder.sacrificeHealthReduction. Max HP paid
//     to Sacrifice only returns at a Spring of Life.
//
// Ability list (class features):
//   Body of War (passive) | Scarlet Strike | Scarlet Warden
//   Sin Siphon | Blood Tithes | Sanguine Ichor | Crimson Crown
//   Hemorrhaging Lance | Sacrifice | Bloodied Eclipse | Masochistic Returns
// ============================================================

const SYSTEM_ID = 'stryder';

// ── Detection ─────────────────────────────────────────────────
export function isWarlock(actor) {
  if (!actor) return false;
  if ((actor.system?.class?.name ?? '') === 'Warlock') return true;
  return !!actor.items?.some?.(i => i.type === 'class' && i.name === 'Warlock');
}

// ── Bloodloss helpers ─────────────────────────────────────────
export function getBloodloss(actor) {
  return actor.getFlag(SYSTEM_ID, 'bloodlossHealthReduction') ?? 0;
}

/**
 * Pay Maximum Health as Bloodloss. Returns true on success.
 * NOTE: automatic max-HP derivation is disabled in this system (manual HP
 * editing), so this updates system.health.max directly. The flag tracks
 * how much to restore at the end of the engagement.
 */
export async function payBloodloss(actor, amount, label = 'Bloodloss') {
  if (amount <= 0) return true;
  const curMax = actor.system.health?.max ?? 0;
  if (curMax - amount <= 0) {
    ui.notifications.error(`${actor.name} cannot pay ${amount} ${label} — it would reduce their Maximum HP to ${curMax - amount}.`);
    return false;
  }
  const newMax = curMax - amount;
  const curHP = actor.system.health?.value ?? 0;
  await actor.update({
    'system.health.max': newMax,
    'system.health.value': Math.min(curHP, newMax),
    [`flags.${SYSTEM_ID}.bloodlossHealthReduction`]: getBloodloss(actor) + amount,
  });
  return true;
}

/** Restore lost Maximum Health (e.g. Sin Siphon). Returns amount restored. */
export async function restoreBloodloss(actor, amount) {
  const cur = getBloodloss(actor);
  if (cur <= 0 || amount <= 0) return 0;
  const restored = Math.min(cur, amount);
  const newVal = cur - restored;
  await actor.update({
    'system.health.max': (actor.system.health?.max ?? 0) + restored,
    [`flags.${SYSTEM_ID}.bloodlossHealthReduction`]: newVal > 0 ? newVal : null,
  });
  return restored;
}

// ── Manaburn helpers ──────────────────────────────────────────
export function getManaburn(actor) {
  return actor.getFlag(SYSTEM_ID, 'manaburn') ?? 0;
}

export async function setManaburn(actor, val) {
  await actor.setFlag(SYSTEM_ID, 'manaburn', Math.max(0, val));
}

export async function grantManaburn(actor, amount = 1) {
  if (amount <= 0) return;
  await setManaburn(actor, getManaburn(actor) + amount);
}

/** Called at the start of each new Phase — all Manaburn is lost. */
export async function clearManaburnForPhase(actor) {
  if (getManaburn(actor) > 0) {
    await actor.unsetFlag(SYSTEM_ID, 'manaburn');
    ui.notifications.info(`${actor.name}'s Manaburn burns away (new Phase).`);
  }
}

// ── Shared card builder ───────────────────────────────────────
function warlockCard(title, subtitle, body, resources = null) {
  const resLine = resources
    ? `<div class="chat-message-detail-row">
        <span class="chat-message-detail-label">Bloodloss:</span>
        <span class="sty-bloodloss-cost">${resources.bloodloss}</span>
        <span class="chat-sep-dot">·</span>
        <span class="chat-message-detail-label">Manaburn:</span>
        <span class="sty-manaburn">${resources.manaburn}</span>
       </div>`
    : '';
  return `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">${title}</div>
      <div class="chat-message-subtitle"><span class="aspect-label aspect-label-warlock">Warlock</span></div>
    </div>
    <div class="chat-message-details">
      ${subtitle ? `<div class="chat-message-detail-row"><span class="chat-message-detail-label">Action:</span><span>${subtitle}</span></div>` : ''}
      ${resLine}
    </div>
    <div class="chat-message-content chat-content-rajdhani">
      ${body}
    </div>
  </div>`;
}

function resSnapshot(actor) {
  return { bloodloss: getBloodloss(actor), manaburn: getManaburn(actor) };
}

function dmgApplyBtn(damage, type = 'physical') {
  return `<div class="damage-apply-container">
    <button class="damage-apply-button" data-damage="${damage}" data-damage-type="${type}" data-has-pierce="false">
      Apply <span class="damage-num">${damage}</span> Damage
    </button></div>`;
}

// ── Number-input dialog ───────────────────────────────────────
function bloodNumberDialog(title, label, min = 0, max = 20, start = null) {
  return new Promise(resolve => {
    new Dialog({
      title,
      content: `<div class="dlg-rajdhani-pad">
        <div class="dlg-flex-row">
          <label class="dlg-input-label">${label}</label>
          <input id="blood-amount" type="number" min="${min}" max="${max}" value="${start ?? min}"
            class="dlg-bloodloss-input" />
        </div>
      </div>`,
      buttons: {
        confirm: {
          label: 'Confirm',
          callback: (html) => {
            const v = Math.min(max, Math.max(min, parseInt(html.find('#blood-amount').val()) || min));
            resolve(v);
          }
        },
        cancel: { label: 'Cancel', callback: () => resolve(null) }
      },
      default: 'confirm',
    }, { width: 300, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });
}

// ── Main dispatcher ───────────────────────────────────────────
export const WARLOCK_ABILITY_NAMES = [
  'Body of War', 'Scarlet Strike', 'Scarlet Warden',
  'Sin Siphon', 'Blood Tithes', 'Sanguine Ichor', 'Crimson Crown',
  'Hemorrhaging Lance', 'Sacrifice', 'Bloodied Eclipse', 'Masochistic Returns',
];

export async function handleWarlockAbility(item, actor, speaker, rollMode) {
  if (!actor) return ui.notifications.warn('No actor found.');

  // Stamina cost
  const staCost = item.system.stamina_cost ?? 0;
  if (staCost > 0) {
    const sta = actor.system.stamina?.value ?? 0;
    if (sta < staCost) return ui.notifications.warn(`Not enough Stamina (need ${staCost}, have ${sta}).`);
    await actor.update({ 'system.stamina.value': sta - staCost });
  }

  // Mana cost (spending mana grants Manaburn via the updateActor hook)
  const manaCost = item.system.mana_cost ?? 0;
  if (manaCost > 0) {
    const mana = actor.system.mana?.value ?? 0;
    if (mana < manaCost) return ui.notifications.warn(`Not enough Mana (need ${manaCost}, have ${mana}).`);
    await actor.update({ 'system.mana.value': mana - manaCost });
  }

  // Limit check
  const lmax = item.system.limit?.max ?? 0;
  if (lmax > 0) {
    const lval = item.system.limit?.value ?? 0;
    if (lval >= lmax) return ui.notifications.warn(`${item.name} has reached its limit of ${lmax} uses!`);
    await item.update({ 'system.limit.value': lval + 1 });
  }

  switch (item.name) {
    case 'Scarlet Strike':      return handleScarletStrike(item, actor, speaker, rollMode);
    case 'Scarlet Warden':      return handleScarletWarden(item, actor, speaker, rollMode);
    case 'Sin Siphon':          return handleSinSiphon(item, actor, speaker, rollMode);
    case 'Blood Tithes':        return handleBloodTithes(item, actor, speaker, rollMode);
    case 'Sanguine Ichor':      return handleSanguineIchor(item, actor, speaker, rollMode);
    case 'Crimson Crown':       return handleCrimsonCrown(item, actor, speaker, rollMode);
    case 'Hemorrhaging Lance':  return handleHemorrhagingLance(item, actor, speaker, rollMode);
    case 'Sacrifice':           return handleSacrifice(item, actor, speaker, rollMode);
    case 'Masochistic Returns': return handleMasochisticReturns(item, actor, speaker, rollMode);
    case 'Body of War':
    case 'Bloodied Eclipse':
      return ChatMessage.create({ speaker, rollMode, content: warlockCard(item.name, 'Passive',
        item.system.description ?? '', resSnapshot(actor)) });
    default:
      return ChatMessage.create({ speaker, rollMode, content: warlockCard(item.name, 'Warlock', item.system.description ?? '') });
  }
}

// ── Scarlet Strike ────────────────────────────────────────────
// Trigger: when you make a Focused Attack. Cost: X Bloodloss.
// Attack's base damage increases by Bloodloss paid + current Manaburn.
async function handleScarletStrike(item, actor, speaker, rollMode) {
  const maxPay = Math.max(0, (actor.system.health?.max ?? 1) - 1);
  const x = await bloodNumberDialog('Scarlet Strike — Pay Bloodloss', 'Bloodloss to pay (X):', 0, maxPay, 1);
  if (x === null) return;

  if (!(await payBloodloss(actor, x, 'Bloodloss (Scarlet Strike)'))) return;

  const manaburn = getManaburn(actor);
  const bonus = x + manaburn;
  if (bonus <= 0) {
    return ui.notifications.warn('Scarlet Strike — no Bloodloss paid and no Manaburn stored. No bonus to apply.');
  }
  await actor.setFlag(SYSTEM_ID, 'scarletStrikeBonus',
    (actor.getFlag(SYSTEM_ID, 'scarletStrikeBonus') ?? 0) + bonus);

  await ChatMessage.create({ speaker, rollMode, content: warlockCard(
    'Scarlet Strike', 'Trigger — X Bloodloss',
    `Paid <strong class="sty-bloodloss-cost">${x} Bloodloss</strong> with <strong class="sty-manaburn">${manaburn} Manaburn</strong> stored.<br>
     Your next <strong>Focused Attack</strong> deals <strong>+${bonus} base damage</strong>.`,
    resSnapshot(actor)
  )});
}

// ── Scarlet Warden ────────────────────────────────────────────
// Trigger: you would take damage. 1 Stamina (paid by dispatcher).
// Reduce damage by [1.5 × Soul]; each optional Bloodloss adds 3.
async function handleScarletWarden(item, actor, speaker, rollMode) {
  const maxPay = Math.max(0, (actor.system.health?.max ?? 1) - 1);
  const n = await bloodNumberDialog('Scarlet Warden — Optional Bloodloss', 'Bloodloss (+3 reduction each):', 0, maxPay, 0);
  if (n === null) {
    // Refund the stamina the dispatcher already took
    await actor.update({ 'system.stamina.value': (actor.system.stamina?.value ?? 0) + (item.system.stamina_cost ?? 1) });
    return;
  }

  if (n > 0 && !(await payBloodloss(actor, n, 'Bloodloss (Scarlet Warden)'))) return;

  const soulVal = actor.system.abilities?.Soul?.value ?? 0;
  const base = Math.floor(1.5 * soulVal);
  const total = base + (3 * n);

  await ChatMessage.create({ speaker, rollMode, content: warlockCard(
    'Scarlet Warden', 'Trigger — 1 Stamina',
    `Reduce the damage ${actor.name} would take by <strong class="chat-green-bold">${total}</strong>.<br>
     <span class="chat-footnote">⌊1.5 × Soul ${soulVal}⌋ = ${base}${n > 0 ? ` &nbsp;+&nbsp; ${n} Bloodloss × 3 = ${3 * n}` : ''}</span>`,
    resSnapshot(actor)
  )});
}

// ── Sin Siphon ────────────────────────────────────────────────
// Trigger: you land an Excellent Attack. 1 Mana (paid by dispatcher → +1 Manaburn).
// Deal additional [6 + Manaburn] damage; regain 2 Health and 2 Maximum Health.
async function handleSinSiphon(item, actor, speaker, rollMode) {
  const manaburn = getManaburn(actor);
  const bonusDmg = 6 + manaburn;

  // Regain 2 Maximum Health if any has been lost to Bloodloss
  const restoredMax = await restoreBloodloss(actor, 2);

  // Regain 2 Health
  const curHP = actor.system.health?.value ?? 0;
  const maxHP = actor.system.health?.max ?? 0;
  const newHP = Math.min(maxHP, curHP + 2);
  await actor.update({ 'system.health.value': newHP });

  await ChatMessage.create({ speaker, rollMode, content: warlockCard(
    'Sin Siphon', 'Trigger — 1 Mana',
    `Your blood reacts violently to the flood of mana.<br>
     Deal <strong>+${bonusDmg}</strong> additional damage <span class="chat-footnote">(6 + Manaburn ${manaburn})</span> to the target of your Excellent Attack.<br>
     ${actor.name} regains <strong class="chat-green-bold">2 Health</strong> (${curHP} → ${newHP})${restoredMax > 0 ? ` and <strong class="chat-green-bold">${restoredMax} Maximum Health</strong>` : ''}.
     ${dmgApplyBtn(bonusDmg)}`,
    resSnapshot(actor)
  )});
}

// ── Blood Tithes ──────────────────────────────────────────────
// Passive: pay Mana costs with Maximum Health at 1:1.
async function handleBloodTithes(item, actor, speaker, rollMode) {
  const maxPay = Math.max(0, (actor.system.health?.max ?? 1) - 1);
  const x = await bloodNumberDialog('Blood Tithes — Pay Mana with Max Health', 'Mana cost to convert (1:1):', 1, maxPay, 1);
  if (x === null) return;

  if (!(await payBloodloss(actor, x, 'Maximum Health (Blood Tithes)'))) return;

  await ChatMessage.create({ speaker, rollMode, content: warlockCard(
    'Blood Tithes', 'Passive',
    `${actor.name} pays a <strong>${x} Mana</strong> cost with <strong class="sty-bloodloss-cost">${x} Maximum Health</strong> instead.<br>
     <span class="chat-footnote">Do not deduct Mana for that ability. (No Manaburn is generated — no Mana was expended.)</span>`,
    resSnapshot(actor)
  )});
}

// ── Sanguine Ichor ────────────────────────────────────────────
// Swift — 1 Bloodloss (+1 per optional extra). +1 to [Reflex] rolls and
// Attack Rolls per Bloodloss paid, for 1 Round.
async function handleSanguineIchor(item, actor, speaker, rollMode) {
  const maxExtra = Math.max(0, (actor.system.health?.max ?? 2) - 2);
  const extra = await bloodNumberDialog('Sanguine Ichor — Optional extra Bloodloss', 'Extra Bloodloss (+1 each):', 0, maxExtra, 0);
  if (extra === null) return;

  const cost = 1 + extra;
  if (!(await payBloodloss(actor, cost, 'Bloodloss (Sanguine Ichor)'))) return;

  const bonus = 1 + extra;
  await actor.setFlag(SYSTEM_ID, 'sanguineIchorBonus', bonus);

  await ChatMessage.create({ speaker, rollMode, content: warlockCard(
    'Sanguine Ichor', 'Swift — 1+ Bloodloss',
    `${actor.name}'s blood swirls with power.<br>
     <strong>+${bonus}</strong> to <strong>[Reflex] Rolls</strong> and <strong>Attack Rolls</strong> for 1 Round.<br>
     <span class="chat-footnote">Attack rolls apply automatically; clears at the start of your next turn.</span>`,
    resSnapshot(actor)
  )});
}

// ── Crimson Crown ─────────────────────────────────────────────
// Swift — 3 Bloodloss. Lasts 5 Rounds or until end of engagement.
// Gains 1 gemstone per Mana expended while active. Spend gemstones for
// +1 atk / +3 dmg / +1 Potency (max +3) per gemstone.
async function handleCrimsonCrown(item, actor, speaker, rollMode) {
  const crown = actor.getFlag(SYSTEM_ID, 'crimsonCrown');

  // Crown already active → spend gemstones
  if (crown) {
    if ((crown.gems ?? 0) < 1) {
      return ui.notifications.warn(`Crimson Crown is active (${crown.rounds} round${crown.rounds === 1 ? '' : 's'} left) but holds no gemstones. Expend Mana to charge it.`);
    }
    const mode = await new Promise(resolve => {
      new Dialog({
        title: `Crimson Crown — Spend Gemstones (${crown.gems} available)`,
        content: `<p class="chat-hint-p">
          How will you expend the gemstones?</p>`,
        buttons: {
          atk:     { label: '+1 Attack Roll / gem',   callback: () => resolve('atk') },
          dmg:     { label: '+3 Damage / gem',        callback: () => resolve('dmg') },
          potency: { label: '+1 Potency / gem (max 3)', callback: () => resolve('potency') },
          cancel:  { label: 'Cancel', callback: () => resolve(null) },
        },
        default: 'atk',
      }, { width: 360, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
    });
    if (!mode) return;

    const maxSpend = mode === 'potency' ? Math.min(3, crown.gems) : crown.gems;
    const n = await bloodNumberDialog('Crimson Crown — Gemstones to spend', 'Gemstones:', 1, maxSpend, 1);
    if (n === null) return;

    await actor.setFlag(SYSTEM_ID, 'crimsonCrown', { ...crown, gems: crown.gems - n });

    let effect;
    if (mode === 'atk') {
      await actor.setFlag(SYSTEM_ID, 'crownAtkBonus', (actor.getFlag(SYSTEM_ID, 'crownAtkBonus') ?? 0) + n);
      effect = `<strong>+${n}</strong> to your next <strong>Attack Roll</strong> (applies automatically).`;
    } else if (mode === 'dmg') {
      await actor.setFlag(SYSTEM_ID, 'crownDmgBonus', (actor.getFlag(SYSTEM_ID, 'crownDmgBonus') ?? 0) + (3 * n));
      effect = `<strong>+${3 * n} damage</strong> on your next source of damage (applies automatically to attacks).`;
    } else {
      effect = `<strong>+${n} Potency</strong> against the next ability that rolls against your Potency.`;
    }

    return ChatMessage.create({ speaker, rollMode, content: warlockCard(
      'Crimson Crown — Gemstones', 'Swift',
      `${actor.name} crushes <strong>${n} gemstone${n === 1 ? '' : 's'}</strong> from the crown.<br>${effect}<br>
       <span class="chat-footnote">Gemstones remaining: ${crown.gems - n} · Rounds left: ${crown.rounds}</span>`,
      resSnapshot(actor)
    )});
  }

  // Activate the crown — 3 Bloodloss
  if (!(await payBloodloss(actor, 3, 'Bloodloss (Crimson Crown)'))) return;
  await actor.setFlag(SYSTEM_ID, 'crimsonCrown', { rounds: 5, gems: 0 });

  await ChatMessage.create({ speaker, rollMode, content: warlockCard(
    'Crimson Crown', 'Swift — 3 Bloodloss',
    `A crown of dripping blood manifests above ${actor.name}'s head.<br>
     Lasts <strong>5 Rounds</strong> or until the end of the engagement. Every <strong>1 Mana</strong> expended charges the crown with <strong>1 gemstone</strong>.<br>
     <span class="chat-footnote">Use Crimson Crown again to spend gemstones. The crown vanishes early if you are put into Last Breaths.</span>`,
    resSnapshot(actor)
  )});
}

// ── Hemorrhaging Lance ────────────────────────────────────────
// Focused — 4 Bloodloss. Both hands must be empty. Roll Arcane Sense for
// range, then attack: [3 × Soul + Manaburn] damage, pierces 1 Space of cover.
async function handleHemorrhagingLance(item, actor, speaker, rollMode) {
  if (!(await payBloodloss(actor, 4, 'Bloodloss (Hemorrhaging Lance)'))) return;

  // Range roll — Arcane Sense
  const rangeRoll = new Roll('2d6');
  await rangeRoll.evaluate();

  // Attack roll — 2d6 + mastery
  const mastery = actor.system.attributes?.mastery ?? 0;
  const atkFormula = mastery > 0 ? `2d6 + ${mastery}` : '2d6';
  const atkRoll = new Roll(atkFormula);
  await atkRoll.evaluate();

  const soulVal = actor.system.abilities?.Soul?.value ?? 0;
  const manaburn = getManaburn(actor);
  const damage = (3 * soulVal) + manaburn;

  await ChatMessage.create({ speaker, rollMode, rolls: [rangeRoll, atkRoll], content: warlockCard(
    'Hemorrhaging Lance', 'Focused — 4 Bloodloss',
    `${actor.name} forms a spiraling lance of blood between empty hands and fires it forward.<br>
     <div class="chat-message-detail-row" style="margin-top:4px;"><span class="chat-message-detail-label">Arcane Sense (range):</span><span><strong>${rangeRoll.total}</strong> — select a target within ${rangeRoll.total} Spaces (LoS not required)</span></div>
     <div class="chat-message-detail-row"><span class="chat-message-detail-label">Attack Roll:</span><span>${atkFormula} = <strong>${atkRoll.total}</strong></span></div>
     <div class="chat-message-detail-row"><span class="chat-message-detail-label">Damage:</span><span><strong>${damage}</strong> <span class="chat-footnote">(3 × Soul ${soulVal} + Manaburn ${manaburn})</span></span></div>
     <span class="chat-footnote">Pierces 1 Space of cover (obstruction also takes the damage). A creature interrupting LoS may make an Evasion check against your Potency; on failure it also suffers this damage.</span>
     ${dmgApplyBtn(damage)}`,
    resSnapshot(actor)
  )});
}

// ── Sacrifice ─────────────────────────────────────────────────
// Swift — 6 Maximum Health (only restored at a Spring of Life).
// Regain 3 Mana, all Stamina, and a second Focused Action this Phase.
async function handleSacrifice(item, actor, speaker, rollMode) {
  const curMax = actor.system.health?.max ?? 0;
  if (curMax - 6 <= 0) {
    return ui.notifications.error(`${actor.name} cannot pay 6 Maximum Health — it would reduce their Maximum HP to ${curMax - 6}.`);
  }
  const curSac = actor.getFlag(SYSTEM_ID, 'sacrificeHealthReduction') ?? 0;
  const newMax = curMax - 6;
  const curHP = actor.system.health?.value ?? 0;

  // Regain 3 Mana + all Stamina (mana INCREASE — no Manaburn generated)
  const mana = actor.system.mana ?? {};
  const newMana = Math.min(mana.max ?? 0, (mana.value ?? 0) + 3);
  await actor.update({
    'system.health.max': newMax,
    'system.health.value': Math.min(curHP, newMax),
    [`flags.${SYSTEM_ID}.sacrificeHealthReduction`]: curSac + 6,
    'system.mana.value': newMana,
    'system.stamina.value': actor.system.stamina?.max ?? 0,
  });

  await ChatMessage.create({ speaker, rollMode, content: warlockCard(
    'Sacrifice', 'Swift — 6 Maximum Health',
    `${actor.name} pays a desperate price for victory:<br>
     ✦ Regains <strong class="chat-green-bold">3 Mana</strong> and <strong class="chat-green-bold">all Stamina</strong><br>
     ✦ May use a <strong>second Focused Action</strong> this Phase<br>
     <span style="font-size:11px;color:#e05555;">The 6 Maximum Health can only be restored by visiting a Spring of Life.</span>`,
    resSnapshot(actor)
  )});
}

// ── Masochistic Returns ───────────────────────────────────────
// Passive (lvl 15): restore Stamina at 2 Maximum Health per 1 Stamina.
async function handleMasochisticReturns(item, actor, speaker, rollMode) {
  const sta = actor.system.stamina ?? {};
  const missing = Math.max(0, (sta.max ?? 0) - (sta.value ?? 0));
  if (missing < 1) return ui.notifications.warn(`${actor.name}'s Stamina is already full.`);

  const n = await bloodNumberDialog('Masochistic Returns — Recover Stamina', 'Stamina to recover (2 Max HP each):', 1, missing, 1);
  if (n === null) return;

  if (!(await payBloodloss(actor, 2 * n, 'Maximum Health (Masochistic Returns)'))) return;
  await actor.update({ 'system.stamina.value': (sta.value ?? 0) + n });

  await ChatMessage.create({ speaker, rollMode, content: warlockCard(
    'Masochistic Returns', 'Passive',
    `${actor.name} trades flesh for vigor — recovers <strong class="chat-green-bold">${n} Stamina</strong> for <strong class="sty-bloodloss-cost">${2 * n} Maximum Health</strong>.`,
    resSnapshot(actor)
  )});
}

// ── Attack-roll integration (called from aspect-attack.mjs) ──
// Consumes Scarlet Strike / Crimson Crown flags and reads Sanguine Ichor.
// Returns { attackMod, damageMod, labels }.
export async function applyWarlockAttackMods(actor, isFocused) {
  const out = { attackMod: 0, damageMod: 0, labels: [] };

  // Scarlet Strike — Focused Attacks only, consumed on use
  const scarlet = actor.getFlag(SYSTEM_ID, 'scarletStrikeBonus') ?? 0;
  if (scarlet > 0 && isFocused) {
    out.damageMod += scarlet;
    out.labels.push(`Scarlet Strike (+${scarlet} dmg)`);
    await actor.unsetFlag(SYSTEM_ID, 'scarletStrikeBonus');
  }

  // Sanguine Ichor — +N attack rolls for 1 round (NOT consumed per attack)
  const sanguine = actor.getFlag(SYSTEM_ID, 'sanguineIchorBonus') ?? 0;
  if (sanguine > 0) {
    out.attackMod += sanguine;
    out.labels.push(`Sanguine Ichor (+${sanguine} atk)`);
  }

  // Crimson Crown gemstones — consumed on use
  const crownAtk = actor.getFlag(SYSTEM_ID, 'crownAtkBonus') ?? 0;
  if (crownAtk > 0) {
    out.attackMod += crownAtk;
    out.labels.push(`Crimson Crown (+${crownAtk} atk)`);
    await actor.unsetFlag(SYSTEM_ID, 'crownAtkBonus');
  }
  const crownDmg = actor.getFlag(SYSTEM_ID, 'crownDmgBonus') ?? 0;
  if (crownDmg > 0) {
    out.damageMod += crownDmg;
    out.labels.push(`Crimson Crown (+${crownDmg} dmg)`);
    await actor.unsetFlag(SYSTEM_ID, 'crownDmgBonus');
  }

  return out;
}

// ── Round / phase / engagement upkeep ─────────────────────────

/** End-of-round upkeep: decrement Crimson Crown duration. */
export async function warlockEndOfRound(actor) {
  const crown = actor.getFlag(SYSTEM_ID, 'crimsonCrown');
  if (!crown) return;
  const rounds = (crown.rounds ?? 1) - 1;
  if (rounds <= 0) {
    await actor.unsetFlag(SYSTEM_ID, 'crimsonCrown');
    ui.notifications.info(`${actor.name}'s Crimson Crown crumbles away.`);
  } else {
    await actor.setFlag(SYSTEM_ID, 'crimsonCrown', { ...crown, rounds });
  }
}

/**
 * End-of-engagement: restore Maximum Health lost to Bloodloss and heal
 * for half that amount (FULL with Bloodied Eclipse). Clears Manaburn and
 * all transient Warlock flags. Returns true if anything was done.
 */
export async function warlockEndOfEngagement(actor, speaker = null) {
  speaker = speaker ?? ChatMessage.getSpeaker({ actor });
  const bloodloss = getBloodloss(actor);
  let did = false;

  if (bloodloss > 0) {
    const hasEclipse = actor.items.some(i => i.name === 'Bloodied Eclipse');
    const healAmt = hasEclipse ? bloodloss : Math.floor(bloodloss / 2);

    // Restore max HP first so the heal can land in the restored space
    const maxHP = (actor.system.health?.max ?? 0) + bloodloss;
    const curHP = actor.system.health?.value ?? 0;
    const newHP = Math.min(maxHP, curHP + healAmt);
    await actor.update({
      'system.health.max': maxHP,
      'system.health.value': newHP,
      [`flags.${SYSTEM_ID}.bloodlossHealthReduction`]: null,
    });

    await ChatMessage.create({ speaker, content: warlockCard(
      'Bloodloss Recovered', 'End of Engagement',
      `${actor.name} regains <strong class="chat-green-bold">${bloodloss} Maximum Health</strong> lost to Bloodloss
       and heals for <strong class="chat-green-bold">${healAmt} HP</strong> (${curHP} → ${newHP})
       ${hasEclipse ? '<span class="chat-gold-note">— Bloodied Eclipse: full heal instead of half.</span>' : '<span class="chat-footnote">(half the restored amount)</span>'}`,
      resSnapshot(actor)
    )});
    did = true;
  }

  // Clear Manaburn + transient flags
  if (getManaburn(actor) > 0) { await actor.unsetFlag(SYSTEM_ID, 'manaburn'); did = true; }
  for (const flag of ['scarletStrikeBonus', 'sanguineIchorBonus', 'crimsonCrown', 'crownAtkBonus', 'crownDmgBonus']) {
    if (actor.getFlag(SYSTEM_ID, flag) !== undefined) { await actor.unsetFlag(SYSTEM_ID, flag); did = true; }
  }
  return did;
}
