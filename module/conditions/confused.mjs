import { SYSTEM_ID } from '../helpers/constants.mjs';
import { getFantasmActionType } from '../documents/item.mjs';

export const confusedState = {
  waitingForConfusedResponse: false,
  nextRollShouldBeBlocked: false,
  pendingMessageData: null
};

export async function handleConfusedApplication(effect) {
  const actor = effect.parent;
  
  // Update the effect to include the Confused penalties
  await effect.update({
    name: "Confused",
    label: "Confused",
    changes: [],
    flags: {
      [SYSTEM_ID]: {
        isConfused: true
      }
    }
  });
}

export async function handleConfusedRollIntercept(item, actor) {
  if (!actor || confusedState.waitingForConfusedResponse) return null;
  
  const isConfused = actor.effects.find(e => 
    e.label === "Confused" && e.flags[SYSTEM_ID]?.isConfused
  );
  
  if (!isConfused) return null;
  
  // Check if this is a focused action or should be intercepted
  let shouldIntercept = false;
  
  // Case 1: Focused action type
  if (item.system.action_type === "focused") {
    shouldIntercept = true;
  }
  // Case 2: Armament item type
  else if (item.type === "armament") {
    shouldIntercept = true;
  }

  // Case 3: Fantasm item type with "Focused" in content
  else if (item.type === "fantasm") {
	  const fantasmActionType = getFantasmActionType(item);
	  shouldIntercept = fantasmActionType === "Focused";
  }
  
  if (!shouldIntercept) return null;
  
  confusedState.waitingForConfusedResponse = true;
  confusedState.nextRollShouldBeBlocked = false;
  
  // Store the full item data and actor for later use
  confusedState.pendingMessageData = {
    item: item.toObject(),
    actorId: actor.id,
    speaker: ChatMessage.getSpeaker({actor}),
    rollMode: game.settings.get('core', 'rollMode')
  };

  // Create the dialog content using the HTML template
  const content = await renderTemplate(`systems/stryder/templates/conditions/confused-dialog.hbs`, {
    actorName: actor.name
  });

  // Create the chat message
  const message = await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    flags: {
      [SYSTEM_ID]: {
        confusedCheck: true,
        actorId: actor.id,
        itemId: item.id
      }
    }
  });

  return message.id;
}

export async function processConfusedRoll(actor, dc, messageId) {
  // Create a simple dialog asking if the resistance check succeeded
  const dialogContent = `
    <div class="chat-message-card">
      <div class="chat-message-header">
        <h3 class="chat-message-title">${actor.name} is <strong>Confused</strong></h3>
      </div>
      <div class="chat-message-content">
        <p>DC: ${dc}</p>
        <p>Did ${actor.name} succeed on their Magykal Resist check?</p>
      </div>
      <div class="effect-buttons">
        <button class="effect-button yes" data-action="succeeded">
          <i class="fas fa-check"></i> Succeeded
        </button>
        <button class="effect-button no" data-action="failed">
          <i class="fas fa-times"></i> Failed
        </button>
      </div>
    </div>
  `;

  const resultMessage = await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({actor}),
    content: dialogContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    flags: {
      [SYSTEM_ID]: {
        confusedResult: true,
        actorId: actor.id,
        messageId: messageId,
        dc: dc
      }
    }
  });

  // Delete the original dialog message
  const message = game.messages.get(messageId);
  if (message) await message.delete();
}

// Handle the response to the confused check - V13 compatible
Hooks.on('renderChatMessageHTML', (message, html, data) => {
  const confusedCheck = message.getFlag(SYSTEM_ID, 'confusedCheck');
  const confusedResult = message.getFlag(SYSTEM_ID, 'confusedResult');
  const processed = message.getFlag(SYSTEM_ID, 'processed');
  
  // Handle the initial DC input dialog
  if (confusedCheck && !processed) {
    const rollButton = html.querySelector('.confused-roll-button');
    if (rollButton) {
      rollButton.addEventListener('click', async (event) => {
        if (rollButton.disabled) return;
        rollButton.disabled = true;
        
        const dcInput = html.querySelector('.confused-dc-input');
        const dc = parseInt(dcInput.value);
        
        if (isNaN(dc)) {
          ui.notifications.error("Please enter a valid number for the DC!");
          rollButton.disabled = false;
          return;
        }

        const actorId = message.getFlag(SYSTEM_ID, 'actorId');
        const actor = game.actors.get(actorId);
        const messageId = message.id;

        if (actor) {
          // Mark message as processed
          await message.setFlag(SYSTEM_ID, 'processed', true);
          await processConfusedRoll(actor, dc, messageId);
        }
      });
    }
  }
  
  // Handle the succeeded/failed result dialog
  if (confusedResult && !processed) {
    const buttons = html.querySelectorAll('.effect-button');
    buttons.forEach(button => {
      button.addEventListener('click', async (event) => {
        if (button.disabled) return;
        button.disabled = true;
        
        const action = event.currentTarget.dataset.action;
        const actorId = message.getFlag(SYSTEM_ID, 'actorId');
        const actor = game.actors.get(actorId);
        
        if (!actor) return;
        
        // Mark message as processed
        await message.setFlag(SYSTEM_ID, 'processed', true);
        
        if (action === "succeeded") {
          // Remove Confused effect
          const confusedEffect = actor.effects.find(e => 
            e.label === "Confused" || e.name === "Confused"
          );
          if (confusedEffect) {
            await confusedEffect.delete();
          }
          
          // Update message to show success
          const successContent = `
            <div class="chat-message-card">
              <div class="chat-message-header">
                <h3 class="chat-message-title">${actor.name} is <strong>Confused</strong></h3>
              </div>
              <div class="chat-message-content">
                <p><strong>${actor.name} succeeded!</strong> They snapped out of Confusion and are no longer affected!</p>
              </div>
            </div>
          `;
          await message.update({ content: successContent });
          
          // Execute the original message
          if (confusedState.pendingMessageData) {
            const { originalData } = confusedState.pendingMessageData;
            
            if (originalData) {
              // This was a focused action intercepted at message level
              await ChatMessage.create(originalData);
            }
          }
        } else if (action === "failed") {
          // Update message to show failure
          const failureContent = `
            <div class="chat-message-card">
              <div class="chat-message-header">
                <h3 class="chat-message-title">${actor.name} is <strong>Confused</strong></h3>
              </div>
              <div class="chat-message-content">
                <p><strong>Focused Action failed to activate due to Confusion, but ${actor.name} did not expend any resources.</strong></p>
              </div>
            </div>
          `;
          await message.update({ content: failureContent });
        }
        
        // Clean up
        confusedState.waitingForConfusedResponse = false;
        confusedState.nextRollShouldBeBlocked = false;
        confusedState.pendingMessageData = null;
      });
    });
  }
});

// Register the hook to handle Confused effect application
Hooks.on('createActiveEffect', async (effect, options, userId) => {
  if ((effect.label === "Confused" || effect.name === "Confused") && game.user.id === userId) {
    await handleConfusedApplication(effect);
  }
});

// Add updateActiveEffect hook as fallback
Hooks.on('updateActiveEffect', async (effect, changes, options, userId) => {
  if ((effect.label === "Confused" || effect.name === "Confused") && game.user.id === userId) {
    await handleConfusedApplication(effect);
  }
});