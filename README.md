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

## Disclaimer

Clean Bing is an independent, third-party tool for use with `bing.com`. It is
**not affiliated with, endorsed by, or sponsored by Microsoft**. "Bing", "MSN",
and "Microsoft Rewards" are trademarks of Microsoft Corporation.

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

## Releasing (GitHub Actions → Chrome Web Store)

Releases are cut manually from the **Actions → Release** workflow
(`.github/workflows/release.yml`). Click **Run workflow** and it will:

1. Stamp a **date-based version** into `manifest.json` in the form
   `YY.M.D.HHMM` (e.g. `26.8.30.1354`). `HHMM` is stored as an integer
   (`hour*100 + minute`) so there are no leading zeros — Chrome rejects
   those — meaning `09:05` becomes `905`. The timestamp uses the
   `America/Chicago` timezone set in the workflow; change the `TZ` env there
   to use UTC or another zone. Don't run two releases in the same minute, or
   the versions collide.
2. Run `node tools/build.js` to package **only the runtime files**
   (`manifest.json`, `content.js`, `styles.css`, `icons/icon*.png`) — no
   screenshots, `tools/`, README, or SVG source — into two zips:
   - `dist/cleanbing-chrome.zip` — manifest with `browser_specific_settings`
     stripped (Chrome doesn't use it).
   - `dist/cleanbing-firefox.zip` — manifest keeping the `gecko` block,
     including `data_collection_permissions` (AMO requires this).
3. Commit the version bump and push a `vX.Y.Z` tag.
4. Create a GitHub Release with **both** zips attached.
5. Upload and publish the Chrome zip to the Chrome Web Store.

### Building locally

Run `node tools/build.js` any time to produce both store zips in `dist/`.
Chrome and Firefox need different manifests — the script generates each from
the single `manifest.json` source of truth. Firefox/AMO requires the
`data_collection_permissions` declaration (Clean Bing collects nothing, so it
is `{ "required": ["none"] }`); the Chrome package omits the Firefox-only
`browser_specific_settings` entirely.

### One-time setup

**First upload must be manual.** The Chrome Web Store only creates a listing
(and an extension ID) after the first manual upload. Zip the runtime files,
upload them once at the [Developer Dashboard](https://chrome.google.com/webstore/devconsole),
and note the extension ID.

**Then add these GitHub repository secrets** (Settings → Secrets and variables
→ Actions):

| Secret | What it is |
| --- | --- |
| `CHROME_EXTENSION_ID` | The extension's ID from the Web Store listing. |
| `CHROME_CLIENT_ID` | OAuth client ID for the Chrome Web Store API. |
| `CHROME_CLIENT_SECRET` | OAuth client secret. |
| `CHROME_REFRESH_TOKEN` | OAuth refresh token. |

To obtain the OAuth credentials: enable the **Chrome Web Store API** in a
Google Cloud project, create an **OAuth 2.0 Client ID** (type: Desktop app),
then run the OAuth consent flow once to exchange an authorization code for a
refresh token. See Google's
[Chrome Web Store API docs](https://developer.chrome.com/docs/webstore/using-api)
for the current step-by-step.

## Selector caveats

Bing's markup varies by region and A/B test, and many class names are hashed.
This extension prefers stable ids, semantic containers, and aria attributes
(e.g. `#sb_form_q`, `#trending_now_tile`, `a[aria-label="Microsoft Rewards"]`,
`bing-homepage-feed`) over brittle hashed classes, and `content.js` provides a
MutationObserver fallback. If Bing ships a layout you don't have a selector for,
add it to both `styles.css` and the `CLUTTER_SELECTORS` list in `content.js`.
