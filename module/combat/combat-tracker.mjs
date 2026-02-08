import { SYSTEM_ID, STRYDER } from '../helpers/constants.mjs';
import { ALLIED, ENEMY } from './combat.mjs';

export class StryderCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['stryder', 'combat-tracker'],
    actions: {
      // Turn actions
      startTurn: StryderCombatTracker.#onStartTurn,
      endTurn: StryderCombatTracker.#onEndTurn,
    },
  };

  /** @override */
  static PARTS = {
    header: {
      template: "systems/stryder/templates/combat/combat-tracker-header.hbs"
    },
    tracker: {
      template: "systems/stryder/templates/combat/combat-tracker.hbs"
    },
    footer: {
      template: "systems/stryder/templates/combat/combat-tracker-footer.hbs"
    }
  };

  /** @override */
  async _prepareTrackerContext(context, options) {
    const combat = this.viewed;
    if (!combat) return;
    
    await super._prepareTrackerContext(context, options);

    // Add our faction-based data
    context.factions = {
      [ALLIED]: [],
      [ENEMY]: []
    };

    const combatants = context.combat.combatants.contents;
    combatants.sort((a, b) => {
      if (a.faction !== b.faction) {
        return a.faction === ALLIED ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    const currentTurn = context.combat.getCurrentTurn();
    const turnsTaken = context.combat.currentRoundTurnsTaken || [];
    const activeCombatant = context.combat.combatant;
    
    // Get combatants who have started their turn but haven't ended it
    const startedTurns = combat.getFlag(SYSTEM_ID, STRYDER.flags.StartedTurns) || [];
    
    combatants.forEach(combatant => {
      try {
        const faction = combatant.faction || ALLIED;
        
        combatant._canTakeTurn = faction === currentTurn && 
                                !turnsTaken.includes(combatant.id) && 
                                combatant.canTakeTurn;
                                
        // Determine visual state:
        // 1. Active turn (blue glow): currently taking their turn
        combatant._isActiveTurn = activeCombatant?.id === combatant.id;
        
        // 2. Started but interrupted (light blue glow): started turn but not currently active
        combatant._hasStartedTurn = startedTurns.includes(combatant.id) && !combatant._isActiveTurn;
        
        // 3. Ended turn (no glow): turn has ended
        combatant._hasTurnEnded = turnsTaken.includes(combatant.id);
        
        // Check if user can control this combatant
        const isGM = game.user.isGM;
        const isOwner = combatant.actor?.testUserPermission(game.user, "OWNER") ?? false;
        combatant._canControl = isGM || isOwner;
        
        // Set CSS classes based on visual state
        combatant.css = '';
        if (combatant._isActiveTurn) {
          combatant.css += 'started-turn'; // Yellow glow - currently active
        } else if (combatant._hasStartedTurn) {
          combatant.css += 'interrupted-turn'; // Light blue glow - started but interrupted
        }
        if (combatant.isDefeated) {
          combatant.css += ' defeated';
        }
        
        // Ensure required properties exist
        combatant.img = combatant.img || combatant.token?.data?.img || combatant.actor?.img || '';
        combatant.name = combatant.name || combatant.actor?.name || 'Unknown';
        combatant.hidden = combatant.hidden || false;
        combatant.canPing = combatant.canPing !== undefined ? combatant.canPing : true;
        combatant.statusEffects = combatant.statusEffects || [];
        combatant.hasResource = combatant.hasResource || false;
        combatant.resource = combatant.resource || '';
        
        context.factions[faction].push(combatant);
      } catch (error) {
        console.warn(`Error processing combatant ${combatant.name}:`, error);
        context.factions[ALLIED].push(combatant);
      }
    });

    // Set current turn and active combatant for template
    if (currentTurn) {
      context.currentTurn = currentTurn;
      context.combatant = activeCombatant;
    }
  }

  /** @override */
  _onCombatantControl(event, target) {
    super._onCombatantControl(event, target);

    const { combatantId } = target.closest('[data-combatant-id]')?.dataset ?? {};
    const combatant = this.viewed?.combatants.get(combatantId);
    if (!combatant) return;

    // Switch control action
    switch (target.dataset.action) {
      case 'toggleDefeated': {
        combatant.toggleDefeated();
        break;
      }
    }
  }

  /**
   * Handle starting a turn for a combatant
   * @param {StryderCombatant} combatant
   * @return {Promise<void>}
   */
  async handleStartTurn(combatant) {
    if (combatant && combatant.combat) {
      await combatant.combat.startTurn(combatant);
    }
  }

  /**
   * Handle ending a turn for a combatant
   * @param {StryderCombatant} combatant
   * @return {Promise<void>}
   */
  async handleEndTurn(combatant) {
    if (combatant && combatant.combat) {
      await combatant.combat.endTurn(combatant);
    }
  }

  static #onStartTurn(event, target) {
    const combatantId = target.closest('[data-combatant-id]')?.dataset?.combatantId;
    const combatant = this.viewed.combatants.get(combatantId);
    if (combatant) {
      return this.handleStartTurn(combatant);
    }
  }

  static #onEndTurn(event, target) {
    const combatantId = target.closest('[data-combatant-id]')?.dataset?.combatantId;
    const combatant = this.viewed.combatants.get(combatantId);
    if (combatant) {
      return this.handleEndTurn(combatant);
    }
  }

  /** @override */
  async _onCombatCreate(event, target) {
    // Override to show our custom dialog
    const combat = await Combat.create({});
    if (combat) {
      await combat.startCombat();
    }
  }

  /** @override */
  async render(force = false, options = {}) {
    await super.render(force, options);
    
    // Disable right-click context menu on the combat tracker tab to prevent pop-out
    this._disableTabPopOut();
  }

  /**
   * Disable the right-click context menu on the combat tracker tab to prevent pop-out
   * @private
   */
  _disableTabPopOut() {
    // Find the combat tracker tab element
    const combatTab = document.querySelector('#sidebar-tabs [data-tab="combat"]');
    if (combatTab) {
      // Remove any existing event listeners to avoid duplicates
      combatTab.removeEventListener('contextmenu', this._preventContextMenu);
      
      // Add the event listener to prevent context menu
      combatTab.addEventListener('contextmenu', this._preventContextMenu);
    }
  }

  /**
   * Prevent the context menu from appearing on right-click
   * @param {Event} event - The contextmenu event
   * @private
   */
  _preventContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }

  /**
   * Static method to disable combat tab pop-out functionality
   * @static
   */
  static _disableCombatTabPopOut() {
    // Find the combat tracker tab element
    const combatTab = document.querySelector('#sidebar-tabs [data-tab="combat"]');
    if (combatTab) {
      // Remove any existing event listeners to avoid duplicates
      combatTab.removeEventListener('contextmenu', StryderCombatTracker._preventContextMenuStatic);
      
      // Add the event listener to prevent context menu
      combatTab.addEventListener('contextmenu', StryderCombatTracker._preventContextMenuStatic);
    }
  }

  /**
   * Static method to prevent the context menu from appearing on right-click
   * @param {Event} event - The contextmenu event
   * @static
   * @private
   */
  static _preventContextMenuStatic(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
}