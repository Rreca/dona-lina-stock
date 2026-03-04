function canMoveToUnlockable() {
  var knots = getKnots();
  var unlockableCount = knots.filter(function(k) { return k.status === 'UNLOCKABLE'; }).length;
  return unlockableCount < 3;
}

function canStartDoing() {
  var knots = getKnots();
  var hasDoing = knots.some(function(k) { return k.status === 'DOING'; });
  return !hasDoing;
}

// Regla anti-acumulación incluida
function canCaptureNewKnot() {
  var knots = getKnots();
  var unlockables = knots.filter(function(k) { return k.status === 'UNLOCKABLE'; });
  var unlockableCount = unlockables.length;
  var hasDoing = knots.some(function(k) { return k.status === 'DOING'; });

  var baseCanCapture = unlockableCount < 3 && !hasDoing;

  var now = Date.now();
  var stale24h = false;

  if (unlockableCount >= 3) {
    var newestTouch = unlockables
      .map(function(k){ return k.lastTouchedAt || 0; })
      .sort(function(a,b){ return b-a; })[0] || 0;

    stale24h = (now - newestTouch) > (24 * 60 * 60 * 1000);
  }

  var message = 'Sistema lleno. Para capturar algo nuevo, primero: (1) hacé 5 min un DESBLOQUEABLE, o (2) mandá uno a ALGÚN DÍA, o (3) pausá/terminá el EN PROGRESO.';
  if (stale24h) {
    message = 'Sistema lleno hace +24h (no tocaste tus DESBLOQUEABLES). Antes de capturar: tocá 1 (hacer 5 min, dividir o mandarlo a ALGÚN DÍA).';
  }

  return { canCapture: baseCanCapture, message: message, stale24h: stale24h };
}

function validateNewKnot(knot) {
  if (!knot.title || !knot.blockReason) {
    throw new Error('Título y motivo de bloqueo requeridos.');
  }

  knot.weight = normalizeFriction(knot.weight);
  knot.impact = normalizeImpact(knot.impact);

  if (['NO_START', 'LAZINESS', 'FEAR'].includes(knot.blockReason)) {
    if (!knot.nextStep || knot.nextStep.trim().length === 0 || knot.estMinutes > 5) {
      throw new Error('Para este motivo: “Próximo paso” obligatorio y “Minutos estimados” <= 5.');
    }
    knot.status = 'UNLOCKABLE';
  } else if (knot.blockReason === 'EXTERNAL') {
    if (!knot.externalWait || knot.externalWait.trim().length === 0) {
      throw new Error('Si depende de un externo, “Espera externa” es obligatorio.');
    }
    knot.status = 'BLOCKED';
  } else if (knot.blockReason === 'NOT_TODAY') {
    knot.status = 'SOMEDAY';
    knot.nextStep = null;
    knot.estMinutes = null;
    knot.externalWait = null;
  }

  var knots = getKnots();
  if (knot.status === 'UNLOCKABLE' && knots.filter(function(k) { return k.status === 'UNLOCKABLE'; }).length >= 3) {
    throw new Error('Máximo 3 DESBLOQUEABLES.');
  }

  return knot;
}

function transitionToDoing(knotId) {
  if (!canStartDoing()) {
    throw new Error('Ya hay un EN PROGRESO. Pausá o terminá el actual.');
  }
  var knot = getKnotById(knotId);
  if (!knot) throw new Error('Nudo no encontrado.');
  if (knot.status !== 'UNLOCKABLE') {
    throw new Error('Solo un DESBLOQUEABLE puede ir a EN PROGRESO.');
  }
  updateKnot({ id: knotId, status: 'DOING' });
}

function transitionToSomeday(knotId) {
  updateKnot({ id: knotId, status: 'SOMEDAY' });
}

function transitionToPauseDoing(knotId) {
  var knot = getKnotById(knotId);
  if (!knot) return;
  if (knot.status !== 'DOING') return;
  if (!canMoveToUnlockable()) {
    throw new Error('No hay cupo para DESBLOQUEABLE.');
  }
  updateKnot({ id: knotId, status: 'UNLOCKABLE' });
}

function transitionToDone(knotId, feltLighter) {
  var knot = getKnotById(knotId);
  if (!knot) throw new Error('Nudo no encontrado.');
  updateKnot({ id: knotId, status: 'DONE', doneAt: Date.now() });
  logEvent('KNOT_DONE', { knotId: knotId, feltLighter: !!feltLighter });
}

/* ===== Normalizaciones y edición ===== */
function normalizeImpact(v) {
  var n = parseInt(v, 10);
  if (isNaN(n)) return 3;
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

function normalizeFriction(v) {
  var n = parseInt(v, 10);
  if (isNaN(n)) return 3;
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

function validateEditedKnot(candidate) {
  if (!candidate.title || !candidate.blockReason) {
    throw new Error('Título y motivo de bloqueo son obligatorios.');
  }

  candidate.estMinutes = candidate.estMinutes ? parseInt(candidate.estMinutes, 10) : null;
  candidate.weight = normalizeFriction(candidate.weight);
  candidate.impact = normalizeImpact(candidate.impact);

  if (['NO_START', 'LAZINESS', 'FEAR'].includes(candidate.blockReason)) {
    if (!candidate.nextStep || candidate.nextStep.trim().length === 0) {
      throw new Error('Para este motivo, el “Próximo paso” es obligatorio.');
    }
    if (candidate.estMinutes && candidate.estMinutes > 5) {
      throw new Error('Para este motivo, “Minutos estimados” debe ser <= 5.');
    }
    candidate.status = 'UNLOCKABLE';
    candidate.externalWait = null;
  } else if (candidate.blockReason === 'EXTERNAL') {
    if (!candidate.externalWait || candidate.externalWait.trim().length === 0) {
      throw new Error('Si depende de un externo, “Espera externa” es obligatorio.');
    }
    candidate.status = 'BLOCKED';
    candidate.nextStep = candidate.nextStep || null;
  } else if (candidate.blockReason === 'NOT_TODAY') {
    candidate.status = 'SOMEDAY';
    candidate.nextStep = null;
    candidate.externalWait = null;
    candidate.estMinutes = null;
  }

  if (candidate.status === 'UNLOCKABLE') {
    var knots = getKnots();
    var unlockables = knots.filter(function(k) { return k.status === 'UNLOCKABLE' && k.id !== candidate.id; }).length;
    if (unlockables >= 3) {
      throw new Error('No hay cupo: máximo 3 DESBLOQUEABLES.');
    }
  }

  return candidate;
}
