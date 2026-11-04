export const EVENTS = {
  INPUT_TAP: 'input:tap',
  INPUT_DOUBLE_TAP: 'input:doubleTap',
  UNITS_SELECTED: 'units:selected',
  UNIT_DEATH: 'unit:death',
  UNIT_UNCONSCIOUS: 'unit:unconscious',
  UNIT_SHOOT: 'unit:shoot',
  BULLET_IMPACT: 'bullet:impact',
  SHELL_EJECT: 'shell:eject',          // FIX: было не объявлено
  EXPLOSION: 'explosion:global',        // FIX: было не объявлено
  ZONE_CAPTURED: 'zone:captured',       // FIX: было не объявлено
  WORLD_NOISE: 'world:noise',
  TIME_CHANGED: 'time:changed',
  DEBUG_TOGGLED: 'debug:toggled',
};

class EventBusClass {
  constructor() { this.listeners = new Map(); }

  on(event, callback) {
    if (typeof event !== 'string') {
      console.warn('[EventBus] on() called with non-string event:', event);
      return () => {};
    }
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const unsub = this.on(event, (data) => { unsub(); callback(data); });
    return unsub;
  }

  off(event, callback) {
    if (typeof event !== 'string') return;
    if (this.listeners.has(event)) this.listeners.get(event).delete(callback);
  }

  clear(event) {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }

  emit(event, data) {
    if (typeof event !== 'string') return; // FIX: не эмитим undefined
    const set = this.listeners.get(event);
    if (!set) return;
    const callbacks = [...set];
    for (const cb of callbacks) {
      try { cb(data); }
      catch (err) { console.error(`[EventBus] "${event}":`, err); }
    }
  }
}

export const EventBus = new EventBusClass();
