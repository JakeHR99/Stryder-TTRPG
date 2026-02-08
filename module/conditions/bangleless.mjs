import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleBanglelessApplication(effect) {
  const actor = effect.parent;
  
  console.log("Bangleless effect being configured:", effect);
  
  // Update the effect to mark it as Bangleless
  await effect.update({
    name: "Bangleless",
    label: "Bangleless",
    changes: [],
    flags: {
      [SYSTEM_ID]: {
        isBangleless: true
      }
    }
  });
  
  console.log("Bangleless effect after update:", effect);
}

// Function to check if an actor is bangleless
export function isActorBangleless(actor) {
  if (!actor) return false;
  
  const banglelessEffect = actor.effects.find(e => {
    const hasLabel = e.label === "Bangleless";
    const hasName = e.name === "Bangleless";
    const hasFlag = e.flags[SYSTEM_ID]?.isBangleless;
    const hasStatus = e.statuses?.has("bangleless");
    
    return hasLabel || hasName || hasFlag || hasStatus;
  });
  
  return banglelessEffect !== undefined;
}

// Register the hook to handle Bangleless effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Bangleless effect that needs configuration
  if ((effect.label === "Bangleless" || effect.name === "Bangleless") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Bangleless");
    await handleBanglelessApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Bangleless" || effect.name === "Bangleless") && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.isBangleless) {
      console.log("updateActiveEffect hook triggered for Bangleless - adding missing data");
      await handleBanglelessApplication(effect);
    }
  }
});
