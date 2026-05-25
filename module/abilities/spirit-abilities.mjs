// ============================================================
// STRYDER — Spirit Aspect Ability Handlers (Level 3)
// ============================================================

const SYSTEM_ID = 'stryder';

function btnStyle(color = '#1a2e1a') {
  return `style="width:100%;padding:5px 10px;margin-top:4px;background:${color};border:1px solid rgba(100,200,100,0.4);border-radius:4px;color:#c8f0c8;font-size:11px;cursor:pointer;font-family:inherit;text-align:left;"`;
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
export async function handleSpiritAbility(item, speaker, rollMode) {
  const actor = item.actor;
  if (!actor) return ui.notifications.warn("No actor found for this item.");

  // Deduct stamina cost
  const cost = item.system.stamina_cost ?? 0;
  if (cost > 0) {
    const cur = actor.system.resources?.stamina?.value ?? 0;
    if (cur < cost) return ui.notifications.warn(`Not enough Stamina! Need ${cost}, have ${cur}.`);
    await actor.update({ 'system.resources.stamina.value': cur - cost });
  }

  // Increment limit
  const limitMax = item.system.limit?.max ?? 0;
  if (limitMax > 0) {
    const limitVal = item.system.limit?.value ?? 0;
    if (limitVal >= limitMax) return ui.notifications.warn(`${item.name} has reached its limit of ${limitMax} uses!`);
    await item.update({ 'system.limit.value': limitVal + 1 });
  }

  switch (item.name) {
    case 'Hallowed-Arsenal':    return handleHallowedArsenal(item, actor, speaker);
    case 'Revitalize':          return handleRevitalize(item, actor, speaker);
    case 'Enhance Prowess':     return handleEnhanceProwess(item, actor, speaker);
    case 'Rapid Repair':        return handleRapidRepair(item, actor, speaker);
    case 'Life for a Life':     return handleLifeForALife(item, actor, speaker);
    case 'Undeath':             return handleUndeath(item, actor, speaker);
    case 'Ruin Mana':           return handleRuinMana(item, actor, speaker);
    case 'Healing Wave':        return handleHealingWave(item, actor, speaker);
    case 'Starwalker':          return handleStarwalker(item, actor, speaker);
    default:
      return ChatMessage.create({ speaker, rollMode,
        content: card(item.name, 'Spirit Ability', item.system.description ?? '') });
  }
}

// ── Hallowed-Arsenal ──────────────────────────────────────
async function handleHallowedArsenal(item, actor, speaker) {
  return new Promise(resolve => {
    new Dialog({
      title: 'Hallowed-Arsenal — Choose Mode',
      content: `<p style="margin-bottom:8px;">Choose your Soul Armament mode for this Player Phase:</p>
        <p><strong>⚔ Survival:</strong> Focused Attacks restore Health equal to [Soul] on hit.</p>
        <p><strong>💚 Restoration:</strong> Focused Attacks deal no damage — target regains Health equal to [Soul], you lose the same amount.</p>`,
      buttons: {
        survival: {
          label: '⚔ Survival Mode',
          callback: async () => {
            await actor.setFlag(SYSTEM_ID, 'hallowedArsenalMode', 'survival');
            await ChatMessage.create({ speaker, content: card('Hallowed-Arsenal', 'Passive · Survival Mode Active',
              `<p>${actor.name}'s Focused Attacks will restore <strong>${actor.system.abilities?.Soul?.value ?? 0} Health</strong> on hit this Phase.</p>`) });
            resolve();
          }
        },
        restoration: {
          label: '💚 Restoration Mode',
          callback: async () => {
            await actor.setFlag(SYSTEM_ID, 'hallowedArsenalMode', 'restoration');
            await ChatMessage.create({ speaker, content: card('Hallowed-Arsenal', 'Passive · Restoration Mode Active',
              `<p>${actor.name}'s Focused Attacks will deal <strong>no damage</strong> but heal the target for <strong>${actor.system.abilities?.Soul?.value ?? 0} Health</strong> this Phase.</p>`) });
            resolve();
          }
        }
      },
      default: 'survival'
    }).render(true);
  });
}

// ── Revitalize ────────────────────────────────────────────
async function handleRevitalize(item, actor, speaker) {
  const targets = [...game.user.targets];
  const targetActor = targets[0]?.actor;
  const targetId = targetActor?.id ?? '';
  const targetName = targetActor?.name ?? '⚠ No target selected — target a token first';

  await ChatMessage.create({ speaker, content:
    card('Revitalize', 'Swift Action · 1 Stamina (spent)',
      `<p>Remove a condition from <strong>${targetName}</strong>:</p>
      <button class="spirit-remove-condition" data-actor-id="${targetId}" data-condition="poison" ${btnStyle('#1a1a2e')}>🧪 Remove Poison</button>
      <button class="spirit-remove-condition" data-actor-id="${targetId}" data-condition="burning" ${btnStyle('#2e1a0a')}>🔥 Remove Burning</button>
      <button class="spirit-remove-condition" data-actor-id="${targetId}" data-condition="bleeding" ${btnStyle('#2e0a0a')}>🩸 Remove Bleeding Wounds</button>`)
  });
}

// ── Enhance Prowess ───────────────────────────────────────
async function handleEnhanceProwess(item, actor, speaker) {
  const soul = actor.system.abilities?.Soul?.value ?? 0;
  const targets = [...game.user.targets];
  const targetActor = targets[0]?.actor;
  if (!targetActor) return ui.notifications.warn("Target a token first!");

  const talents = ['Strength', 'Nimbleness', 'Finesse', 'Endurance'];
  const options = talents.map(t => `<option value="${t}">${t}</option>`).join('');

  return new Promise(resolve => {
    new Dialog({
      title: 'Enhance Prowess — Choose Talent',
      content: `<p>Raise one of <strong>${targetActor.name}</strong>'s Physical Talents by <strong>${soul}</strong> (max 5).</p>
        <select id="ep-talent" style="width:100%;margin-top:6px;">${options}</select>`,
      buttons: {
        apply: {
          label: 'Apply',
          callback: async (html) => {
            const chosen = html.find('#ep-talent').val();
            const current = targetActor.system.attributes?.talent?.[chosen]?.value ?? 0;
            const boosted = Math.min(5, current + soul);
            const effectData = [{
              name: `Enhance Prowess (${chosen})`,
              label: `Enhance Prowess (${chosen})`,
              icon: 'icons/svg/upgrade.svg',
              changes: [{ key: `system.attributes.talent.${chosen}.value`, mode: 5, value: boosted }],
              flags: { stryder: { isEnhanceProwess: true, talent: chosen } }
            }];
            await targetActor.createEmbeddedDocuments('ActiveEffect', effectData);
            await ChatMessage.create({ speaker, content: card('Enhance Prowess', 'Swift Action · 3 Stamina (spent)',
              `<p><strong>${targetActor.name}</strong>'s <strong>${chosen}</strong> raised by ${soul} (to ${boosted}) until end of Engagement.</p>
              <button class="spirit-remove-enhance" data-actor-id="${targetActor.id}" data-talent="${chosen}" ${btnStyle('#1a1a2e')}>↩ Remove Enhance Prowess (${chosen})</button>`) });
            resolve();
          }
        }
      },
      default: 'apply'
    }).render(true);
  });
}

// ── Rapid Repair ──────────────────────────────────────────
async function handleRapidRepair(item, actor, speaker) {
  return new Promise(resolve => {
    new Dialog({
      title: 'Rapid Repair — How much damage did you take?',
      content: `<div style="margin-top:6px;"><label>Damage taken:</label>
        <input id="rr-damage" type="number" min="1" value="1" style="width:100%;margin-top:4px;" /></div>`,
      buttons: {
        heal: {
          label: '💚 Heal',
          callback: async (html) => {
            const dmg = parseInt(html.find('#rr-damage').val()) || 0;
            const healAmt = Math.floor(dmg / 2);
            const curHP = actor.system.resources?.health?.value ?? 0;
            const maxHP = actor.system.resources?.health?.max ?? curHP;
            await actor.update({ 'system.resources.health.value': Math.min(maxHP, curHP + healAmt) });
            await ChatMessage.create({ speaker, content: card('Rapid Repair', 'Trigger · 1 Stamina (spent)',
              `<p>${actor.name} took <strong>${dmg}</strong> damage and rapidly repaired for <strong>${healAmt} Health</strong>.</p>`) });
            resolve();
          }
        }
      },
      default: 'heal'
    }).render(true);
  });
}

// ── Life for a Life ───────────────────────────────────────
async function handleLifeForALife(item, actor, speaker) {
  return new Promise(resolve => {
    new Dialog({
      title: 'Life for a Life — Choose self-damage',
      content: `<p>Choose how much damage to take. That amount is added to your next Survival Mode Focused Attack.</p>
        <input id="lfl-damage" type="number" min="1" value="1" style="width:100%;margin-top:6px;" />`,
      buttons: {
        confirm: {
          label: '💀 Take Damage',
          callback: async (html) => {
            const dmg = parseInt(html.find('#lfl-damage').val()) || 0;
            const curHP = actor.system.resources?.health?.value ?? 0;
            await actor.update({ 'system.resources.health.value': Math.max(0, curHP - dmg) });
            await actor.setFlag(SYSTEM_ID, 'lifeForALifeBonus', dmg);
            await ChatMessage.create({ speaker, content: card('Life for a Life', 'Swift Action · 2 Stamina (spent)',
              `<p>${actor.name} took <strong>${dmg}</strong> self-damage. Next Survival Mode Focused Attack deals <strong>+${dmg}</strong> bonus damage.</p>`) });
            resolve();
          }
        }
      },
      default: 'confirm'
    }).render(true);
  });
}

// ── Undeath ───────────────────────────────────────────────
async function handleUndeath(item, actor, speaker) {
  const targets = [...game.user.targets];
  const targetActor = targets[0]?.actor;
  if (!targetActor) return ui.notifications.warn("Target a token first!");
  const soulLimit = (actor.system.abilities?.Soul?.value ?? 0) * 3;

  await targetActor.setFlag(SYSTEM_ID, 'undeathActive', true);
  await targetActor.setFlag(SYSTEM_ID, 'undeathLimit', soulLimit);

  await ChatMessage.create({ speaker, content: card('Undeath', 'Trigger · 3 Stamina (spent)',
    `<p><strong>${targetActor.name}</strong> is protected by Undeath. Their Health can go into negatives up to <strong>−${soulLimit}</strong>.</p>
    <p style="font-size:11px;opacity:0.7;">If they reach −${soulLimit} HP they die without Last Breaths. On engagement exit their HP is set to 1 and Max HP is permanently reduced by half the negative amount.</p>
    <button class="spirit-resolve-undeath" data-actor-id="${targetActor.id}" data-soul-limit="${soulLimit}" ${btnStyle('#1a1a2e')}>⚰ Resolve Undeath (end of engagement)</button>`) });
}

// ── Ruin Mana ─────────────────────────────────────────────
async function handleRuinMana(item, actor, speaker) {
  await ChatMessage.create({ speaker, content:
    card('Ruin Mana', 'Trigger · 3 Stamina (spent)',
      `<p>You attempt to cancel a triggering ability. Both you and the target roll 2d6.</p>
      <button class="spirit-ruin-mana-roll" data-actor-id="${actor.id}" data-actor-name="${actor.name}" ${btnStyle('#1a1a2e')}>🎲 Roll Counter (2d6)</button>`)
  });
}

// ── Healing Wave ──────────────────────────────────────────
async function handleHealingWave(item, actor, speaker) {
  const soul = actor.system.abilities?.Soul?.value ?? 0;
  const healAmt = soul + 3;
  const targets = [...game.user.targets];
  const targetButtons = targets.length
    ? targets.map(t => `<button class="spirit-heal-apply" data-actor-id="${t.actor?.id}" data-amount="${healAmt}" ${btnStyle()}>💚 Heal ${t.actor?.name ?? 'target'} for ${healAmt}</button>`).join('')
    : `<p style="opacity:0.7;">Target tokens before clicking — or use button below for each target.</p>`;

  await ChatMessage.create({ speaker, content:
    card('Healing Wave', 'Focused Action · 6 Stamina (spent)',
      `<p>Heals all chosen creatures within range for <strong>${healAmt}</strong> (Soul ${soul} + 3).</p>${targetButtons}`)
  });
}

// ── Starwalker ────────────────────────────────────────────
async function handleStarwalker(item, actor, speaker) {
  const soul = actor.system.abilities?.Soul?.value ?? 0;
  const targets = [...game.user.targets];
  const targetActor = targets[0]?.actor;

  return new Promise(resolve => {
    new Dialog({
      title: 'Starwalker — Choose Expenditure',
      content: `<p>Target: <strong>${targetActor?.name ?? 'None selected'}</strong></p>
        <div style="margin-top:8px;">
          <label>Stamina to spend (1–3, already deducted base cost):</label>
          <input id="sw-stamina" type="number" min="1" max="3" value="1" style="width:100%;margin-top:4px;" />
        </div>
        <div style="margin-top:8px;">
          <label>Mana to spend:</label>
          <input id="sw-mana" type="number" min="1" value="1" style="width:100%;margin-top:4px;" />
        </div>`,
      buttons: {
        apply: {
          label: '✨ Apply',
          callback: async (html) => {
            const staminaSpent = Math.min(3, Math.max(1, parseInt(html.find('#sw-stamina').val()) || 1));
            const manaSpent = Math.max(1, parseInt(html.find('#sw-mana').val()) || 1);
            const healAmt = soul * staminaSpent;
            const atkBonus = soul + manaSpent;

            // Deduct additional stamina + mana
            const extraStamina = staminaSpent - 1; // base 1 already deducted
            const curSt = actor.system.resources?.stamina?.value ?? 0;
            const curMn = actor.system.resources?.mana?.value ?? 0;
            if (curSt < extraStamina) return ui.notifications.warn("Not enough Stamina!");
            if (curMn < manaSpent) return ui.notifications.warn("Not enough Mana!");
            await actor.update({
              'system.resources.stamina.value': curSt - extraStamina,
              'system.resources.mana.value': curMn - manaSpent
            });

            // Heal target + store attack buff + cleanse conditions
            if (targetActor) {
              const curHP = targetActor.system.resources?.health?.value ?? 0;
              const maxHP = targetActor.system.resources?.health?.max ?? curHP;
              await targetActor.update({ 'system.resources.health.value': Math.min(maxHP, curHP + healAmt) });
              await targetActor.setFlag(SYSTEM_ID, 'starwalkerAtkBonus', atkBonus);
              // Cleanse harmful conditions
              const harmful = ['Poisoned','Burning','Bleeding Wound','Blinded','Confused','Frozen','Panicked','Horrified','Shocked','Stunned','Senseless','Mute','Haggard','Exhausted'];
              const toRemove = targetActor.effects.filter(e => harmful.some(h => (e.name ?? e.label ?? '').includes(h))).map(e => e.id);
              if (toRemove.length) await targetActor.deleteEmbeddedDocuments('ActiveEffect', toRemove);
            }

            await ChatMessage.create({ speaker, content: card('Starwalker', `${staminaSpent} Stamina · ${manaSpent} Mana (spent)`,
              `<p><strong>${targetActor?.name ?? 'Target'}</strong> healed for <strong>${healAmt}</strong> (Soul ${soul} × ${staminaSpent} Stamina).</p>
              <p>Their next Focused Attack deals <strong>+${atkBonus}</strong> bonus damage (Soul ${soul} + ${manaSpent} Mana).</p>
              <p>All Harmful Conditions cleansed.</p>`) });
            resolve();
          }
        }
      },
      default: 'apply'
    }).render(true);
  });
}

// ── Hallowed-Arsenal skill roll hook ─────────────────────
// Called from item.mjs after a skill attack resolves
export async function applyHallowedArsenalEffect(actor, targetActor, totalDamage, quality) {
  const mode = actor.getFlag(SYSTEM_ID, 'hallowedArsenalMode');
  if (!mode) return { modifiedDamage: totalDamage, skipDamage: false };

  const soul = actor.system.abilities?.Soul?.value ?? 0;
  const hasAttachedEffect = actor.items.some(i => i.name === 'Attached Effect' && i.type === 'action');
  const healBonus = hasAttachedEffect ? 2 : 0;
  const speaker = ChatMessage.getSpeaker({ actor });

  if (mode === 'survival' && quality !== 'Poor') {
    const healAmt = soul + healBonus;
    const curHP = actor.system.resources?.health?.value ?? 0;
    const maxHP = actor.system.resources?.health?.max ?? curHP;
    await actor.update({ 'system.resources.health.value': Math.min(maxHP, curHP + healAmt) });
    const lifeBonus = actor.getFlag(SYSTEM_ID, 'lifeForALifeBonus') ?? 0;
    if (lifeBonus > 0) {
      await actor.setFlag(SYSTEM_ID, 'lifeForALifeBonus', 0);
    }
    await ChatMessage.create({ speaker, content:
      `<div class="damage-quality good"><strong>Hallowed-Arsenal (Survival):</strong> ${actor.name} restored <strong>${healAmt} Health</strong>.${lifeBonus > 0 ? ` (+${lifeBonus} Life for a Life bonus applied to damage)` : ''}</div>` });
    return { modifiedDamage: totalDamage + lifeBonus, skipDamage: false };
  }

  if (mode === 'restoration' && quality !== 'Poor') {
    const healAmt = soul;
    if (targetActor) {
      const curHP = targetActor.system.resources?.health?.value ?? 0;
      const maxHP = targetActor.system.resources?.health?.max ?? curHP;
      await targetActor.update({ 'system.resources.health.value': Math.min(maxHP, curHP + healAmt) });
    }
    const selfHP = actor.system.resources?.health?.value ?? 0;
    await actor.update({ 'system.resources.health.value': Math.max(0, selfHP - healAmt) });
    await ChatMessage.create({ speaker, content:
      `<div class="damage-quality good"><strong>Hallowed-Arsenal (Restoration):</strong> ${targetActor?.name ?? 'Target'} restored <strong>${healAmt} Health</strong>. ${actor.name} took ${healAmt} self-damage.</div>` });
    return { modifiedDamage: 0, skipDamage: true };
  }

  return { modifiedDamage: totalDamage, skipDamage: false };
}

// Starwalker attack bonus hook — call from skill roll
export function getStarwalkerBonus(actor) {
  const bonus = actor.getFlag(SYSTEM_ID, 'starwalkerAtkBonus') ?? 0;
  if (bonus > 0) actor.setFlag(SYSTEM_ID, 'starwalkerAtkBonus', 0);
  return bonus;
}
