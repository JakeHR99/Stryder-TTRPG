import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleHorrifiedApplication(effect) {
  const actor = effect.parent;
  
  console.log("Horrified effect being configured:", effect);
  
  // Update the effect to mark it as Horrified
  await effect.update({
    name: "Horrified",
    label: "Horrified",
    changes: [],
    flags: {
      [SYSTEM_ID]: {
        isHorrified: true
      }
    }
  });
  
  console.log("Horrified effect after update:", effect);
}

// Function to check if an actor is horrified
export function isActorHorrified(actor) {
  if (!actor) return false;
  
  const horrifiedEffect = actor.effects.find(e => {
    const hasLabel = e.label === "Horrified";
    const hasName = e.name === "Horrified";
    const hasFlag = e.flags[SYSTEM_ID]?.isHorrified;
    const hasStatus = e.statuses?.has("horrified");
    
    return hasLabel || hasName || hasFlag || hasStatus;
  });
  
  return horrifiedEffect !== undefined;
}

// Function to modify attack roll quality based on horrified condition
export function getHorrifiedRollQuality(rollTotal, itemType, itemSystem) {
  // For hex items, only apply horrified logic if rollsQuality is true
  if (itemType === "hex" && !itemSystem?.hex?.rollsQuality) {
    return null; // Don't modify quality for hexes that don't roll quality
  }
  
  // Horrified condition makes EVERY roll result Poor, no matter what
  // This overrides all normal quality thresholds
  
  return {
    quality: "Poor",
    damageMultiplier: 0.5
  };
}

// Register the hook to handle Horrified effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Horrified effect that needs configuration
  if ((effect.label === "Horrified" || effect.name === "Horrified") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Horrified");
    await handleHorrifiedApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Horrified" || effect.name === "Horrified") && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.isHorrified) {
      console.log("updateActiveEffect hook triggered for Horrified - adding missing data");
      await handleHorrifiedApplication(effect);
    }
  }
});
