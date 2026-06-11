// ============================================================
// STRYDER — Brutality Aspect Handler
// ============================================================
// Resource: Ichor (0–8, stored as flags.stryder.ichor)
//
// Form Passive (automated, NOT handled here):
//   • Take ≥1 damage → +1 Ichor   (updateActor hook, stryder.mjs)
//   • Deal ≥1 damage → +1 Ichor   (damage-apply handler, stryder.mjs)
//   • Ichor Aura active: dealing damage grants 2 Ichor instead of 1
//
// Ability list:
//   Impending Doom | Ichor's Edge | Endless Thorns | Onset of Doom
//   Gouging Claw | Hellish Cleave | Impenetrable Will | Death or Glory | Ichor Aura
//   Form Passive (passive display) | Attached Bonus (passive display)
// ============================================================

const SYSTEM_ID = 'stryder';

// ── Ichor helpers ─────────────────────────────────────────────
export function getIchor(actor) {
  return actor.getFlag(SYSTEM_ID, 'ichor') ?? 0;
}

export async function setIchor(actor, val) {
  const hardMax = (actor.getFlag(SYSTEM_ID, 'ichorCanExceedMax') ? 12 : 8);
  await actor.setFlag(SYSTEM_ID, 'ichor', Math.max(0, Math.min(hardMax, val)));
}

export async function grantIchor(actor, amount = 1) {
  const cur = getIchor(actor);
  const hardMax = (actor.getFlag(SYSTEM_ID, 'ichorCanExceedMax') ? 12 : 8);
  if (cur >= hardMax) return; // already at cap
  const newVal = Math.min(hardMax, cur + amount);
  await actor.setFlag(SYSTEM_ID, 'ichor', newVal);
}

export async function spendIchor(actor, amount) {
  const cur = getIchor(actor);
  if (cur < amount) {
    ui.notifications.warn(`Not enough Ichor — need ${amount}, have ${cur}.`);
    return false;
  }
  await actor.setFlag(SYSTEM_ID, 'ichor', cur - amount);
  return true;
}

// ── Shared card builder ────────────────────────────────────────
function brutalityCard(title, subtitle, body, ichorDisplay = null) {
  const ichorLine = ichorDisplay !== null
    ? `<div class="chat-message-detail-row">
        <span class="chat-message-detail-label">Ichor:</span>
        <span class="chat-ichor">${ichorDisplay}</span>
       </div>`
    : '';
  return `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">${title}</div>
      <div class="chat-message-subtitle"><span class="aspect-label">Brutality</span></div>
    </div>
    <div class="chat-message-details">
      ${subtitle ? `<div class="chat-message-detail-row"><span class="chat-message-detail-label">Action:</span><span>${subtitle}</span></div>` : ''}
      ${ichorLine}
    </div>
    <div class="chat-message-content chat-content-rajdhani">
      ${body}
    </div>
  </div>`;
}

// ── Dialog helpers ─────────────────────────────────────────────
function ichorSpendDialog(title, current, min = 1, max = null) {
  const maxVal = max ?? current;
  return new Promise(resolve => {
    let amount = min;
    new Dialog({
      title,
      content: `<div class="dlg-rajdhani-pad">
        <p style="margin:0 0 10px;color:rgba(180,210,255,0.7);font-size:13px;">
          Current Ichor: <strong class="chat-ichor">${current}</strong>
        </p>
        <div class="dlg-flex-row">
          <label class="dlg-input-label">Ichor to spend:</label>
          <input id="ichor-amount" type="number" min="${min}" max="${maxVal}" value="${min}"
            class="dlg-ichor-input" />
        </div>
      </div>`,
      buttons: {
        confirm: {
          label: 'Confirm',
          callback: (html) => {
            amount = Math.min(maxVal, Math.max(min, parseInt(html.find('#ichor-amount').val()) || min));
            resolve(amount);
          }
        },
        cancel: { label: 'Cancel', callback: () => resolve(null) }
      },
      default: 'confirm',
    }, { width: 280, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });
}

// ── Main dispatcher ────────────────────────────────────────────
export const BRUTALITY_NAMES = [
  "Impending Doom", "Ichor's Edge", "Form Passive", "Attached Bonus",
  "Endless Thorns", "Onset of Doom", "Gouging Claw", "Hellish Cleave",
  "Impenetrable Will", "Death or Glory", "Ichor Aura",
];

export async function handleBrutalityAbility(item, speaker, rollMode) {
  const actor = item.actor;
  if (!actor) return ui.notifications.warn('No actor found.');

  // Stamina cost
  const staCost = item.system.stamina_cost ?? 0;
  if (staCost > 0) {
    const sta = actor.system.stamina?.value ?? 0;
    if (sta < staCost) return ui.notifications.warn(`Not enough Stamina (need ${staCost}, have ${sta}).`);
    await actor.update({ 'system.stamina.value': sta - staCost });
  }

  // Mana cost
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
    case 'Impending Doom':   return handleImpendingDoom(item, actor, speaker, rollMode);
    case "Ichor's Edge":     return handleIchorsEdge(item, actor, speaker, rollMode);
    case 'Endless Thorns':   return handleEndlessThorns(item, actor, speaker, rollMode);
    case 'Onset of Doom':    return handleOnsetOfDoom(item, actor, speaker, rollMode);
    case 'Gouging Claw':     return handleGougingClaw(item, actor, speaker, rollMode);
    case 'Hellish Cleave':   return handleHellishCleave(item, actor, speaker, rollMode);
    case 'Impenetrable Will':return handleImpenetrableWill(item, actor, speaker, rollMode);
    case 'Death or Glory':   return handleDeathOrGlory(item, actor, speaker, rollMode);
    case 'Ichor Aura':       return handleIchorAura(item, actor, speaker, rollMode);
    case 'Form Passive':
    case 'Attached Bonus':
      // These are passive — just show the description card
      return ChatMessage.create({ speaker, rollMode, content: brutalityCard(item.name, 'Passive',
        item.system.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ').trim() ?? '') });
    default:
      return ChatMessage.create({ speaker, rollMode, content: brutalityCard(item.name, 'Brutality', item.system.description ?? '') });
  }
}

// ── Impending Doom ─────────────────────────────────────────────
// Sets a flag: next Focused Attack next round → Swift, 2×Soul base dmg, +1 Ichor on hit
// Also: -1 Dodge/Evasion for current round (flag checked by defense rolls)
async function handleImpendingDoom(item, actor, speaker, rollMode) {
  await actor.setFlag(SYSTEM_ID, 'impendingDoomActive', true);
  await actor.setFlag(SYSTEM_ID, 'impendingDoomPenalty', true);
  ui.notifications.info(`Impending Doom — next Focused Attack: 2×Soul dmg, Swift, +1 Ichor on hit. −1 Dodge/Evasion this round.`);
}

// ── Ichor's Edge ───────────────────────────────────────────────
// Spend N Ichor → next attack deals +2N damage
async function handleIchorsEdge(item, actor, speaker, rollMode) {
  const cur = getIchor(actor);
  if (cur < 1) return ui.notifications.warn('No Ichor to spend on Ichor\'s Edge.');

  const amount = await ichorSpendDialog("Ichor's Edge — Spend Ichor", cur, 1, cur);
  if (amount === null) return;

  const ok = await spendIchor(actor, amount);
  if (!ok) return;

  const bonus = amount * 2;
  await actor.setFlag(SYSTEM_ID, 'ichorEdgeBonus', (actor.getFlag(SYSTEM_ID, 'ichorEdgeBonus') ?? 0) + bonus);
  ui.notifications.info(`Ichor's Edge — spent ${amount} Ichor. Next attack deals +${bonus} damage.`);
}

// ── Endless Thorns ─────────────────────────────────────────────
// Trigger: be dealt damage. Spend 2 Ichor → make a Quick Attack at attacker.
async function handleEndlessThorns(item, actor, speaker, rollMode) {
  const cur = getIchor(actor);
  if (cur < 2) return ui.notifications.warn('Endless Thorns requires 2 Ichor.');

  const ok = await spendIchor(actor, 2);
  if (!ok) return;

  await ChatMessage.create({ speaker, rollMode, content: brutalityCard(
    'Endless Thorns', 'Trigger',
    '2 Ichor spent. Making a Quick Attack at the creature who attacked you.',
    getIchor(actor)
  )});

  // Fire a Quick Attack using the Aspect resolver (swift action type, Soul Armament)
  const { resolveFocusedAttack } = await import('../helpers/aspect-attack.mjs');
  // Treat as a swift/quick attack — resolveAspectAttack with a synthetic swift item context
  const syntheticItem = {
    name: 'Endless Thorns — Counter',
    type: 'action',
    id: null, _id: null,
    system: { action_type: 'swift', stamina_cost: 0, mana_cost: 0, other_restrictions: '', tag1: '', tag2: '', tag3: '' },
    flags: { stryder: { aspectName: 'Brutality' } },
    actor,
  };
  const { resolveAspectAttack } = await import('../helpers/aspect-attack.mjs');
  return resolveAspectAttack(syntheticItem, actor, { speaker, rollMode });
}

// ── Onset of Doom ──────────────────────────────────────────────
// Next Focused Attack inflicts Panicked (2 rounds)
async function handleOnsetOfDoom(item, actor, speaker, rollMode) {
  await actor.setFlag(SYSTEM_ID, 'onsetOfDoomActive', true);
  const cur = getIchor(actor);
  await ChatMessage.create({ speaker, rollMode, content: brutalityCard(
    'Onset of Doom', 'Swift',
    `Next Focused Attack inflicts the <strong>Panicked</strong> condition on targets hit, lasting 2 rounds.<br>
     <span class="chat-footnote">Form Passive: +1 extra Ichor when hitting Panicked creatures.</span>`,
    cur
  )});
}

// ── Gouging Claw ───────────────────────────────────────────────
// Next Focused Attack: Dash 4 spaces + deal Soul+3 extra damage
async function handleGougingClaw(item, actor, speaker, rollMode) {
  await actor.setFlag(SYSTEM_ID, 'gougingClawActive', true);
  const soulVal = actor.system.abilities?.Soul?.value ?? 0;
  const cur = getIchor(actor);
  await ChatMessage.create({ speaker, rollMode, content: brutalityCard(
    'Gouging Claw', 'Swift',
    `Next Focused Attack: <strong>Dash 4 Spaces</strong> before striking, dealing <strong>+${soulVal + 3} bonus damage</strong> (Soul+3).`,
    cur
  )});
}

// ── Hellish Cleave ─────────────────────────────────────────────
// Spend N Ichor → next attack hits N extra targets (Evasion check each)
async function handleHellishCleave(item, actor, speaker, rollMode) {
  const cur = getIchor(actor);
  if (cur < 1) return ui.notifications.warn('No Ichor to spend on Hellish Cleave.');

  const amount = await ichorSpendDialog('Hellish Cleave — Extra Targets', cur, 1, cur);
  if (amount === null) return;

  const ok = await spendIchor(actor, amount);
  if (!ok) return;

  await actor.setFlag(SYSTEM_ID, 'hellishCleaveTargets', amount);
  await ChatMessage.create({ speaker, rollMode, content: brutalityCard(
    'Hellish Cleave', 'Swift',
    `Spent <strong>${amount} Ichor</strong>. Next attack can target <strong>${amount + 1} creature${amount > 0 ? 's' : ''}</strong> (main target + ${amount} extra).<br>
     Each extra creature must fail an <strong>Evasion Check</strong> to take damage.`,
    getIchor(actor)
  )});
}

// ── Impenetrable Will ──────────────────────────────────────────
// Trigger: targeted by [Control]. Spend Ichor → +2 per Ichor to chosen resistance
async function handleImpenetrableWill(item, actor, speaker, rollMode) {
  const cur = getIchor(actor);
  if (cur < 1) return ui.notifications.warn('No Ichor to spend on Impenetrable Will.');

  // Choose resistance type
  const resistType = await new Promise(resolve => {
    new Dialog({
      title: 'Impenetrable Will',
      content: `<p class="chat-hint-p">
        Which resistance against the [Control] ability?
      </p>`,
      buttons: {
        physical: { label: 'Physical Resistance', callback: () => resolve('Physical') },
        magykal:  { label: 'Magykal Resistance',  callback: () => resolve('Magykal') },
        cancel:   { label: 'Cancel', callback: () => resolve(null) }
      },
      default: 'physical',
    }, { width: 300, classes: ['dialog','stryder-stat-popup'] }).render(true);
  });
  if (!resistType) return;

  const amount = await ichorSpendDialog(`Impenetrable Will — ${resistType}`, cur, 1, cur);
  if (amount === null) return;

  const ok = await spendIchor(actor, amount);
  if (!ok) return;

  const bonus = amount * 2;
  await ChatMessage.create({ speaker, rollMode, content: brutalityCard(
    'Impenetrable Will', 'Swift / Trigger',
    `Spent <strong>${amount} Ichor</strong>. <strong>+${bonus}</strong> to <strong>${resistType} Resistance</strong> against the [Control] ability.`,
    getIchor(actor)
  )});
}

// ── Death or Glory ─────────────────────────────────────────────
// Trigger: would fall to Last Breaths. Gain 4 Ichor (exceeds cap). Spend to heal 2 HP/Ichor.
async function handleDeathOrGlory(item, actor, speaker, rollMode) {
  // Grant 4 Ichor, can exceed cap temporarily
  await actor.setFlag(SYSTEM_ID, 'ichorCanExceedMax', true);
  await grantIchor(actor, 4);
  await actor.unsetFlag(SYSTEM_ID, 'ichorCanExceedMax');

  const cur = getIchor(actor);
  await ChatMessage.create({ speaker, rollMode, content: brutalityCard(
    'Death or Glory', 'Trigger',
    `Gained <strong>4 Ichor</strong> (can exceed max). Current: <strong>${cur}</strong>.<br>
     Choose how much to expend — <strong>2 Health per 1 Ichor</strong>.`,
    cur
  )});

  if (cur < 1) return;

  const amount = await ichorSpendDialog('Death or Glory — Spend Ichor to Heal', cur, 1, cur);
  if (amount === null) return;

  const ok = await spendIchor(actor, amount);
  if (!ok) return;

  const healAmt = amount * 2;
  const curHP   = actor.system.health?.value ?? 0;
  const maxHP   = actor.system.health?.max   ?? 0;
  const newHP   = Math.min(maxHP, curHP + healAmt);
  await actor.update({ 'system.health.value': newHP });

  await ChatMessage.create({ speaker, rollMode, content: brutalityCard(
    'Death or Glory — Healed', 'Trigger',
    `Spent <strong>${amount} Ichor</strong>, restored <strong>${healAmt} HP</strong>. (${curHP} → ${newHP})`,
    getIchor(actor)
  )});
}

// ── Ichor Aura ─────────────────────────────────────────────────
// Trigger: start Player Phase with 8 Ichor.
// Grants round-long buffs; the auto-trigger is handled in stryder.mjs turnStart.
async function handleIchorAura(item, actor, speaker, rollMode) {
  // Manual activation path (player clicks the ability)
  const cur = getIchor(actor);
  if (cur < 8) return ui.notifications.warn(`Ichor Aura requires 8 Ichor to trigger. (Current: ${cur})`);
  return activateIchorAura(actor, speaker, rollMode);
}

export async function activateIchorAura(actor, speaker, rollMode) {
  await actor.setFlag(SYSTEM_ID, 'ichorAuraActive', true);
  await ChatMessage.create({ speaker, rollMode, content: brutalityCard(
    '⚡ Ichor Aura', 'Trigger',
    `Active until end of round:<br>
     ⚔ Soul Armament <strong>+1 Range</strong><br>
     🔴 Dealing damage grants <strong>2 Ichor</strong> instead of 1<br>
     💨 Spend Ichor for <strong>+3 Movement</strong> per Ichor<br>
     ⚡ If dealt damage while Impending Doom is active, immediately unleash your Focused Attack`,
    getIchor(actor)
  )});
}
