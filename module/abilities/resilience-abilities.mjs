// ============================================================
// STRYDER — Resilience Aspect Ability Handlers (Level 3)
// ============================================================

import { resolveStaminaCost } from '../helpers/stamina-conversion.mjs';

const SYSTEM_ID = 'stryder';

function btnStyle(color = '#1a1a2e') {
  return `style="width:100%;padding:5px 10px;margin-top:4px;background:${color};border:1px solid rgba(100,150,200,0.4);border-radius:4px;color:#c8d8f0;font-size:11px;cursor:pointer;font-family:inherit;text-align:left;"`;
}

function card(title, subtitle, body) {
  return `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">${title}</div>
      <div class="chat-message-subtitle">${subtitle}</div>
    </div>
    <div class="chat-message-content">${body}</div>
  </div>`;
}

// ── Dispatcher ────────────────────────────────────────────
export async function handleResilienceAbility(item, speaker, rollMode) {
  const actor = item.actor;
  if (!actor) return ui.notifications.warn("No actor found for this item.");

  // Deduct stamina cost (with optional mana conversion)
  const cost = item.system.stamina_cost ?? 0;
  const payment = await resolveStaminaCost(actor, cost);
  if (payment === null) return; // cancelled
  if (payment.staminaToSpend > 0 || payment.manaToSpend > 0) {
    const updates = {};
    if (payment.staminaToSpend > 0) updates['system.stamina.value'] = (actor.system.stamina?.value ?? 0) - payment.staminaToSpend;
    if (payment.manaToSpend > 0) updates['system.mana.value'] = (actor.system.mana?.value ?? 0) - payment.manaToSpend;
    await actor.update(updates);
  }

  // Increment limit
  const limitMax = item.system.limit?.max ?? 0;
  if (limitMax > 0) {
    const limitVal = item.system.limit?.value ?? 0;
    if (limitVal >= limitMax) return ui.notifications.warn(`${item.name} has reached its limit of ${limitMax} uses!`);
    await item.update({ 'system.limit.value': limitVal + 1 });
  }

  switch (item.name) {
    case 'Armored Soul':       return handleArmoredSoul(item, actor, speaker);
    case 'Deep Guard':         return handleDeepGuard(item, actor, speaker);
    case 'Attached Bonus':     return handleAttachedBonus(item, actor, speaker);
    case 'Ancient Armor':      return handleAncientArmor(item, actor, speaker);
    case 'Irresistible Rage':  return handleIrresistibleRage(item, actor, speaker);
    case 'Full Brace':         return handleFullBrace(item, actor, speaker);
    case 'Revenge Shield':     return handleRevengeShield(item, actor, speaker);
    case 'Sacrifice':          return handleSacrifice(item, actor, speaker);
    case 'Unbreakable':        return handleUnbreakable(item, actor, speaker);
    case 'Atlas Resilience':   return handleAtlasResilience(item, actor, speaker);
    default:
      return ChatMessage.create({ speaker, rollMode,
        content: card(item.name, 'Resilience Ability', item.system.description ?? '') });
  }
}

// ── Armored Soul ──────────────────────────────────────────
async function handleArmoredSoul(item, actor, speaker) {
  const atlasActive = actor.getFlag(SYSTEM_ID, 'atlasResilienceActive') ?? false;
  const drValue = atlasActive ? 4 : 2;
  const atlasNote = atlasActive ? ` <em>(Atlas Resilience active: +${drValue} to both types)</em>` : '';

  return new Promise(resolve => {
    new Dialog({
      title: 'Armored Soul — Choose Form',
      content: `<p style="margin-bottom:8px;">Choose your armor form for this Player Phase:${atlasNote}</p>
        <p><strong>🛡 Material Form:</strong> Gain +${drValue} Physical Damage Reduction.</p>
        <p><strong>✨ Magykal Form:</strong> Gain +${drValue} Magykal Damage Reduction.</p>`,
      buttons: {
        material: {
          label: '🛡 Material Form',
          callback: async () => {
            await actor.setFlag(SYSTEM_ID, 'armoredSoulMode', 'material');
            await actor.setFlag(SYSTEM_ID, 'armoredSoulDR', drValue);
            await ChatMessage.create({ speaker, content: card('Armored Soul', 'Passive · Material Form Active',
              `<p>${actor.name} gains <strong>+${drValue} Physical DR</strong> this Player Phase.${atlasNote}</p>`) });
            resolve();
          }
        },
        magykal: {
          label: '✨ Magykal Form',
          callback: async () => {
            await actor.setFlag(SYSTEM_ID, 'armoredSoulMode', 'magykal');
            await actor.setFlag(SYSTEM_ID, 'armoredSoulDR', drValue);
            await ChatMessage.create({ speaker, content: card('Armored Soul', 'Passive · Magykal Form Active',
              `<p>${actor.name} gains <strong>+${drValue} Magykal DR</strong> this Player Phase.${atlasNote}</p>`) });
            resolve();
          }
        }
      },
      default: 'material'
    }).render(true);
  });
}

// ── Deep Guard ────────────────────────────────────────────
async function handleDeepGuard(item, actor, speaker) {
  const soul = actor.system.abilities?.Soul?.value ?? 0;
  const casterTokenId = actor.token?.id ?? canvas.tokens.placeables.find(t => t.actor === actor)?.id ?? '';

  // Count known Resilience abilities (excluding core: Armored Soul, Deep Guard, Attached Bonus)
  const CORE_NAMES = ['Armored Soul', 'Deep Guard', 'Attached Bonus'];
  const RESILIENCE_ALL = ['Armored Soul','Deep Guard','Attached Bonus','Ancient Armor','Irresistible Rage',
    'Full Brace','Revenge Shield','Sacrifice','Unbreakable','Atlas Resilience'];
  const knownCount = actor.items.filter(i =>
    RESILIENCE_ALL.includes(i.name) && !CORE_NAMES.includes(i.name)
  ).length;

  const reduction = soul + knownCount;

  // Check for Full Brace bonus
  const fullBraceBonus = actor.getFlag(SYSTEM_ID, 'fullBraceMitigationBonus') ?? 0;
  const totalReduction = reduction + fullBraceBonus;
  const fullBraceNote = fullBraceBonus > 0
    ? ` <em>(+${fullBraceBonus} Full Brace bonus included)</em>` : '';

  return new Promise(resolve => {
    new Dialog({
      title: 'Deep Guard — Incoming Damage',
      content: `<div style="margin-top:6px;">
        <p>Soul <strong>${soul}</strong> + Known Resilience abilities <strong>${knownCount}</strong>${fullBraceBonus > 0 ? ` + Full Brace <strong>${fullBraceBonus}</strong>` : ''} = <strong>${totalReduction}</strong> reduction.</p>
        <label>How much damage are you taking (before reduction)?</label>
        <input id="dg-damage" type="number" min="0" value="0" class="dlg-input-full" />
      </div>`,
      buttons: {
        apply: {
          label: '🛡 Apply Deep Guard',
          callback: async (html) => {
            const incoming = parseInt(html.find('#dg-damage').val()) || 0;
            const finalDmg = Math.max(0, incoming - totalReduction);
            await actor.setFlag(SYSTEM_ID, 'deepGuardReduction', totalReduction);
            if (fullBraceBonus > 0) await actor.unsetFlag(SYSTEM_ID, 'fullBraceMitigationBonus');
            await ChatMessage.create({ speaker, content: card('Deep Guard', `Trigger · 1 Stamina (spent)`,
              `<p>${actor.name} reduced <strong>${incoming}</strong> damage by <strong>${totalReduction}</strong>${fullBraceNote}.</p>
              <p>Final damage taken: <strong>${finalDmg}</strong></p>
              <button class="resilience-revenge-activate" data-token-id="${casterTokenId}" data-reduction="${totalReduction}" ${btnStyle('#2e1a0a')}>⚔ Activate Revenge Shield (${totalReduction} Revenge)</button>`) });
            resolve();
          }
        }
      },
      default: 'apply'
    }).render(true);
  });
}

// ── Attached Bonus ────────────────────────────────────────
async function handleAttachedBonus(item, actor, speaker) {
  await actor.setFlag(SYSTEM_ID, 'attachedBonusActive', true);
  await ChatMessage.create({ speaker, content: card('Attached Bonus', 'Passive · Active',
    `<p>${actor.name}'s Focused Attacks will deal additional damage equal to their current Armored Soul Damage Reduction.</p>
    <p style="font-size:11px;opacity:0.7;">Activate Armored Soul first to set your DR. The bonus applies automatically on each Focused Attack.</p>`) });
}

// ── Ancient Armor ─────────────────────────────────────────
async function handleAncientArmor(item, actor, speaker) {
  const soul = actor.system.abilities?.Soul?.value ?? 0;
  const atlasBonus = (actor.getFlag(SYSTEM_ID, 'atlasResilienceActive') ?? false) ? 2 : 0;
  const totalBonus = soul + atlasBonus;
  const casterTokenId = actor.token?.id ?? canvas.tokens.placeables.find(t => t.actor === actor)?.id ?? '';
  await ChatMessage.create({ speaker, content: card('Ancient Armor', 'Trigger · 1 Stamina (spent)',
    `<p>Your Resistance Roll gains <strong>+${totalBonus}</strong>${atlasBonus > 0 ? ` (Soul ${soul} + Atlas +${atlasBonus})` : ` (Soul ${soul})`}.</p>
    <button class="resilience-ancient-armor-roll" data-token-id="${casterTokenId}" data-actor-name="${actor.name}" data-bonus="${totalBonus}" ${btnStyle()}>🎲 Roll Resistance (2d6 + ${totalBonus})</button>`) });
}

// ── Irresistible Rage ─────────────────────────────────────
async function handleIrresistibleRage(item, actor, speaker) {
  const targets = [...game.user.targets];
  const targetNames = targets.length
    ? targets.map(t => t.actor?.name ?? '?').join(', ')
    : '⚠ No targets selected';

  await ChatMessage.create({ speaker, content: card('Irresistible Rage', 'Swift · 2 Stamina (spent)',
    `<p>All enemy creatures within <strong>Range 3</strong> must make a Magykal Resistance Roll.</p>
    <p>Targeted: <strong>${targetNames}</strong></p>
    <p>On failure → Taunted until end of next Challenger Phase.</p>
    ${targets.map(t => `<button class="resilience-irresistible-rage-taunt" data-token-id="${t.id}" data-actor-name="${t.actor?.name}" ${btnStyle('#2e1a0a')}>💢 Apply Taunted → ${t.actor?.name ?? '?'}</button>`).join('')}`) });
}

// ── Full Brace ────────────────────────────────────────────
async function handleFullBrace(item, actor, speaker) {
  const soul = actor.system.abilities?.Soul?.value ?? 0;
  const casterTokenId = actor.token?.id ?? canvas.tokens.placeables.find(t => t.actor === actor)?.id ?? '';
  await actor.setFlag(SYSTEM_ID, 'fullBraceMitigationBonus', soul);
  await actor.setFlag(SYSTEM_ID, 'fullBraceMovementPenalty', true);
  await ChatMessage.create({ speaker, content: card('Full Brace', 'Trigger · 2 Stamina (spent)',
    `<p>${actor.name} braces fully!</p>
    <ul style="margin:6px 0;padding-left:16px;">
      <li>Deep Guard activates immediately at no cost (click Deep Guard to resolve it).</li>
      <li>Deep Guard gains <strong>+${soul}</strong> extra mitigation (Soul bonus — included automatically).</li>
      <li>${actor.name}'s Movement is reduced by <strong>3</strong> next Player Phase.</li>
    </ul>
    <button class="resilience-full-brace-clear" data-token-id="${casterTokenId}" ${btnStyle('#1a2e1a')}>✅ Clear Movement Penalty (start of next Player Phase)</button>`) });
}

// ── Revenge Shield ────────────────────────────────────────
async function handleRevengeShield(item, actor, speaker) {
  const reduction = actor.getFlag(SYSTEM_ID, 'deepGuardReduction') ?? 0;
  if (!reduction) return ui.notifications.warn("No Deep Guard reduction stored — use Deep Guard first!");

  await actor.setFlag(SYSTEM_ID, 'revengeAmount', reduction);
  await actor.unsetFlag(SYSTEM_ID, 'deepGuardReduction');

  await ChatMessage.create({ speaker, content: card('Revenge Shield', 'Trigger · 1 Stamina (spent)',
    `<p>${actor.name}'s Revenge amount is <strong>${reduction}</strong>.</p>
    <p>Next Focused Attack deals <strong>+${reduction}</strong> bonus damage (applied automatically).</p>`) });
}

// ── Sacrifice ─────────────────────────────────────────────
async function handleSacrifice(item, actor, speaker) {
  const targets = [...game.user.targets];
  const allyName = targets[0]?.actor?.name ?? 'ally';

  return new Promise(resolve => {
    new Dialog({
      title: 'Sacrifice — Take Ally Damage',
      content: `<p>You take the damage <strong>${allyName}</strong> would have taken.</p>
        <label>Damage amount:</label>
        <input id="sac-damage" type="number" min="0" value="0" class="dlg-input-full" />`,
      buttons: {
        confirm: {
          label: '❤ Sacrifice',
          callback: async (html) => {
            const dmg = parseInt(html.find('#sac-damage').val()) || 0;
            const curHP = actor.system.health?.value ?? 0;
            await actor.update({ 'system.health.value': Math.max(0, curHP - dmg) });
            await ChatMessage.create({ speaker, content: card('Sacrifice', 'Trigger · 0 Stamina',
              `<p>${actor.name} takes <strong>${dmg}</strong> damage to protect <strong>${allyName}</strong>.</p>`) });
            resolve();
          }
        }
      },
      default: 'confirm'
    }).render(true);
  });
}

// ── Unbreakable ───────────────────────────────────────────
async function handleUnbreakable(item, actor, speaker) {
  const casterTokenId = actor.token?.id ?? canvas.tokens.placeables.find(t => t.actor === actor)?.id ?? '';
  await actor.setFlag(SYSTEM_ID, 'unbreakableActive', true);
  await ChatMessage.create({ speaker, content: card('Unbreakable', 'Swift · 5 Stamina (spent)',
    `<p>${actor.name} is <strong>Unbreakable</strong> for the rest of this Encounter.</p>
    <p>Excellent Attacks against ${actor.name} deal damage as if they were Good.</p>
    <button class="resilience-unbreakable-clear" data-token-id="${casterTokenId}" ${btnStyle('#1a1a2e')}>✅ Clear Unbreakable (end of encounter)</button>`) });
}

// ── Atlas Resilience ──────────────────────────────────────
async function handleAtlasResilience(item, actor, speaker) {
  const casterTokenId = actor.token?.id ?? canvas.tokens.placeables.find(t => t.actor === actor)?.id ?? '';
  await actor.setFlag(SYSTEM_ID, 'atlasResilienceActive', true);
  await ChatMessage.create({ speaker, content: card('Atlas Resilience', 'Focused · 5 Stamina (spent)',
    `<p>${actor.name} channels Atlas Resilience!</p>
    <ul style="margin:6px 0;padding-left:16px;">
      <li><strong>Unwavering Resistance:</strong> +2 to all Resistance rolls (reminder: apply manually or via Ancient Armor).</li>
      <li><strong>Skybearing Resilience:</strong> Armored Soul DR increases by 2 and now applies to <em>both</em> Physical and Magykal damage simultaneously.</li>
    </ul>
    <p style="font-size:11px;opacity:0.7;">Re-activate Armored Soul to apply the updated DR values.</p>
    <button class="resilience-atlas-clear" data-token-id="${casterTokenId}" ${btnStyle('#1a1a2e')}>✅ Clear Atlas Resilience (end of engagement)</button>`) });
}

// ── Exported hooks for item.mjs ───────────────────────────

/** Returns Attached Bonus DR for Focused Attacks and Revenge amount, then clears revenge. */
export function getResilienceDamageBonus(actor, actionType) {
  let bonus = 0;

  // Attached Bonus: Focused Attacks deal +DR
  if (actionType === 'focused' && (actor.getFlag(SYSTEM_ID, 'attachedBonusActive') ?? false)) {
    const dr = actor.getFlag(SYSTEM_ID, 'armoredSoulDR') ?? 0;
    bonus += dr;
  }

  // Revenge Shield: next Focused Attack gets +Revenge
  if (actionType === 'focused') {
    const revenge = actor.getFlag(SYSTEM_ID, 'revengeAmount') ?? 0;
    if (revenge > 0) {
      actor.setFlag(SYSTEM_ID, 'revengeAmount', 0);
      bonus += revenge;
    }
  }

  return bonus;
}

/** Returns whether target's Unbreakable flag should downgrade Excellent → Good. */
export function checkUnbreakable(targetActor) {
  if (!targetActor) return false;
  return targetActor.getFlag(SYSTEM_ID, 'unbreakableActive') ?? false;
}
