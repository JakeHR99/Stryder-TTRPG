// ============================================================
// STRYDER — Generic Action Method Picker
// ============================================================
// Parses <li> variant options from an action item's description
// and shows a selection dialog before the ability fires.
//
// Triggered for any action item where the description contains
// 2+ <li> entries whose first entry has a "Key: body" colon format
// (e.g. "M1: +1 to Attack Roll", "Fire: ...", "Light: ...").
//
// Returns the chosen option object, or null if cancelled.
// ============================================================

/**
 * Parse method options from an item description.
 * Supports two formats:
 *   1. <ul><li>M1: text</li>...</ul>         (canonical source format)
 *   2. <p><strong>Method 1:</strong> text</p> (older manually-edited format)
 * Returns null if no keyed multi-option list is detected.
 */
function parseOptions(item) {
  const desc = item.system.description ?? '';

  // ── Format 1: <li> list ────────────────────────────────────────────────
  const liMatches = [...desc.matchAll(/<li>(.*?)<\/li>/gs)];
  if (liMatches.length >= 2) {
    const first = liMatches[0][1].replace(/<[^>]+>/g, '').trim();
    if (first.includes(':')) return liMatches.map(m => buildOption(m[1]));
  }

  // ── Format 2: <p> paragraphs with <strong>Key:</strong> ───────────────
  // Matches <p>...<strong>Key:</strong> body</p> OR <p><strong>Key:</strong> body</p>
  const pMatches = [...desc.matchAll(/<p[^>]*>(?:[^<]*<[^>]+>[^<]*)*?<strong>([^:<]{1,40}):<\/strong>\s*(.*?)<\/p>/gs)];
  if (pMatches.length >= 2) {
    return pMatches.map(m => {
      const key  = m[1].replace(/<[^>]+>/g, '').trim();
      const body = m[2].replace(/<[^>]+>/g, '').trim();
      return buildOption(`${key}: ${body}`);
    });
  }

  return null; // no recognised multi-option format
}

function buildOption(rawHTML) {
  const plain = rawHTML.replace(/<[^>]+>/g, '').trim();
  const colonIdx = plain.indexOf(':');
  const key  = colonIdx > 0 ? plain.slice(0, colonIdx).trim() : plain;
  const body = colonIdx > 0 ? plain.slice(colonIdx + 1).trim() : '';

  // Parse attack roll modifier
  // Handles: "+1 to Attack Roll", "-4 to attack", "-1 Attack Roll"
  let attackMod = 0;
  const atkMatch = plain.match(/([+-]\d+)\s*(?:to\s+)?(?:your\s+|this\s+)?attack(?:\s+roll)?\b/i);
  if (atkMatch) attackMod = parseInt(atkMatch[1]);

  // Parse damage modifier
  // Handles: "+2 additional damage", "-1 base damage"
  let damageMod = 0;
  const dmgMatch = plain.match(/([+-]\d+)\s+(?:additional\s+|base\s+)?damage/i);
  if (dmgMatch) damageMod = parseInt(dmgMatch[1]);

  return { key, body, plain, attackMod, damageMod };
}

/**
 * Show the method picker dialog for an item.
 * Returns the chosen option object, or null if the user cancelled
 * or if the item has no keyed choices.
 */
export async function pickActionMethod(item) {
  const options = parseOptions(item);
  if (!options) return null;

  const rows = options.map((o, i) => `
    <div class="smp-opt" data-idx="${i}">
      <span class="smp-key">${o.key}</span>
      <span class="smp-body">${o.body}</span>
    </div>`).join('');

  const content = `<div class="smp-wrap"><div class="smp-opts">${rows}</div></div>`;

  return new Promise(resolve => {
    let chosen = null;
    new Dialog({
      title: item.name,
      content,
      buttons: {
        use: {
          label: 'Use',
          callback: () => {
            if (chosen === null) {
              ui.notifications.warn('Select a method first.');
              resolve(null);
              return;
            }
            resolve(options[chosen]);
          }
        },
        cancel: { label: 'Cancel', callback: () => resolve(null) }
      },
      default: 'use',
      render: (html) => {
        html.find('.smp-opt').on('click', function () {
          html.find('.smp-opt').removeClass('smp-opt--sel');
          $(this).addClass('smp-opt--sel');
          chosen = parseInt(this.dataset.idx);
        });
      }
    }, { width: 420, classes: ['dialog', 'stryder-method-picker'] }).render(true);
  });
}

/**
 * Replace the .chat-message-content body in an existing chat HTML string
 * with a highlighted block showing only the chosen method.
 */
export function buildMethodFlavor(baseHTML, method) {
  const modBadge = method.attackMod !== 0
    ? `<span class="chat-method-mod">${method.attackMod > 0 ? '+' : ''}${method.attackMod} atk</span>`
    : '';
  const block = `<div class="chat-method-block">
      <span class="chat-method-key">${method.key}</span>${modBadge}
      <span class="chat-method-body">${method.body}</span>
    </div>`;
  return baseHTML.replace(
    /(<div class="chat-message-content">)[\s\S]*?(<\/div>)/,
    `$1${block}$2`
  );
}
