import { SYSTEM_ID } from '../helpers/constants.mjs';

export async function handleMuteApplication(effect) {
  const actor = effect.parent;
  
  console.log("Mute effect being configured:", effect);
  
  // Update the effect to mark it as Mute
  await effect.update({
    name: "Mute",
    label: "Mute",
    changes: [],
    flags: {
      [SYSTEM_ID]: {
        isMute: true
      }
    }
  });
  
  console.log("Mute effect after update:", effect);
}

// Function to remove mute effects
export async function removeMuteEffects(actor) {
  const muteEffects = actor.effects.filter(e => 
    e.flags[SYSTEM_ID]?.isMute
  );
  
  if (muteEffects.length === 0) return;
  
  // Remove all mute effects
  const effectIds = muteEffects.map(e => e.id);
  await actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
  
  // Send notification
  const messageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name}'s Mute condition has been removed</h3>
      </div>
      <div class="chat-message-content">
        <p>${actor.name} can now speak and evoke hexes again.</p>
      </div>
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content: messageContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
  
  console.log(`Removed Mute effects from ${actor.name}`);
}

// Function to check if actor is muted
export function isActorMuted(actor) {
  const muteEffect = actor.effects.find(e => {
    const hasLabel = e.label === "Mute";
    const hasName = e.name === "Mute";
    const isMuteEffect = hasLabel || hasName || e.flags[SYSTEM_ID]?.isMute;
    return isMuteEffect;
  });
  
  return !!muteEffect;
}

// Function to handle hex blocking for muted characters
export async function handleMuteHexBlocking(message, actor) {
  // Check if actor is muted
  if (!isActorMuted(actor)) return false;
  
  // Check if this is a hex item message (either from chat message or item roll)
  const isHexMessage = (message.flags?.[SYSTEM_ID]?.itemId && 
                       message.flags?.[SYSTEM_ID]?.itemType === 'hex') ||
                      message.flags?.[SYSTEM_ID]?.itemType === 'hex';
  
  if (!isHexMessage) return false;
  
  // Block the hex message and send mute notification
  const muteMessageContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name} is Muted</h3>
      </div>
      <div class="chat-message-content">
        <p>${actor.name} is currently Muted and cannot evoke hexes.</p>
        <p><em>The hex attempt has been blocked.</em></p>
      </div>
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content: muteMessageContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
  
  console.log(`Blocked hex from muted actor: ${actor.name}`);
  return true; // Indicate that the message was blocked
}

// Register the hook to handle Mute effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  // Check if this is a Mute effect that needs configuration
  if ((effect.label === "Mute" || effect.name === "Mute") && game.user.id === userId) {
    console.log("createActiveEffect hook triggered for Mute");
    await handleMuteApplication(effect);
  }
});

// Alternative hook in case the first one doesn't catch it
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Mute" || effect.name === "Mute") && game.user.id === userId) {
    // Check if the effect doesn't have the proper flags yet
    if (!effect.flags[SYSTEM_ID]?.isMute) {
      console.log("updateActiveEffect hook triggered for Mute - adding missing data");
      await handleMuteApplication(effect);
    }
  }
});

// Hook to handle Mute effect deletion
Hooks.on('deleteActiveEffect', async (effect, options, userId) => {
  if ((effect.label === "Mute" || effect.name === "Mute") && game.user.id === userId) {
    console.log("Mute effect deleted, sending removal notification");
    const actor = effect.parent;
    if (actor) {
      // Send notification
      const messageContent = `
        <div class="chat-message-card">
          <div class="chat-message-header">
            <h3 class="chat-message-title">${actor.name}'s Mute condition has been removed</h3>
          </div>
          <div class="chat-message-content">
            <p>${actor.name} can now speak and evoke hexes again.</p>
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
});
