// Cancel both timers on navigation so a previous title cannot hide a new one.
export function createLocationNotice(element, schedule = setTimeout, cancel = clearTimeout) {
  let fadeTimer, hideTimer;
  function hide() {
    cancel(fadeTimer); cancel(hideTimer);
    element.hidden = true;
    element.classList.remove('is-fading');
  }
  return {
    hide,
    show(name) {
      hide();
      element.textContent = name;
      element.hidden = false;
      fadeTimer = schedule(() => {
        element.classList.add('is-fading');
        hideTimer = schedule(hide, 700);
      }, 3000);
    },
  };
}
