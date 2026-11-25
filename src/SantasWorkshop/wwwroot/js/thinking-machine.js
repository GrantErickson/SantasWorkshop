// The Elf-o-Tron 9000: the North Pole thinking machine on the kiosk's "elves are on it" screen, drawn in the
// blueprint's line style. Letters ride the belt in, a neural network on its screen passes signals layer by layer,
// the lights blink, the tape reels whirr, the cheer gauge swings and rolled-up plans ride out the other side.
// All the motion is CSS (the .tm-* rules in kiosk.css); each call scatters the lights and signals differently.

const LINE = "#eaf3ff";
const FROST = "#c9d8ea";
const GOLD = "#ffd27a";
const BERRY = "#e8384f";
const PINE = "#2e9e68";
const ICE = "#8fd3ff";
const PAPER = "#fffdf8";
const BLUEPRINT = "#1d5596";
const FILL = "rgba(255,255,255,.07)";
const FONT = "'Architects Daughter', 'Segoe Print', cursive";

// Neural network on the screen: nodes per layer, their x positions and spacing. A signal takes HOP seconds to cross
// from one layer to the next (27% of the 3.2 s cycle in kiosk.css).
const LAYERS = [3, 5, 5, 2];
const LAYER_X = [180, 220, 260, 300];
const LAYER_GAP = [22, 15, 15, 26];
const NET_Y = 139;
const HOP = 0.86;

let uid = 0;
const r1 = (n) => Math.round(n * 10) / 10;
const between = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const delayed = (s) => `style="animation-delay:${s.toFixed(2)}s"`;

function network() {
  const nodes = LAYERS.map((n, l) => Array.from({ length: n }, (_, i) => [LAYER_X[l], r1(NET_Y + (i - (n - 1) / 2) * LAYER_GAP[l])]));
  let wires = "", signals = "", dots = "", flashes = "";
  for (let l = 0; l < nodes.length - 1; l++) {
    for (const [x1, y1] of nodes[l]) {
      for (const [x2, y2] of nodes[l + 1]) {
        const d = `M${x1},${y1} L${x2},${y2}`;
        wires += `<path d="${d}"/>`;
        // Not every connection fires on every pass, so each wish's network "thinks" a little differently.
        if (Math.random() < 0.55) signals += `<path class="tm-sig" pathLength="1" d="${d}" ${delayed(l * HOP + between(0, 0.1))}/>`;
      }
    }
  }
  nodes.forEach((layer, l) => {
    const r = l === nodes.length - 1 ? 5 : 3.6;
    for (const [x, y] of layer) {
      dots += `<circle cx="${x}" cy="${y}" r="${r}"/>`;
      flashes += `<circle class="tm-flash" cx="${x}" cy="${y}" r="${r + 0.6}" ${delayed(l * HOP + (l === 0 ? between(0, 0.1) : 0.04))}/>`;
    }
  });
  return `<g fill="none" stroke="${LINE}" stroke-opacity=".16" stroke-width="1">${wires}</g>
      <g fill="none" stroke="${GOLD}" stroke-width="1.9" stroke-linecap="round">${signals}</g>
      <g fill="#0d2a4a" stroke="${FROST}" stroke-width="1.3">${dots}</g>
      <g fill="${GOLD}" stroke="none">${flashes}</g>`;
}

function lamps() {
  let out = "";
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 12; i++) {
      const timing = `animation-duration:${between(0.35, 1.7).toFixed(2)}s;animation-delay:-${between(0, 1.7).toFixed(2)}s`;
      out += `<circle cx="${r1(170 + i * 12.73)}" cy="${row ? 216 : 202}" r="3.8" fill="${pick([GOLD, GOLD, BERRY, PINE, ICE, FROST])}" style="${timing}"/>`;
    }
  }
  return out;
}

function tube(x) {
  const glow = `animation-duration:${between(0.9, 1.6).toFixed(2)}s;animation-delay:-${between(0, 1.6).toFixed(2)}s`;
  return `<ellipse class="tm-glow" cx="${x}" cy="62" rx="5" ry="8" fill="${GOLD}" stroke="none" style="${glow}"/>
      <path d="M${x - 7},72 V54 a7,7 0 0 1 14,0 V72" fill="rgba(255,255,255,.05)"/>
      <path d="M${x - 3},71 v-9 l3,-4 l3,4 v9" fill="none" stroke="${GOLD}" stroke-width="1.2"/>
      <rect x="${x - 9}" y="71" width="18" height="9" rx="2"/>`;
}

function reel(x, y, reverse, seconds) {
  const holes = [0, 120, 240].map((a) => {
    const rad = (a * Math.PI) / 180;
    return `<circle cx="${r1(Math.cos(rad) * 9.5)}" cy="${r1(Math.sin(rad) * 9.5)}" r="3.4" fill="#061426"/>`;
  }).join("");
  return `<g transform="translate(${x},${y})"><g class="tm-reel${reverse ? " rev" : ""}" style="animation-duration:${seconds}s">
      <circle r="17"/><circle r="13" fill="rgba(201,216,234,.2)" stroke="none"/>${holes}<circle r="3.5" fill="${LINE}" stroke="none"/>
    </g></g>`;
}

function star(r = 9) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const len = i % 2 ? r * 0.45 : r;
    points.push(`${r1(Math.cos(a) * len)},${r1(Math.sin(a) * len)}`);
  }
  return `<path d="M${points.join(" L")} Z"/>`;
}

const envelope = (extra) => `<g class="tm-env${extra}">
      <rect x="-13" y="-17" width="26" height="17" rx="2" fill="${PAPER}" stroke="${LINE}" stroke-width="1.4"/>
      <path d="M-13,-17 L0,-7 L13,-17" fill="none" stroke="#7d9bc2" stroke-width="1.4"/>
      <circle cy="-7" r="2.6" fill="${BERRY}" stroke="none"/>
    </g>`;

// A rolled-up blueprint tied with a gold ribbon, resting on the belt at y = 0.
const plan = (extra) => `<g class="tm-plan${extra}">
      <rect x="-15" y="-12" width="30" height="12" rx="6" fill="${BLUEPRINT}" stroke="${LINE}" stroke-width="1.4"/>
      <ellipse cx="-9" cy="-6" rx="3" ry="6" fill="none" stroke="${LINE}" stroke-width="1.2"/>
      <path d="M-4,-9 H11 M-4,-4 H8" fill="none" stroke="${LINE}" stroke-width="1" stroke-opacity=".6"/>
      <rect x="1.5" y="-12" width="4" height="12" fill="${GOLD}" stroke="none"/>
      <path d="M3.5,-12 q-6,-6 -6,-1 q0,3 6,1 q6,2 6,-1 q0,-5 -6,1" fill="${GOLD}" stroke="${GOLD}" stroke-width="1"/>
    </g>`;

const belt = (x) => `<path d="M${x + 12},220 L${x + 7},262 M${x + 60},220 L${x + 65},262" fill="none" stroke-width="2"/>
    <rect x="${x}" y="208" width="72" height="12" rx="6"/>
    <g stroke-width="1.6">${[10, 24, 38, 52, 64].map((dx) =>
      `<g transform="translate(${x + dx},214)"><g class="tm-roll"><circle r="4"/><path d="M-4,0 H4"/></g></g>`).join("")}</g>`;

/** The machine as an SVG string, ready to drop into the page. */
export function thinkingMachine() {
  const id = `tm${++uid}`;

  return `<svg class="tm animate" viewBox="0 0 480 290" aria-hidden="true">
  <defs>
    <clipPath id="${id}-screen"><rect x="158" y="96" width="164" height="86" rx="10"/></clipPath>
    <clipPath id="${id}-in"><rect x="0" y="0" width="109" height="290"/></clipPath>
    <clipPath id="${id}-out"><rect x="371" y="0" width="109" height="290"/></clipPath>
  </defs>
  <g fill="${FILL}" stroke="${LINE}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M30,262 H458" fill="none" stroke-opacity=".3"/>

    <!-- Wishes in: letters ride the belt into the slot -->
    ${belt(40)}
    <g clip-path="url(#${id}-in)"><g transform="translate(58,207)">${envelope("")}${envelope(" second")}</g></g>

    <!-- Cabinet -->
    <path d="M138,252 v8 h18 v-8 M324,252 v8 h18 v-8" fill="none"/>
    <rect x="110" y="80" width="260" height="172" rx="14"/>
    <rect x="105" y="184" width="9" height="24" rx="2" fill="#061426"/>

    <!-- On top: bell, vacuum tubes, candy-cane antenna, chimney -->
    <path d="M128,80 V54 H152 V80" fill="none" stroke-width="2"/>
    <g transform="translate(140,54)"><g class="tm-bell">
      <path d="M0,0 V5" fill="none" stroke-width="1.6"/>
      <path d="M-8,18 Q-8,5 0,5 Q8,5 8,18 Z" fill="${GOLD}" stroke-width="1.6"/>
      <circle cy="20.5" r="2.2" fill="${GOLD}" stroke="none"/>
    </g></g>
    ${tube(172)}${tube(200)}${tube(280)}${tube(308)}
    <path d="M240,72 V30" fill="none" stroke="${LINE}" stroke-width="5" stroke-linecap="butt"/>
    <path d="M240,72 V30" fill="none" stroke="${BERRY}" stroke-width="5" stroke-dasharray="4 4" stroke-linecap="butt"/>
    <path d="M228,80 a12,9 0 0 1 24,0"/>
    <g fill="none" stroke="${GOLD}" stroke-width="2">
      <path class="tm-radio" d="M253,13 a12,12 0 0 1 0,18 M227,13 a12,12 0 0 0 0,18"/>
      <path class="tm-radio far" d="M259,7 a20,20 0 0 1 0,30 M221,7 a20,20 0 0 0 0,30"/>
    </g>
    <g transform="translate(240,22)"><g class="tm-star" fill="${GOLD}" stroke="${GOLD}" stroke-width="1">${star()}</g></g>
    <rect x="337" y="62" width="17" height="18"/>
    <rect x="333" y="57" width="25" height="7" rx="2"/>
    <circle class="bp-rise" cx="345" cy="47" r="6" fill="rgba(255,255,255,.16)" stroke-opacity=".5" stroke-width="1.6"/>
    <circle class="bp-rise bp-rise-2" cx="349" cy="45" r="5" fill="rgba(255,255,255,.16)" stroke-opacity=".5" stroke-width="1.6"/>

    <!-- Tape reels -->
    ${reel(134, 116, false, 2.6)}${reel(134, 160, true, 3.1)}
    <path d="M147,116 V160" fill="none" stroke="${FROST}" stroke-width="2"/>

    <!-- The screen: a neural network thinking it over -->
    <rect x="158" y="96" width="164" height="86" rx="10" fill="rgba(3,18,36,.82)"/>
    <g clip-path="url(#${id}-screen)">
      ${network()}
      <rect class="tm-scan" x="158" y="92" width="164" height="7" fill="rgba(234,243,255,.07)" stroke="none"/>
    </g>

    <!-- Cheer gauge and the big lever -->
    <g transform="translate(346,114)">
      <circle r="16"/>
      <path d="M-9.6,8 A12.5,12.5 0 1 1 9.6,8" fill="none" stroke-width="1.4" stroke-opacity=".55"/>
      <path d="M11.7,-4.3 A12.5,12.5 0 0 1 9.6,8" fill="none" stroke="${BERRY}" stroke-width="2.6"/>
      <g class="tm-needle"><path d="M0,0 V-12" fill="none" stroke="${GOLD}" stroke-width="2"/></g>
      <circle r="2.2" fill="${LINE}" stroke="none"/>
    </g>
    <text x="346" y="141" text-anchor="middle" font-size="8" fill="${GOLD}" stroke="none" font-family="${FONT}">CHEER</text>
    <g transform="translate(346,184)">
      <g class="tm-lever"><path d="M0,0 V-25" fill="none" stroke-width="3"/><circle cy="-28" r="5" fill="${BERRY}" stroke-width="1.6"/></g>
      <rect x="-11" y="-4" width="22" height="11" rx="3"/>
    </g>

    <!-- Blinkenlights -->
    <rect x="158" y="190" width="164" height="36" rx="6" fill="rgba(0,0,0,.25)"/>
    <g class="tm-lamps" stroke="none">${lamps()}</g>

    <rect x="186" y="232" width="108" height="15" rx="3" fill="rgba(0,0,0,.2)" stroke-opacity=".5" stroke-width="1.4"/>
    <text x="240" y="243.5" text-anchor="middle" font-size="10" letter-spacing="1" fill="${GOLD}" stroke="none" font-family="${FONT}">ELF-O-TRON 9000</text>

    <!-- Plans out: rolled-up blueprints ride away on the other belt -->
    ${belt(368)}
    <g clip-path="url(#${id}-out)"><g transform="translate(400,207)">${plan("")}${plan(" second")}</g></g>
    <rect x="366" y="184" width="9" height="24" rx="2" fill="#061426"/>
  </g>
  <g font-family="${FONT}" font-size="9" fill="${GOLD}" text-anchor="middle" opacity=".85">
    <text x="76" y="279">WISHES IN</text><text x="404" y="279">PLANS OUT</text>
  </g>
</svg>`;
}
