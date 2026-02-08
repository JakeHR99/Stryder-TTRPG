import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleBleedingWoundApplication(effect) {
  const actor = effect.parent;
  
  console.log("Bleeding Wound effect being configured:", effect);
  
  // Check for Aegis/Ward protection
  if (actor.system.aegis?.value > 0 ) {
    ui.notifications.error(`${actor.name} cannot receive Bleeding Wounds because they have positive Aegis!`);
    await actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id]);
    return;
  }

  // Show stage selection dialog
  const stages = [1, 2, 3, 4, 5];
  const content = `
    <div class="bleeding-wound-dialog">
      <p>Select Bleeding Wound Stage:</p>
      <div class="stage-buttons">
        ${stages.map(stage => `
          <button class="stage-button" data-stage="${stage}">
            <strong>Stage ${stage}</strong> (${stage} Damage)
          </button>
        `).join('')}
      </div>
    </div>
  `;

  new Dialog({
    title: "Bleeding Wound Application",
    content,
    buttons: {},
    default: "cancel",
    close: () => actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id])
  }).render(true);

  // Handle stage selection
	$(document).on('click', '.stage-button', async (event) => {
	  const stage = parseInt(event.currentTarget.dataset.stage);
	  console.log(`Applying Bleeding Wound Stage ${stage} to ${actor.name}`);
	  await effect.update({
		name: `Bleeding Wound (Stage ${stage})`,
		label: `Bleeding Wound (Stage ${stage})`,
		changes: [],
		flags: {
		  [SYSTEM_ID]: {
			bleedingStage: stage
		  }
		}
	  });
	  console.log(`Effect flags:`, effect.flags);
	  $('.dialog').remove();
	});
}

export async function handleBleedingWoundDamage(combatant) {
  const actor = combatant.actor;
  if (!actor) return;

  console.log("handleBleedingWoundDamage called for:", actor.name);

  // Check if bleeding damage has already been applied this turn
  const hasTakenBleedingDamage = combatant.getFlag(SYSTEM_ID, "hasTakenBleedingDamage");
  console.log("Has taken bleeding damage this turn:", hasTakenBleedingDamage);
  
  // TEMPORARY: Clear the flag if it exists (for debugging)
  if (hasTakenBleedingDamage) {
    console.log("Clearing bleeding damage flag manually");
    await combatant.unsetFlag(SYSTEM_ID, "hasTakenBleedingDamage");
    // Don't return - continue with damage processing
  }

  // Find all bleeding wound effects and process the highest stage
  const bleedingEffects = actor.effects.filter(e => {
    const hasLabel = e.label && e.label.startsWith("Bleeding Wound");
    const hasName = e.name && e.name.includes("Bleeding Wound");
    const isBleedingEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.bleedingStage;
    return isBleedingEffect;
  });
  
  console.log("Found bleeding effects:", bleedingEffects.length);
  console.log("Actor health:", actor.system.health.value);
  
  if (!bleedingEffects.length || actor.system.health.value <= 0) return;

  // Get the highest stage effect
  const highestStageEffect = bleedingEffects.reduce((prev, current) => {
    const prevStage = prev.flags[SYSTEM_ID]?.bleedingStage || 1;
    const currentStage = current.flags[SYSTEM_ID]?.bleedingStage || 1;
    return currentStage > prevStage ? current : prev;
  });

  const stage = highestStageEffect.flags[SYSTEM_ID]?.bleedingStage || 1;
  const damage = Math.min(stage, actor.system.health.value);

  console.log(`Processing Bleeding Wound: Stage ${stage}, Damage ${damage}`);

  if (damage <= 0) return;

  // Set flag to indicate bleeding damage has been applied this turn
  await combatant.setFlag(SYSTEM_ID, "hasTakenBleedingDamage", true);

  // Apply damage
  await actor.update({
    "system.health.value": Math.max(0, actor.system.health.value - damage)
  });

  // Check for unconsciousness
  if (actor.system.health.value <= 0 && !actor.effects.find(e => e.label === "Unconscious")) {
    await actor.createEmbeddedDocuments('ActiveEffect', [{
      name: "Unconscious",
      label: "Unconscious",
      icon: "systems/stryder/assets/status/unconscious.svg",
      disabled: false
    }]);
  }

  // Send damage message only if damage was dealt
  if (damage > 0) {
    const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name} took ${damage} damage from <strong>Bleeding Wound</strong></h3>
      </div>
      
      <div class="chat-message-details">
        <div class="chat-message-detail-row">
          <span class="chat-message-detail-label">Damage Type:</span>
          <span class="chat-damage-type-box">Persistent</span>
        </div>
        <div class="chat-message-detail-row">
          <span class="chat-message-detail-label">Stage:</span>
          <span class="chat-stage-box">${stage}</span>
        </div>
      </div>
      
      <div class="chat-message-footer">
        <div class="bleeding-undo-container">
          <i class="fas fa-undo-alt bleeding-undo" data-actor-id="${actor.id}" data-damage="${damage}" title="Undo Damage"></i>
          <span>Click to undo</span>
        </div>
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
}

// Register the hook to handle Bleeding Wound effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Bleeding Wound effect that needs configuration
  if ((effect.label === "Bleeding Wound" || effect.name === "Bleeding Wound" || 
       effect.label?.includes("Bleeding Wound") || effect.name?.includes("Bleeding Wound")) && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Bleeding Wound");
    await handleBleedingWoundApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Bleeding Wound" || effect.name === "Bleeding Wound" || 
       effect.label?.includes("Bleeding Wound") || effect.name?.includes("Bleeding Wound")) && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.bleedingStage) {
      console.log("updateActiveEffect hook triggered for Bleeding Wound - adding missing data");
      await handleBleedingWoundApplication(effect);
    }
  }
});

// Hook to handle bleeding wound effects during combat turns
Hooks.on('updateCombat', async (combat, updateData, options, userId) => {
  console.log("updateCombat hook triggered for bleeding:", updateData);
  // Only process on turn change for the current user
  if (updateData.turn !== undefined && game.user.id === userId) {
    console.log("Turn change detected, processing bleeding effects");
    
    // Clear bleeding damage flags for all combatants at the start of each turn
    for (const combatant of combat.combatants) {
      await combatant.unsetFlag(SYSTEM_ID, "hasTakenBleedingDamage");
    }
    
    const combatant = combat.combatants.get(combat.current.combatantId);
    console.log("Current combatant:", combatant?.actor?.name);
    if (combatant) {
      await handleBleedingWoundDamage(combatant);
    }
  }
});

// Alternative hook using socket communication for turn changes
Hooks.once('ready', () => {
  if (game.socket) {
    game.socket.on(`system.stryder`, async (data) => {
      console.log("Socket message received for bleeding:", data);
      if (data.type === "turnChangeNotification") {
        console.log("Socket turn change notification received, processing bleeding effects");
        
        const combat = game.combat;
        if (!combat) return;
        
        // Clear bleeding damage flags for all combatants at the start of each turn
        for (const combatant of combat.combatants) {
          console.log(`Clearing bleeding flag for ${combatant.actor?.name}`);
          await combatant.unsetFlag(SYSTEM_ID, "hasTakenBleedingDamage");
        }
        
        const combatant = combat.combatants.get(combat.current.combatantId);
        console.log("Current combatant from socket:", combatant?.actor?.name);
        if (combatant) {
          await handleBleedingWoundDamage(combatant);
        }
      }
    });
  } else {
    console.log("Game socket not available for bleeding");
  }
});

// Handle undo button
Hooks.on('renderChatMessage', (message, html, data) => {
  html.find('.bleeding-undo').click(async (event) => {
    const actorId = event.currentTarget.dataset.actorId;
    const damage = parseInt(event.currentTarget.dataset.damage);
    const actor = game.actors.get(actorId);
    
    if (actor) {
      await actor.update({
        "system.health.value": actor.system.health.value + damage
      });
      
      // Cross out the entire message content
      const messageCard = html.find('.chat-message-card');
      messageCard.css('text-decoration', 'line-through');
      messageCard.css('opacity', '0.7');
      
      // Remove the undo button
      event.currentTarget.closest('.bleeding-undo-container').remove();
    }
  });
});