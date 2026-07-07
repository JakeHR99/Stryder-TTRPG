/**
 * Character Creation flow for the `protocharacter` actor type.
 *
 * Two views per step, toggled by [data-view] on the root form:
 *   browse — a carousel of big holographic cards; click one to
 *   reveal — the chosen card enlarged beside its details (and, for choice folk,
 *            an inline allocator), with Choose / Back.
 * Confirming the last step flips `flags.stryder.creation.complete`.
 *
 * Folk step: fixed folk apply talents/senses immediately via the shared
 * _applyFolkChoices pipeline; choice folk (Colossus, Floran, Traveler, Wildkin)
 * render an inline allocator whose values feed the same pipeline. Oumen's
 * allocator (origin + affliction) is a later pass.
 */

const FLAG_SCOPE = 'stryder';
const FLAG_KEY = 'creation';
const FOLK_PACK = 'stryder.stryder-folk';

/** Folk name (lowercased) → card art file under systems/stryder/assets/folk/. */
const FOLK_ART_DIR = 'systems/stryder/assets/folk';
const FOLK_ART = {
  colossus: 'colossus.png',
  descendant: 'descendant.png',
  feyfolk: 'feyfolk.png',
  floran: 'floran.png',
  halfling: 'halfling.png',
  oumen: 'oumen.png',
  remnant: 'remnant.png',
  smallfolk: 'smallfolk.png',
  sunborn: 'sunborn.png',
  traveler: 'traveler.png',
  wildkin: 'wildkin.png',
};
function folkArt(name) {
  const file = FOLK_ART[String(name ?? '').trim().toLowerCase()];
  return file ? `${FOLK_ART_DIR}/${file}` : null;
}

/** Ordered creation steps. `id` matches the choices key stored on the actor. */
export const CREATION_STEPS = [
  { id: 'folk',           noun: 'Folk',        title: 'Choose your Folk',            subtitle: 'The people you were born to.' },
  { id: 'life-origin',    noun: 'Life Origin', title: 'Choose your Life Origin',     subtitle: 'Who you were before you took the mantle.' },
  { id: 'stryder-origin', noun: 'Loadout',     title: 'Spend your Origin Points',    subtitle: 'Where your journey as a Stryder begins.' },
  { id: 'armament',       noun: 'Path',        title: 'Soul Armament or Alter Path', subtitle: 'The shape your power will take.' },
  { id: 'stats',          noun: 'Spread',      title: 'Choose your Stats',           subtitle: 'Distribute your potential.' },
  { id: 'xp',             noun: 'Plan',        title: 'Spend Experience',            subtitle: 'Hone your talents and senses.' },
  { id: 'mastery',        noun: 'Plan',        title: 'Spend Mastery',               subtitle: 'Refine what you have mastered.' },
];

/* -------------------------------------------- */
/*  State helpers                               */
/* -------------------------------------------- */

export function getCreationState(actor) {
  const data = actor?.getFlag(FLAG_SCOPE, FLAG_KEY);
  return foundry.utils.mergeObject(
    { complete: false, stepIndex: 0, choices: {} },
    data ?? {},
    { inplace: false }
  );
}

export function isCreationComplete(actor) {
  return getCreationState(actor)?.complete === true;
}

/* -------------------------------------------- */
/*  Step data                                   */
/* -------------------------------------------- */

/** Load selectable Folk from the compendium (+ any world folk items). */
async function getFolkCards() {
  const out = [];
  try {
    const pack = game.packs.get(FOLK_PACK);
    if (pack) {
      const docs = await pack.getDocuments();
      for (const d of docs) if (d.type === 'folk') out.push(d);
    }
  } catch (err) {
    console.warn('[Stryder Creation] Could not load folk pack:', err);
  }
  for (const i of (game.items?.filter(i => i.type === 'folk') ?? [])) out.push(i);

  const toCard = (d) => {
    const contain = String(d.name).trim().toLowerCase() === 'colossus';
    return {
      id: d.id,
      uuid: d.uuid,
      name: d.name,
      img: folkArt(d.name) || d.img || 'icons/svg/mystery-man.svg',
      tagline: 'Folk',
      description: d.system?.description || '<p>No description provided.</p>',
      contain,
      fit: contain ? 'contain' : 'cover',
    };
  };
  const cards = out.map(toCard);

  if (!cards.some(c => c.name?.trim().toLowerCase() === 'smallfolk')) {
    cards.push({
      id: 'smallfolk-placeholder',
      uuid: '',
      name: 'Smallfolk',
      img: folkArt('Smallfolk') || 'icons/svg/mystery-man.svg',
      tagline: 'Folk',
      description: '<p><em>Placeholder card.</em> Smallfolk are a small-statured folk, distinct from Halflings. A proper compendium entry is coming.</p>',
      contain: false,
      fit: 'cover',
    });
  }

  cards.sort((a, b) => a.name.localeCompare(b.name));
  return cards;
}

/** A single placeholder card for steps that aren't built yet. */
function wipCards(step) {
  return [{
    id: 'wip',
    uuid: '',
    name: step.title,
    img: 'icons/svg/mystery-man.svg',
    tagline: step.noun,
    description: `<p><em>This step isn't built yet.</em> It's a placeholder so the whole flow can be walked end to end. Choose to continue.</p>`,
    contain: false,
    fit: 'cover',
  }];
}

/**
 * Build the render context for the current creation step.
 * Receives the sheet so folk cards can be enriched with their allocator spec.
 */
export async function getCreationContext(sheet) {
  const actor = sheet.actor;
  const state = getCreationState(actor);
  const stepIndex = Math.max(0, Math.min(state.stepIndex ?? 0, CREATION_STEPS.length - 1));
  const step = CREATION_STEPS[stepIndex];

  let cards = [];
  let mode = 'select';
  if (step.id === 'folk') {
    cards = await getFolkCards();
    if (!cards.length) { mode = 'wip'; cards = wipCards(step); }
  } else {
    mode = 'wip';
    cards = wipCards(step);
  }

  // Enrich folk cards with allocator specs + flags.
  for (const c of cards) {
    let alloc = [];
    let needsChoices = false;
    if (step.id === 'folk' && c.id !== 'wip' && typeof sheet._folkChoiceInfo === 'function') {
      const info = sheet._folkChoiceInfo(c.name);
      needsChoices = info.needsChoices;
      alloc = (info.needsChoices && info.key && typeof sheet._folkAllocatorSpec === 'function')
        ? sheet._folkAllocatorSpec(info.key) : [];
    }
    c.needsChoices = needsChoices;
    c.hasAllocator = alloc.length > 0;
    c.pending = needsChoices && alloc.length === 0; // e.g. Oumen (allocator TBD)
    c.allocJson = JSON.stringify(alloc);
  }

  const isLast = stepIndex === CREATION_STEPS.length - 1;
  const chooseLabel = isLast
    ? 'Confirm & Finish'
    : (mode === 'wip' ? 'Continue' : `Choose this ${step.noun}`);

  return {
    stepIndex,
    stepNumber: stepIndex + 1,
    totalSteps: CREATION_STEPS.length,
    step,
    mode,
    cards,
    chooseLabel,
    chosenId: state.choices?.[step.id]?.id ?? '',
    isFirst: stepIndex === 0,
    isLast,
    steps: CREATION_STEPS.map((s, i) => ({
      id: s.id, title: s.title, num: i + 1,
      current: i === stepIndex, done: i < stepIndex,
    })),
  };
}

/* -------------------------------------------- */
/*  Math (ported from the holographic card pen)  */
/* -------------------------------------------- */

const round  = (v, p = 3) => parseFloat(v.toFixed(p));
const clamp  = (v, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const adjust = (v, fromMin, fromMax, toMin, toMax) =>
  round(toMin + ((toMax - toMin) * (v - fromMin)) / (fromMax - fromMin));

function attachHolo(card) {
  const wrap = card.closest('.sty-cc-holo');
  if (!wrap) return;
  const onMove = (e) => {
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = clamp((100 / rect.width) * (e.clientX - rect.left), 0, 100);
    const py = clamp((100 / rect.height) * (e.clientY - rect.top), 0, 100);
    const cx = px - 50;
    const cy = py - 50;
    const s = wrap.style;
    s.setProperty('--pointer-x', `${px}%`);
    s.setProperty('--pointer-y', `${py}%`);
    s.setProperty('--background-x', `${adjust(px, 0, 100, 35, 65)}%`);
    s.setProperty('--background-y', `${adjust(py, 0, 100, 35, 65)}%`);
    s.setProperty('--pointer-from-center', `${clamp(Math.hypot(py - 50, px - 50) / 50, 0, 1)}`);
    s.setProperty('--pointer-from-top', `${py / 100}`);
    s.setProperty('--pointer-from-left', `${px / 100}`);
    s.setProperty('--rotate-x', `${round(-(cx / 5))}deg`);
    s.setProperty('--rotate-y', `${round(cy / 4)}deg`);
    wrap.classList.add('is-holo');
    card.classList.add('active');
  };
  const onLeave = () => {
    card.classList.remove('active');
    wrap.classList.remove('is-holo');
    const s = wrap.style;
    s.setProperty('--pointer-from-center', '0');
    s.setProperty('--rotate-x', '0deg');
    s.setProperty('--rotate-y', '0deg');
    s.setProperty('--pointer-x', '50%');
    s.setProperty('--pointer-y', '50%');
    s.setProperty('--background-x', '50%');
    s.setProperty('--background-y', '50%');
  };
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerleave', onLeave);
}

/* -------------------------------------------- */
/*  Allocator (choice-folk inline choices)      */
/* -------------------------------------------- */

/** Render the allocator controls for a spec into a container. */
function buildAllocator(container, spec) {
  container.innerHTML = '';
  for (const ctrl of spec) {
    const block = document.createElement('div');
    block.className = 'sty-cc-alloc-block';
    block.dataset.kind = ctrl.kind;
    block.dataset.key = ctrl.key;
    if (ctrl.pool != null) block.dataset.pool = String(ctrl.pool);
    if (ctrl.cap != null) block.dataset.cap = String(ctrl.cap);
    if (ctrl.max != null) block.dataset.max = String(ctrl.max);
    if (ctrl.format) block.dataset.format = ctrl.format;

    const head = document.createElement('div');
    head.className = 'sty-cc-alloc-label';
    head.textContent = `${ctrl.label} `;
    if (ctrl.kind === 'pool' || ctrl.kind === 'multi') {
      const rem = document.createElement('span');
      rem.className = 'sty-cc-alloc-remain';
      head.appendChild(rem);
    }
    block.appendChild(head);

    if (ctrl.kind === 'pick') {
      const hasDesc = ctrl.options.some(o => o.desc);
      const row = document.createElement('div');
      row.className = hasDesc ? 'sty-cc-alloc-opts is-stacked' : 'sty-cc-alloc-opts';
      for (const o of ctrl.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sty-cc-alloc-pick';
        b.dataset.value = o.value;
        if (o.desc) {
          b.innerHTML = `<span class="sty-cc-pick-name">${o.label}</span><span class="sty-cc-pick-desc">${o.desc}</span>`;
        } else {
          b.textContent = o.label;
        }
        row.appendChild(b);
      }
      block.appendChild(row);
    } else if (ctrl.kind === 'pool') {
      const list = document.createElement('div');
      list.className = 'sty-cc-alloc-steppers';
      for (const o of ctrl.options) {
        const st = document.createElement('div');
        st.className = 'sty-cc-alloc-stepper';
        st.dataset.value = o.value;
        st.innerHTML =
          `<button type="button" class="sty-cc-step" data-d="-1">&minus;</button>` +
          `<span class="sty-cc-step-n">0</span>` +
          `<button type="button" class="sty-cc-step" data-d="1">+</button>` +
          `<label>${o.label}</label>`;
        list.appendChild(st);
      }
      block.appendChild(list);
    } else if (ctrl.kind === 'multi') {
      const grid = document.createElement('div');
      grid.className = 'sty-cc-alloc-grid';
      for (const o of ctrl.options) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sty-cc-alloc-chip';
        chip.dataset.value = o.value;
        chip.innerHTML =
          `<span class="sty-cc-chip-name">${o.label}</span>` +
          (o.desc ? `<span class="sty-cc-chip-desc">${o.desc}</span>` : '');
        grid.appendChild(chip);
      }
      block.appendChild(grid);
    }
    container.appendChild(block);
  }
}

/** Update counters + disabled states across an allocator; returns validity. */
function refreshAllocator(root) {
  const box = root.querySelector('.sty-cc-reveal-alloc');
  const chooseBtn = root.querySelector('[data-action="choose"]');
  const hasAlloc = root.dataset.pendingHasAlloc === '1';
  if (!box || !hasAlloc) { if (chooseBtn) chooseBtn.disabled = false; return true; }

  let allValid = true;
  box.querySelectorAll('.sty-cc-alloc-block').forEach(block => {
    const kind = block.dataset.kind;
    if (kind === 'pick') {
      if (!block.querySelector('.sty-cc-alloc-pick.is-sel')) allValid = false;
    } else if (kind === 'pool') {
      const pool = Number(block.dataset.pool);
      const cap = Number(block.dataset.cap);
      let sum = 0;
      block.querySelectorAll('.sty-cc-step-n').forEach(n => sum += Number(n.textContent) || 0);
      const remaining = pool - sum;
      block.querySelectorAll('.sty-cc-alloc-stepper').forEach(st => {
        const n = Number(st.querySelector('.sty-cc-step-n').textContent) || 0;
        const minus = st.querySelector('[data-d="-1"]');
        const plus = st.querySelector('[data-d="1"]');
        if (minus) minus.disabled = n <= 0;
        if (plus) plus.disabled = remaining <= 0 || n >= cap;
      });
      const rem = block.querySelector('.sty-cc-alloc-remain');
      if (rem) rem.textContent = `${remaining} left`;
      if (remaining !== 0) allValid = false;
    } else if (kind === 'multi') {
      const max = Number(block.dataset.max);
      const sel = block.querySelectorAll('.sty-cc-alloc-chip.is-sel').length;
      const remaining = max - sel;
      block.querySelectorAll('.sty-cc-alloc-chip').forEach(chip => {
        if (!chip.classList.contains('is-sel')) chip.classList.toggle('is-disabled', remaining <= 0);
      });
      const rem = block.querySelector('.sty-cc-alloc-remain');
      if (rem) rem.textContent = `${remaining} left`;
      if (sel !== max) allValid = false;
    }
  });

  if (chooseBtn) chooseBtn.disabled = !allValid;
  return allValid;
}

/** Read an allocator's controls into a `choices` object for _applyFolkChoices. */
function collectChoices(box) {
  const choices = {};
  box.querySelectorAll('.sty-cc-alloc-block').forEach(block => {
    const key = block.dataset.key;
    const kind = block.dataset.kind;
    if (kind === 'pick') {
      const sel = block.querySelector('.sty-cc-alloc-pick.is-sel');
      if (sel) choices[key] = sel.dataset.value;
    } else if (kind === 'pool') {
      if (block.dataset.format === 'array') {
        const arr = [];
        block.querySelectorAll('.sty-cc-alloc-stepper').forEach(st => {
          const n = Number(st.querySelector('.sty-cc-step-n').textContent) || 0;
          for (let i = 0; i < n; i++) arr.push(st.dataset.value);
        });
        choices[key] = arr;
      } else {
        const map = {};
        block.querySelectorAll('.sty-cc-alloc-stepper').forEach(st => {
          const n = Number(st.querySelector('.sty-cc-step-n').textContent) || 0;
          if (n > 0) map[st.dataset.value] = n;
        });
        choices[key] = map;
      }
    } else if (kind === 'multi') {
      choices[key] = [...block.querySelectorAll('.sty-cc-alloc-chip.is-sel')].map(c => c.dataset.value);
    }
  });
  return choices;
}

/* -------------------------------------------- */
/*  Interaction                                 */
/* -------------------------------------------- */

/** Populate the reveal view from a browse card and switch to it. */
function openReveal(root, wrap) {
  const d = wrap.dataset;
  const img   = root.querySelector('.sty-cc-reveal-img');
  const name  = root.querySelector('.sty-cc-reveal-name');
  const title = root.querySelector('.sty-cc-reveal-title');
  const desc  = root.querySelector('.sty-cc-reveal-desc');
  const descNode = wrap.querySelector('.sty-cc-carddesc');

  if (img)   { img.src = d.cardImg || ''; img.alt = d.cardName || ''; }
  if (name)  name.textContent = d.cardName || '';
  if (title) title.textContent = d.cardName || '';
  if (desc)  desc.innerHTML = descNode ? descNode.innerHTML : '';

  const revealArt = root.querySelector('.sty-cc-reveal-card .sty-cc-art');
  if (revealArt) revealArt.classList.toggle('is-contain', d.cardFit === 'contain');

  // Allocator (choice folk)
  let spec = [];
  const src = wrap.querySelector('.sty-cc-alloc-src');
  if (src) { try { spec = JSON.parse(src.textContent || '[]'); } catch (e) { spec = []; } }
  const allocBox = root.querySelector('.sty-cc-reveal-alloc');
  if (allocBox) {
    if (spec.length) {
      buildAllocator(allocBox, spec);
      allocBox.style.display = '';
    } else if (d.cardPending === '1') {
      allocBox.innerHTML = `<div class="sty-cc-alloc-note">This folk's allocator isn't built yet — choosing it records your pick; bonuses apply once it's added.</div>`;
      allocBox.style.display = '';
    } else {
      allocBox.innerHTML = '';
      allocBox.style.display = 'none';
    }
  }

  root.dataset.pendingId = d.cardId || '';
  root.dataset.pendingName = d.cardName || '';
  root.dataset.pendingImg = d.cardImg || '';
  root.dataset.pendingUuid = d.cardUuid || '';
  root.dataset.pendingHasAlloc = spec.length ? '1' : '';
  refreshAllocator(root);
  root.dataset.view = 'reveal';
}

/** Confirm the pending card as this step's choice and advance (or finish). */
async function onChoose(sheet, root) {
  const actor = sheet.actor;
  const id = root.dataset.pendingId;
  if (!id) { ui.notifications?.warn('Pick a card first.'); return; }

  const state = getCreationState(actor);
  const stepIndex = Math.max(0, Math.min(state.stepIndex ?? 0, CREATION_STEPS.length - 1));
  const step = CREATION_STEPS[stepIndex];
  const pendingName = root.dataset.pendingName;

  // ── Apply real effects for the Folk step ──
  if (step.id === 'folk' && id !== 'wip' && typeof sheet._applyCreationFolk === 'function') {
    let choices = null;
    if (root.dataset.pendingHasAlloc === '1') {
      if (!refreshAllocator(root)) { ui.notifications?.warn(`Finish allocating ${pendingName}'s choices first.`); return; }
      const box = root.querySelector('.sty-cc-reveal-alloc');
      choices = collectChoices(box);
    }
    try {
      const res = await sheet._applyCreationFolk(pendingName, choices);
      if (res.applied) {
        ui.notifications?.info(`${pendingName} applied${res.summary ? ` — ${res.summary}` : ''}.`);
      } else if (res.needsChoices) {
        ui.notifications?.warn(`${pendingName} recorded — its allocator is coming in a later pass.`);
      } else {
        ui.notifications?.warn(`No folk data found for ${pendingName} — pick recorded only.`);
      }
    } catch (err) {
      console.error('[Stryder Creation] Folk apply failed:', err);
      ui.notifications?.error(`Could not apply ${pendingName} — see console.`);
    }
  }

  const choices = foundry.utils.deepClone(state.choices ?? {});
  choices[step.id] = {
    id,
    name: pendingName,
    img: root.dataset.pendingImg,
    uuid: root.dataset.pendingUuid || '',
  };

  const isLast = stepIndex >= CREATION_STEPS.length - 1;
  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, {
    complete: isLast,
    stepIndex: isLast ? stepIndex : stepIndex + 1,
    choices,
  });

  if (isLast) ui.notifications?.info(`${actor.name} — character creation complete!`);
  sheet.render(false);
}

/**
 * Step the flow backward/forward. Navigating BACK onto a step undoes that
 * step's applied effects so it can be redone cleanly — folk is the only step
 * that applies effects so far, so returning to it strips its talents/senses.
 */
async function onNav(sheet, dir) {
  const actor = sheet.actor;
  const state = getCreationState(actor);
  const cur = state.stepIndex ?? 0;
  const next = Math.max(0, Math.min(cur + dir, CREATION_STEPS.length - 1));
  const choices = foundry.utils.deepClone(state.choices ?? {});

  if (dir < 0) {
    const folkIndex = CREATION_STEPS.findIndex(s => s.id === 'folk');
    if (next <= folkIndex && choices.folk && typeof sheet._clearCreationFolk === 'function') {
      await sheet._clearCreationFolk();
      delete choices.folk;
    }
  }

  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, { ...state, stepIndex: next, choices, complete: false });
  sheet.render(false);
}

/**
 * Attach all creation listeners. Called by the actor sheet's activateListeners
 * when the sheet is an uncreated protocharacter (normal wiring is skipped).
 */
export function activateCreationListeners(sheet, html) {
  const root = html?.[0] ?? html;
  if (!root) return;

  root.querySelectorAll('.sty-cc-card').forEach(card => attachHolo(card));

  root.querySelectorAll('.sty-cc-stage .sty-cc-cardwrap').forEach(wrap => {
    wrap.addEventListener('click', () => openReveal(root, wrap));
  });

  // Allocator interactions (delegated on the reveal allocator box).
  const allocBox = root.querySelector('.sty-cc-reveal-alloc');
  allocBox?.addEventListener('click', (e) => {
    const pick = e.target.closest('.sty-cc-alloc-pick');
    const step = e.target.closest('.sty-cc-step');
    const chip = e.target.closest('.sty-cc-alloc-chip');
    if (pick) {
      const block = pick.closest('.sty-cc-alloc-block');
      block.querySelectorAll('.sty-cc-alloc-pick').forEach(b => b.classList.remove('is-sel'));
      pick.classList.add('is-sel');
    } else if (step) {
      if (step.disabled) return;
      const st = step.closest('.sty-cc-alloc-stepper');
      const block = step.closest('.sty-cc-alloc-block');
      const nEl = st.querySelector('.sty-cc-step-n');
      const pool = Number(block.dataset.pool);
      const cap = Number(block.dataset.cap);
      let sum = 0;
      block.querySelectorAll('.sty-cc-step-n').forEach(x => sum += Number(x.textContent) || 0);
      let n = Number(nEl.textContent) || 0;
      if (Number(step.dataset.d) > 0 && sum < pool && n < cap) n++;
      else if (Number(step.dataset.d) < 0 && n > 0) n--;
      nEl.textContent = String(n);
    } else if (chip) {
      const block = chip.closest('.sty-cc-alloc-block');
      const max = Number(block.dataset.max);
      const sel = block.querySelectorAll('.sty-cc-alloc-chip.is-sel').length;
      if (chip.classList.contains('is-sel')) chip.classList.remove('is-sel');
      else if (sel < max) chip.classList.add('is-sel');
    } else {
      return;
    }
    refreshAllocator(root);
  });

  root.querySelector('[data-action="back-list"]')?.addEventListener('click', () => { root.dataset.view = 'browse'; });
  root.querySelector('[data-action="back-step"]')?.addEventListener('click', () => onNav(sheet, -1));
  root.querySelector('[data-action="choose"]')?.addEventListener('click', () => onChoose(sheet, root));
}
