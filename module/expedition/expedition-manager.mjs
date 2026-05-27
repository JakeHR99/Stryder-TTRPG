// ============================================================
// STRYDER — Expedition Manager
// ============================================================

const SYSTEM_ID = 'stryder';

// ── Animation map: roll table result → token WebM slug ────
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
  try {
    await partyTokenDoc.update({ 'texture.src': src });
  } catch(e) {
    console.warn('STRYDER | Could not swap party animation:', e);
  }
}

// Site type definitions
const SITE_TYPES = {
  start:   { label: 'Start',   color: '#44cc66', icon: 'systems/stryder/assets/tokens/site-start.svg' },
  end:     { label: 'End',     color: '#d4a830', icon: 'systems/stryder/assets/tokens/site-end.svg' },
  normal:  { label: 'Site',    color: '#4488ff', icon: 'icons/svg/circle.svg' },
  dungeon: { label: 'Dungeon', color: '#7a1515', icon: 'systems/stryder/assets/tokens/site-dungeon.svg' },
  haunt:   { label: 'Haunt',   color: '#5a5a6a', icon: 'systems/stryder/assets/tokens/site-haunt.svg' },
};

// ── Main entry point — called from stryder.mjs scene control button ──
export async function openExpeditionSetup() {
  // Get all Roll Tables in the world for the dropdown
  const tables = game.tables.contents;
  if (!tables.length) return ui.notifications.warn("No Roll Tables found. Create an Expedition Deck Roll Table first.");

  const tableOptions = tables.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  return new Promise((resolve) => {
    new Dialog({
      title: 'Generate Expedition Map',
      content: `
        <style>
          .exp-setup { font-family: inherit; }
          .exp-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
          .exp-row label { min-width: 140px; font-size: 12px; }
          .exp-row input, .exp-row select { flex: 1; }
          .exp-section { font-weight: bold; font-size: 12px; color: #aac; border-bottom: 1px solid rgba(100,140,200,0.3); padding-bottom: 4px; margin: 12px 0 8px; text-transform: uppercase; letter-spacing: 0.05em; }
          .exp-checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 12px; }
          .exp-sub { padding-left: 16px; border-left: 2px solid rgba(100,140,200,0.2); margin-bottom: 8px; }
        </style>
        <div class="exp-setup">
          <div class="exp-section">Expedition Deck</div>
          <div class="exp-row">
            <label>Roll Table:</label>
            <select id="exp-table">${tableOptions}</select>
          </div>
          <div class="exp-row">
            <label>Starting Time:</label>
            <select id="exp-time">
              <option value="day">Daytime</option>
              <option value="night">Nighttime</option>
            </select>
          </div>

          <div class="exp-section">Sites</div>
          <div class="exp-row">
            <label>Number of Sites:</label>
            <input id="exp-sites" type="number" min="2" max="30" value="10" />
          </div>

          <div class="exp-section">Special Sites</div>
          <div class="exp-checkbox-row">
            <input type="checkbox" id="exp-has-dungeon" />
            <label for="exp-has-dungeon">Include a Dungeon</label>
          </div>
          <div class="exp-sub" id="exp-dungeon-opts" style="display:none;">
            <div class="exp-row">
              <label>Dungeon Type:</label>
              <select id="exp-dungeon-type">
                <option value="parallel">Parallel</option>
                <option value="abhorrent">Abhorrent</option>
                <option value="barren">Barren</option>
                <option value="steelhollow">Steelhollow</option>
              </select>
            </div>
            <div class="exp-row">
              <label>Dungeon Rank:</label>
              <select id="exp-dungeon-rank">
                <option value="1">Rank 1</option>
                <option value="2">Rank 2</option>
                <option value="3">Rank 3</option>
                <option value="4">Rank 4</option>
                <option value="eternal">Eternal</option>
              </select>
            </div>
            <div class="exp-row">
              <label>Dungeon Position:</label>
              <select id="exp-dungeon-pos">
                <option value="random">Random (not start/end)</option>
                <option value="mid">Middle of path</option>
                <option value="late">Late in path</option>
              </select>
            </div>
          </div>

          <div class="exp-checkbox-row">
            <input type="checkbox" id="exp-has-haunt" />
            <label for="exp-has-haunt">Include a Haunt</label>
          </div>
          <div class="exp-sub" id="exp-haunt-opts" style="display:none;">
            <div class="exp-row" style="font-size:11px;opacity:0.7;">
              Haunt will be placed randomly on a normal Site (never at start/end or on a Dungeon).
            </div>
          </div>
        </div>
        <script>
          document.getElementById('exp-has-dungeon').addEventListener('change', function() {
            document.getElementById('exp-dungeon-opts').style.display = this.checked ? 'block' : 'none';
          });
          document.getElementById('exp-has-haunt').addEventListener('change', function() {
            document.getElementById('exp-haunt-opts').style.display = this.checked ? 'block' : 'none';
          });
        </script>
      `,
      buttons: {
        generate: {
          label: '⚔ Generate Expedition',
          callback: async (html) => {
            const config = {
              tableId:      html.find('#exp-table').val(),
              time:         html.find('#exp-time').val(),
              siteCount:    parseInt(html.find('#exp-sites').val()) || 10,
              hasDungeon:   html.find('#exp-has-dungeon').is(':checked'),
              dungeonType:  html.find('#exp-dungeon-type').val(),
              dungeonRank:  html.find('#exp-dungeon-rank').val(),
              dungeonPos:   html.find('#exp-dungeon-pos').val(),
              hasHaunt:     html.find('#exp-has-haunt').is(':checked'),
            };
            resolve(config);
            await placeExpeditionSites(config);
          }
        },
        cancel: { label: 'Cancel', callback: () => resolve(null) }
      },
      default: 'generate'
    }).render(true);
  });
}

// ── Site placement ─────────────────────────────────────────
async function placeExpeditionSites(config) {
  const scene = canvas.scene;
  if (!scene) return ui.notifications.warn("No active scene.");

  ui.notifications.info("Click to place the START point on the map...");
  const start = await getMapClick();
  if (!start) return;

  ui.notifications.info("Now click to place the END point...");
  const end = await getMapClick();
  if (!end) return;

  // Determine site types array
  const siteCount = Math.max(2, config.siteCount);
  // Indices 0 = start, 1..N-2 = middle sites, N-1 = end
  const siteTypes = new Array(siteCount).fill('normal');
  siteTypes[0] = 'start';
  siteTypes[siteCount - 1] = 'end';

  // Place dungeon at a middle site
  if (config.hasDungeon && siteCount > 2) {
    let dungeonIdx;
    if (config.dungeonPos === 'mid') {
      dungeonIdx = Math.floor(siteCount / 2);
    } else if (config.dungeonPos === 'late') {
      dungeonIdx = Math.floor(siteCount * 0.75);
    } else {
      // Random: any middle site
      dungeonIdx = 1 + Math.floor(Math.random() * (siteCount - 2));
    }
    siteTypes[dungeonIdx] = 'dungeon';
  }

  // Place haunt at a random middle site (not dungeon, not start/end)
  if (config.hasHaunt && siteCount > 2) {
    const eligible = [];
    for (let i = 1; i < siteCount - 1; i++) {
      if (siteTypes[i] === 'normal') eligible.push(i);
    }
    if (eligible.length) {
      const hauntIdx = eligible[Math.floor(Math.random() * eligible.length)];
      siteTypes[hauntIdx] = 'haunt';
    }
  }

  // Generate positions along path with slight organic randomization
  const gridSize = canvas.grid.size;
  const positions = [];
  for (let i = 0; i < siteCount; i++) {
    const t = i / (siteCount - 1);
    let x = start.x + (end.x - start.x) * t;
    let y = start.y + (end.y - start.y) * t;
    // Add randomization to middle sites
    if (i > 0 && i < siteCount - 1) {
      x += (Math.random() - 0.5) * gridSize * 3;
      y += (Math.random() - 0.5) * gridSize * 3;
    }
    // Snap to grid
    const snapped = canvas.grid.getSnappedPoint({ x, y }, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX });
    positions.push(snapped);
  }

  // Draw path lines between sites using drawings
  await drawExpeditionPath(positions, scene);

  // Create site tokens
  const tokenData = positions.map((pos, i) => {
    const type = siteTypes[i];
    const info = SITE_TYPES[type];
    const label = type === 'start' ? 'Start'
                : type === 'end'   ? 'End'
                : type === 'dungeon' ? `Dungeon (${config.dungeonType}, Rank ${config.dungeonRank})`
                : type === 'haunt' ? 'Haunt'
                : `Site ${i}`;

    return {
      name: label,
      x: pos.x,
      y: pos.y,
      width: 1,
      height: 1,
      texture: { src: info.icon },
      ring: { enabled: true, colors: { ring: info.color, background: '#000000' }, subject: { scale: 0.8, texture: info.icon } },
      displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS,
      actorLink: false,
      locked: true,
      disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
      flags: {
        [SYSTEM_ID]: {
          isExpeditionSite: true,
          siteType: type,
          siteIndex: i,
          visited: (type === 'start'), // start is pre-visited
          dungeonType: type === 'dungeon' ? config.dungeonType : null,
          dungeonRank: type === 'dungeon' ? config.dungeonRank : null,
        }
      }
    };
  });

  // We need a dummy actor to attach tokens to in v13 — use a world actor named "Expedition Site" or create one
  let siteActor = game.actors.getName('Expedition Site');
  if (!siteActor) {
    siteActor = await Actor.create({
      name: 'Expedition Site',
      type: 'monster',
      img: 'icons/svg/circle.svg',
      system: {},
      token: { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL }
    });
  }

  // Attach actor ID to token data
  const tokensWithActor = tokenData.map(t => ({ ...t, actorId: siteActor.id }));

  await scene.createEmbeddedDocuments('Token', tokensWithActor);

  // Store expedition state on the scene
  await scene.setFlag(SYSTEM_ID, 'isExpeditionMap', true);
  await scene.setFlag(SYSTEM_ID, 'expeditionTableId', config.tableId);
  await scene.setFlag(SYSTEM_ID, 'expeditionTime', config.time);
  await scene.setFlag(SYSTEM_ID, 'partyPoints', 4);
  await scene.setFlag(SYSTEM_ID, 'sitesVisited', 0);
  await scene.setFlag(SYSTEM_ID, 'hauntInsanity', 0);
  await scene.setFlag(SYSTEM_ID, 'dungeonActive', false);

  ui.notifications.info(`✅ Expedition generated! ${siteCount} sites placed. Move your party token to a Site to draw from the Expedition Deck.`);

  // Post setup summary to chat
  const dungeonNote = config.hasDungeon ? `\n🟣 **Dungeon** present (${config.dungeonType}, Rank ${config.dungeonRank})` : '';
  const hauntNote = config.hasHaunt ? `\n👻 **Haunt** present` : '';
  ChatMessage.create({
    content: `<div class="chat-message-card">
      <div class="chat-message-header">
        <div class="chat-message-title">⚔ Expedition Begins</div>
        <div class="chat-message-subtitle">${scene.name} — ${config.time === 'day' ? '☀ Daytime' : '🌙 Nighttime'}</div>
      </div>
      <div class="chat-message-content">
        <p><strong>${siteCount}</strong> Sites generated along the expedition path.${dungeonNote}${hauntNote}</p>
        <p style="font-size:11px;opacity:0.7;">Party Points: 4 | Move your party token onto a Site to draw from the Expedition Deck.</p>
      </div>
    </div>`
  });
}

// ── Draw path lines ────────────────────────────────────────
async function drawExpeditionPath(positions, scene) {
  if (positions.length < 2) return;
  const gs = canvas.grid.size;
  const half = gs / 2;

  // Build a single polyline through all site centers
  const points = positions.flatMap(p => [p.x + half, p.y + half]);

  await scene.createEmbeddedDocuments('Drawing', [{
    shape: {
      type: 'p',
      points,
      bezierFactor: 0.3,
    },
    strokeColor: '#aaccff',
    strokeWidth: 3,
    strokeAlpha: 0.6,
    fillType: CONST.DRAWING_FILL_TYPES.NONE,
    flags: { [SYSTEM_ID]: { isExpeditionPath: true } }
  }]);
}

// ── Wait for GM to click the canvas ───────────────────────
function getMapClick() {
  return new Promise((resolve) => {
    const handler = (event) => {
      canvas.stage.off('pointerdown', handler);
      // In Foundry v13 / PIXI v8, event.x/y are screen-space coords.
      // canvas.mousePosition is Foundry's world-space mouse tracker (updated on every pointermove).
      // Fallback: manually invert the stage transform from the event's global position.
      let pos;
      if (canvas.mousePosition) {
        pos = { x: canvas.mousePosition.x, y: canvas.mousePosition.y };
      } else {
        // canvas.stage.toLocal converts from global (screen) space → stage (world) space
        pos = canvas.stage.toLocal(event.global ?? { x: event.globalX, y: event.globalY });
      }
      resolve({ x: pos.x, y: pos.y });
    };
    // Short timeout allows dialog to close first
    setTimeout(() => canvas.stage.on('pointerdown', handler), 300);
  });
}

// ── Site event trigger ─────────────────────────────────────
export async function triggerSiteEvent(siteToken, scene, partyTokenDoc = null) {
  const flags = siteToken.flags?.[SYSTEM_ID] ?? {};
  const siteType = flags.siteType ?? 'normal';
  const siteIndex = flags.siteIndex ?? '?';

  // Mark visited
  await siteToken.setFlag(SYSTEM_ID, 'visited', true);

  // Update visit count
  const visited = (scene.getFlag(SYSTEM_ID, 'sitesVisited') ?? 0) + 1;
  await scene.setFlag(SYSTEM_ID, 'sitesVisited', visited);

  // Reduce party points
  const pp = Math.max(0, (scene.getFlag(SYSTEM_ID, 'partyPoints') ?? 4) - 1);
  await scene.setFlag(SYSTEM_ID, 'partyPoints', pp);

  if (siteType === 'start') return; // no event on start
  if (siteType === 'end') {
    ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title">🏁 Destination Reached!</div></div><div class="chat-message-content"><p>The party has reached their destination. The expedition is complete.</p></div></div>` });
    return;
  }

  if (siteType === 'dungeon') {
    await scene.setFlag(SYSTEM_ID, 'dungeonActive', true);
    const dungeonType = flags.dungeonType ?? 'Unknown';
    const dungeonRank = flags.dungeonRank ?? '?';
    await swapPartyAnimation(partyTokenDoc, 'skirmish'); // dungeon = combat ready
    ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title" style="color:#d0a8ff;">🟣 Dungeon Entered</div><div class="chat-message-subtitle">Site ${siteIndex}</div></div><div class="chat-message-content"><p>The party encounters a <strong>${dungeonType}</strong> Dungeon of <strong>Rank ${dungeonRank}</strong>.</p><p style="font-size:11px;opacity:0.7;">⚠ While a Dungeon is active, the Spring of Life card is removed from the Expedition Deck.</p></div></div>` });
    return;
  }

  if (siteType === 'haunt') {
    await swapPartyAnimation(partyTokenDoc, '???'); // haunt = uncertain/spooky
    ChatMessage.create({ content: `<div class="chat-message-card"><div class="chat-message-header"><div class="chat-message-title" style="color:#44ffcc;">👻 Haunt Discovered</div><div class="chat-message-subtitle">Site ${siteIndex}</div></div><div class="chat-message-content"><p>The party has entered a <strong>Haunt</strong>. The Ghost seals all exits.</p><p style="font-size:11px;opacity:0.7;">Insanity starts at 0. If Insanity reaches 5, the Ghost manifests. All Campsites, Treasure and Merchant cards are removed from the Expedition Deck while inside.</p></div></div>` });
    return;
  }

  // Normal site — draw from expedition deck
  await drawExpeditionCard(scene, siteIndex, partyTokenDoc);
}

// ── Draw from expedition deck ──────────────────────────────
async function drawExpeditionCard(scene, siteIndex, partyTokenDoc = null) {
  const tableId = scene.getFlag(SYSTEM_ID, 'expeditionTableId');
  const table = game.tables.get(tableId);
  if (!table) return ui.notifications.warn("Expedition Deck table not found!");

  // Check if dungeon is active — skip Spring of Life
  const dungeonActive = scene.getFlag(SYSTEM_ID, 'dungeonActive') ?? false;

  // Draw from table (replacement: false is set on the table itself)
  let draw = await table.draw({ displayChat: false });
  let result = draw.results[0];

  // If dungeon active and drew Spring of Life, draw again
  if (dungeonActive && result?.description?.includes('Spring of Life')) {
    ui.notifications.info("Dungeon active — Spring of Life skipped, drawing again...");
    draw = await table.draw({ displayChat: false });
    result = draw.results[0];
  }

  // If all cards drawn, reset deck
  if (!result) {
    ui.notifications.info("Expedition Deck exhausted — reshuffling...");
    await table.resetResults();
    draw = await table.draw({ displayChat: false });
    result = draw.results[0];
  }

  const eventName = result?.description?.replace(/<[^>]+>/g, '') ?? 'Unknown Event';

  // Swap party token animation to match the drawn result
  await swapPartyAnimation(partyTokenDoc, eventName);

  const time = scene.getFlag(SYSTEM_ID, 'expeditionTime') ?? 'day';
  const partyPoints = scene.getFlag(SYSTEM_ID, 'partyPoints') ?? 0;

  const eventColor = getEventColor(eventName);

  ChatMessage.create({
    content: `<div class="chat-message-card">
      <div class="chat-message-header">
        <div class="chat-message-title" style="color:${eventColor};">📍 Site ${siteIndex} — ${eventName}</div>
        <div class="chat-message-subtitle">${time === 'day' ? '☀ D