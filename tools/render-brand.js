// Builds the 3DSkuwela logo and app icons from tools/brand/3dskuwela-source.webp with headless Chrome.
// Run from the repo root: node tools/render-brand.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find(function (p) { return p && fs.existsSync(p); });

const SOURCE = 'file:///' + path.join(__dirname, 'brand', '3dskuwela-source.webp').split(path.sep).join('/');
const ASSETS = path.join(__dirname, '..', 'web', 'assets');
const SRC_W = 777;
const SRC_H = 1024;
const SHIELD = { x: 55, y: 0, w: 670, h: 840 };

function shot(body, width, height, out) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-'));
  const html = path.join(dir, 'p.html');
  fs.writeFileSync(html, '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}</style><body>' + body);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    '--virtual-time-budget=4000', '--window-size=' + width + ',' + height, '--screenshot=' + out, 'file:///' + html.split(path.sep).join('/')], { stdio: 'ignore' });
  fs.rmSync(dir, { recursive: true, force: true });
}

const BADGE = '<div style="position:absolute;left:638px;top:704px;width:144px;height:144px;border-radius:50%;background:#fff"></div>';

function sourceLayer(extra) {
  return '<img src="' + SOURCE + '" width="' + SRC_W + '" height="' + SRC_H + '" style="display:block">' + BADGE + (extra || '');
}

function logo(out) {
  shot('<div style="position:relative;width:' + SRC_W + 'px;height:' + SRC_H + 'px;background:#fff">' + sourceLayer() + '</div>', SRC_W, SRC_H, out);
}

function icon(size, out) {
  const k = size * 0.9 / SHIELD.h;
  const left = (size - SHIELD.w * k) / 2 - SHIELD.x * k;
  const top = (size - SHIELD.h * k) / 2 - SHIELD.y * k;
  const covers = '<div style="position:absolute;left:0;top:796px;width:262px;height:228px;background:#fff"></div>' +
    '<div style="position:absolute;left:262px;top:842px;width:515px;height:182px;background:#fff"></div>';
  shot('<div style="position:relative;overflow:hidden;width:' + size + 'px;height:' + size + 'px;background:linear-gradient(160deg,#BFE4FF,#FFFFFF 75%)">' +
    '<div style="position:absolute;left:' + left + 'px;top:' + top + 'px;width:' + SRC_W + 'px;height:' + SRC_H + 'px;transform:scale(' + k + ');transform-origin:0 0;mix-blend-mode:multiply;background:#fff">' +
    sourceLayer(covers) + '</div></div>', size, size, out);
}

if (!CHROME) throw new Error('Chrome or Edge not found');
logo(path.join(ASSETS, 'logo-3dskuwela.png'));
[512, 192, 180].forEach(function (n) {
  ['grade2', 'grade5'].forEach(function (g) { icon(n, path.join(ASSETS, 'icons', g + '-' + n + '.png')); });
});
console.log('Rendered logo and icons');
