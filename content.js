/*
 * Clean Bing — content.js
 *
 * Runs at document_start. Two jobs:
 *   1. Keep the search box placeholder pinned to plain "Search". Bing rewrites
 *      #sb_form_q's placeholder to rotating/promotional text via JS after load,
 *      so a one-time set is not enough — we re-assert it on every mutation.
 *   2. Fallback cleanup for feed / rewards / promo / trending clutter that the
 *      CSS in styles.css might miss (e.g. dynamically injected variants).
 *
 * A guard flag prevents our own placeholder writes from re-triggering the
 * observer into an infinite loop.
 */

(function () {
  "use strict";

  var DESIRED_PLACEHOLDER = "Search";

  // Selectors mirrored from styles.css for the JS fallback path. Kept in sync
  // so anything injected after the initial paint still gets removed.
  var CLUTTER_SELECTORS = [
    "bing-homepage-feed",
    ".peregrine-widgets",
    "#widget_container",
    "#scroll_cont",
    "#vs_cont",
    ".modules_wrapper",
    ".moduleCont",
    ".module.feed_bg",
    ".bottom_row.msnpeek",
    ".hp_trivia_outer",
    ".mc_caro",
    ".musCard",
    ".musCardCont",
    "#id_rh_w",
    ".points-container",
    'a[aria-label="Microsoft Rewards"]',
    ".b_siprov2",
    "#trending_now_tile",
    "#msn_overflow"
  ];

  var applying = false; // re-entrancy guard for the observer

  function resetPlaceholder() {
    var input = document.getElementById("sb_form_q") ||
      document.querySelector('input[name="q"]');
    if (input && input.getAttribute("placeholder") !== DESIRED_PLACEHOLDER) {
      input.setAttribute("placeholder", DESIRED_PLACEHOLDER);
    }
  }

  function hideClutter() {
    for (var i = 0; i < CLUTTER_SELECTORS.length; i++) {
      var nodes = document.querySelectorAll(CLUTTER_SELECTORS[i]);
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].style.display !== "none") {
          nodes[j].style.setProperty("display", "none", "important");
        }
      }
    }
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      resetPlaceholder();
      hideClutter();
    } finally {
      applying = false;
    }
  }

  // Initial pass as soon as possible, and again once the DOM is ready.
  apply();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  }

  function startObserver() {
    var target = document.body || document.documentElement;
    if (!target) return;
    var observer = new MutationObserver(function () {
      // The guard flag stops our own attribute/style writes from looping.
      apply();
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["placeholder"]
    });
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }
})();
