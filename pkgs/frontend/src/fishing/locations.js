const mapIcons = {
  home: '<path d="m5 12 11-9 11 9M8 11v16h16V11M14 27v-9h5v9"/>',
  crossing: '<path d="M4 23q6-5 12 0t12 0M7 18V8m18 10V8M7 11q9 6 18 0M11 14v5m10-5v5"/>',
  main: '<path d="M5 27h22M8 27V12h16v15M5 12l11-8 11 8M13 17v3m6-3v3m-6 4v3m6-3v3"/>',
  zhdany: '<path d="M4 15h24L24 7H8zM7 16v11h18V16M12 27v-8h8v8M12 7l-2 8m10-8 2 8"/>',
  passage: '<path d="M6 27V14a10 10 0 0 1 20 0v13M12 27V15a4 4 0 0 1 8 0v12M4 27h24"/>',
};

export const FISHING_LOCATIONS = [
  { id: 'crossing', name: 'Переправа', locked: false, x: 27, y: 72, icon: '≈' },
  { id: 'main', name: 'Главка', locked: true, x: 48, y: 38, icon: 'Г' },
  { id: 'zhdany', name: 'Жданы', locked: true, x: 82, y: 42, icon: 'Ж' },
  { id: 'passage', name: 'Переход', locked: true, x: 69, y: 73, icon: 'П' },
];

export function getLocation(id) {
  return FISHING_LOCATIONS.find(location => location.id === id) || null;
}

export function worldMapMarkup() {
  const points = [
    { id: 'home', name: 'Дом', locked: false, x: 14, y: 34, icon: '⌂' },
    ...FISHING_LOCATIONS,
  ];
  return `<section class="fish-world-map" aria-label="Карта рыболовного клуба">
    <div class="fish-map-heading"><span class="fish-map-kicker">МАЛЕНЬКИЙ МИР БОЛЬШОЙ РЫБАЛКИ</span><h2>Карта</h2></div>
    <div class="fish-map-landscape"><svg class="fish-map-art" viewBox="0 0 600 530" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="fish-map-water" x2="1" y2="1"><stop stop-color="#352983"/><stop offset=".5" stop-color="#5360d7"/><stop offset="1" stop-color="#25bfc2"/></linearGradient>
        <linearGradient id="fish-map-mint" x2=".8" y2="1"><stop stop-color="#e3ffad"/><stop offset="1" stop-color="#39d9b0"/></linearGradient>
        <linearGradient id="fish-map-peach" x2=".7" y2="1"><stop stop-color="#ffe5a3"/><stop offset="1" stop-color="#ff838e"/></linearGradient>
        <linearGradient id="fish-map-lilac" x2="1" y2="1"><stop stop-color="#edbaff"/><stop offset="1" stop-color="#9981ed"/></linearGradient>
        <filter id="fish-map-blur"><feGaussianBlur stdDeviation="24"/></filter>
        <g id="fish-map-tree"><path d="M0 12V-19" stroke="#3a5279" stroke-width="3"/><path d="M0-48C-30-28-21-6 0-10 25-8 24-29 0-48" fill="#369a99"/><path d="M0-40v24" stroke="#adf7ba" stroke-width="2"/></g>
      </defs>
      <path fill="url(#fish-map-water)" d="M0 0h600v530H0z"/>
      <g filter="url(#fish-map-blur)" opacity=".4"><ellipse cx="100" cy="100" rx="130" ry="65" fill="#ed8cf6"/><ellipse cx="420" cy="440" rx="150" ry="45" fill="#57ffe1"/></g>
      <g class="fish-map-currents" fill="none" stroke="#bdedff" stroke-width="1" opacity=".25"><path d="M-80 95Q140-40 325 70T690 80M-80 112Q140-23 325 87T690 97M-40 360Q160 225 330 290T680 225M-40 377Q160 242 330 307T680 242M-30 488Q170 380 350 462T690 405"/></g>
      <g stroke="#ffffff66" stroke-width="2">
        <path d="M24 152Q8 90 88 105T168 185Q144 237 62 221Z" fill="url(#fish-map-peach)"/>
        <path d="M212 134Q264 84 335 128T372 221Q296 256 223 217Z" fill="url(#fish-map-lilac)"/>
        <path d="M413 181Q430 116 526 145T566 253Q490 285 426 244Z" fill="url(#fish-map-mint)"/>
        <path d="M68 351Q108 282 193 311T258 404Q181 453 100 420Z" fill="url(#fish-map-mint)"/>
        <path d="M345 365Q366 310 449 329T529 417Q477 466 382 443Z" fill="url(#fish-map-peach)"/>
      </g>
      <g fill="none" stroke="#fff2c0" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 10" class="fish-map-route"><path d="M84 188Q51 287 162 381M110 170Q168 79 288 187M318 195Q403 108 490 223M475 249Q387 279 414 387M190 392Q296 463 396 410"/></g>
      <g><use href="#fish-map-tree" transform="translate(41 165) rotate(-12) scale(.8)"/><use href="#fish-map-tree" transform="translate(140 164) scale(.65)"/><use href="#fish-map-tree" transform="translate(245 174) scale(.7)"/><use href="#fish-map-tree" transform="translate(343 180) scale(.8)"/><use href="#fish-map-tree" transform="translate(536 212) rotate(12)"/><use href="#fish-map-tree" transform="translate(95 373)"/><use href="#fish-map-tree" transform="translate(226 374) scale(.8)"/><use href="#fish-map-tree" transform="translate(485 391) scale(.9)"/></g>
      <g fill="none" stroke="#fff4c5" stroke-width="5" stroke-linecap="round" opacity=".65"><path d="m53 207 13-4m56-81 9 3m134 95 12 4m64-76 9 5m104 80 13 3m76-12 7-4M119 407l16 4m58-70 11 4m181 86 12 5m80-70 9 3"/></g>
      <g class="fish-map-boat"><path d="m305 310 36-3-10 13h-15z" fill="#ffe7ab"/><path d="M323 280v30m-3-27-14 23h14" fill="#ff9caf" stroke="#ffe7ab" stroke-width="2"/></g>
      <g class="fish-art-particles" fill="#fff3c5">${Array.from({ length: 18 }, (_, i) => `<circle cx="${26 + (i * 137) % 550}" cy="${25 + (i * 83) % 475}" r="${i % 3 === 0 ? 2.5 : 1.5}" style="--i:${i}"/>`).join('')}</g>
    </svg>
    <div class="fish-map-points">${points.map(point => `<button type="button" class="fish-map-point" data-location="${point.id}" style="--map-x:${point.x}%;--map-y:${point.y}%" aria-label="${point.name}${point.locked ? ': закрыто' : ''}"${point.locked ? ' disabled' : ''}><span aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${mapIcons[point.id]}</svg>${point.locked ? '<i class="fish-map-lock">?</i>' : ''}</span><strong>${point.name}</strong></button>`).join('')}</div></div>
  </section>`;
}
