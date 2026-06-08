// ============================================================
// STRYDER — Ranger Technique & Class Feature Handler
// ============================================================
// Techniques:
//   Backstep | Behemoth Hunter | Guiding Strike | Light and Surefooted
//   Practiced Form | Still Breaths | Trailing Shot | Vault
//
// Class Features (2026 rework):
//   Create Weakness (L1)    — Swift, arms effect; lands if next Focused
//                             attack inflicts a Wound (GM-confirm button)
//   Behemoth Slayer (L4)    — Wound thresholds 3 / 6 / 10
//   Exploit Weakness (L8)   — 4 STA, Resistance save, stronger effects
//   Behemoth Slayer II (L12)— Wound thresholds 15 / 21 (Deep Wounds)
//   Tyrant Executioner (L15)— Engagement Dash + double Focused Action
//
// Still Breaths +2 attack bonus is consumed in aspect-attack.mjs
//   via the 'stillBreathsActive' flag.
// Create Weakness pre-attack dialog + post-roll card are consumed in
//   aspect-attack.mjs via getCreateWeaknessForAttack / postCreateWeaknessResult.
// Practiced Form sets system.booleans.hasPracticedForm for jump calcs.
// ============================================================

const SYSTEM_ID = 'stryder';

// ── Shared card builder ────────────────────────────────────────
function rangerCard(title, body, actionTag = '') {
  return `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">${title}</div>
      <div class="chat-message-subtitle">
        <span class="aspect-label">Ranger</span>
        ${actionTag ? `<span style="color:rgba(150,190,230,0.4);margin:0 5px;">·</span><span style="color:rgba(180,210,255,0.65);font-size:10px;letter-spacing:1px;text-transform:uppercase;">${actionTag}</span>` : ''}
      </div>
    </div>
    <div class="chat-message-content" style="font-family:'Rajdhani',sans-serif;font-size:13px;color:rgba(210,230,255,0.85);">
      ${body}
    </div>
  </div>`;
}

// ── Stamina helper ─────────────────────────────────────────────
async function spendStamina(actor, amount) {
  const cur = actor.system.stamina?.value ?? 0;
  if (cur < amount) {
    ui.notifications.warn(`Not enough Stamina — need ${amount}, have ${cur}.`);
    return false;
  }
  await actor.update({ 'system.stamina.value': cur - amount });
  return true;
}

// ── Dispatcher ─────────────────────────────────────────────────
export const RANGER_TECH_NAMES = [
  'Backstep', 'Behemoth Hunter', 'Guiding Strike', 'Light and Surefooted',
  'Practiced Form', 'Still Breaths', 'Trailing Shot', 'Vault',
];

export async function handleRangerTechnique(item, actor, speaker, rollMode) {
  switch (item.name) {
    case 'Backstep':             return handleBackstep(item, actor, speaker, rollMode);
    case 'Behemoth Hunter':      return handleBehemothHunter(item, actor, speaker, rollMode);
    case 'Guiding Strike':       return handleGuidingStrike(item, actor, speaker, rollMode);
    case 'Light and Surefooted': return handleLightAndSurefooted(item, actor, speaker, rollMode);
    case 'Practiced Form':       return handlePracticedForm(item, actor, speaker, rollMode);
    case 'Still Breaths':        return handleStillBreaths(item, actor, speaker, rollMode);
    case 'Trailing Shot':        return handleTrailingShot(item, actor, speaker, rollMode);
    case 'Vault':                return handleVault(item, actor, speaker, rollMode);
    default:
      return ChatMessage.create({ speaker, rollMode,
        content: rangerCard(item.name, item.system.description ?? '') });
  }
}

// ── Backstep ───────────────────────────────────────────────────
// Trigger/Breach reaction — enemy enters 1 space, leap away. Spend 1 STA.
async function handleBackstep(item, actor, speaker, rollMode) {
  const ok = await spendStamina(actor, 1);
  if (!ok) return;
  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Backstep',
    `An enemy creature entered within 1 space of ${actor.name}.<br>
     <strong>Leap Action</strong> triggered — jump away to safety immediately.`,
    'Swift · Breach · Targeted'
  )});
}

// ── Behemoth Hunter ────────────────────────────────────────────
// Passive reminder — +2 damage to creatures 1+ Size larger.
async function handleBehemothHunter(item, actor, speaker, rollMode) {
  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Behemoth Hunter',
    `${actor.name} deals <strong>+2 additional damage</strong> to any creature that is at least <strong>1 Size larger</strong>.`,
    'Passive · Persistent'
  )});
}

// ── Guiding Strike ─────────────────────────────────────────────
// Swift — spend 1 STA, strengthen next Focused Attack.
// On Good+: next ally Attack vs same target gets +2 to roll.
async function handleGuidingStrike(item, actor, speaker, rollMode) {
  const ok = await spendStamina(actor, 1);
  if (!ok) return;

  const target = [...(game.user?.targets ?? [])][0];
  const targetName = target?.name ?? 'the target';

  await actor.setFlag(SYSTEM_ID, 'guidingStrikeActive', true);
  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Guiding Strike',
    `${actor.name} strengthens their next Focused Attack, leaving an opening for an ally.<br>
     On a roll of <strong>Good or Higher</strong>, the next Attack by a party member against <strong>${targetName}</strong> gains <strong>+2 to the Attack Roll</strong>.`,
    'Swift · Augment · Targeted'
  )});
}

// ── Light and Surefooted ───────────────────────────────────────
// Passive reminder — free movement on Dodge; free Evasion.
async function handleLightAndSurefooted(item, actor, speaker, rollMode) {
  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Light and Surefooted',
    `<strong>On Dodge:</strong> ${actor.name} may move 1 space in any direction for free (must be unoccupied).<br>
     ${actor.name} no longer needs to expend Movement to <strong>Evade</strong> any effect, regardless of magnitude.`,
    'Passive · Aid'
  )});
}

// ── Practiced Form ─────────────────────────────────────────────
// Passive — sets hasPracticedForm flag which the sheet uses for jump distance.
async function handlePracticedForm(item, actor, speaker, rollMode) {
  const already = actor.system.booleans?.hasPracticedForm ?? false;
  if (!already) {
    await actor.update({ 'system.booleans.hasPracticedForm': true });
  }
  const nim = actor.system.attributes?.talent?.nimbleness?.value ?? 0;
  const str = actor.system.attributes?.talent?.strength?.value ?? 0;
  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Practiced Form',
    `${actor.name} gains <strong>Climbing Expertise</strong> — can run across walls while Climbing, hands free.<br>
     <strong>Leap Action:</strong> adds <strong>${nim} Nimbleness</strong> to Vertical distance and <strong>${str} Strength</strong> to Horizontal distance.<br>
     <span style="font-size:11px;color:rgba(180,210,255,0.45);">Leap bonuses are now active on this sheet.</span>`,
    'Passive · Aid'
  )});
}

// ── Still Breaths ──────────────────────────────────────────────
// Swift — spend 1 STA, arm +2 to next Attack Roll (consumed in aspect-attack.mjs).
async function handleStillBreaths(item, actor, speaker, rollMode) {
  const ok = await spendStamina(actor, 1);
  if (!ok) return;
  await actor.setFlag(SYSTEM_ID, 'stillBreathsActive', true);
  ui.notifications.info(`${actor.name}: Still Breaths — next Attack Roll gains +2.`);
}

// ── Trailing Shot ──────────────────────────────────────────────
// Swift — spend 2 STA, arm reactive Quick Attack against a moving target.
async function handleTrailingShot(item, actor, speaker, rollMode) {
  const ok = await spendStamina(actor, 2);
  if (!ok) return;

  const target = [...(game.user?.targets ?? [])][0];
  const targetName = target?.name ?? 'a creature';

  await actor.setFlag(SYSTEM_ID, 'trailingShotTarget', targetName);
  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Trailing Shot',
    `${actor.name} has declared a reactive strike against <strong>${targetName}</strong>.<br>
     If ${targetName} uses <strong>Movement</strong>, immediately make a <strong>Quick Attack</strong>.<br>
     On a roll of <strong>7 or higher</strong>, ${targetName}'s Movement is reduced to <strong>0</strong> until the start of their next turn.`,
    'Swift · Targeted'
  )});
}

// ── Vault ──────────────────────────────────────────────────────
// Swift — move through enemy space (costs 1 extra Movement).
// Option: spend 1 STA for a Quick Attack while vaulting.
async function handleVault(item, actor, speaker, rollMode) {
  const target = [...(game.user?.targets ?? [])][0];
  const targetName = target?.name ?? 'a creature';

  const choice = await new Promise(resolve => {
    new Dialog({
      title: 'Vault',
      content: `<div style="padding:8px 0;font-family:'Rajdhani',sans-serif;color:rgba(180,210,255,0.85);font-size:13px;">
        <p style="margin:0 0 8px;">Move through <strong style="color:#e8c87a;">${targetName}</strong>'s space — costs <strong>1 extra Movement</strong>.</p>
        <p style="margin:0;color:rgba(150,190,230,0.6);font-size:12px;">Spend 1 Stamina to make a Quick Attack while vaulting?</p>
      </div>`,
      buttons: {
        attack: { label: '⚔ Quick Attack (1 STA)', callback: () => resolve('attack') },
        move:   { label: 'Move Only',              callback: () => resolve('move')   },
        cancel: { label: 'Cancel',                 callback: () => resolve(null)     },
      },
      default: 'attack',
    }, { width: 320, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });

  if (choice === null) return;

  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Vault',
    `${actor.name} vaults through <strong>${targetName}</strong>'s space (expends 1 extra Movement).${choice === 'attack' ? '<br><strong>Quick Attack</strong> incoming.' : ''}`,
    'Swift · Targeted'
  )});

  if (choice === 'attack') {
    const ok = await spendStamina(actor, 1);
    if (!ok) return;
    const { resolveFocusedAttack } = await import('../helpers/aspect-attack.mjs');
    return resolveFocusedAttack(actor, { speaker, rollMode, quick: true });
  }
}

// ============================================================
// RANGER CLASS FEATURES (2026 rework)
// ============================================================

export const RANGER_CLASS_FEATURE_NAMES = [
  'Create Weakness', 'Behemoth Slayer', 'Behemoth Slayer II',
  'Exploit Weakness', 'Tyrant Executioner',
];

export function isRangerClass(actor) {
  return (actor?.system?.class?.name ?? '') === 'Ranger';
}

export function hasRangerFeature(actor, name) {
  return !!actor?.items?.some(i => i.name === name);
}

// ── Create Weakness effect table ───────────────────────────────
export const CW_EFFECTS = {
  cripple:  { label: 'Cripple',  Good: '-2 Max Movement',     Excellent: '-5 Max Movement' },
  weaken:   { label: 'Weaken',   Good: '-1 to Attack Rolls',  Excellent: '-2 to Attack Rolls' },
  drain:    { label: 'Drain',    Good: '-1 Stamina',          Excellent: '-1 Stamina' },
  dispatch: { label: 'Dispatch', Good: '+3 additional damage', Excellent: '+5 additional damage',
              dmg: { Good: 3, Excellent: 5 } },
};

const EXPLOIT_EFFECTS = {
  cripple:  { label: 'Cripple',  text: 'The creature does not regain any Movement at the start of its next turn.' },
  weaken:   { label: 'Weaken',   text: 'The creature is unable to use its Focused Action on its next turn.' },
  drain:    { label: 'Drain',    text: 'The creature recovers only half its maximum Stamina at the start of its next turn.' },
  dispatch: { label: 'Dispatch', text: 'Deal an additional 12 damage.', dmg: 12 },
};

const MORTAL_ASPECTS = ['Brutality','Heroism','Vigilance','Destruction','Precision','Pain','Discipline','Resilience','Misdirection'];

// ── Wound helpers ──────────────────────────────────────────────
export function getTargetWoundCount(targetActor) {
  if (!targetActor || targetActor.type !== 'monster') return 0;
  const states  = targetActor.system.wounds?.states ?? [];
  const counted = states.filter(s => s > 0).length;
  const value   = parseInt(targetActor.system.wounds?.value ?? 0) || 0;
  return Math.max(counted, value);
}

// ── Behemoth Slayer benefit resolution ─────────────────────────
export function getBehemothSlayerBenefits(actor, targetActor) {
  const ownsBS  = hasRangerFeature(actor, 'Behemoth Slayer');
  const ownsBS2 = hasRangerFeature(actor, 'Behemoth Slayer II');
  const wounds  = getTargetWoundCount(targetActor);
  return {
    wounds,
    attackBonus:    (ownsBS  && wounds >= 3)  ? 1 : 0,
    guardReduction: (ownsBS  && wounds >= 6),
    twoEffects:     (ownsBS  && wounds >= 10),
    extraWound:     (ownsBS2 && wounds >= 15),
    deepWounds:     (ownsBS2 && wounds >= 21),
  };
}

// ── Create Weakness choice dialog ──────────────────────────────
// Returns array of effect keys (1, or 2 with Behemoth Slayer 10+), or null if skipped.
export async function promptCreateWeaknessChoice(actor, targetActor, { fromAttack = false } = {}) {
  const { twoEffects, wounds } = getBehemothSlayerBenefits(actor, targetActor);
  const maxPicks = twoEffects ? 2 : 1;

  const rows = Object.entries(CW_EFFECTS).map(([key, e]) => `
    <label class="cw-pick-row" style="display:flex;align-items:flex-start;gap:8px;padding:5px 8px;border-radius:4px;cursor:pointer;background:rgba(12,20,48,0.55);margin-bottom:3px;">
      <input type="checkbox" name="cw-effect" value="${key}" style="margin-top:2px;flex-shrink:0;">
      <span style="flex:1;">
        <strong style="color:#e8c87a;">${e.label}</strong><br>
        <span style="font-size:11px;color:rgba(150,190,230,0.7);">Good: ${e.Good} · Excellent: ${e.Excellent}</span>
      </span>
    </label>`).join('');

  return new Promise(resolve => {
    let resolved = false;
    const done = v => { if (!resolved) { resolved = true; resolve(v); } };
    new Dialog({
      title: 'Create Weakness',
      content: `<div style="padding:6px 0;font-family:'Rajdhani',sans-serif;color:rgba(180,210,255,0.85);font-size:13px;">
        <p style="margin:0 0 8px;">${fromAttack ? 'Use <strong>Create Weakness</strong> (Swift) with this Focused Attack?' : 'Choose the effect to arm.'}
        Pick <strong>${maxPicks === 2 ? 'up to two effects' : 'one effect'}</strong>${maxPicks === 2 ? ` <span style="color:#7de0b2;">(Behemoth Slayer — ${wounds} Wounds)</span>` : ''}.</p>
        <p style="margin:0 0 8px;font-size:11px;color:rgba(150,190,230,0.6);">The effect lands only if the attack inflicts a <strong>Wound</strong>. Strength is set by the attack's quality and lasts until the end of the next Challenger Phase.</p>
        ${rows}
      </div>`,
      buttons: {
        ok:   { label: '⚔ Confirm', callback: html => {
                  const picked = [...html[0].querySelectorAll('input[name="cw-effect"]:checked')].map(i => i.value).slice(0, maxPicks);
                  done(picked.length ? picked : null);
               }},
        skip: { label: fromAttack ? 'Attack Without It' : 'Cancel', callback: () => done(null) },
      },
      default: 'ok',
      close: () => done(null),
      render: html => {
        // Enforce max pick count
        html[0].querySelectorAll('input[name="cw-effect"]').forEach(cb => {
          cb.addEventListener('change', () => {
            const checked = html[0].querySelectorAll('input[name="cw-effect"]:checked');
            if (checked.length > maxPicks) cb.checked = false;
          });
        });
      },
    }, { width: 360, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });
}

// ── Pre-attack entry point (called from aspect-attack.mjs) ─────
// Returns array of armed effect keys or null. Consumes a pending Swift-armed
// flag first; otherwise offers the dialog.
export async function getCreateWeaknessForAttack(actor, targetActor) {
  if (!isRangerClass(actor)) return null;
  if (!hasRangerFeature(actor, 'Create Weakness')) return null;

  const pending = actor.getFlag(SYSTEM_ID, 'createWeaknessPending');
  if (pending?.effects?.length) {
    await actor.unsetFlag(SYSTEM_ID, 'createWeaknessPending');
    return pending.effects;
  }
  return promptCreateWeaknessChoice(actor, targetActor, { fromAttack: true });
}

// ── Post-roll result card (called from aspect-attack.mjs) ──────
// Posts the Create Weakness outcome with GM-confirm apply buttons.
// Dispatch damage is NOT folded into the attack automatically because the
// effect only lands if a Wound was inflicted — the GM confirms via button.
export async function postCreateWeaknessResult(actor, targetActor, effects, quality, { speaker, rollMode } = {}) {
  if (!effects?.length) return;

  const bs = getBehemothSlayerBenefits(actor, targetActor);
  const targetName = targetActor?.name ?? 'the target';

  if (quality === 'Poor') {
    await ChatMessage.create({ speaker, rollMode, content: rangerCard(
      'Create Weakness',
      `Attack quality was <strong style="color:#dc3545;">Poor</strong> — the armed effect${effects.length > 1 ? 's have' : ' has'} <strong>no strength</strong> and nothing is applied.`,
      'Swift · Targeted'
    )});
    return;
  }

  const lines = effects.map(key => {
    const e = CW_EFFECTS[key];
    if (!e) return '';
    const strength = e[quality];
    if (e.dmg) {
      // Dispatch — additional damage via the standard damage pipeline
      return `<div style="margin:6px 0;">
        <strong style="color:#e8c87a;">${e.label}</strong> — ${strength}
        <div class="damage-apply-container" style="margin:4px 0;text-align:center;">
          <button class="damage-apply-button cw-dispatch-button" data-damage="${e.dmg[quality]}" data-damage-type="physical" data-has-pierce="false" data-attacker-id="${actor.id}">
            Wound Confirmed — Apply <span style="color:#dc3545;font-weight:bold;">${e.dmg[quality]}</span> Additional Damage
          </button>
        </div></div>`;
    }
    return `<div style="margin:6px 0;">
      <strong style="color:#e8c87a;">${e.label}</strong> — ${strength}
      <div style="margin:4px 0;text-align:center;">
        <button class="cw-apply-button" data-effect="${key}" data-strength="${strength}" data-attacker-id="${actor.id}"
          style="background:linear-gradient(to bottom,#3d2e0e,#2a1f08);border:1px solid rgba(232,200,122,0.4);border-radius:4px;color:#e8c87a;padding:4px 12px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:12px;">
          Wound Confirmed — Apply ${e.label}
        </button>
      </div></div>`;
  }).join('');

  const riderLines = [];
  if (bs.guardReduction) riderLines.push(`<strong>6+ Wounds:</strong> as attack Leader, ${targetName}'s Guard is reduced by 1.`);
  if (bs.extraWound)     riderLines.push(`<strong>15+ Wounds:</strong> whenever you inflict a Wound, inflict <strong>one additional Wound</strong>.`);
  if (bs.deepWounds)     riderLines.push(`<strong>21+ Wounds:</strong> all Wounds you inflict are <strong>Deep Wounds</strong> — and all existing Wounds become Deep Wounds.
    <div style="margin:4px 0;text-align:center;"><button class="cw-grave-button"
      style="background:linear-gradient(to bottom,#3d0e0e,#2a0808);border:1px solid rgba(220,53,69,0.5);border-radius:4px;color:#ff8a8a;padding:4px 12px;cursor:pointer;font-family:'Rajdhani',sans-serif;font-size:12px;">
      Convert Selected Monster's Wounds → Deep</button></div>`);
  const riders = riderLines.length
    ? `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(80,110,200,0.25);font-size:11px;color:rgba(125,224,178,0.85);">${riderLines.map(l => `<div style="margin:3px 0;">${l}</div>`).join('')}</div>`
    : '';

  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Create Weakness',
    `Quality: <strong style="color:${quality === 'Excellent' ? '#ffd700' : '#5cb85c'};">${quality}</strong> vs <strong>${targetName}</strong>.<br>
     <span style="font-size:11px;color:rgba(150,190,230,0.6);">If the attack inflicted a Wound, confirm below — select the target's token first. Effects last until the end of the next Challenger Phase.</span>
     ${lines}${riders}`,
    'Swift · Targeted'
  )});
}

// ── Chat button: apply Cripple/Weaken/Drain to selected token ──
export async function handleCWApplyClick(event) {
  event.preventDefault();
  const btn = event.currentTarget;
  if (btn.dataset.cwApplied === 'true') return;
  const key      = btn.dataset.effect;
  const strength = btn.dataset.strength;
  const e = CW_EFFECTS[key];
  if (!e) return;

  const targets = canvas.tokens.controlled.map(t => t.actor).filter(Boolean);
  if (!targets.length) { ui.notifications.error('Select the target token first!'); return; }

  for (const targetActor of targets) {
    await targetActor.createEmbeddedDocuments('ActiveEffect', [{
      name: `${e.label} (Create Weakness)`,
      img: 'icons/svg/downgrade.svg',
      duration: { rounds: 1 },
      description: `<p><strong>${strength}</strong> — until the end of the next Challenger Phase.</p>`,
      flags: { stryder: { createWeakness: true, effectKey: key } },
    }]);
    await markCreateWeaknessHit(btn, targetActor);
    ui.notifications.info(`${targetActor.name}: ${e.label} (${strength}) applied.`);
  }

  btn.dataset.cwApplied = 'true';
  btn.disabled = true;
  btn.textContent = `${e.label} Applied`;
  btn.style.opacity = '0.5';
  btn.style.cursor = 'not-allowed';
}

// ── Chat button: flip all of selected monster's wounds to grave ──
export async function handleCWGraveClick(event) {
  event.preventDefault();
  const btn = event.currentTarget;
  const targets = canvas.tokens.controlled.map(t => t.actor).filter(a => a?.type === 'monster');
  if (!targets.length) { ui.notifications.error('Select the monster token first!'); return; }
  for (const monster of targets) {
    const max    = parseInt(monster.system.wounds?.max ?? 4);
    const raw    = monster.system.wounds?.states ?? [];
    const states = Array.from({ length: max }, (_, i) => (raw[i] ?? 0) > 0 ? 2 : 0);
    await monster.update({ 'system.wounds.states': states });
    ui.notifications.info(`${monster.name}: all existing Wounds are now Deep Wounds.`);
  }
  btn.disabled = true;
  btn.style.opacity = '0.5';
}

// ── Exploit Weakness eligibility marking ───────────────────────
// Records that the attacker dealt Create-Weakness damage to this target.
export async function markCreateWeaknessHit(btnOrNull, targetActor) {
  try {
    const msgEl = btnOrNull?.closest?.('[data-message-id]');
    const msg   = msgEl ? game.messages.get(msgEl.dataset.messageId) : null;
    const attackerId = btnOrNull?.dataset?.attackerId || msg?.speaker?.actor;
    const attacker = attackerId ? game.actors.get(attackerId) : null;
    if (!attacker || !targetActor) return;
    const marks = foundry.utils.deepClone(attacker.getFlag(SYSTEM_ID, 'createWeaknessMarks') ?? {});
    marks[targetActor.id] = true;
    await attacker.setFlag(SYSTEM_ID, 'createWeaknessMarks', marks);
  } catch (_) {}
}

// ── Class feature dispatcher ───────────────────────────────────
export async function handleRangerClassFeature(item, actor, speaker, rollMode) {
  switch (item.name) {
    case 'Create Weakness':    return handleCreateWeakness(item, actor, speaker, rollMode);
    case 'Behemoth Slayer':
    case 'Behemoth Slayer II': return handleBehemothSlayer(item, actor, speaker, rollMode);
    case 'Exploit Weakness':   return handleExploitWeakness(item, actor, speaker, rollMode);
    case 'Tyrant Executioner': return handleTyrantExecutioner(item, actor, speaker, rollMode);
    default:
      return ChatMessage.create({ speaker, rollMode,
        content: rangerCard(item.name, item.system.description ?? '') });
  }
}

// ── Create Weakness (Swift use — arms the next Focused Attack) ──
async function handleCreateWeakness(item, actor, speaker, rollMode) {
  const target = [...(game.user?.targets ?? [])][0];
  const effects = await promptCreateWeaknessChoice(actor, target?.actor ?? null, { fromAttack: false });
  if (!effects) return;

  await actor.setFlag(SYSTEM_ID, 'createWeaknessPending', { effects });
  const labels = effects.map(k => CW_EFFECTS[k]?.label).filter(Boolean).join(' + ');
  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Create Weakness',
    `${actor.name} studies their prey — <strong style="color:#e8c87a;">${labels}</strong> armed.<br>
     <span style="font-size:11px;color:rgba(150,190,230,0.6);">If the next Focused attack inflicts a Wound, the target is afflicted. Strength set by attack quality; lasts until the end of the next Challenger Phase.</span>`,
    'Swift · Targeted'
  )});
}

// ── Behemoth Slayer status card ────────────────────────────────
async function handleBehemothSlayer(item, actor, speaker, rollMode) {
  const target = [...(game.user?.targets ?? [])][0];
  const targetActor = target?.actor ?? null;
  const bs = getBehemothSlayerBenefits(actor, targetActor);
  const ownsBS2 = hasRangerFeature(actor, 'Behemoth Slayer II');

  const tier = (threshold, active, text) =>
    `<div style="margin:2px 0;${active ? 'color:#7de0b2;' : 'opacity:0.45;'}"><strong>${threshold}:</strong> ${text}${active ? ' ✦' : ''}</div>`;

  const body = targetActor
    ? `Target <strong>${targetActor.name}</strong> has <strong style="color:#e8c87a;">${bs.wounds} Wound${bs.wounds === 1 ? '' : 's'}</strong>.<br>` : 'No target selected — thresholds shown below.<br>';

  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    item.name,
    `${body}
     ${tier(3,  bs.attackBonus > 0,  '+1 to your Attack Rolls')}
     ${tier(6,  bs.guardReduction,   "As attack Leader, target's Guard is reduced by 1")}
     ${tier(10, bs.twoEffects,       'Create Weakness picks two effects instead of one')}
     ${ownsBS2 ? tier(15, bs.extraWound, 'Whenever you inflict a Wound, inflict one additional Wound') : ''}
     ${ownsBS2 ? tier(21, bs.deepWounds, 'All Wounds you inflict are Deep Wounds; existing Wounds become Deep') : ''}`,
    'Passive · Persistent'
  )});
}

// ── Exploit Weakness ───────────────────────────────────────────
async function handleExploitWeakness(item, actor, speaker, rollMode) {
  const target = [...(game.user?.targets ?? [])][0];
  const targetActor = target?.actor ?? null;

  // Eligibility: target must have been damaged by a Create Weakness attack
  const marks = actor.getFlag(SYSTEM_ID, 'createWeaknessMarks') ?? {};
  if (targetActor && !marks[targetActor.id]) {
    const proceed = await Dialog.confirm({
      title: 'Exploit Weakness',
      content: `<p>No confirmed Create Weakness damage recorded against <strong>${targetActor.name}</strong>. Use anyway?</p>`,
    });
    if (!proceed) return;
  }

  // Pick effect
  const choice = await new Promise(resolve => {
    let resolved = false;
    const done = v => { if (!resolved) { resolved = true; resolve(v); } };
    const rows = Object.entries(EXPLOIT_EFFECTS).map(([key, e]) => `
      <label style="display:flex;align-items:flex-start;gap:8px;padding:5px 8px;border-radius:4px;cursor:pointer;background:rgba(12,20,48,0.55);margin-bottom:3px;">
        <input type="radio" name="ew-effect" value="${key}" style="margin-top:2px;flex-shrink:0;">
        <span style="flex:1;"><strong style="color:#e8c87a;">${e.label}</strong><br>
        <span style="font-size:11px;color:rgba(150,190,230,0.7);">${e.text}</span></span>
      </label>`).join('');
    new Dialog({
      title: 'Exploit Weakness',
      content: `<div style="padding:6px 0;font-family:'Rajdhani',sans-serif;color:rgba(180,210,255,0.85);font-size:13px;">
        <p style="margin:0 0 8px;">Expend <strong>4 Stamina</strong>. Target rolls Resistance — on failure they suffer:</p>${rows}
      </div>`,
      buttons: {
        ok:     { label: '⚔ Confirm (4 STA)', callback: html => done(html[0].querySelector('input[name="ew-effect"]:checked')?.value ?? null) },
        cancel: { label: 'Cancel',            callback: () => done(null) },
      },
      default: 'ok',
      close: () => done(null),
    }, { width: 360, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });
  if (!choice) return;

  const ok = await spendStamina(actor, 4);
  if (!ok) return;

  // Resistance type from channeled Aspect
  const activeAspect = actor.getFlag(SYSTEM_ID, 'activeAspect') ?? '';
  const isMortal = MORTAL_ASPECTS.some(a => activeAspect.includes(a));
  const resType  = isMortal ? 'Physical' : 'Magykal';

  const e = EXPLOIT_EFFECTS[choice];
  const targetName = targetActor?.name ?? 'The target';
  const dmgBlock = e.dmg ? `
    <div class="damage-apply-container" style="margin:4px 0;text-align:center;">
      <button class="damage-apply-button" data-damage="${e.dmg}" data-damage-type="physical" data-has-pierce="false">
        Resistance Failed — Apply <span style="color:#dc3545;font-weight:bold;">${e.dmg}</span> Damage
      </button></div>` : '';

  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Exploit Weakness',
    `${actor.name} exploits the weakness of <strong>${targetName}</strong>!<br>
     <strong>${targetName}</strong> rolls <strong style="color:#e8c87a;">${resType} Resistance</strong>
     <span style="font-size:11px;color:rgba(150,190,230,0.6);">(channeling ${isMortal ? 'a Mortal' : 'an Immortal'} Aspect)</span>.<br>
     On failure — <strong style="color:#e8c87a;">${e.label}:</strong> ${e.text}${dmgBlock}`,
    'Focused · 4 Stamina'
  )});
}

// ── Tyrant Executioner ─────────────────────────────────────────
async function handleTyrantExecutioner(item, actor, speaker, rollMode) {
  const move = actor.system.attributes?.move?.running?.value ?? 7;
  await ChatMessage.create({ speaker, rollMode, content: rangerCard(
    'Tyrant Executioner',
    `At the start of the engagement, ${actor.name} <strong>Dashes ${move} spaces</strong> (maximum Movement).<br>
     If a target is within range of your Soul Armament when the Dash ends, you may use <strong>two Focused Actions</strong> this Round.<br>
     If you inflict a Wound this Round, your target gains <strong style="color:#e8c87a;">3 additional Wounds</strong>.`,
    'Passive'
  )});
}
