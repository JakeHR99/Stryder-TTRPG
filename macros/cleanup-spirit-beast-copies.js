// ============================================================
// Macro: Cleanup Spirit Beast Copies
// ============================================================
// Run this in Foundry's macro editor (as GM) to audit or
// clean up orphaned / duplicate spirit-beast actors left over
// from the pre-C3 compendium-import approach.
//
// Phase 1 (default): REPORT ONLY — lists what would be removed.
// Phase 2: set DRY_RUN = false to actually delete orphans.
// ============================================================

const DRY_RUN = true;  // set to false to actually delete

// ── Helpers ──────────────────────────────────────────────────

function isOrphan(beast) {
  // Orphan: no linkedCharacterId, OR the linked actor no longer exists
  const linkedId = beast.system?.linkedCharacterId;
  if (!linkedId) return true;
  return !game.actors.get(linkedId);
}

function isDuplicate(beast, seen) {
  // Duplicate: another beast with same gate + linkedCharacterId already counted
  const key = `${beast.system?.linkedCharacterId}|${beast.system?.gate}`;
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
}

// ── Audit ────────────────────────────────────────────────────

const allBeasts = game.actors.filter(a => a.type === 'spirit-beast');
const orphans   = [];
const dupes     = [];
const keepers   = [];

// First pass: collect keepers (linked + unique gate per summoner)
const seen = new Set();
for (const beast of allBeasts) {
  if (isOrphan(beast)) {
    orphans.push(beast);
  } else if (isDuplicate(beast, seen)) {
    dupes.push(beast);
  } else {
    keepers.push(beast);
  }
}

// ── Build report ─────────────────────────────────────────────

const lines = [];
lines.push(`<h3>Spirit Beast Audit${DRY_RUN ? ' (DRY RUN)' : ' — LIVE DELETE'}</h3>`);
lines.push(`<p>Total spirit-beast actors: <strong>${allBeasts.length}</strong></p>`);

lines.push(`<p><strong>Keepers (${keepers.length}):</strong></p><ul>`);
for (const b of keepers) {
  const summoner = game.actors.get(b.system?.linkedCharacterId);
  lines.push(`<li>${b.name} → ${summoner?.name ?? '?'} [${b.system?.gate ?? '?'}] — ID: ${b.id}</li>`);
}
lines.push('</ul>');

if (orphans.length) {
  lines.push(`<p><strong>Orphans — no valid linked summoner (${orphans.length}):</strong></p><ul>`);
  for (const b of orphans) {
    lines.push(`<li style="color:#c44;">${b.name} — ID: ${b.id}${DRY_RUN ? '' : ' → DELETED'}</li>`);
  }
  lines.push('</ul>');
}

if (dupes.length) {
  lines.push(`<p><strong>Duplicates — same summoner+gate already has a keeper (${dupes.length}):</strong></p><ul>`);
  for (const b of dupes) {
    const summoner = game.actors.get(b.system?.linkedCharacterId);
    lines.push(`<li style="color:#c84;">${b.name} → ${summoner?.name ?? '?'} [${b.system?.gate ?? '?'}] — ID: ${b.id}${DRY_RUN ? '' : ' → DELETED'}</li>`);
  }
  lines.push('</ul>');
}

if (!orphans.length && !dupes.length) {
  lines.push('<p style="color:#4a4;">✓ No orphans or duplicates found — nothing to clean up.</p>');
}

// ── Execute deletes if not dry run ───────────────────────────

if (!DRY_RUN) {
  const toDelete = [...orphans, ...dupes];
  if (toDelete.length) {
    // Only delete beasts that are NOT currently summoned (safety check)
    const safe = toDelete.filter(b => b.getActiveTokens().length === 0);
    const blocked = toDelete.filter(b => b.getActiveTokens().length > 0);
    for (const b of safe) await b.delete();
    if (blocked.length) {
      lines.push(`<p style="color:#c84;">⚠ ${blocked.length} beast(s) skipped — currently summoned (dismiss first).</p>`);
    }
    lines.push(`<p>Deleted ${safe.length} actor(s).</p>`);
  }
}

if (DRY_RUN && (orphans.length || dupes.length)) {
  lines.push('<p style="font-style:italic; color:#a0a0a0;">Set DRY_RUN = false in the macro to actually delete these.</p>');
}

// ── Display ──────────────────────────────────────────────────

ChatMessage.create({ content: lines.join('\n'), whisper: [game.user.id] });
