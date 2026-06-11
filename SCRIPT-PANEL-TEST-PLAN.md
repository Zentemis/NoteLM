# Script Panel — Integration Checklist & Test Plan

## Integration Notes

### How the height manager works

`src/script-panel-height.js` measures the distance from `.script-section`'s top to `.site-footer`'s top on every relevant size change, then sets `max-height` on `.script-lines` so it expands with content until it would overlap the footer, then shows a native scrollbar.

### Where to hook

1. **DOMContentLoaded** — call `initScrollPanelHeightManager()` once.
2. **After every `renderScriptLines()`** — call `onScriptLinesRendered()` to re-observe new textareas and recalculate.
3. Both hooks already exist in `app.js` and `script.js`.

### Adapting for sticky headers/footers

- If the header is `position: sticky`, it's already in the flow — no change needed.
- If the footer is `position: fixed`, add a spacer div (`.controls-spacer`) in the flex flow to reserve space. The height manager measures from `.script-section` top to `.site-footer` top, so the footer must be in the normal document flow.
- If both header and footer are fixed, wrap the scroll area in a container with `padding-top` / `padding-bottom` equal to the header/footer heights.

### Configuring min/max heights

Edit the constants at the top of `src/script-panel-height.js`:

| Constant       | Default | Purpose                                     |
|----------------|---------|---------------------------------------------|
| `MIN_HEIGHT`   | 120px   | Minimum usable scroll height                |
| `MAX_HEIGHT_CAP` | 900px | Cap for very tall viewports                 |
| `SAFE_GAP`     | 16px    | Breathing room between panel bottom and footer top |
| `DEBOUNCE_MS`  | 100ms   | Debounce interval for resize/scroll events  |

### CSS requirements (already in styles.css)

- `.script-section`: `flex: 1 1 0%; min-height: 0; overflow: hidden;`
- `.script-lines`: `flex: 1 1 auto; overflow-y: auto; min-height: 0; scrollbar-gutter: stable;`
- `.line-textarea`: `min-width: 0;` (prevents flex overflow)
- `.gutter-dot`: `flex-shrink: 0; align-self: center;` (stays centered)
- `.line-select-gutter`: `align-self: stretch; display: flex; align-items: center; justify-content: center;`

---

## Manual Test Plan

### Viewport tests

| Viewport           | What to check                                              |
|--------------------|------------------------------------------------------------|
| 1920×1080          | Panel fills space, scrollbar appears only with many lines  |
| 1366×768           | Panel doesn't overlap footer, scrolling works              |
| 768×1024 (tablet)  | Same as above, touch scrolling works                       |
| 375×667 (mobile)   | Panel is usable, safe-area insets respected                |
| 320×480 (small)    | Minimum height enforced, nothing clipped                   |

### Zoom tests

| Zoom  | What to check                                    |
|-------|--------------------------------------------------|
| 50%   | Panel caps at MAX_HEIGHT_CAP, scrollbar visible  |
| 100%  | Normal behavior                                  |
| 150%  | Panel shrinks, scrollbar appears sooner          |
| 200%  | Minimum height enforced, all text readable       |

### Keyboard navigation

1. Tab to `.script-lines` → focus ring visible (inset box-shadow)
2. Arrow keys → scrolls the panel
3. Tab into a line → textarea focus works, gutter dot appears
4. Shift+Tab → moves focus backwards correctly

### Screen reader

1. `.script-lines` announces as "Script lines — scroll to navigate" (role=region)
2. `aria-live="polite"` on the container announces new lines added
3. Line numbers and speaker selects are readable
4. Gutter dots are `aria-hidden="true"` (decorative)

### Dot centering

1. Short single-line text → dot centered vertically ✓
2. Long multiline text (textarea auto-grows) → dot still centered ✓
3. Resize window to make lines narrower → text wraps, dot stays centered ✓
4. Very tall row (5+ lines) → dot at vertical center of row ✓

### Dynamic content

1. Add 50 lines → scrollbar appears, footer not overlapped
2. Remove lines one by one → scrollbar disappears, panel shrinks
3. Paste a long script → panel recalculates after render
4. Clear all lines → panel collapses to minimum height
5. Change textarea content to be very long → row grows, panel recalculates

### Browser differences

| Browser         | What to check                                    |
|-----------------|--------------------------------------------------|
| Chrome 120+     | scrollbar-gutter:stable works, thin scrollbar    |
| Firefox 120+    | scrollbar-width:thin, scrollbar-color works      |
| Safari 17+      | Backdrop-filter, scrollbar styling               |
| Edge 120+       | Same as Chrome                                   |

---

## Automated Test File

Open `test-script-panel.html` in a browser. It runs assertions on:

1. max-height is set on the scroll container
2. max-height >= MIN_HEIGHT
3. Panel bottom doesn't overlap footer top
4. overflow-y is "auto"
5. scrollbar-gutter is "stable"
6. Dot is vertically centered (single-line row)
7. Dot is vertically centered (multiline row)
8. Scroll container has tabindex, role, aria-label
9. Gutter dot has flex-shrink: 0
10. Line text has min-width: 0

Use the buttons to add/clear lines and verify behavior dynamically.
