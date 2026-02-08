import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleStunnedApplication(effect) {
  const actor = effect.parent;
  
  console.log("Stunned effect being configured:", effect);
  
  // Update the effect to mark it as a Stunned effect
  await effect.update({
    name: "Stunned",
    label: "Stunned",
    changes: [], // No automatic stat changes, we handle stamina manually
    flags: {
      [SYSTEM_ID]: {
        isStunned: true
      }
    }
  });
  
  console.log("Stunned effect after update:", effect);
}

// Function to check if actor is stunned
export function isActorStunned(actor) {
  return actor.effects.find(e => {
    const hasLabel = e.label === "Stunned";
    const hasName = e.name === "Stunned";
    const isStunnedEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isStunned;
    return isStunnedEffect;
  });
}

// Function to handle stamina spending with stunned penalty
export async function handleStunnedStaminaSpend(actor, originalCost, context = 'unknown') {
  const stunned = isActorStunned(actor);
  
  if (!stunned) {
    return { cost: originalCost, shouldProceed: true };
  }
  
  const additionalCost = 2;
  const totalCost = originalCost + additionalCost;
  
  // Check if the actor has enough stamina for the total cost
  if (actor.system.stamina.value < totalCost) {
    // Show error message
    ui.notifications.error(`${actor.name} cannot perform that action because the Stunned condition would cause it to cost too much Stamina (${totalCost} total, ${originalCost} base + ${additionalCost} Stunned penalty). Current Stamina: ${actor.system.stamina.value}`);
    return { cost: totalCost, shouldProceed: false };
  }
  
  return { cost: totalCost, shouldProceed: true };
}

// Function to remove stunned effect and send chat message
export async function removeStunnedEffect(actor, additionalStaminaSpent) {
  const stunned = isActorStunned(actor);
  
  if (!stunned) return;
  
  // Remove the stunned effect
  await stunned.delete();
  
  // Send chat message about the additional stamina spent and condition removal
  const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">Stunned Condition Resolved</h3>
      </div>
      <div class="chat-message-content">
        <p><strong>${actor.name}</strong> spent an additional <strong>${additionalStaminaSpent} Stamina</strong> due to the Stunned condition.</p>
        <p>The Stunned condition has been removed.</p>
      </div>
    </div>
  `;
  
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content: messageContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
}

// Register the hook to handle Stunned effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Stunned effect that needs configuration
  if ((effect.label === "Stunned" || effect.name === "Stunned") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Stunned");
    await handleStunnedApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Stunned" || effect.name === "Stunned") && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.isStunned) {
      console.log("updateActiveEffect hook triggered for Stunned - adding missing data");
      await handleStunnedApplication(effect);
    }
  }
});
