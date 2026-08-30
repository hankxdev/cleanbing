#!/usr/bin/env node
/*
 * make-icons.js — generates the Clean Bing extension icons.
 *
 * Draws a magnifying glass with a sparkle in the lens on a rounded teal
 * square, and rasterizes it to PNGs at 16/32/48/128 px with supersampled
 * anti-aliasing. Pure Node (zlib only), no external dependencies.
 *
 * Run:  node tools/make-icons.js
 * Out:  icons/icon{16,32,48,128}.png
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const TEAL = [0, 131, 115];   // #008373
const WHITE = [255, 255, 255];
const SS = 4;                 // supersampling factor

// --- geometry helpers (all in target-pixel space) ---
function roundedRectContains(x, y, S, r) {
  const lo = r, hiX = S - r, hiY = S - r;
  const cx = Math.min(Math.max(x, lo), hiX);
  const cy = Math.min(Math.max(y, lo), hiY);
  if (x >= lo && x <= hiX) return y >= 0 && y <= S && !(Math.hypot(0, 0) > r); // interior band
  return true;
}
// Cleaner rounded-rect test via corner distance.
function inRoundedRect(x, y, S, r) {
  if (x < 0 || y < 0 || x > S || y > S) return false;
  const nx = Math.min(Math.max(x, r), S - r);
  const ny = Math.min(Math.max(y, r), S - r);
  // If point is in the central cross, it's inside.
  if ((x >= r && x <= S - r) || (y >= r && y <= S - r)) return true;
  // Otherwise it's in a corner region: check distance to corner center.
  return Math.hypot(x - nx, y - ny) <= r;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// 4-point sparkle (astroid-like concave star): (|x|/R)^p + (|y|/R)^p <= 1, p<1.
function inSparkle(px, py, cx, cy, R, p) {
  const ax = Math.abs(px - cx) / R;
  const ay = Math.abs(py - cy) / R;
  if (ax > 1 || ay > 1) return false;
  return Math.pow(ax, p) + Math.pow(ay, p) <= 1;
}

function renderSize(S) {
  const N = S * SS;
  const rgba = Buffer.alloc(S * S * 4);

  // Design parameters, scaled to N.
  const radius = 0.22 * N;
  const cx = 0.435 * N, cy = 0.42 * N;    // lens center
  const outerR = 0.265 * N;
  const ringThick = 0.085 * N;
  const innerR = outerR - ringThick;
  // Handle: from outer ring at 45° down-right, outward.
  const dir = Math.SQRT1_2;
  const hx0 = cx + outerR * dir, hy0 = cy + outerR * dir;
  const hx1 = cx + (outerR + 0.235 * N) * dir, hy1 = cy + (outerR + 0.235 * N) * dir;
  const handleHalf = 0.052 * N;
  const sparkleR = 0.135 * N, sparkleP = 0.5;

  for (let oy = 0; oy < S; oy++) {
    for (let ox = 0; ox < S; ox++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ox * SS + sx + 0.5;
          const y = oy * SS + sy + 0.5;
          let r = 0, g = 0, b = 0, a = 0;
          if (inRoundedRect(x, y, N, radius)) {
            r = TEAL[0]; g = TEAL[1]; b = TEAL[2]; a = 255;
            const d = Math.hypot(x - cx, y - cy);
            const onRing = d <= outerR && d >= innerR;
            const onHandle = segDist(x, y, hx0, hy0, hx1, hy1) <= handleHalf;
            const onSparkle = inSparkle(x, y, cx, cy, sparkleR, sparkleP);
            if (onRing || onHandle || onSparkle) {
              r = WHITE[0]; g = WHITE[1]; b = WHITE[2]; a = 255;
            }
          }
          R += r; G += g; B += b; A += a;
        }
      }
      const n = SS * SS;
      const i = (oy * S + ox) * 4;
      rgba[i] = Math.round(R / n);
      rgba[i + 1] = Math.round(G / n);
      rgba[i + 2] = Math.round(B / n);
      rgba[i + 3] = Math.round(A / n);
    }
  }
  return rgba;
}

// --- minimal PNG encoder (RGBA, 8-bit) ---
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(rgba, S) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc((S * 4 + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const S of [16, 32, 48, 128]) {
  const png = encodePNG(renderSize(S), S);
  const file = path.join(outDir, `icon${S}.png`);
  fs.writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
