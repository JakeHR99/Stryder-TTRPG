import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleGrappledApplication(effect) {
  const actor = effect.parent;
  
  console.log("Grappled effect being configured:", effect);
  
  // Update the effect to mark it as Grappled
  await effect.update({
    name: "Grappled",
    label: "Grappled",
    icon: "systems/stryder/assets/status/grappled.svg",
    changes: [],
    flags: {
      [SYSTEM_ID]: {
        isGrappled: true
      }
    }
  });
  
  console.log("Grappled effect after update:", effect);
}

// Function to check if an actor is grappled
export function isActorGrappled(actor) {
  if (!actor) return false;
  
  // Check active effects for grappled status
  const grappledEffect = actor.effects.find(e => {
    // Check for status effect with core.statusId flag (new method)
    if (e.flags?.core?.statusId === "grappled") {
      return true;
    }
    
    // Check for direct label/name matches (standard method)
    const hasLabel = e.label === "Grappled";
    const hasName = e.name === "Grappled";
    
    // Check for custom flag (backwards compatibility)
    const isGrappledEffect = e.flags[SYSTEM_ID]?.isGrappled;
    
    return hasLabel || hasName || isGrappledEffect;
  });
  
  return !!grappledEffect;
}

// Function to handle grappled evasion blocking
export function handleGrappledEvasionBlock(actor) {
  if (!isActorGrappled(actor)) return false;
  
  ui.notifications.error(`${actor.name} cannot use evasion actions because they're Grappled!`);
  return true; // Return true to indicate the action was blocked
}

// Register the hook to handle Grappled effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Grappled effect that needs configuration
  if ((effect.label === "Grappled" || effect.name === "Grappled") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Grappled");
    await handleGrappledApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Grappled" || effect.name === "Grappled") && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.isGrappled) {
      console.log("updateActiveEffect hook triggered for Grappled - adding missing data");
      await handleGrappledApplication(effect);
    }
  }
});
