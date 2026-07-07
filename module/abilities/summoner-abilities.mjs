// ============================================================
// STRYDER — Summoner Class Handler (The Binding Gates)
// ============================================================
// Architecture: persistent Spirit Beast actors, one per gate per
// Summoner, stored in a named folder. Temp bonuses are tracked
// via reversible flags/values — never baked into the actor data.
//
// Level 1–3 scope, future-proofed for L4+:
//   • Summon dialog: pick Gate, pay 2 Stamina OR sacrifice a
//     Rank 4 (G4) component.
//   • Resolves player's own linked beast; warns if generation
//     not done (no silent compendium import).
//   • Enforces concurrent-spirit limit (1; 2 at L4; 3 at L12).
//   • Spirit abilities cost the SUMMONER 1 Stamina; the first
//     Primary/Defense use per summon is free.
//   • On summon, beast copies summoner's Resistances and gains
//     +3 Magykal resist (applied fresh each summon; reverted on
//     dismiss via flag comparison).
//   • Reinforced Gates (L4+): +4 Health on first summon of each
//     gate each combat (per-gate tracking in Commit 2).
//   • End of combat: tokens removed, actors preserved.
// ============================================================

const SYSTEM_ID = 'stryder';
const PACK_ID = 'stryder.stryder-spirit-beasts';

export const GATES = {
  crimson: { packId: 'SprBstCrim01', name: 'Beast of Destruction', label: 'Crimson Gate', color: '#8B0000' },
  violet:  { packId: 'SprBstVllt02', name: 'Beast of Protection',  label: 'Violet Gate',  color: '#6A0DAD' },
  azure:   { packId: 'SprBstAzur03', name: 'Beast of Freedom',     label: 'Azure Gate',   color: '#00539C' },
  sage:    { packId: 'SprBstSage04', name: 'Beast of Solace',      label: 'Sage Gate',    color: '#2E7D32' },
};

const STAMINA_COST = 2;
const ABILITY_STAMINA_COST = 1;

// Canonical ability text per gate — sourced from _source/stryder-spirit-beasts/*.json.
// Used as a fallback when the compiled pack is stale and lacks the ability fields,
// and for the repair pass on existing ability-less beasts.
// NEVER auto-overwrite non-empty fields (player may have customized them).
const GATE_ABILITIES = {
  crimson: {
    primary: '<p>Make an attack with a range of 1 that deals <strong>5 damage</strong>.</p>',
    defense: '<p>When your Spirit takes damage, make a counter attack dealing <strong>3 damage</strong> to the creature that harmed it.</p>',
  },
  violet: {
    primary: '<p>If the Spirit is within 7 spaces of a creature who is the target of an Attack, it moves to the creature\'s side and takes the damage instead, then enters the nearest unoccupied space.</p>',
    defense: '<p>By bracing itself this Spirit takes <strong>3 less damage</strong> from the oncoming attack.</p>',
  },
  azure: {
    primary: '<p>If the Spirit is within 10 spaces of an ally that must make an Evasion roll, it swoops in and tries to fly them out of the affected area. The ally must still make an Evasion Roll but does not need to expend movement to do so.</p><p><strong>Primary II:</strong> You can evoke Hexes from this Spirit\'s location. You can also make Sense or Perception Checks from this Spirit\'s location; you gain a +2 when you do this.</p>',
    defense: '<p>This Spirit can use Dodge and Evasion. Its Dodge is equal to <strong>[1d6 + 4]</strong>.</p>',
  },
  sage: {
    primary: '<p>The Spirit inflicts the <strong>Energized</strong> Condition on 1 or 2 creatures within 3 Spaces.</p>',
    defense: '<p>When it becomes the target of an attack, its attacker becomes <strong>Shocked</strong>.</p>',
  },
};

// Creature size token name by tier (for prototype token width/height in grid units)
const SIZE_SMALL  = '0.5';  // pre-L8 default
const SIZE_MEDIUM = '1';    // granted by Size and Matter (L8)

/**
 * Returns true when an ability HTML field has no meaningful text content.
 * Handles empty strings, null/undefined, AND ProseMirror placeholders like
 * "<p></p>" or "<p><br></p>" that look empty on screen but aren't empty strings.
 */
function abilityIsEmpty(html) {
  if (!html?.trim()) return true;
  return !html.replace(/<[^>]*>/g, '').trim();
}

// ── Helpers ───────────────────────────────────────────────────

export function isSummoner(actor) {
  return (actor?.type === 'character' || actor?.type === 'protocharacter') && actor.system?.class?.name === 'Summoner';
}

export function maxSpirits(actor) {
  const level = Number(actor.system?.attributes?.level?.value ?? actor.system?.level?.value ?? 1) || 1;
  if (level >= 12) return 3;
  if (level >= 4) return 2;
  return 1;
}

function summonerLevel(actor) {
  return Number(actor.system?.attributes?.level?.value ?? actor.system?.level?.value ?? 1) || 1;
}

/** All world spirit-beast actors linked to this summoner. */
export function linkedSpirits(actor) {
  return game.actors.filter(a => a.type === 'spirit-beast' && a.system?.linkedCharacterId === actor.id);
}

/** Linked spirits that currently have a token on the active scene ("in combat"). */
export function activeSpirits(actor) {
  return linkedSpirits(actor).filter(a => a.getActiveTokens().length > 0);
}

/** Name of the beast folder for a given summoner. */
function beastFolderName(summoner) {
  return `${summoner.name}'s Spirit Beasts`;
}

function gateCard(borderColor, title, body) {
  return `<div style="background: url('systems/stryder/assets/parchment.jpg'); background-size: cover; padding: 15px; border: 2px solid ${borderColor}; border-radius: 4px;">
    <h3 style="margin-top: 0; border-bottom: 1px solid ${borderColor}; color: ${borderColor};">${title}</h3>
    ${body}
  </div>`;
}

// ── Beast Generation ──────────────────────────────────────────

/**
 * Show the generation dialog to the player. Routes execution to
 * GM via socket if the current user is not GM.
 */
export async function generateSpiritBeasts(actor) {
  if (!isSummoner(actor)) return ui.notifications.warn('Only Summoners can generate Spirit Beasts.');

  const existing    = linkedSpirits(actor);
  const existGates  = new Set(existing.map(b => b.system?.gate));
  const missing     = Object.keys(GATES).filter(g => !existGates.has(g));
  const folderName  = beastFolderName(actor);

  // Check for beasts that need ability repair
  const needsRepair = existing.filter(b => {
    const canon = GATE_ABILITIES[b.system?.gate];
    if (!canon) return false;
    return abilityIsEmpty(b.system?.abilities?.primary) || abilityIsEmpty(b.system?.abilities?.defense);
  });

  let statusHtml = '';
  if (existing.length > 0) {
    const rows = existing.map(b => {
      const g = GATES[b.system?.gate];
      const hasAbilities = b.system?.abilities?.primary?.trim() && b.system?.abilities?.defense?.trim();
      const badge = hasAbilities ? '' : ' <span style="color:#c84; font-size:0.85em;">(needs repair)</span>';
      return `<li style="color:${g?.color ?? '#aaa'};">✓ ${b.name}${badge}</li>`;
    }).join('');
    statusHtml = `<p style="margin-bottom:4px;"><strong>Already created:</strong></p><ul style="margin:0 0 8px 16px;">${rows}</ul>`;
  }

  let missingHtml = '';
  if (missing.length > 0) {
    const rows = missing.map(g => {
      const gd = GATES[g];
      return `<li style="color:${gd.color};">${gd.label} — ${gd.name}</li>`;
    }).join('');
    missingHtml = `<p style="margin-bottom:4px;"><strong>Will be created:</strong></p><ul style="margin:0 0 8px 16px;">${rows}</ul>`;
  }

  let repairHtml = '';
  if (needsRepair.length > 0) {
    repairHtml = `<p style="color:#c84; margin-bottom:4px;"><strong>Will repair (fill empty ability fields):</strong></p><ul style="margin:0 0 8px 16px;">${needsRepair.map(b => `<li>${b.name}</li>`).join('')}</ul>`;
  }

  // If nothing to do at all, skip the dialog and just run (for level sync)
  if (missing.length === 0 && needsRepair.length === 0) {
    // Still run to apply level sync (e.g. Size and Matter if newly at L8)
    if (game.user.isGM) {
      await _executeGenerateBeasts({ summonerId: actor.id });
    } else {
      if (!game.users.activeGM) return ui.notifications.error('A GM must be connected.');
      game.socket.emit(`system.${SYSTEM_ID}`, { type: 'generateBeasts', summonerId: actor.id });
    }
    return;
  }

  const content = `
    <div class="sty-dlg-body">
      <p>Generate/repair persistent <strong>Spirit Beast</strong> actors for <strong>${actor.name}</strong>.
        These actors will be saved in the <em>${folderName}</em> folder and will persist between sessions.
        You can rename and customize them freely.</p>
      ${statusHtml}${missingHtml}${repairHtml}
      <p style="font-style:italic; font-size:0.9em; color:#a0a0a0;">
        Generation requires a GM to be connected. Existing ability text is never overwritten.
      </p>
    </div>`;

  const confirmed = await new Promise(resolve => {
    new Dialog({
      title: 'Generate Spirit Beasts',
      content,
      buttons: {
        generate: {
          icon: '<i class="fas fa-paw"></i>',
          label: 'Generate',
          callback: () => resolve(true)
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel',
          callback: () => resolve(false)
        }
      },
      default: 'generate',
    }, { width: 440, classes: ['dialog', 'stryder-stat-popup'] }).render(true);
  });

  if (!confirmed) return;

  if (game.user.isGM) {
    await _executeGenerateBeasts({ summonerId: actor.id });
  } else {
    if (!game.users.activeGM) return ui.notifications.error('A GM must be connected to generate Spirit Beasts.');
    game.socket.emit(`system.${SYSTEM_ID}`, { type: 'generateBeasts', summonerId: actor.id });
    ui.notifications.info('Beast generation request sent to the GM…');
  }
}

/**
 * GM-side: create the beast folder (idempotent), create any missing gate actors
 * cloned from the compendium, repair empty ability fields on existing beasts
 * (never overwrites non-empty — player customization is preserved), then apply
 * level-gated stat syncs.
 */
export async function _executeGenerateBeasts({ summonerId }) {
  if (!game.user.isGM) return;
  const summoner = game.actors.get(summonerId);
  if (!summoner) return;

  // ── Find or create the beast folder ──────────────────────────
  const folderName = beastFolderName(summoner);
  let folder = game.folders.find(f => f.type === 'Actor' && f.name === folderName);
  if (!folder) {
    folder = await Folder.create({ name: folderName, type: 'Actor', color: '#4a1a6e' });
  }

  // ── Move any existing linked beasts into the folder ──────────
  const existing   = linkedSpirits(summoner);
  const existGates = new Set(existing.map(b => b.system?.gate));
  for (const beast of existing) {
    if (beast.folder?.id !== folder.id) {
      await beast.update({ folder: folder.id });
    }
  }

  // ── Repair pass: fill empty abilities on existing beasts ──────
  // Never overwrite non-empty fields — player may have customized them.
  const repaired = [];
  for (const beast of existing) {
    const gate     = beast.system?.gate;
    const canon    = GATE_ABILITIES[gate];
    if (!canon) continue;
    const curPrimary = beast.system?.abilities?.primary ?? '';
    const curDefense = beast.system?.abilities?.defense ?? '';
    const updates    = {};
    if (abilityIsEmpty(curPrimary)) updates['system.abilities.primary'] = canon.primary;
    if (abilityIsEmpty(curDefense)) updates['system.abilities.defense'] = canon.defense;
    if (Object.keys(updates).length) {
      await beast.update(updates);
      repaired.push(`${beast.name} (${Object.keys(updates).map(k => k.endsWith('primary') ? 'Primary' : 'Defense').join(', ')})`);
      console.log(`[Stryder] generateBeasts: repaired abilities on ${beast.name}:`, Object.keys(updates));
    }
  }

  // ── Create missing gate actors ────────────────────────────────
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications.error(`Compendium ${PACK_ID} not found.`);

  const created = [];
  for (const [gateKey, gateData] of Object.entries(GATES)) {
    if (existGates.has(gateKey)) continue;

    let source = await pack.getDocument(gateData.packId);
    if (!source) {
      const index = await pack.getIndex();
      const entry = index.find(e => e.name.includes(gateData.name));
      if (entry) source = await pack.getDocument(entry._id);
    }
    if (!source) {
      ui.notifications.error(`${gateData.name} not found in Spirit Beasts compendium — skipping.`);
      continue;
    }

    const data = source.toObject();
    delete data._id;
    data.name   = `${gateData.name} (${summoner.name})`;
    data.folder = folder.id;
    data.system.linkedCharacterId = summoner.id;
    data.ownership = foundry.utils.deepClone(summoner.ownership ?? { default: 0 });
    // Ensure the token is linked and friendly
    data.prototypeToken = foundry.utils.mergeObject(data.prototypeToken ?? {}, {
      disposition: 1,  // FRIENDLY
      actorLink: true,
    }, { inplace: false });

    // Ability fallback: if the compiled pack lacks ability text, apply canonical text.
    // This guards against a stale pack that was built before the ability fields were populated.
    const canon = GATE_ABILITIES[gateKey];
    if (canon) {
      if (!data.system?.abilities?.primary?.trim()) {
        data.system.abilities = data.system.abilities ?? {};
        data.system.abilities.primary = canon.primary;
      }
      if (!data.system?.abilities?.defense?.trim()) {
        data.system.abilities = data.system.abilities ?? {};
        data.system.abilities.defense = canon.defense;
      }
    }

    const beast = await Actor.create(data);
    created.push(beast.name);
  }

  // ── Level sync (Size and Matter, etc.) ───────────────────────
  const synced = await syncSpiritBeastsToLevel(summoner, { silent: true });

  // ── Announce ─────────────────────────────────────────────────
  const lines = [];
  if (created.length)  lines.push(`<p><strong>Created:</strong> ${created.join(', ')}</p>`);
  if (repaired.length) lines.push(`<p><strong>Repaired abilities:</strong> ${repaired.join(', ')}</p>`);
  if (synced.length)   lines.push(`<p><strong>Level sync applied:</strong> ${synced.join(', ')}</p>`);

  if (lines.length > 0) {
    ui.notifications.info(`Spirit Beasts updated for ${summoner.name}.`);
    await ChatMessage.create({
      content: gateCard('#4a1a6e', 'Spirit Beasts Updated',
        `<p><strong>${summoner.name}</strong>'s Spirit Beasts have been updated.</p>
         ${lines.join('')}
         <p><em>Find them in the "${folderName}" actor folder. Rename or customize them as you like.</em></p>`),
      speaker: ChatMessage.getSpeaker({ actor: summoner })
    });
  } else {
    ui.notifications.info(`All Spirit Beasts already up-to-date for ${summoner.name}.`);
  }
}

// ── Level sync ────────────────────────────────────────────────

/**
 * Apply level-gated stat changes to all persistent beasts for a Summoner.
 * Currently handles:
 *   L8 Size and Matter: creature_size → "1" (Medium) if currently the Small
 *     default ("0.5"). Only changes if the value is still the pre-L8 default —
 *     skip + log if the player has manually resized the beast.
 *
 * Future level gates (Commit 3+) should add cases here rather than duplicating logic.
 *
 * @param {Actor}   summoner
 * @param {object}  opts
 * @param {boolean} [opts.silent=false]  If true, suppress ui.notifications
 * @returns {string[]} Description of each change made (for chat/log reporting)
 */
export async function syncSpiritBeastsToLevel(summoner, { silent = false } = {}) {
  const level   = summonerLevel(summoner);
  const beasts  = linkedSpirits(summoner);
  const changes = [];

  for (const beast of beasts) {
    const curSize = beast.system?.attributes?.creature_size ?? SIZE_SMALL;
    const bName   = beast.name;

    // ── L8 Size and Matter ──────────────────────────────────────
    if (level >= 8) {
      if (curSize === SIZE_SMALL) {
        // Safe to upgrade: still at the default Small size
        const update = {
          'system.attributes.creature_size': SIZE_MEDIUM,
          'prototypeToken.width':  1,
          'prototypeToken.height': 1,
        };
        await beast.update(update);
        // Also resize any currently placed tokens (in-scene)
        for (const token of beast.getActiveTokens()) {
          await token.document.update({ width: 1, height: 1 });
        }
        changes.push(`${bName} → Medium (L8 Size and Matter)`);
        console.log(`[Stryder] syncSpiritBeastsToLevel: upgraded ${bName} to Medium.`);
      } else if (curSize !== SIZE_MEDIUM) {
        // Player has set a custom size — skip
        console.log(`[Stryder] syncSpiritBeastsToLevel: skipping ${bName} — creature_size is "${curSize}" (not default Small); may be player-customized.`);
      }
      // If already Medium ("1"), nothing to do
    }
    // Below L8: leave size as-is (never shrink a manually-resized beast)
  }

  if (changes.length && !silent) {
    ui.notifications.info(`Spirit Beast level sync: ${changes.join('; ')}`);
  }
  return changes;
}

// ── Summon Dialog ─────────────────────────────────────────────

export async function openSummonDialog(actor) {
  if (!isSummoner(actor)) return ui.notifications.warn('Only Summoners can open the Binding Gates.');

  const token = actor.getActiveTokens()[0];
  if (!token) return ui.notifications.warn(`${actor.name} has no token on the current scene — place one first.`);

  // Warn if beasts haven't been generated yet
  const beasts = linkedSpirits(actor);
  if (beasts.length === 0) {
    return ui.notifications.warn(
      `${actor.name} has no Spirit Beasts yet. Use the "Generate Spirit Beasts" button first.`
    );
  }

  const components = actor.items.filter(i =>
    i.type === 'component' && (i.system?.rank === '4' || (!i.system?.rank && i.system?.grade === 'G4'))
  );
  const componentOptions = components.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  // Only show gates for which the beast has been generated
  const beastByGate = Object.fromEntries(beasts.map(b => [b.system?.gate, b]));
  const gateButtons = Object.entries(GATES)
    .filter(([key]) => beastByGate[key])
    .map(([key, g]) => {
      const beast = beastByGate[key];
      const isActive = beast.getActiveTokens().length > 0;
      return `
        <label class="summoner-gate-choice" style="display:flex; align-items:center; gap:8px; padding:6px 10px; border:2px solid ${g.color}; border-radius:6px; cursor:pointer; margin-bottom:6px; opacity:${isActive ? '0.5' : '1'};">
          <input type="radio" name="gate" value="${key}" ${key === 'crimson' ? 'checked' : ''} ${isActive ? 'disabled' : ''}>
          <span style="color:${g.color}; font-weight:700;">${g.label}</span>
          <span style="margin-left:auto; font-style:italic;">${beast.name}${isActive ? ' — already summoned' : ''}</span>
        </label>`;
    }).join('');

  const content = `
    <form>
      <p style="margin-top:0;"><strong>Choose a Gate</strong></p>
      ${gateButtons || '<p style="color:#a00;">No Spirit Beasts are available for summoning.</p>'}
      <p><strong>Pay the cost</strong></p>
      <label style="display:block; margin-bottom:4px;">
        <input type="radio" name="costMethod" value="stamina" checked>
        Spend ${STAMINA_COST} Stamina (have: ${actor.system.stamina?.value ?? 0})
      </label>
      <label style="display:block;">
        <input type="radio" name="costMethod" value="component" ${components.length ? '' : 'disabled'}>
        Sacrifice a Rank 4 component ${components.length ? '' : '(none in inventory)'}
      </label>
      <div class="summoner-component-row" style="margin:6px 0 0 22px; display:none;">
        <select name="componentId" style="width:100%;">${componentOptions}</select>
      </div>
    </form>`;

  new Dialog({
    title: 'The Binding Gates — Summon a Spirit Beast',
    content,
    buttons: {
      summon: {
        icon: '<i class="fas fa-dungeon"></i>',
        label: 'Summon',
        callback: async (html) => {
          const gate = html.find('input[name="gate"]:checked').val();
          const costMethod = html.find('input[name="costMethod"]:checked').val();
          const componentId = html.find('select[name="componentId"]').val() || null;
          if (!gate) return ui.notifications.warn('Select a Gate first.');
          if (costMethod === 'stamina' && (actor.system.stamina?.value ?? 0) < STAMINA_COST) {
            return ui.notifications.warn(`Not enough Stamina — summoning costs ${STAMINA_COST}.`);
          }
          if (costMethod === 'component' && !componentId) {
            return ui.notifications.warn('No Rank 4 component selected.');
          }
          await requestSummon(actor, gate, costMethod, componentId);
        }
      },
      cancel: { icon: '<i class="fas fa-times"></i>', label: 'Cancel' }
    },
    default: 'summon',
    render: (html) => {
      html.find('input[name="costMethod"]').on('change', (ev) => {
        html.find('.summoner-component-row').toggle(ev.currentTarget.value === 'component');
      });
    }
  }).render(true);
}

// ── Summon execution (GM-side; players relay via socket) ─────

export async function requestSummon(actor, gate, costMethod, componentId) {
  if (game.user.isGM) {
    return executeSummon({ summonerId: actor.id, gate, costMethod, componentId });
  }
  if (!game.users.activeGM) return ui.notifications.error('A GM must be connected to summon Spirit Beasts.');
  game.socket.emit(`system.${SYSTEM_ID}`, { type: 'summonSpirit', summonerId: actor.id, gate, costMethod, componentId });
  ui.notifications.info('Summoning request sent to the GM…');
}

export async function executeSummon({ summonerId, gate, costMethod, componentId }) {
  const summoner = game.actors.get(summonerId);
  const gateData = GATES[gate];
  if (!summoner || !gateData) return;

  const token = summoner.getActiveTokens()[0];
  if (!token) return ui.notifications.warn(`${summoner.name} has no token on the current scene.`);

  // ── Resolve the player's own persistent beast for this gate ──
  const beast = linkedSpirits(summoner).find(b => b.system?.gate === gate);
  if (!beast) {
    return ui.notifications.warn(
      `${summoner.name} has no Spirit Beast for the ${gateData.label}. ` +
      `Generate Spirit Beasts first using the button on their sheet.`
    );
  }

  // ── If this beast is already out, just report ──
  if (beast.getActiveTokens().length > 0) {
    return ui.notifications.warn(`${beast.name} is already summoned.`);
  }

  // ── Pay the cost ──
  let costLine;
  if (costMethod === 'component') {
    const component = summoner.items.get(componentId);
    if (!component) return ui.notifications.warn('Component not found — it may have been used already.');
    costLine = `Sacrificed <strong>${component.name}</strong> (Rank 4 component) — no Stamina cost.`;
    await component.delete();
  } else {
    const stamina = summoner.system.stamina?.value ?? 0;
    if (stamina < STAMINA_COST) return ui.notifications.warn(`${summoner.name} lacks the ${STAMINA_COST} Stamina to summon.`);
    await summoner.update({ 'system.stamina.value': stamina - STAMINA_COST });
    costLine = `Paid <strong>${STAMINA_COST} Stamina</strong> (${stamina} → ${stamina - STAMINA_COST}).`;
  }

  // ── Enforce concurrent spirit limit: dismiss oldest ──
  const limit  = maxSpirits(summoner);
  const active = activeSpirits(summoner)
    .sort((a, b) => (a.getFlag(SYSTEM_ID, 'summonedAt') ?? 0) - (b.getFlag(SYSTEM_ID, 'summonedAt') ?? 0));
  while (active.length >= limit) {
    const oldest = active.shift();
    await dismissSpirit(oldest, { reason: 'replaced' });
  }

  // ── Compute base HP from raw source (never use prepared data which may drift) ──
  const rawMax = beast._source?.system?.health?.max;
  const baseMaxHP = (typeof rawMax === 'object' && rawMax !== null)
    ? Number(rawMax.value ?? 0) + Number(rawMax.mod ?? 0)
    : Number(rawMax ?? 0);

  // ── Reinforced Gates (L4+): +4 Health on first summon per gate each combat ──
  // Full per-gate tracking arrives in Commit 2; single flag covers L4 for now.
  let tempBonus = 0;
  let reinforcedLine = '';
  if (summonerLevel(summoner) >= 4 && game.combat?.started && !summoner.getFlag(SYSTEM_ID, 'reinforcedGatesUsed')) {
    tempBonus = 4;
    reinforcedLine = `<p><em>Reinforced Gates:</em> +4 Health on this summon.</p>`;
    await summoner.setFlag(SYSTEM_ID, 'reinforcedGatesUsed', true);
  }

  // Store temp bonus in flags so dismiss can read it (Commit 2 expands on this)
  await beast.setFlag(SYSTEM_ID, 'summonBaseMaxHP', baseMaxHP);
  await beast.setFlag(SYSTEM_ID, 'summonTempMaxBonus', tempBonus);

  // Apply summon state (fresh each summon; reverted on dismiss)
  await beast.update({
    'system.health.value':        baseMaxHP + tempBonus,
    'system.physical_reduction':  summoner.system.physical_reduction  ?? 0,
    'system.magykal_reduction':   summoner.system.magykal_reduction   ?? 0,
    'system.physical_resist_mod': summoner.system.physical_resist_mod ?? 0,
    'system.magykal_resist_mod':  (Number(summoner.system.magykal_resist_mod) || 0) + 3,
  });
  await beast.setFlag(SYSTEM_ID, 'freePrimaryDefenseUsed', false);
  await beast.setFlag(SYSTEM_ID, 'summonedAt', Date.now());
  // Record summoner resistances so dismiss can cleanly revert them
  await beast.setFlag(SYSTEM_ID, 'summonResistSnapshot', {
    physical_reduction:  summoner.system.physical_reduction  ?? 0,
    magykal_reduction:   summoner.system.magykal_reduction   ?? 0,
    physical_resist_mod: summoner.system.physical_resist_mod ?? 0,
    magykal_resist_mod:  (Number(summoner.system.magykal_resist_mod) || 0) + 3,
  });

  // ── Place the token ──
  const placed = await placeSpiritToken(beast, token);
  if (!placed) ui.notifications.warn('No unoccupied space within 3 spaces — drag the token out manually.');

  // ── Announce ──
  await ChatMessage.create({
    content: gateCard(gateData.color, `${gateData.label} Opens`, `
      <p><strong>${summoner.name}</strong> summons the <strong>${beast.name}</strong>!</p>
      <p>${costLine}</p>
      ${reinforcedLine}
      <p style="font-size:0.9em; font-style:italic;">Its first Primary or Defense Ability this summon costs no Stamina. Further abilities cost ${summoner.name} 1 Stamina each (Swift Actions).</p>
    `),
    speaker: ChatMessage.getSpeaker({ actor: summoner })
  });
  return beast;
}

/** Find a free grid space within 3 of the summoner token and drop the beast there. */
async function placeSpiritToken(beast, summonerToken) {
  const scene = summonerToken.scene ?? canvas.scene;
  const gs = scene.grid.size;
  const origin = { x: summonerToken.document.x, y: summonerToken.document.y };

  const occupied = (x, y, w, h) => scene.tokens.some(t => {
    const tw = t.width * gs, th = t.height * gs;
    return x < t.x + tw && x + w > t.x && y < t.y + th && y + h > t.y;
  });

  const proto = beast.prototypeToken;
  const w = (proto.width ?? 1) * gs, h = (proto.height ?? 1) * gs;

  // Spiral out: distance 1, then 2, then 3 (Chebyshev)
  for (let d = 1; d <= 3; d++) {
    for (let dx = -d; dx <= d; dx++) {
      for (let dy = -d; dy <= d; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const x = origin.x + dx * gs, y = origin.y + dy * gs;
        const dims = canvas?.dimensions;
        if (dims && (x < dims.sceneX || y < dims.sceneY || x + w > dims.sceneX + dims.sceneWidth || y + h > dims.sceneY + dims.sceneHeight)) continue;
        if (occupied(x, y, w, h)) continue;
        const tokenData = await beast.getTokenDocument({ x, y });
        await scene.createEmbeddedDocuments('Token', [tokenData.toObject()]);
        return true;
      }
    }
  }
  return false;
}

// ── Dismissal ─────────────────────────────────────────────────

export async function dismissSpirit(beast, { reason = 'dismissed', silent = false } = {}) {
  const gateData = GATES[beast.system?.gate] ?? { color: '#c9a66b', label: 'Gate', name: beast.name };

  // Remove all tokens — NEVER delete the actor
  for (const t of beast.getActiveTokens()) {
    await t.document.delete();
  }

  // Clear summon-session flags (temp bonuses evaporate with the token)
  await beast.unsetFlag(SYSTEM_ID, 'summonBaseMaxHP');
  await beast.unsetFlag(SYSTEM_ID, 'summonTempMaxBonus');
  await beast.unsetFlag(SYSTEM_ID, 'summonResistSnapshot');
  await beast.setFlag(SYSTEM_ID, 'freePrimaryDefenseUsed', false);
  await beast.unsetFlag(SYSTEM_ID, 'summonedAt');

  if (!silent) {
    const text = reason === 'replaced'
      ? `<p><strong>${beast.name}</strong> is sent back through its Gate as a new Spirit takes its place.</p>`
      : `<p><strong>${beast.name}</strong> returns through the ${gateData.label}, exiting combat.</p>`;
    await ChatMessage.create({
      content: gateCard(gateData.color, `${gateData.label} Closes`, text),
      speaker: ChatMessage.getSpeaker({ actor: beast })
    });
  }
}

export async function requestDismiss(actor) {
  const active = activeSpirits(actor);
  if (!active.length) return ui.notifications.warn('No Spirit Beasts are currently summoned.');
  if (game.user.isGM) {
    for (const beast of active) await dismissSpirit(beast);
  } else {
    game.socket.emit(`system.${SYSTEM_ID}`, { type: 'dismissSpirits', summonerId: actor.id });
  }
}

// ── Spirit Beast ability use (Primary / Defense) ──────────────

export async function useSpiritAbility(beast, which) {
  const content = which === 'primary' ? beast.system.abilities?.primary : beast.system.abilities?.defense;
  const title = which === 'primary' ? 'Primary Ability' : 'Defense Ability';
  if (!content) return ui.notifications.warn(`This Spirit has no ${title} recorded on its sheet.`);

  const gate = beast.system?.gate;
  const gateData = GATES[gate] ?? { color: '#c9a66b', label: 'Spirit Beast' };

  // ── Stamina cost, charged to the linked Summoner ──
  let costLine = '';
  const summoner = game.actors.get(beast.system?.linkedCharacterId);
  if (summoner) {
    const freeUsed = beast.getFlag(SYSTEM_ID, 'freePrimaryDefenseUsed') ?? false;
    if (!freeUsed) {
      await beast.setFlag(SYSTEM_ID, 'freePrimaryDefenseUsed', true);
      costLine = `<p style="font-size:0.9em;"><em>First Primary/Defense use this summon — no Stamina cost.</em></p>`;
    } else {
      const stamina = summoner.system.stamina?.value ?? 0;
      if (stamina < ABILITY_STAMINA_COST) {
        return ui.notifications.warn(`${summoner.name} has no Stamina left to fuel this ability (costs ${ABILITY_STAMINA_COST}).`);
      }
      await summoner.update({ 'system.stamina.value': stamina - ABILITY_STAMINA_COST });
      costLine = `<p style="font-size:0.9em;"><em>Swift Action — ${summoner.name} spends ${ABILITY_STAMINA_COST} Stamina (${stamina} → ${stamina - ABILITY_STAMINA_COST}).</em></p>`;
    }
  } else {
    costLine = `<p style="font-size:0.9em; color:#8B0000;"><em>No linked Summoner — apply the 1 Stamina cost manually.</em></p>`;
  }

  // ── Gate-specific extras ──
  let extra = '';

  // Crimson: attack buttons with damage-apply
  if (gate === 'crimson') {
    const dmg = which === 'primary' ? 5 : 3;
    extra = `<div style="margin-top:8px;">
      <button type="button" class="damage-apply-button" data-damage="${dmg}" style="width:100%;">
        <i class="fas fa-tint"></i> Apply ${dmg} Damage to Targeted Token
      </button>
    </div>`;
  }

  // Azure Defense: roll Dodge 1d6+4 automatically
  let rolls = [];
  if (gate === 'azure' && which === 'defense') {
    const roll = new Roll('1d6 + 4');
    await roll.evaluate();
    rolls = [roll];
    extra = `<p style="margin-top:8px;"><strong>Dodge Roll:</strong> <span style="font-size:1.2em; font-weight:700;">${roll.total}</span> (1d6 + 4)</p>`;
  }

  // Sage Primary: apply Energized to up to 2 targeted tokens
  if (gate === 'sage' && which === 'primary') {
    const targets = Array.from(game.user.targets).slice(0, 2);
    if (targets.length) {
      await applyStatusToTokens(targets.map(t => t.id), 'energized');
      extra = `<p style="margin-top:8px;"><em>Energized applied to: ${targets.map(t => t.name).join(', ')}</em></p>`;
    } else {
      extra = `<p style="margin-top:8px;"><em>Target 1–2 creatures within 3 spaces before using this ability to auto-apply Energized.</em></p>`;
    }
  }

  // Sage Defense: apply Shocked to targeted attacker
  if (gate === 'sage' && which === 'defense') {
    const targets = Array.from(game.user.targets).slice(0, 1);
    if (targets.length) {
      await applyStatusToTokens(targets.map(t => t.id), 'shocked');
      extra = `<p style="margin-top:8px;"><em>Shocked applied to: ${targets[0].name}</em></p>`;
    } else {
      extra = `<p style="margin-top:8px;"><em>Target the attacker before using this ability to auto-apply Shocked.</em></p>`;
    }
  }

  await ChatMessage.create({
    content: gateCard(gateData.color, `${beast.name} — ${title}`, `${content}${costLine}${extra}`),
    speaker: ChatMessage.getSpeaker({ actor: beast }),
    rolls
  });
}

async function applyStatusToTokens(tokenIds, statusId) {
  if (game.user.isGM) {
    for (const id of tokenIds) {
      const token = canvas.tokens.get(id);
      if (token?.actor) await token.actor.toggleStatusEffect(statusId, { active: true });
    }
  } else {
    game.socket.emit(`system.${SYSTEM_ID}`, { type: 'summonerApplyStatus', tokenIds, statusId });
  }
}

// ── Socket handler (called from stryder.mjs; GM clients only) ─

export async function handleSummonerSocket(data) {
  if (!game.user.isGM || game.user !== game.users.activeGM) return;
  switch (data.type) {
    case 'generateBeasts':
      await _executeGenerateBeasts(data);
      break;
    case 'summonSpirit':
      await executeSummon(data);
      break;
    case 'dismissSpirits': {
      const summoner = game.actors.get(data.summonerId);
      if (summoner) for (const beast of activeSpirits(summoner)) await dismissSpirit(beast);
      break;
    }
    case 'summonerApplyStatus':
      for (const id of data.tokenIds) {
        const token = canvas.tokens.get(id);
        if (token?.actor) await token.actor.toggleStatusEffect(data.statusId, { active: true });
      }
      break;
  }
}

// ── End-of-combat cleanup (called from stryderCombatEvent) ────

export async function handleSummonerCombatEnd() {
  if (!game.user.isGM) return;
  for (const summoner of game.actors.filter(a => isSummoner(a))) {
    await summoner.unsetFlag(SYSTEM_ID, 'reinforcedGatesUsed');
    for (const beast of activeSpirits(summoner)) {
      await dismissSpirit(beast, { reason: 'combat-end' });
    }
  }
}
