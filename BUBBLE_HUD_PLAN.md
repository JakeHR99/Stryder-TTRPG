# Bubble HUD Implementation Plan

## Goal
Replace the current horizontal progress bar resource display with an interconnected bubble design matching the book's artistic diagram. The bubbles should show Health, Mana, Stamina, Movement, Elixir Sickness, and Level with circular progress fills and current/max numbers.

## Design Overview

### Layout Structure
```
        [Level - Hexagon]
               |
    [Elixir] - [Health] - [Stamina]
               |          |
            [Mana] - [Movement]
```

The bubbles will be connected by decorative tree-branch-like connectors (using the artistic vine/branch design from the source image).

### Bubble Features
- **Circular SVG containers** with progress rings
- **Labels** at the top of each bubble
- **Current/Max values** displayed in center
- **Radial progress fill** based on percentage
- **Decorative vine connectors** between bubbles

## Files to Modify

### 1. Template Changes
**File:** `templates/actor/actor-character-sheet.hbs`

**Location:** Lines 179-251 (current resource bars section)

**Changes:**
- Replace the `.resources.grid.grid-3col` structure
- Create new bubble-based layout with SVG circles
- Position Level (hexagon), Health, Mana, Stamina, Movement, and Elixir Sickness as interconnected bubbles
- Add decorative vine/branch connectors as background SVG elements

### 2. CSS Styling
**File:** `css/stryder.css`

**New Classes Needed:**
- `.bubble-hud-container` - Main container with position:relative
- `.bubble-circle` - Individual bubble styling
- `.bubble-progress` - SVG circular progress ring
- `.bubble-label` - Text label at top of bubble
- `.bubble-value` - Current/max values in center
- `.bubble-connector` - Vine/branch connectors between bubbles
- `.bubble-hexagon` - Special hexagon shape for Level
- Size variants for different bubbles (Health/Movement larger, Elixir smaller)

**SVG Progress Implementation:**
- Use `<circle>` with `stroke-dasharray` and `stroke-dashoffset` for radial progress
- Different stroke colors per resource (red for health, blue for mana, green for stamina, etc.)

### 3. JavaScript Updates
**File:** `module/sheets/actor-sheet.mjs`

**Changes:**
- Replace/update the `updateSheenClipping()` function with `updateBubbleProgress()`
- New function to calculate and apply SVG stroke-dashoffset based on current/max percentages
- Add event listeners for bubble value changes to update progress rings

### 4. Asset Creation
**File:** Create `assets/bubble-hud.png` or use provided `hud.png`

**Additional Assets:**
- Copy user's `hud.png` to `assets/` folder as reference/overlay
- Create or extract individual bubble connector SVG paths

## Implementation Steps

### Step 1: Copy HUD Image Asset
Copy `C:\Users\jakob\Downloads\hud.png` to `assets/bubble-hud-reference.png`

### Step 2: Create Bubble HTML Structure
Replace the `.resources.grid.grid-3col` section with:
```handlebars
<div class="bubble-hud-container">
  <!-- Background connector vines/branches as SVG -->
  <svg class="bubble-connectors" viewBox="0 0 600 400">
    <!-- Decorative vine paths connecting bubbles -->
  </svg>

  <!-- Individual resource bubbles positioned absolutely -->
  <div class="bubble-circle bubble-elixir" data-resource="elixir">
    <svg viewBox="0 0 120 120">
      <circle class="bubble-bg" cx="60" cy="60" r="50"/>
      <circle class="bubble-progress" cx="60" cy="60" r="50"/>
    </svg>
    <div class="bubble-label">Elixir Sickness</div>
    <div class="bubble-value">{{system.elixir_sickness.value}}</div>
  </div>

  <div class="bubble-circle bubble-health" data-resource="health">
    <svg viewBox="0 0 140 140">
      <circle class="bubble-bg" cx="70" cy="70" r="60"/>
      <circle class="bubble-progress" cx="70" cy="70" r="60"/>
    </svg>
    <div class="bubble-label">Health</div>
    <div class="bubble-value">{{system.health.value}} / {{system.health.max}}</div>
  </div>

  <!-- ... similar for Mana, Stamina, Movement -->

  <div class="bubble-hexagon bubble-level" data-resource="level">
    <svg viewBox="0 0 100 100">
      <!-- Hexagon path -->
    </svg>
    <div class="bubble-label">Level</div>
    <div class="bubble-value">{{system.attributes.level.value}}</div>
  </div>
</div>
```

### Step 3: Position Bubbles with CSS
```css
.bubble-hud-container {
  position: relative;
  width: 600px;
  height: 400px;
  margin: 20px auto;
}

.bubble-circle {
  position: absolute;
  text-align: center;
}

.bubble-elixir { top: 50px; left: 30px; width: 120px; }
.bubble-health { top: 150px; left: 220px; width: 140px; }
.bubble-mana { top: 260px; left: 200px; width: 130px; }
.bubble-stamina { top: 100px; right: 50px; width: 150px; }
.bubble-movement { top: 250px; right: 80px; width: 140px; }
.bubble-level { top: 20px; left: 250px; width: 100px; }
```

### Step 4: Implement Circular Progress
```css
.bubble-progress {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 0.3s ease;
}

.bubble-health .bubble-progress {
  stroke: #8B0000; /* Dark red */
  stroke-dasharray: 377; /* 2 * PI * radius */
}

.bubble-mana .bubble-progress {
  stroke: #1E90FF; /* Blue */
  stroke-dasharray: 377;
}

.bubble-stamina .bubble-progress {
  stroke: #228B22; /* Green */
  stroke-dasharray: 377;
}
```

### Step 5: Add JavaScript for Dynamic Progress
```javascript
function updateBubbleProgress() {
  // Health
  const healthBubble = document.querySelector('.bubble-health .bubble-progress');
  if (healthBubble) {
    const current = actor.system.health.value;
    const max = actor.system.health.max;
    const percent = max > 0 ? (current / max) : 0;
    const circumference = 2 * Math.PI * 60; // radius of health bubble
    const offset = circumference * (1 - percent);
    healthBubble.style.strokeDashoffset = offset;
  }

  // Repeat for Mana, Stamina, Movement, Elixir
}

// Call on sheet render and value changes
Hooks.on('renderActorSheet', updateBubbleProgress);
document.addEventListener('input', (e) => {
  if (e.target.name?.includes('health') ||
      e.target.name?.includes('mana') ||
      e.target.name?.includes('stamina')) {
    setTimeout(updateBubbleProgress, 50);
  }
});
```

### Step 6: Create Decorative Connectors
Use SVG paths to draw vine/branch-like connectors:
```svg
<svg class="bubble-connectors">
  <!-- Curvy vine from Level to Health -->
  <path d="M250,70 Q240,100 250,150"
        stroke="#654321"
        stroke-width="3"
        fill="none"
        opacity="0.6"/>

  <!-- Branch from Health to Elixir -->
  <path d="M220,190 Q150,150 90,120"
        stroke="#654321"
        stroke-width="2"
        fill="none"
        opacity="0.6"/>

  <!-- ... additional connectors -->
</svg>
```

## Data Mapping

| Bubble | Data Source | Display Format |
|--------|-------------|----------------|
| Health | `system.health.value / system.health.max` | "7 / 15" |
| Mana | `system.mana.value / system.mana.max` | "4 / 4" |
| Stamina | `system.stamina.value / system.stamina.max` | "3 / 3" |
| Movement | `system.attributes.move.running.value` | "7" (no max) |
| Elixir Sickness | `system.elixir_sickness.value` | "0" (max is always 5) |
| Level | `system.attributes.level.value` | "2" |

## Edge Cases & Considerations

1. **Ward Display** - Currently displayed below profile image. Keep it there or integrate into bubble design?
2. **Responsive Sizing** - Bubbles should scale proportionally if sheet is resized
3. **Editable Values** - Clicking on bubble values should allow inline editing (like current inputs)
4. **Mobile/Small Screens** - May need simplified layout for narrow viewports
5. **Color Accessibility** - Ensure progress colors have sufficient contrast
6. **Animation** - Smooth transitions when values change

## Testing Checklist

- [ ] All 6 bubbles render correctly
- [ ] Progress rings update when values change
- [ ] Values are editable by clicking
- [ ] Connectors align properly between bubbles
- [ ] Layout scales reasonably at different sheet sizes
- [ ] Works with all theme/font variations
- [ ] No JavaScript errors in console
- [ ] Performance is acceptable (no lag on value updates)

## Rollback Plan

If implementation has issues:
1. Keep original code commented out for 1-2 versions
2. Add a toggle in settings to switch between bubble HUD and classic bars
3. Store user preference in actor flags

## Future Enhancements (Post-MVP)

- Animated vine growth on sheet load
- Glow effects on bubbles when values are at max
- Pulsing animation when values are critical (health < 25%)
- Tooltip on hover showing detailed resource info
- Click-to-edit inline for bubble values (currently requires opening inputs)
