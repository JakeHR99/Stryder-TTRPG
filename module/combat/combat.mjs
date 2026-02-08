import {
    SYSTEM_ID,
    STRYDER
} from '../helpers/constants.mjs';
import {
    StryderHooks
} from '../helpers/hooks.mjs';

export const ALLIED = 'allied';
export const ENEMY = 'enemy';

/**
 * Combat event class for Stryder system
 */
export class CombatEvent {
    constructor(type, round, combatants) {
        this.type = type;
        this.round = round;
        this.combatants = combatants;
    }

    forCombatant(combatant) {
        this.combatant = combatant;
        return this;
    }

    get token() {
        return this.combatant?.token;
    }

    get actor() {
        return this.combatant?.actor;
    }

    get actors() {
        return this.combatants.map(c => c.actor).filter(a => a);
    }
}

/**
 * Stryder Combat class - faction-based combat system
 */
export const ACTIVE_TURNS = 'activeTurns';

export class StryderCombat extends Combat {
    static get combatEvent() {
        return {
            startOfCombat: 'startOfCombat',
            endOfCombat: 'endOfCombat',
            startOfRound: 'startOfRound',
            endOfRound: 'endOfRound',
            startOfTurn: 'startOfTurn',
            endOfTurn: 'endOfTurn'
        };
    }

    get nextCombatant() {
        return null;
    }

    async rollInitiative(ids, options) {
        return this;
    }

    get combatant() {
        const id = this.getFlag(SYSTEM_ID, STRYDER.flags.CombatantId);
        return id != null ? this.combatants.get(id) : null;
    }

	async setCombatant(combatant) {
		return this.setFlag(SYSTEM_ID, STRYDER.flags.CombatantId, combatant?.id ?? null);
	}

    get currentRoundTurnsTaken() {
        const allRoundsTurnsTaken = this.getTurnsTaken();
        return allRoundsTurnsTaken[this.round] ?? [];
    }

    getTurnsTaken() {
        return this.getFlag(SYSTEM_ID, STRYDER.flags.CombatantsTurnTaken) ?? {};
    }

	async setTurnsTaken(flag) {
		if (!game.user.isGM) {
			// Socket to have the GM make the update
			return game.socket.emit(`system.${SYSTEM_ID}`, {
				type: "updateCombatFlag",
				combatId: this.id,
				flag: STRYDER.flags.CombatantsTurnTaken,
				value: flag
			});
		}
		return this.setFlag(SYSTEM_ID, STRYDER.flags.CombatantsTurnTaken, flag);
	}

    get totalTurns() {
        return this.combatants.reduce((sum, combatant) => sum + combatant.totalTurns, 0);
    }

    async startCombat() {
        const factions = [{
                value: ALLIED,
                translation: 'Ally Phase'
            },
            {
                value: ENEMY,
                translation: 'Enemy Phase'
            }
        ];

        // Simple prompt approach
        const templateContent = await foundry.applications.handlebars.renderTemplate('systems/stryder/templates/combat/dialog-first-turn.hbs', {
            factions
        });
        
        const firstTurnFaction = await new Promise((resolve) => {
            const dialog = new Dialog({
                title: game.i18n.localize('Selecting Starting Phase'),
                content: templateContent,
                buttons: {
                    ok: {
                        label: "OK",
                        callback: (html) => {
                            const selectedFaction = html.find('select[name=faction]').val();
                            resolve(selectedFaction);
                        }
                    }
                },
                default: "ok",
                close: () => resolve(null)
            });
            dialog.render(true);
        });

        if (!firstTurnFaction) return this;

        await this.update({
            round: 1
        });
        await this.setFirstTurn(firstTurnFaction);
        await this.setCurrentTurn(firstTurnFaction);

        // Clear all turn states for the start of combat
        await this.setFlag(SYSTEM_ID, STRYDER.flags.CombatantsTurnTaken, {});
        await this.setFlag(SYSTEM_ID, STRYDER.flags.StartedTurns, []);
        await this.setFlag(SYSTEM_ID, STRYDER.flags.ActiveTurns, []);
        await this.setCombatant(null);

        // Don't automatically start turns - let the UI buttons handle it
        // This ensures all actors start with "Start Turn" buttons and inactive turns

        Hooks.callAll('stryderCombatEvent',
            new CombatEvent(StryderCombat.combatEvent.startOfCombat, this.round, this.combatants));

        return super.startCombat();
    }

    async endCombat() {
        const ended = await super.endCombat();
        if (ended) {
            Hooks.callAll('stryderCombatEvent',
                new CombatEvent(StryderCombat.combatEvent.endOfCombat, this.round, this.combatants));
        }
        return ended;
    }

	notifyCombatTurnChange() {
		// Refresh the combat tracker
		if (ui.combat?.viewed === this) {
			ui.combat.render();
		}

		// Get the active combatant
		const combatant = this.combatant;
		if (!combatant) return;

		// Play sound effect
		AudioHelper.play({
			src: "systems/stryder/assets/sfx/turnChange.ogg",
			volume: 0.8,
			autoplay: true,
			loop: false
		}, false);

		// Show notification
		const notification = document.createElement('div');
		notification.className = 'turn-notification';
		notification.textContent = `${combatant.name} has started their turn!`;
		document.body.appendChild(notification);

		// Remove notification after animation completes
		setTimeout(() => {
			notification.remove();
		}, 3000);
	}

    async _manageTurnEvents(adjustedTurn) {
        if (!game.users.activeGM?.isSelf) return;

        let prior = undefined;
        if (this.previous) {
            prior = this.combatants.get(this.previous.combatantId);
        }

        if (Number.isNumeric(adjustedTurn)) {
            await this.update({
                turn: adjustedTurn
            }, {
                turnEvents: false
            });
        }

        if (!this.started) return;

        const advanceRound = this.current.round > (this.previous.round ?? -1);
        const advanceTurn = this.current.turn > (this.previous.turn ?? -1);
        if (!(advanceTurn || advanceRound)) return;

        if (prior) {
            await this._onEndTurn(prior);
        }

        if (advanceRound && this.previous.round !== null) {
            await this._onEndRound();
        }

        if (advanceRound) {
            await this._onStartRound();
        }
    }


	async startFactionTurn(faction) {
		if (!this.started) return;

		const factionCombatants = this.combatants.filter(c => c.faction === faction && c.canTakeTurn);
		
		// Start all turns for this faction simultaneously
		for (const combatant of factionCombatants) {
			await this.startTurn(combatant);
		}
	}

	async startTurn(combatant) {
		console.log('STRYDER DEBUG | startTurn called for:', combatant?.name);
		console.log('STRYDER DEBUG | Combat state:', {
			started: this.started,
			round: this.round,
			currentTurn: this.getCurrentTurn(),
			combatantFaction: combatant?.faction
		});

		if (!combatant || !this.started) {
			console.warn('STRYDER DEBUG | Early return - no combatant or combat not started');
			return;
		}

		// Check permissions - only GM or owner can start turn
		const isGM = game.user.isGM;
		const isOwner = combatant.actor?.testUserPermission(game.user, "OWNER") ?? false;
		
		console.log('STRYDER DEBUG | Permissions:', { isGM, isOwner });
		
		if (!isGM) {
			if (!isOwner) {
				console.warn('STRYDER DEBUG | Permission denied');
				return ui.notifications.warn(`You don't have permission to start ${combatant.name}'s turn`);
			}
			// For non-GM owners, request the GM to make the change
			console.log('STRYDER DEBUG | Requesting GM to start turn');
			return game.socket.emit(`system.${SYSTEM_ID}`, {
				type: "startCombatantTurn",
				combatId: this.id,
				combatantId: combatant.id
			});
		}

		const currentTurn = this.getCurrentTurn();
		console.log('STRYDER DEBUG | Turn check:', {
			currentTurn,
			combatantFaction: combatant.faction,
			match: combatant.faction === currentTurn
		});
		
		if (combatant.faction !== currentTurn) {
			console.warn('STRYDER DEBUG | Wrong faction phase');
			return ui.notifications.warn(`It's not the ${combatant.faction} phase yet!`);
		}

		console.log('STRYDER DEBUG | Can take turn check:', {
			canTakeTurn: combatant.canTakeTurn,
			isDefeated: combatant.isDefeated,
			visible: combatant.visible
		});

		if (!combatant.canTakeTurn) {
			console.warn('STRYDER DEBUG | Cannot take turn');
			return ui.notifications.warn(`${combatant.name} can't take a turn right now!`);
		}

		// Check if this combatant has already ended their turn this round
		const turnsTaken = this.currentRoundTurnsTaken;
		console.log('STRYDER DEBUG | Turns taken check:', {
			turnsTaken,
			combatantId: combatant.id,
			hasEnded: turnsTaken.includes(combatant.id)
		});
		
		if (turnsTaken.includes(combatant.id)) {
			console.warn('STRYDER DEBUG | Already ended turn this round');
			return ui.notifications.warn(`${combatant.name} has already ended their turn this round!`);
		}

		console.log('STRYDER DEBUG | All checks passed, updating combat state...');

		// Set this combatant as active using Foundry's turn system
		await this.setCombatant(combatant);
		console.log('STRYDER DEBUG | Combatant set as active');

		// Track that this combatant has started their turn
		const startedTurns = this.getFlag(SYSTEM_ID, STRYDER.flags.StartedTurns) || [];
		if (!startedTurns.includes(combatant.id)) {
			startedTurns.push(combatant.id);
			await this.setFlag(SYSTEM_ID, STRYDER.flags.StartedTurns, startedTurns);
		}

		// Process Active Effects at turn start
		if (combatant.actor) {
			console.log('STRYDER DEBUG | Processing turn start effects');
			await this._processEffectDurations(combatant, 'turnStart');
		}

		console.log('STRYDER DEBUG | Calling combat event hooks');
		Hooks.callAll('stryderCombatEvent',
			new CombatEvent(StryderCombat.combatEvent.startOfTurn, this.round, this.combatants)
			.forCombatant(combatant));

		console.log('STRYDER DEBUG | Notifying combat turn change');
		this.notifyCombatTurnChange();
		
		// Broadcast turn notification to all clients
		game.socket.emit(`system.${SYSTEM_ID}`, {
			type: "turnChangeNotification",
			combatantName: combatant.name
		});
		
		console.log('STRYDER DEBUG | startTurn completed successfully');
	}

	async endTurn(combatant) {
		if (!combatant || !this.started) return;

		// Check permissions - only GM or owner can end turn
		const isGM = game.user.isGM;
		const isOwner = combatant.actor?.testUserPermission(game.user, "OWNER") ?? false;
		
		if (!isGM) {
			if (!isOwner) {
				return ui.notifications.warn(`You don't have permission to end ${combatant.name}'s turn`);
			}
			// For non-GM owners, request the GM to make the change
			return game.socket.emit(`system.${SYSTEM_ID}`, {
				type: "endCombatantTurn",
				combatId: this.id,
				combatantId: combatant.id
			});
		}

		// Process Active Effects at turn end
		if (combatant.actor) {
			await this._processEffectDurations(combatant, 'turnEnd');
		}

		// Mark this combatant as having taken their turn
		const flag = this.getTurnsTaken();
		flag[this.round] ??= [];
		flag[this.round].push(combatant.id);
		await this.setFlag(SYSTEM_ID, STRYDER.flags.CombatantsTurnTaken, flag);

		// Clear current combatant
		await this.setCombatant(null);

		// Remove from started turns list
		const startedTurns = this.getFlag(SYSTEM_ID, STRYDER.flags.StartedTurns) || [];
		const updatedStartedTurns = startedTurns.filter(id => id !== combatant.id);
		await this.setFlag(SYSTEM_ID, STRYDER.flags.StartedTurns, updatedStartedTurns);

		Hooks.callAll('stryderCombatEvent',
			new CombatEvent(StryderCombat.combatEvent.endOfTurn, this.round, this.combatants)
			.forCombatant(combatant));

		// Check if all combatants of current faction have taken their turns
		const currentTurn = this.getCurrentTurn();
		const factionCombatants = this.combatants.filter(c => c.faction === currentTurn);
		const turnsTaken = this.currentRoundTurnsTaken;

		const allFactionActed = factionCombatants.every(c =>
			turnsTaken.includes(c.id) || !c.canTakeTurn
		);

		if (allFactionActed) {
			// Switch to next faction
			const nextTurn = currentTurn === ALLIED ? ENEMY : ALLIED;
			await this.setCurrentTurn(nextTurn);

			// Check if all factions have acted
			const allCombatants = this.combatants.filter(c => c.canTakeTurn);
			const allActed = allCombatants.every(c =>
				turnsTaken.includes(c.id)
			);

			if (allActed) {
				await this.nextRound();
			}
		}

		this.notifyCombatTurnChange();
	}


	async _processEffectDurations(combatant, phase) {
		if (!combatant.actor) return;
		
		const updates = [];
		const expiringEffects = [];
		
		for (const effect of combatant.actor.effects) {
			if (!effect.duration) continue;
			
			const duration = foundry.utils.duplicate(effect.duration);
			let changed = false;
			let shouldExpire = false;
			
			// Handle round-based durations
			if (duration.rounds && phase === 'roundEnd') {
				duration.rounds = Math.max(0, duration.rounds - 1);
				changed = true;
				shouldExpire = (duration.rounds === 0);
			}
			
			// Handle turn-based durations
			if (duration.turns && phase === 'turnEnd') {
				duration.turns = Math.max(0, duration.turns - 1);
				changed = true;
				shouldExpire = (duration.turns === 0);
			}
			
			// Track expiring effects (now checks round OR turn expiration separately)
			if (shouldExpire || 
				(duration.rounds === 0 && duration.turns === 0 && duration.seconds === 0) ||
				(phase === 'turnStart' && effect.duration.startTime === "turnStart")) {
				expiringEffects.push(effect);
			} 
			else if (changed) {
				updates.push({_id: effect.id, duration});
			}
		}
		
		// Process updates first
		if (updates.length > 0) {
			await combatant.actor.updateEmbeddedDocuments('ActiveEffect', updates);
		}
		
		// Show expiration prompts for GMs
		if (expiringEffects.length > 0 && game.user.isGM) {
			for (const effect of expiringEffects) {
				await this._showExpirationPrompt(combatant, effect);
			}
		}
	}

	async _showExpirationPrompt(combatant, effect) {
		const buttons = {
			yes: {
				icon: '<i class="fas fa-check"></i>',
				label: "Yes",
				callback: async () => {} // Handled in chat message now
			},
			no: {
				icon: '<i class="fas fa-times"></i>',
				label: "No",
				callback: async () => {} // Handled in chat message now
			}
		};

		const content = `
			<div class="effect-expiration">
				<div class="effect-info">
					<img src="${effect.icon}" class="effect-icon" />
					<h3>${effect.name}</h3>
				</div>
				<p>The effect <strong>${effect.name}</strong> has run out. Remove it?</p>
				<div class="effect-buttons">
					${Object.entries(buttons).map(([key, btn]) => `
						<button class="effect-button ${key}" data-action="${key}">
							${btn.icon} ${btn.label}
						</button>
					`).join('')}
				</div>
			</div>
		`;

		// Create the chat message
		await ChatMessage.create({
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({actor: combatant.actor}),
			content,
			type: CONST.CHAT_MESSAGE_TYPES.OTHER,
			flags: {
				[SYSTEM_ID]: {
					effectExpiration: true,
					effectId: effect.id,
					actorId: combatant.actor.id
				}
			}
		});
	}

    get isTurnStarted() {
        return this.combatant != null;
    }

    populateData(data) {
        data.hasCombatStarted = this.started;
        data.currentTurn = this.getCurrentTurn();
        data.totalTurns = this.combatants.reduce((agg, combatant) => {
            agg[combatant.id] = combatant.totalTurns;
            return agg;
        }, {});
        data.turnsLeft = this.countTurnsLeft();
        data.turnStarted = this.isTurnStarted;
        data.combatant = this.combatant;
        data.isGM = game.user?.isGM;
    }

    countTurnsLeft() {
        const countTurnsTaken = this.currentRoundTurnsTaken.reduce((agg, currentValue) => {
            agg[currentValue] = (agg[currentValue] ?? 0) + 1;
            return agg;
        }, {});

        return this.combatants.reduce((agg, combatant) => {
            agg[combatant.id] = combatant.totalTurns - (countTurnsTaken[combatant.id] ?? 0);
            return agg;
        }, {});
    }

    determineNextTurn() {
        if (!this.started) return undefined;

        const lastCombatant = this.currentRoundTurnsTaken
            .map(id => this.combatants.get(id))
            .findLast(c => c?.faction);

        if (lastCombatant) {
            const lastTurn = lastCombatant.faction;
            const nextTurn = lastTurn === ENEMY ? ALLIED : ENEMY;
            let turnsNotTaken = this.currentRoundTurnsLeft;

            if (this.settings.skipDefeated) {
                turnsNotTaken = turnsNotTaken.filter(c => !c.isDefeated);
            }

            const factionsWithTurnsLeft = turnsNotTaken.map(c => c.faction);
            return factionsWithTurnsLeft.includes(nextTurn) ? nextTurn : lastTurn;
        } else {
            return this.getFirstTurn();
        }
    }

    get currentRoundTurnsLeft() {
        const countTurnsTaken = this.currentRoundTurnsTaken.reduce((agg, currentValue) => {
            agg[currentValue] = (agg[currentValue] ?? 0) + 1;
            return agg;
        }, {});

        return this.combatants.filter(c => (countTurnsTaken[c.id] ?? 0) < c.totalTurns);
    }

    getCurrentTurn() {
        return this.getFlag(SYSTEM_ID, STRYDER.flags.CurrentTurn);
    }

	async setCurrentTurn(flag) {
		if (!game.user.isGM) {
			throw new Error("Only GMs can change the current turn");
		}
		return this.setFlag(SYSTEM_ID, STRYDER.flags.CurrentTurn, flag);
	}

    async nextTurn() {
        await this.setCurrentTurn(this.determineNextTurn());

        const turnsTaken = this.currentRoundTurnsTaken.map(id => this.combatants.get(id));
        let turnsNotTaken = this.currentRoundTurnsLeft;

        if (this.settings.skipDefeated) {
            turnsNotTaken = turnsNotTaken.filter(c => !c.isDefeated);
        }

        const next = turnsNotTaken.length ? turnsTaken.length : null;
        let round = this.round;

        if (this.round === 0 || next === null) {
            return this.nextRound();
        }

        const updateData = {
            round,
            turn: next
        };
        const updateOptions = {
            advanceTime: CONFIG.time.turnTime,
            direction: 1
        };
        Hooks.callAll('combatTurn', this, updateData, updateOptions);

        return this.update(updateData, updateOptions);
    }

	async nextRound() {
		// Clear all turns taken for the new round
		const flag = this.getTurnsTaken();
		flag[this.round + 1] = [];
		await this.setFlag(SYSTEM_ID, STRYDER.flags.CombatantsTurnTaken, flag);

		// Clear started turns for the new round
		await this.setFlag(SYSTEM_ID, STRYDER.flags.StartedTurns, []);

		// Clear active turns for the new round
		await this.setFlag(SYSTEM_ID, STRYDER.flags.ActiveTurns, []);

		// Clear current combatant - no one should be active at round start
		await this.setCombatant(null);

		await this.setCurrentTurn(this.getFirstTurn());

		let turn = this.turn === null ? null : 0;
		let advanceTime = Math.max(this.totalTurns - this.turn, 0) * CONFIG.time.turnTime;
		advanceTime += CONFIG.time.roundTime; // 8 seconds per round
		
		// Process round-based effect durations for all combatants
		for (const combatant of this.combatants) {
			await this._processEffectDurations(combatant, 'roundEnd');
		}

		const updateData = {
			round: this.round + 1,
			turn
		};
		
		const updateOptions = {
			advanceTime,
			direction: 1
		};
		
		Hooks.callAll('combatRound', this, updateData, updateOptions);
		Hooks.callAll('stryderCombatEvent',
			new CombatEvent(StryderCombat.combatEvent.endOfRound, this.round, this.combatants));
		
		const result = await this.update(updateData, updateOptions);
		
		// Don't automatically start turns - let the UI buttons handle it
		// This ensures all actors start with "Start Turn" buttons and inactive turns
		
		return result;
	}

    getFirstTurn() {
        return this.getFlag(SYSTEM_ID, STRYDER.flags.FirstTurn);
    }

    async setFirstTurn(flag) {
        return this.setFlag(SYSTEM_ID, STRYDER.flags.FirstTurn, flag);
    }

    get actors() {
        return Array.from(this.combatants.map(c => c.actor));
    }

    static showTurnsFor(combatant) {
        if (game.user?.isGM || combatant.actor.isOwner || combatant.actor.type === 'character') return true;
        const showTurnsMode = game.settings.get(SYSTEM_ID, 'optionCombatHudShowNPCTurnsLeftMode');
        return showTurnsMode !== 'never';
    }

    hasActor(actor) {
        return this.actors.includes(actor);
    }

    static get hasActiveEncounter() {
        return !!game.combat;
    }

    static get activeEncounter() {
        return game.combat;
    }

    /**
     * Show turn notification for all clients
     * @param {string} combatantName - Name of the combatant starting their turn
     * @static
     */
    static showTurnNotification(combatantName) {
        console.log('STRYDER DEBUG | showTurnNotification called for:', combatantName, 'User is GM:', game.user.isGM);
        
        // Play sound effect
        AudioHelper.play({
            src: "systems/stryder/assets/sfx/turnChange.ogg",
            volume: 0.8,
            autoplay: true,
            loop: false
        }, false);

        // Show notification
        const notification = document.createElement('div');
        notification.className = 'turn-notification';
        notification.textContent = `${combatantName} has started their turn!`;
        document.body.appendChild(notification);
        
        console.log('STRYDER DEBUG | Notification element created and added to DOM');

        // Remove notification after animation completes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}