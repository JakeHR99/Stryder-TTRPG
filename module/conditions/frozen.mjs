import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleFrozenApplication(effect) {
  const actor = effect.parent;
  
  console.log("Frozen effect being configured:", effect);
  
  // Update the effect to include the Frozen penalties
  await effect.update({
    name: "Frozen",
    label: "Frozen",
    changes: [
      {
        key: "system.attributes.move.running.value",
        value: -3,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        priority: 20
      }
    ],
    flags: {
      [SYSTEM_ID]: {
        isFrozen: true,
        frozenRoundsPassed: 0 // Track rounds for automatic removal
      }
    }
  });
  
  console.log("Frozen effect after update:", effect);
}

// Function to remove frozen effects
export async function removeFrozenEffects(actor) {
  const frozenEffects = actor.effects.filter(e => 
    e.flags[SYSTEM_ID]?.isFrozen
  );
  
  if (frozenEffects.length === 0) return;
  
  // Remove all frozen effects
  const effectIds = frozenEffects.map(e => e.id);
  await actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
  
  // Send notification
  const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name}'s Frozen condition has been removed</h3>
      </div>
      <div class="chat-message-content">
        <p>${actor.name} has thawed out and is no longer Frozen.</p>
        <p><strong>Restored:</strong></p>
        <ul>
          <li>Running movement restored to normal</li>
          <li>Attack roll penalties removed</li>
        </ul>
      </div>
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content: messageContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
  
  console.log(`Removed Frozen effects from ${actor.name}`);
}

// Function to handle frozen attack roll penalties
export function handleFrozenAttackPenalty(roll, actor) {
  // Check if actor is Frozen
  const frozen = actor.effects.find(e => {
    const hasLabel = e.label === "Frozen";
    const hasName = e.name === "Frozen";
    const isFrozenEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isFrozen;
    return isFrozenEffect;
  });
  
  if (!frozen) return;
  
  // Apply -2 penalty to attack rolls
  roll._total = roll._total - 2;
  roll._formula = `${roll._formula} - 2`;
}

// Function to handle automatic removal after 3 rounds
export async function handleFrozenRoundTracking(combatant) {
  const actor = combatant.actor;
  if (!actor) return;

  // Find frozen effects
  const frozenEffect = actor.effects.find(e => 
    e.flags[SYSTEM_ID]?.isFrozen
  );
  
  if (!frozenEffect) return;

  // Get current rounds passed and increment
  const currentRounds = frozenEffect.flags[SYSTEM_ID]?.frozenRoundsPassed || 0;
  const newRounds = currentRounds + 1;
  
  // Update the rounds counter
  await frozenEffect.setFlag(SYSTEM_ID, "frozenRoundsPassed", newRounds);

  // Check if 3 rounds have passed
  if (newRounds >= 3) {
    // Send notification before removing the frozen effect
    const messageContent = `
      <div class="chat-message-card">
        <div class="chat-message-header">
          <h3 class="chat-message-title">${actor.name} has thawed out naturally</h3>
        </div>
        <div class="chat-message-content">
          <p>After 3 rounds, ${actor.name} has thawed out and is no longer Frozen.</p>
        </div>
      </div>
    `;

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({actor}),
      content: messageContent,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });

    // Remove frozen effect after sending message
    await actor.deleteEmbeddedDocuments('ActiveEffect', [frozenEffect.id]);
  }
}

// Register the hook to handle Frozen effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Frozen effect that needs configuration
  if ((effect.label === "Frozen" || effect.name === "Frozen") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Frozen");
    await handleFrozenApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Frozen" || effect.name === "Frozen") && game.user.id === userId) {
    // Check if the effect doesn't have the proper changes yet
    if (!effect.changes || effect.changes.length === 0) {
      console.log("updateActiveEffect hook triggered for Frozen - adding missing data");
      await handleFrozenApplication(effect);
    }
  }
});
