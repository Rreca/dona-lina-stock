// file: utils.js
// uuid, escapeHTML, timeAgo, export/import

function generateUUID() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.textContent = (str == null) ? '' : String(str);
  return div.innerHTML;
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'recién';
  var now = Date.now();
  var seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 0) seconds = 0;

  var interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + ' año(s) atrás';

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + ' mes(es) atrás';

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + ' día(s) atrás';

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + ' hora(s) atrás';

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + ' minuto(s) atrás';

  return seconds + ' segundo(s) atrás';
}

/***********************
 * Export / Import JSON
 ***********************/
function exportData() {
  var data = {
    version: 1,
    exportedAt: Date.now(),
    knots: getKnots(),
    events: getEvents()
  };

  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);

  var a = document.createElement('a');
  a.href = url;
  a.download = 'nudos_backup.json';
  a.click();

  URL.revokeObjectURL(url);
}

function importData(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (event) {
    try {
      var data = JSON.parse(event.target.result);

      if (!data || !Array.isArray(data.knots) || !Array.isArray(data.events)) {
        alert('JSON inválido: faltan "knots" y/o "events".');
        return;
      }

      // Normalización defensiva por si vienen archivos viejos
      var knots = data.knots.map(function (k) {
        if (typeof k.weight !== 'number') k.weight = parseInt(k.weight, 10) || 3;   // fricción
        if (typeof k.impact !== 'number') k.impact = parseInt(k.impact, 10) || 3;   // impacto
        if (!k.lastTouchedAt) k.lastTouchedAt = k.updatedAt || k.createdAt || Date.now();
        if (!k.updatedAt) k.updatedAt = k.createdAt || Date.now();
        if (!k.createdAt) k.createdAt = Date.now();
        return k;
      });

      saveKnots(knots);
      saveEvents(data.events);

      alert('Importado exitosamente.');
      if (typeof renderToday === 'function') renderToday();
      if (typeof renderInsights === 'function') renderInsights();
    } catch (err) {
      alert('Error al importar: ' + err.message);
    }
  };

  reader.readAsText(file);

  // Permite re-importar el mismo archivo (resetea input)
  e.target.value = '';
}
