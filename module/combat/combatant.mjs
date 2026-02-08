import { ALLIED, ENEMY } from './combat.mjs';
import { SYSTEM_ID, STRYDER } from '../helpers/constants.mjs';

/**
 * Simplified Combatant class for Stryder system
 * @extends Combatant
 */
export class StryderCombatant extends Combatant {
    /**
     * Get the faction of this combatant (ALLIED or ENEMY)
     * @returns {string}
     */
    get faction() {
        // First check if faction is explicitly set in flags
        const explicitFaction = this.getFlag(SYSTEM_ID, 'faction');
        if (explicitFaction) return explicitFaction;
        
        // Check actor type first - this is more reliable than token disposition
        const actorType = this.actor?.type;
        if (actorType === 'monster') return ENEMY;
        if (actorType === 'character' || actorType === 'npc') return ALLIED;
        
        // Fallback to token disposition
        const token = this.token;
        if (token && token.document && token.document.disposition !== undefined) {
            return token.document.disposition === 1 ? ALLIED : ENEMY;
        }
        
        // Default to ALLIED
        return ALLIED;
    }

    /**
     * Each combatant gets exactly 1 turn per round
     * @returns {number}
     */
    get totalTurns() {
        return 1;
    }

    /**
     * Check if this combatant can take a turn
     * @returns {boolean}
     */
	get canTakeTurn() {
	  if (this.isDefeated) return false;
	  if (!this.visible) return false;
	  if (!this.actor) return false;
	  return true;
	}

	async toggleDefeated() {
	  const defeated = !this.isDefeated;
	  await this.update({ defeated });
	  
	  // If this combatant was active, end their turn
	  if (defeated && this.isActive) {
		await this.combat.endTurn(this);
	  }
	}

    get isActive() {
        return this.combat?.combatant?.id === this.id;
    }

	get isActiveTurn() {
		return this.combat?.getFlag(SYSTEM_ID, STRYDER.flags.ActiveTurns)?.includes(this.id) && 
			   !this.combat.currentRoundTurnsTaken.includes(this.id);
	}

	async setActiveTurn(isActive) {
		const activeTurns = this.combat?.getFlag(SYSTEM_ID, STRYDER.flags.ActiveTurns) || [];
		const newActiveTurns = isActive 
			? [...new Set([...activeTurns, this.id])]
			: activeTurns.filter(id => id !== this.id);
		
		if (!game.user.isGM) {
			// For non-GMs, request the GM to make the update
			return game.socket.emit(`system.${SYSTEM_ID}`, {
				type: "updateCombatFlag",
				combatId: this.combat.id,
				flag: STRYDER.flags.ActiveTurns,
				value: newActiveTurns
			});
		}
		
		return this.combat?.setFlag(SYSTEM_ID, STRYDER.flags.ActiveTurns, newActiveTurns);
	}

    /**
     * @override
     * Custom combatant sorting
     */
    _sortCombatants(a, b) {
        // Sort by faction
        if (a.faction !== b.faction) {
            return a.faction === ALLIED ? -1 : 1;
        }
        
        // Then alphabetically by name
        return a.name.localeCompare(b.name);
    }

    /**
     * @override
     * Custom update handling
     */
    async _onUpdate(changed, options, userId) {
        await super._onUpdate(changed, options, userId);
        
        // Update combat tracker if this combatant changed
        if (ui.combat?.viewed === this.parent) {
            ui.combat.render();
        }
    }
}

/**
 * Helper to find combatant by actor UUID
 * @param {string} uuid 
 * @returns {StryderCombatant|null}
 */
export function getCombatantByActorUuid(uuid) {
    if (!game.combat) return null;
    return game.combat.combatants.find(c => c.actor?.uuid === uuid);
}