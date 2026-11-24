// Draws an elf machine as a blueprint-style SVG from the parts Claude picked.
// Module kinds must match Catalog.Modules in Models/Catalog.cs.
// The layout, part sizes, idle motion and pipe fittings are picked at random, seeded from the wish,
// so every machine looks different but a given wish always draws the same way.

import { esc } from "./common.js";

const LINE = "#eaf3ff";
const GOLD = "#ffd27a";
const CORAL = "#ff9aa8";
const PIPE_INK = "#1d5596";
const FILL = 'fill="rgba(255,255,255,.08)"';
const FILL2 = 'fill="rgba(255,255,255,.18)"';

let uid = 0;
let motion = true; // set per render; SMIL animations are only written out when the blueprint moves

function polar(r, a) {
  return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
}

/** SVG markup for a gear centered on (0,0); also used by the kiosk's "elves at work" screen. */
export function gear(r, teeth, depth) {
  const step = (Math.PI * 2) / teeth;
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    pts.push(polar(r, a), polar(r + depth, a + step * 0.15), polar(r + depth, a + step * 0.45), polar(r, a + step * 0.6));
  }
  return `<path d="M${pts.join("L")}Z" ${FILL}/><circle r="${(r * 0.32).toFixed(1)}"/>`;
}

function star(x, y, s, cls = "bp-flicker") {
  return `<path class="${cls}" stroke="${GOLD}" d="M${x - s},${y} L${x + s},${y} M${x},${y - s} L${x},${y + s} M${x - s * 0.6},${y - s * 0.6} L${x + s * 0.6},${y + s * 0.6} M${x - s * 0.6},${y + s * 0.6} L${x + s * 0.6},${y - s * 0.6}"/>`;
}

// SMIL helpers. Rotations turn around the element's own (0,0), so wrap the element in a translate() to set the pivot.
function spin(values, dur, extra = "") {
  return motion ? `<animateTransform attributeName="transform" type="rotate" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>` : "";
}

function slide(values, dur, extra = "") {
  return motion ? `<animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>` : "";
}

function anim(attr, values, dur, extra = "") {
  return motion ? `<animate attributeName="${attr}" values="${values}" dur="${dur}" repeatCount="indefinite" ${extra}/>` : "";
}

// Each part is drawn around (0,0) inside roughly a 120 × 130 box, base near y = 50. Pipes join at y = 22.
const PARTS = {
  hopper: () => `
    <g class="bp-bob">
      <rect x="-24" y="-80" width="18" height="22" transform="rotate(-16 -15 -69)" ${FILL2}/>
      <rect x="6" y="-74" width="16" height="20" transform="rotate(14 14 -64)" ${FILL2}/>
      <path d="M-19,-72 l10,-2 M-18,-66 l9,-2 M10,-67 l8,2 M9,-61 l8,2" stroke-width="1.5"/>
    </g>
    <path d="M-54,-48 L54,-48 L16,8 L16,42 L-16,42 L-16,8 Z" ${FILL}/>
    <path d="M-58,-48 L58,-48" stroke-width="5"/>
    <path d="M-36,-34 L36,-34" stroke-dasharray="4 6" stroke-opacity=".6"/>
    <path d="M-16,24 L16,24" stroke-width="1.5"/>`,

  magnet: () => `
    <path d="M-38,-40 L-38,8 A38,38 0 0 0 38,8 L38,-40 L16,-40 L16,8 A16,16 0 0 1 -16,8 L-16,-40 Z" ${FILL}/>
    <rect x="-38" y="-52" width="22" height="12" fill="rgba(255,255,255,.45)"/>
    <rect x="16" y="-52" width="22" height="12" fill="rgba(255,255,255,.45)"/>
    <path class="bp-flow" d="M-27,-58 C-27,-84 27,-84 27,-58" stroke-dasharray="4 4" stroke="${GOLD}"/>
    <text x="0" y="-66" text-anchor="middle" font-size="13" fill="${GOLD}" stroke="none" class="bp-bob">1 0 1</text>`,

  scanner: () => `
    <circle cx="-10" cy="-10" r="34" ${FILL}/>
    <circle cx="-10" cy="-10" r="27" stroke-opacity=".45"/>
    <path d="M-30,-20 L6,-20 M-30,-10 L2,-10 M-30,0 L-4,0" stroke-width="2"/>
    <path class="bp-scan" d="M-38,-14 L18,-14" stroke="${GOLD}" stroke-width="2"/>
    <path d="M15,15 L46,46" stroke-width="11"/>
    <path d="M15,15 L46,46" stroke-width="5" stroke="${PIPE_INK}"/>`,

  brain: () => `
    <circle cx="0" cy="-10" r="42" ${FILL}/>
    <path d="M-36,28 L36,28 L30,52 L-30,52 Z" ${FILL2}/>
    <path d="M-16,-4 C-27,-6 -27,-22 -14,-24 C-12,-35 2,-37 6,-29 C16,-35 29,-24 22,-14 C31,-8 25,7 14,4 C12,13 -2,13 -4,4 C-10,9 -19,4 -16,-4 Z" stroke="${GOLD}" class="bp-think"/>
    <path d="M1,-29 C-5,-18 5,-12 0,1 M-14,-24 C-8,-18 -14,-12 -8,-8 M14,-26 C9,-18 18,-12 12,-6" stroke="${GOLD}" stroke-width="1.6"/>
    <g transform="translate(0,-10)"><g>${spin("0;360", "9s")}
      <g fill="${LINE}" stroke="none">
        <circle cx="-26" cy="-20" r="2"/><circle cx="24" cy="-26" r="1.8"/><circle cx="30" cy="18" r="2"/>
        <circle cx="-30" cy="20" r="1.6"/><circle cx="-4" cy="-34" r="1.6"/><circle cx="10" cy="28" r="1.6"/>
      </g>
    </g></g>
    ${star(30, -46, 7)}`,

  gears: () => `
    <g transform="translate(-14,10)"><g class="bp-spin">${gear(27, 10, 8)}</g></g>
    <g transform="translate(30,-27)"><g class="bp-spin-rev">${gear(15, 8, 6)}</g></g>
    <g transform="translate(34,30)"><g class="bp-spin-rev">${gear(10, 6, 5)}</g></g>`,

  sorter: () => `
    <rect x="-24" y="-58" width="48" height="22" rx="4" ${FILL2}/>
    <path d="M-6,-36 L-40,14 M0,-36 L0,14 M6,-36 L40,14" stroke-width="9" stroke-opacity=".25"/>
    <path class="bp-flow" d="M-6,-36 L-40,14 M0,-36 L0,14 M6,-36 L40,14" stroke-dasharray="6 6"/>
    <rect x="-56" y="14" width="30" height="30" rx="3" ${FILL}/>
    <rect x="-15" y="14" width="30" height="30" rx="3" ${FILL}/>
    <rect x="26" y="14" width="30" height="30" rx="3" ${FILL}/>
    <text y="36" font-size="15" text-anchor="middle" fill="${GOLD}" stroke="none"><tspan x="-41">✓</tspan><tspan x="0">★</tspan><tspan x="41">!</tspan></text>`,

  "robot-arm": () => `
    <rect x="-36" y="38" width="72" height="14" rx="4" ${FILL2}/>
    <circle cx="0" cy="30" r="9" ${FILL}/>
    <g transform="translate(0,30)"><g>${spin("8;-10;8", "2.6s")}
      <path d="M0,0 L-18,-38" stroke-width="11" stroke-opacity=".25"/>
      <path d="M0,0 L-18,-38"/>
      <circle cx="-18" cy="-38" r="7" ${FILL2}/>
      <g transform="translate(-18,-38)"><g>${spin("-6;18;-6", "2.6s")}
        <path d="M0,0 L42,-26" stroke-width="11" stroke-opacity=".25"/>
        <path d="M0,0 L42,-26"/>
        <circle cx="42" cy="-26" r="5" ${FILL2}/>
        <path d="M45,-29 L58,-36 L63,-28 M46,-23 L56,-14 L64,-19" stroke="${GOLD}"/>
      </g></g>
    </g></g>`,

  conveyor: () => `
    <g class="bp-ride">
      <rect x="-40" y="-20" width="24" height="24" ${FILL2}/>
      <rect x="6" y="-28" width="30" height="32" ${FILL2}/>
      <path d="M21,-28 L21,4 M6,-12 L36,-12" stroke="${CORAL}" stroke-width="2"/>
    </g>
    <path class="bp-flow" d="M-48,5 L48,5" stroke-dasharray="6 6" stroke-opacity=".7"/>
    <rect x="-58" y="8" width="116" height="26" rx="13" ${FILL}/>
    <g class="bp-spin"><circle cx="-38" cy="21" r="7"/><path d="M-43,21 L-33,21" stroke-width="1.5"/></g>
    <g class="bp-spin"><circle cx="0" cy="21" r="7"/><path d="M-5,21 L5,21" stroke-width="1.5"/></g>
    <g class="bp-spin"><circle cx="38" cy="21" r="7"/><path d="M33,21 L43,21" stroke-width="1.5"/></g>
    <path d="M-42,34 L-48,54 M42,34 L48,54"/>`,

  stamp: () => `
    <rect x="-48" y="-60" width="96" height="14" rx="3" ${FILL2}/>
    <path d="M-40,-46 L-40,46 M40,-46 L40,46"/>
    <g class="bp-press">
      <rect x="-6" y="-46" width="12" height="32" ${FILL}/>
      <rect x="-26" y="-14" width="52" height="16" rx="3" ${FILL2}/>
    </g>
    <rect x="-32" y="26" width="64" height="16" ${FILL}/>
    <text x="0" y="39" text-anchor="middle" font-size="12" fill="${CORAL}" stroke="none">NICE ✓</text>
    <path d="M-52,48 L52,48" stroke-width="4"/>`,

  tank: () => `
    <path d="M-34,-36 L-34,34 A34,10 0 0 0 34,34 L34,-36" ${FILL}/>
    <ellipse cx="0" cy="-36" rx="34" ry="10" ${FILL2}/>
    <path class="bp-slosh" d="M-34,-8 A34,10 0 0 0 34,-8" stroke="${GOLD}" stroke-dasharray="5 4"/>
    <circle cx="0" cy="14" r="11" ${FILL}/>
    <g transform="translate(0,14)"><g>${spin("-40;50;10;60;-40", "3.4s")}<path d="M0,0 L6,-8" stroke="${GOLD}"/></g></g>
    <path d="M-26,42 L-30,56 M26,42 L30,56"/>
    <g class="bp-rise"><circle cx="-12" cy="-50" r="3"/><circle cx="8" cy="-56" r="2.2"/><circle cx="-2" cy="-62" r="1.8"/></g>`,

  bell: () => `
    <circle cx="0" cy="-42" r="6"/>
    <path d="M0,-36 C-14,-50 -30,-44 -26,-32 C-16,-36 -8,-34 0,-36 Z M0,-36 C14,-50 30,-44 26,-32 C16,-36 8,-34 0,-36 Z" ${FILL2}/>
    <g transform="translate(0,-36)"><g>${spin("0;0;14;-14;10;-8;0", "2.4s", 'keyTimes="0;0.55;0.63;0.72;0.8;0.88;1"')}
      <circle cx="0" cy="34" r="32" ${FILL}/>
      <path d="M-24,44 C-10,37 10,37 24,44"/>
      <circle cx="0" cy="54" r="4" fill="${LINE}" stroke="none"/>
    </g></g>
    <g class="bp-flicker" stroke="${GOLD}">
      <path d="M-42,-18 C-50,-6 -50,8 -42,20 M42,-18 C50,-6 50,8 42,20"/>
      <path d="M-52,-26 C-62,-8 -62,14 -52,30 M52,-26 C62,-8 62,14 52,30" stroke-opacity=".6"/>
    </g>`,

  antenna: () => `
    <rect x="-26" y="34" width="52" height="16" rx="3" ${FILL2}/>
    <path d="M-4,34 L-4,-22 A16,16 0 0 1 28,-22 L28,-12" stroke-width="10"/>
    <path d="M-4,34 L-4,-22 A16,16 0 0 1 28,-22 L28,-12" stroke-width="10" stroke="${CORAL}" stroke-dasharray="6 7"/>
    <g stroke="${GOLD}">
      <path class="bp-wave" d="M-20,-38 A26,26 0 0 1 4,-56"/>
      <path class="bp-wave bp-wave-2" d="M-30,-44 A38,38 0 0 1 2,-68"/>
    </g>`,

  printer: () => `
    <rect x="-26" y="-52" width="52" height="32" ${FILL}/>
    <path d="M-16,-42 L16,-42 M-16,-34 L10,-34" stroke-width="1.5"/>
    <rect x="-46" y="-22" width="92" height="40" rx="6" ${FILL2}/>
    <path d="M-30,4 L30,4" stroke-width="3"/>
    <circle cx="34" cy="-10" r="3" fill="${GOLD}" stroke="none" class="bp-flicker"/>
    <circle cx="24" cy="-10" r="3" fill="${LINE}" stroke="none"/>
    <g class="bp-print">
      <path d="M-28,10 L28,10 L32,50 L-24,50 Z" ${FILL}/>
      <path d="M-12,40 L-12,32 M-2,40 L-2,24 M8,40 L8,28 M18,40 L18,20" stroke="${GOLD}" stroke-width="4"/>
    </g>`,

  "gift-wrapper": () => `
    <g class="bp-hop">
      <rect x="-36" y="-6" width="72" height="50" rx="3" ${FILL}/>
      <rect x="-40" y="-20" width="80" height="14" rx="3" ${FILL2}/>
      <path d="M0,-20 L0,44" stroke="${CORAL}" stroke-width="6"/>
      <path d="M0,-20 C-10,-44 -36,-40 -22,-22 Z M0,-20 C10,-44 36,-40 22,-22 Z" ${FILL2}/>
    </g>
    ${star(44, -34, 6)}${star(-46, -28, 5)}`,

  chimney: () => `
    <g class="bp-rise"><circle cx="-6" cy="-38" r="7"/><circle cx="8" cy="-50" r="9"/><circle cx="-4" cy="-64" r="6"/></g>
    <g class="bp-rise bp-rise-2"><circle cx="4" cy="-40" r="6"/><circle cx="-8" cy="-54" r="7"/></g>
    <rect x="-30" y="-26" width="60" height="12" ${FILL2}/>
    <rect x="-24" y="-14" width="48" height="64" ${FILL}/>
    <path d="M-24,2 L24,2 M-24,18 L24,18 M-24,34 L24,34 M0,-14 L0,2 M-12,2 L-12,18 M12,2 L12,18 M0,18 L0,34 M-12,34 L-12,50 M12,34 L12,50" stroke-width="1.5" stroke-opacity=".7"/>`,

  rocket: () => `
    <g class="bp-rumble">
      <path d="M-36,-14 L22,-14 C40,-14 54,-4 58,0 C54,4 40,14 22,14 L-36,14 Z" ${FILL}/>
      <circle cx="16" cy="0" r="6" ${FILL2}/>
      <path d="M-28,-14 L-44,-32 L-12,-14 M-28,14 L-44,32 L-12,14" ${FILL2}/>
      <rect x="-44" y="-9" width="8" height="18" ${FILL2}/>
    </g>
    <path class="bp-thrust" d="M-44,-7 L-60,-4 L-53,0 L-62,4 L-44,7" stroke="${GOLD}"/>
    <path d="M-60,-24 L-48,-24 M-64,24 L-50,24" stroke-opacity=".5"/>`,

  shredder: () => `
    <g class="bp-feed">
      <rect x="-15" y="-66" width="30" height="36" ${FILL2}/>
      <path d="M-9,-58 L9,-58 M-9,-51 L5,-51 M-9,-44 L7,-44" stroke-width="1.5"/>
    </g>
    <rect x="-44" y="-30" width="88" height="10" rx="3" ${FILL2}/>
    <path d="M-22,-25 L22,-25" stroke-width="3.5"/>
    <rect x="-38" y="-20" width="76" height="34" rx="4" ${FILL}/>
    <path d="M-28,-4 L10,-4" stroke-width="1.5" stroke-opacity=".6"/>
    <circle cx="26" cy="-4" r="4" fill="${GOLD}" stroke="none" class="bp-flicker"/>
    <path d="M-36,18 L36,18 L30,54 L-30,54 Z" ${FILL}/>
    <g class="bp-fall" stroke="${GOLD}" stroke-width="2">
      <path d="M-20,20 l2,14 M-10,22 l-2,16 M0,20 l1,12 M10,22 l-1,15 M20,20 l2,13"/>
    </g>`,

  mailbox: () => `
    <rect x="-7" y="10" width="14" height="42" ${FILL2}/>
    <path d="M-20,53 L20,53" stroke-width="4"/>
    <g class="bp-post">
      <rect x="-62" y="-30" width="28" height="19" ${FILL2}/>
      <path d="M-62,-30 L-48,-19 L-34,-30" stroke-width="1.5"/>
    </g>
    <path d="M-42,12 L-42,-22 A24,24 0 0 1 -18,-46 L18,-46 A24,24 0 0 1 42,-22 L42,12 Z" ${FILL}/>
    <path d="M-42,-22 A24,24 0 0 1 -18,-46" stroke-width="4"/>
    <path d="M-30,0 L22,0" stroke-width="1.5" stroke-opacity=".5"/>
    <g transform="translate(34,-6)"><g>${spin("80;80;0;0;80", "3.2s", 'keyTimes="0;0.35;0.45;0.85;1"')}
      <path d="M0,0 L0,-34" stroke="${CORAL}" stroke-width="3"/>
      <rect x="0" y="-34" width="16" height="11" fill="${CORAL}" stroke="none"/>
    </g></g>`,

  calculator: () => {
    const keys = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const pressed = (r * 3 + c) % 4 === 1;
        keys.push(`<rect${pressed ? ` class="bp-key" style="animation-delay:${(-(r * 3 + c) * 0.31).toFixed(2)}s"` : ""} x="${-24 + c * 18}" y="${-16 + r * 16}" width="12" height="10" rx="2" ${FILL2}/>`);
      }
    }
    return `
    <rect x="-34" y="-58" width="68" height="110" rx="8" ${FILL}/>
    <rect x="-26" y="-50" width="52" height="24" rx="3" ${FILL2}/>
    <text x="20" y="-32" text-anchor="end" font-size="15" fill="${GOLD}" stroke="none" class="bp-swap-a">1,225</text>
    <text x="20" y="-32" text-anchor="end" font-size="15" fill="${GOLD}" stroke="none" class="bp-swap-b">= 42</text>
    ${keys.join("")}`;
  },

  clock: () => {
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return `M${polar(28, a)} L${polar(i % 3 ? 31 : 34, a)}`;
    }).join(" ");
    const ring = (dir) => spin(`0;0;${14 * dir};${-14 * dir};${12 * dir};${-12 * dir};0`, "3s", 'keyTimes="0;0.6;0.68;0.76;0.84;0.92;1"');
    return `
    <g transform="translate(-24,-46)"><g>${ring(1)}<path d="M-11,4 A11,11 0 0 1 11,4 Z" ${FILL2}/></g></g>
    <g transform="translate(24,-46)"><g>${ring(-1)}<path d="M-11,4 A11,11 0 0 1 11,4 Z" ${FILL2}/></g></g>
    <path d="M-24,30 L-32,54 M24,30 L32,54"/>
    <circle cx="0" cy="-4" r="40" ${FILL}/>
    <g transform="translate(0,-4)">
      <path d="${ticks}" stroke-width="2"/>
      <g>${spin("0;360", "36s")}<path d="M0,0 L0,-17" stroke-width="4"/></g>
      <g>${spin("0;360", "3s")}<path d="M0,0 L0,-26" stroke="${GOLD}" stroke-width="2.4"/></g>
      <circle r="3.5" fill="${LINE}" stroke="none"/>
    </g>`;
  },

  "crystal-ball": () => `
    <path d="M-30,30 L30,30 L22,52 L-22,52 Z" ${FILL2}/>
    <circle cx="0" cy="-10" r="38" ${FILL}/>
    <path d="M-24,-32 A30,30 0 0 1 -6,-42" stroke-opacity=".55"/>
    <g transform="translate(0,-10)"><g>${spin("0;360", "6s")}
      <path d="M-22,6 C-16,-18 14,-20 22,-4 C12,-12 -2,-10 -6,4" stroke="${GOLD}" stroke-width="2" stroke-opacity=".85"/>
      <path d="M16,14 C6,24 -12,22 -18,12" stroke="${GOLD}" stroke-opacity=".5"/>
    </g></g>
    <path class="bp-trend" d="M-18,6 L-8,-2 L0,4 L16,-14 M10,-14 L16,-14 L16,-8" stroke-width="2"/>
    ${star(32, -50, 6)}${star(-36, -44, 4)}`,

  lightbulb: () => `
    <g class="bp-flicker" stroke="${GOLD}" stroke-width="2.4">
      <path d="M0,-62 L0,-76 M-34,-50 L-44,-60 M34,-50 L44,-60 M-46,-18 L-58,-18 M46,-18 L58,-18"/>
    </g>
    <path class="bp-glow" d="M-14,26 C-14,10 -32,0 -32,-22 A32,32 0 0 1 32,-22 C32,0 14,10 14,26 Z" ${FILL}/>
    <path d="M-8,20 L-8,0 L-4,-10 L0,0 L4,-10 L8,0 L8,20" stroke="${GOLD}" stroke-width="2"/>
    <rect x="-15" y="26" width="30" height="18" rx="3" ${FILL2}/>
    <path d="M-15,32 L15,32 M-15,38 L15,38" stroke-width="1.5"/>
    <path d="M-6,44 L6,44 L3,50 L-3,50 Z" fill="${LINE}" stroke="none"/>`,

  "elf-wheel": () => {
    const swing = (a, b) => spin(`${a};${b};${a}`, "0.5s");
    return `
    <path d="M-34,54 L0,-4 L34,54 M-22,34 L22,34" stroke-width="3"/>
    <g transform="translate(0,-4)">
      <g>${spin("0;-360", "2.2s")}
        <circle r="42" ${FILL}/>
        <circle r="36" stroke-opacity=".5" stroke-dasharray="3 6"/>
        <path d="M-36,0 L36,0 M0,-36 L0,36 M-25,-25 L25,25 M-25,25 L25,-25" stroke-width="1.2" stroke-opacity=".55"/>
      </g>
      <circle r="4" ${FILL2}/>
    </g>
    <g transform="translate(0,6)"><g class="bp-jog">
      <path d="M-6,-6 L1,-24 L6,-6 Z" fill="${CORAL}" stroke="none"/>
      <circle cx="1" cy="-25" r="2.5" fill="${LINE}" stroke="none"/>
      <circle cx="0" cy="-2" r="5" ${FILL2}/>
      <path d="M0,3 L0,15"/>
      <g transform="translate(0,7)"><g>${swing(-40, 40)}<path d="M0,0 L-2,9"/></g></g>
      <g transform="translate(0,15)"><g>${swing(35, -35)}<path d="M0,0 L-1,11"/></g></g>
      <g transform="translate(0,15)"><g>${swing(-35, 35)}<path d="M0,0 L-1,11"/></g></g>
    </g></g>`;
  },

  catapult: () => `
    <rect x="-48" y="30" width="96" height="12" rx="3" ${FILL2}/>
    <circle cx="-30" cy="46" r="8" ${FILL}/><circle cx="30" cy="46" r="8" ${FILL}/>
    <path d="M-16,30 L0,-4 L16,30 M-9,14 L9,14" stroke-width="3"/>
    <g transform="translate(0,-4)"><g>${spin("18;18;-48;-48;18", "3s", 'keyTimes="0;0.55;0.62;0.78;1"')}
      <path d="M-26,0 L44,0" stroke-width="5"/>
      <rect x="-36" y="-9" width="16" height="16" ${FILL2}/>
      <path d="M36,0 C36,-12 54,-12 54,0" ${FILL2}/>
      <rect x="39" y="-13" width="11" height="11" fill="${GOLD}" stroke="none"/>
    </g></g>
    <circle cx="0" cy="-4" r="4" fill="${LINE}" stroke="none"/>`,

  crane: () => {
    const times = 'keyTimes="0;0.4;0.6;1"';
    return `
    <rect x="-50" y="44" width="40" height="10" rx="2" ${FILL2}/>
    <rect x="-36" y="-64" width="12" height="108" ${FILL}/>
    <path d="M-36,-50 L-24,-36 M-24,-50 L-36,-36 M-36,-22 L-24,-8 M-24,-22 L-36,-8 M-36,6 L-24,20 M-24,6 L-36,20" stroke-width="1.2" stroke-opacity=".6"/>
    <path d="M-30,-72 L-30,-82 L50,-72" stroke-width="1.5" stroke-opacity=".7"/>
    <rect x="-44" y="-72" width="98" height="9" ${FILL2}/>
    <rect x="26" y="-63" width="14" height="7" ${FILL2}/>
    <path d="M33,-56 L33,-14" stroke-width="1.5">${anim("d", "M33,-56 L33,-14;M33,-56 L33,10;M33,-56 L33,10;M33,-56 L33,-14", "3.4s", times)}</path>
    <g>${slide("0 0;0 24;0 24;0 0", "3.4s", times)}
      <path d="M25,-14 L41,-14 M27,-14 L23,-4 L27,4 M39,-14 L43,-4 L39,4" stroke="${GOLD}" stroke-width="2.4"/>
    </g>
    <rect x="25" y="29" width="16" height="14" fill="${CORAL}" fill-opacity=".45" stroke="${CORAL}"/>`;
  },

  vacuum: () => `
    <g class="bp-suck" fill="${LINE}" stroke="none">
      <circle cx="-74" cy="-44" r="2.2"/><rect x="-71" y="-36" width="4" height="4"/><circle cx="-73" cy="-27" r="1.8"/>
    </g>
    <path d="M-46,-38 C-28,-38 -30,-6 -8,-6" stroke-width="11"/>
    <path class="bp-flow" d="M-46,-38 C-28,-38 -30,-6 -8,-6" stroke-width="6" stroke="${PIPE_INK}" stroke-dasharray="5 4"/>
    <path d="M-44,-46 L-60,-54 L-60,-22 L-44,-30 Z" ${FILL2}/>
    <rect x="-8" y="-34" width="52" height="72" rx="18" ${FILL}/>
    <path d="M-2,-16 L38,-16" stroke-width="1.5" stroke-opacity=".6"/>
    <circle cx="18" cy="6" r="10" ${FILL2}/>
    <g transform="translate(18,6)"><g>${spin("-60;50;-20;60;-60", "2.6s")}<path d="M0,0 L0,-8" stroke="${GOLD}" stroke-width="2"/></g></g>
    <circle cx="4" cy="44" r="7" ${FILL}/><circle cx="32" cy="44" r="7" ${FILL}/>`,

  "filing-cabinet": () => `
    <rect x="-32" y="-60" width="64" height="112" rx="4" ${FILL}/>
    <rect x="-26" y="-52" width="52" height="30" rx="2" ${FILL2}/>
    <path d="M-8,-35 L8,-35" stroke-width="3"/>
    <text x="0" y="-41" text-anchor="middle" font-size="9" fill="${LINE}" stroke="none">A–M</text>
    <rect x="-26" y="20" width="52" height="30" rx="2" ${FILL2}/>
    <path d="M-8,37 L8,37" stroke-width="3"/>
    <text x="0" y="31" text-anchor="middle" font-size="9" fill="${LINE}" stroke="none">★ NICE</text>
    <g class="bp-drawer">
      <path d="M-20,-16 l0,-5 l9,0 l0,5 M-4,-16 l0,-6 l9,0 l0,6 M12,-16 l0,-4 l8,0 l0,4" stroke="${GOLD}" stroke-width="1.5"/>
      <rect x="-26" y="-16" width="52" height="30" rx="2" fill="rgba(255,255,255,.24)"/>
      <path d="M-8,1 L8,1" stroke-width="3"/>
      <text x="0" y="-5" text-anchor="middle" font-size="9" fill="${LINE}" stroke="none">N–Z</text>
    </g>`,

  "tesla-coil": () => `
    <rect x="-26" y="38" width="52" height="14" rx="3" ${FILL2}/>
    <rect x="-10" y="-30" width="20" height="68" ${FILL}/>
    <path d="M-10,-18 L10,-26 M-10,-2 L10,-10 M-10,14 L10,6 M-10,30 L10,22" stroke="${CORAL}" stroke-width="4"/>
    <ellipse cx="0" cy="-38" rx="28" ry="9" ${FILL2}/>
    <g stroke="${GOLD}" stroke-width="2">
      <path class="bp-zap" d="M-26,-42 L-36,-54 L-30,-57 L-46,-70"/>
      <path class="bp-zap bp-zap-2" d="M26,-42 L38,-50 L33,-55 L50,-64"/>
      <path class="bp-zap bp-zap-3" d="M2,-47 L-4,-60 L4,-63 L-2,-80"/>
    </g>`,

  telescope: () => `
    <path d="M0,4 L-28,54 M0,4 L28,54 M0,4 L0,54" stroke-width="3"/>
    <g transform="translate(0,2)"><g>${spin("-30;-10;-30", "5s")}
      <rect x="-42" y="-8" width="64" height="16" rx="3" ${FILL}/>
      <rect x="18" y="-12" width="22" height="24" rx="3" ${FILL2}/>
      <rect x="-52" y="-5" width="10" height="10" ${FILL2}/>
      <path d="M-30,-8 L-30,8 M0,-8 L0,8" stroke-width="1.5" stroke-opacity=".6"/>
    </g></g>
    <circle cx="0" cy="2" r="4" fill="${LINE}" stroke="none"/>
    ${star(46, -50, 7)}${star(24, -66, 4)}`,

  chatbot: () => `
    <g class="bp-pop" style="transform-origin:-20px -44px">
      <path d="M-46,-62 L4,-62 Q12,-62 12,-54 L12,-34 Q12,-26 4,-26 L-24,-26 L-36,-14 L-34,-26 L-46,-26 Q-54,-26 -54,-34 L-54,-54 Q-54,-62 -46,-62 Z" ${FILL2}/>
      <g fill="${LINE}" stroke="none">
        <circle class="bp-type" cx="-34" cy="-44" r="3.5"/>
        <circle class="bp-type bp-type-2" cx="-21" cy="-44" r="3.5"/>
        <circle class="bp-type bp-type-3" cx="-8" cy="-44" r="3.5"/>
      </g>
    </g>
    <g class="bp-pop bp-pop-2" style="transform-origin:18px 8px">
      <path d="M-6,-10 L42,-10 Q50,-10 50,-2 L50,18 Q50,26 42,26 L34,26 L36,38 L24,26 L-6,26 Q-14,26 -14,18 L-14,-2 Q-14,-10 -6,-10 Z" ${FILL} stroke="${GOLD}"/>
      <path d="M-4,2 L38,2 M-4,14 L28,14" stroke="${GOLD}" stroke-width="2"/>
    </g>
    <rect x="-40" y="42" width="80" height="10" rx="4" ${FILL2}/>`,

  "helper-bot": () => {
    const tread = (x) => `<g transform="translate(${x},44)"><g>${spin("0;360", "1.4s")}<circle r="5"/><path d="M-5,0 L5,0" stroke-width="1.2"/></g></g>`;
    return `
    <path d="M0,-58 L0,-48" stroke-width="2"/>
    <circle cx="0" cy="-62" r="4" fill="${GOLD}" stroke="none" class="bp-flicker"/>
    <rect x="-24" y="-48" width="48" height="34" rx="9" ${FILL2}/>
    <g class="bp-blink" style="transform-origin:0 -32px" fill="${LINE}" stroke="none">
      <circle cx="-10" cy="-32" r="5"/><circle cx="10" cy="-32" r="5"/>
    </g>
    <path d="M-8,-21 Q0,-16 8,-21" stroke-width="2"/>
    <rect x="-28" y="-10" width="56" height="46" rx="7" ${FILL}/>
    <circle cx="0" cy="10" r="8" stroke="${GOLD}" class="bp-flicker"/>
    <g transform="translate(-28,-2)"><g>${spin("10;-55;10", "1.3s")}<path d="M0,0 L-16,-14"/><circle cx="-19" cy="-17" r="4" ${FILL2}/></g></g>
    <path d="M28,-2 L38,16 L34,24"/>
    <rect x="-26" y="36" width="52" height="16" rx="8" ${FILL2}/>
    ${tread(-14)}${tread(0)}${tread(14)}`;
  },

  spreadsheet: () => {
    const cells = [];
    let k = 0;
    for (const y of [-36, -20, -4, 12]) {
      for (const x of [-50, -25, 0, 25]) {
        if ((k * 5) % 3 === 0) {
          cells.push(`<rect class="bp-cell" style="animation-delay:${(k * 0.22).toFixed(2)}s" x="${x + 2}" y="${y + 2}" width="21" height="12" fill="${GOLD}" fill-opacity=".7" stroke="none"/>`);
        }
        k++;
      }
    }
    return `
    <path d="M-30,28 L-38,54 M30,28 L38,54" stroke-width="3"/>
    <rect x="-50" y="-52" width="100" height="80" rx="4" ${FILL}/>
    <rect x="-50" y="-52" width="100" height="16" rx="4" ${FILL2}/>
    ${cells.join("")}
    <path d="M-25,-52 L-25,28 M0,-52 L0,28 M25,-52 L25,28 M-50,-20 L50,-20 M-50,-4 L50,-4 M-50,12 L50,12" stroke-width="1.2" stroke-opacity=".55"/>
    <text x="-44" y="-40" font-size="11" fill="${GOLD}" stroke="none">Σ</text>`;
  },

  vault: () => {
    const bolts = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.39;
      return `<circle cx="${(Math.cos(a) * 31).toFixed(1)}" cy="${(Math.sin(a) * 31 - 6).toFixed(1)}" r="2.4" fill="${LINE}" stroke="none"/>`;
    }).join("");
    return `
    <rect x="-46" y="-52" width="92" height="92" rx="8" ${FILL}/>
    <rect x="-52" y="-36" width="8" height="16" rx="2" ${FILL2}/><rect x="-52" y="8" width="8" height="16" rx="2" ${FILL2}/>
    <circle cx="0" cy="-6" r="37" ${FILL2}/>
    <circle cx="0" cy="-6" r="26" stroke-opacity=".45"/>
    ${bolts}
    <g transform="translate(0,-6)"><g>${spin("0;150;90;250;360", "6s")}
      <circle r="13" ${FILL}/>
      <path d="M0,-13 L0,-6" stroke="${GOLD}" stroke-width="2.6"/>
      <path d="M-13,0 L-9,0 M13,0 L9,0 M0,13 L0,9" stroke-width="1.4"/>
    </g></g>
    <path d="M-34,40 L-38,54 M34,40 L38,54"/>`;
  },

  sleigh: () => `
    <g class="bp-ride">
      <rect x="-30" y="-32" width="22" height="26" ${FILL2}/>
      <rect x="-4" y="-24" width="18" height="18" ${FILL2}/>
      <path d="M-19,-32 L-19,-6 M5,-24 L5,-6" stroke="${CORAL}" stroke-width="3"/>
      <path d="M-46,-6 L30,-6 C40,-6 42,-20 38,-34 L50,-34 C58,-14 50,14 30,14 L-40,14 C-52,14 -54,-6 -46,-6 Z" ${FILL}/>
    </g>
    <path d="M-38,14 L-38,30 M22,14 L22,30" stroke-width="2"/>
    <path d="M-56,30 L40,30 C52,30 58,22 56,12" stroke-width="4"/>
    ${star(50, -50, 6)}${star(-48, -40, 4)}`,

  snowplow: () => {
    const wheel = (x) => `<g transform="translate(${x},36)"><g>${spin("0;360", "1.2s")}<circle r="6"/><path d="M-6,0 L6,0" stroke-width="1.2"/></g></g>`;
    return `
    <g class="bp-rise"><circle cx="-4" cy="-52" r="4"/><circle cx="2" cy="-62" r="5"/></g>
    <g class="bp-rumble">
      <path d="M-8,-30 L-8,-46 L0,-46 L0,-30" stroke-width="2"/>
      <rect x="-34" y="-30" width="42" height="28" rx="4" ${FILL}/>
      <rect x="-26" y="-24" width="20" height="14" ${FILL2}/>
      <rect x="-46" y="-2" width="66" height="26" rx="4" ${FILL2}/>
    </g>
    <path d="M20,8 L32,8" stroke-width="4"/>
    <path d="M30,-22 C48,-12 52,22 42,40 L30,40 Z" ${FILL2}/>
    <g class="bp-fall" fill="${LINE}" stroke="none"><rect x="50" y="-10" width="6" height="7"/><rect x="54" y="6" width="5" height="6"/><circle cx="50" cy="20" r="2.4"/></g>
    <rect x="-46" y="26" width="66" height="20" rx="10" ${FILL}/>
    ${wheel(-34)}${wheel(-13)}${wheel(8)}`;
  },

  "cookie-cutter": () => `
    <rect x="-48" y="-64" width="96" height="12" rx="3" ${FILL2}/>
    <path d="M-40,-52 L-40,42 M40,-52 L40,42"/>
    <g class="bp-press">
      <rect x="-5" y="-52" width="10" height="16" ${FILL}/>
      <circle cx="0" cy="-30" r="7" ${FILL2} stroke="${GOLD}"/>
      <path d="M-6,-24 L-18,-20 L-16,-14 L-7,-16 L-10,0 L-3,0 L0,-8 L3,0 L10,0 L7,-16 L16,-14 L18,-20 L6,-24 Z" ${FILL2} stroke="${GOLD}"/>
    </g>
    <rect x="-34" y="18" width="68" height="14" rx="6" ${FILL}/>
    <path d="M-28,25 C-20,21 -12,29 -4,25 C4,21 12,29 20,25" stroke-width="1.5" stroke-opacity=".6"/>
    <path d="M-50,42 L50,42" stroke-width="4"/>`,

  sieve: () => `
    <g>${slide("-5 0;5 0;-5 0", "0.5s")}
      <g ${FILL2}><rect x="-28" y="-36" width="12" height="15"/><rect x="2" y="-38" width="14" height="17"/></g>
      <path d="M-44,-20 L44,-20 L34,8 L-34,8 Z" ${FILL}/>
      <path d="M-40,-10 L40,-10 M-37,-1 L37,-1 M-24,-20 L-20,8 M-8,-20 L-7,8 M8,-20 L7,8 M24,-20 L20,8" stroke-width="1.2" stroke-opacity=".6"/>
      <path d="M44,-20 L62,-30" stroke-width="5"/>
    </g>
    <g class="bp-fall" fill="${CORAL}" stroke="none"><circle cx="-14" cy="16" r="2.5"/><circle cx="2" cy="20" r="2"/><circle cx="16" cy="15" r="2.5"/></g>
    <path d="M-30,30 L30,30 L24,52 L-24,52 Z" ${FILL}/>`,

  phonograph: () => {
    const note = (x, y, cls) => `<g class="bp-rise ${cls}" stroke="${GOLD}"><path d="M${x},${y} L${x},${y - 12} L${x + 8},${y - 14} L${x + 8},${y - 2}"/><circle cx="${x - 2}" cy="${y}" r="2.5" fill="${GOLD}"/><circle cx="${x + 6}" cy="${y - 2}" r="2.5" fill="${GOLD}"/></g>`;
    return `
    <path d="M16,-6 C16,-30 2,-50 -30,-64 C-22,-78 -2,-84 8,-74 C10,-50 24,-26 26,-6 Z" ${FILL}/>
    <path d="M14,18 L20,-6" stroke-width="3"/>
    <ellipse cx="-8" cy="18" rx="32" ry="6" ${FILL2}/>
    <ellipse cx="-8" cy="18" rx="8" ry="2" stroke="${GOLD}">${anim("rx", "8;20;8", "1s")}</ellipse>
    <rect x="-42" y="24" width="80" height="28" rx="4" ${FILL}/>
    <circle cx="26" cy="38" r="4" fill="${GOLD}" stroke="none" class="bp-flicker"/>
    ${note(-46, -40, "")}${note(30, -60, "bp-rise-2")}`;
  },

  typewriter: () => {
    const keys = [];
    for (const [r, y] of [6, 18, 30].entries()) {
      for (let c = 0; c < 8 - r; c++) {
        const x = -35 + r * 5 + c * 10;
        keys.push(`<circle${(r * 8 + c) % 3 === 1 ? ` class="bp-key" style="animation-delay:${(-(r * 8 + c) * 0.27).toFixed(2)}s"` : ""} cx="${x}" cy="${y}" r="3.6" ${FILL2}/>`);
      }
    }
    return `
    <g class="bp-print">
      <rect x="-24" y="-62" width="48" height="46" ${FILL}/>
      <path d="M-16,-52 L16,-52 M-16,-44 L10,-44 M-16,-36 L14,-36" stroke="${GOLD}" stroke-width="1.5"/>
    </g>
    <rect x="-40" y="-20" width="80" height="12" rx="6" ${FILL2}/>
    <circle cx="-46" cy="-14" r="5" ${FILL2}/><circle cx="46" cy="-14" r="5" ${FILL2}/>
    <path d="M-40,-20 L-52,-30 L-58,-28" stroke-width="2"/>
    <path d="M-50,-6 L50,-6 L56,40 L-56,40 Z" ${FILL}/>
    ${keys.join("")}
    <path d="M-60,40 L60,40" stroke-width="3"/>`;
  },

  scale: () => `
    <path d="M0,-50 L0,40" stroke-width="4"/>
    <path d="M-24,48 L24,48 L16,40 L-16,40 Z" ${FILL2}/>
    <circle cx="0" cy="-54" r="5" ${FILL2}/>
    <g transform="translate(0,-46)"><g>${spin("-8;8;-8", "3s")}
      <path d="M-44,0 L44,0" stroke-width="4"/>
      <path d="M-44,0 L-56,28 M-44,0 L-32,28 M44,0 L32,28 M44,0 L56,28" stroke-width="1.4"/>
      <rect x="-52" y="16" width="14" height="12" ${FILL}/>
      <circle cx="44" cy="22" r="6" fill="${GOLD}" stroke="none"/>
      <path d="M-60,28 L-28,28 C-30,38 -58,38 -60,28 Z" ${FILL2}/>
      <path d="M28,28 L60,28 C58,38 30,38 28,28 Z" ${FILL2}/>
    </g></g>`,

  radar: () => `
    <rect x="-30" y="34" width="60" height="18" rx="3" ${FILL2}/>
    <path d="M-6,30 L-6,34 M6,30 L6,34"/>
    <circle cx="0" cy="-10" r="40" ${FILL}/>
    <circle cx="0" cy="-10" r="26" stroke-opacity=".4"/><circle cx="0" cy="-10" r="12" stroke-opacity=".4"/>
    <path d="M-40,-10 L40,-10 M0,-50 L0,30" stroke-width="1" stroke-opacity=".4"/>
    <g transform="translate(0,-10)"><g>${spin("0;360", "3s")}
      <path d="M0,0 L0,-40 A40,40 0 0 1 20,-34.6 Z" fill="${GOLD}" fill-opacity=".22" stroke="none"/>
      <path d="M0,0 L0,-40" stroke="${GOLD}" stroke-width="2.4"/>
    </g></g>
    <circle cx="18" cy="-26" r="3" fill="${CORAL}" stroke="none" class="bp-beacon"/>
    <circle cx="-16" cy="2" r="2.5" fill="${CORAL}" stroke="none" class="bp-beacon" style="animation-delay:-.45s"/>`,

  switchboard: () => {
    const jacks = [];
    for (const y of [-42, -26, -10]) for (const x of [-32, -16, 0, 16, 32]) jacks.push(`<circle cx="${x}" cy="${y}" r="3.5" ${FILL2}/>`);
    return `
    <rect x="-46" y="-56" width="92" height="76" rx="6" ${FILL}/>
    ${jacks.join("")}
    <path d="M-32,-42 C-32,12 16,12 16,-26" stroke="${GOLD}"/>
    <path d="M0,-10 C0,28 -32,18 -32,-26" stroke="${CORAL}"/>
    <path class="bp-flicker" d="M32,-42 C40,4 -16,10 -16,-42" stroke="${GOLD}"/>
    <rect x="-46" y="20" width="92" height="20" ${FILL2}/>
    <g fill="${GOLD}" stroke="none"><circle cx="-24" cy="30" r="3" class="bp-beacon"/><circle cx="0" cy="30" r="3" class="bp-beacon" style="animation-delay:-.3s"/><circle cx="24" cy="30" r="3" class="bp-beacon" style="animation-delay:-.6s"/></g>
    <path d="M-38,40 L-42,54 M38,40 L42,54"/>`;
  },

  "piggy-bank": () => `
    <g class="bp-feed"><circle cx="2" cy="-58" r="7" fill="${GOLD}" fill-opacity=".8" stroke="${GOLD}"/></g>
    <path d="M-26,28 L-26,48 M-10,30 L-10,48 M14,30 L14,48 M28,28 L28,48" stroke-width="7"/>
    <ellipse cx="0" cy="0" rx="44" ry="32" ${FILL}/>
    <path d="M-8,-30 L12,-30" stroke-width="3"/>
    <path d="M20,-26 L28,-44 L36,-22" ${FILL2}/>
    <ellipse cx="46" cy="2" rx="7" ry="10" ${FILL2}/>
    <circle cx="45" cy="-2" r="1.5" fill="${LINE}" stroke="none"/><circle cx="45" cy="6" r="1.5" fill="${LINE}" stroke="none"/>
    <circle cx="28" cy="-10" r="2.5" fill="${LINE}" stroke="none"/>
    <path d="M-44,-4 C-54,-10 -58,4 -50,4 C-46,4 -48,-4 -54,-2"/>`,

  compass: () => `
    <path d="M-30,30 L30,30 L22,52 L-22,52 Z" ${FILL2}/>
    <circle cx="0" cy="-56" r="5" ${FILL2}/>
    <circle cx="0" cy="-12" r="40" ${FILL}/>
    <circle cx="0" cy="-12" r="32" stroke-opacity=".45"/>
    <text x="0" y="-34" text-anchor="middle" font-size="11" fill="${GOLD}" stroke="none">N</text>
    <path d="M-32,-12 L-26,-12 M26,-12 L32,-12 M0,14 L0,20" stroke-width="1.6"/>
    <g transform="translate(0,-12)"><g>${spin("-30;20;-10;10;0;-30", "5s")}
      <path d="M0,-26 L7,0 L0,26 L-7,0 Z" ${FILL2}/>
      <path d="M0,-26 L7,0 L-7,0 Z" fill="${CORAL}" stroke="none"/>
    </g></g>
    <circle cx="0" cy="-12" r="3" fill="${LINE}" stroke="none"/>`,

  "tag-gun": () => `
    <circle cx="8" cy="-44" r="12" ${FILL2}/>
    <g transform="translate(8,-44)"><g>${spin("0;360", "3s")}<path d="M0,0 L0,-8" stroke="${GOLD}" stroke-width="2"/></g></g>
    <g class="bp-post"><path d="M40,-26 L56,-26 L62,-18 L56,-10 L40,-10 Z" fill="${GOLD}" fill-opacity=".55" stroke="${GOLD}"/><circle cx="55" cy="-18" r="1.8" fill="${LINE}" stroke="none"/></g>
    <path d="M-44,-32 L24,-32 Q34,-32 34,-22 L34,-6 L-10,-6 L-18,30 Q-20,38 -28,38 L-34,38 Q-40,38 -38,30 L-30,-6 L-44,-6 Z" ${FILL}/>
    <rect x="34" y="-24" width="10" height="12" ${FILL2}/>
    <rect x="-34" y="-26" width="30" height="12" ${FILL2}/>
    <g transform="translate(-8,-6)"><g>${spin("0;0;-25;0", "1.6s", 'keyTimes="0;0.6;0.7;1"')}<path d="M0,0 C-2,10 4,16 10,13" stroke-width="3"/></g></g>`,

  clipboard: () => {
    const rows = [-34, -18, -2, 14, 30];
    return `
    <path d="M-26,46 L-30,54 M26,46 L30,54"/>
    <rect x="-36" y="-58" width="72" height="104" rx="6" ${FILL}/>
    <rect x="-28" y="-46" width="56" height="86" ${FILL2}/>
    <rect x="-16" y="-64" width="32" height="14" rx="4" ${FILL2}/>
    ${rows.map((y) => `<rect x="-22" y="${y - 4}" width="9" height="9" stroke-width="1.5"/><path d="M-6,${y} L20,${y}" stroke-width="1.5" stroke-opacity=".7"/>`).join("")}
    ${rows.map((y, i) => `<path class="bp-cell" style="animation-delay:${(i * 0.5).toFixed(1)}s" d="M-22,${y - 1} L-18,${y + 4} L-10,${y - 8}" stroke="${GOLD}" stroke-width="2.4"/>`).join("")}`;
  },

  "sewing-machine": () => `
    <path d="M-40,40 L-44,54 M40,40 L44,54"/>
    <path d="M-2,-56 C10,-64 30,-58 32,-24" stroke="${CORAL}" stroke-width="1.2"/>
    <rect x="-8" y="-64" width="12" height="10" ${FILL2}/>
    <path d="M-2,-64 L-2,-54" stroke="${CORAL}" stroke-width="4"/>
    <path d="M-40,28 L-40,-38 Q-40,-50 -28,-50 L30,-50 Q42,-50 42,-38 L42,-24 L22,-24 L22,-34 L-22,-34 L-22,28 Z" ${FILL}/>
    <g>${slide("0 0;0 10;0 0", "0.4s")}<path d="M32,-24 L32,0" stroke-width="2.4"/><path d="M32,0 L32,8" stroke="${GOLD}" stroke-width="1.4"/></g>
    <g transform="translate(-40,-30)"><g>${spin("0;360", "1.6s")}<circle r="10" ${FILL2}/><path d="M-10,0 L10,0 M0,-10 L0,10" stroke-width="1.2"/></g></g>
    <path class="bp-flow" d="M-50,24 L58,24" stroke="${GOLD}" stroke-dasharray="5 4"/>
    <rect x="-50" y="28" width="104" height="12" rx="3" ${FILL2}/>`,

  eraser: () => `
    <path d="M-46,-66 L46,-66" stroke-width="4"/>
    <path d="M-46,-66 L-46,34 M46,-66 L46,-10 M-40,34 L-44,54 M40,34 L44,54" stroke-width="2"/>
    <rect x="-46" y="-10" width="92" height="44" ${FILL2}/>
    <path d="M-38,4 L-20,4 M-38,14 C-30,8 -26,20 -18,12 C-12,6 -8,18 0,12 M-36,24 L-26,24" stroke-width="1.5"/>
    <path d="M12,4 L38,4 M12,14 L34,14 M12,24 L30,24" stroke="${GOLD}" stroke-width="1.5"/>
    <g>${slide("-18 0;14 0;-18 0", "1.4s")}
      <path d="M0,-66 L0,-46" stroke-width="3"/>
      <path d="M-16,-46 L16,-46 L20,-10 L-12,-10 Z" ${FILL}/>
      <path d="M-14,-24 L19,-24" stroke="${CORAL}" stroke-width="7" stroke-opacity=".7"/>
    </g>
    <g class="bp-fall" fill="${LINE}" stroke="none"><circle cx="-10" cy="-4" r="1.6"/><circle cx="4" cy="-2" r="1.6"/><circle cx="-2" cy="-6" r="1.2"/></g>`,

  keyring: () => {
    const key = (a, color) => `<g transform="rotate(${a})"><circle cy="25" r="7" stroke="${color}"/><path d="M0,32 L0,60 M0,48 L7,48 M0,55 L6,55" stroke="${color}" stroke-width="3"/></g>`;
    return `
    <path d="M-34,40 L-38,54 M34,40 L38,54"/>
    <rect x="-44" y="-74" width="88" height="114" rx="6" ${FILL}/>
    <path d="M-44,-62 L44,-62" stroke-opacity=".5"/>
    <path d="M0,-62 L0,-56" stroke-width="3"/>
    <g transform="translate(0,-38)"><g>${spin("-10;10;-10", "2.4s")}
      <circle r="18" stroke-width="4"/>
      ${key(-30, LINE)}${key(0, GOLD)}${key(30, CORAL)}
    </g></g>`;
  },

  globe: () => `
    <path d="M-26,52 L26,52 M0,52 L0,32" stroke-width="3"/>
    <path d="M-38,-30 A40,40 0 0 0 24,28" stroke-width="3"/>
    <circle cx="0" cy="-6" r="32" ${FILL}/>
    <ellipse cx="0" cy="-6" rx="32" ry="32" stroke-opacity=".6">${anim("rx", "32;2;32", "3s")}</ellipse>
    <ellipse cx="0" cy="-6" rx="16" ry="32" stroke-opacity=".6">${anim("rx", "16;32;2;16", "3s")}</ellipse>
    <path d="M-32,-6 L32,-6 M-28,-22 L28,-22 M-28,10 L28,10" stroke-width="1.2" stroke-opacity=".5"/>
    <path d="M-58,-76 L-2,-76 L-2,-50 L-18,-50 L-28,-41 L-28,-50 L-58,-50 Z" ${FILL2}/>
    <text x="-30" y="-58" text-anchor="middle" font-size="11" fill="${GOLD}" stroke="none" class="bp-swap-a">Hello!</text>
    <text x="-30" y="-58" text-anchor="middle" font-size="11" fill="${GOLD}" stroke="none" class="bp-swap-b">Hola!</text>`,

  megaphone: () => `
    <path d="M-20,14 L-20,40 M-36,54 L-20,40 L-4,54" stroke-width="3"/>
    <path d="M-20,-6 L-24,14 L-14,14 L-10,-6" ${FILL2}/>
    <rect x="-42" y="-20" width="8" height="16" rx="2" ${FILL2}/>
    <path d="M-34,-18 L-14,-18 L30,-46 L30,22 L-14,-6 L-34,-6 Z" ${FILL}/>
    <ellipse cx="30" cy="-12" rx="6" ry="34" ${FILL2}/>
    <path d="M-6,-12 L20,-12" stroke="${CORAL}" stroke-width="3"/>
    <g stroke="${GOLD}">
      <path class="bp-flicker" d="M42,-30 C50,-20 50,-4 42,6"/>
      <path class="bp-flicker" style="animation-delay:-.6s" d="M50,-42 C62,-24 62,0 50,18" stroke-opacity=".7"/>
    </g>`,

  camera: () => `
    <path d="M0,20 L-26,54 M0,20 L26,54 M0,20 L0,54" stroke-width="3"/>
    <path d="M-18,-34 L-12,-46 L12,-46 L18,-34" ${FILL2}/>
    <rect x="-34" y="-42" width="10" height="8" ${FILL2}/>
    <rect x="-42" y="-34" width="84" height="54" rx="8" ${FILL}/>
    <circle cx="0" cy="-7" r="18" ${FILL2}/>
    <circle cx="0" cy="-7" r="10"/>
    <path d="M-5,-12 A6,6 0 0 1 2,-14" stroke-opacity=".6"/>
    <rect x="24" y="-44" width="14" height="10" ${FILL2}/>
    <g class="bp-zap" stroke="${GOLD}" stroke-width="2"><path d="M31,-50 L31,-62 M22,-48 L15,-57 M40,-48 L47,-57"/></g>`,

  "paper-plane": () => {
    const plane = `<path d="M-21,-6 L27,-24 L-3,12 L-6,-2 Z M-6,-2 L27,-24" fill="rgba(255,255,255,.3)"/>`;
    const times = 'keyTimes="0;0.6;1"';
    return `
    <rect x="-50" y="30" width="100" height="14" rx="3" ${FILL2}/>
    <path d="M-44,30 L28,-8 L36,0 L-34,30" ${FILL}/>
    <path d="M-40,44 L-44,54 M40,44 L44,54"/>
    <g transform="translate(-34,12)">${plane}</g>
    <g transform="translate(-16,4)"><g>${slide("0 0;40 -50;40 -50", "2.4s", times)}<g>${anim("opacity", "1;1;0", "2.4s", times)}${plane}</g></g></g>`;
  },

  jigsaw: () => `
    <path d="M-30,30 L-36,54 M30,30 L36,54"/>
    <rect x="-40" y="-50" width="80" height="80" rx="4" ${FILL}/>
    <rect x="0" y="-10" width="40" height="40" stroke-dasharray="4 4" stroke-opacity=".5"/>
    <path d="M0,-50 L0,-10 M-40,-10 L0,-10 M0,-10 L0,30" stroke-width="1.4"/>
    <circle cx="0" cy="-30" r="6" ${FILL2}/><circle cx="-20" cy="-10" r="6" ${FILL2}/><circle cx="20" cy="-10" r="6" ${FILL2}/>
    <g>${slide("24 -46;24 -46;0 0;0 0;24 -46", "3.6s", 'keyTimes="0;0.2;0.5;0.85;1"')}
      <rect x="1" y="-9" width="38" height="38" rx="3" fill="${GOLD}" fill-opacity=".45" stroke="${GOLD}"/>
      <circle cx="0" cy="10" r="6" fill="${GOLD}" fill-opacity=".45" stroke="${GOLD}"/>
    </g>`,

  gumball: () => `
    <rect x="-8" y="-72" width="16" height="8" rx="3" ${FILL2}/>
    <circle cx="0" cy="-32" r="32" ${FILL}/>
    <g stroke="none">
      <circle cx="-14" cy="-20" r="7" fill="${GOLD}" fill-opacity=".6"/><circle cx="2" cy="-16" r="7" fill="${CORAL}" fill-opacity=".6"/>
      <circle cx="16" cy="-22" r="7" fill="rgba(255,255,255,.4)"/><circle cx="-6" cy="-32" r="7" fill="rgba(255,255,255,.4)"/>
      <circle cx="10" cy="-36" r="7" fill="${GOLD}" fill-opacity=".6"/><circle cx="-18" cy="-40" r="6" fill="${CORAL}" fill-opacity=".6"/>
    </g>
    <path d="M-22,-50 A26,26 0 0 1 -4,-58" stroke-opacity=".55"/>
    <path d="M-26,-4 L26,-4 L32,40 L-32,40 Z" ${FILL2}/>
    <g transform="translate(-6,14)"><g>${spin("0;0;360;360", "2.6s", 'keyTimes="0;0.4;0.6;1"')}<circle r="8" ${FILL}/><path d="M0,0 L0,-8" stroke="${GOLD}" stroke-width="2"/></g></g>
    <path d="M10,26 L24,26 L24,34" stroke-width="2"/>
    <circle cx="30" cy="34" r="5" fill="${GOLD}" stroke="none" class="bp-fall"/>
    <rect x="-36" y="40" width="72" height="10" rx="3" ${FILL2}/>`,

  "fishing-rod": () => `
    <rect x="-54" y="30" width="28" height="24" ${FILL2}/>
    <path d="M-54,42 L-26,42" stroke-width="1.2" stroke-opacity=".6"/>
    <path d="M-40,30 L40,-62" stroke-width="3"/>
    <circle cx="-28" cy="16" r="6" ${FILL2}/>
    <g transform="translate(-28,16)"><g>${spin("0;360", "1s")}<path d="M0,0 L0,-6" stroke-width="1.5"/></g></g>
    <path d="M40,-62 L40,8" stroke-width="1.2">${anim("d", "M40,-62 L40,8;M40,-62 L40,-24;M40,-62 L40,8", "3s")}</path>
    <g>${slide("0 0;0 -32;0 0", "3s")}
      <path d="M40,4 C40,12 46,12 46,8" stroke-width="1.6"/>
      <rect x="33" y="10" width="14" height="16" fill="${GOLD}" fill-opacity=".55" stroke="${GOLD}"/>
    </g>
    <path d="M-20,40 C-10,34 0,46 10,40 C20,34 30,46 40,40 C46,36 52,40 58,40 L58,54 L-20,54 Z" ${FILL}/>
    <path class="bp-flow" d="M-14,47 L54,47" stroke-dasharray="6 6" stroke-opacity=".5"/>`,

  toaster: () => `
    <g>${slide("0 0;0 0;0 -26;0 -26;0 0", "2.8s", 'keyTimes="0;0.4;0.5;0.85;1"')}
      <rect x="-24" y="-38" width="16" height="24" rx="4" ${FILL2}/><rect x="8" y="-38" width="16" height="24" rx="4" ${FILL2}/>
      <path d="M-20,-30 L-12,-30 M-20,-24 L-14,-24 M12,-30 L20,-30 M12,-24 L18,-24" stroke="${GOLD}" stroke-width="1.5"/>
    </g>
    <rect x="-42" y="-20" width="84" height="62" rx="16" ${FILL}/>
    <path d="M-26,-20 L-6,-20 M6,-20 L26,-20" stroke-width="4"/>
    <path d="M44,-4 L44,30" stroke-opacity=".5"/>
    <rect x="42" y="0" width="12" height="6" rx="2" ${FILL2}/>
    <circle cx="-24" cy="20" r="6"/>
    <path d="M-24,20 L-20,16" stroke="${GOLD}" stroke-width="2"/>
    <path d="M-30,42 L-30,50 M30,42 L30,50" stroke-width="4"/>`,

  thermometer: () => {
    const ticks = Array.from({ length: 6 }, (_, i) => `M10,${-58 + i * 14} L${i % 2 ? 15 : 18},${-58 + i * 14}`).join(" ");
    return `
    <path d="M-24,54 L24,54" stroke-width="4"/>
    <rect x="-10" y="-70" width="20" height="96" rx="10" ${FILL}/>
    <path d="${ticks}" stroke-width="1.5"/>
    <rect x="-4" y="-20" width="8" height="50" fill="${CORAL}" fill-opacity=".8" stroke="none">${anim("y", "-20;-56;-34;-20", "4s")}${anim("height", "50;86;64;50", "4s")}</rect>
    <circle cx="0" cy="36" r="15" fill="${CORAL}" fill-opacity=".6"/>
    <g transform="translate(-36,8)"><circle r="11" ${FILL2}/><circle cx="-4" cy="-3" r="1.5" fill="${LINE}" stroke="none"/><circle cx="4" cy="-3" r="1.5" fill="${LINE}" stroke="none"/><path d="M-5,6 Q0,1 5,6" stroke-width="1.6"/></g>
    <g transform="translate(36,-50)" stroke="${GOLD}"><circle r="11" ${FILL2}/><circle cx="-4" cy="-3" r="1.5" fill="${GOLD}" stroke="none"/><circle cx="4" cy="-3" r="1.5" fill="${GOLD}" stroke="none"/><path d="M-5,3 Q0,8 5,3" stroke-width="1.6"/></g>`;
  },

  projector: () => {
    const bars = [[24, 14, 0], [34, 22, 0.3], [44, 10, 0.6]];
    return `
    <rect x="18" y="-72" width="40" height="34" ${FILL2}/>
    ${bars.map(([x, h, d]) => `<rect class="bp-cell" style="animation-delay:${d}s" x="${x}" y="${-42 - h}" width="7" height="${h}" fill="${GOLD}" fill-opacity=".7" stroke="none"/>`).join("")}
    <path d="M38,-38 L38,-28" stroke-width="1.5"/>
    <path class="bp-flicker" d="M20,4 L18,-38 L58,-38 L20,16 Z" fill="${GOLD}" fill-opacity=".14" stroke="none"/>
    <path d="M-40,28 L-44,54 M4,28 L8,54"/>
    <rect x="-46" y="-6" width="56" height="34" rx="6" ${FILL}/>
    <rect x="10" y="2" width="10" height="16" ${FILL2}/>
    <g transform="translate(-34,-22)"><g>${spin("0;360", "2s")}<circle r="14" ${FILL2}/><path d="M-14,0 L14,0 M0,-14 L0,14" stroke-width="1.2"/></g></g>
    <g transform="translate(-4,-20)"><g>${spin("0;360", "2s")}<circle r="11" ${FILL2}/><path d="M-11,0 L11,0 M0,-11 L0,11" stroke-width="1.2"/></g></g>`;
  },

  lasso: () => `
    <rect x="20" y="0" width="14" height="54" ${FILL2}/>
    <path d="M14,54 L40,54" stroke-width="4"/>
    <path d="M27,0 C20,-24 0,-34 -10,-40" stroke="${GOLD}" stroke-width="2"/>
    <g transform="translate(-14,-52)"><g>${spin("0;360", "1.4s")}
      <ellipse rx="30" ry="12" stroke="${GOLD}" stroke-width="2.4">${anim("ry", "10;16;10", "1.4s")}</ellipse>
    </g></g>
    <path d="M-30,32 L20,18" stroke="${GOLD}" stroke-dasharray="3 3"/>
    <g class="bp-suck"><rect x="-56" y="22" width="14" height="18" ${FILL2}/><rect x="-44" y="30" width="14" height="18" ${FILL2}/></g>`,

  mixer: () => `
    <path d="M-50,46 L30,46 L30,38 L-50,38 Z" ${FILL2}/>
    <rect x="8" y="-30" width="14" height="68" ${FILL}/>
    <rect x="-48" y="-52" width="70" height="24" rx="12" ${FILL}/>
    <circle cx="10" cy="-40" r="3" fill="${GOLD}" stroke="none" class="bp-flicker"/>
    <g class="bp-fall" fill="${GOLD}" stroke="none"><circle cx="-36" cy="-16" r="2.2"/><rect x="-28" y="-12" width="4" height="4"/><circle cx="-8" cy="-14" r="2"/></g>
    <g transform="translate(-18,-28)"><g>${spin("-15;15;-15", "0.4s")}<path d="M0,0 L0,18 M-8,18 C-8,36 8,36 8,18 Z"/></g></g>
    <path d="M-48,4 L12,4 C10,30 -4,38 -18,38 C-32,38 -46,30 -48,4 Z" ${FILL2}/>
    <path class="bp-flow" d="M-40,14 C-30,8 -10,20 4,12" stroke="${GOLD}" stroke-dasharray="4 4"/>`,

  boomerang: () => `
    <ellipse cx="0" cy="-30" rx="48" ry="30" stroke="${GOLD}" stroke-dasharray="3 6" stroke-opacity=".6"/>
    <rect x="-16" y="24" width="32" height="28" ${FILL2}/>
    <path d="M-26,54 L26,54" stroke-width="4"/>
    <rect x="-10" y="8" width="20" height="14" ${FILL}/>
    <path d="M-10,8 L0,16 L10,8" stroke-width="1.2"/>
    <g>${motion ? `<animateMotion dur="2.4s" repeatCount="indefinite" path="M0,0 C64,0 64,-60 0,-60 C-64,-60 -64,0 0,0"/>` : ""}
      <g>${spin("0;360", "0.5s")}<path d="M-14,4 L0,-10 L14,4 L10,8 L0,-2 L-10,8 Z" fill="${GOLD}" fill-opacity=".6" stroke="${GOLD}"/></g>
    </g>`,

  dominoes: () => {
    const tiles = Array.from({ length: 5 }, (_, i) => {
      const x = -44 + i * 22, start = 0.1 + i * 0.1, angle = i === 4 ? 80 : 22;
      return `<g transform="translate(${x + 8},50)"><g>${spin(`0;0;${angle};${angle};0`, "4s", `keyTimes="0;${start.toFixed(2)};${(start + 0.08).toFixed(2)};0.9;1"`)}
        <rect x="-8" y="-48" width="8" height="48" rx="1.5" ${FILL2}/>
        <path d="M-8,-24 L0,-24" stroke-width="1"/>
        <circle cx="-4" cy="-36" r="1.4" fill="${LINE}" stroke="none"/><circle cx="-4" cy="-12" r="1.4" fill="${LINE}" stroke="none"/>
      </g></g>`;
    }).join("");
    return `
    <path d="M-60,-30 L-46,-4" stroke-width="3"/>
    <circle cx="-50" cy="-14" r="5" fill="${GOLD}" stroke="none"/>
    <path d="M-58,52 L60,52" stroke-width="3"/>
    ${tiles}
    ${star(52, -36, 7)}`;
  },
};

// Vertical offsets for each machine shape, as a function of position t (0 = first part, 1 = last).
// Kept within about ±35 so labels above and below never collide with the parts.
const LAYOUTS = {
  line: () => 0,
  zigzag: (t, i) => (i % 2 ? 32 : -26),
  valley: (t) => -26 + 58 * (1 - Math.abs(2 * t - 1)),
  hill: (t) => 30 - 56 * (1 - Math.abs(2 * t - 1)),
  stairsDown: (t) => -26 + 58 * t,
  stairsUp: (t) => 32 - 58 * t,
};

// Where a part's base sits, for parts that stop short of the usual y = 54.
const BASES = {
  hopper: 42, magnet: 46, scanner: 48, gears: 46, sorter: 44, "gift-wrapper": 44, bell: 30, rocket: 32, stamp: 50,
  sleigh: 32, snowplow: 46, "cookie-cutter": 44, typewriter: 42, "piggy-bank": 50, "tag-gun": 40, toaster: 50,
};

const IDLE = ["bp-idle-bounce", "bp-idle-wobble", "bp-idle-chug", "bp-idle-jitter"];
const FITTINGS = ["", "", "gauge", "valve", "light", "steam"];

function fitting(kind) {
  switch (kind) {
    case "gauge":
      return `<path d="M0,0 L0,-8" stroke-width="2"/><circle cy="-17" r="9" ${FILL2}/>
        <g transform="translate(0,-17)"><g>${spin("-60;40;-10;55;-60", "3s")}<path d="M0,0 L0,-6" stroke="${GOLD}" stroke-width="2"/></g></g>`;
    case "valve":
      return `<path d="M0,0 L0,-8" stroke-width="2"/>
        <g transform="translate(0,-15)"><g>${spin("0;360", "4s")}<circle r="7"/><path d="M-7,0 L7,0 M0,-7 L0,7" stroke-width="1.4"/></g></g>`;
    case "light":
      return `<path d="M0,0 L0,-12" stroke-width="2"/><circle cy="-17" r="5" fill="${CORAL}" stroke="none" class="bp-beacon"/>`;
    case "steam":
      return `<path d="M-3,0 L-3,-10 L3,-10 L3,0" stroke-width="2"/><g class="bp-rise"><circle cy="-18" r="4"/><circle cx="4" cy="-27" r="3"/></g>`;
    default:
      return "";
  }
}

function seedOf(wish) {
  const key = `${wish.id ?? ""}#${wish.number ?? ""}#${wish.blueprint?.machineName ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small seeded random number generator (mulberry32). */
function random(seed) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wrapText(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if ((cur + " " + w).trim().length > max && cur) lines.push(w);
    else lines[lines.length - 1] = (cur + " " + w).trim();
  }
  return lines;
}

/**
 * @param wish   object with id, number and blueprint { machineName, tagline, modules[], fineprint }
 * @param opts   { company, animate }
 */
export function renderBlueprint(wish, { company = "IntelliTect", animate = true } = {}) {
  const id = `bp${++uid}`;
  motion = animate && !prefersReducedMotion();
  const bp = wish.blueprint;
  const rand = random(seedOf(wish));
  const modules = (bp.modules || []).filter((m) => PARTS[m.kind]).slice(0, 5);
  const n = modules.length;
  const cy = 312;

  // Lay the parts out along this wish's machine shape. Fewer parts get drawn bigger.
  const shape = LAYOUTS[pick(rand, Object.keys(LAYOUTS))];
  const base = n <= 3 ? 1.12 : n === 4 ? 1.05 : 1;
  const spacing = (868 - 92) / Math.max(n, 1);
  const slots = modules.map((m, i) => ({
    m, i,
    x: 92 + spacing * (i + 0.5),
    y: cy + Math.round(shape(n > 1 ? i / (n - 1) : 0.5, i) * (n <= 3 ? 0.7 : 1)),
    s: base,
  }));
  // The star of the show is drawn a little bigger, if it sits low enough to have room above.
  const roomy = slots.filter((p) => p.y >= cy && p.y <= cy + 20);
  if (roomy.length) pick(rand, roomy).s = +(base * 1.12).toFixed(3);

  const pipeY = (p) => p.y + 22 * p.s;
  // The floor sits just under the lowest parts; anything raised (or short) stands on a little platform.
  const ground = Math.min(438, Math.max(cy + 54, ...slots.map((p) => p.y + 54 * p.s)) + 4);
  const yIn = slots.length ? pipeY(slots[0]) : cy + 22;
  const yOut = slots.length ? pipeY(slots[slots.length - 1]) : cy + 22;

  const stands = slots.map((p) => {
    const top = p.y + (BASES[p.m.kind] ?? 54) * p.s + 2;
    if (ground - top < 12) return "";
    const w = 34 * p.s, leg = 26 * p.s;
    return `<rect x="${(p.x - w).toFixed(1)}" y="${top.toFixed(1)}" width="${(w * 2).toFixed(1)}" height="6" ${FILL2} stroke-width="1.6"/>
      <path d="M${(p.x - leg).toFixed(1)},${(top + 6).toFixed(1)} L${(p.x - leg).toFixed(1)},${ground} M${(p.x + leg).toFixed(1)},${(top + 6).toFixed(1)} L${(p.x + leg).toFixed(1)},${ground} M${(p.x - leg).toFixed(1)},${(top + 6).toFixed(1)} L${(p.x + leg).toFixed(1)},${ground}" stroke-width="1.6" stroke-opacity=".7"/>`;
  }).join("");

  // Pipes between parts, bending where the parts sit at different heights, with the odd gauge or valve on top.
  const pipes = slots.slice(0, -1).map((p, i) => {
    const q = slots[i + 1];
    const x1 = p.x + 50 * p.s, x2 = q.x - 50 * q.s, y1 = pipeY(p), y2 = pipeY(q);
    if (x2 <= x1 + 4) return "";
    const mx = (x1 + x2) / 2;
    const d = Math.abs(y2 - y1) < 3
      ? `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y1.toFixed(1)}`
      : `M${x1.toFixed(1)},${y1.toFixed(1)} L${mx.toFixed(1)},${y1.toFixed(1)} L${mx.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`;
    const fit = x2 - x1 >= 26 ? fitting(pick(rand, FITTINGS)) : "";
    return `<path d="${d}" stroke-width="12" stroke-opacity=".18"/>
      <path class="bp-flow" d="${d}" stroke-dasharray="6 6" stroke="${GOLD}"/>
      ${fit ? `<g transform="translate(${mx.toFixed(1)},${(Math.min(y1, y2) - 6).toFixed(1)})">${fit}</g>` : ""}`;
  }).join("");

  // Busywork papers travel through the machine and come out the other end as gold stars.
  let route = `M34,${yIn.toFixed(1)}`;
  let prevY = yIn, prevX = 34;
  for (const p of slots) {
    const y = pipeY(p);
    if (Math.abs(y - prevY) >= 3) {
      const mx = ((prevX + p.x) / 2).toFixed(1);
      route += ` L${mx},${prevY.toFixed(1)} L${mx},${y.toFixed(1)}`;
    }
    route += ` L${p.x.toFixed(1)},${y.toFixed(1)}`;
    prevX = p.x; prevY = y;
  }
  route += ` L926,${yOut.toFixed(1)}`;
  const travellers = motion && slots.length
    ? [0, 1, 2].map((k) => {
      const timing = `dur="9s" begin="${-k * 3}s" repeatCount="indefinite"`;
      return `<g>
        <animateMotion path="${route}" ${timing}/>
        <g opacity="0"><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.04;0.46;0.52;1" ${timing}/>
          <rect x="-6" y="-8" width="12" height="15" fill="rgba(255,255,255,.35)" stroke-width="1.3"/>
          <path d="M-3,-3 L3,-3 M-3,1 L3,1" stroke-width="1"/></g>
        <g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.46;0.52;0.96;1" ${timing}/>
          <path d="M0,-7 L2,-2 L7,-2 L3,1 L5,6 L0,3 L-5,6 L-3,1 L-7,-2 L-2,-2 Z" fill="${GOLD}" stroke="none"/></g>
      </g>`;
    }).join("")
    : "";

  // Each part gets its own idle motion, out of step with its neighbours.
  const parts = slots.map((p) => `<g class="bp-part" transform="translate(${p.x.toFixed(1)},${p.y}) scale(${p.s})">
      <g class="${pick(rand, IDLE)}" style="animation-delay:${(-rand() * 3).toFixed(2)}s">${PARTS[p.m.kind]()}</g>
    </g>`).join("");

  const callouts = slots.map((p) => {
    const above = p.i % 2 === 0;
    const label = p.m.label || p.m.kind;
    const size = label.length > 20 ? 17 : 20;
    const lx = Math.min(Math.max(p.x, 140), 820);
    const ty = above ? 176 : 466;
    const y1 = above ? 186 : 436;
    const y2 = above ? p.y - 70 * p.s : p.y + 64 * p.s;
    return `
      <path d="M${lx.toFixed(1)},${y1} L${p.x.toFixed(1)},${y2.toFixed(1)}" stroke-width="1.4" stroke-dasharray="3 4"/>
      <circle cx="${p.x.toFixed(1)}" cy="${y2.toFixed(1)}" r="3.5" fill="${GOLD}" stroke="none"/>
      <text x="${lx.toFixed(1)}" y="${ty}" text-anchor="middle" font-size="${size}" fill="${LINE}" stroke="none">${esc(label)}</text>
      <path d="M${(lx - label.length * size * 0.26).toFixed(1)},${ty + 6} L${(lx + label.length * size * 0.26).toFixed(1)},${ty + 6}" stroke-width="1.2" stroke-opacity=".6"/>`;
  }).join("");

  const name = bp.machineName || "The Elf Machine";
  const titleSize = Math.max(26, Math.min(44, 600 / (name.length * 0.5)));
  const drawingNo = `SW-${String(wish.number ?? 0).padStart(4, "0")}`;
  const fine = wrapText(bp.fineprint || "", 62).slice(0, 2);

  return `
<svg class="${animate ? "animate" : ""}" viewBox="0 0 960 600" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="${esc(`Blueprint for ${name}: ${modules.map((m) => m.label).join(", ")}`)}"
     font-family="'Architects Daughter', 'Segoe Print', cursive">
  <defs>
    <pattern id="${id}-minor" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M20,0 L0,0 L0,20" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1"/>
    </pattern>
    <pattern id="${id}-major" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#${id}-minor)"/>
      <path d="M100,0 L0,0 L0,100" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1"/>
    </pattern>
    <radialGradient id="${id}-glow" cx="50%" cy="45%" r="70%">
      <stop offset="0" stop-color="#2463a8"/><stop offset="1" stop-color="#153f72"/>
    </radialGradient>
  </defs>
  <rect width="960" height="600" fill="url(#${id}-glow)"/>
  <rect width="960" height="600" fill="url(#${id}-major)"/>
  <g fill="none" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="16" y="16" width="928" height="568" stroke-opacity=".55" stroke-width="2"/>
    <rect x="24" y="24" width="912" height="552" stroke-opacity=".3" stroke-width="1"/>

    <text x="52" y="84" font-size="${titleSize.toFixed(0)}" fill="${LINE}" stroke="none">${esc(name)}</text>
    <text x="54" y="120" font-size="20" fill="${LINE}" fill-opacity=".8" stroke="none">${esc(bp.tagline || "")}</text>

    <g transform="translate(862,92) rotate(-12)" stroke="${CORAL}" stroke-opacity=".9">
      <circle r="52" stroke-width="3"/>
      <circle r="44" stroke-width="1.4"/>
      <text y="-14" text-anchor="middle" font-size="14" fill="${CORAL}" stroke="none">WISH</text>
      <text y="16" text-anchor="middle" font-size="30" fill="${CORAL}" stroke="none">#${esc(wish.number ?? "")}</text>
      <text y="32" text-anchor="middle" font-size="9" fill="${CORAL}" stroke="none">✓ ✓</text>
    </g>

    <path d="M30,${yIn} L64,${yIn}" stroke-width="2"/><path d="M56,${yIn - 7} L66,${yIn} L56,${yIn + 7}" stroke-width="2"/>
    <text x="46" y="${yIn - 20}" text-anchor="middle" font-size="12" fill="${LINE}" stroke="none" fill-opacity=".8">BUSY</text>
    <text x="46" y="${yIn - 8}" text-anchor="middle" font-size="12" fill="${LINE}" stroke="none" fill-opacity=".8">WORK</text>
    <path d="M896,${yOut} L930,${yOut}" stroke-width="2"/><path d="M922,${yOut - 7} L932,${yOut} L922,${yOut + 7}" stroke-width="2"/>
    <text x="912" y="${yOut - 20}" text-anchor="middle" font-size="12" fill="${GOLD}" stroke="none">FREE</text>
    <text x="912" y="${yOut - 8}" text-anchor="middle" font-size="12" fill="${GOLD}" stroke="none">TIME</text>

    <path d="M70,${ground} L890,${ground}" stroke-width="2" stroke-opacity=".7"/>
    <path d="${Array.from({ length: 41 }, (_, i) => `M${74 + i * 20},${ground} l-8,8`).join(" ")}" stroke-width="1" stroke-opacity=".35"/>
    ${stands}
    ${pipes}
    ${travellers}
    ${parts}
    ${callouts}

    <g stroke-width="1.3" stroke-opacity=".75">
      <path d="M92,494 L868,494 M92,486 L92,502 M868,486 L868,502 M100,489 L92,494 L100,499 M860,489 L868,494 L860,499"/>
      <rect x="400" y="482" width="160" height="24" fill="#1a4c88" stroke="none"/>
      <text x="480" y="499" text-anchor="middle" font-size="14" fill="${LINE}" stroke="none">1 SLEIGH-LENGTH</text>
    </g>

    <rect x="40" y="516" width="560" height="${fine.length > 1 ? 52 : 36}" rx="4" stroke-width="1.4" stroke-dasharray="6 5" stroke="${GOLD}"/>
    <text x="56" y="539" font-size="15" fill="${GOLD}" stroke="none">⚠ ${esc(fine[0] || "")}</text>
    ${fine[1] ? `<text x="74" y="558" font-size="15" fill="${GOLD}" stroke="none">${esc(fine[1])}</text>` : ""}

    <g stroke-width="1.4">
      <rect x="624" y="512" width="312" height="64"/>
      <path d="M624,544 L936,544 M770,512 L770,576"/>
      <g fill="${LINE}" stroke="none" font-size="9" fill-opacity=".65">
        <text x="632" y="524">DWG NO.</text><text x="778" y="524">SCALE</text>
        <text x="632" y="556">DRAWN BY</text><text x="778" y="556">WORKSHOP</text>
      </g>
      <g fill="${LINE}" stroke="none" font-size="14">
        <text x="632" y="539">${drawingNo}</text><text x="778" y="539">1 : NORTH POLE</text>
        <text x="632" y="571">SANTA'S AI ELF</text><text x="778" y="571">${esc(company.toUpperCase())}</text>
      </g>
    </g>
  </g>
</svg>`;
}
