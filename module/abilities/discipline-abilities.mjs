// ============================================================
// STRYDER — Discipline Aspect Ability Handlers
// ============================================================
// Handles Full-Body Assault (FBA) attack type selection,
// Flow tracking, and Combo/Finisher/Counter ability display.
// ============================================================

import { resolveStaminaCost } from '../helpers/stamina-conversion.mjs';

const SYSTEM_ID = 'stryder';

// ── Utility: read/write Flow & lastFBAType on actor flags ──
function getFlow(actor) {
  return actor.getFlag(SYSTEM_ID, 'flow') ?? 0;
}
async function incrementFlow(actor) {
  const current = getFlow(actor);
  await actor.setFlag(SYSTEM_ID, 'flow', current + 1);
  return current + 1;
}
async function spendFlow(actor, amount) {
  const current = getFlow(actor);
  const next = Math.max(0, current - amount);
  await actor.setFlag(SYSTEM_ID, 'flow', next);
  return next;
}
function getLastFBAType(actor) {
  return actor.getFlag(SYSTEM_ID, 'lastFBAType') ?? null;
}
async function setLastFBAType(actor, type) {
  await actor.setFlag(SYSTEM_ID, 'lastFBAType', type);
}

// ── Utility: roll quality from result ──────────────────────
function getQuality(result) {
  if (result <= 4)  return { label: 'Poor',      color: '#dc3545', icon: '▼', multiplier: 0.5 };
  if (result >= 11) return { label: 'Excellent',  color: '#ffd700', icon: '★', multiplier: 1.5 };
  return              { label: 'Good',       color: '#5cb85c', icon: '●', multiplier: 1.0 };
}

// ── Utility: card helpers ──────────────────────────────────
function card(header, subtitle, body) {
  return `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">${header}</div>
      <div class="chat-message-subtitle">${subtitle}</div>
    </div>
    <div class="chat-message-content">${body}</div>
  </div>`;
}

function flowBadge(flow) {
  return `<div style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;
    background:rgba(42,112,224,0.12);border:1px solid rgba(42,112,224,0.35);
    border-radius:3px;font-family:'Cinzel',serif;font-size:10px;color:#90c8ff;margin-top:6px;">
    FLOW: ${flow}
  </div>`;
}

// ── FBA type definitions ───────────────────────────────────
const FBA_TYPES = {
  light: {
    label: 'Light Strike',
    icon: '⚡',
    color: '#60b8ff',
    rollMod: +1,
    damageMod: -1,
    rollLabel: '+1 Roll',
    damageLabel: '−1 Damage',
    effect: 'On hit — if you use <strong>Light Combo</strong>, this attack can grant [Sunder].',
  },
  heavy: {
    label: 'Heavy Strike',
    icon: '⚒',
    color: '#ff9060',
    rollMod: -1,
    damageMod: +1,
    rollLabel: '−1 Roll',
    damageLabel: '+1 Damage',
    effect: 'On hit — if you use <strong>Heavy Combo</strong>, deal +3 additional damage.',
  },
  grab: {
    label: 'Grab',
    icon: '🤜',
    color: '#a060ff',
    rollMod: 0,
    damageMod: 0,
    rollLabel: 'No Roll Mod',
    damageLabel: 'Grapple On Hit',
    effect: 'On hit — the target is automatically Grappled (normal grapple rules, maintainable one-handed).',
  },
};

// ── All Discipline ability names ───────────────────────────
export const DISCIPLINE_NAMES = [
  'Full-Body Assault',
  'Flow',
  'Light Breakdown', 'Grab Breakdown', 'Heavy Breakdown',
  'Light Combo', 'Grab Combo', 'Heavy Combo',
  'Light Counter: Intercepting Strike',
  'Heavy Counter: Crushing Blow',
  'Grab Counter: Redirecting Grab',
  'Light Finishers', 'Heavy Finishers', 'Grab Finishers',
];

// ── Main dispatcher ────────────────────────────────────────
export async function handleDisciplineAbility(item, speaker, rollMode) {
  const actor = item.actor;
  if (!actor) return ui.notifications.warn('No actor found for this item.');

  // Spend stamina (if any)
  const staminaCost = item.system.stamina_cost ?? 0;
  if (staminaCost > 0) {
    const payment = await resolveStaminaCost(actor, staminaCost);
    if (payment === null) return; // cancelled
    const updates = {};
    if (payment.staminaToSpend > 0) updates['system.stamina.value'] = (actor.system.stamina?.value ?? 0) - payment.staminaToSpend;
    if (payment.manaToSpend > 0)    updates['system.mana.value']    = (actor.system.mana?.value ?? 0)    - payment.manaToSpend;
    if (Object.keys(updates).length) await actor.update(updates);
  }

  // Check + consume limit
  const limitMax = item.system.limit?.max ?? 0;
  if (limitMax > 0) {
    const limitVal = item.system.limit?.value ?? 0;
    if (limitVal >= limitMax) return ui.notifications.warn(`${item.name} has reached its limit of ${limitMax} uses!`);
    await item.update({ 'system.limit.value': limitVal + 1 });
  }

  switch (item.name) {
    case 'Full-Body Assault': return handleFullBodyAssault(item, actor, speaker, rollMode);
    case 'Flow':              return handleFlowPassive(item, actor, speaker);
    default:                  return handleGenericDisciplineAbility(item, actor, speaker);
  }
}

// ── Full-Body Assault ──────────────────────────────────────
async function handleFullBodyAssault(item, actor, speaker, rollMode) {
  const soul = actor.system.abilities?.Soul?.value ?? 0;
  const currentFlow = getFlow(actor);

  return new Promise(resolve => {

    const dialogContent = `
      <style>
        .fba-dialog { font-family: 'Cinzel', serif; padding: 4px; }
        .fba-dialog p.hint {
          font-size: 10px; color: rgba(168,200,232,0.7); text-align: center;
          letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 12px;
        }
        .fba-choices { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .fba-choice {
          display: flex; flex-direction: column; align-items: center; padding: 10px 6px;
          background: rgba(10,18,36,0.8); border: 1px solid rgba(42,112,224,0.25);
          border-radius: 6px; cursor: pointer; transition: all 0.15s ease;
          border-top: 3px solid rgba(42,112,224,0.4);
        }
        .fba-choice:hover { background: rgba(42,112,224,0.15); border-color: rgba(42,112,224,0.6); }
        .fba-choice.selected { background: rgba(42,112,224,0.2); border-color: #2a70e0; }
        .fba-choice .fba-icon { font-size: 22px; margin-bottom: 4px; }
        .fba-choice .fba-name { font-size: 11px; font-weight: 700; color: #d8e8ff; margin-bottom: 6px; }
        .fba-choice .fba-mods { font-size: 10px; text-align: center; color: rgba(168,200,232,0.8); line-height: 1.5; }
        .fba-choice .fba-mod-good  { color: #5cb85c; font-weight: 700; }
        .fba-choice .fba-mod-bad   { color: #dc7070; font-weight: 700; }
        .fba-choice .fba-mod-neut  { color: #a060ff; font-weight: 700; }
        .fba-footer { display:flex; justify-content:space-between; align-items:center;
          border-top: 1px solid rgba(42,112,224,0.2); padding-top: 8px; margin-top: 4px;
          font-size: 10px; color: rgba(168,200,232,0.6); }
        .fba-footer .flow-tag { font-family:'Cinzel',serif; color:#90c8ff;
          background:rgba(42,112,224,0.12); border:1px solid rgba(42,112,224,0.35);
          border-radius:3px; padding:2px 7px; }
        .fba-footer .soul-tag { color:#a8c8e8; }
      </style>
      <div class="fba-dialog">
        <p class="hint">Select your Full-Body Assault strike type</p>
        <div class="fba-choices">

          <div class="fba-choice" id="fba-light" onclick="document.querySelectorAll('.fba-choice').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');window._fbaChosen='light';">
            <div class="fba-icon">⚡</div>
            <div class="fba-name">LIGHT</div>
            <div class="fba-mods">
              <span class="fba-mod-good">+1 Roll</span><br>
              <span class="fba-mod-bad">−1 Damage</span>
            </div>
          </div>

          <div class="fba-choice" id="fba-heavy" onclick="document.querySelectorAll('.fba-choice').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');window._fbaChosen='heavy';">
            <div class="fba-icon">⚒</div>
            <div class="fba-name">HEAVY</div>
            <div class="fba-mods">
              <span class="fba-mod-good">+1 Damage</span><br>
              <span class="fba-mod-bad">−1 Roll</span>
            </div>
          </div>

          <div class="fba-choice" id="fba-grab" onclick="document.querySelectorAll('.fba-choice').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');window._fbaChosen='grab';">
            <div class="fba-icon">🤜</div>
            <div class="fba-name">GRAB</div>
            <div class="fba-mods">
              <span class="fba-mod-neut">Grapple<br>On Hit</span>
            </div>
          </div>

        </div>
        <div class="fba-footer">
          <span class="flow-tag">Flow: ${currentFlow}</span>
          <span class="soul-tag">2d6 + ${soul} Soul</span>
        </div>
      </div>
    `;

    new Dialog({
      title: 'Full-Body Assault',
      content: dialogContent,
      buttons: {
        strike: {
          label: '⚔ Strike!',
          callback: async () => {
            const chosen = window._fbaChosen ?? 'light';
            window._fbaChosen = null;
            await executeFBAStrike(item, actor, speaker, rollMode, chosen, soul);
            resolve();
          }
        },
        cancel: {
          label: 'Cancel',
          callback: () => resolve()
        }
      },
      default: 'strike',
      render: (html) => {
        // Auto-select light on open
        html[0].querySelector('#fba-light')?.classList.add('selected');
        window._fbaChosen = 'light';
      }
    }).render(true);
  });
}

// ── Execute the FBA roll after type is chosen ──────────────
async function executeFBAStrike(item, actor, speaker, rollMode, chosenType, soul) {
  const fba = FBA_TYPES[chosenType];
  const rollBonus = soul + fba.rollMod;
  const bonusStr  = rollBonus >= 0 ? `+${rollBonus}` : `${rollBonus}`;
  const formula   = `2d6${bonusStr}`;

  const roll = new Roll(formula);
  await roll.evaluate({ async: true });

  const result  = roll.total;
  const quality = getQuality(result);

  // Increment Flow (+1 per FBA) and store FBA type
  const newFlow = await incrementFlow(actor);
  await setLastFBAType(actor, chosenType);

  // Build quality badge
  const qualityBadge = `
    <span style="font-weight:700;color:${quality.color};font-size:13px;">
      ${quality.icon} ${quality.label}
    </span>`;

  // Build damage-mod note
  const dmgModLabel = fba.damageMod > 0
    ? `<span style="color:#5cb85c;font-weight:700;">+${fba.damageMod} base damage</span>`
    : fba.damageMod < 0
    ? `<span style="color:#dc7070;font-weight:700;">${fba.damageMod} base damage</span>`
    : `<span style="color:#a060ff;font-weight:700;">No damage modifier</span>`;

  const content = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <div class="chat-message-title">${fba.icon} Full-Body Assault — ${fba.label}</div>
        <div class="chat-message-subtitle">Focused Action · Discipline</div>
      </div>
      <div class="chat-message-content">

        <div style="display:flex;align-items:center;justify-content:space-between;
          padding:8px 10px;margin-bottom:8px;
          background:rgba(10,18,36,0.7);border:1px solid rgba(42,112,224,0.25);
          border-left:3px solid ${fba.color};border-radius:0 4px 4px 0;">
          <div>
            <div style="font-family:'Cinzel',serif;font-size:10px;color:rgba(168,200,232,0.6);letter-spacing:0.1em;">ATTACK ROLL</div>
            <div style="font-size:11px;color:rgba(168,200,232,0.8);">2d6 + ${soul} Soul ${fba.rollMod > 0 ? `<span style="color:#5cb85c">(+${fba.rollMod} strike)</span>` : fba.rollMod < 0 ? `<span style="color:#dc7070">(${fba.rollMod} strike)</span>` : ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:700;color:#d8e8ff;font-family:'Cinzel',serif;">${result}</div>
            <div>${qualityBadge}</div>
          </div>
        </div>

        <div style="padding:6px 8px;margin-bottom:8px;font-size:11px;
          background:rgba(10,18,36,0.5);border:1px solid rgba(42,112,224,0.18);border-radius:4px;">
          <strong style="color:#a8c8e8;">Damage mod:</strong> ${dmgModLabel}<br>
          <strong style="color:#a8c8e8;">On hit:</strong> <span style="color:rgba(168,200,232,0.85);">${fba.effect}</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          ${flowBadge(newFlow)}
          <span style="font-size:10px;color:rgba(168,200,232,0.5);">lastFBAType: ${chosenType}</span>
        </div>
      </div>
    </div>`;

  await roll.toMessage({
    speaker,
    flavor: content,
    rollMode,
    flags: { 'stryder.rollType': 'attack', 'stryder.fbaType': chosenType }
  });
}

// ── Flow passive (just shows current state) ────────────────
async function handleFlowPassive(item, actor, speaker) {
  const flow = getFlow(actor);
  const lastType = getLastFBAType(actor);

  const typeLabel = lastType
    ? `${FBA_TYPES[lastType]?.icon ?? ''} <strong>${lastType.charAt(0).toUpperCase() + lastType.slice(1)}</strong>`
    : 'None yet this Phase';

  await ChatMessage.create({
    speaker,
    content: card(
      'Flow',
      'Discipline Resource',
      `<div style="text-align:center;margin:8px 0;">
        <div style="font-family:'Cinzel',serif;font-size:28px;font-weight:700;color:#90c8ff;">${flow}</div>
        <div style="font-size:11px;color:rgba(168,200,232,0.6);margin-top:2px;">Current Flow</div>
      </div>
      <p style="font-size:11px;color:rgba(168,200,232,0.8);margin:6px 0 2px;">
        <strong>Last FBA Type:</strong> ${typeLabel}
      </p>
      <p style="font-size:10px;color:rgba(168,200,232,0.55);margin:0;">
        Flow increases by 1 on each Full-Body Assault. Combo/Finisher abilities consume Flow.
      </p>
      ${flowBadge(flow)}`
    )
  });
}

// ── Generic Discipline ability (Breakdown/Combo/Counter/Finisher) ──
async function handleGenericDisciplineAbility(item, actor, speaker) {
  const flow = getFlow(actor);
  const lastType = getLastFBAType(actor);
  const soul = actor.system.abilities?.Soul?.value ?? 0;

  // Annotate the card with flow state context
  const contextNote = lastType
    ? `<div style="margin-top:8px;padding:4px 8px;font-size:10px;
        background:rgba(42,112,224,0.08);border:1px solid rgba(42,112,224,0.2);border-radius:3px;
        color:rgba(168,200,232,0.7);">
        <strong style="color:#90c8ff;">Context —</strong>
        Last FBA: ${FBA_TYPES[lastType]?.icon ?? ''} ${lastType} &nbsp;|&nbsp; Flow: ${flow}
      </div>`
    : '';

  await ChatMessage.create({
    speaker,
    content: card(
      item.name,
      `Discipline · ${item.system.action_type?.charAt(0).toUpperCase() + item.system.action_type?.slice(1) ?? 'Action'}`,
      `${item.system.description ?? ''}${contextNote}${flowBadge(flow)}`
    )
  });
}

// ── Exported helpers for external use (e.g. combat hooks) ──
export { getFlow, incrementFlow, spendFlow, getLastFBAType, setLastFBAType, FBA_TYPES };
