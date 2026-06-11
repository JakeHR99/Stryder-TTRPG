// ============================================================
// STRYDER — Wytch Class Handler
// ============================================================
// Hex Wielding: Swift, 2 Sta, once per Player Phase.
//   Target rolls Magykal Resistance (2d6+Will) vs Potency (2×Will).
//   On failure, inflict one Hex until start of next Player Phase.
//
// Focus & Remains (L4): Swift. Expend one component item.
//   Eyes: see through obstructions / ignore invisibility.
//   Bones: +1 Magykal Potency (flag: magykalPotencyBonus).
//   Mana-veins: gain 2 Stamina.
//   Hearts: choose any 2 other effects.
//
// The Wytch's Eye (L8): Focused, Limit 1. 20-Durability orb.
//   While active: no LoS needed within Armament reach.
//
// Hex Mastery (L15): first Hex per phase free; unlimited casts/phase.
// True Focus Over Remains (L15): d6 on use; 5–6 = component kept.
// ============================================================

const SYSTEM_ID = 'stryder';

// ── Detection ─────────────────────────────────────────────────
export function isWytchClass(actor) {
  if (!actor) return false;
  if ((actor.system?.class?.name ?? '') === 'Wytch') return true;
  return !!actor.items?.some?.(i => i.type === 'class' && i.name === 'Wytch');
}

// ── Phase / combat helpers ────────────────────────────────────

/**
 * Called at start of each new Player Phase:
 *   – clears per-phase cast counter on the Wytch
 *   – clears Focus & Remains bonus flags on the Wytch
 *   – sweeps ALL actors for target-side hex flags (Deny, Suffer, Enrage)
 */
export async function clearHexForPhase(wytchActor) {
  const wytchUpdates = {};
  for (const f of ['hexCountThisPhase', 'focusEyes', 'focusBones', 'focusManaVeins']) {
    if (wytchActor.getFlag(SYSTEM_ID, f) !== undefined)
      wytchUpdates[`flags.${SYSTEM_ID}.${f}`] = null;
  }
  if (Object.keys(wytchUpdates).length) await wytchActor.update(wytchUpdates);

  const targetFlags = ['hexDenied', 'sufferPenalty', 'hexEnraged'];
  for (const actor of game.actors) {
    const u = {};
    for (const f of targetFlags) {
      if (actor.getFlag(SYSTEM_ID, f)) u[`flags.${SYSTEM_ID}.${f}`] = null;
    }
    if (Object.keys(u).length) await actor.update(u);
  }
}

/**
 * Called at end of combat:
 *   – clears all Wytch transient flags (Eye, Focus, cast counter)
 *   – sweeps all actors for target-side hex flags
 */
export async function clearHexForCombatEnd(wytchActor) {
  const wytchFlags = [
    'hexCountThisPhase', 'wytchEyeDurability', 'wytchEyeUsed',
    'focusEyes', 'focusBones', 'focusManaVeins', 'magykalPotencyBonus',
  ];
  const u = {};
  for (const f of wytchFlags) {
    if (wytchActor.getFlag(SYSTEM_ID, f) !== undefined)
      u[`flags.${SYSTEM_ID}.${f}`] = null;
  }
  if (Object.keys(u).length) await wytchActor.update(u);

  const targetFlags = ['hexDenied', 'sufferPenalty', 'hexEnraged'];
  for (const actor of game.actors) {
    const tu = {};
    for (const f of targetFlags) {
      if (actor.getFlag(SYSTEM_ID, f)) tu[`flags.${SYSTEM_ID}.${f}`] = null;
    }
    if (Object.keys(tu).length) await actor.update(tu);
  }
}

// ── Card builder ───────────────────────────────────────────────
function wytchCard(title, subtitle, body) {
  const subRow = subtitle
    ? `<div class="chat-message-details">
         <div class="chat-message-detail-row">
           <span class="chat-message-detail-label">Action:</span>
           <span>${subtitle}</span>
         </div>
       </div>`
    : '';
  return `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">${title}</div>
      <div class="chat-message-subtitle">
        <span class="aspect-label aspect-label-wytch">Wytch</span>
      </div>
    </div>
    ${subRow}
    <div class="chat-message-content chat-content-rajdhani">
      ${body}
    </div>
  </div>`;
}

// ── Hex name constants ─────────────────────────────────────────
export const HEX_NAMES = [
  'Hex: Sicken', 'Hex: Bind',    'Hex: Deny',
  'Hex: Mutilate','Hex: Enrage', 'Hex: Panic',
  'Hex: Surge',  'Hex: Rise',    'Hex: Give',
  'Hex: Addle',  'Hex: Suffer',  'Hex: Delude',
];

// Short description per hex (used in resistance card)
const HEX_EFFECT_DESC = {
  'Sicken':  'Target becomes <strong>Staggered</strong>.',
  'Bind':    'Target becomes <strong>Stunned</strong>.',
  'Deny':    'Target cannot regain Health or close wounds until the start of the next Player Phase.',
  'Mutilate':'Target self-inflicts <strong>2 Bleeding Wounds</strong>.',
  'Enrage':  'Target must expend all Stamina attacking the nearest Party member next Challenger Phase.',
  'Panic':   'Target becomes <strong>Panicked</strong>.',
  'Surge':   'Force target to make a Focused Attack; target also loses <strong>4 HP</strong>.',
  'Rise':    'Force a Party Member to ignore Last Breaths restrictions; <strong>−5 Max HP</strong> (Spring of Life to restore).',
  'Give':    'Drain <strong>8 HP</strong> and <strong>4 Stamina</strong> from target. Drained Stamina → Wytch Mana (2:1).',
  'Addle':   'Target becomes <strong>Confused</strong>.',
  'Suffer':  'Pain racks target; <strong>−3</strong> to all their Attack Rolls.',
  'Delude':  'Target becomes <strong>Trapped</strong>.',
};

// ── Ability name list ──────────────────────────────────────────
export const WYTCH_ABILITY_NAMES = [
  'Hex Wielding',
  'Focus and Remains',
  "The Wytch's Eye",
  'Hex Mastery',
  'True Focus Over Remains',
  ...HEX_NAMES,
];

// ── Component item names (Focus & Remains) ─────────────────────
const COMPONENT_NAMES = ['Eyes', 'Bones', 'Mana-veins', 'Hearts'];

// ── Main dispatcher ────────────────────────────────────────────
export async function handleWytchAbility(item, actor, speaker, rollMode) {
  if (!actor) return ui.notifications.warn('No actor found.');

  switch (item.name) {
    case 'Hex Wielding':        return handleHexWielding(item, actor, speaker, rollMode);
    case 'Focus and Remains':   return handleFocusAndRemains(item, actor, speaker, rollMode);
    case "The Wytch's Eye":     return handleWytchsEye(item, actor, speaker, rollMode);
    default:
      // Hex items and passives: description card
      return ChatMessage.create({ speaker, rollMode, content: wytchCard(
        item.name,
        HEX_NAMES.includes(item.name) ? 'Hex' : 'Wytch Passive',
        item.system.description ?? '<p><em>No description.</em></p>'
      )});
  }
}

// ── Hex Wielding ───────────────────────────────────────────────
async function handleHexWielding(item, actor, speaker, rollMode) {
  // Mute gate
  const { isActorMuted } = await import('../conditions/mute.mjs');
  if (isActorMuted(actor)) {
    return ui.notifications.warn(`${actor.name} is Muted and cannot cast Hexes.`);
  }

  // Per-phase limit (lifted by Hex Mastery)
  const hasMastery  = actor.items.some(i => i.name === 'Hex Mastery');
  const hexCount    = actor.getFlag(SYSTEM_ID, 'hexCountThisPhase') ?? 0;
  if (!hasMastery && hexCount >= 1) {
    return ui.notifications.warn(`${actor.name} has already cast a Hex this Player Phase. (Hex Mastery lifts this limit.)`);
  }

  // Stamina cost: first cast free with Hex Mastery
  const staCost = (hasMastery && hexCount === 0) ? 0 : 2;
  if (staCost > 0) {
    const sta = actor.system.stamina?.value ?? 0;
    if (sta < staCost) {
      return ui.notifications.warn(`Not enough Stamina (need ${staCost}, have ${sta}).`);
    }
    await actor.update({ 'system.stamina.value': sta - staCost });
  }

  // Build picker from owned Hex: * items
  const ownedHexNames = HEX_NAMES.filter(n => actor.items.some(i => i.name === n));
  if (!ownedHexNames.length) {
    if (staCost > 0) {
      await actor.update({ 'system.stamina.value': (actor.system.stamina?.value ?? 0) + staCost });
    }
    return ui.notifications.warn(`${actor.name} has no Hex items — collect them from the Wytch compendium.`);
  }

  const chosenHex = await new Promise(resolve => {
    const buttons = {};
    for (const hexName of ownedHexNames) {
      const key    = hexName.replace(/\W/g, '').toLowerCase();
      const label  = hexName.replace('Hex: ', '');
      buttons[key] = { label, callback: () => resolve(hexName) };
    }
    buttons.cancel = { label: 'Cancel', callback: () => resolve(null) };
    new Dialog({
      title: 'Hex Wielding — Choose Hex',
      content: `<div class="dlg-rajdhani-pad"><p>Choose which Hex to inflict on the target:</p></div>`,
      buttons,
      default: Object.keys(buttons)[0],
    }, { width: 380, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });

  if (!chosenHex) {
    if (staCost > 0) {
      await actor.update({ 'system.stamina.value': (actor.system.stamina?.value ?? 0) + staCost });
    }
    return;
  }

  // Increment cast counter
  await actor.setFlag(SYSTEM_ID, 'hexCountThisPhase', hexCount + 1);

  // Wytch's Magykal Potency = 2 × Will + any bonus
  const willVal      = actor.system.abilities?.Will?.value ?? 0;
  const potencyBonus = actor.getFlag(SYSTEM_ID, 'magykalPotencyBonus') ?? 0;
  const potency      = (willVal * 2) + potencyBonus;
  const hexLabel     = chosenHex.replace('Hex: ', '');
  const staLabel     = staCost > 0 ? `${staCost} Stamina` : '0 Stamina (Hex Mastery)';

  await ChatMessage.create({ speaker, rollMode, content: wytchCard(
    `Hex Wielding — ${hexLabel}`,
    `Swift — ${staLabel}`,
    `${actor.name} weaves a hex and directs it at the target.
     <div class="chat-message-detail-row" style="margin-top:6px;">
       <span class="chat-message-detail-label">Effect:</span>
       <span>${HEX_EFFECT_DESC[hexLabel] ?? hexLabel}</span>
     </div>
     <div class="chat-message-detail-row">
       <span class="chat-message-detail-label">Target rolls:</span>
       <span>Magykal Resistance (2d6 + Will) vs Potency <strong>${potency}</strong></span>
     </div>
     <div class="chat-message-detail-row">
       <span class="chat-message-detail-label">GM:</span>
       <span>Select the target token, then click <em>Apply Hex</em> on a failed resist.</span>
     </div>
     <div class="sty-btn-row" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
       <button class="hex-apply-button sty-dlg-btn sty-dlg-btn-primary"
         data-caster-id="${actor.id}"
         data-hex-name="${chosenHex}">✦ Apply Hex</button>
       <button class="hex-resisted-button sty-dlg-btn sty-dlg-btn-muted"
         data-caster-id="${actor.id}"
         data-hex-name="${chosenHex}">Resisted</button>
     </div>
     <p class="chat-footnote">Hexes persist until the start of the next Player Phase.</p>`
  )});
}

// ── Focus and Remains ──────────────────────────────────────────
async function handleFocusAndRemains(item, actor, speaker, rollMode) {
  // Find owned component items
  const owned = COMPONENT_NAMES.filter(n => actor.items.some(i => i.name === n));
  if (!owned.length) {
    return ui.notifications.warn(`${actor.name} has no Remains components (Eyes, Bones, Mana-veins, Hearts).`);
  }

  const chosenComp = await new Promise(resolve => {
    const buttons = {};
    for (const comp of owned) {
      const key = comp.replace(/\W/g, '').toLowerCase();
      buttons[key] = { label: comp, callback: () => resolve(comp) };
    }
    buttons.cancel = { label: 'Cancel', callback: () => resolve(null) };
    new Dialog({
      title: 'Focus & Remains — Choose Component',
      content: `<div class="dlg-rajdhani-pad"><p>Expend a component. Effect lasts until end of Player Phase.</p></div>`,
      buttons,
      default: Object.keys(buttons)[0],
    }, { width: 320, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });

  if (!chosenComp) return;

  // True Focus Over Remains (L15): d6 5–6 = component not consumed
  let consumed = true;
  const hasTrueFocus = actor.items.some(i => i.name === 'True Focus Over Remains');
  if (hasTrueFocus) {
    const dieRoll = new Roll('1d6');
    await dieRoll.evaluate();
    consumed = dieRoll.total < 5;
    await dieRoll.toMessage({
      speaker,
      flavor: `<strong>${actor.name}</strong> — True Focus Over Remains (5–6 = component kept)`,
    });
  }

  if (consumed) {
    const compItem = actor.items.find(i => i.name === chosenComp);
    if (compItem) await compItem.delete();
  }

  let effectBody = '';
  switch (chosenComp) {
    case 'Eyes': {
      await actor.setFlag(SYSTEM_ID, 'focusEyes', true);
      effectBody = `${actor.name} gains <strong>sight through solid obstructions</strong> and ignores invisibility until the end of the Player Phase.`;
      break;
    }
    case 'Bones': {
      const cur = actor.getFlag(SYSTEM_ID, 'magykalPotencyBonus') ?? 0;
      await actor.setFlag(SYSTEM_ID, 'magykalPotencyBonus', cur + 1);
      await actor.setFlag(SYSTEM_ID, 'focusBones', true);
      effectBody = `${actor.name}'s <strong>Magykal Potency +1</strong> until the end of the Player Phase.`;
      break;
    }
    case 'Mana-veins': {
      const sta    = actor.system.stamina?.value ?? 0;
      const staMax = actor.system.stamina?.max   ?? 0;
      await actor.update({ 'system.stamina.value': Math.min(staMax, sta + 2) });
      await actor.setFlag(SYSTEM_ID, 'focusManaVeins', true);
      effectBody = `${actor.name} gains <strong>2 Stamina</strong>.`;
      break;
    }
    case 'Hearts': {
      // Hearts: choose any 2 other effects
      const others = ['Eyes', 'Bones', 'Mana-veins'];
      const picks = [];
      for (let i = 0; i < 2; i++) {
        const remaining = others.filter(o => !picks.includes(o));
        if (!remaining.length) break;
        const pick = await new Promise(resolve => {
          const btns = {};
          for (const o of remaining) {
            const k = o.replace(/\W/g, '').toLowerCase();
            btns[k] = { label: o, callback: () => resolve(o) };
          }
          new Dialog({
            title: `Hearts — Choose Effect ${i + 1} of 2`,
            content: `<div class="dlg-rajdhani-pad"><p>Choose a component effect:</p></div>`,
            buttons: btns,
            default: Object.keys(btns)[0],
          }, { width: 300, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
        });
        if (pick) picks.push(pick);
      }
      if (!picks.length) return;
      const lines = [];
      for (const p of picks) {
        switch (p) {
          case 'Eyes': {
            await actor.setFlag(SYSTEM_ID, 'focusEyes', true);
            lines.push('sight through obstructions / ignores invisibility');
            break;
          }
          case 'Bones': {
            const cur = actor.getFlag(SYSTEM_ID, 'magykalPotencyBonus') ?? 0;
            await actor.setFlag(SYSTEM_ID, 'magykalPotencyBonus', cur + 1);
            await actor.setFlag(SYSTEM_ID, 'focusBones', true);
            lines.push('Magykal Potency +1');
            break;
          }
          case 'Mana-veins': {
            const sta    = actor.system.stamina?.value ?? 0;
            const staMax = actor.system.stamina?.max   ?? 0;
            await actor.update({ 'system.stamina.value': Math.min(staMax, sta + 2) });
            await actor.setFlag(SYSTEM_ID, 'focusManaVeins', true);
            lines.push('+2 Stamina');
            break;
          }
        }
      }
      effectBody = `${actor.name} expends a Heart and gains: <strong>${lines.join(' &amp; ')}</strong>.`;
      break;
    }
  }

  const keptLine = !consumed
    ? `<p class="chat-footnote chat-gold-note">True Focus: component not consumed (rolled 5–6).</p>`
    : '';

  await ChatMessage.create({ speaker, rollMode, content: wytchCard(
    'Focus & Remains',
    `Swift — ${chosenComp} expended${consumed ? '' : ' (kept)'}`,
    `${effectBody}${keptLine}`
  )});
}

// ── The Wytch's Eye ────────────────────────────────────────────
async function handleWytchsEye(item, actor, speaker, rollMode) {
  const alreadyUsed = actor.getFlag(SYSTEM_ID, 'wytchEyeUsed');
  if (alreadyUsed) {
    // Eye is already active — show current durability
    const dur = actor.getFlag(SYSTEM_ID, 'wytchEyeDurability') ?? 0;
    return ui.notifications.info(`${actor.name}'s Wytch's Eye is already active (${dur} Durability remaining).`);
  }

  await actor.setFlag(SYSTEM_ID, 'wytchEyeUsed',       true);
  await actor.setFlag(SYSTEM_ID, 'wytchEyeDurability',  20);

  await ChatMessage.create({ speaker, rollMode, content: wytchCard(
    "The Wytch's Eye",
    'Focused — Limit 1',
    `An orb bearing the visage of ${actor.name}'s eye manifests 6 spaces above them, following their movement.
     <div class="chat-message-detail-row" style="margin-top:6px;">
       <span class="chat-message-detail-label">Durability:</span>
       <strong>20</strong>
     </div>
     <div class="chat-message-detail-row">
       <span class="chat-message-detail-label">Effect:</span>
       <span>No LoS required to target creatures with Hexes (within Armament reach).</span>
     </div>
     <div class="chat-message-detail-row">
       <span class="chat-message-detail-label">Duration:</span>
       <span>Until end of combat (or Durability reaches 0).</span>
     </div>
     <div style="margin-top:8px;">
       <button class="eye-damage-button sty-dlg-btn sty-dlg-btn-warn"
         data-actor-id="${actor.id}"
         data-amount="1">Damage Eye (−1 Durability)</button>
     </div>`
  )});
}

// ── Eye Damage button handler ──────────────────────────────────
export async function handleEyeDamageClick(event) {
  event.preventDefault();
  const btn     = event.currentTarget;
  const actorId = btn.dataset.actorId;
  const amount  = parseInt(btn.dataset.amount) || 1;
  const actor   = game.actors.get(actorId);
  if (!actor) return ui.notifications.warn('Actor not found.');

  const curDur = actor.getFlag(SYSTEM_ID, 'wytchEyeDurability') ?? 0;
  const newDur = Math.max(0, curDur - amount);
  await actor.setFlag(SYSTEM_ID, 'wytchEyeDurability', newDur);

  if (newDur <= 0) {
    await actor.unsetFlag(SYSTEM_ID, 'wytchEyeDurability');
    await actor.unsetFlag(SYSTEM_ID, 'wytchEyeUsed');
    await ChatMessage.create({ content: wytchCard(
      "The Wytch's Eye — Destroyed",
      null,
      `${actor.name}'s Eye has been destroyed (Durability 0). LoS requirement for Hexes is restored.`
    )});
  } else {
    ui.notifications.info(`${actor.name}'s Wytch's Eye: ${newDur} Durability remaining.`);
  }
}

// ── Hex Apply button handler ───────────────────────────────────
export async function handleHexApplyClick(event) {
  event.preventDefault();
  const btn      = event.currentTarget;
  const casterId = btn.dataset.casterId;
  const hexName  = btn.dataset.hexName;

  const casterActor = game.actors.get(casterId);
  if (!casterActor) return ui.notifications.warn('Caster actor not found.');

  const targetToken = canvas.tokens?.controlled[0];
  const targetActor = targetToken?.actor;
  if (!targetActor) {
    return ui.notifications.warn('No target selected — select the target\'s token on the canvas first.');
  }

  await applyHexEffect(hexName, casterActor, targetActor,
    ChatMessage.getSpeaker({ actor: casterActor }));
}

// ── Hex Resisted button handler ───────────────────────────────
export async function handleHexResistedClick(event) {
  event.preventDefault();
  const btn      = event.currentTarget;
  const hexName  = btn.dataset.hexName;
  const hexLabel = hexName.replace('Hex: ', '');
  await ChatMessage.create({ content: wytchCard(
    `Hex Resisted — ${hexLabel}`, null,
    `<em>The target succeeded on their Magykal Resistance check.</em>`
  )});
}

// ── Apply a specific hex to targetActor ───────────────────────
async function applyHexEffect(hexName, casterActor, targetActor, speaker) {
  const hexLabel = hexName.replace('Hex: ', '');

  async function postApplied(body) {
    await ChatMessage.create({ speaker, content: wytchCard(
      `Hex: ${hexLabel} — Applied`, null, body
    )});
  }

  switch (hexName) {

    // ── Condition hexes ──────────────────────────────────────
    case 'Hex: Sicken':
      await _createConditionEffect(targetActor, 'Staggered', 'staggered');
      await postApplied(`${targetActor.name} is <strong>Staggered</strong>.`);
      break;

    case 'Hex: Bind':
      await _createConditionEffect(targetActor, 'Stunned', 'stunned');
      await postApplied(`${targetActor.name} is <strong>Stunned</strong>.`);
      break;

    case 'Hex: Panic':
      await _createConditionEffect(targetActor, 'Panicked', 'panicked');
      await postApplied(`${targetActor.name} is <strong>Panicked</strong>.`);
      break;

    case 'Hex: Addle':
      await _createConditionEffect(targetActor, 'Confused', 'confused');
      await postApplied(`${targetActor.name} is <strong>Confused</strong>.`);
      break;

    case 'Hex: Delude':
      await _createConditionEffect(targetActor, 'Trapped', 'trapped');
      await postApplied(`${targetActor.name} is <strong>Trapped</strong>.`);
      break;

    // ── Deny ─────────────────────────────────────────────────
    case 'Hex: Deny':
      await targetActor.setFlag(SYSTEM_ID, 'hexDenied', true);
      await postApplied(`${targetActor.name} <strong>cannot regain Health or close wounds</strong> until the start of the next Player Phase.`);
      break;

    // ── Mutilate ─────────────────────────────────────────────
    case 'Hex: Mutilate':
      await _createConditionEffect(targetActor, 'Bleeding Wound', 'bleeding-wound');
      await _createConditionEffect(targetActor, 'Bleeding Wound', 'bleeding-wound');
      await postApplied(`${targetActor.name} self-inflicts <strong>2 Bleeding Wounds</strong>.`);
      break;

    // ── Enrage ────────────────────────────────────────────────
    case 'Hex: Enrage':
      await targetActor.setFlag(SYSTEM_ID, 'hexEnraged', true);
      await postApplied(`${targetActor.name} is <strong>Enraged</strong> — they must expend all Stamina attacking the nearest Party member during their next Challenger Phase.`);
      break;

    // ── Suffer ────────────────────────────────────────────────
    case 'Hex: Suffer':
      await targetActor.setFlag(SYSTEM_ID, 'sufferPenalty', 3);
      await postApplied(`${targetActor.name} suffers <strong>−3 to all Attack Rolls</strong> until the start of the next Player Phase.`);
      break;

    // ── Surge ─────────────────────────────────────────────────
    case 'Hex: Surge': {
      const curHP = targetActor.system.health?.value ?? 0;
      const newHP = Math.max(0, curHP - 4);
      await targetActor.update({ 'system.health.value': newHP });
      await postApplied(`${targetActor.name} is <strong>Surged</strong> — must make a Focused Attack against the nearest creature within reach and loses <strong>4 HP</strong> (${curHP} → ${newHP}).`);
      break;
    }

    // ── Rise ──────────────────────────────────────────────────
    case 'Hex: Rise': {
      // TARGET is an ally — their Max HP is reduced by 5 (Spring of Life to restore)
      const curMax   = targetActor.system.health?.max   ?? 0;
      const curHP    = targetActor.system.health?.value ?? 0;
      const newMax   = Math.max(1, curMax - 5);
      const curRise  = targetActor.getFlag(SYSTEM_ID, 'wytchRiseHealthReduction') ?? 0;
      await targetActor.update({
        'system.health.max':   newMax,
        'system.health.value': Math.min(curHP, newMax),
        [`flags.${SYSTEM_ID}.wytchRiseHealthReduction`]: curRise + 5,
      });
      await postApplied(`${targetActor.name} ignores Last Breaths restrictions for the engagement.<br>
        <strong>−5 Maximum HP</strong> (now ${newMax}). <span class="chat-footnote">Only restored by a Spring of Life.</span>`);
      break;
    }

    // ── Give ──────────────────────────────────────────────────
    case 'Hex: Give': {
      const tHP    = targetActor.system.health?.value   ?? 0;
      const tSta   = targetActor.system.stamina?.value  ?? 0;
      const dHP    = Math.min(tHP,  8);
      const dSta   = Math.min(tSta, 4);
      await targetActor.update({
        'system.health.value':  Math.max(0, tHP  - 8),
        'system.stamina.value': Math.max(0, tSta - 4),
      });
      // Drained stamina → caster mana at 2:1
      const manaGained = Math.floor(dSta / 2);
      if (manaGained > 0) {
        const cMana    = casterActor.system.mana?.value ?? 0;
        const cManaMax = casterActor.system.mana?.max   ?? 0;
        await casterActor.update({ 'system.mana.value': Math.min(cManaMax, cMana + manaGained) });
      }
      await postApplied(`${targetActor.name} is drained of <strong>${dHP} HP</strong> and <strong>${dSta} Stamina</strong>.<br>
        ${casterActor.name} gains <strong>${manaGained} Mana</strong> from the drained Stamina (${dSta} × ½).`);
      break;
    }

    default:
      await postApplied(`Hex "${hexName}" applied to ${targetActor.name}.`);
  }
}

// ── Condition effect helper ────────────────────────────────────
async function _createConditionEffect(actor, label, statusId) {
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    label,
    name:     label,
    icon:     `systems/stryder/assets/status/${statusId}.svg`,
    disabled: false,
    flags:    { stryder: { isHexEffect: true } },
  }]);
}
