import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleBurningApplication(effect) {
  const actor = effect.parent;
  
  console.log("Burning effect being configured:", effect);
  
  // Check if actor is already Soaked
  const isSoaked = actor.effects.find(e => {
    const hasLabel = e.label === "Soaked";
    const hasName = e.name === "Soaked";
    const isSoakedEffect = hasLabel || hasName;
    return isSoakedEffect;
  });
  
  if (isSoaked) {
    console.log("Actor is already Soaked, preventing Burning application");
    ui.notifications.error(`${actor.name} is Soaked and cannot become Burning!`);
    await actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id]);
    return;
  }

  // Update the effect to mark it as Burning
  await effect.update({
    name: "Burning",
    label: "Burning",
    changes: [],
    flags: {
      [SYSTEM_ID]: {
        isBurning: true
      }
    }
  });
  
  console.log("Burning effect after update:", effect);
}

export async function handleBurningDamage(combatant) {
  const actor = combatant.actor;
  if (!actor) return;

  console.log("handleBurningDamage called for:", actor.name);

  // Check if burning damage has already been applied this turn
  const hasTakenBurningDamage = combatant.getFlag(SYSTEM_ID, "hasTakenBurningDamage");
  console.log("Has taken burning damage this turn:", hasTakenBurningDamage);
  
  // TEMPORARY: Clear the flag if it exists (for debugging)
  if (hasTakenBurningDamage) {
    console.log("Clearing burning damage flag manually");
    await combatant.unsetFlag(SYSTEM_ID, "hasTakenBurningDamage");
    // Don't return - continue with damage processing
  }

  // Find burning effect
  const burningEffect = actor.effects.find(e => {
    const hasLabel = e.label === "Burning";
    const hasName = e.name === "Burning";
    const isBurningEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isBurning;
    return isBurningEffect;
  });
  
  console.log("Found burning effect:", !!burningEffect);
  console.log("Actor health:", actor.system.health.value);
  
  if (!burningEffect || actor.system.health.value <= 0) return;

  // Apply 3 damage
  const damage = Math.min(3, actor.system.health.value);

  if (damage <= 0) return;

  // Set flag to indicate burning damage has been applied this turn
  await combatant.setFlag(SYSTEM_ID, "hasTakenBurningDamage", true);

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
        <h3 class="chat-message-title">${actor.name} took ${damage} damage from <strong>Burning</strong></h3>
      </div>
      
      <div class="chat-message-details">
        <div class="chat-message-detail-row">
          <span class="chat-message-detail-label">Damage Type:</span>
          <span class="chat-damage-type-box">Persistent</span>
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

export async function handleBurningMaxHealthReduction(combatant) {
  const actor = combatant.actor;
  if (!actor) return;

  console.log("handleBurningMaxHealthReduction called for:", actor.name);

  // Find burning effect
  const burningEffect = actor.effects.find(e => {
    const hasLabel = e.label === "Burning";
    const hasName = e.name === "Burning";
    const isBurningEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isBurning;
    return isBurningEffect;
  });
  
  console.log("Found burning effect for max health reduction:", !!burningEffect);
  if (!burningEffect) return;

  // Get current burning health reduction
  const currentReduction = actor.getFlag(SYSTEM_ID, "burningHealthReduction") || 0;
  
  // Increase reduction by 1
  const newReduction = currentReduction + 1;
  await actor.setFlag(SYSTEM_ID, "burningHealthReduction", newReduction);

  // Send notification
  const messageContent = `
  <div class="chat-message-card">
    <div class="chat-message-header">
      <h3 class="chat-message-title">${actor.name}'s maximum Health reduced by 1 from <strong>Burning</strong></h3>
    </div>
    
    <div class="chat-message-details">
      <div class="chat-message-detail-row">
        <span class="chat-message-detail-label">Total Health Lost:</span>
        <span class="chat-health-box">${newReduction}</span>
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

// Hook to check for Soaked condition application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Soaked effect that should remove Burning
  if ((effect.label === "Soaked" || effect.name === "Soaked") && game.user.id === userId) {
    console.log("Soaked condition applied, checking for Burning to remove");
    const actor = effect.parent;
    
    // Find burning effect using robust detection
    const burningEffect = actor.effects.find(e => {
      const hasLabel = e.label === "Burning";
      const hasName = e.name === "Burning";
      const isBurningEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isBurning;
      return isBurningEffect;
    });
    
    if (burningEffect) {
      console.log("Found burning effect to remove:", burningEffect);
      await actor.deleteEmbeddedDocuments('ActiveEffect', [burningEffect.id]);
      ui.notifications.info(`${actor.name} is now Soaked - Burning condition removed!`);
    } else {
      console.log("No burning effect found to remove");
    }
  }
});

// Hook to check for Burning condition application that should remove Frozen
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Burning effect that should remove Frozen
  if ((effect.label === "Burning" || effect.name === "Burning") && game.user.id === userId) {
    console.log("Burning condition applied, checking for Frozen to remove");
    const actor = effect.parent;
    
    // Find frozen effect using robust detection
    const frozenEffect = actor.effects.find(e => {
      const hasLabel = e.label === "Frozen";
      const hasName = e.name === "Frozen";
      const isFrozenEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isFrozen;
      return isFrozenEffect;
    });
    
    if (frozenEffect) {
      console.log("Found frozen effect to remove:", frozenEffect);
      await actor.deleteEmbeddedDocuments('ActiveEffect', [frozenEffect.id]);
      
      // Send notification
      const messageContent = `
        <div class="chat-message-card">
          <div class="chat-message-header">
            <h3 class="chat-message-title">${actor.name}'s Frozen condition has been removed by Burning</h3>
          </div>
          <div class="chat-message-content">
            <p>${actor.name} has thawed out due to the Burning condition.</p>
          </div>
        </div>
      `;

      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({actor}),
        content: messageContent,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
      });
      
      ui.notifications.info(`${actor.name} is now Burning - Frozen condition removed!`);
    } else {
      console.log("No frozen effect found to remove");
    }
  }
});

// Register the hook to handle Burning effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Burning effect that needs configuration
  if ((effect.label === "Burning" || effect.name === "Burning") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Burning");
    await handleBurningApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Burning" || effect.name === "Burning") && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.isBurning) {
      console.log("updateActiveEffect hook triggered for Burning - adding missing data");
      await handleBurningApplication(effect);
    }
  }
});

// Add these hooks to trigger burning effects
Hooks.on('updateCombat', async (combat, updateData, options, userId) => {
  console.log("updateCombat hook triggered for burning:", updateData);
  // Only process on turn change for the current user
  if (updateData.turn !== undefined && game.user.id === userId) {
    console.log("Turn change detected, processing burning effects");
    
    // Clear burning damage flags for all combatants at the start of each turn
    for (const combatant of combat.combatants) {
      await combatant.unsetFlag(SYSTEM_ID, "hasTakenBurningDamage");
    }
    
    const combatant = combat.combatants.get(combat.current.combatantId);
    console.log("Current combatant:", combatant?.actor?.name);
    if (combatant) {
      await handleBurningDamage(combatant);
      await handleBurningMaxHealthReduction(combatant);
    }
  }
});

// Alternative hook using socket communication for turn changes
Hooks.once('ready', () => {
  if (game.socket) {
    game.socket.on(`system.stryder`, async (data) => {
      console.log("Socket message received for burning:", data);
      if (data.type === "turnChangeNotification") {
        console.log("Socket turn change notification received, processing burning effects");
        
        const combat = game.combat;
        if (!combat) return;
        
        // Clear burning damage flags for all combatants at the start of each turn
        for (const combatant of combat.combatants) {
          console.log(`Clearing burning flag for ${combatant.actor?.name}`);
          await combatant.unsetFlag(SYSTEM_ID, "hasTakenBurningDamage");
        }
        
        const combatant = combat.combatants.get(combat.current.combatantId);
        console.log("Current combatant from socket:", combatant?.actor?.name);
        if (combatant) {
          await handleBurningDamage(combatant);
          await handleBurningMaxHealthReduction(combatant);
        }
      }
    });
  } else {
    console.log("Game socket not available for burning");
  }
});