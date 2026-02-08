import { SYSTEM_ID } from '../helpers/constants.mjs';
import { senselessState } from '../stryder.mjs';

export async function handleSenselessApplication(effect) {
  const actor = effect.parent;
  
  console.log("Senseless effect being configured:", effect);
  
  // Update the effect to include the Senseless penalties
  await effect.update({
    name: "Senseless",
    label: "Senseless",
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
        isSenseless: true
      }
    }
  });
  
  console.log("Senseless effect after update:", effect);
}

// Old senseless roll intercept system removed - now handled in stryder.mjs

// Register the hook to handle Senseless effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Senseless effect that needs configuration
  if ((effect.label === "Senseless" || effect.name === "Senseless") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Senseless");
    await handleSenselessApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Senseless" || effect.name === "Senseless") && game.user.id === userId) {
    // Check if the effect doesn't have the proper changes yet
    if (!effect.changes || effect.changes.length === 0) {
      console.log("updateActiveEffect hook triggered for Senseless - adding missing data");
      await handleSenselessApplication(effect);
    }
  }
});
