const mapIcons = {
  home: '<path d="m5 12 11-9 11 9M8 11v16h16V11M14 27v-9h5v9"/>',
  crossing: '<path d="M4 23q6-5 12 0t12 0M7 18V8m18 10V8M7 11q9 6 18 0M11 14v5m10-5v5"/>',
  main: '<path d="M5 27h22M8 27V12h16v15M5 12l11-8 11 8M13 17v3m6-3v3m-6 4v3m6-3v3"/>',
  zhdany: '<path d="M4 15h24L24 7H8zM7 16v11h18V16M12 27v-8h8v8M12 7l-2 8m10-8 2 8"/>',
  passage: '<path d="M6 27V14a10 10 0 0 1 20 0v13M12 27V15a4 4 0 0 1 8 0v12M4 27h24"/>',
};

export const FISHING_LOCATIONS = [
  { id: 'crossing', name: 'Переправа', locked: false, x: 22, y: 65, icon: '≈' },
  { id: 'main', name: 'Главка', locked: true, x: 54, y: 32, icon: 'Г' },
  { id: 'zhdany', name: 'Жданы', locked: true, x: 78, y: 51, icon: 'Ж' },
  { id: 'passage', name: 'Переход', locked: true, x: 55, y: 76, icon: 'П' },
];

export function getLocation(id) {
  return FISHING_LOCATIONS.find(location => location.id === id) || null;
}

export function worldMapMarkup() {
  const points = [
    { id: 'home', name: 'Дом', locked: false, x: 18, y: 28, icon: '⌂' },
    ...FISHING_LOCATIONS,
  ];
  return `<section class="fish-world-map" aria-label="Карта рыболовного клуба">
    <div class="fish-map-heading"><h2>Карта</h2></div>
    <div class="fish-map-landscape"><svg class="fish-map-art" viewBox="0 0 450 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="fish-map-water" x2="1" y2="1"><stop stop-color="#352983"/><stop offset=".5" stop-color="#5360d7"/><stop offset="1" stop-color="#25bfc2"/></linearGradient>
        <linearGradient id="fish-map-mint" x2=".8" y2="1"><stop stop-color="#e3ffad"/><stop offset="1" stop-color="#39d9b0"/></linearGradient>
        <linearGradient id="fish-map-peach" x2=".7" y2="1"><stop stop-color="#ffe5a3"/><stop offset="1" stop-color="#ff838e"/></linearGradient>
        <linearGradient id="fish-map-lilac" x2="1" y2="1"><stop stop-color="#edbaff"/><stop offset="1" stop-color="#9981ed"/></linearGradient>
        <filter id="fish-map-blur"><feGaussianBlur stdDeviation="20"/></filter>
        <g id="fish-map-tree"><path d="M0 12V-19" stroke="#3a5279" stroke-width="3"/><path d="M0-48C-30-28-21-6 0-10 25-8 24-29 0-48" fill="#369a99"/><path d="M0-40v24" stroke="#adf7ba" stroke-width="2"/></g>
      </defs>
      <path fill="url(#fish-map-water)" d="M0 0h450v600H0z"/>
      <g filter="url(#fish-map-blur)" opacity=".42"><ellipse cx="70" cy="105" rx="110" ry="75" fill="#ed8cf6"/><ellipse cx="367" cy="510" rx="118" ry="70" fill="#57ffe1"/></g>
      <g class="fish-map-currents" fill="none" stroke="#bdedff" stroke-width="1" opacity=".25"><path d="M-55 91Q115 5 230 93T505 70M-65 110Q105 24 220 112T495 89M-50 315Q96 234 222 315T510 278M-60 336Q86 255 212 336T500 299M-35 538Q112 455 244 526T505 493"/></g>
      <g stroke="#ffffff66" stroke-width="2">
        <path d="M20 144Q15 91 77 99T143 170Q125 214 52 203Z" fill="url(#fish-map-peach)"/>
        <path d="M181 148Q221 101 286 138T302 221Q247 246 185 211Z" fill="url(#fish-map-lilac)"/>
        <path d="M301 260Q337 222 401 259T419 337Q366 367 309 329Z" fill="url(#fish-map-mint)"/>
        <path d="M37 349Q70 302 135 330T158 419Q102 450 48 407Z" fill="url(#fish-map-mint)"/>
        <path d="M185 433Q225 388 290 425T311 507Q251 536 194 495Z" fill="url(#fish-map-peach)"/>
      </g>
      <g fill="none" stroke="#fff2c0" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 10" class="fish-map-route"><path d="M80 170Q52 271 98 381M102 151Q162 104 238 189M269 205Q333 205 360 298M337 337Q287 355 251 464M133 405Q171 449 221 472"/></g>
      <g><use href="#fish-map-tree" transform="translate(42 163) rotate(-12) scale(.75)"/><use href="#fish-map-tree" transform="translate(116 162) scale(.62)"/><use href="#fish-map-tree" transform="translate(205 195) scale(.7)"/><use href="#fish-map-tree" transform="translate(280 188) scale(.75)"/><use href="#fish-map-tree" transform="translate(326 312) rotate(-8) scale(.8)"/><use href="#fish-map-tree" transform="translate(395 302) scale(.7)"/><use href="#fish-map-tree" transform="translate(68 397) scale(.86)"/><use href="#fish-map-tree" transform="translate(137 384) scale(.7)"/><use href="#fish-map-tree" transform="translate(213 486) scale(.78)"/><use href="#fish-map-tree" transform="translate(287 470) scale(.65)"/></g>
      <g fill="none" stroke="#fff4c5" stroke-width="5" stroke-linecap="round" opacity=".65"><path d="m42 187 13-4m48-57 9 3m82 91 12 4m52-79 9 5m65 169 13 3m49-44 8-3M62 415l16 4m48-72 11 4m72 153 12 5m61-67 9 3"/></g>
      <g class="fish-map-boat"><path d="m205 334 36-3-10 13h-15z" fill="#ffe7ab"/><path d="M223 304v30m-3-27-14 23h14" fill="#ff9caf" stroke="#ffe7ab" stroke-width="2"/></g>
      <g class="fish-art-particles" fill="#fff3c5">${Array.from({ length: 18 }, (_, i) => `<circle cx="${22 + (i * 109) % 407}" cy="${28 + (i * 97) % 542}" r="${i % 3 === 0 ? 2.5 : 1.5}" style="--i:${i}"/>`).join('')}</g>
    </svg>
    <div class="fish-map-points">${points.map(point => `<button type="button" class="fish-map-point" data-location="${point.id}" style="--map-x:${point.x}%;--map-y:${point.y}%" aria-label="${point.name}${point.locked ? ': закрыто' : ''}"${point.locked ? ' disabled' : ''}><span aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${mapIcons[point.id]}</svg>${point.locked ? '<i class="fish-map-lock">?</i>' : ''}</span><strong>${point.name}</strong></button>`).join('')}</div></div>
  </section>`;
}
