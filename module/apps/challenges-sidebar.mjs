// module/apps/challenges-sidebar.mjs
// Sidebar tab button injection + ChallengesHub floating window.

import { FishingMinigame } from './fishing-minigame.mjs';

const CHALLENGES = [
  {
    id:          'fishing',
    name:        'Fishing',
    icon:        '🎣',
    description: 'Find fish hidden in a 4×4 pond. Earn Mana Pearls on lucky catches.',
    flavor:      'Requires: Fishing Rod or Fishing Tool',
    tags:        ['Patience', 'Grail', 'Mana Pearl'],
    available:   true,
  },
  { id: 'foraging', name: 'Foraging',  icon: '🌿', description: 'Search the wilds for herbs, mushrooms, and rare reagents.', flavor: 'Requires: Survival skill',    tags: ['Nature', 'Reagents'],  available: false },
  { id: 'mining',   name: 'Mining',    icon: '⛏',  description: 'Chip ore and gems from rock faces deep underground.',      flavor: 'Requires: Pickaxe',          tags: ['Strength', 'Ore'],     available: false },
];

// ── ChallengesHub Application ────────────────────────────────────────────────
class ChallengesHub extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:        'challenges-hub',
      title:     '⚔ Challenges & Activities',
      template:  'systems/stryder/templates/apps/challenges-hub.hbs',
      width:     360,
      height:    'auto',
      resizable: false,
      classes:   ['stryder', 'challenges-hub-app'],
    });
  }

  getData() {
    return { challenges: CHALLENGES };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.ch-play-btn[data-challenge]').click(ev => {
      const id = ev.currentTarget.dataset.challenge;
      _launchChallenge(id);
    });
  }

  static open() {
    const existing = Object.values(ui.windows).find(w => w.id === 'challenges-hub');
    if (existing) { existing.bringToTop(); return; }
    new ChallengesHub().render(true);
  }
}

function _getBestActor() {
  // 1. Assigned character for this user
  if (game.user?.character) return game.user.character;
  // 2. Currently controlled token on the canvas
  const controlled = canvas?.tokens?.controlled;
  if (controlled?.length === 1) return controlled[0].actor;
  // 3. Owned characters in the world (pick first)
  return game.actors?.find(a => a.type === 'character' && a.isOwner) ?? null;
}

function _launchChallenge(id) {
  if (id === 'fishing') {
    const actor = _getBestActor();
    if (!actor) ui.notifications.warn('Select or control a character token first so rewards can be added to their inventory.');
    FishingMinigame.open(actor);
  } else {
    ui.notifications.info(`${id} is not yet implemented — coming soon!`);
  }
}

// ── Sidebar button injection ─────────────────────────────────────────────────
export function registerChallengesSidebar() {
  Hooks.once('ready', () => { _inject(); setTimeout(_inject, 600); });
  Hooks.on('renderSidebar', () => setTimeout(_inject, 50));
}

function _inject() {
  const tabNav   = document.querySelector('#sidebar-tabs');
  const menuList = tabNav?.querySelector('menu') ?? tabNav;
  if (!menuList) return;
  if (menuList.querySelector('[data-challenge-tab]')) return;

  const li  = document.createElement('li');
  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'ui-control plain icon fa-solid fa-scroll';
  btn.setAttribute('role',              'tab');
  btn.setAttribute('aria-pressed',      'false');
  btn.setAttribute('data-group',        'primary');
  btn.setAttribute('aria-label',        'Challenges');
  btn.setAttribute('data-tooltip',      'Challenges');
  btn.setAttribute('data-challenge-tab','challenges');

  li.appendChild(btn);
  li.appendChild(Object.assign(document.createElement('div'), { className: 'notification-pip' }));

  const settingsLi = menuList.querySelector('[data-tab="settings"]')?.closest('li');
  settingsLi ? menuList.insertBefore(li, settingsLi) : menuList.appendChild(li);

  btn.addEventListener('click', ev => {
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    ChallengesHub.open();
  }, true);

  console.log('Stryder | Challenges button injected ✓');
}
