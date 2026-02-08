/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials.
    'systems/stryder/templates/actor/parts/actor-features.hbs',
    'systems/stryder/templates/actor/parts/actor-items.hbs',
    'systems/stryder/templates/actor/parts/actor-spells.hbs',
    'systems/stryder/templates/actor/parts/actor-effects.hbs',
    'systems/stryder/templates/actor/parts/actor-battle.hbs',
    'systems/stryder/templates/actor/parts/actor-life.hbs',
    'systems/stryder/templates/actor/parts/monster-features.hbs',
    'systems/stryder/templates/actor/parts/monster-battle.hbs',
    'systems/stryder/templates/actor/parts/lordling-features.hbs',
    'systems/stryder/templates/actor/parts/lordling-battle.hbs',
    'systems/stryder/templates/actor/parts/familiar-features.hbs',
    'systems/stryder/templates/actor/parts/familiar-battle.hbs',
    // Item partials
    'systems/stryder/templates/item/parts/item-effects.hbs',
	// Combat templates
	"systems/stryder/templates/combat/combat-tracker-header.hbs",
	"systems/stryder/templates/combat/combat-tracker.hbs",
	"systems/stryder/templates/combat/combat-tracker-footer.hbs",
	'systems/stryder/templates/combat/chat-combat-end.hbs',
	'systems/stryder/templates/combat/dialog-first-turn.hbs',
  ]);
};
