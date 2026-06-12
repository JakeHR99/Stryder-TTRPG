const BURST_WINDOW = 90_000; // 90 s in ms

function burstKey(message) {
  const actor = message.speaker?.actor || message.speaker?.alias || 'sys';
  const whisper = (message.whisper ?? []).join(',');
  const blind = message.blind ? 1 : 0;
  return `${actor}|${whisper}|${blind}`;
}

function formatRelTs(deltaMs) {
  const s = Math.round(deltaMs / 1000);
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
}

function recomputeLog(chatLog) {
  if (!chatLog) return;
  const lis = Array.from(chatLog.querySelectorAll('li.chat-message[data-message-id]'));

  for (const li of lis) {
    li.classList.remove('sty-grp-start', 'sty-grp-follow', 'sty-grp-end');
    delete li.dataset.styMeta;
  }

  for (let i = 0; i < lis.length; i++) {
    const li = lis[i];
    const msg = game.messages.get(li.dataset.messageId);
    if (!msg) { li.classList.add('sty-grp-start'); continue; }

    const prevLi = lis[i - 1];
    const prevMsg = prevLi ? game.messages.get(prevLi.dataset.messageId) : null;
    const myTs   = msg.timestamp ?? 0;
    const prevTs = prevMsg?.timestamp ?? 0;

    const isBurst = prevMsg &&
      burstKey(prevMsg) === burstKey(msg) &&
      (myTs - prevTs) < BURST_WINDOW;

    if (isBurst) {
      li.classList.add('sty-grp-follow');
      li.dataset.styMeta = formatRelTs(myTs - prevTs);
    } else {
      li.classList.add('sty-grp-start');
    }
  }

  // Second pass: sty-grp-end goes on every li NOT followed by a burst follower
  for (let i = 0; i < lis.length; i++) {
    if (!lis[i + 1]?.classList.contains('sty-grp-follow')) {
      lis[i].classList.add('sty-grp-end');
    }
  }
}

export function registerChatGrouping() {
  Hooks.on('renderChatMessageHTML', (message, html) => {
    requestAnimationFrame(() => {
      try {
        // Normalize: parseHTML returns HTMLCollection (multiple roots) when the chat
        // template has more than one root element; handle both HTMLElement and collection.
        const el = html instanceof HTMLElement ? html
          : html?.[0] instanceof HTMLElement ? html[0] : null;
        if (!el) return;
        const li = el.tagName === 'LI' ? el : el.closest('li.chat-message');
        const log = li?.closest('ol') ?? document.querySelector('#chat-log');
        recomputeLog(log);
      } catch (err) {
        console.warn('[stryder|chat-grouping]', err);
      }
    });
  });

  Hooks.on('deleteChatMessage', () => {
    requestAnimationFrame(() => {
      try {
        recomputeLog(document.querySelector('#chat-log'));
      } catch (err) {
        console.warn('[stryder|chat-grouping]', err);
      }
    });
  });
}
