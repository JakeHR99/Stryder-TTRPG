// ============================================================
// STRYDER — Shaman Class Ability & Tactic Handler
// ============================================================
// Handles all Tactic items, class features, and Lordly Aspect
// Feature tactics for the Shaman class.
//
// Routing: item.mjs dispatches here when:
//   • item.flags.stryder.isClassFeature && SHAMAN_ABILITY_NAMES includes item.name
//   • item.flags.stryder.isLordlyFeature && LORDLY_TACTIC_NAMES includes item.name
// ============================================================

const SYSTEM_ID = 'stryder';

// ── Card builder ───────────────────────────────────────────────
function shamanCard(title, body, tag = '') {
  return `<div class="chat-message-card">
    <div class="chat-message-header">
      <div class="chat-message-title">${title}</div>
      <div class="chat-message-subtitle">
        <span class="aspect-label">Shaman</span>
        ${tag ? `<span class="chat-sep-dot">·</span><span class="chat-action-tag">${tag}</span>` : ''}
      </div>
    </div>
    <div class="chat-message-content chat-content-rajdhani">
      ${body}
    </div>
  </div>`;
}

// ── Resource helpers ───────────────────────────────────────────
async function spendStamina(actor, amount) {
  const cur = actor.system.stamina?.value ?? 0;
  if (cur < amount) { ui.notifications.warn(`Not enough Stamina — need ${amount}, have ${cur}.`); return false; }
  await actor.update({ 'system.stamina.value': cur - amount });
  return true;
}

async function spendMana(actor, amount) {
  const cur = actor.system.mana?.value ?? 0;
  if (cur < amount) { ui.notifications.warn(`Not enough Mana — need ${amount}, have ${cur}.`); return false; }
  await actor.update({ 'system.mana.value': cur - amount });
  return true;
}

// Spend Tactic Points from the linked Lordling
async function spendTP(actor, amount) {
  const lordling = getLinkedLordling(actor);
  if (!lordling) { ui.notifications.warn('No linked Lordling found — cannot spend Tactic Points.'); return false; }
  const cur = lordling.system.tactics?.value ?? 0;
  if (cur < amount) { ui.notifications.warn(`Not enough Tactic Points — need ${amount}, have ${cur}.`); return false; }
  await lordling.update({ 'system.tactics.value': cur - amount });
  return true;
}

// Find the Lordling actor linked to this Shaman
function getLinkedLordling(actor) {
  return game.actors.find(a => a.type === 'lordling' && a.system.linkedCharacterId === actor.id) ?? null;
}

// Dialog: choose Focused or Swift cost, returns { mode, tpCost, staCost } or null
function tacticDialog(title, focused, swift) {
  return new Promise(resolve => {
    const focusedLabel = `Focused (${focused.tp} TP${focused.sta ? ` · ${focused.sta} STA` : ''})`;
    const swiftLabel   = `Swift (${swift.tp} TP${swift.sta ? ` · ${swift.sta} STA` : ''})`;
    new Dialog({
      title: `Tactic: ${title}`,
      content: `<p class="chat-hint-p">Choose action type:</p>`,
      buttons: {
        focused: { label: focusedLabel, callback: () => resolve({ mode: 'Focused', tpCost: focused.tp, staCost: focused.sta ?? 0 }) },
        swift:   { label: swiftLabel,   callback: () => resolve({ mode: 'Swift',   tpCost: swift.tp,   staCost: swift.sta   ?? 0 }) },
        cancel:  { label: 'Cancel',     callback: () => resolve(null) },
      },
      default: 'focused',
    }, { width: 340, classes: ['dialog','stryder-stat-popup'] }).render(true);
  });
}

// ── Name lists for routing ─────────────────────────────────────
export const SHAMAN_ABILITY_NAMES = [
  'Tactic: Attack', 'Tactic: Heal', 'Tactic: Dodge/Evasion',
  'Tactic: Return', 'Tactic: Metamorph', 'Tactic: Retreat', 'Tactic: Transfer Talent',
  'Desperate Strength', 'Spirit Armament', 'Approximate Ascension', 'Bonded Lives',
  "Spirit's Wrath", "Spirit's Compassion",
];

export function isShamanClass(actor) {
  return (actor?.system?.class?.name ?? '') === 'Shaman'
    || (actor?.items?.some(i => i.type === 'class' && i.name === 'Shaman') ?? false);
}

export const LORDLY_TACTIC_NAMES = [
  // Wild
  'Strike Together', 'Monkey Paw', 'Tigers Pounce', 'Bombardment',
  // Royal
  'Marching Quake', 'Fastball', 'Mystical Rejuvenation', "Royal's Decree",
  // Spirit
  'Diamond Body, Reverent Mind', 'Blink and Miss',
  // Passives (display on click)
  'Agile Mount', 'Stride of the Wild Ones', 'Siege Beast', 'Imposing Mount',
  'Ranged Arsenal', 'Fight Through Me',
];

// ── Main dispatchers ───────────────────────────────────────────
export async function handleShamanAbility(item, actor, speaker, rollMode) {
  switch (item.name) {
    case 'Tactic: Attack':          return tacticAttack(actor, speaker, rollMode);
    case 'Tactic: Heal':            return tacticHeal(actor, speaker, rollMode);
    case 'Tactic: Dodge/Evasion':   return tacticDodge(actor, speaker, rollMode);
    case 'Tactic: Return':          return tacticReturn(actor, speaker, rollMode);
    case 'Tactic: Metamorph':       return tacticMetamorph(actor, speaker, rollMode);
    case 'Tactic: Retreat':         return tacticRetreat(actor, speaker, rollMode);
    case 'Tactic: Transfer Talent': return tacticTransferTalent(actor, speaker, rollMode);
    case 'Desperate Strength':       return handleDesperateStrength(actor, speaker, rollMode);
    case 'Spirit Armament':          return handleSpiritArmament(actor, speaker, rollMode);
    case 'Approximate Ascension':    return handleApproximateAscension(actor, speaker, rollMode);
    case "Spirit's Wrath":           return handleSpiritsWrath(actor, speaker, rollMode);
    case "Spirit's Compassion":      return handleSpiritsCompassion(actor, speaker, rollMode);
    case 'Bonded Lives':
      return ChatMessage.create({ speaker, rollMode, content: shamanCard(
        'Bonded Lives', 'Your Health starts at <strong>6</strong> and you gain <strong>2 Health</strong> every level. You are bonded to your Lordling through soul and spirit.', 'Passive'
      )});
    default:
      return ChatMessage.create({ speaker, rollMode, content: shamanCard(item.name, item.system.description ?? '') });
  }
}

export async function handleLordlyFeature(item, actor, speaker, rollMode) {
  switch (item.name) {
    // ── Wild ──
    case 'Strike Together':              return lordlyStrikeTogether(actor, speaker, rollMode);
    case 'Monkey Paw':                   return lordlyMonkeyPaw(actor, speaker, rollMode);
    case 'Tigers Pounce':                return lordlyTigersPounce(actor, speaker, rollMode);
    case 'Bombardment':                  return lordlyBombardment(actor, speaker, rollMode);
    case 'Agile Mount':                  return lordlyPassive(item, actor, speaker, rollMode);
    case 'Stride of the Wild Ones':      return lordlyPassive(item, actor, speaker, rollMode);
    // ── Royal ──
    case 'Marching Quake':               return lordlyMarchingQuake(actor, speaker, rollMode);
    case 'Fastball':                     return lordlyFastball(actor, speaker, rollMode);
    case 'Mystical Rejuvenation':        return lordlyMysticalRejuvenation(actor, speaker, rollMode);
    case "Royal's Decree":               return lordlyRoyalsDecree(actor, speaker, rollMode);
    case 'Siege Beast':                  return lordlyPassive(item, actor, speaker, rollMode);
    case 'Imposing Mount':               return lordlyPassive(item, actor, speaker, rollMode);
    // ── Spirit ──
    case 'Diamond Body, Reverent Mind':  return lordlyDiamondBody(actor, speaker, rollMode);
    case 'Blink and Miss':               return lordlyBlinkAndMiss(actor, speaker, rollMode);
    case 'Ranged Arsenal':               return lordlyPassive(item, actor, speaker, rollMode);
    case 'Fight Through Me':             return lordlyPassive(item, actor, speaker, rollMode);
    default:
      console.warn(`[Stryder] handleLordlyFeature: unmatched name "${item.name}" — no case in switch, posting generic card.`);
      return ChatMessage.create({ speaker, rollMode, content: shamanCard(item.name, item.system.description ?? '') });
  }
}

// ══════════════════════════════════════════════════════════════
// CORE TACTICS
// ══════════════════════════════════════════════════════════════

async function tacticAttack(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog('Attack', { tp: 0 }, { tp: 1 });
  if (!choice) return;
  const ok = await spendTP(actor, choice.tpCost);
  if (!ok) return;
  const lordlingName = lordling?.name ?? 'your Lordling';
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Tactic — Attack', `${lordlingName} makes a <strong>Quick Attack</strong> (available while Medium or Huge size).`, `${choice.mode} · ${choice.tpCost} TP`
  )});
  // Trigger a Lordling attack roll using its Spirit (Soul) value
  if (lordling) {
    const spirit = lordling.system.abilities?.Soul?.value ?? 0;
    const roll = new Roll('2d6');
    await roll.evaluate({ async: true });
    const quality = roll.total >= 11 ? 'Excellent' : roll.total >= 5 ? 'Good' : 'Poor';
    const multi   = quality === 'Excellent' ? 1.5 : quality === 'Poor' ? 0.5 : 1.0;
    const dmg     = quality === 'Excellent' ? Math.ceil(spirit * multi) : Math.floor(spirit * multi);
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: lordling }), rollMode,
      flavor: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">${lordlingName} — Quick Attack</div></div></div>` });
    await ChatMessage.create({ speaker, rollMode,
      content: `<div class="damage-result-card">
        <span style="color:${quality==='Excellent'?'#ffd700':quality==='Poor'?'#dc3545':'#5cb85c'};font-weight:700;">${quality}</span>
        <span class="chat-em-dash">—</span>
        <span class="chat-total-dmg">${dmg}</span>
        <span class="chat-dmg-suffix"> physical (Spirit ${spirit})</span>
        <div class="damage-apply-container">
          <button class="damage-apply-button" data-damage="${dmg}" data-damage-type="physical" data-has-pierce="false">
            Apply <span class="damage-num">${dmg}</span> Damage
          </button>
        </div>
      </div>`
    });
  }
}

async function tacticHeal(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  // Focused: 1 TP, 1× per engagement. Swift: 3 TP.
  const engagementKey = 'tacticHealUsedThisEngagement';
  const usedFocused   = actor.getFlag(SYSTEM_ID, engagementKey) ?? false;
  const choice = await tacticDialog('Heal',
    { tp: 1, label: usedFocused ? 'Focused (1 TP — ALREADY USED)' : 'Focused (1 TP · 1×/engagement)' },
    { tp: 3 }
  );
  if (!choice) return;
  if (choice.mode === 'Focused' && usedFocused) {
    return ui.notifications.warn('Focused Heal already used this engagement. Use Swift (8 TP) instead.');
  }
  const ok = await spendTP(actor, choice.tpCost);
  if (!ok) return;
  if (choice.mode === 'Focused') await actor.setFlag(SYSTEM_ID, engagementKey, true);

  const healAmt = actor.system.abilities?.Soul?.value ?? 0;
  const target  = [...(game.user?.targets ?? [])][0];
  const targetActor = target?.actor ?? null;
  if (targetActor) {
    const curHP = targetActor.system.health?.value ?? 0;
    const maxHP = targetActor.system.health?.max   ?? 0;
    await targetActor.update({ 'system.health.value': Math.min(maxHP, curHP + healAmt) });
  }
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Tactic — Heal',
    `${lordling?.name ?? 'Lordling'} channels healing energy through the bond. ${targetActor ? `<strong>${targetActor.name}</strong> restores` : 'Target restores'} <strong>${healAmt} HP</strong> (equal to ${actor.name}'s Soul).`,
    `${choice.mode} · ${choice.tpCost} TP`
  )});
}

async function tacticDodge(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  // Swift only: 0 TP, 1 Stamina
  const ok = await spendStamina(actor, 1);
  if (!ok) return;
  const okTP = await spendTP(actor, 0); // 0 TP but check lordling exists
  if (!okTP && !lordling) return;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Tactic — Dodge/Evasion', `${lordling?.name ?? 'Lordling'} <strong>Dodges or Evades</strong> an incoming effect.`, 'Swift · 0 TP · 1 STA'
  )});
}

async function tacticReturn(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  if (lordling?.getFlag?.(SYSTEM_ID, 'lordlingEssenceDrained')) {
    return ui.notifications.warn('Desperate Strength drained the Lordling\'s essence — Return requires an 8-hour rest before it can be performed.');
  }
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Tactic — Return', `<strong>Ritual — 1 hour.</strong> ${actor.name} performs the Return Ritual to reconstitute ${lordling?.name ?? 'their Lordling'}'s physical form. This can only be performed once between rests.`, 'Ritual'
  )});
}

async function tacticMetamorph(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog('Metamorph', { tp: 0 }, { tp: 1 });
  if (!choice) return;
  const ok = await spendTP(actor, choice.tpCost);
  if (!ok) return;

  // Dialog: choose form
  const form = await new Promise(resolve => {
    new Dialog({
      title: 'Metamorph — Choose Form',
      content: `<p class="chat-hint-p">Change ${lordling?.name ?? 'Lordling'}'s form:</p>`,
      buttons: {
        wild:   { label: '🌿 Wild (Medium)',  callback: () => resolve('Wild (Medium)')   },
        royal:  { label: '👑 Royal (Huge)',   callback: () => resolve('Royal (Huge)')    },
        cancel: { label: 'Cancel',            callback: () => resolve(null) },
      },
      default: 'wild',
    }, { width: 300, classes: ['dialog','stryder-stat-popup'] }).render(true);
  });
  if (!form) return;
  if (lordling) await lordling.setFlag(SYSTEM_ID, 'lordlingForm', form);
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Tactic — Metamorph', `${lordling?.name ?? 'Lordling'} changes form to <strong>${form}</strong>.`, `${choice.mode} · ${choice.tpCost} TP`
  )});
}

async function tacticRetreat(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog('Retreat', { tp: 0 }, { tp: 1 });
  if (!choice) return;
  const ok = await spendTP(actor, choice.tpCost);
  if (!ok) return;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Tactic — Retreat', `${lordling?.name ?? 'Lordling'} moves directly towards ${actor.name} — up to <strong>6 Spaces</strong>. This does not count against their Movement.`, `${choice.mode} · ${choice.tpCost} TP`
  )});
}

async function tacticTransferTalent(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  if (!lordling) return ui.notifications.warn('No linked Lordling found.');
  const choice = await tacticDialog('Transfer Talent', { tp: 1 }, { tp: 2 });
  if (!choice) return;
  const ok = await spendTP(actor, choice.tpCost);
  if (!ok) return;

  const talents = ['Endurance','Nimbleness','Finesse','Strength','Survival'];
  const talentOpts = talents.map(t => `<option value="${t}">${t}</option>`).join('');
  const result = await new Promise(resolve => {
    new Dialog({
      title: 'Transfer Talent',
      content: `<div class="chat-hint-p">
        <p>Transfer a Physical Talent between ${actor.name} and ${lordling.name} for 1 minute (max 5).</p>
        <select id="xfer-talent" style="width:100%;background:#0a0e1a;color:#88acd8;border:1px solid rgba(50,90,170,0.4);border-radius:3px;padding:4px;">
          ${talentOpts}
        </select>
        <p style="margin-top:8px;">Direction:</p>
      </div>`,
      buttons: {
        fromLordling: { label: `← To ${actor.name}`,   callback: (html) => resolve({ talent: html.find('#xfer-talent').val(), dir: 'fromLordling' }) },
        toLordling:   { label: `→ To ${lordling.name}`, callback: (html) => resolve({ talent: html.find('#xfer-talent').val(), dir: 'toLordling' }) },
        cancel: { label: 'Cancel', callback: () => resolve(null) },
      },
      default: 'fromLordling',
    }, { width: 320, classes: ['dialog','stryder-stat-popup'] }).render(true);
  });
  if (!result) return;

  const key = result.talent.toLowerCase();
  const shamOld = actor.system.attributes?.talent?.[key]?.value ?? 0;
  const lordOld = lordling.system.attributes?.talent?.[key]?.value ?? 0;
  let shamNew, lordNew;
  if (result.dir === 'fromLordling') {
    // Lordling gives talent to Shaman
    shamNew = Math.min(5, shamOld + lordOld);
    lordNew = 0;
  } else {
    // Shaman gives talent to Lordling
    shamNew = 0;
    lordNew = Math.min(5, lordOld + shamOld);
  }

  // Store originals for combat-end safety revert
  await actor.setFlag(SYSTEM_ID, 'transferTalentOriginals', {
    talent: key, shamValue: shamOld, lordValue: lordOld,
    dir: result.dir, lordlingId: lordling.id,
  });
  await actor.update({ [`system.attributes.talent.${key}.value`]: shamNew });
  await lordling.update({ [`system.attributes.talent.${key}.value`]: lordNew });

  const fromName = result.dir === 'fromLordling' ? lordling.name : actor.name;
  const toName   = result.dir === 'fromLordling' ? actor.name : lordling.name;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Tactic: Transfer Talent',
    `<strong>${result.talent}</strong> Talent moved from ${fromName} → ${toName} for 1 minute (reverts at end of engagement).<br>
     ${fromName}: ${result.dir === 'fromLordling' ? lordOld : shamOld} → <strong>0</strong>&emsp;
     ${toName}: → <strong>${result.dir === 'fromLordling' ? shamNew : lordNew}</strong>`,
    `${choice.mode} · ${choice.tpCost} TP`
  )});
}

// ══════════════════════════════════════════════════════════════
// CLASS FEATURES
// ══════════════════════════════════════════════════════════════

async function handleDesperateStrength(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);

  // Heal Shaman: 10 HP + 3 Mana + full Stamina
  const curHP   = actor.system.health?.value   ?? 0;
  const maxHP   = actor.system.health?.max     ?? 0;
  const maxSTA  = actor.system.stamina?.max    ?? 0;
  const curMana = actor.system.mana?.value     ?? 0;
  await actor.update({
    'system.health.value':  Math.min(maxHP, curHP + 10),
    'system.mana.value':    Math.min(actor.system.mana?.max ?? 0, curMana + 3),
    'system.stamina.value': maxSTA,
  });

  // Drain Lordling essence — prevents Return until 8hr rest
  if (lordling) await lordling.setFlag(SYSTEM_ID, 'lordlingEssenceDrained', true);

  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Desperate Strength',
    `${actor.name} draws from ${lordling?.name ?? 'their Lordling'}'s spirit essence.<br>
     Restored: <strong>+10 HP</strong>, <strong>+3 Mana</strong>, <strong>full Stamina</strong>.<br>
     <span style="color:rgba(220,100,100,0.8);">⚠ ${lordling?.name ?? 'Lordling'}'s essence is drained — the Return Ritual cannot be performed until after 8 hours of rest.</span>`,
    'Swift Action'
  )});
}

async function handleSpiritArmament(actor, speaker, rollMode) {
  const usedToday = actor.getFlag(SYSTEM_ID, 'spiritArmamentUsedToday') ?? false;
  if (usedToday) return ui.notifications.warn('Spirit Armament can only be used once per rest.');

  const lordling = getLinkedLordling(actor);
  if (!lordling) return ui.notifications.warn('No linked Lordling found.');

  const soulRounds = actor.system.abilities?.Soul?.value ?? 0;
  const lordSpirit = lordling.system.abilities?.Soul?.value ?? 0;

  // Apply +2 Movement, storing the original for revert
  const origMove = actor.system.attributes?.move?.running?.value ?? 0;
  await actor.update({ 'system.attributes.move.running.value': origMove + 2 });
  await actor.setFlag(SYSTEM_ID, 'spiritArmamentActive', { spiritVal: lordSpirit, roundsLeft: soulRounds, origMove });
  await actor.setFlag(SYSTEM_ID, 'spiritArmamentUsedToday', true);

  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Spirit Armament',
    `${actor.name} absorbs ${lordling.name} into their Soul Armament for <strong>${soulRounds} Rounds</strong> (Soul value).<br><br>
     <strong>Active Benefits:</strong><br>
     ⚔ Focused Attacks deal <strong>+${lordSpirit} damage</strong> (${lordling.name}'s Spirit)<br>
     💨 Movement <strong>+2</strong> (${origMove} → ${origMove + 2})<br>
     🛡 Can use ${lordling.name}'s Tactics on yourself<br>
     ✦ Access to ${lordling.name}'s Passive Tactic benefits<br><br>
     <span style="color:rgba(180,150,255,0.7);font-size:11px;">${lordling.name} cannot be targeted by Attacks, Abilities, or Spells while absorbed.</span>`,
    `Focused · ${soulRounds} Rounds`
  )});
}

async function handleApproximateAscension(actor, speaker, rollMode) {
  if (actor.getFlag(SYSTEM_ID, 'approximateAscensionRounds') > 0) {
    return ui.notifications.warn('Approximate Ascension is already active.');
  }
  const ok = await spendMana(actor, 3);
  if (!ok) return;

  const lordling = getLinkedLordling(actor);
  if (!lordling) return ui.notifications.warn('No linked Lordling found.');

  // Read originals before modifying
  const shamSoul   = actor.system.abilities?.Soul?.value   ?? 0;
  const shamReflex = actor.system.abilities?.Reflex?.value ?? 0;
  const shamGrit   = actor.system.abilities?.Grit?.value   ?? 0;
  const shamWill   = actor.system.abilities?.Will?.value   ?? 0;
  const lordSoul   = lordling.system.abilities?.Soul?.value   ?? 0;
  const lordReflex = lordling.system.abilities?.Reflex?.value ?? 0;
  const lordGrit   = lordling.system.abilities?.Grit?.value   ?? 0;
  const lordWill   = lordling.system.abilities?.Will?.value   ?? 0;
  const tpMaxBase  = lordling.system.tactics?.max ?? 6;

  // Store originals for revert
  await actor.setFlag(SYSTEM_ID, 'approximateAscensionOriginals', {
    lordlingId: lordling.id,
    shaman:   { Soul: shamSoul,  Reflex: shamReflex,  Grit: shamGrit,  Will: shamWill  },
    lordling: { Soul: lordSoul,  Reflex: lordReflex,  Grit: lordGrit,  Will: lordWill  },
    tpMaxBase,
  });

  // Additive boost: each creature's stat += the other creature's same stat
  await actor.update({
    'system.abilities.Soul.value':   shamSoul   + lordSoul,
    'system.abilities.Reflex.value': shamReflex + lordReflex,
    'system.abilities.Grit.value':   shamGrit   + lordGrit,
    'system.abilities.Will.value':   shamWill   + lordWill,
  });
  await lordling.update({
    'system.abilities.Soul.value':   lordSoul   + shamSoul,
    'system.abilities.Reflex.value': lordReflex + shamReflex,
    'system.abilities.Grit.value':   lordGrit   + shamGrit,
    'system.abilities.Will.value':   lordWill   + shamWill,
  });

  // Double Tactic Points max (don't refill current)
  await lordling.update({ 'system.tactics.max': tpMaxBase * 2 });

  // Set 3-round countdown
  await actor.setFlag(SYSTEM_ID, 'approximateAscensionRounds', 3);

  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Approximate Ascension',
    `${actor.name} and ${lordling.name} reach the upper echelon of their bond for <strong>3 Rounds</strong>:<br><br>
     🔶 ${lordling.name} becomes <strong>Massive</strong> size<br>
     ⚡ Each creature's stats raised by the other's own stats (surpassing limits)<br>
     &emsp;${actor.name}: Soul ${shamSoul}→${shamSoul+lordSoul} / Reflex ${shamReflex}→${shamReflex+lordReflex} / Grit ${shamGrit}→${shamGrit+lordGrit} / Will ${shamWill}→${shamWill+lordWill}<br>
     &emsp;${lordling.name}: Soul ${lordSoul}→${lordSoul+shamSoul} / Reflex ${lordReflex}→${lordReflex+shamReflex} / Grit ${lordGrit}→${lordGrit+shamGrit} / Will ${lordWill}→${lordWill+shamWill}<br>
     🌀 ${lordling.name} can use <strong>ALL Lordly Aspects</strong> without changing forms<br>
     ♾ Tactic Points max <strong>doubled</strong> (${tpMaxBase} → ${tpMaxBase * 2}; unspent TP not restored)<br>
     ✦ Access to <strong>Spirit's Wrath</strong> and <strong>Spirit's Compassion</strong> Tactics<br><br>
     <span style="color:rgba(200,180,255,0.6);font-size:11px;">Expires at the end of Round 3. Stats and Tactic max revert automatically.</span>`,
    'Focused · 3 Mana · 3 Rounds'
  )});
}

export async function revertApproximateAscension(actor) {
  const originals = actor.getFlag(SYSTEM_ID, 'approximateAscensionOriginals');
  if (!originals) return;
  const lordling = game.actors.get(originals.lordlingId);
  await actor.update({
    'system.abilities.Soul.value':   originals.shaman.Soul,
    'system.abilities.Reflex.value': originals.shaman.Reflex,
    'system.abilities.Grit.value':   originals.shaman.Grit,
    'system.abilities.Will.value':   originals.shaman.Will,
  });
  if (lordling) {
    await lordling.update({
      'system.abilities.Soul.value':   originals.lordling.Soul,
      'system.abilities.Reflex.value': originals.lordling.Reflex,
      'system.abilities.Grit.value':   originals.lordling.Grit,
      'system.abilities.Will.value':   originals.lordling.Will,
      'system.tactics.max':             originals.tpMaxBase,
    });
  }
  await actor.unsetFlag(SYSTEM_ID, 'approximateAscensionRounds');
  await actor.unsetFlag(SYSTEM_ID, 'approximateAscensionOriginals');
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: shamanCard('Approximate Ascension', `${actor.name}'s Approximate Ascension has expired. Stats and Tactic Points max reverted.`, 'Expired'),
  });
}

async function handleSpiritsWrath(actor, speaker, rollMode) {
  if (!(actor.getFlag(SYSTEM_ID, 'approximateAscensionRounds') > 0)) {
    return ui.notifications.warn("Spirit's Wrath is only available during Approximate Ascension.");
  }
  const ok1 = await spendTP(actor, 7);
  if (!ok1) return;
  const ok2 = await spendStamina(actor, 2);
  if (!ok2) return;
  const ok3 = await spendMana(actor, 2);
  if (!ok3) return;

  const soulVal = actor.system.abilities?.Soul?.value ?? 0;
  const dmg = soulVal * 4;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    "Spirit's Wrath",
    `A massive breath in a <strong>14-space line, 3 spaces wide</strong>.<br>
     Deals <strong>${dmg} damage</strong> [4 × Soul (${soulVal})].<br>
     Targets must beat <strong>Evasion Value 15</strong> or take full damage.`,
    'Focused · 7 TP · 2 STA · 2 Mana'
  )});
}

async function handleSpiritsCompassion(actor, speaker, rollMode) {
  if (!(actor.getFlag(SYSTEM_ID, 'approximateAscensionRounds') > 0)) {
    return ui.notifications.warn("Spirit's Compassion is only available during Approximate Ascension.");
  }
  const ok1 = await spendTP(actor, 7);
  if (!ok1) return;
  const ok2 = await spendStamina(actor, 2);
  if (!ok2) return;
  const ok3 = await spendMana(actor, 2);
  if (!ok3) return;

  // Heal all targeted allied actors
  const targets = [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
  const healed = [];
  for (const t of targets) {
    if (t.id === actor.id) continue; // Shaman does not benefit
    const cur = t.system.health?.value ?? 0;
    const max = t.system.health?.max   ?? 0;
    await t.update({ 'system.health.value': Math.min(max, cur + 15) });
    healed.push(t.name);
  }
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    "Spirit's Compassion",
    `A wave of healing washes over the battlefield.<br>
     Every allied creature within <strong>6 spaces</strong> regains <strong>15 Health</strong>.<br>
     ${healed.length ? `Healed: <strong>${healed.join(', ')}</strong>.` : '(No allied targets selected — heal manually.)'}<br>
     <em>${actor.name} does not regain Health from this Tactic.</em>`,
    'Focused · 7 TP · 2 STA · 2 Mana'
  )});
}

// ── Per-round tick for Shaman time-limited effects ────────────
export async function shamanEndOfRound(actor) {
  // Spirit Armament countdown
  const armament = actor.getFlag(SYSTEM_ID, 'spiritArmamentActive');
  if (armament?.roundsLeft > 0) {
    const newRounds = armament.roundsLeft - 1;
    if (newRounds <= 0) {
      // Revert movement
      await actor.update({ 'system.attributes.move.running.value': armament.origMove ?? (actor.system.attributes?.move?.running?.value - 2) });
      await actor.unsetFlag(SYSTEM_ID, 'spiritArmamentActive');
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: shamanCard('Spirit Armament', `${actor.name}'s Spirit Armament has expired. Movement and bonuses reverted.`, 'Expired'),
      });
    } else {
      await actor.setFlag(SYSTEM_ID, 'spiritArmamentActive', { ...armament, roundsLeft: newRounds });
    }
  }

  // Approximate Ascension countdown
  const ascRounds = actor.getFlag(SYSTEM_ID, 'approximateAscensionRounds') ?? 0;
  if (ascRounds > 0) {
    const newAsc = ascRounds - 1;
    if (newAsc <= 0) {
      await revertApproximateAscension(actor);
    } else {
      await actor.setFlag(SYSTEM_ID, 'approximateAscensionRounds', newAsc);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// LORDLY ASPECT FEATURES — ACTIVE TACTICS
// ══════════════════════════════════════════════════════════════

// ── Shared: Lordling attack roll helper ───────────────────────
async function lordlingAttackRoll(lordling, actor, speaker, rollMode, bonusTP = 0) {
  const spirit = lordling.system.abilities?.Soul?.value ?? 0;
  const roll   = new Roll('2d6');
  await roll.evaluate({ async: true });
  const quality = roll.total >= 11 ? 'Excellent' : roll.total >= 5 ? 'Good' : 'Poor';
  const multi   = quality === 'Excellent' ? 1.5 : quality === 'Poor' ? 0.5 : 1.0;
  const dmg     = quality === 'Excellent' ? Math.ceil(spirit * multi) : Math.floor(spirit * multi);
  const Q_COLOR = { Poor: '#dc3545', Good: '#5cb85c', Excellent: '#ffd700' };
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: lordling }), rollMode,
    flavor: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">${lordling.name} Attacks</div></div></div>` });
  await ChatMessage.create({ speaker, rollMode,
    content: `<div class="damage-result-card">
      <span style="color:${Q_COLOR[quality]};font-weight:700;">${quality}</span>
      <span class="chat-em-dash">—</span>
      <span class="chat-total-dmg">${dmg}</span>
      <span class="chat-dmg-suffix"> physical (Spirit ${spirit})</span>
      <div class="damage-apply-container">
        <button class="damage-apply-button" data-damage="${dmg}" data-damage-type="physical" data-has-pierce="false">
          Apply <span class="damage-num">${dmg}</span> Damage
        </button>
      </div>
    </div>`
  });
  return { dmg, quality, roll };
}

// ── Wild ─────────────────────────────────────────────────────

async function lordlyStrikeTogether(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const ok = await spendTP(actor, 2);
  if (!ok) return;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Strike Together', `${lordling?.name ?? 'Lordling'} strikes a creature within 1 Space that was hit by a Focused Attack — <strong>Quick Attack</strong>.`, 'Swift · 2 TP'
  )});
  if (lordling) await lordlingAttackRoll(lordling, actor, speaker, rollMode);
}

async function lordlyMonkeyPaw(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog('Monkey Paw', { tp: 2, sta: 1 }, { tp: 4, sta: 2 });
  if (!choice) return;
  if (!(await spendTP(actor, choice.tpCost))) return;
  if (!(await spendStamina(actor, choice.staCost))) return;
  const spirit = lordling?.system.abilities?.Soul?.value ?? 0;
  const str    = lordling?.system.attributes?.talent?.strength?.value ?? 0;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Monkey Paw',
    `${lordling?.name ?? 'Lordling'} grabs a creature within 1 Space and throws them <strong>${str} Spaces</strong>.<br>
     Deals <strong>${spirit * 2} damage</strong> (2× Spirit) and knocks them back <strong>3 squares</strong>.<br>
     Target must pass an <strong>Agility Check</strong> or be Shocked.`,
    `${choice.mode} · ${choice.tpCost} TP · ${choice.staCost} STA`
  )});
}

async function lordlyTigersPounce(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog("Tiger's Pounce", { tp: 2, sta: 1 }, { tp: 4, sta: 2 });
  if (!choice) return;
  if (!(await spendTP(actor, choice.tpCost))) return;
  if (!(await spendStamina(actor, choice.staCost))) return;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    "Tiger's Pounce",
    `${lordling?.name ?? 'Lordling'} leaps forward up to <strong>4 Spaces</strong> with incredible momentum and uses the Attack Tactic at <strong>no cost</strong> — with <strong>+4 to the Attack Roll</strong>.`,
    `${choice.mode} · ${choice.tpCost} TP · ${choice.staCost} STA`
  )});
  if (lordling) await lordlingAttackRoll(lordling, actor, speaker, rollMode);
}

async function lordlyBombardment(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const ok = await spendTP(actor, 2);
  if (!ok) return;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Bombardment', `${lordling?.name ?? 'Lordling'} assaults an enemy within 1 Space being attacked. Their next <strong>Reflex roll</strong> is reduced by <strong>3</strong>.`, 'Swift · 2 TP'
  )});
}

// ── Royal ────────────────────────────────────────────────────

async function lordlyMarchingQuake(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog('Marching Quake', { tp: 2, sta: 1 }, { tp: 2, sta: 2 });
  if (!choice) return;
  if (!(await spendTP(actor, choice.tpCost))) return;
  if (!(await spendStamina(actor, choice.staCost))) return;
  const spirit = lordling?.system.abilities?.Soul?.value ?? 0;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Marching Quake',
    `${lordling?.name ?? 'Lordling'} charges forward — any creature in their path or within 1 Space takes <strong>${spirit + 3} damage</strong> (Spirit+3).<br>
     On a failed <strong>Evasion Check</strong> vs Physical Potency, creatures become <strong>Shocked</strong>.`,
    `${choice.mode} · ${choice.tpCost} TP · ${choice.staCost} STA`
  )});
}

async function lordlyFastball(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog('Fastball', { tp: 2, sta: 1 }, { tp: 2, sta: 1 });
  if (!choice) return;
  if (!(await spendTP(actor, choice.tpCost))) return;
  if (!(await spendStamina(actor, choice.staCost))) return;
  const str = lordling?.system.attributes?.talent?.strength?.value ?? 0;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Fastball',
    `${lordling?.name ?? 'Lordling'} grabs a creature within 1 Space and hurls them <strong>${str} Spaces</strong> (Lordling's Strength).<br>
     Target must pass an <strong>Agility Check</strong> against their own Strength Check or become <strong>Shocked</strong>.`,
    `${choice.mode} · ${choice.tpCost} TP · ${choice.staCost} STA`
  )});
}

async function lordlyMysticalRejuvenation(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog('Mystical Rejuvenation', { tp: 2 }, { tp: 3, sta: 2 });
  if (!choice) return;
  if (!(await spendTP(actor, choice.tpCost))) return;
  if (choice.staCost && !(await spendStamina(actor, choice.staCost))) return;

  const roll = new Roll('1d6+3');
  await roll.evaluate({ async: true });
  const healAmt = roll.total;

  const target = [...(game.user?.targets ?? [])][0];
  const targetActor = target?.actor ?? null;
  if (targetActor) {
    const curHP = targetActor.system.health?.value ?? 0;
    const maxHP = targetActor.system.health?.max   ?? 0;
    await targetActor.update({ 'system.health.value': Math.min(maxHP, curHP + healAmt) });
  }
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: lordling ?? actor }), rollMode,
    flavor: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">Mystical Rejuvenation — Heal Roll</div></div></div>` });
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Mystical Rejuvenation',
    `${lordling?.name ?? 'Lordling'} releases healing light motes at ${targetActor?.name ?? 'a creature'} within 4 Spaces — restoring <strong>${healAmt} HP</strong>.`,
    `${choice.mode} · ${choice.tpCost} TP`
  )});
}

async function lordlyRoyalsDecree(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const ok = await spendTP(actor, 2);
  if (!ok) return;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    "Royal's Decree",
    `${lordling?.name ?? 'Lordling'} calls down positive or negative energy. Target up to <strong>2 creatures within 3 Spaces</strong>:<br>
     • <strong>Enemies</strong> — become <strong>Shocked</strong> on a failed Magykal Resist vs your Potency<br>
     • <strong>Allies</strong> — become <strong>Energized</strong> on a failed Magykal Resist vs your Potency<br>
     Lasts until the <strong>start of the next Player Phase</strong>.`,
    'Swift · 2 TP'
  )});
}

// ── Spirit ───────────────────────────────────────────────────

async function lordlyDiamondBody(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const ok1 = await spendTP(actor, 1);
  if (!ok1) return;
  const ok2 = await spendStamina(actor, 1);
  if (!ok2) return;

  const dmgType = await new Promise(resolve => {
    new Dialog({
      title: 'Diamond Body, Reverent Mind',
      content: `<p class="chat-hint-p">Choose resistance type:</p>`,
      buttons: {
        physical: { label: 'Physical', callback: () => resolve('Physical') },
        magykal:  { label: 'Magykal',  callback: () => resolve('Magykal')  },
        cancel:   { label: 'Cancel',   callback: () => resolve(null)        },
      },
      default: 'physical',
    }, { width: 280, classes: ['dialog','stryder-stat-popup'] }).render(true);
  });
  if (!dmgType) return;

  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Diamond Body, Reverent Mind',
    `${lordling?.name ?? 'Lordling'} reduces all <strong>${dmgType}</strong> damage taken by <strong>4</strong> until the start of the next Player Phase.`,
    'Swift · 1 TP · 1 STA'
  )});
}

async function lordlyBlinkAndMiss(actor, speaker, rollMode) {
  const lordling = getLinkedLordling(actor);
  const choice = await tacticDialog('Blink and Miss', { tp: 1 }, { tp: 2 });
  if (!choice) return;
  const ok = await spendTP(actor, choice.tpCost);
  if (!ok) return;
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    'Blink and Miss',
    `${lordling?.name ?? 'Lordling'} releases thick smoke blocking Line of Sight in a <strong>Magnitude 1 area</strong> centred on itself. Smoke lasts <strong>2 Rounds</strong>. ${lordling?.name ?? 'Lordling'} is unaffected by the smoke.`,
    `${choice.mode} · ${choice.tpCost} TP`
  )});
}

// ── Passive display ─────────────────────────────────────────
async function lordlyPassive(item, actor, speaker, rollMode) {
  await ChatMessage.create({ speaker, rollMode, content: shamanCard(
    item.name,
    item.system.description?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() ?? '',
    'Passive · Lordly Feature'
  )});
}
