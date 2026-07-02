// ============================================================
// STRYDER — Open World Expedition Manager
// ============================================================
const SYSTEM_ID = 'stryder';

// ── Designation types available to the GM ─────────────────
const DESIGNATION_TYPES = {
  homebase: { label: 'Home Base',  color: '#b8922a', icon: 'systems/stryder/assets/tokens/site-start.svg' },
  village:  { label: 'Village',    color: '#4a8a4a', icon: 'icons/svg/village.svg' },
  dungeon:  { label: 'Dungeon',    color: '#7a1515', icon: 'systems/stryder/assets/tokens/site-dungeon.svg' },
  haunt:    { label: 'Haunt',      color: '#5a5a6a', icon: 'systems/stryder/assets/tokens/site-haunt.svg' },
  custom:   { label: 'Custom',     color: '#888888', icon: 'icons/svg/circle.svg' },
};

// ── Animation map (mirrors expedition-manager.mjs) ─────────
const ANIMATION_MAP = {
  'skirmish':              'pawn_run-knife',
  'scavenging':            'pawn_interact-pickaxe',
  'scavenging / fishing':  'pawn_interact-pickaxe',
  'peaceful':              'pawn-idle',
  'hunting / fishing':     'pawn_run-meat',
  'hunting':               'pawn_run-meat',
  'fishing':               'pawn_run-meat',
  'spring of life':        'pawn_idle-gold',
  'campsite':              'pawn_idle-wood',
  'obstacle':              'pawn_run-axe',
  'npc':                   'pawn_idle-hammer',
  'world masters choice':  'pawn_idle-meat',
  'treasure':              'pawn_run-gold',
  '???':                   'pawn_idle-knife',
};

async function swapPartyAnimation(partyTokenDoc, eventName) {
  if (!partyTokenDoc) return;
  const key = (eventName ?? '').toLowerCase().trim();
  const slug = ANIMATION_MAP[key] ?? 'pawn-idle';
  const src = `systems/stryder/assets/tokens/${slug}.webm`;
  try { await partyTokenDoc.update({ 'texture.src': src }); } catch(e) {}
}

// ── Haunt / Dungeon table filtering ───────────────────────
const HAUNT_EXCLUDE   = ['campsite', 'treasure', 'merchant'];
const DUNGEON_EXCLUDE = ['spring of life'];

async function drawFiltered(table, scene) {
  const hauntActive   = scene.getFlag(SYSTEM_ID, 'hauntActive')   ?? false;
  const dungeonActive = scene.getFlag(SYSTEM_ID, 'dungeonActive') ?? false;
  let result = null;
  let attempts = 0;

  while (attempts < 20) {
    // Auto-reset if table exhausted
    const undrawn = table.results.filter(r => !r.drawn);
    if (!undrawn.length) {
      await table.resetResults();
      ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">🔄 Expedition Deck Reshuffled</div></div><div class="chat-message-content"><p>All cards have been drawn. The Expedition Deck has been reset and reshuffled.</p></div></div>` });
    }
    const draw = await table.draw({ displayChat: false });
    const r = draw.results[0];
    if (!r) { attempts++; continue; }
    const name = (r.description ?? '').toLowerCase().replace(/<[^>]+>/g, '').trim();
    const skipHaunt   = hauntActive   && HAUNT_EXCLUDE.some(e => name.includes(e));
    const skipDungeon = dungeonActive && DUNGEON_EXCLUDE.some(e => name.includes(e));
    if (skipHaunt || skipDungeon) {
      const reason = skipHaunt ? 'Haunt active' : 'Dungeon active';
      ui.notifications.info(`${reason} — ${r.description?.replace(/<[^>]+>/g,'')} skipped, drawing again...`);
      attempts++;
      continue;
    }
    result = r;
    break;
  }
  return result;
}

// ── Hex identity from a pixel point ───────────────────────
// EVERYTHING derives from pixel points: the key via getOffset(point) and the
// center via getCenterPoint(point). We never convert an offset back to pixels
// — that reverse direction didn't round-trip on some hex grids, which is how
// the marker and the stored key ended up one hex apart.
function getHexKey(scene, x, y) {
  const offset = canvas.grid.getOffset({ x, y });
  return `${offset.i},${offset.j}`;
}

function getHexCenterFromPoint(x, y) {
  return canvas.grid.getCenterPoint({ x, y });
}

// ── Setup dialog ──────────────────────────────────────────
export async function openOpenWorldSetup() {
  const tables = game.tables.contents;
  if (!tables.length) return ui.notifications.warn("No Roll Tables found.");
  const tableOptions = tables.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  return new Promise((resolve) => {
    new Dialog({
      title: 'Generate Open World Expedition',
      content: `
        <style>
          .ow-setup .ow-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
          .ow-setup .ow-row label { min-width:160px; font-size:12px; }
          .ow-setup .ow-row input, .ow-setup .ow-row select { flex:1; }
          .ow-section { font-weight:bold;font-size:12px;color:#aac;border-bottom:1px solid rgba(100,140,200,0.3);padding-bottom:4px;margin:12px 0 8px;text-transform:uppercase;letter-spacing:.05em; }
        </style>
        <div class="ow-setup">
          <div class="ow-section">Expedition Deck</div>
          <div class="ow-row">
            <label>Roll Table:</label>
            <select id="ow-table">${tableOptions}</select>
          </div>
          <div class="ow-row">
            <label>Starting Time:</label>
            <select id="ow-time">
              <option value="day">Daytime</option>
              <option value="night">Nighttime</option>
            </select>
          </div>
          <div class="ow-section">Home Base</div>
          <div class="ow-row" style="font-size:11px;opacity:0.7;">
            After clicking Generate, click a hex on the map to place the Home Base.
          </div>
        </div>
      `,
      buttons: {
        generate: {
          label: '🌍 Generate Open World',
          callback: async (html) => {
            const config = {
              tableId: html.find('#ow-table').val(),
              time:    html.find('#ow-time').val(),
            };
            resolve(config);
            await setupOpenWorld(config);
          }
        },
        cancel: { label: 'Cancel', callback: () => resolve(null) }
      },
      default: 'generate'
    }).render(true);
  });
}

// ── Scene setup ───────────────────────────────────────────
async function setupOpenWorld(config) {
  const scene = canvas.scene;
  if (!scene) return ui.notifications.warn("No active scene.");

  ui.notifications.info("Click a hex to place the Home Base...");
  const click = await getCanvasClick();
  if (!click) return;

  const hexKey = getHexKey(scene, click.x, click.y);
  const center = getHexCenterFromPoint(click.x, click.y);
  console.log(`Stryder | home base stored as [${hexKey}] with marker center`, center);

  // Set scene flags
  await scene.setFlag(SYSTEM_ID, 'isOpenWorld', true);
  await scene.setFlag(SYSTEM_ID, 'openWorldTableId', config.tableId);
  await scene.setFlag(SYSTEM_ID, 'openWorldTime', config.time);
  await scene.setFlag(SYSTEM_ID, 'hauntActive', false);
  await scene.setFlag(SYSTEM_ID, 'dungeonActive', false);

  // Initialise hex state map with home base
  const hexStates = {};
  hexStates[hexKey] = { state: 'homebase', designation: 'homebase' };
  await scene.setFlag(SYSTEM_ID, 'openWorldHexes', hexStates);

  // Place home base marker token
  await placeMarkerToken(scene, hexKey, center, {
    name: 'Home Base',
    color: DESIGNATION_TYPES.homebase.color,
    icon: DESIGNATION_TYPES.homebase.icon,
    state: 'homebase',
  });

  ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">🌍 Open World Expedition Begins</div><div class="chat-message-subtitle">${scene.name} — ${config.time === 'day' ? '☀ Daytime' : '🌙 Nighttime'}</div></div><div class="chat-message-content"><p>Home Base established. Move the party token to explore hexes and draw from the Expedition Deck.</p></div></div>` });
  ui.notifications.info("✅ Open World generated! Move your party token to explore.");
}

// ── Place a pin marker token on a hex ─────────────────────
async function placeMarkerToken(scene, hexKey, center, opts) {
  // Hex cells are not square — use the grid's true cell box (sizeX/sizeY)
  // so the half-size marker genuinely centers on its hex. The old square
  // gs*0.25 offset drifted markers toward neighboring hexes.
  const pxW = 0.5 * canvas.grid.sizeX;
  const pxH = 0.5 * canvas.grid.sizeY;

  // Ensure marker actor exists
  let markerActor = game.actors.getName('Expedition Marker');
  if (!markerActor) {
    markerActor = await Actor.create({
      name: 'Expedition Marker',
      type: 'monster',
      img: 'icons/svg/circle.svg',
      system: {},
    });
  }

  const tokenData = {
    name: opts.name,
    x: center.x - pxW / 2,
    y: center.y - pxH / 2,
    width: 0.5,
    height: 0.5,
    actorId: markerActor.id,
    actorLink: false,
    locked: true,
    displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
    texture: { src: opts.icon },
    ring: { enabled: true, colors: { ring: opts.color, background: '#000000' }, subject: { scale: 0.8, texture: opts.icon } },
    disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
    flags: {
      [SYSTEM_ID]: {
        isOpenWorldMarker: true,
        hexKey,
        markerState: opts.state,
      }
    }
  };

  const created = await scene.createEmbeddedDocuments('Token', [tokenData]);
  return created[0];
}

// ── Main movement handler — called from stryder.mjs hook ──
export async function handleOpenWorldMove(tokenDoc, scene) {
  // Let core compute the token's grid-aware center from DOCUMENT data (the
  // final destination, not the mid-animation sprite). Manual size math kept
  // resolving neighbor hexes because hex bounding boxes differ between
  // row/column orientations.
  const c = (typeof tokenDoc.getCenterPoint === 'function')
    ? tokenDoc.getCenterPoint()
    : { x: tokenDoc.x + ((tokenDoc.width  ?? 1) * canvas.grid.sizeX) / 2,
        y: tokenDoc.y + ((tokenDoc.height ?? 1) * canvas.grid.sizeY) / 2 };
  const hexKey = getHexKey(scene, c.x, c.y);
  const center = getHexCenterFromPoint(c.x, c.y);

  // Check if hex has changed since last move
  const lastHex = tokenDoc.getFlag(SYSTEM_ID, 'currentHex');
  if (lastHex === hexKey) return; // same hex, no action
  await tokenDoc.setFlag(SYSTEM_ID, 'currentHex', hexKey);

  // Get current hex state
  const hexStates = foundry.utils.duplicate(scene.getFlag(SYSTEM_ID, 'openWorldHexes') ?? {});
  const hexData = hexStates[hexKey];

  if (hexData?.state === 'homebase') {
    await swapPartyAnimation(tokenDoc, 'peaceful');
    ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title" style="color:#b8922a;">🏠 Home Base</div></div><div class="chat-message-content"><p>The party returns to the Home Base.</p></div></div>` });
    return;
  }

  if (hexData?.state === 'designated') {
    // GM pre-designated this hex — show its designation, no table draw
    const desig = DESIGNATION_TYPES[hexData.designation] ?? DESIGNATION_TYPES.custom;
    await swapPartyAnimation(tokenDoc, hexData.designation);
    ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">📍 ${desig.label}</div></div><div class="chat-message-content"><p>The party enters a designated <strong>${desig.label}</strong>.</p></div></div>` });
    return;
  }

  if (hexData?.state === 'explored') {
    // Already explored — show cached result, no re-roll
    ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title" style="opacity:0.7;">📍 Previously Explored</div></div><div class="chat-message-content"><p>The party revisits this area. It was previously: <strong>${hexData.result}</strong>.</p></div></div>` });
    await swapPartyAnimation(tokenDoc, hexData.result);
    return;
  }

  // Unexplored hex — draw from table
  const tableId = scene.getFlag(SYSTEM_ID, 'openWorldTableId');
  const table = game.tables.get(tableId);
  if (!table) return ui.notifications.warn("Expedition Deck table not found!");

  const result = await drawFiltered(table, scene);
  if (!result) return;

  const eventName = result.description?.replace(/<[^>]+>/g, '').trim() ?? 'Unknown';

  // Record in hex state map
  hexStates[hexKey] = { state: 'explored', result: eventName };

  // Handle special site types
  if (eventName.toLowerCase().includes('dungeon')) {
    await scene.setFlag(SYSTEM_ID, 'dungeonActive', true);
    hexStates[hexKey].designation = 'dungeon';
  }
  if (eventName.toLowerCase().includes('haunt')) {
    await scene.setFlag(SYSTEM_ID, 'hauntActive', true);
    hexStates[hexKey].designation = 'haunt';
  }

  await scene.setFlag(SYSTEM_ID, 'openWorldHexes', hexStates);

  // Place explored pin marker
  const eventColor = getEventColor(eventName);
  await placeMarkerToken(scene, hexKey, center, {
    name: eventName,
    color: eventColor,
    icon: 'systems/stryder/assets/tokens/site-explored.svg',
    state: 'explored',
  });

  // Swap party animation
  await swapPartyAnimation(tokenDoc, eventName);

  // Post chat card
  const time = scene.getFlag(SYSTEM_ID, 'openWorldTime') ?? 'day';
  ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title" style="color:${eventColor};">📍 ${eventName}</div><div class="chat-message-subtitle">${time === 'day' ? '☀ Daytime' : '🌙 Nighttime'} · Open World</div></div><div class="chat-message-content"><p>The party explores new territory and draws from the Expedition Deck.</p><p><strong>Result: ${eventName}</strong></p></div></div>` });
}

// ── GM: Designate a hex ───────────────────────────────────
export async function designateHexPrompt() {
  const scene = canvas.scene;
  if (!scene?.getFlag(SYSTEM_ID, 'isOpenWorld')) {
    return ui.notifications.warn("No open world expedition active on this scene.");
  }

  const desigOptions = Object.entries(DESIGNATION_TYPES)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

  const desigType = await new Promise((resolve) => {
    new Dialog({
      title: 'Designate Hex',
      content: `
        <div style="margin-bottom:10px;font-size:12px;opacity:0.7;">Click OK, then click a hex on the map to designate it.</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <label style="min-width:120px;font-size:12px;">Designation:</label>
          <select id="desig-type" style="flex:1;">${desigOptions}</select>
        </div>
        <div class="dlg-mt-8">
          <label style="font-size:12px;">Custom label (optional):</label>
          <input id="desig-label" type="text" class="dlg-input-full" placeholder="e.g. Ancient Ruins" />
        </div>
      `,
      buttons: {
        ok: {
          label: 'Pick Hex',
          callback: (html) => resolve({
            type: html.find('#desig-type').val(),
            label: html.find('#desig-label').val().trim(),
          })
        },
        cancel: { label: 'Cancel', callback: () => resolve(null) }
      },
      default: 'ok'
    }).render(true);
  });

  if (!desigType) return;

  ui.notifications.info("Click the hex you want to designate...");
  const click = await getCanvasClick();
  if (!click) return;

  const hexKey = getHexKey(scene, click.x, click.y);
  const center = getHexCenterFromPoint(click.x, click.y);

  const desig = DESIGNATION_TYPES[desigType.type] ?? DESIGNATION_TYPES.custom;
  const displayLabel = desigType.label || desig.label;

  // Update hex state map
  const hexStates = foundry.utils.duplicate(scene.getFlag(SYSTEM_ID, 'openWorldHexes') ?? {});

  // Remove any existing marker on this hex
  const existing = scene.tokens.find(t =>
    t.getFlag(SYSTEM_ID, 'isOpenWorldMarker') && t.getFlag(SYSTEM_ID, 'hexKey') === hexKey
  );
  if (existing) await scene.deleteEmbeddedDocuments('Token', [existing.id]);

  hexStates[hexKey] = { state: 'designated', designation: desigType.type, label: displayLabel };
  await scene.setFlag(SYSTEM_ID, 'openWorldHexes', hexStates);

  await placeMarkerToken(scene, hexKey, center, {
    name: displayLabel,
    color: desig.color,
    icon: desig.icon,
    state: 'designated',
  });

  ui.notifications.info(`✅ Hex designated as: ${displayLabel}`);
}

// ── Reset the expedition deck ─────────────────────────────
export async function resetOpenWorldTable() {
  const scene = canvas.scene;
  if (!scene?.getFlag(SYSTEM_ID, 'isOpenWorld')) return;
  const tableId = scene.getFlag(SYSTEM_ID, 'openWorldTableId');
  const table = game.tables.get(tableId);
  if (!table) return;
  await table.resetResults();
  ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">🔄 Expedition Deck Reset</div></div><div class="chat-message-content"><p>The GM has reset the Expedition Deck. All cards are back in the deck.</p></div></div>` });
  ui.notifications.info("Expedition Deck reset.");
}

// ── Clear open world from scene ───────────────────────────
export async function clearOpenWorld() {
  const scene = canvas.scene;
  if (!scene) return;
  const markerIds = scene.tokens
    .filter(t => t.getFlag(SYSTEM_ID, 'isOpenWorldMarker'))
    .map(t => t.id);
  if (markerIds.length) await scene.deleteEmbeddedDocuments('Token', markerIds);
  for (const key of ['isOpenWorld','openWorldTableId','openWorldTime','openWorldHexes','hauntActive','dungeonActive']) {
    await scene.unsetFlag(SYSTEM_ID, key);
  }
  ui.notifications.info("Open World expedition cleared.");
}

// ── Canvas click helper ───────────────────────────────────
// Capture the click on the DOM canvas element and convert through Foundry's
// own client→canvas transform. Both canvas.mousePosition and PIXI
// getLocalPosition delivered x-shifted points here (home base landed one
// hex off), so we bypass the PIXI event pipeline entirely.
function getCanvasClick() {
  return new Promise((resolve) => {
    const view = canvas.app.view;
    const handler = (ev) => {
      view.removeEventListener('pointerdown', handler);
      // Screen point relative to the canvas element, inverted through the
      // stage's world transform: screen = world × M  ⇒  world = screen × M⁻¹.
      // (canvasCoordinatesFromClient applied the transform the wrong way —
      // click deltas came back multiplied by zoom instead of divided.)
      const rect = view.getBoundingClientRect();
      const local = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      const pos = canvas.stage.worldTransform.applyInverse(local);
      console.log(
        `Stryder | open-world click: client(${ev.clientX},${ev.clientY}) local(${Math.round(local.x)},${Math.round(local.y)}) zoom(${canvas.stage.scale.x.toFixed(3)}) → world(${Math.round(pos.x)},${Math.round(pos.y)}) → offset`,
        canvas.grid.getOffset(pos)
      );
      resolve({ x: pos.x, y: pos.y });
    };
    setTimeout(() => view.addEventListener('pointerdown', handler), 300);
  });
}

// ── Event colour helper ───────────────────────────────────
function getEventColor(name) {
  const n = name.toLowerCase();
  if (n.includes('skirmish'))  return '#ff6666';
  if (n.includes('dungeon'))   return '#d0a8ff';
  if (n.includes('haunt'))     return '#44ffcc';
  if (n.includes('treasure'))  return '#ffdd44';
  if (n.includes('campsite'))  return '#88ff88';
  if (n.includes('spring'))    return '#44ffaa';
  if (n.includes('obstacle'))  return '#ff9944';
  if (n.includes('peaceful'))  return '#aaddff';
  return '#c8d8f0';
}
