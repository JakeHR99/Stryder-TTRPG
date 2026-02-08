import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handlePanickedApplication(effect) {
  const actor = effect.parent;
  
  console.log("Panicked effect being configured:", effect);
  
  // Update the effect to mark it as Panicked
  await effect.update({
    name: "Panicked",
    label: "Panicked",
    changes: [],
    flags: {
      [SYSTEM_ID]: {
        isPanicked: true
      }
    }
  });
  
  console.log("Panicked effect after update:", effect);
}

// Function to check if an actor is panicked
export function isActorPanicked(actor) {
  if (!actor) return false;
  
  const panickedEffect = actor.effects.find(e => {
    const hasLabel = e.label === "Panicked";
    const hasName = e.name === "Panicked";
    const hasFlag = e.flags[SYSTEM_ID]?.isPanicked;
    const hasStatus = e.statuses?.has("panicked");
    
    return hasLabel || hasName || hasFlag || hasStatus;
  });
  
  return panickedEffect !== undefined;
}

// Function to modify attack roll quality based on panicked condition
export function getPanickedRollQuality(rollTotal, itemType, itemSystem) {
  // For hex items, only apply panicked logic if rollsQuality is true
  if (itemType === "hex" && !itemSystem?.hex?.rollsQuality) {
    return null; // Don't modify quality for hexes that don't roll quality
  }
  
  // Panicked condition modifies the quality thresholds:
  // Normal: <=4 Poor, 5-10 Good, >=11 Excellent
  // Panicked: <=5 Poor, >=6 Good, No Excellent
  
  if (rollTotal <= 5) {
    return {
      quality: "Poor",
      damageMultiplier: 0.5
    };
  } else {
    return {
      quality: "Good", 
      damageMultiplier: 1.0
    };
  }
}

// Register the hook to handle Panicked effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Panicked effect that needs configuration
  if ((effect.label === "Panicked" || effect.name === "Panicked") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Panicked");
    await handlePanickedApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Panicked" || effect.name === "Panicked") && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.isPanicked) {
      console.log("updateActiveEffect hook triggered for Panicked - adding missing data");
      await handlePanickedApplication(effect);
    }
  }
});
