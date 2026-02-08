import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleEnergizedApplication(effect) {
  const actor = effect.parent;
  
  console.log("Energized effect being configured:", effect);
  
  // Update the effect to include the Energized bonuses
  await effect.update({
    name: "Energized",
    label: "Energized",
    changes: [
      {
        key: "system.attributes.move.running.value",
        value: 3,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        priority: 20
      },
      {
        key: "system.dodge.bonus",
        value: 1,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        priority: 20
      }
    ],
    flags: {
      [SYSTEM_ID]: {
        isEnergized: true
      }
    }
  });
  
  console.log("Energized effect after update:", effect);
}

// Register the hook to handle Energized effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is an Energized effect that needs configuration
  if ((effect.label === "Energized" || effect.name === "Energized") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Energized");
    await handleEnergizedApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Energized" || effect.name === "Energized") && game.user.id === userId) {
    // Check if the effect doesn't have the proper changes yet
    if (!effect.changes || effect.changes.length === 0) {
      console.log("updateActiveEffect hook triggered for Energized - adding missing data");
      await handleEnergizedApplication(effect);
    }
  }
});