// Draws an elf machine as a blueprint-style SVG from the parts Claude picked.
// Module kinds must match Catalog.Modules in Models/Catalog.cs.

import { esc } from "./common.js";

const LINE = "#eaf3ff";
const GOLD = "#ffd27a";
const CORAL = "#ff9aa8";
const FILL = 'fill="rgba(255,255,255,.08)"';
const FILL2 = 'fill="rgba(255,255,255,.18)"';

let uid = 0;

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

// Each part is drawn around (0,0) inside roughly a 120 × 120 box.
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
    <path class="bp-flicker" d="M-38,-14 L18,-14" stroke="${GOLD}" stroke-width="2"/>
    <path d="M15,15 L46,46" stroke-width="11"/>
    <path d="M15,15 L46,46" stroke-width="5" stroke="#1d5596"/>`,

  brain: () => `
    <circle cx="0" cy="-10" r="42" ${FILL}/>
    <path d="M-36,28 L36,28 L30,52 L-30,52 Z" ${FILL2}/>
    <path d="M-16,-4 C-27,-6 -27,-22 -14,-24 C-12,-35 2,-37 6,-29 C16,-35 29,-24 22,-14 C31,-8 25,7 14,4 C12,13 -2,13 -4,4 C-10,9 -19,4 -16,-4 Z" stroke="${GOLD}"/>
    <path d="M1,-29 C-5,-18 5,-12 0,1 M-14,-24 C-8,-18 -14,-12 -8,-8 M14,-26 C9,-18 18,-12 12,-6" stroke="${GOLD}" stroke-width="1.6"/>
    <g class="bp-bob" fill="${LINE}" stroke="none">
      <circle cx="-26" cy="-30" r="2"/><circle cx="24" cy="-36" r="1.8"/><circle cx="30" cy="8" r="2"/>
      <circle cx="-30" cy="10" r="1.6"/><circle cx="-4" cy="-44" r="1.6"/><circle cx="10" cy="18" r="1.6"/>
    </g>
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
    <g class="bp-bob">
      <path d="M0,30 L-18,-8 L24,-34" stroke-width="11" stroke-opacity=".25"/>
      <path d="M0,30 L-18,-8 L24,-34"/>
      <circle cx="-18" cy="-8" r="7" ${FILL2}/>
      <circle cx="24" cy="-34" r="5" ${FILL2}/>
      <path d="M27,-37 L40,-44 L45,-36 M28,-31 L38,-22 L46,-27" stroke="${GOLD}"/>
    </g>`,

  conveyor: () => `
    <rect x="-40" y="-20" width="24" height="24" ${FILL2}/>
    <rect x="6" y="-28" width="30" height="32" ${FILL2}/>
    <path d="M21,-28 L21,4 M6,-12 L36,-12" stroke="${CORAL}" stroke-width="2"/>
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
    <path d="M-34,-8 A34,10 0 0 0 34,-8" stroke="${GOLD}" stroke-dasharray="5 4"/>
    <circle cx="0" cy="14" r="11" ${FILL}/>
    <path d="M0,14 L6,6" stroke="${GOLD}"/>
    <path d="M-26,42 L-30,56 M26,42 L30,56"/>
    <g class="bp-rise"><circle cx="-12" cy="-50" r="3"/><circle cx="8" cy="-56" r="2.2"/><circle cx="-2" cy="-62" r="1.8"/></g>`,

  bell: () => `
    <circle cx="0" cy="-42" r="6"/>
    <path d="M0,-36 C-14,-50 -30,-44 -26,-32 C-16,-36 -8,-34 0,-36 Z M0,-36 C14,-50 30,-44 26,-32 C16,-36 8,-34 0,-36 Z" ${FILL2}/>
    <circle cx="0" cy="-2" r="32" ${FILL}/>
    <path d="M-24,8 C-10,1 10,1 24,8"/>
    <circle cx="0" cy="18" r="4" fill="${LINE}" stroke="none"/>
    <g class="bp-flicker" stroke="${GOLD}">
      <path d="M-42,-18 C-50,-6 -50,8 -42,20 M42,-18 C50,-6 50,8 42,20"/>
      <path d="M-52,-26 C-62,-8 -62,14 -52,30 M52,-26 C62,-8 62,14 52,30" stroke-opacity=".6"/>
    </g>`,

  antenna: () => `
    <rect x="-26" y="34" width="52" height="16" rx="3" ${FILL2}/>
    <path d="M-4,34 L-4,-22 A16,16 0 0 1 28,-22 L28,-12" stroke-width="10"/>
    <path d="M-4,34 L-4,-22 A16,16 0 0 1 28,-22 L28,-12" stroke-width="10" stroke="${CORAL}" stroke-dasharray="6 7"/>
    <g class="bp-flicker" stroke="${GOLD}">
      <path d="M-20,-38 A26,26 0 0 1 4,-56"/>
      <path d="M-30,-44 A38,38 0 0 1 2,-68" stroke-opacity=".6"/>
    </g>`,

  printer: () => `
    <rect x="-26" y="-52" width="52" height="32" ${FILL}/>
    <path d="M-16,-42 L16,-42 M-16,-34 L10,-34" stroke-width="1.5"/>
    <rect x="-46" y="-22" width="92" height="40" rx="6" ${FILL2}/>
    <path d="M-30,4 L30,4" stroke-width="3"/>
    <circle cx="34" cy="-10" r="3" fill="${GOLD}" stroke="none"/>
    <circle cx="24" cy="-10" r="3" fill="${LINE}" stroke="none"/>
    <g class="bp-bob">
      <path d="M-28,10 L28,10 L32,50 L-24,50 Z" ${FILL}/>
      <path d="M-12,40 L-12,32 M-2,40 L-2,24 M8,40 L8,28 M18,40 L18,20" stroke="${GOLD}" stroke-width="4"/>
    </g>`,

  "gift-wrapper": () => `
    <rect x="-36" y="-6" width="72" height="50" rx="3" ${FILL}/>
    <rect x="-40" y="-20" width="80" height="14" rx="3" ${FILL2}/>
    <path d="M0,-20 L0,44" stroke="${CORAL}" stroke-width="6"/>
    <path d="M0,-20 C-10,-44 -36,-40 -22,-22 Z M0,-20 C10,-44 36,-40 22,-22 Z" ${FILL2}/>
    ${star(44, -34, 6)}${star(-46, -28, 5)}`,

  chimney: () => `
    <g class="bp-rise"><circle cx="-6" cy="-38" r="7"/><circle cx="8" cy="-50" r="9"/><circle cx="-4" cy="-64" r="6"/></g>
    <rect x="-30" y="-26" width="60" height="12" ${FILL2}/>
    <rect x="-24" y="-14" width="48" height="64" ${FILL}/>
    <path d="M-24,2 L24,2 M-24,18 L24,18 M-24,34 L24,34 M0,-14 L0,2 M-12,2 L-12,18 M12,2 L12,18 M0,18 L0,34 M-12,34 L-12,50 M12,34 L12,50" stroke-width="1.5" stroke-opacity=".7"/>`,

  rocket: () => `
    <path d="M-36,-14 L22,-14 C40,-14 54,-4 58,0 C54,4 40,14 22,14 L-36,14 Z" ${FILL}/>
    <circle cx="16" cy="0" r="6" ${FILL2}/>
    <path d="M-28,-14 L-44,-32 L-12,-14 M-28,14 L-44,32 L-12,14" ${FILL2}/>
    <rect x="-44" y="-9" width="8" height="18" ${FILL2}/>
    <path class="bp-flicker" d="M-44,-7 L-60,-4 L-53,0 L-62,4 L-44,7" stroke="${GOLD}"/>
    <path d="M-60,-24 L-48,-24 M-64,24 L-50,24" stroke-opacity=".5"/>`,
};

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
 * @param wish   object with number and blueprint { machineName, tagline, modules[], fineprint }
 * @param opts   { company, animate }
 */
export function renderBlueprint(wish, { company = "IntelliTect", animate = true } = {}) {
  const id = `bp${++uid}`;
  const bp = wish.blueprint;
  const modules = (bp.modules || []).filter((m) => PARTS[m.kind]).slice(0, 5);
  const n = Math.max(modules.length, 1);
  const left = 92, right = 868, cy = 312;
  const spacing = (right - left) / n;
  const centers = modules.map((_, i) => left + spacing * (i + 0.5));

  const name = bp.machineName || "The Elf Machine";
  const titleSize = Math.max(26, Math.min(44, 600 / (name.length * 0.5)));
  const drawingNo = `SW-${String(wish.number ?? 0).padStart(4, "0")}`;

  const pipes = centers.slice(0, -1).map((x, i) => {
    const x1 = x + 50, x2 = centers[i + 1] - 50;
    return x2 > x1
      ? `<path d="M${x1},${cy + 22} L${x2},${cy + 22}" stroke-width="12" stroke-opacity=".18"/>
         <path class="bp-flow" d="M${x1},${cy + 22} L${x2},${cy + 22}" stroke-dasharray="6 6" stroke="${GOLD}"/>`
      : "";
  }).join("");

  const parts = modules.map((m, i) => `<g transform="translate(${centers[i].toFixed(1)},${cy})">${PARTS[m.kind]()}</g>`).join("");

  const callouts = modules.map((m, i) => {
    const x = centers[i];
    const above = i % 2 === 0;
    const label = m.label || m.kind;
    const size = label.length > 20 ? 17 : 20;
    const lx = Math.min(Math.max(x, 140), 820);
    const ty = above ? 176 : 466;
    const y1 = above ? 186 : 436;
    const y2 = above ? cy - 70 : cy + 64;
    return `
      <path d="M${lx},${y1} L${x},${y2}" stroke-width="1.4" stroke-dasharray="3 4"/>
      <circle cx="${x}" cy="${y2}" r="3.5" fill="${GOLD}" stroke="none"/>
      <text x="${lx}" y="${ty}" text-anchor="middle" font-size="${size}" fill="${LINE}" stroke="none">${esc(label)}</text>
      <path d="M${lx - label.length * size * 0.26},${ty + 6} L${lx + label.length * size * 0.26},${ty + 6}" stroke-width="1.2" stroke-opacity=".6"/>`;
  }).join("");

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

    <path d="M30,${cy + 22} L64,${cy + 22}" stroke-width="2"/><path d="M56,${cy + 15} L66,${cy + 22} L56,${cy + 29}" stroke-width="2"/>
    <text x="46" y="${cy + 2}" text-anchor="middle" font-size="12" fill="${LINE}" stroke="none" fill-opacity=".8">BUSY</text>
    <text x="46" y="${cy + 14}" text-anchor="middle" font-size="12" fill="${LINE}" stroke="none" fill-opacity=".8">WORK</text>
    <path d="M896,${cy + 22} L930,${cy + 22}" stroke-width="2"/><path d="M922,${cy + 15} L932,${cy + 22} L922,${cy + 29}" stroke-width="2"/>
    <text x="912" y="${cy + 2}" text-anchor="middle" font-size="12" fill="${GOLD}" stroke="none">FREE</text>
    <text x="912" y="${cy + 14}" text-anchor="middle" font-size="12" fill="${GOLD}" stroke="none">TIME</text>

    ${pipes}
    <path d="M70,${cy + 82} L890,${cy + 82}" stroke-width="2" stroke-opacity=".7"/>
    <path d="${Array.from({ length: 41 }, (_, i) => `M${74 + i * 20},${cy + 82} l-10,10`).join(" ")}" stroke-width="1" stroke-opacity=".35"/>
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
