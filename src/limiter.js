'use strict';

// Einfacher Zähler pro Schlüssel (z. B. IP oder Benutzername) in einem Zeitfenster
class Limiter {
  constructor({ max, windowMs }) {
    this.max = max;
    this.windowMs = windowMs;
    this.hits = new Map();
    setInterval(() => this.cleanup(), Math.min(windowMs, 10 * 60 * 1000)).unref();
  }

  entry(key) {
    const now = Date.now();
    let e = this.hits.get(key);
    if (!e || e.reset <= now) {
      e = { count: 0, reset: now + this.windowMs };
      this.hits.set(key, e);
    }
    return e;
  }

  // true = erlaubt (und mitgezählt)
  hit(key) {
    const e = this.entry(key);
    e.count++;
    return e.count <= this.max;
  }

  blocked(key) {
    const e = this.hits.get(key);
    return !!e && e.reset > Date.now() && e.count >= this.max;
  }

  retryAfter(key) {
    const e = this.hits.get(key);
    return e ? Math.max(1, Math.ceil((e.reset - Date.now()) / 1000)) : 0;
  }

  reset(key) {
    this.hits.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [k, e] of this.hits) if (e.reset <= now) this.hits.delete(k);
  }
}

module.exports = { Limiter };
