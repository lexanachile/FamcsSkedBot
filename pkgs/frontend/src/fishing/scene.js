export function lakeScene() {
  return `<svg class="fish-scene" viewBox="0 0 600 530" role="img" aria-label="Озеро на закате. Справа на причале енот в жёлтом плаще с удочкой.">
  <defs>
    <linearGradient id="fish-sky" x2="0" y2="1"><stop style="stop-color:var(--sky-top)"/><stop offset=".7" style="stop-color:var(--sky-mid)"/><stop offset="1" style="stop-color:var(--sky-bottom)"/></linearGradient>
    <linearGradient id="fish-water" x2=".3" y2="1"><stop style="stop-color:var(--water-top)"/><stop offset=".5" style="stop-color:var(--water-mid)"/><stop offset="1" style="stop-color:var(--water-bottom)"/></linearGradient>
    <clipPath id="fish-lake-clip"><path d="M0 258Q89 213 176 246T354 242T600 239V530H0"/></clipPath>
    <linearGradient id="fish-coat" x2="1" y2="1"><stop stop-color="#fff29c"/><stop offset=".5" stop-color="#ffcf60"/><stop offset="1" stop-color="#ff9273"/></linearGradient>
    <radialGradient id="fish-glow"><stop stop-color="#fff3bc" stop-opacity=".65"/><stop offset="1" stop-color="#fff3bc" stop-opacity="0"/></radialGradient>
    <linearGradient id="fish-fur" x2=".8" y2="1"><stop stop-color="#f3efff"/><stop offset="1" stop-color="#afa4e0"/></linearGradient><linearGradient id="fish-hill" x2="1" y2="1"><stop stop-color="#dcb0ff"/><stop offset="1" stop-color="#8574df"/></linearGradient><filter id="fish-blur"><feGaussianBlur stdDeviation="9"/></filter>
    <pattern id="fish-lines" width="90" height="38" patternUnits="userSpaceOnUse"><path d="M8 19h26m34 9h12" stroke="#d8ffdf" stroke-opacity=".1" stroke-linecap="round"/></pattern>
  </defs>
  <path fill="url(#fish-sky)" d="M0 0h600v530H0z"/>
  <circle class="fish-sun-glow" cx="164" cy="142" r="125" fill="url(#fish-glow)"/><circle class="fish-sun" cx="164" cy="142" r="43" fill="#fff0b4"/>
  <g class="fish-stars" fill="#e3eeff"><circle cx="45" cy="74" r="1.5"/><circle cx="210" cy="36" r="2"/><circle cx="305" cy="111" r="1.4"/><circle cx="430" cy="61" r="2"/><circle cx="552" cy="125" r="1.4"/><circle cx="375" cy="165" r="1.2"/><circle cx="95" cy="183" r="1"/></g>
  <g class="fish-cloud fish-cloud-one" fill="var(--cloud)"><path d="M-170 96q-10-19 12-23 2-29 32-21 18-22 39-2 31-3 31 22 27 3 24 24z"/></g>
  <g class="fish-cloud fish-cloud-two" fill="var(--cloud)"><path d="M-160 147q-8-16 14-22 1-24 27-20 19-20 39 1 25-4 30 21 26 2 20 20z"/></g>
  <g fill="none" stroke="#966c72" stroke-width="2" stroke-linecap="round" opacity=".65"><path d="m290 95 7-3 7 3m28 24 5-3 5 3m-88-1 5-2 5 2"/></g>
  <path d="M0 233Q63 110 154 202T321 190Q410 96 502 187T650 168V310H0" fill="url(#fish-hill)"/>
  <path d="M0 248Q86 169 198 232T375 222Q506 145 600 226V310H0" fill="#53c7bd"/>
  <path d="M0 251Q75 203 154 242M349 247Q473 186 588 235" fill="none" stroke="#b6efb3" stroke-width="7" stroke-linecap="round"/>
  <g fill="none" stroke="#fce8ba" stroke-width="5" stroke-linecap="round" opacity=".55"><path d="m51 216 14-8m28-11 12-3m153 27 16 3m102-28 13-9m61-14 14 2m70 25 11 6"/></g>
  <path d="M0 258Q89 213 176 246T354 242T600 239V530H0" fill="url(#fish-water)"/>
  <path d="M0 263Q89 218 176 251T354 247T600 244" fill="none" stroke="#b4dac0" stroke-width="3" opacity=".6"/>
  <path d="m111 286 84-6 40 10-103 5zm23 24 68-4 17 8-78 3z" fill="#d8c291" opacity=".3"/>
  <g class="fish-shimmer" fill="none" stroke="#fae7b1" stroke-linecap="round" opacity=".5"><path d="M139 269h46m-58 14h70m-50 15h34m-61 15h90m-52 17h27"/></g>
  <g clip-path="url(#fish-lake-clip)">
    <g class="fish-water-flow" fill="none" stroke="var(--water-light)" stroke-width="2" opacity=".25"><path d="M-100 292q80-12 160 0t160 0t160 0t160 0t160 0M-150 342q100-15 200 0t200 0t200 0t200 0M-100 410q90-17 180 0t180 0t180 0t180 0M-180 493q130-20 260 0t260 0t260 0"/></g>
    <g class="fish-water-flow fish-water-flow-back" fill="none" stroke="var(--water-light)" stroke-width="9" opacity=".065"><path d="M-100 315q80-12 160 0t160 0t160 0t160 0t160 0M-150 370q100-15 200 0t200 0t200 0t200 0M-100 459q90-17 180 0t180 0t180 0t180 0"/></g>
    <g class="fish-rain-rings" fill="none" stroke="#d2eaff" stroke-width="1.4"><ellipse cx="75" cy="295" rx="9" ry="3"/><ellipse cx="210" cy="378" rx="12" ry="4"/><ellipse cx="362" cy="450" rx="10" ry="3"/><ellipse cx="480" cy="287" rx="7" ry="2"/></g>
  </g>
  <ellipse cx="282" cy="438" rx="116" ry="38" fill="#0b455e" opacity=".18"/>
  <g fill="#8ed2a5" stroke="#387f7d" stroke-width="2"><path d="M67 351c-24-15-38 12-8 17 18 3 27-7 17-14l-12 7z"/><path d="M113 369c-19-12-29 11-5 14 16 2 20-7 13-11l-10 6z"/><path d="M36 399c-26-15-36 13-6 18 17 3 25-9 16-15l-11 9z"/></g>
  <g class="fish-reeds" fill="none" stroke-linecap="round"><path d="M5 425Q24 352 20 301M23 430Q54 361 48 325M0 420Q7 366 0 340M38 444Q58 400 69 362" stroke="#398d9c" stroke-width="5"/><path d="M21 307v-25m28 47 2-25m17 61 5-17" stroke="#ffad91" stroke-width="8"/><path d="M13 408Q28 362 38 354m-11 67q15-28 32-31" stroke="#d2f5b0" stroke-width="4"/></g>
  <g opacity=".25" fill="#063d50"><ellipse cx="497" cy="433" rx="65" ry="15"/></g>
  <path d="M431 383 600 358v67l-169 30z" fill="#625196"/><path d="m431 383 169-25v23l-169 29z" fill="#efb2ac"/><path d="m443 398 157-26m-116 19 5 9m30-15 5 9m30-15 5 9" fill="none" stroke="#b57e9c" stroke-width="2"/><path d="M456 408v56m119-75v48" stroke="#65518e" stroke-width="12"/>
  <g class="fish-art-particles" fill="#fff4c9">${Array.from({ length: 20 }, (_, i) => `<circle cx="${35 + (i * 79) % 525}" cy="${100 + (i * 67) % 355}" r="${i % 4 === 0 ? 2.4 : 1.3}" style="--i:${i}"/>`).join('')}</g>
  <g class="fish-angler">
  <g class="fish-raccoon">
    <path d="M529 356q56-4 39-44-8-15-23-8" fill="#b7a7df" stroke="#514b83" stroke-width="3"/><path d="m552 308 13 12m-21 0 23 15m-24-1 18 16" stroke="#605487" stroke-width="10"/>
    <path class="fish-boot-left" d="m481 366-4 26q16 9 30 0l-3-28" fill="#48427b"/><path class="fish-boot-right" d="m517 365 2 25q14 6 23-1l-10-31" fill="#48427b"/>
    <path d="M479 297q-17 25-12 66 33 15 73-3l-12-65z" fill="url(#fish-coat)" stroke="#efad65" stroke-width="2"/>
    <path d="m506 307 4 59m-31-25 17-2v14l-16 1" fill="none" stroke="#e99d65" stroke-width="2"/><circle cx="515" cy="330" r="2" fill="#fff0b1"/>
    <path d="M482 319q-13 6-25-12" fill="none" stroke="#ffce6c" stroke-width="19" stroke-linecap="round"/><path d="M457 307l-6-7" stroke="#d5c5ee" stroke-width="12" stroke-linecap="round"/>
    <path d="m477 271-6-35q17-8 31 17m15 1 20-20q15 10 6 39" fill="#c7b8ec" stroke="#43575c" stroke-width="3"/>
    <path d="m478 257 1-13 14 14m31 1 10-16 3 18" fill="#586b6c"/>
    <path d="M472 269q29-29 63-4 26 25-8 41-29 14-50-10-13-13-5-27" fill="url(#fish-fur)"/>
    <path d="M474 277q11-15 30-2l-6 17q-21 5-24-15m35-3q18-16 29 2-2 19-22 15z" fill="#494277"/>
    <g class="fish-eyes"><ellipse cx="491" cy="279" rx="4" ry="5" fill="#fff6d8"/><ellipse cx="522" cy="278" rx="4" ry="5" fill="#fff6d8"/><circle cx="492" cy="280" r="2.5" fill="#243e49"/><circle cx="521" cy="279" r="2.5" fill="#243e49"/></g>
    <path d="M498 291q9-7 17-1-5 16-12 9" fill="#f2e7c8"/><path d="m503 289 9-1-4 6z" fill="#2c4953"/>
    <path d="M477 257q26-16 54-3l-2-15q-30-18-47 3z" fill="#fff4d5"/><path d="M473 258q29-12 60-3" stroke="#6653a0" stroke-width="7" stroke-linecap="round"/>
    <path d="m475 287-8 3 9 2m60-9 9 3-8 4" fill="#e7deff"/>
    <g fill="#f292af" opacity=".65"><ellipse cx="484" cy="291" rx="5" ry="3"/><ellipse cx="528" cy="290" rx="5" ry="3"/></g>
    <path d="m505 299 4 2 5-3" fill="none" stroke="#695884" stroke-width="1.4" stroke-linecap="round"/>
    <path d="m483 245 12-4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <path d="M514 344h13v10h-13z" fill="#ffe6a1"/><path d="m518 348 3 3 3-4" fill="none" stroke="#e18b7d" stroke-width="1.5"/>
    <path class="fish-scarf" d="M520 309q20 0 24 12l-14-1 3 10q-15-5-17-18" fill="#ed789d"/>
    <path d="m485 310 18 8 21-13" fill="none" stroke="#ed789d" stroke-width="7"/>
  </g>
  <g class="fish-rod"><path d="M453 310Q414 232 350 195" fill="none" stroke="#494277" stroke-width="4" stroke-linecap="round"/><path d="m453 310-9-17" stroke="#ffc48e" stroke-width="7" stroke-linecap="round"/></g>
  <circle cx="451" cy="307" r="6" fill="#dfcff4"/><path d="m447 306 5 2m-6 1 5 2" stroke="#a190c5" stroke-width="1.3" stroke-linecap="round"/>
  </g>
  <path class="fish-line" d="M350 195Q310 280 245 357" fill="none" stroke="#fff7d7" stroke-width="1.2" opacity="0"/>
  <g class="fish-approach" opacity="0"><ellipse cx="0" cy="0" rx="21" ry="7" fill="#123e54" opacity=".35"/><path d="m17 0 13-8v16z" fill="#123e54" opacity=".3"/></g>
  <g class="fish-bubbles" fill="none" stroke="#c5f5d7" stroke-width="1.7" opacity="0"><circle cx="-18" cy="4" r="4"/><circle cx="9" cy="-6" r="6"/><circle cx="23" cy="9" r="3"/></g>
  <g class="fish-float" opacity="0"><ellipse class="fish-ripple" cy="5" rx="19" ry="6" fill="none" stroke="#d9f6cc" opacity=".6"/><path d="M0-19V0" stroke="#fff6d5" stroke-width="3"/><path d="M0-19v9" stroke="#ff715f" stroke-width="5" stroke-linecap="round"/><ellipse cy="2" rx="4" ry="6" fill="#ffe7ad"/></g>
  <g class="fish-rain" stroke="#dceeff" stroke-width="1.1" opacity=".45">${Array.from({ length: 35 }, (_, i) => `<path d="M${(i * 97) % 640} ${(i * 139) % 550 - 40}l-9 28"/>`).join('')}</g>
  </svg>`;
}
