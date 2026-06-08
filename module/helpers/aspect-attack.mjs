// ============================================================
// STRYDER — Aspect Attack Resolver
// ============================================================
// Handles three attack scenarios:
//   1. resolveAspectAttack  — Aspect skill item (e.g. Master Cut)
//   2. resolveFocusedAttack — Baked-in Focused Attack button (single)
//   3. resolveTwinAttack    — Dual Wield twin attack (two rolls, one message)
//
// Shared pipeline: SA context → attack bonus → roll → quality →
//   damage → hooks (Hallowed-Arsenal / Resilience / Unbreakable) → chat
// ============================================================

// ── Aspect name lookup ───────────────────────────────────────
const ASPECT_PREFIX = {
  HersmAbil: 'Heroism',   BrtalAbil: 'Brutality',  VglncAbil: 'Vigilance',
  DstrcAbil: 'Destruction', PrcsAbil: 'Precision', PainAbil:  'Pain',
  DscplAbil: 'Discipline', RslncAbil: 'Resilience', MsdrcAbil: 'Misdirection',
  CntrlAbil: 'Control',  DmensAbil: 'Dimensions',  ElmntAbil: 'Elementalism',
  MindAbil:  'Mind',     PowrAbil:  'Power',        SpritAbil: 'Spirit',
  RsonAbil:  'Resonance', TimeAbil: 'Time',
};

function getAspectName(item) {
  if (!item) return '';
  const flag = item.flags?.stryder?.aspectName;
  if (flag) return flag;
  const id = item._id ?? item.id ?? '';
  for (const [prefix, name] of Object.entries(ASPECT_PREFIX)) {
    if (id.startsWith(prefix)) return name;
  }
  return '';
}

// ── Soul Armament helpers ────────────────────────────────────
const FORM_LABELS  = { one_handed:'One-Handed', two_handed:'Two-Handed', dual_wield:'Dual Wield', attached:'Attached', ingrained:'Ingrained' };
const RANGE_LABELS = { range1:'1m', range2:'2m', range5:'5m', range8:'8m' };
const TEMPER_LABELS = { basic:'Basic', keen:'Keen', heavy:'Heavy' };

function saFormLabel(form) {
  if (!form) return 'Basic';
  const active = Object.entries(form).filter(([k,v]) => v && FORM_LABELS[k]).map(([k]) => FORM_LABELS[k]);
  return active.join(' / ') || 'Basic';
}

// ── Shared: read SA context from actor ──────────────────────
function getSAContext(actor) {
  const sa       = actor.system.soul_armament ?? {};
  return {
    sa,
    saName:     sa.name || 'Soul Armament',
    saTemper:   sa.temper ?? 'basic',
    weaponWC:   parseInt(sa.weaponWeightClass) || 1,
    saForm:     saFormLabel(sa.form),
    saRange:    RANGE_LABELS[sa.range ?? 'range1'] ?? '1m',
    temperDisp: TEMPER_LABELS[sa.temper ?? 'basic'] ?? (sa.temper ?? 'basic'),
  };
}

// ── Shared: build total attack bonus ────────────────────────
function getAttackBonus(actor, { saTemper, weaponWC, methodAtkMod = 0 } = {}) {
  const mastery    = actor.system.attributes?.mastery ?? 0;
  const augAtkBonus= actor.getFlag?.('stryder', 'augAttackBonus') ?? 0;

  let temperBonus = 0;
  if (saTemper === 'keen') {
    temperBonus = 1;
  } else if (saTemper === 'heavy') {
    const str = actor.system.attributes?.talent?.strength?.value ?? 0;
    temperBonus = -Math.max(0, weaponWC - str);
  }

  return { mastery, augAtkBonus, temperBonus, methodAtkMod,
           total: mastery + augAtkBonus + temperBonus + methodAtkMod };
}

// ── Shared: build roll formula ───────────────────────────────
function buildFormula(bonus) {
  let f = '2d6';
  if (bonus > 0) f += `+${bonus}`;
  else if (bonus < 0) f += `${bonus}`;
  return f;
}

// ── Shared: resolve quality from roll total ──────────────────
function resolveQuality(result, actor, augDoubleDmg) {
  const augExcl12  = actor.getFlag?.('stryder', 'augExcellentRange1012') ?? false;
  const augPoorOvr = actor.getFlag?.('stryder', 'augPoorRangeOverride')  ?? null;
  const poorThresh = augPoorOvr !== null ? augPoorOvr : 4;
  const exclThresh = augExcl12 ? 10 : 11;
  if (result <= poorThresh) return { quality:'Poor',      multiplier:0.5 };
  if (result >= exclThresh) return { quality:'Excellent', multiplier: augDoubleDmg ? 3.0 : 1.5 };
  return                           { quality:'Good',      multiplier:1.0 };
}

// ── Shared: calc damage from Soul stat ──────────────────────
function calcDamage(soulVal, multiplier, quality, damageMod = 0) {
  const base = soulVal + damageMod;
  return quality === 'Excellent' ? Math.ceil(base * multiplier) : Math.floor(base * multiplier);
}

// ── Shared: HTML helpers ─────────────────────────────────────
const Q_COLOR = { Poor:'#dc3545', Good:'#5cb85c', Excellent:'#ffd700' };

function tagHTML(t) {
  return t ? `<span class="chat-message-tag">${t.toUpperCase()}</span>` : '';
}

function dmgBtn(damage, type = 'physical', pierce = false) {
  return `<div class="damage-apply-container" style="margin:4px 0;text-align:center;">
    <button class="damage-apply-button" data-damage="${damage}" data-damage-type="${type}" data-has-pierce="${pierce}">
      Apply <span style="color:#dc3545;font-weight:bold;">${damage}</span> Damage
    </button></div>`;
}

// Builds the "Soul X × M = Y" sub-label shown under damage totals
function dmgFormula(soulVal, multiplier, quality, flatBonus = 0) {
  const multLabel = quality === 'Excellent' ? '×1.5' : quality === 'Poor' ? '×0.5' : '×1';
  const base = quality === 'Excellent' ? `⌈Soul ${soulVal} ${multLabel}⌉` : `⌊Soul ${soulVal} ${multLabel}⌋`;
  return flatBonus !== 0
    ? `${base} ${flatBonus > 0 ? '+' : ''}${flatBonus} bonus`
    : base;
}

// ── Shared: run post-damage hooks ────────────────────────────
async function runDamageHooks(actor, targetActor, totalDamage, quality, actionType, speaker, rollMode) {
  let dmg = totalDamage;
  try {
    const { applyHallowedArsenalEffect, getStarwalkerBonus } = await import('../abilities/spirit-abilities.mjs');
    const hRes = await applyHallowedArsenalEffect(actor, targetActor, dmg, quality);
    dmg = hRes.modifiedDamage;
    if (hRes.skipDamage) return { damage: dmg, skip: true };
    const sw = getStarwalkerBonus(actor);
    if (sw > 0) dmg += sw;
  } catch(_) {}
  try {
    const { getResilienceDamageBonus } = await import('../abilities/resilience-abilities.mjs');
    const res = getResilienceDamageBonus(actor, actionType);
    if (res > 0) {
      dmg += res;
      await ChatMessage.create({ speaker, rollMode,
        content:`<div class="damage-quality good"><strong>Resilience Bonus:</strong> +${res} damage.</div>` });
    }
  } catch(_) {}
  return { damage: dmg, skip: false };
}

// ── Shared: Unbreakable check ────────────────────────────────
async function checkUnbreakableDowngrade(quality, multiplier, targetActor, speaker, rollMode) {
  if (quality !== 'Excellent') return { quality, multiplier };
  try {
    const { checkUnbreakable } = await import('../abilities/resilience-abilities.mjs');
    if (checkUnbreakable(targetActor)) {
      await ChatMessage.create({ speaker, rollMode,
        content:`<div class="damage-quality good">🛡 <strong>Unbreakable:</strong> ${targetActor?.name}'s Unbreakable downgrades Excellent to Good.</div>` });
      return { quality:'Good', multiplier:1.0 };
    }
  } catch(_) {}
  return { quality, multiplier };
}

// ============================================================
// 1. resolveAspectAttack — Aspect skill item
// ============================================================
export async function resolveAspectAttack(item, actor, { speaker, rollMode, methodResult = null } = {}) {
  const { sa, saName, saTemper, weaponWC, saForm, saRange, temperDisp } = getSAContext(actor);
  const augDoubleDmg = actor.getFlag?.('stryder', 'augDoubleExcellentDamage') ?? false;

  // Brutality next-attack modifiers
  const brutalMods = (actor.getFlag?.('stryder', 'activeAspect') ?? '').includes('Brutality')
    ? await applyBrutalityModifiers(actor, item, methodResult?.damageMod ?? 0)
    : { damageMod: methodResult?.damageMod ?? 0, inflictPanicked: false, extraIchorOnHit: 0, bonusLabel: [] };

  // Warlock modifiers (Scarlet Strike, Sanguine Ichor, Crimson Crown)
  let warlockAtkBonus = 0;
  try {
    const wl = await import('../abilities/warlock-abilities.mjs');
    if (wl.isWarlock(actor)) {
      const isFocusedAtk = (item.system.action_type ?? 'focused') === 'focused';
      const wmods = await wl.applyWarlockAttackMods(actor, isFocusedAtk);
      brutalMods.damageMod += wmods.damageMod;
      brutalMods.bonusLabel.push(...wmods.labels);
      warlockAtkBonus = wmods.attackMod;
    }
  } catch (_) {}

  // Still Breaths — consume +2 attack bonus flag if armed
  const stillBreathsBonus = actor.getFlag?.('stryder', 'stillBreathsActive') ? 2 : 0;
  if (stillBreathsBonus) await actor.unsetFlag?.('stryder', 'stillBreathsActive');

  const target = [...(game.user?.targets ?? [])][0];
  const targetActor = target?.actor ?? null;

  // Ranger — Behemoth Slayer attack bonus + Create Weakness offer (Focused attacks only)
  let ranger = null, cwEffects = null, behemothBonus = 0;
  try {
    ranger = await import('../abilities/ranger-abilities.mjs');
    if (ranger.isRangerClass(actor)) {
      behemothBonus = ranger.getBehemothSlayerBenefits(actor, targetActor).attackBonus;
      if (item.system.action_type === 'focused')
        cwEffects = await ranger.getCreateWeaknessForAttack(actor, targetActor);
    }
  } catch(_) {}

  const bonus = getAttackBonus(actor, { saTemper, weaponWC, methodAtkMod: (methodResult?.attackMod ?? 0) + stillBreathsBonus + warlockAtkBonus + behemothBonus });
  const formula = buildFormula(bonus.total);
  const roll = new Roll(formula);
  await roll.evaluate({ async: true });

  let { quality, multiplier } = resolveQuality(roll.total, actor, augDoubleDmg);
  ({ quality, multiplier } = await checkUnbreakableDowngrade(quality, multiplier, targetActor, speaker, rollMode));

  const soulVal = actor.system.abilities?.Soul?.value ?? 0;
  let totalDamage = calcDamage(soulVal, multiplier, quality, brutalMods.damageMod);
  if (saTemper === 'heavy' && item.system.action_type === 'focused') totalDamage += Math.max(0, weaponWC - 2);

  // Spirit Armament (Shaman) — add Lordling's Spirit to Focused Attack damage and decrement rounds
  const spiritArm = actor.getFlag?.('stryder', 'spiritArmamentActive');
  if (spiritArm?.spiritVal && item.system.action_type === 'focused') {
    totalDamage += spiritArm.spiritVal;
    const newRounds = (spiritArm.roundsLeft ?? 1) - 1;
    if (newRounds <= 0) {
      await actor.unsetFlag?.('stryder', 'spiritArmamentActive');
      ui.notifications.info(`${actor.name}: Spirit Armament has ended.`);
    } else {
      await actor.setFlag?.('stryder', 'spiritArmamentActive', { ...spiritArm, roundsLeft: newRounds });
    }
  }

  const hookResult = await runDamageHooks(actor, targetActor, totalDamage, quality, item.system.action_type, speaker, rollMode);
  if (hookResult.skip) return roll;
  totalDamage = hookResult.damage;

  // Build flavor
  const aspectName = getAspectName(item);
  const tags = [item.system.tag1, item.system.tag2, item.system.tag3].filter(Boolean).map(tagHTML).join('');
  const actionLabel = { swift:'Swift', focused:'Focused', trigger:'Trigger', passive:'Passive' }[item.system.action_type] ?? '';
  const costParts = [];
  if ((item.system.mana_cost ?? 0) > 0)    costParts.push(`${item.system.mana_cost} mana`);
  if ((item.system.stamina_cost ?? 0) > 0)  costParts.push(`${item.system.stamina_cost} stamina`);
  if (item.system.other_restrictions)       costParts.push(item.system.other_restrictions);

  const methodHTML = methodResult ? `
    <div class="chat-method-block">
      <span class="chat-method-key">${methodResult.key}</span>
      ${methodResult.attackMod !== 0 ? `<span class="chat-method-mod">${methodResult.attackMod > 0?'+':''}${methodResult.attackMod} atk</span>` : ''}
      ${methodResult.damageMod !== 0 ? `<span class="chat-method-mod" style="background:rgba(100,220,100,0.12);border-color:rgba(100,220,100,0.25);color:#88dd88;">${methodResult.damageMod > 0?'+':''}${methodResult.damageMod} dmg</span>` : ''}
      <span class="chat-method-body">${methodResult.body}</span>
    </div>` : '';

  const bonusParts = [];
  if (bonus.mastery)     bonusParts.push(`${bonus.mastery} mastery`);
  if (bonus.temperBonus) bonusParts.push(`${bonus.temperBonus > 0?'+':''}${bonus.temperBonus} ${temperDisp}`);
  if (bonus.augAtkBonus) bonusParts.push(`+${bonus.augAtkBonus} aug`);
  if (behemothBonus)     bonusParts.push(`+${behemothBonus} behemoth`);
  if (bonus.methodAtkMod)bonusParts.push(`${bonus.methodAtkMod > 0?'+':''}${bonus.methodAtkMod} method`);

  const flavor = `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">${item.name}</div>
      <div class="chat-message-subtitle">
        ${aspectName ? `<span class="aspect-label">${aspectName}</span><span style="color:rgba(150,190,230,0.4);margin:0 5px;">·</span>` : ''}
        <span class="sa-label">${saName}</span><span style="color:rgba(150,190,230,0.4);"> — </span>
        <span class="sa-detail">${saForm} · ${temperDisp} · ${saRange}</span>
      </div>
      ${tags ? `<div class="chat-message-tags">${tags}</div>` : ''}
    </div>
    <div class="chat-message-details">
      <div class="chat-message-detail-row"><span class="chat-message-detail-label">Action:</span><span>${actionLabel}</span></div>
      <div class="chat-message-detail-row"><span class="chat-message-detail-label">Attack:</span><span title="${bonusParts.join(', ')}">${formula}</span></div>
      <div class="chat-message-detail-row"><span class="chat-message-detail-label">Cost:</span><span>${costParts.join(', ') || '—'}</span></div>
    </div>
    ${methodHTML}
  </div>`;

  await roll.toMessage({ speaker, flavor, rollMode });

  const hasPierce = [item.system.tag1, item.system.tag2, item.system.tag3].some(t => t === 'pierce');

  // Brutality modifiers line for chat
  const brutalLine = brutalMods.bonusLabel.length
    ? `<div style="margin-top:4px;font-size:11px;color:rgba(200,140,60,0.8);">⚔ ${brutalMods.bonusLabel.join(' · ')}</div>`
    : '';

  await ChatMessage.create({ speaker, rollMode,
    content:`<div class="damage-result-card" style="padding:6px 8px;">
      <span style="color:${Q_COLOR[quality]};font-weight:700;">${quality}</span>
      <span style="color:rgba(200,220,255,0.6);margin:0 6px;">—</span>
      <span style="font-weight:700;color:#e8f4ff;">${totalDamage}</span>
      <span style="color:rgba(150,190,230,0.5);font-size:11px;"> physical damage</span>
      <div style="font-size:10px;color:rgba(130,170,220,0.45);margin-top:2px;">${dmgFormula(soulVal, multiplier, quality, brutalMods.damageMod)}</div>
      ${brutalLine}
      ${totalDamage > 0 ? dmgBtn(totalDamage, 'physical', hasPierce) : ''}
    </div>`
  });

  // Brutality: grant extra Ichor on hit if Impending Doom was active
  if (brutalMods.extraIchorOnHit > 0) {
    const { grantIchor } = await import('./brutality-abilities.mjs');
    // Note: we import from helpers dir, so path is relative
    await import('../abilities/brutality-abilities.mjs').then(m => m.grantIchor(actor, brutalMods.extraIchorOnHit));
  }

  // Brutality: Onset of Doom — inflict Panicked on targeted token
  if (brutalMods.inflictPanicked) {
    await ChatMessage.create({ speaker, rollMode,
      content: `<div style="padding:6px 10px;font-family:'Rajdhani';color:rgba(210,230,255,0.8);font-size:13px;">
        <span style="color:rgba(200,140,60,0.85);font-weight:700;">Onset of Doom</span> — target is inflicted with <strong>Panicked</strong> for 2 rounds.
      </div>`
    });
  }

  // Ranger: Create Weakness result card (GM confirms the Wound)
  if (cwEffects && ranger)
    await ranger.postCreateWeaknessResult(actor, targetActor, cwEffects, quality, { speaker, rollMode });

  return roll;
}

// ============================================================
// 2. resolveFocusedAttack — Baked-in Focused Attack button
// ============================================================
export async function resolveFocusedAttack(actor, { speaker, rollMode, quick = false } = {}) {
  const { sa, saName, saTemper, weaponWC, saForm, saRange, temperDisp } = getSAContext(actor);
  const augDoubleDmg = actor.getFlag?.('stryder', 'augDoubleExcellentDamage') ?? false;

  // Brutality next-attack modifiers
  const brutalMods = (actor.getFlag?.('stryder', 'activeAspect') ?? '').includes('Brutality')
    ? await applyBrutalityModifiers(actor, null)
    : { damageMod: 0, inflictPanicked: false, extraIchorOnHit: 0, bonusLabel: [] };

  // Warlock modifiers (Scarlet Strike, Sanguine Ichor, Crimson Crown)
  let warlockAtkBonus = 0;
  try {
    const wl = await import('../abilities/warlock-abilities.mjs');
    if (wl.isWarlock(actor)) {
      const wmods = await wl.applyWarlockAttackMods(actor, true); // baked-in Focused Attack
      brutalMods.damageMod += wmods.damageMod;
      brutalMods.bonusLabel.push(...wmods.labels);
      warlockAtkBonus = wmods.attackMod;
    }
  } catch (_) {}

  // Still Breaths — consume +2 attack bonus flag if armed
  const stillBreathsBonus = actor.getFlag?.('stryder', 'stillBreathsActive') ? 2 : 0;
  if (stillBreathsBonus) await actor.unsetFlag?.('stryder', 'stillBreathsActive');

  const target = [...(game.user?.targets ?? [])][0];
  const targetActor = target?.actor ?? null;

  // Ranger — Behemoth Slayer attack bonus + Create Weakness offer.
  // `quick` is true when this resolver is reused for a Quick Attack (e.g. Vault) —
  // Create Weakness only rides on Focused attacks, but the Behemoth bonus applies to all.
  let ranger = null, cwEffects = null, behemothBonus = 0;
  try {
    ranger = await import('../abilities/ranger-abilities.mjs');
    if (ranger.isRangerClass(actor)) {
      behemothBonus = ranger.getBehemothSlayerBenefits(actor, targetActor).attackBonus;
      if (!quick) cwEffects = await ranger.getCreateWeaknessForAttack(actor, targetActor);
    }
  } catch(_) {}

  const bonus = getAttackBonus(actor, { saTemper, weaponWC, methodAtkMod: stillBreathsBonus + warlockAtkBonus + behemothBonus });
  const formula = buildFormula(bonus.total);
  const roll = new Roll(formula);
  await roll.evaluate({ async: true });

  let { quality, multiplier } = resolveQuality(roll.total, actor, augDoubleDmg);
  ({ quality, multiplier } = await checkUnbreakableDowngrade(quality, multiplier, targetActor, speaker, rollMode));

  const soulVal = actor.system.abilities?.Soul?.value ?? 0;
  let totalDamage = calcDamage(soulVal, multiplier, quality, brutalMods.damageMod);
  // Heavy temper damage bonus on Focused attacks
  if (saTemper === 'heavy') totalDamage += Math.max(0, weaponWC - 2);

  const hookResult = await runDamageHooks(actor, targetActor, totalDamage, quality, 'focused', speaker, rollMode);
  if (hookResult.skip) return roll;
  totalDamage = hookResult.damage;

  const bonusParts = [];
  if (bonus.mastery)     bonusParts.push(`${bonus.mastery} mastery`);
  if (bonus.temperBonus) bonusParts.push(`${bonus.temperBonus > 0?'+':''}${bonus.temperBonus} ${temperDisp}`);
  if (bonus.augAtkBonus) bonusParts.push(`+${bonus.augAtkBonus} aug`);
  if (behemothBonus)     bonusParts.push(`+${behemothBonus} behemoth`);

  const flavor = `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">Focused Attack</div>
      <div class="chat-message-subtitle">
        <span class="sa-label">${saName}</span><span style="color:rgba(150,190,230,0.4);"> — </span>
        <span class="sa-detail">${saForm} · ${temperDisp} · ${saRange}</span>
      </div>
    </div>
    <div class="chat-message-details">
      <div class="chat-message-detail-row"><span class="chat-message-detail-label">Action:</span><span>Focused</span></div>
      <div class="chat-message-detail-row"><span class="chat-message-detail-label">Attack:</span><span title="${bonusParts.join(', ')}">${formula}</span></div>
    </div>
  </div>`;

  await roll.toMessage({ speaker, flavor, rollMode });

  const brutalLine2 = brutalMods.bonusLabel.length
    ? `<div style="margin-top:4px;font-size:11px;color:rgba(200,140,60,0.8);">⚔ ${brutalMods.bonusLabel.join(' · ')}</div>`
    : '';

  await ChatMessage.create({ speaker, rollMode,
    content:`<div class="damage-result-card" style="padding:6px 8px;">
      <span style="color:${Q_COLOR[quality]};font-weight:700;">${quality}</span>
      <span style="color:rgba(200,220,255,0.6);margin:0 6px;">—</span>
      <span style="font-weight:700;color:#e8f4ff;">${totalDamage}</span>
      <span style="color:rgba(150,190,230,0.5);font-size:11px;"> physical damage</span>
      <div style="font-size:10px;color:rgba(130,170,220,0.45);margin-top:2px;">${dmgFormula(soulVal, multiplier, quality, brutalMods.damageMod)}</div>
      ${brutalLine2}
      ${totalDamage > 0 ? dmgBtn(totalDamage) : ''}
    </div>`
  });

  if (brutalMods.extraIchorOnHit > 0)
    await import('../abilities/brutality-abilities.mjs').then(m => m.grantIchor(actor, brutalMods.extraIchorOnHit));
  if (brutalMods.inflictPanicked)
    await ChatMessage.create({ speaker, rollMode, content:`<div style="padding:6px 10px;font-family:'Rajdhani';color:rgba(210,230,255,0.8);font-size:13px;">
      <span style="color:rgba(200,140,60,0.85);font-weight:700;">Onset of Doom</span> — target inflicted with <strong>Panicked</strong> for 2 rounds.</div>` });

  // Ranger: Create Weakness result card (GM confirms the Wound)
  if (cwEffects && ranger)
    await ranger.postCreateWeaknessResult(actor, targetActor, cwEffects, quality, { speaker, rollMode });

  return roll;
}

// ============================================================
// 3. resolveTwinAttack — Dual Wield (two rolls, one message)
// ============================================================
export async function resolveTwinAttack(actor, { speaker, rollMode } = {}) {
  const { sa, saName, saTemper, weaponWC, saForm, saRange, temperDisp } = getSAContext(actor);
  const augDoubleDmg = actor.getFlag?.('stryder', 'augDoubleExcellentDamage') ?? false;

  const target = [...(game.user?.targets ?? [])][0];
  const targetActor = target?.actor ?? null;

  // Ranger — Twin Attack is the dual-wield Focused Attack: Behemoth bonus + Create Weakness
  let ranger = null, cwEffects = null, behemothBonus = 0;
  try {
    ranger = await import('../abilities/ranger-abilities.mjs');
    if (ranger.isRangerClass(actor)) {
      behemothBonus = ranger.getBehemothSlayerBenefits(actor, targetActor).attackBonus;
      cwEffects = await ranger.getCreateWeaknessForAttack(actor, targetActor);
    }
  } catch(_) {}

  const bonus  = getAttackBonus(actor, { saTemper, weaponWC, methodAtkMod: behemothBonus });
  const formula = buildFormula(bonus.total);

  // Roll both attacks independently
  const roll1 = new Roll(formula);
  const roll2 = new Roll(formula);
  await Promise.all([roll1.evaluate({ async:true }), roll2.evaluate({ async:true })]);

  // Quality for each (Unbreakable applies to each separately)
  let q1 = resolveQuality(roll1.total, actor, augDoubleDmg);
  let q2 = resolveQuality(roll2.total, actor, augDoubleDmg);
  q1 = await checkUnbreakableDowngrade(q1.quality, q1.multiplier, targetActor, speaker, rollMode);
  q2 = await checkUnbreakableDowngrade(q2.quality, q2.multiplier, targetActor, speaker, rollMode);

  const soulVal = actor.system.abilities?.Soul?.value ?? 0;
  // Twin attack: each hit deals half Soul (dual wield splits power between two weapons)
  const halfSoul = Math.floor(soulVal / 2) || 1;
  let dmg1 = calcDamage(halfSoul, q1.multiplier, q1.quality);
  let dmg2 = calcDamage(halfSoul, q2.multiplier, q2.quality);

  // Heavy temper bonus applies per hit
  if (saTemper === 'heavy') {
    const heavyBonus = Math.max(0, weaponWC - 2);
    dmg1 += heavyBonus;
    dmg2 += heavyBonus;
  }

  const bonusParts = [];
  if (bonus.mastery)     bonusParts.push(`${bonus.mastery} mastery`);
  if (bonus.temperBonus) bonusParts.push(`${bonus.temperBonus > 0?'+':''}${bonus.temperBonus} ${temperDisp}`);
  if (bonus.augAtkBonus) bonusParts.push(`+${bonus.augAtkBonus} aug`);
  const bonusTitle = bonusParts.join(', ') || 'no bonus';

  // Combined single chat message
  const content = `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">⚔⚔ Twin Attack</div>
      <div class="chat-message-subtitle">
        <span class="sa-label">${saName}</span><span style="color:rgba(150,190,230,0.4);"> — </span>
        <span class="sa-detail">${saForm} · ${temperDisp} · ${saRange}</span>
      </div>
      <div class="chat-message-tags"><span class="chat-message-tag">DUAL WIELD</span></div>
    </div>
    <div class="chat-message-details">
      <div class="chat-message-detail-row">
        <span class="chat-message-detail-label">Formula:</span>
        <span title="${bonusTitle}">${formula} each</span>
      </div>
      <div class="chat-message-detail-row">
        <span class="chat-message-detail-label">Damage:</span>
        <span>½ Soul (${halfSoul}) per hit</span>
      </div>
    </div>

    <div class="twin-attack-results">
      <div class="twin-hit">
        <div class="twin-hit-header">
          <span class="twin-hit-label">Attack 1</span>
          <span class="twin-hit-roll">${formula} = <strong>${roll1.total}</strong></span>
          <span class="twin-hit-quality" style="color:${Q_COLOR[q1.quality]};font-weight:700;">${q1.quality}</span>
        </div>
        <div class="twin-hit-damage">
          <span style="font-weight:700;color:#e8f4ff;">${dmg1}</span>
          <span style="color:rgba(150,190,230,0.5);font-size:11px;"> physical</span>
          ${dmg1 > 0 ? dmgBtn(dmg1) : ''}
        </div>
      </div>
      <div class="twin-hit-divider"></div>
      <div class="twin-hit">
        <div class="twin-hit-header">
          <span class="twin-hit-label">Attack 2</span>
          <span class="twin-hit-roll">${formula} = <strong>${roll2.total}</strong></span>
          <span class="twin-hit-quality" style="color:${Q_COLOR[q2.quality]};font-weight:700;">${q2.quality}</span>
        </div>
        <div class="twin-hit-damage">
          <span style="font-weight:700;color:#e8f4ff;">${dmg2}</span>
          <span style="color:rgba(150,190,230,0.5);font-size:11px;"> physical</span>
          ${dmg2 > 0 ? dmgBtn(dmg2) : ''}
        </div>
      </div>
    </div>
  </div>`;

  await ChatMessage.create({ speaker, rollMode, content, rolls: [roll1, roll2] });

  // Ranger: Create Weakness result card — uses the better of the two qualities
  if (cwEffects && ranger) {
    const rank = { Poor: 0, Good: 1, Excellent: 2 };
    const bestQuality = rank[q1.quality] >= rank[q2.quality] ? q1.quality : q2.quality;
    await ranger.postCreateWeaknessResult(actor, targetActor, cwEffects, bestQuality, { speaker, rollMode });
  }

  return [roll1, roll2];
}

// ── Brutality next-attack modifier helper ────────────────────
// Called at the start of any attack resolution. Reads pending Brutality
// flags, incorporates their bonuses, then clears the flags after use.
async function applyBrutalityModifiers(actor, baseItem, damageMod = 0) {
  const mods = {
    actionTypeOverride: null, // 'swift' if Impending Doom active
    damageMod: damageMod,
    extraIchorOnHit: 0,
    inflictPanicked: false,
    bonusLabel: [],
  };

  const impendingDoom  = actor.getFlag?.('stryder', 'impendingDoomActive') ?? false;
  const ichorEdgeBonus = actor.getFlag?.('stryder', 'ichorEdgeBonus')       ?? 0;
  const onsetOfDoom    = actor.getFlag?.('stryder', 'onsetOfDoomActive')    ?? false;
  const gougingClaw    = actor.getFlag?.('stryder', 'gougingClawActive')    ?? false;

  const isFocused = (baseItem?.system?.action_type ?? 'focused') === 'focused'
    || (baseItem?.name === 'Focused Attack');

  if (impendingDoom && isFocused) {
    const soulVal = actor.system.abilities?.Soul?.value ?? 0;
    // 2×Soul base damage — expressed as a flat bonus on top of 1×Soul (normal calc gives 1×Soul, so add 1×Soul more)
    mods.damageMod      += soulVal;
    mods.extraIchorOnHit = 1;
    mods.actionTypeOverride = 'swift';
    mods.bonusLabel.push('Impending Doom (2×Soul, Swift, +1 Ichor)');
    await actor.unsetFlag('stryder', 'impendingDoomActive');
  }

  if (ichorEdgeBonus > 0) {
    mods.damageMod += ichorEdgeBonus;
    mods.bonusLabel.push(`Ichor's Edge (+${ichorEdgeBonus} dmg)`);
    await actor.unsetFlag('stryder', 'ichorEdgeBonus');
  }

  if (onsetOfDoom && isFocused) {
    mods.inflictPanicked = true;
    mods.bonusLabel.push('Onset of Doom (Panicked on hit)');
    await actor.unsetFlag('stryder', 'onsetOfDoomActive');
  }

  if (gougingClaw && isFocused) {
    const soulVal = actor.system.abilities?.Soul?.value ?? 0;
    mods.damageMod += soulVal + 3;
    mods.bonusLabel.push(`Gouging Claw (+${soulVal + 3} dmg, Dash 4)`);
    await actor.unsetFlag('stryder', 'gougingClawActive');
  }

  return mods;
}

// ── Detection helper ──────────────────────────────────────────
export function isAspectAttack(item) {
  if (item.type !== 'action') return false;
  if (!(item.system.roll?.diceNum > 0)) return false;
  // Allow unowned items (e.g. dragged from compendium) if they carry an explicit
  // aspectName flag — the actor will be resolved from the speaker in item.mjs.
  // Owned items still require soul_armament to confirm they're on a character.
  const hasAspectFlag = !!(item.flags?.stryder?.aspectName);
  if (!hasAspectFlag && !item.actor?.system?.soul_armament) return false;
  return !!(hasAspectFlag || item.system.isAspectAbility);
}
