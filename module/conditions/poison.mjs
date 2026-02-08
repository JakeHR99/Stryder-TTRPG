import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handlePoisonApplication(effect) {
  const actor = effect.parent;
  
  console.log("Poison effect being configured:", effect);
  
  // Check for Aegis protection
  if (actor.system.aegis?.value > 0) {
    ui.notifications.error(`${actor.name} cannot receive Poison because they have positive Aegis!`);
    await actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id]);
    return;
  }

  // Show stage selection dialog
  const stages = [1, 2, 3, 4];
  const content = `
    <div class="poison-dialog">
      <p>Select Poison Stage:</p>
      <div class="stage-buttons">
        ${stages.map(stage => `
          <button class="stage-button" data-stage="${stage}">
            <strong>Stage ${stage}</strong>
          </button>
        `).join('')}
      </div>
      <div class="stage-descriptions">
        <p><strong>Stage 1:</strong> -1 penalty to all 2d6 rolls</p>
        <p><strong>Stage 2:</strong> Lose 2 Health at Turn Start</p>
        <p><strong>Stage 3:</strong> Lose 1 Max Stamina</p>
        <p><strong>Stage 4:</strong> Fall Unconscious after 3 Rounds</p>
      </div>
    </div>
  `;

  new Dialog({
    title: "Poison Application",
    content,
    buttons: {},
    default: "cancel",
    close: () => actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id])
  }).render(true);

  // Handle stage selection
  $(document).on('click', '.stage-button', async (event) => {
    const stage = parseInt(event.currentTarget.dataset.stage);
    console.log("Setting poison stage:", stage);
    
    try {
      await effect.update({
        name: `Poisoned (Stage ${stage})`,
        label: `Poisoned (Stage ${stage})`,
        changes: [],
        flags: {
          [SYSTEM_ID]: {
            poisonStage: stage,
            poisonRoundsPassed: 0 // Track rounds for stage 4
          }
        }
      });
      
      // Wait a moment for the update to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log("Poison effect after stage selection:", effect);
      console.log("Effect flags:", effect.flags);
      console.log("Effect flags.stryder:", effect.flags[SYSTEM_ID]);
      
      // Verify the update was successful
      const updatedEffect = actor.effects.get(effect.id);
      console.log("Updated effect from actor:", updatedEffect?.flags[SYSTEM_ID]);
      
      if (!updatedEffect) {
        console.warn("Effect not found in actor's effects collection after update");
      }
      
    } catch (error) {
      console.error("Error updating poison effect:", error);
    }
    
    $('.dialog').remove();
  });
}

export async function handlePoisonStage1Roll(roll, actor) {
  // Check if actor has poison stage 1 or higher
  const poisonEffect = actor.effects.find(e => {
    const hasLabel = e.label && e.label.startsWith("Poisoned");
    const hasName = e.name && e.name.includes("Poisoned");
    const stage = e.flags[SYSTEM_ID]?.poisonStage || 1;
    const isPoisonEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.poisonStage;
    return isPoisonEffect && stage >= 1;
  });
  
  if (!poisonEffect) return;

  // Check if the roll formula contains 2d6
  if (roll.formula.includes('2d6')) {
    // Clone the original terms to avoid modifying the original
    const newTerms = foundry.utils.deepClone(roll.terms);
    
    // Find and modify the 2d6 term
    for (let term of newTerms) {
      if (term instanceof DiceTerm && term.faces === 6 && term.number === 2) {
        // Create a new NumericTerm for the -1 penalty
        const penalty = new NumericTerm({number: -1});
        
        // Insert the penalty after the 2d6 term
        const index = newTerms.indexOf(term);
        newTerms.splice(index + 1, 0, penalty);
        
        // Rebuild the formula with the penalty
        roll._formula = newTerms.join(' ');
        break; // Only modify the first 2d6 we find
      }
    }
    
    // Rebuild the roll with modified terms
    roll.terms = newTerms;
  }
}

export async function handlePoisonStage2Damage(combatant) {
  const actor = combatant.actor;
  if (!actor) return;

  console.log("handlePoisonStage2Damage called for:", actor.name);

  // Check if poison damage has already been applied this turn
  const hasTakenPoisonDamage = combatant.getFlag(SYSTEM_ID, "hasTakenPoisonDamage");
  console.log("Has taken poison damage this turn:", hasTakenPoisonDamage);
  
  // TEMPORARY: Clear the flag if it exists (for debugging)
  if (hasTakenPoisonDamage) {
    console.log("Clearing poison damage flag manually");
    await combatant.unsetFlag(SYSTEM_ID, "hasTakenPoisonDamage");
    // Don't return - continue with damage processing
  }

  // Find poison effects stage 2 or higher
  const poisonEffects = actor.effects.filter(e => {
    const hasLabel = e.label && e.label.startsWith("Poisoned");
    const hasName = e.name && e.name.includes("Poisoned");
    const stage = e.flags[SYSTEM_ID]?.poisonStage || 1;
    const isStage2Plus = stage >= 2;
    const isPoisonEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.poisonStage;
    console.log(`Effect ${e.label || e.name}: hasLabel=${hasLabel}, hasName=${hasName}, stage=${stage}, isStage2Plus=${isStage2Plus}, isPoisonEffect=${isPoisonEffect}, flags=${JSON.stringify(e.flags)}`);
    return isPoisonEffect && isStage2Plus;
  });
  
  console.log("All actor effects:", actor.effects.map(e => ({ label: e.label, flags: e.flags })));
  console.log("Found poison effects:", poisonEffects.length);
  console.log("Actor health:", actor.system.health.value);
  
  if (!poisonEffects.length || actor.system.health.value <= 0) return;

  const damage = Math.min(2, actor.system.health.value);
  if (damage <= 0) return;

  // Set flag FIRST to prevent multiple applications
  await combatant.setFlag(SYSTEM_ID, "hasTakenPoisonDamage", true);

  // Apply damage
  await actor.update({
    "system.health.value": Math.max(0, actor.system.health.value - damage)
  });

  // Send damage message
  if (damage > 0) {
    const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name} took ${damage} damage from <strong>Poison</strong></h3>
      </div>
      
      <div class="chat-message-details">
        <div class="chat-message-detail-row">
          <span class="chat-message-detail-label">Damage Type:</span>
          <span class="chat-damage-type-box">Persistent</span>
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

export async function handlePoisonStage4Unconscious(combatant) {
  const actor = combatant.actor;
  if (!actor) return;

  // Find poison effects stage 4
  const poisonEffect = actor.effects.find(e => {
    const hasLabel = e.label && e.label.startsWith("Poisoned");
    const hasName = e.name && e.name.includes("Poisoned");
    const stage = e.flags[SYSTEM_ID]?.poisonStage || 1;
    const isPoisonEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.poisonStage;
    return isPoisonEffect && stage === 4;
  });
  
  if (!poisonEffect) return;

  // Get current rounds passed and increment
  const currentRounds = poisonEffect.flags[SYSTEM_ID]?.poisonRoundsPassed || 0;
  const newRounds = currentRounds + 1;
  
  // Update the rounds counter
  await poisonEffect.setFlag(SYSTEM_ID, "poisonRoundsPassed", newRounds);

  // Check if 3 rounds have passed
  if (newRounds >= 3) {
    // Apply unconscious effect with proper configuration
    const unconsciousEffectData = {
      name: "Unconscious",
      label: "Unconscious",
      icon: "systems/stryder/assets/status/unconscious.svg",
      disabled: false,
      duration: {
        rounds: 60, // 1 hour in rounds (8 seconds per round * 60 = 480 seconds = 8 minutes)
        seconds: 3600, // 1 hour in seconds
        startRound: game.combat?.round || 0
      },
      flags: {
        core: {
          statusId: "unconscious"
        },
        [SYSTEM_ID]: {
          isUnconscious: true
        }
      }
    };

    // Create the unconscious effect first
    await actor.createEmbeddedDocuments('ActiveEffect', [unconsciousEffectData]);

    // Send notification before removing the poison effect
    const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name} has fallen unconscious from <strong>Poison</strong></h3>
      </div>
      
      <div class="chat-message-details">
        <div class="chat-message-detail-row">
          <p>${actor.name} has fallen unconscious due to the poison circulating in their veins. If they are not properly treated in 1 hour, they will die permanently.</p>
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

    // Remove poison effect after sending message
    await actor.deleteEmbeddedDocuments('ActiveEffect', [poisonEffect.id]);
  }
}

// Register the hook to handle Poison effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Poison effect that needs configuration
  if ((effect.label === "Poisoned" || effect.name === "Poisoned" || 
       effect.label?.includes("Poisoned") || effect.name?.includes("Poisoned")) && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Poison");
    await handlePoisonApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Poisoned" || effect.name === "Poisoned" || 
       effect.label?.includes("Poisoned") || effect.name?.includes("Poisoned")) && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.poisonStage) {
      console.log("updateActiveEffect hook triggered for Poison - adding missing data");
      await handlePoisonApplication(effect);
    }
  }
});

// Hook to handle poison effects during combat turns
Hooks.on('updateCombat', async (combat, updateData, options, userId) => {
  console.log("updateCombat hook triggered:", updateData);
  // Only process on turn change for the current user
  if (updateData.turn !== undefined && game.user.id === userId) {
    console.log("Turn change detected, processing poison effects");
    
    // Clear poison damage flags for all combatants at the start of each turn
    for (const combatant of combat.combatants) {
      await combatant.unsetFlag(SYSTEM_ID, "hasTakenPoisonDamage");
    }
    
    const combatant = combat.combatants.get(combat.current.combatantId);
    console.log("Current combatant:", combatant?.actor?.name);
    if (combatant) {
      await handlePoisonStage2Damage(combatant);
      await handlePoisonStage4Unconscious(combatant);
    }
  }
});

// Alternative hook using socket communication for turn changes
Hooks.once('ready', () => {
  if (game.socket) {
    game.socket.on(`system.stryder`, async (data) => {
      console.log("Socket message received:", data);
      if (data.type === "turnChangeNotification") {
        console.log("Socket turn change notification received, processing poison effects");
        
        const combat = game.combat;
        if (!combat) return;
        
        // Clear poison damage flags for all combatants at the start of each turn
        for (const combatant of combat.combatants) {
          console.log(`Clearing poison flag for ${combatant.actor?.name}`);
          await combatant.unsetFlag(SYSTEM_ID, "hasTakenPoisonDamage");
        }
        
        const combatant = combat.combatants.get(combat.current.combatantId);
        console.log("Current combatant from socket:", combatant?.actor?.name);
        if (combatant) {
          await handlePoisonStage2Damage(combatant);
          await handlePoisonStage4Unconscious(combatant);
        }
      }
    });
  } else {
    console.log("Game socket not available");
  }
});

// Hook to handle poison stage 1 roll modifications
Hooks.on('preCreateChatMessage', (message, options, userId) => {
  if (message.rolls?.length && game.user.id === userId) {
    const roll = message.rolls[0];
    if (roll) {
      // Find the actor from the message speaker
      const speaker = message.speaker;
      if (speaker.actor) {
        const actor = game.actors.get(speaker.actor);
        if (actor) {
          handlePoisonStage1Roll(roll, actor);
        }
      }
    }
  }
});