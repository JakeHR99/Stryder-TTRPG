/**
 * System hook definitions for Stryder
 */

export const StryderHooks = {
    COMBAT_EVENT: "stryderCombatEvent",
    COMBAT_TURN_CHANGE: "combatTurnChange",
    COMBAT_ROUND_CHANGE: "combatRound"
};

/**
 * Determines faction based on token disposition
 * @param {number} disposition - Token disposition value
 * @returns {string} 'allied' or 'enemy'
 */
function getFactionFromDisposition(disposition) {
    // Friendly (1) or Secret (-2) are Allies
    if (disposition === 1 || disposition === -2) return 'allied';
    // Neutral (0) or Hostile (-1) are Enemies
    return 'enemy';
}

export function registerHooks() {
    // Update faction when token disposition changes
    Hooks.on("updateToken", (scene, tokenData, updateData, options, userId) => {
        if (hasProperty(updateData, 'disposition')) {
            const token = canvas.tokens.get(tokenData._id);
            if (token?.inCombat) {
                const combatant = game.combat?.combatants.find(c => c.tokenId === token.id);
                if (combatant) {
                    ui.combat?.render();
                }
            }
        }
    });

    // Set initial faction when combatant is created
    Hooks.on("createCombatant", (combatant, options, userId) => {
        const token = canvas.tokens.get(combatant.tokenId);
        if (token) {
            const faction = getFactionFromDisposition(token.document.disposition);
            combatant.update({[`flags.${SYSTEM_ID}.faction`]: faction});
        }
    });

    // Standard combat hooks
    Hooks.on("updateCombat", (combat, updateData, options, userId) => {
        if (ui.combat?.viewed === combat) ui.combat.render();
    });

    Hooks.on("updateCombatant", (combatant, updateData, options, userId) => {
        if (ui.combat?.viewed?.combatants.has(combatant.id)) {
            ui.combat.render();
        }
    });

    // Combat event logging
    Hooks.on(StryderHooks.COMBAT_EVENT, (event) => {
        if (event.type === 'startOfCombat') {
            console.log(`Stryder | Combat started - Round ${event.round}`);
        }
        else if (event.type === 'startOfTurn' && event.combatant) {
            const faction = event.combatant.token?.document.disposition === 1 ? 'Allied' : 'Enemy';
            console.log(`Stryder | ${event.combatant.name}'s (${faction}) turn started`);
        }
    });
}

import { SYSTEM_ID } from '../helpers/constants.mjs';
import { StryderCombat } from '../combat/combat.mjs';