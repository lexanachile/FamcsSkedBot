import { FISHING_RIG } from './rig.js?v=66';

export function lakeScene() {
  const { hand, tip, cast } = FISHING_RIG;
  return `<svg class="fish-scene" viewBox="0 0 450 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Портретная векторная сцена озера. На причале стоит енот в жёлтом плаще с удочкой.">
  <defs>
    <linearGradient id="fish-sky" x2="0" y2="1"><stop style="stop-color:var(--sky-top)"/><stop offset=".62" style="stop-color:var(--sky-mid)"/><stop offset="1" style="stop-color:var(--sky-bottom)"/></linearGradient>
    <linearGradient id="fish-water" x2=".25" y2="1"><stop style="stop-color:var(--water-top)"/><stop offset=".5" style="stop-color:var(--water-mid)"/><stop offset="1" style="stop-color:var(--water-bottom)"/></linearGradient>
    <linearGradient id="fish-hill" x2="1" y2="1"><stop stop-color="#e2afff"/><stop offset="1" stop-color="#7069d3"/></linearGradient>
    <linearGradient id="fish-coat" x2="1" y2="1"><stop stop-color="#fff5a7"/><stop offset=".52" stop-color="#ffd05f"/><stop offset="1" stop-color="#ff927b"/></linearGradient>
    <linearGradient id="fish-fur" x2=".8" y2="1"><stop stop-color="#f7f2ff"/><stop offset="1" stop-color="#ada2dc"/></linearGradient>
    <radialGradient id="fish-glow"><stop stop-color="#fff2bd" stop-opacity=".72"/><stop offset="1" stop-color="#fff2bd" stop-opacity="0"/></radialGradient>
    <clipPath id="fish-lake-clip"><path d="M0 281Q70 249 142 273T286 267T450 252V600H0Z"/></clipPath>
  </defs>
  <path fill="url(#fish-sky)" d="M0 0h450v600H0z"/>
  <circle class="fish-sun-glow" cx="108" cy="139" r="112" fill="url(#fish-glow)"/><circle class="fish-sun" cx="108" cy="139" r="36" fill="#fff1b8"/>
  <g class="fish-stars" fill="#edf0ff"><circle cx="38" cy="62" r="1.5"/><circle cx="181" cy="39" r="2"/><circle cx="274" cy="91" r="1.4"/><circle cx="397" cy="52" r="2"/><circle cx="331" cy="151" r="1.3"/></g>
  <g class="fish-cloud fish-cloud-one" fill="var(--cloud)"><path d="M-135 92q-9-18 12-22 2-27 30-20 17-21 38-2 29-3 29 21 25 3 22 23z"/></g>
  <g class="fish-cloud fish-cloud-two" fill="var(--cloud)"><path d="M-145 172q-7-15 13-20 2-23 25-18 18-18 36 1 24-3 28 20 23 2 18 19z"/></g>
  <g fill="none" stroke="#855d80" stroke-width="2" stroke-linecap="round" opacity=".65"><path d="m205 114 7-3 7 3m42 32 5-3 5 3m-94 23 5-2 5 2"/></g>
  <path d="M0 258Q41 124 119 222T231 208Q310 105 371 207T470 188V326H0Z" fill="url(#fish-hill)"/>
  <path d="M0 271Q66 193 143 249T273 238Q368 167 450 235V330H0Z" fill="#4fc9bc"/>
  <path d="M0 274Q59 229 126 263M250 260Q345 203 436 243" fill="none" stroke="#c4f2b7" stroke-width="7" stroke-linecap="round"/>
  <g fill="none" stroke="#ffeabd" stroke-width="5" stroke-linecap="round" opacity=".55"><path d="m37 235 13-8m42-16 11-3m95 27 15 3m78-35 12-8m62-7 13 3"/></g>
  <path d="M0 281Q70 249 142 273T286 267T450 252V600H0Z" fill="url(#fish-water)"/>
  <path d="M0 285Q70 253 142 277T286 271T450 256" fill="none" stroke="#c2e9ca" stroke-width="3" opacity=".65"/>
  <g clip-path="url(#fish-lake-clip)">
    <g class="fish-water-flow" fill="none" stroke="var(--water-light)" stroke-width="2" opacity=".28"><path d="M-80 319q65-12 130 0t130 0t130 0t130 0t130 0M-120 378q82-15 164 0t164 0t164 0t164 0M-90 458q72-17 144 0t144 0t144 0t144 0M-130 554q95-19 190 0t190 0t190 0"/></g>
    <g class="fish-water-flow fish-water-flow-back" fill="none" stroke="var(--water-light)" stroke-width="10" opacity=".07"><path d="M-90 349q70-13 140 0t140 0t140 0t140 0M-110 420q85-16 170 0t170 0t170 0M-90 520q80-18 160 0t160 0t160 0"/></g>
    <g class="fish-rain-rings" fill="none" stroke="#d8efff" stroke-width="1.4"><ellipse cx="68" cy="327" rx="9" ry="3"/><ellipse cx="182" cy="432" rx="12" ry="4"/><ellipse cx="298" cy="520" rx="10" ry="3"/><ellipse cx="406" cy="303" rx="7" ry="2"/></g>
  </g>
  <ellipse cx="160" cy="489" rx="92" ry="31" fill="#153c72" opacity=".18"/>
  <g fill="#8ed9a9" stroke="#397c84" stroke-width="2"><path d="M59 414c-22-14-34 11-7 16 17 3 25-7 16-13l-11 7z"/><path d="M102 442c-18-11-27 10-5 13 14 2 19-6 12-10l-9 6z"/><path d="M28 476c-23-14-33 12-6 17 16 3 23-8 15-14l-10 8z"/></g>
  <g class="fish-reeds" fill="none" stroke-linecap="round"><path d="M4 511Q22 427 18 365M24 520Q50 440 46 391M0 500Q8 438 1 405M45 534Q61 474 77 432" stroke="#328ca0" stroke-width="5"/><path d="M18 370v-27m29 52 2-26m27 67 5-19" stroke="#ff9b9c" stroke-width="8"/><path d="M12 491q14-47 28-58m-9 73q16-34 34-39" stroke="#d6f8b1" stroke-width="4"/></g>
  <path d="M298 443 450 409v93l-152 39z" fill="#65539b"/><path d="m298 443 152-34v27l-152 38z" fill="#f0afa9"/><path d="m310 459 140-34m-102 25 5 11m26-18 5 11m27-18 5 10" fill="none" stroke="#b3759a" stroke-width="2"/><path d="M319 468v85m105-111v73" stroke="#5e4b8e" stroke-width="12"/>
  <g class="fish-art-particles" fill="#fff4c9">${Array.from({ length: 20 }, (_, i) => `<circle cx="${24 + (i * 71) % 406}" cy="${78 + (i * 89) % 452}" r="${i % 4 === 0 ? 2.4 : 1.3}" style="--i:${i}"/>`).join('')}</g>
  <g class="fish-angler"><g class="fish-raccoon">
    <path d="M389 431q45 3 35-33-4-14-18-12" fill="#b5a6df" stroke="#514b83" stroke-width="3"/><path d="m407 390 12 11m-17 1 19 13m-20 0 15 15" stroke="#615487" stroke-width="9"/>
    <path class="fish-boot-left" d="m343 446-4 28q14 9 28 0l-2-29" fill="#48427b"/><path class="fish-boot-right" d="m376 445 2 27q13 7 23-1l-9-33" fill="#48427b"/>
    <path d="M340 371q-15 28-10 76 31 17 68-3l-11-75z" fill="url(#fish-coat)" stroke="#efa561" stroke-width="2"/><path d="m367 383 3 66m-29-31 17-2v15h-16" fill="none" stroke="#e99662" stroke-width="2"/><circle cx="375" cy="409" r="2" fill="#fff0b1"/>
    <path d="M344 399q-14 5-24-17" fill="none" stroke="#ffd06d" stroke-width="18" stroke-linecap="round"/><path d="m321 382-7-8" stroke="#d8caf0" stroke-width="11" stroke-linecap="round"/>
    <path d="m339 341-5-34q15-8 28 14m14 0 18-21q14 9 7 37" fill="#c9baed" stroke="#4d4b77" stroke-width="3"/><path d="m340 323 1-10 12 12m28 0 10-16 3 18" fill="#62678b"/>
    <path d="M334 340q26-27 58-4 23 24-8 40-27 14-47-8-12-13-3-28" fill="url(#fish-fur)"/>
    <path d="M337 347q10-14 27-2l-6 16q-19 5-21-14m31-3q16-15 26 2-2 18-20 14z" fill="#494277"/>
    <g class="fish-eyes"><ellipse cx="352" cy="349" rx="4" ry="5" fill="#fff7dc"/><ellipse cx="381" cy="347" rx="4" ry="5" fill="#fff7dc"/><circle cx="353" cy="350" r="2.4" fill="#253e4b"/><circle cx="380" cy="348" r="2.4" fill="#253e4b"/></g>
    <path d="M359 360q8-7 16-1-5 15-12 9" fill="#f2e7c8"/><path d="m364 358 8-1-4 6z" fill="#2c4953"/><path d="M338 328q24-16 51-4l-2-14q-27-17-44 3z" fill="#fff4d5"/><path d="M335 329q27-12 56-4" stroke="#6653a0" stroke-width="7" stroke-linecap="round"/>
    <path d="m338 357-8 3 9 2m53-10 9 3-8 4" fill="#eee5ff"/><g fill="#f292af" opacity=".65"><ellipse cx="346" cy="361" rx="5" ry="3"/><ellipse cx="385" cy="358" rx="5" ry="3"/></g>
    <path d="m365 370 4 2 5-3" fill="none" stroke="#695884" stroke-width="1.4" stroke-linecap="round"/><path d="m345 316 11-4" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <path class="fish-scarf" d="M378 383q20 0 24 12l-14-1 3 11q-15-5-17-19" fill="#ed789d"/><path d="m346 383 18 8 20-14" fill="none" stroke="#ed789d" stroke-width="7"/>
  </g>
  <g class="fish-rod"><path d="M${hand.x} ${hand.y}Q263 272 ${tip.x} ${tip.y}" fill="none" stroke="#494277" stroke-width="4" stroke-linecap="round"/><path d="m${hand.x} ${hand.y}-9-17" stroke="#ffc48e" stroke-width="7" stroke-linecap="round"/></g><circle cx="${hand.x}" cy="${hand.y}" r="6" fill="#dfcff4"/></g>
  <path class="fish-line" d="M${tip.x} ${tip.y}Q174 330 ${cast.x} ${cast.y}" fill="none" stroke="#fff7d7" stroke-width="1.2" opacity="0"/>
  <g class="fish-pull-wake" opacity="0" fill="none" stroke="#c8f8e8" stroke-linecap="round"><path d="M21-8q24-10 48 0"/><path d="M27 1q31-8 61 2"/><path d="M19 10q23 9 47 2"/></g>
  <g class="fish-approach" opacity="0"><ellipse cx="0" cy="0" rx="23" ry="9" fill="#173d67" opacity=".72"/><path d="m19 0 16-10v20z" fill="#173d67" opacity=".68"/><path d="M-12-1q7-8 14 0" fill="none" stroke="#8ee9d3" stroke-width="1.5"/><circle cx="-15" cy="-2" r="1.5" fill="#fff3bd"/></g>
  <g class="fish-bubbles" fill="none" stroke="#c5f5d7" stroke-width="1.7" opacity="0"><circle cx="-18" cy="4" r="4"/><circle cx="9" cy="-6" r="6"/><circle cx="23" cy="9" r="3"/></g>
  <g class="fish-float" opacity="0"><ellipse class="fish-ripple" cy="5" rx="19" ry="6" fill="none" stroke="#d9f6cc" opacity=".6"/><path d="M0-19V0" stroke="#fff6d5" stroke-width="3"/><path d="M0-19v9" stroke="#ff715f" stroke-width="5" stroke-linecap="round"/><ellipse cy="2" rx="4" ry="6" fill="#ffe7ad"/></g>
  <g class="fish-rain" stroke="#dceeff" stroke-width="1.1" opacity=".45">${Array.from({ length: 35 }, (_, i) => `<path d="M${(i * 83) % 480} ${(i * 127) % 620 - 40}l-9 28"/>`).join('')}</g>
  </svg>`;
}
