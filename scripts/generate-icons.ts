import { writeFile } from "node:fs/promises";

import sharp from "sharp";

const OUT = new URL("../public/", import.meta.url).pathname;

const CANVAS = 512;
const BLACK = "#100f0f";
const PAPER = "#fffcf0";
const CORNER = 0.22;

const PAD = 90;

const ARCH = 130;
const STROKE = 64;
const RADIUS = ARCH / 2;
const STEM = 65;

const BASELINE = 340;
const X = [STROKE / 2, STROKE / 2 + ARCH, STROKE / 2 + 2 * ARCH];

// Stems use butt caps, so a letter's ink stops on the baseline rather than half a
// stroke past it: its height is the stem plus the shoulder's radius plus the cap.
const LETTER = STEM + RADIUS + STROKE / 2;
const TOP = BASELINE - LETTER;
const SHOULDER = BASELINE - STEM;

// m only — left/right ink edges are half a stroke outside the outer stem centers.
const WIDTH = X[2] + STROKE / 2 - (X[0] - STROKE / 2);

const CONTENT = CANVAS - 2 * PAD;
const FIT = CONTENT / WIDTH;
// Stretch the stem butts to the bottom padding; arches stay at the natural shoulder.
const BOTTOM = TOP + WIDTH;

// A maskable icon must survive a circular crop at 80% of the canvas, so the mark's
// diagonal — not its box — is what has to fit.
const SAFE = (0.8 * CANVAS) / Math.hypot(WIDTH, BOTTOM - TOP);

function icon(scale: number, bleed: boolean) {
  const tx = (CANVAS - WIDTH * scale) / 2 - (X[0] - STROKE / 2) * scale;
  // Pin the letter top to the padding instead of vertically centering.
  const ty = PAD - TOP * scale;
  // Third stem bleeds past the canvas bottom so the butt clips flush.
  const floor = (CANVAS + STROKE - ty) / scale;
  const corner = bleed ? 0 : CANVAS * CORNER;

  const arch = (x: number, rightBottom: number) =>
    `M${x},${BOTTOM.toFixed(3)}V${SHOULDER}A${RADIUS},${RADIUS} 0 0 1 ${x + ARCH},${SHOULDER}V${rightBottom.toFixed(3)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" rx="${corner}" fill="${BLACK}"/>
  <g transform="translate(${tx.toFixed(3)},${ty.toFixed(3)}) scale(${scale.toFixed(5)})">
    <path d="${arch(X[0], BOTTOM)} ${arch(X[1], floor)}" fill="none" stroke="${PAPER}" stroke-width="${STROKE}" stroke-linecap="butt" stroke-linejoin="round"/>
  </g>
</svg>
`;
}

const rounded = Buffer.from(icon(FIT, false));
const square = Buffer.from(icon(FIT, true));
const maskable = Buffer.from(icon(Math.min(FIT, SAFE), true));

const png = async (svg: Buffer, size: number) => sharp(svg).resize(size, size).png().toBuffer();

await writeFile(`${OUT}icon.svg`, icon(FIT, false));
await writeFile(`${OUT}icon-192.png`, await png(rounded, 192));
await writeFile(`${OUT}icon-512.png`, await png(rounded, 512));
await writeFile(`${OUT}icon-maskable-512.png`, await png(maskable, 512));
await writeFile(`${OUT}apple-touch-icon.png`, await png(square, 180));

// oxlint-disable-next-line no-console
console.log(
  `stem ${(BOTTOM - SHOULDER).toFixed(2)}  height ${(BOTTOM - TOP).toFixed(2)}  padding ${PAD}px`,
);
