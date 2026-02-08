import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleInfluencedApplication(effect) {
  const actor = effect.parent;
  
  console.log("Influenced effect being configured:", effect);
  
  // Update the effect to include the Influenced bonus
  await effect.update({
    name: "Influenced",
    label: "Influenced",
    icon: "systems/stryder/assets/status/influenced.svg",
    changes: [],
    duration: {
      rounds: 999999, // Very long duration to make it effectively permanent but still temporary
      seconds: 999999,
      startRound: game.combat?.round || 0
    },
    flags: {
      core: {
        statusId: "influenced"
      },
      [SYSTEM_ID]: {
        isInfluenced: true
      }
    }
  });
  
  console.log("Influenced effect after update:", effect);
}

// Function to check if an actor is influenced (any type)
export function isActorInfluenced(actor) {
  if (!actor) return false;
  
  const influencedEffect = actor.effects.find(e => {
    const hasLabel = e.label === "Influenced";
    const hasName = e.name === "Influenced";
    const isInfluencedEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isInfluenced;
    return isInfluencedEffect;
  });
  
  return !!influencedEffect;
}

// Function to handle influenced attack roll bonus
export function handleInfluencedAttackBonus(roll, actor) {
  if (!isActorInfluenced(actor)) return false;
  
  // Apply +1 bonus to attack rolls (2d6 rolls)
  if (roll.formula.includes('2d6')) {
    roll._formula = `${roll._formula} + 1`;
    roll.terms = Roll.parse(roll._formula);
    return true;
  }
  
  return false;
}

// Register the hook to handle Influenced effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is an Influenced effect that needs configuration
  if ((effect.label === "Influenced" || effect.name === "Influenced") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Influenced");
    
    // Check if this is a manual application (not from aura)
    const isManualApplication = !effect.flags[SYSTEM_ID]?.isInfluenced;
    
    if (isManualApplication) {
      // Mark as manual application
      await effect.update({
        flags: {
          ...effect.flags,
          [SYSTEM_ID]: {
            isInfluenced: true,
            isManual: true // Mark as manually applied
          }
        }
      });
    }
    
    await handleInfluencedApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Influenced" || effect.name === "Influenced") && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.isInfluenced) {
      console.log("updateActiveEffect hook triggered for Influenced - adding missing data");
      await handleInfluencedApplication(effect);
    }
  }
});
