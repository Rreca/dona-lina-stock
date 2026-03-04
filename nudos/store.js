// file: store.js
// Wrapper localStorage + CRUD de Nudos + Eventos

var STORAGE_KEYS = {
  knots: 'nudos_v1_knots',
  events: 'nudos_v1_events'
};

var DONE_RETENTION_DAYS = 7;

function initStore() {
  if (!localStorage.getItem(STORAGE_KEYS.knots)) {
    localStorage.setItem(STORAGE_KEYS.knots, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.events)) {
    localStorage.setItem(STORAGE_KEYS.events, JSON.stringify([]));
  }

  // mantenimiento: limpiar HECHOS viejos
  cleanupDoneKnots();
}

function cleanupDoneKnots() {
  var knots = getKnots();
  var now = Date.now();
  var keepMs = DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  var changed = false;

  knots = knots.filter(function(k) {
    if (k.status !== 'DONE') return true;

    // compat: si no tiene doneAt, lo inferimos
    if (!k.doneAt) {
      k.doneAt = k.updatedAt || k.lastTouchedAt || k.createdAt || now;
      changed = true;
    }

    var age = now - k.doneAt;
    if (age > keepMs) {
      changed = true;
      return false;
    }
    return true;
  });

  if (changed) {
    saveKnots(knots);
    logEvent('DONE_CLEANUP', { keptDays: DONE_RETENTION_DAYS });
  }
}

function getKnots() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.knots) || '[]');
}

function saveKnots(knots) {
  localStorage.setItem(STORAGE_KEYS.knots, JSON.stringify(knots));
}

function getEvents() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.events) || '[]');
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
}

function getKnotById(id) {
  return getKnots().find(function (k) { return k.id === id; });
}

function createKnot(knot) {
  if (typeof knot.weight !== 'number') knot.weight = parseInt(knot.weight, 10) || 3;
  if (typeof knot.impact !== 'number') knot.impact = parseInt(knot.impact, 10) || 3;

  var knots = getKnots();
  knots.push(knot);
  saveKnots(knots);
  logEvent('KNOT_CREATED', { knotId: knot.id });
}

function updateKnot(patch) {
  var knots = getKnots();
  var idx = knots.findIndex(function (k) { return k.id === patch.id; });
  if (idx === -1) return;

  var current = knots[idx];
  var next = Object.assign({}, current, patch);

  if (typeof next.weight !== 'number') next.weight = parseInt(next.weight, 10) || current.weight || 3;
  if (typeof next.impact !== 'number') next.impact = parseInt(next.impact, 10) || current.impact || 3;

  next.updatedAt = Date.now();
  next.lastTouchedAt = Date.now();

  knots[idx] = next;
  saveKnots(knots);

  if (patch.status && patch.status !== current.status) {
    logEvent('STATUS_CHANGED', { knotId: patch.id, newStatus: patch.status });
  } else {
    logEvent('KNOT_UPDATED', { knotId: patch.id });
  }
}

function deleteKnot(id) {
  var knots = getKnots();
  var before = knots.length;
  knots = knots.filter(function (k) { return k.id !== id; });
  saveKnots(knots);

  if (knots.length !== before) {
    logEvent('KNOT_DELETED', { knotId: id });
  }
}

function logEvent(type, meta) {
  if (typeof meta === 'undefined') meta = {};
  var events = getEvents();

  events.push({
    id: generateUUID(),
    knotId: meta.knotId || null,
    type: type,
    meta: meta,
    createdAt: Date.now()
  });

  saveEvents(events);
}
