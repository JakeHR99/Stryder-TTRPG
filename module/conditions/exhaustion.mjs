import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleExhaustionApplication(effect) {
  const actor = effect.parent;
  
  console.log("Exhaustion effect being configured:", effect);
  
  // Show stage selection dialog
  const stages = [1, 2, 3, 4, 5];
  const content = `
    <div class="exhaustion-dialog">
      <p>Select Exhaustion Stage for ${actor.name}:</p>
      <div class="stage-buttons">
        ${stages.map(stage => `
          <button class="stage-button" data-stage="${stage}">
            <strong>Stage ${stage}</strong>
          </button>
        `).join('')}
      </div>
      <div class="stage-descriptions">
        <p><strong>Stage 1:</strong> -1 Max Stamina, -2 to all Talents & Senses</p>
        <p><strong>Stage 2:</strong> -2 Max Stamina, -4 to all Talents & Senses</p>
        <p><strong>Stage 3:</strong> -3 Max Stamina, -6 to all Talents & Senses</p>
        <p><strong>Stage 4:</strong> -4 Max Stamina, -8 to all Talents & Senses</p>
        <p><strong>Stage 5:</strong> -5 Max Stamina, -10 to all Talents & Senses</p>
        <p><em>Note: Talents and Senses can go negative. Exhaustion can be cured by Resting.</em></p>
      </div>
    </div>
  `;

  new Dialog({
    title: "Exhaustion Application",
    content,
    buttons: {},
    default: "cancel",
    close: () => actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id])
  }).render(true);

  // Handle stage selection
  $(document).on('click', '.stage-button', async (event) => {
    const stage = parseInt(event.currentTarget.dataset.stage);
    console.log("Setting exhaustion stage:", stage);
    
    try {
      await applyExhaustionEffects(actor, effect, stage);
    } catch (error) {
      console.error("Error applying exhaustion effects:", error);
    }
    
    $('.dialog').remove();
  });
}


async function applyExhaustionEffects(actor, effect, stage) {
  // Calculate stamina reduction (minimum 0)
  const currentMaxStamina = actor.system.stamina.max;
  const staminaReduction = Math.min(stage, currentMaxStamina);
  
  // Calculate talent/sense penalty (-2 per stage)
  const talentSensePenalty = stage * -2;
  
  // Define all talents and senses
  const talents = [
    'endurance', 'nimbleness', 'finesse', 'strength', 'survival', 
    'charm', 'wit', 'wisdom', 'deceit', 'diplomacy', 'intimacy', 'aggression'
  ];
  
  const senses = [
    'sight', 'hearing', 'smell', 'arcane', 'touch'
  ];
  
  // Build changes array
  const changes = [];
  
  // Add stamina max reduction
  if (staminaReduction > 0) {
    changes.push({
      key: "system.stamina.max.mod",
      value: -staminaReduction,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      priority: 20
    });
  }
  
  // Add talent penalties
  talents.forEach(talent => {
    changes.push({
      key: `system.attributes.talent.${talent}.value`,
      value: talentSensePenalty,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      priority: 20
    });
  });
  
  // Add sense penalties
  senses.forEach(sense => {
    changes.push({
      key: `system.attributes.sense.${sense}.value`,
      value: talentSensePenalty,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      priority: 20
    });
  });
  
  // Update the effect with the calculated changes
  await effect.update({
    name: `Exhausted (Stage ${stage})`,
    label: `Exhausted (Stage ${stage})`,
    changes: changes,
    flags: {
      [SYSTEM_ID]: {
        isExhausted: true,
        exhaustionStage: stage,
        staminaReduction: staminaReduction
      }
    }
  });
  
  console.log(`Applied Exhaustion Stage ${stage} to ${actor.name}:`, {
    staminaReduction,
    talentSensePenalty,
    changesCount: changes.length
  });
  
  // Send notification message
  const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name} has been afflicted with <strong>Exhaustion Stage ${stage}</strong></h3>
      </div>
      <div class="chat-message-content">
        <p><strong>Effects Applied:</strong></p>
        <ul>
          <li>Maximum Stamina reduced by ${staminaReduction} (minimum 0)</li>
          <li>All Talents and Senses reduced by ${Math.abs(talentSensePenalty)} (can go negative)</li>
        </ul>
        <p><em>Exhaustion can be cured by Resting.</em></p>
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

// Function to remove exhaustion effects (called when resting)
export async function removeExhaustionEffects(actor) {
  const exhaustionEffects = actor.effects.filter(e => 
    e.flags[SYSTEM_ID]?.isExhausted
  );
  
  if (exhaustionEffects.length === 0) return;
  
  // Remove all exhaustion effects
  const effectIds = exhaustionEffects.map(e => e.id);
  await actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
  
  // Send notification
  const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name}'s Exhaustion has been cured</h3>
      </div>
      <div class="chat-message-content">
        <p>Through resting, ${actor.name} has recovered from their Exhaustion.</p>
      </div>
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content: messageContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
  
  console.log(`Removed Exhaustion effects from ${actor.name}`);
}

// Register the hook to handle Exhaustion effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is an Exhaustion effect that needs configuration
  if ((effect.label === "Exhausted" || effect.name === "Exhausted") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Exhaustion");
    await handleExhaustionApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Exhausted" || effect.name === "Exhausted") && game.user.id === userId) {
    // Check if the effect doesn't have the proper changes yet
    if (!effect.changes || effect.changes.length === 0) {
      console.log("updateActiveEffect hook triggered for Exhaustion - adding missing data");
      await handleExhaustionApplication(effect);
    }
  }
});
