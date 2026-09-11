const sharp = require('sharp');

// Hearth icon: deep cocoa field, an apricot open book with a warm ember
// "hearth glow" rising from the spine — home + learning. Reads at 60px.
const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2E211A"/>
      <stop offset="1" stop-color="#170F0B"/>
    </linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFD9BD"/>
      <stop offset="1" stop-color="#F0955B"/>
    </linearGradient>
    <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE7A8"/>
      <stop offset="1" stop-color="#E8702A"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.55">
      <stop offset="0" stop-color="#F0955B" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#F0955B" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="480" r="360" fill="url(#glow)"/>
  <!-- flame -->
  <path d="M 512 250 C 470 330 430 360 440 430 C 446 478 480 500 512 500 C 544 500 578 478 584 430 C 594 360 554 330 512 250 Z" fill="url(#flame)"/>
  <path d="M 512 350 C 494 390 480 400 484 436 C 487 460 500 470 512 470 C 524 470 537 460 540 436 C 544 400 530 390 512 350 Z" fill="#FFF3D6" opacity="0.9"/>
  <!-- open book -->
  <path d="M 172 560 C 300 500 420 510 512 560 L 512 820 C 420 770 300 760 172 820 Z" fill="url(#page)"/>
  <path d="M 852 560 C 724 500 604 510 512 560 L 512 820 C 604 770 724 760 852 820 Z" fill="url(#page)"/>
  <path d="M 172 560 C 300 500 420 510 512 560 L 512 820 C 420 770 300 760 172 820 Z" fill="none" stroke="#170F0B" stroke-opacity="0.22" stroke-width="12"/>
  <path d="M 852 560 C 724 500 604 510 512 560 L 512 820 C 604 770 724 760 852 820 Z" fill="none" stroke="#170F0B" stroke-opacity="0.22" stroke-width="12"/>
  <rect x="500" y="556" width="24" height="264" rx="8" fill="#170F0B" fill-opacity="0.35"/>
  <!-- text lines -->
  <path d="M 240 620 C 320 590 400 596 468 622" stroke="#170F0B" stroke-opacity="0.28" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M 240 690 C 320 660 400 666 468 692" stroke="#170F0B" stroke-opacity="0.28" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M 556 622 C 624 596 704 590 784 620" stroke="#170F0B" stroke-opacity="0.28" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M 556 692 C 624 666 704 660 784 690" stroke="#170F0B" stroke-opacity="0.28" stroke-width="16" stroke-linecap="round" fill="none"/>
</svg>`;

(async () => {
  const buf = Buffer.from(svg);
  await sharp(buf).resize(1024, 1024).png().toFile('../assets/icon.png');
  await sharp(buf).resize(1024, 1024).png().toFile('../assets/android-icon-foreground.png');
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#1C1512' } })
    .png().toFile('../assets/android-icon-background.png');
  await sharp(buf).resize(1024, 1024).grayscale().png().toFile('../assets/android-icon-monochrome.png');
  await sharp(buf).resize(48, 48).png().toFile('../assets/favicon.png');
  await sharp(buf).resize(512, 512).png().toFile('../assets/splash-icon.png');
  console.log('icons written');
})();
