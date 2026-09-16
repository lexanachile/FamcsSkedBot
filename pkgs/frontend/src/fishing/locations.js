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
      <g stroke="#ffffff66" stroke-width="2">
        <path d="M20 144Q15 91 77 99T143 170Q125 214 52 203Z" fill="url(#fish-map-peach)"/>
        <path d="M181 148Q221 101 286 138T302 221Q247 246 185 211Z" fill="url(#fish-map-lilac)"/>
        <path d="M301 260Q337 222 401 259T419 337Q366 367 309 329Z" fill="url(#fish-map-mint)"/>
        <path d="M37 349Q70 302 135 330T158 419Q102 450 48 407Z" fill="url(#fish-map-mint)"/>
        <path d="M185 433Q225 388 290 425T311 507Q251 536 194 495Z" fill="url(#fish-map-peach)"/>
      </g>
      <g fill="none" stroke="#fff2c0" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 10" class="fish-map-route"><path d="M269 205Q333 205 360 298M337 337Q287 355 251 464M133 405Q171 449 221 472"/></g>
      <g class="fish-map-hut" stroke="#543b55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="83" cy="184" rx="37" ry="7" fill="#6b4961" opacity=".22" stroke="none"/>
        <g class="fish-map-hut-smoke" fill="none" stroke="#fff0dc" opacity=".7">
          <path d="M99 106c-9-7 7-11-1-19"/>
          <path d="M105 103c7-7-3-10 3-17" opacity=".55"/>
        </g>
        <path d="m94 119 2-22 11 1 2 25z" fill="#9d5b67"/>
        <path d="m96 97 12 1-1 5-12-1z" fill="#ffd391"/>
        <path d="m56 143 49-3 5 40-53 3z" fill="#c87a55"/>
        <path d="M58 151l49-3M58 160l50-3M59 169l50-3M59 178l50-3" fill="none" stroke="#8b4f4d" opacity=".8"/>
        <path d="M57 147 79 112l37 29-8 10-29-24-17 25z" fill="#684765"/>
        <path d="m51 148 27-42 44 34-7 7-36-27-20 33z" fill="#ed8b69"/>
        <path d="m57 143 22-31 37 29" fill="none" stroke="#ffd18d" stroke-width="3" opacity=".8"/>
        <path d="m75 116 5-7 40 30-5 7z" fill="#ffb36f" stroke="none" opacity=".5"/>
        <path d="M78 151h17v30H78z" fill="#60485a"/>
        <path d="M82 157h9v24h-9z" fill="#7d5a62" stroke="#efb46f"/>
        <circle cx="88" cy="169" r="1.4" fill="#ffd475" stroke="none"/>
        <path d="M62 151h11v11H62z" fill="#ffd96f"/>
        <path d="M67.5 151v11M62 156.5h11" fill="none" stroke="#fff4c5" stroke-width="1"/>
        <path d="m96 151 10-1 1 10-11 1z" fill="#86e4c0"/>
        <path d="m101 151 .5 9M96 156l11-1" fill="none" stroke="#e9ffbe" stroke-width="1"/>
        <path d="M73 181h27l7 6H67z" fill="#ffcb78"/>
        <path d="M70 187h35M74 187l-2 4m29-4 3 4" fill="none" stroke="#76515a"/>
        <g class="fish-map-hut-sign">
          <path d="M47 154v29" fill="none" stroke="#76515a"/>
          <path d="m40 153 16-2 2 11-18 2z" fill="#ffe09a"/>
          <path d="M44 158c3-4 7-4 10 0-3 4-7 4-10 0Zm0 0-3-3v6z" fill="#4fb5aa" stroke-width="1"/>
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
