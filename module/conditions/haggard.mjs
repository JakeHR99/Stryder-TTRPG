import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleHaggardApplication(effect) {
  const actor = effect.parent;
  
  console.log("Haggard effect being configured:", effect);
  
  // Show stage selection dialog
  const stages = [1, 2, 3, 4];
  const content = `
    <div class="haggard-dialog">
      <p>Select Haggard Stage for ${actor.name}:</p>
      <div class="stage-buttons">
        ${stages.map(stage => `
          <button class="stage-button" data-stage="${stage}">
            <strong>Stage ${stage}</strong>
          </button>
        `).join('')}
      </div>
      <div class="stage-descriptions">
        <p><strong>Stage 1:</strong> -1 to all Core Stats (Soul, Reflex, Grit, Arcana, Intuition, Will)</p>
        <p><strong>Stage 2:</strong> -2 to all Core Stats (Soul, Reflex, Grit, Arcana, Intuition, Will)</p>
        <p><strong>Stage 3:</strong> -3 to all Core Stats (Soul, Reflex, Grit, Arcana, Intuition, Will)</p>
        <p><strong>Stage 4:</strong> -4 to all Core Stats (Soul, Reflex, Grit, Arcana, Intuition, Will)</p>
      </div>
    </div>
  `;

  new Dialog({
    title: "Haggard Application",
    content,
    buttons: {},
    default: "cancel",
    close: () => actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id])
  }).render(true);

  // Handle stage selection
  $(document).on('click', '.stage-button', async (event) => {
    const stage = parseInt(event.currentTarget.dataset.stage);
    console.log("Setting haggard stage:", stage);
    
    try {
      await applyHaggardEffects(actor, effect, stage);
    } catch (error) {
      console.error("Error applying haggard effects:", error);
    }
    
    $('.dialog').remove();
  });
}

async function applyHaggardEffects(actor, effect, stage) {
  // Check if this is a monster - monsters are not affected by Haggard
  if (actor.type === 'monster') {
    console.log(`${actor.name} is a monster - Haggard has no effect`);
    
    // Update the effect with no changes but keep the visual indicator
    await effect.update({
      name: `Haggard (Stage ${stage}) - No Effect`,
      label: `Haggard (Stage ${stage}) - No Effect`,
      changes: [],
      flags: {
        [SYSTEM_ID]: {
          isHaggard: true,
          haggardStage: stage,
          noEffect: true
        }
      }
    });
    
    // Send notification message for monsters
    const messageContent = `
      <div class="chat-message-card">
        <div class="chat-message-header">
          <h3 class="chat-message-title">${actor.name} has been afflicted with <strong>Haggard Stage ${stage}</strong></h3>
        </div>
        <div class="chat-message-content">
          <p><strong>No Effect:</strong> ${actor.name} is a monster, and so does not have its core stats reduced by the Haggard condition.</p>
        </div>
      </div>
    `;

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({actor}),
      content: messageContent,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
    
    return;
  }
  
  // Calculate core stat penalty (-1 per stage)
  const coreStatPenalty = stage * -1;
  
  // Define all core stats (using proper capitalization as in template.json)
  const coreStats = [
    'Soul', 'Reflex', 'Grit', 'Arcana', 'Intuition', 'Will'
  ];
  
  // Build changes array
  const changes = [];
  
  // Add core stat penalties
  coreStats.forEach(stat => {
    changes.push({
      key: `system.abilities.${stat}.value`,
      value: coreStatPenalty,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      priority: 20
    });
  });
  
  // Update the effect with the calculated changes
  await effect.update({
    name: `Haggard (Stage ${stage})`,
    label: `Haggard (Stage ${stage})`,
    changes: changes,
    flags: {
      [SYSTEM_ID]: {
        isHaggard: true,
        haggardStage: stage
      }
    }
  });
  
  console.log(`Applied Haggard Stage ${stage} to ${actor.name}:`, {
    coreStatPenalty,
    changesCount: changes.length
  });
  
  // Send notification message
  const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name} has been afflicted with <strong>Haggard Stage ${stage}</strong></h3>
      </div>
      <div class="chat-message-content">
        <p><strong>Effects Applied:</strong></p>
        <ul>
          <li>All Core Stats (Soul, Reflex, Grit, Arcana, Intuition, Will) reduced by ${Math.abs(coreStatPenalty)}</li>
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
}

// Function to remove haggard effects
export async function removeHaggardEffects(actor) {
  const haggardEffects = actor.effects.filter(e => 
    e.flags[SYSTEM_ID]?.isHaggard
  );
  
  if (haggardEffects.length === 0) return;
  
  // Remove all haggard effects
  const effectIds = haggardEffects.map(e => e.id);
  await actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
  
  // Send notification
  const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name}'s Haggard condition has been removed</h3>
      </div>
      <div class="chat-message-content">
        <p>${actor.name} is no longer Haggard.</p>
      </div>
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content: messageContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
  
  console.log(`Removed Haggard effects from ${actor.name}`);
}

// Helper function to check if actor is haggard
export function isActorHaggard(actor) {
  return actor.effects.some(e => e.flags[SYSTEM_ID]?.isHaggard);
}

// Helper function to get haggard stage
export function getHaggardStage(actor) {
  const haggardEffect = actor.effects.find(e => e.flags[SYSTEM_ID]?.isHaggard);
  return haggardEffect?.flags[SYSTEM_ID]?.haggardStage || 0;
}

// Register the hook to handle Haggard effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Haggard effect that needs configuration
  if ((effect.label === "Haggard" || effect.name === "Haggard") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Haggard");
    await handleHaggardApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Haggard" || effect.name === "Haggard") && game.user.id === userId) {
    // Check if the effect doesn't have the proper changes yet
    if (!effect.changes || effect.changes.length === 0) {
      console.log("updateActiveEffect hook triggered for Haggard - adding missing data");
      await handleHaggardApplication(effect);
    }
  }
});
