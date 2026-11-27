// Renders the low-poly chonky running golden retriever icon + splash as PNGs for `npx capacitor-assets generate`.
// Usage: node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const G = { base: '#D99A45', light: '#F2D3A0', dark: '#B87430', deep: '#9A5E22' };

// Chonky running pup in profile, drawn in a 1024 box around (512, 520). Faceted polygons = low-poly look.
const dog = `<g transform="translate(-50 20)">
  <!-- ground shadow + speed lines -->
  <ellipse cx="540" cy="680" rx="250" ry="24" fill="#000" opacity="0.12"/>
  <polygon points="130,420 230,420 220,442 120,442" fill="#fff" opacity="0.55"/>
  <polygon points="100,490 205,490 195,512 90,512" fill="#fff" opacity="0.4"/>
  <polygon points="140,560 220,560 210,582 130,582" fill="#fff" opacity="0.3"/>
  <!-- far legs -->
  <polygon points="580,560 630,555 655,640 608,650" fill="${G.deep}"/>
  <polygon points="395,575 448,585 405,655 358,645" fill="${G.deep}"/>
  <!-- little wagging tail -->
  <polygon points="322,450 262,368 238,380 292,470" fill="${G.base}"/>
  <polygon points="322,450 262,368 280,440" fill="${G.dark}"/>
  <!-- round chonky body -->
  <polygon points="300,480 330,410 420,372 540,366 640,398 684,480 652,572 540,612 410,612 320,566" fill="${G.base}"/>
  <polygon points="330,410 420,372 540,366 640,398 490,470" fill="#E6AA58"/>
  <polygon points="300,480 330,410 490,470 320,566" fill="#CF8E3C"/>
  <polygon points="320,566 490,470 652,572 540,612 410,612" fill="${G.dark}"/>
  <polygon points="644,430 684,480 660,560 618,520" fill="${G.light}"/>
  <!-- stubby near legs -->
  <polygon points="612,540 664,526 728,600 690,628" fill="${G.base}"/>
  <polygon points="664,526 728,600 690,575" fill="#CF8E3C"/>
  <polygon points="688,612 740,598 750,630 698,642" fill="${G.light}"/>
  <polygon points="348,536 402,558 332,636 288,616" fill="${G.base}"/>
  <polygon points="348,536 288,616 318,590" fill="#CF8E3C"/>
  <polygon points="276,606 326,626 312,656 264,644" fill="${G.light}"/>
  <!-- bandana -->
  <polygon points="626,410 724,446 686,520" fill="#D9453B"/>
  <polygon points="676,428 724,446 686,520" fill="#B8352D"/>
  <!-- big round head -->
  <polygon points="608,330 640,250 720,218 802,240 846,302 850,382 804,442 720,462 640,430" fill="${G.base}"/>
  <polygon points="640,250 720,218 802,240 724,318" fill="#E6AA58"/>
  <polygon points="608,330 640,250 724,318 640,430" fill="#CF8E3C"/>
  <polygon points="802,240 846,302 850,382 724,318" fill="#E0A250"/>
  <!-- short muzzle + nose -->
  <polygon points="780,358 862,350 894,386 872,424 800,432" fill="${G.light}"/>
  <polygon points="780,358 862,350 830,392" fill="#F7E0B8"/>
  <polygon points="864,348 902,356 898,386 868,382" fill="#1d1410"/>
  <polygon points="872,354 886,356 884,366 872,364" fill="#5a4a44"/>
  <!-- big sparkly eye + blush -->
  <polygon points="742,296 788,290 794,344 748,350" fill="#2a1a10"/>
  <polygon points="752,302 770,300 771,318 753,320" fill="#fff"/>
  <polygon points="776,326 784,325 785,333 777,334" fill="#fff"/>
  <ellipse cx="752" cy="388" rx="24" ry="13" fill="#F08A9A" opacity="0.7"/>
  <!-- tongue -->
  <polygon points="818,424 848,420 846,458 826,462" fill="#E86A7E"/>
  <!-- floppy ear -->
  <polygon points="652,246 704,236 668,366 618,380 626,300" fill="${G.dark}"/>
  <polygon points="652,246 626,300 618,380" fill="${G.deep}"/>
</g>`;

const iconSvg = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg ? `<rect width="1024" height="1024" fill="#6BA368"/><circle cx="512" cy="470" r="400" fill="#7DB57A"/>` : ''}
  ${dog}
</svg>`;

// Adaptive-icon foreground: shrink the dog into the 66% safe zone.
const fgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(0.7) translate(-512 -520)">${dog}</g>
</svg>`;
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#6BA368"/><circle cx="512" cy="480" r="330" fill="#7DB57A"/></svg>`;

const splashSvg = (dark) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="${dark ? '#2B1D15' : '#FFF7EC'}"/>
  <circle cx="1366" cy="1290" r="520" fill="#6BA368"/>
  <g transform="translate(1366 1290) scale(0.82) translate(-512 -520)">${dog}</g>
  <text x="1366" y="2000" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="900" font-size="170" fill="${dark ? '#FFF7EC' : '#5B3A29'}">Dog-go</text>
</svg>`;

mkdirSync('assets', { recursive: true });
const out = async (svg, file, size) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
await out(iconSvg(true), 'assets/icon-only.png', 1024);
await out(fgSvg, 'assets/icon-foreground.png', 1024);
await out(bgSvg, 'assets/icon-background.png', 1024);
await out(splashSvg(false), 'assets/splash.png', 2732);
await out(splashSvg(true), 'assets/splash-dark.png', 2732);
// web favicon / PWA icon
await out(iconSvg(true), 'public/icon.png', 512);
writeFileSync('public/icon.svg', iconSvg(true));
console.log('icons written');
