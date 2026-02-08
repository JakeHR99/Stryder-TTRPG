import { SYSTEM_ID } from '../helpers/constants.mjs';
import { blindedState } from '../stryder.mjs';

export async function handleBlindedApplication(effect) {
  const actor = effect.parent;
  
  console.log("Blinded effect being configured:", effect);
  
  // Update the effect to include the Blinded penalties
  await effect.update({
    name: "Blinded",
    label: "Blinded",
    changes: [
      {
        key: "system.dodge.bonus",
        value: -3,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        priority: 20
      },
      {
        key: "system.evade.bonus",
        value: -3,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        priority: 20
      }
    ],
    flags: {
      [SYSTEM_ID]: {
        isBlinded: true
      }
    }
  });
  
  console.log("Blinded effect after update:", effect);
}

// Old blinded roll intercept system removed - now handled in stryder.mjs

// Register the hook to handle Blinded effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Blinded effect that needs configuration
  if ((effect.label === "Blinded" || effect.name === "Blinded") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Blinded");
    await handleBlindedApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Blinded" || effect.name === "Blinded") && game.user.id === userId) {
    // Check if the effect doesn't have the proper changes yet
    if (!effect.changes || effect.changes.length === 0) {
      console.log("updateActiveEffect hook triggered for Blinded - adding missing data");
      await handleBlindedApplication(effect);
    }
  }
});