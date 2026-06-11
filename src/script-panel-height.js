// ===== NoteLM — Script Panel Dynamic Height Manager
// ============================================
// Computes available height between the script section and the footer.
// Sets max-height on the scroll container so it expands with content
// until it would overlap the footer, then shows a scrollbar.
//
// Observes: ResizeObserver (footer + textareas), MutationObserver (child changes),
//           window resize. Debounced at ~100ms for performance.
//
// Integration: call initScrollPanelHeightManager() once on DOMContentLoaded,
//              then call onScriptLinesRendered() after every renderScriptLines().

import { dom } from '../state.js';

const DEBOUNCE_MS = 100;
const MIN_HEIGHT = 120;   // px — minimum usable scroll height
const MAX_HEIGHT_CAP = 900; // px — optional cap for very tall viewports
const SAFE_GAP = 16;      // px — breathing room between scroll bottom and footer top

let scrollContainer = null;
let scriptSection = null;
let footer = null;
let currentMaxHeight = 0;
let recalcTimer = null;
let footerRO = null;
let textareasRO = null;
let mo = null;
let scrollHandler = null;

/** Debounced recalculation — safe to call frequently. */
function scheduleRecalc() {
  if (recalcTimer) clearTimeout(recalcTimer);
  recalcTimer = setTimeout(recalculateLayout, DEBOUNCE_MS);
}

/**
 * Core layout calculation.
 * Measures from script-section top to footer top, subtracts padding/gap,
 * then caps MAX_HEIGHT so the scroll container never overlaps the footer.
 * Falls back to parent clientHeight when the footer is outside the viewport.
 */
function recalculateLayout() {
  if (!scrollContainer || !scriptSection) return;

  const sectionRect = scriptSection.getBoundingClientRect();
  const footerRect = footer?.getBoundingClientRect();

  // Compute available: section top → footer top (or viewport bottom)
  let available;
  if (footerRect && footerRect.top > 0) {
    available = footerRect.top - sectionRect.top - SAFE_GAP;
  } else {
    // Footer off-screen or missing — fall back to section's current height
    available = scriptSection.clientHeight - SAFE_GAP;
  }

  const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT_CAP, Math.round(available)));

  if (clamped !== currentMaxHeight) {
    currentMaxHeight = clamped;
    scrollContainer.style.maxHeight = clamped + 'px';
  }
}

/** Observe textarea sizes — recalculate when they grow/shrink. */
function observeTextareas() {
  if (!scrollContainer) return;
  if (!textareasRO) {
    textareasRO = new ResizeObserver(() => scheduleRecalc());
  }
  // Disconnect old observations, re-observe all current textareas
  textareasRO.disconnect();
  scrollContainer.querySelectorAll('.line-textarea').forEach(ta => {
    textareasRO.observe(ta);
  });
}

/** Teardown — call on HMR or when panel is destroyed. */
export function destroy() {
  if (recalcTimer) clearTimeout(recalcTimer);
  if (footerRO) { footerRO.disconnect(); footerRO = null; }
  if (textareasRO) { textareasRO.disconnect(); textareasRO = null; }
  if (mo) { mo.disconnect(); mo = null; }
  if (scrollHandler && scrollContainer) {
    scrollContainer.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }
  window.removeEventListener('resize', scheduleRecalc);
  scrollContainer = null;
  scriptSection = null;
  footer = null;
  currentMaxHeight = 0;
}

/** Force immediate recalculation (bypasses debounce). */
export function recalculatePanelLayout() {
  if (recalcTimer) clearTimeout(recalcTimer);
  recalculateLayout();
}

/**
 * Initialise the scroll panel height manager.
 * Call once after DOMContentLoaded and after any dynamic panel swap.
 */
export function initScrollPanelHeightManager() {
  scrollContainer = dom.scriptLines;
  scriptSection = document.querySelector('.script-section');
  footer = document.querySelector('.site-footer');

  if (!scrollContainer || !scriptSection) return;

  // Accessibility: make scroll region keyboard-focusable
  scrollContainer.setAttribute('tabindex', '0');
  scrollContainer.setAttribute('role', 'region');
  scrollContainer.setAttribute('aria-label', 'Script lines — scroll to navigate');

  // Scroll listener
  scrollHandler = scheduleRecalc;
  scrollContainer.addEventListener('scroll', scrollHandler, { passive: true });

  // ResizeObserver on footer — recalc on size changes
  if (footer) {
    footerRO = new ResizeObserver(scheduleRecalc);
    footerRO.observe(footer);
  }

  // MutationObserver — recalc on child add/remove in script section
  mo = new MutationObserver(() => {
    observeTextareas();
    scheduleRecalc();
  });
  mo.observe(scrollContainer, { childList: true, subtree: true });

  // Window resize
  window.addEventListener('resize', scheduleRecalc);

  // Observe initial textareas
  observeTextareas();

  // First calculation — use double-rAF to ensure layout is settled
  requestAnimationFrame(() => {
    recalculateLayout();
    requestAnimationFrame(recalculateLayout);
  });
}

/**
 * Re-observe textareas after script lines are re-rendered.
 * Call from renderScriptLines() after the DOM is rebuilt.
 */
export function onScriptLinesRendered() {
  observeTextareas();
  scheduleRecalc();
}
