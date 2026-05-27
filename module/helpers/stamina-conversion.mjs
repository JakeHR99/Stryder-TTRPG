// ============================================================
// STRYDER — Mana-Conversion helper
// When an ability costs Stamina, the player may pay some or all
// of that cost with Mana at a 1:1 rate.
// Returns { staminaToSpend, manaToSpend } or null if cancelled.
// ============================================================

export async function resolveStaminaCost(actor, cost) {
  if (!cost || cost <= 0) return { staminaToSpend: 0, manaToSpend: 0 };

  const curSta = actor.system.stamina?.value ?? 0;
  const curMana = actor.system.mana?.value ?? 0;
  const minManaNeeded = Math.max(0, cost - curSta); // mana needed if using all available stamina

  // If player can't cover cost even with all mana+stamina, warn and cancel
  if (curSta + curMana < cost) {
    ui.notifications.warn(`Not enough resources! Need ${cost} Stamina (or Mana equivalent). Have ${curSta} Stamina + ${curMana} Mana = ${curSta + curMana}.`);
    return null;
  }

  // If player has exactly enough stamina, skip dialog and just deduct stamina
  if (curSta >= cost) {
    // Still offer mana conversion — show dialog
  }

  return new Promise((resolve) => {
    const dialog = new Dialog({
      title: `Stamina Cost: ${cost}`,
      content: `
        <div style="font-family: inherit; padding: 4px 0;">
          <div style="margin-bottom: 10px; font-size: 12px; color: rgba(200,230,255,0.7);">
            <span style="color:#4fc; font-weight:bold;">⚡ ${curSta}</span> Stamina &nbsp;|&nbsp;
            <span style="color:#08acff; font-weight:bold;">◆ ${curMana}</span> Mana available
          </div>
          <div style="margin-bottom: 8px;">
            <label style="font-size: 12px;">Mana to use as Stamina <em style="opacity:0.6;">(1:1 rate, max ${Math.min(cost, curMana)})</em>:</label>
            <input id="mana-conv-input" type="number" min="0" max="${Math.min(cost, curMana)}"
              value="${minManaNeeded}" style="width:100%; margin-top:4px; font-size:13px;" />
          </div>
          <div id="mana-conv-preview" style="font-size:11px; color:rgba(200,230,255,0.6); margin-top:6px;"></div>
        </div>
        <script>
          const inp = document.getElementById('mana-conv-input');
          const preview = document.getElementById('mana-conv-preview');
          const cost = ${cost}, curSta = ${curSta}, curMana = ${curMana};
          function update() {
            const mana = Math.min(Math.max(0, parseInt(inp.value)||0), Math.min(cost, curMana));
            inp.value = mana;
            const sta = Math.min(cost - mana, curSta);
            const ok = sta + mana >= cost;
            preview.textContent = ok
              ? \`Will spend: \${sta} Stamina + \${mana} Mana\`
              : \`⚠ Not enough — need \${cost - sta - mana} more\`;
            preview.style.color = ok ? '#4fc' : '#f88';
          }
          inp.addEventListener('input', update);
          update();
        </script>`,
      buttons: {
        confirm: {
          label: '✅ Confirm',
          callback: (html) => {
            const manaInput = Math.min(
              Math.max(0, parseInt(html.find('#mana-conv-input').val()) || 0),
              Math.min(cost, curMana)
            );
            const staToSpend = Math.min(cost - manaInput, curSta);
            if (staToSpend + manaInput < cost) {
              ui.notifications.warn("Not enough Stamina + Mana to cover the cost.");
              resolve(null);
              return;
            }
            resolve({ staminaToSpend: staToSpend, manaToSpend: manaInput });
          }
        },
        cancel: {
          label: '✖ Cancel',
          callback: () => resolve(null)
        }
      },
      default: 'confirm'
    });
    dialog.render(true);
  });
}
