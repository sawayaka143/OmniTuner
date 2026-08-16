// Node-only contrast checker. Reads the SCSS token file directly from disk
// and prints PASS/FAIL lines; exits non-zero on any AA failure.
const fs = require('node:fs');
const path = require('node:path');

const SCSS_FILE = path.resolve(__dirname, '../../../src/styles.scss');
const AA_MIN = 4.5;

const TEXT_TOKENS = ['--text', '--text-muted', '--text-dim'];
const SURFACE_TOKENS = [
  '--canvas',
  '--surface-container-low',
  '--surface-container',
  '--surface-container-high',
];

function lum(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const linear = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const source = fs.readFileSync(SCSS_FILE, 'utf8');
const tokens = {};
const re = /(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
let m;
while ((m = re.exec(source))) tokens[m[1]] = m[2].toLowerCase();

let failed = false;
for (const t of TEXT_TOKENS) {
  for (const s of SURFACE_TOKENS) {
    const r = ratio(tokens[t], tokens[s]);
    const ok = r >= AA_MIN;
    if (!ok) failed = true;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${t} vs ${s}: ${r.toFixed(2)}:1 (min ${AA_MIN}:1)`);
  }
}

process.exit(failed ? 1 : 0);
