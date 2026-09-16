export const FISHING_LOCATIONS = [
  { id: 'crossing', name: 'Переправа', locked: false, x: 22, y: 59, icon: '≈' },
  { id: 'main', name: 'Главка', locked: true, x: 54, y: 27, icon: 'Г' },
  { id: 'zhdany', name: 'Кефас', locked: true, x: 80, y: 47, icon: 'К' },
  { id: 'passage', name: 'Жанчик', locked: true, x: 55, y: 74, icon: 'Ж' },
];

export function getLocation(id) {
  return FISHING_LOCATIONS.find(location => location.id === id) || null;
}

export function worldMapMarkup() {
  const points = [
    { id: 'home', name: 'Дом', locked: false, x: 18, y: 23.5, icon: '⌂' },
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
      <g class="fish-map-home-island" stroke="#55466d" stroke-width="2" stroke-linejoin="round">
        <path d="M18 148C26 119 51 100 81 101C113 102 138 121 144 151C150 181 128 205 96 211C62 217 29 202 20 178C16 168 15 158 18 148Z" fill="#e99072"/>
        <path d="M20 162C41 150 58 151 77 159C96 167 117 164 142 151C145 173 135 193 114 204C83 220 42 207 25 187C20 181 18 172 20 162Z" fill="#f4bd75" stroke="none"/>
        <path d="M29 139C43 117 63 107 85 108C104 109 120 117 132 132C111 128 96 133 80 140C62 148 47 148 29 139Z" fill="#8bc79a" stroke="none"/>
        <path d="M28 181C49 191 71 194 92 190M102 202C116 197 127 189 134 179" fill="none" stroke="#fff0ad" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      </g>
      <g stroke="#ffffff66" stroke-width="2">
        <path d="M181 148Q221 101 286 138T302 221Q247 246 185 211Z" fill="url(#fish-map-lilac)"/>
        <path d="M301 260Q337 222 401 259T419 337Q366 367 309 329Z" fill="url(#fish-map-mint)"/>
        <path d="M37 349Q70 302 135 330T158 419Q102 450 48 407Z" fill="url(#fish-map-mint)"/>
        <path d="M185 433Q225 388 290 425T311 507Q251 536 194 495Z" fill="url(#fish-map-peach)"/>
      </g>
      <g fill="none" stroke="#fff2c0" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 10" class="fish-map-route"><path d="M269 205Q333 205 360 298M337 337Q287 355 251 464M133 405Q171 449 221 472"/></g>
      <g class="fish-map-hut" stroke="#543b55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="83" cy="184" rx="34" ry="6" fill="#65465f" opacity=".2" stroke="none"/>
        <g class="fish-map-hut-smoke" fill="none" stroke="#fff1d5" stroke-width="3" opacity=".7">
          <path d="M101 106C91 98 108 92 99 82"/>
        </g>
        <path d="m94 119 2-23 11 1 1 27z" fill="#995c66"/>
        <path d="M55 144 104 141 109 181 58 184Z" fill="#ca7659"/>
        <path d="m94 142 10-1 5 40-15 1z" fill="#a85d5d" stroke="none"/>
        <path d="m49 147 29-41 44 33-9 12-34-27-19 29z" fill="#65496e"/>
        <path d="m55 143 24-32 34 27-6 7-28-21-18 25z" fill="#ef8b68" stroke="none"/>
        <path d="M62 151 75 150 74 163 61 164Z" fill="#ffd675"/>
        <path d="M67 151v12M61 157l14-1" fill="none" stroke="#fff4c5" stroke-width="1.3"/>
        <path d="M81 151 96 150 97 182 81 182Z" fill="#5c455b"/>
        <circle cx="92" cy="167" r="1.5" fill="#ffd475" stroke="none"/>
        <path d="M58 174C70 170 84 172 96 176M56 145 78 113" fill="none" stroke="#ffd18d" stroke-width="2.5" opacity=".65"/>
        <g class="fish-map-hut-sign">
          <path d="M47 157v27" fill="none" stroke="#76515a"/>
          <path d="m39 155 17-2 1 11-18 2z" fill="#ffe09a"/>
          <path d="M44 160c3-3 6-3 9 0-3 3-6 3-9 0Zm0 0-3-2v4z" fill="#4fae9f" stroke-width="1"/>
        </g>
      </g>
      <g><use href="#fish-map-tree" transform="translate(42 163) rotate(-12) scale(.75)"/><use href="#fish-map-tree" transform="translate(116 162) scale(.62)"/><use href="#fish-map-tree" transform="translate(205 195) scale(.7)"/><use href="#fish-map-tree" transform="translate(280 188) scale(.75)"/><use href="#fish-map-tree" transform="translate(326 312) rotate(-8) scale(.8)"/><use href="#fish-map-tree" transform="translate(395 302) scale(.7)"/><use href="#fish-map-tree" transform="translate(68 397) scale(.86)"/><use href="#fish-map-tree" transform="translate(137 384) scale(.7)"/><use href="#fish-map-tree" transform="translate(213 486) scale(.78)"/><use href="#fish-map-tree" transform="translate(287 470) scale(.65)"/></g>
      <g fill="none" stroke="#fff4c5" stroke-width="5" stroke-linecap="round" opacity=".65"><path d="m42 187 13-4m48-57 9 3m82 91 12 4m52-79 9 5m65 169 13 3m49-44 8-3M62 415l16 4m48-72 11 4m72 153 12 5m61-67 9 3"/></g>
      <g class="fish-map-boat"><path d="m205 334 36-3-10 13h-15z" fill="#ffe7ab"/><path d="M223 304v30m-3-27-14 23h14" fill="#ff9caf" stroke="#ffe7ab" stroke-width="2"/></g>
      <g class="fish-art-particles" fill="#fff3c5">${Array.from({ length: 18 }, (_, i) => `<circle cx="${22 + (i * 109) % 407}" cy="${28 + (i * 97) % 542}" r="${i % 3 === 0 ? 2.5 : 1.5}" style="--i:${i}"/>`).join('')}</g>
    </svg>
    <div class="fish-map-points">${points.map(point => `<button type="button" class="fish-map-point" data-location="${point.id}" style="--map-x:${point.x}%;--map-y:${point.y}%" aria-label="${point.name}${point.locked ? ': закрыто' : ''}"${point.locked ? ' disabled' : ''}><strong>${point.name}${point.locked ? "<small>Закрыто</small>" : ""}</strong></button>`).join('')}</div></div>
  </section>`;
}
