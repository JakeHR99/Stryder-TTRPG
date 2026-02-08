import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleShockedApplication(effect) {
  const actor = effect.parent;
  
  console.log("Shocked effect being configured:", effect);
  
  // Update the effect to include the Shocked penalties and duration
  await effect.update({
    name: "Shocked",
    label: "Shocked",
    icon: "systems/stryder/assets/status/shocked.svg",
    changes: [
      {
        key: "system.dodge.bonus",
        value: -2,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        priority: 20
      }
    ],
    duration: {
      rounds: 1,
      seconds: 8,
      startRound: game.combat?.round || 0
    },
    flags: {
      [SYSTEM_ID]: {
        isShocked: true
      }
    }
  });
  
  console.log("Shocked effect after update:", effect);
}

// Function to check if an actor is shocked
export function isActorShocked(actor) {
  if (!actor) return false;
  
  const shockedEffect = actor.effects.find(e => {
    const hasLabel = e.label === "Shocked";
    const hasName = e.name === "Shocked";
    const isShockedEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isShocked;
    return isShockedEffect;
  });
  
  return !!shockedEffect;
}

// Function to handle shocked attack roll penalty
export function handleShockedAttackPenalty(roll, actor) {
  if (!isActorShocked(actor)) return false;
  
  // Apply -2 penalty to attack rolls (2d6 rolls)
  if (roll.formula.includes('2d6')) {
    roll._formula = `${roll._formula} - 2`;
    roll.terms = Roll.parse(roll._formula);
    return true;
  }
  
  return false;
}

// Register the hook to handle Shocked effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Shocked effect that needs configuration
  if ((effect.label === "Shocked" || effect.name === "Shocked") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Shocked");
    await handleShockedApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Shocked" || effect.name === "Shocked") && game.user.id === userId) {
    // Check if the effect doesn't have the proper changes yet
    if (!effect.changes || effect.changes.length === 0) {
      console.log("updateActiveEffect hook triggered for Shocked - adding missing data");
      await handleShockedApplication(effect);
    }
  }
});
