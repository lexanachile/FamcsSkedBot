import test from 'node:test';
import assert from 'node:assert/strict';
import { bindComparisonDayInput } from '../src/comparison.js';

class Button {
  listeners = {};
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  dispatch(name, event = {}) { for (const handler of this.listeners[name] || []) handler(event); }
}

for (const gesture of ['click', 'tap', 'scroll', 'cancel', 'multi-touch', 'keyboard']) {
  test(`comparison day input: ${gesture}`, () => {
    const button = new Button();
    const activations = [];
    let scrollTop = 20;
    bindComparisonDayInput(button, immediate => activations.push(immediate), () => scrollTop);
    const point = { identifier: 1, clientX: 20, clientY: 20 };

    if (gesture === 'click') button.dispatch('click', { detail: 1 });
    else if (gesture === 'keyboard') button.dispatch('click', { detail: 0 });
    else {
      button.dispatch('touchstart', { touches: gesture === 'multi-touch' ? [point, { ...point, identifier: 2 }] : [point] });
      if (gesture === 'scroll') {
        scrollTop = 28;
        button.dispatch('touchmove', { changedTouches: [{ ...point, clientY: 48 }] });
      }
      if (gesture === 'cancel') button.dispatch('touchcancel');
      let prevented = false;
      button.dispatch('touchend', { touches: [], changedTouches: [point], preventDefault() { prevented = true; } });
      assert.equal(prevented, gesture === 'tap');
      button.dispatch('click', { detail: 1 });
    }

    assert.deepEqual(activations, ['click', 'keyboard'].includes(gesture) ? [false] : gesture === 'tap' ? [true] : []);
  });
}
