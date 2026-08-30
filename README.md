# Clean Bing

A small cross-browser WebExtension (Manifest V3) that declutters the Bing
homepage while leaving the daily background image intact.

## What it does

On `*://*.bing.com/*` it:

1. **Removes the MSN news feed / content cards** on the homepage.
2. **Hides Microsoft Rewards banners, promo badges, and trending / sidebar
   widgets** (the Rewards points badge, the "Sign in to earn Rewards" flyout,
   the trending-searches tile, etc.).
3. **Resets the search input placeholder to plain `Search`.** Bing rewrites the
   placeholder to rotating/promotional text via JavaScript, so a MutationObserver
   re-asserts `Search` whenever Bing changes it.

The **daily background image is deliberately left untouched.**

## Files

- `manifest.json` — MV3 manifest. One `content_scripts` entry matching
  `*://*.bing.com/*`, injecting `styles.css` + `content.js` at
  `document_start`. Includes `browser_specific_settings.gecko` so Firefox
  121+ can load it.
- `styles.css` — `display: none` rules that hide the clutter with no
  flash-of-content.
- `content.js` — a MutationObserver that (a) re-applies the `Search`
  placeholder whenever Bing rewrites the search box and (b) hides any clutter
  that gets injected after the initial paint. A re-entrancy guard prevents the
  observer from looping on its own writes.

## Install in Chrome (Load unpacked)

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (the one containing `manifest.json`).
5. Open <https://www.bing.com> — the feed, rewards, and trending widgets are
   gone and the placeholder reads `Search`.

## Install in Firefox (Load Temporary Add-on)

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select this folder's `manifest.json`.
4. Open <https://www.bing.com> to verify.

Note: temporary add-ons are removed when Firefox restarts. To keep it
permanently you'd need to sign/package it via AMO.

## Selector caveats

Bing's markup varies by region and A/B test, and many class names are hashed.
This extension prefers stable ids, semantic containers, and aria attributes
(e.g. `#sb_form_q`, `#trending_now_tile`, `a[aria-label="Microsoft Rewards"]`,
`bing-homepage-feed`) over brittle hashed classes, and `content.js` provides a
MutationObserver fallback. If Bing ships a layout you don't have a selector for,
add it to both `styles.css` and the `CLUTTER_SELECTORS` list in `content.js`.
