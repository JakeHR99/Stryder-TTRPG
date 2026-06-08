// ============================================================
// STRYDER — Summoner Class Handler (The Binding Gates)
// ============================================================
// Level 1–3 scope, future-proofed for L4+:
//   • Summon dialog: pick Gate, pay 2 Stamina OR sacrifice a
//     Rank 4 (G4) component.
//   • Spawns/links the Spirit Beast actor, places its token in
//     an unoccupied space within 3 spaces of the summoner.
//   • Enforces concurrent-spirit limit (1; 2 at L4; 3 at L12).
//   • Spirit abilities cost the SUMMONER 1 Stamina; the first
//     Primary/Defense use per summon is free.
//   • On summon, beast copies summoner's Resistances and gains
//     +3 Magykal resist.
//   • Reinforced Gates (L4+): +4 Health on first summon of each
//     combat.
//   • End of combat: spirits are sent through their Gates.
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

// ── Helpers ───────────────────────────────────────────────────

export function isSummoner(actor) {
  return actor?.type === 'character' && actor.system?.class?.name === 'Summoner';
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

function gateCard(borderColor, title, body) {
  return `<div style="background: url('systems/stryder/assets/parchment.jpg'); background-size: cover; padding: 15px; border: 2px solid ${borderColor}; border-radius: 4px;">
    <h3 style="margin-top: 0; border-bottom: 1px solid ${borderColor}; color: ${borderColor};">${title}</h3>
    ${body}
  </div>`;
}

// ── Summon Dialog ─────────────────────────────────────────────

export async function openSummonDialog(actor) {
  if (!isSummoner(actor)) return ui.notifications.warn('Only Summoners can open the Binding Gates.');

  const token = actor.getActiveTokens()[0];
  if (!token) return ui.notifications.warn(`${actor.name} has no token on the current scene — place one first.`);

  const components = actor.items.filter(i => i.type === 'component' && (i.system?.grade ?? '') === 'G4');
  const componentOptions = components.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  const gateButtons = Object.entries(GATES).map(([key, g]) => `
    <label class="summoner-gate-choice" style="display:flex; align-items:center; gap:8px; padding:6px 10px; border:2px solid ${g.color}; border-radius:6px; cursor:pointer; margin-bottom:6px;">
      <input type="radio" name="gate" value="${key}" ${key === 'crimson' ? 'checked' : ''}>
      <span style="color:${g.color}; font-weight:700;">${g.label}</span>
      <span style="margin-left:auto; font-style:italic;">${g.name}</span>
    </label>`).join('');

  const content = `
    <form>
      <p style="margin-top:0;"><strong>Choose a Gate</strong></p>
      ${gateButtons}
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

  // ── Get (or import) the beast actor ──
  let beast = game.actors.find(a =>
    a.type === 'spirit-beast' && a.system?.gate === gate && a.system?.linkedCharacterId === summoner.id);

  if (!beast) {
    const pack = game.packs.get(PACK_ID);
    if (!pack) return ui.notifications.error(`Compendium ${PACK_ID} not found.`);
    let source = await pack.getDocument(gateData.packId);
    if (!source) {
      const index = await pack.getIndex();
      const entry = index.find(e => e.name.includes(gateData.name));
      if (entry) source = await pack.getDocument(entry._id);
    }
    if (!source) return ui.notifications.error(`${gateData.name} not found in the Spirit Beasts compendium. Run the populate macro first.`);
    const data = source.toObject();
    delete data._id;
    data.name = `${gateData.name} (${summoner.name})`;
    data.system.linkedCharacterId = summoner.id;
    data.ownership = foundry.utils.deepClone(summoner.ownership ?? { default: 0 });
    beast = await Actor.create(data);
  }

  // ── If this beast is already out, just report ──
  if (beast.getActiveTokens().length > 0) {
    return ui.notifications.warn(`${beast.name} is already summoned.`);
  }

  // ── Enforce concurrent spirit limit: dismiss oldest ──
  const limit = maxSpirits(summoner);
  const active = activeSpirits(summoner)
    .sort((a, b) => (a.getFlag(SYSTEM_ID, 'summonedAt') ?? 0) - (b.getFlag(SYSTEM_ID, 'summonedAt') ?? 0));
  while (active.length >= limit) {
    const oldest = active.shift();
    await dismissSpirit(oldest, { reason: 'replaced' });
  }

  // ── Reset beast state for this summon ──
  const rawMax = beast.system.health?.max;
  let hpMax = (typeof rawMax === 'object' && rawMax !== null)
    ? Number(rawMax.value ?? 0) + Number(rawMax.mod ?? 0)
    : Number(rawMax ?? 0);

  // Reinforced Gates (L4+): +4 Health on first summon each combat
  let reinforcedLine = '';
  if (summonerLevel(summoner) >= 4 && game.combat?.started && !summoner.getFlag(SYSTEM_ID, 'reinforcedGatesUsed')) {
    hpMax += 4;
    reinforcedLine = `<p><em>Reinforced Gates:</em> +4 Health on this summon.</p>`;
    await summoner.setFlag(SYSTEM_ID, 'reinforcedGatesUsed', true);
  }

  await beast.update({
    'system.health.value': hpMax,
    'system.physical_reduction': summoner.system.physical_reduction ?? 0,
    'system.magykal_reduction': summoner.system.magykal_reduction ?? 0,
    'system.physical_resist_mod': summoner.system.physical_resist_mod ?? 0,
    'system.magykal_resist_mod': (Number(summoner.system.magykal_resist_mod) || 0) + 3,
  });
  await beast.setFlag(SYSTEM_ID, 'freePrimaryDefenseUsed', false);
  await beast.setFlag(SYSTEM_ID, 'summonedAt', Date.now());

  // ── Place the token in an unoccupied space within 3 spaces ──
  const placed = await placeSpiritToken(beast, token);
  if (!placed) ui.notifications.warn('No unoccupied space within 3 spaces — drag the token out manually.');

  // ── Announce ──
  await ChatMessage.create({
    content: gateCard(gateData.color, `${gateData.label} Opens`, `
      <p><strong>${summoner.name}</strong> summons the <strong>${gateData.name}</strong>!</p>
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
  for (const t of beast.getActiveTokens()) {
    await t.document.delete();
  }
  await beast.setFlag(SYSTEM_ID, 'freePrimaryDefenseUsed', false);
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
