#!/usr/bin/env node
/*
 * build.js — packages the extension for the Chrome Web Store and Firefox AMO.
 *
 *   node tools/build.js
 *
 * Produces:
 *   dist/cleanbing-chrome.zip   (manifest without browser_specific_settings)
 *   dist/cleanbing-firefox.zip  (manifest with gecko + data_collection_permissions)
 *
 * Only the runtime files are included — no screenshots, tools/, README, or
 * SVG source. Requires the `zip` CLI (present on macOS, Linux, and CI runners).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

// Files shipped inside every package (relative to repo root).
const RUNTIME_FILES = [
  'content.js',
  'styles.css',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

const baseManifest = JSON.parse(
  fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')
);

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function build(target, transformManifest, zipName) {
  const stage = path.join(dist, `stage-${target}`);
  rmrf(stage);
  fs.mkdirSync(path.join(stage, 'icons'), { recursive: true });

  // Copy runtime files, preserving the icons/ subdir.
  for (const rel of RUNTIME_FILES) {
    fs.copyFileSync(path.join(root, rel), path.join(stage, rel));
  }

  // Write the target-specific manifest.
  const manifest = transformManifest(JSON.parse(JSON.stringify(baseManifest)));
  fs.writeFileSync(
    path.join(stage, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );

  // Zip the staged contents (from inside the stage dir so paths are relative).
  const zipPath = path.join(dist, zipName);
  rmrf(zipPath);
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: stage });
  rmrf(stage);

  const size = fs.statSync(zipPath).size;
  console.log(`${target.padEnd(8)} -> dist/${zipName} (${size} bytes, v${manifest.version})`);
}

rmrf(dist);
fs.mkdirSync(dist, { recursive: true });

// Chrome: drop the Firefox-only gecko settings.
build('chrome', (m) => {
  delete m.browser_specific_settings;
  return m;
}, 'cleanbing-chrome.zip');

// Firefox: keep browser_specific_settings.gecko (id, strict_min_version, and
// data_collection_permissions), which AMO now requires.
build('firefox', (m) => m, 'cleanbing-firefox.zip');
