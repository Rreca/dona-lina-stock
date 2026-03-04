var config = {
  grupos: [],
  datos: {}
};

function cargarJSON() {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      if (xhr.status == 200 || xhr.status == 0) {
        config = JSON.parse(xhr.responseText);
        var stored = localStorage.getItem('listasAppAntigua');
        if (stored) {
          config.datos = JSON.parse(stored);
        }
        generarGrupos();
      } else {
        alert('No se pudo cargar data.json');
      }
    }
  };
  xhr.open('GET', 'data.json', true);
  xhr.send();
}

function guardar() {
  localStorage.setItem('listasAppAntigua', JSON.stringify(config.datos));
}

function calcularSumatoria(idGrupo, idLista) {
  var items = (config.datos[idGrupo] && config.datos[idGrupo][idLista]) || [];
  var suma = 0;
  for (var i = 0; i < items.length; i++) {
    suma += parseFloat(items[i].monto) || 0;
  }
  if (!config.datos[idGrupo]) config.datos[idGrupo] = {};
  config.datos[idGrupo][idLista + '_sumatoria'] = suma;
  return suma;
}

function generarGrupos() {
  var container = document.getElementById('grupos-container');
  container.innerHTML = '';

  for (var g = 0; g < config.grupos.length; g++) {
    var grupo = config.grupos[g];

    var divGrupo = document.createElement('div');
    divGrupo.className = 'grupo';

    var header = document.createElement('div');
    header.className = 'grupo-header';
    header.style.background = grupo.color || '#4CAF50';
    header.innerHTML = grupo.nombre;
    header.onclick = function() {
      var secciones = this.nextElementSibling;
      if (secciones.style.display === 'none' || secciones.style.display === '') {
        secciones.style.display = 'block';
      } else {
        secciones.style.display = 'none';
      }
    };
    divGrupo.appendChild(header);

    var secciones = document.createElement('div');
    secciones.className = 'secciones';
    secciones.style.display = 'block';

    for (var l = 0; l < grupo.listas.length; l++) {
      var lista = grupo.listas[l];

      var seccion = document.createElement('div');
      seccion.className = 'seccion';

      var h2 = document.createElement('h2');
      h2.style.color = grupo.color || '#4CAF50';
      h2.innerHTML = lista.nombre;
      seccion.appendChild(h2);

      var ul = document.createElement('ul');
      ul.id = 'lista-' + lista.id;
      seccion.appendChild(ul);

      var sumDiv = document.createElement('div');
      sumDiv.className = 'sumatoria';
      sumDiv.id = 'sum-' + lista.id;
      seccion.appendChild(sumDiv);

      var btnAgregar = document.createElement('button');
      btnAgregar.className = 'agregar';
      btnAgregar.style.background = grupo.color || '#4CAF50';
      btnAgregar.innerHTML = 'Agregar a ' + lista.nombre;
      btnAgregar.onclick = (function(idL, idG, cf, cm) {
        return function() { agregarItem(idL, idG, cf, cm); };
      })(lista.id, grupo.id, !!lista.conFecha, !!lista.conMonto);
      seccion.appendChild(btnAgregar);

      if (grupo.id === 'gastos') {
        var btnExport = document.createElement('button');
        btnExport.className = 'exportar-lista';
        btnExport.innerHTML = 'Exportar JSON';
        btnExport.onclick = (function(idL, nom) {
          return function() {
            var extra = prompt('Texto adicional (ej: diciembre):');
            if (extra !== null) {
              exportarListaJSON(idL, grupo.id, nom.toLowerCase() + '_' + extra + '.json');
            }
          };
        })(lista.id, lista.nombre);
        seccion.appendChild(btnExport);
      }

      secciones.appendChild(seccion);
    }

    divGrupo.appendChild(secciones);
    container.appendChild(divGrupo);
  }

  renderizarTodas();
}

function renderizarTodas() {
  for (var g = 0; g < config.grupos.length; g++) {
    var grupo = config.grupos[g];
    for (var l = 0; l < grupo.listas.length; l++) {
      var lista = grupo.listas[l];
      renderizarLista(lista.id, grupo.id, !!lista.conFecha, !!lista.conMonto);
    }
  }
}

function renderizarLista(idLista, idGrupo, conFecha, conMonto) {
  var ul = document.getElementById('lista-' + idLista);
  if (!ul) return;
  ul.innerHTML = '';
  var items = (config.datos[idGrupo] && config.datos[idGrupo][idLista]) || [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    var li = document.createElement('li');

    var content = document.createElement('div');
    content.className = 'content';

    if (conMonto && typeof item === 'object' && item !== null) {
      // GASTOS: mantiene los <br> necesarios para separar líneas
      if (conFecha) {
        var dateSpan = document.createElement('span');
        dateSpan.className = 'date';
        dateSpan.innerHTML = item.fecha || 'Sin fecha';
        content.appendChild(dateSpan);
        content.appendChild(document.createElement('br'));
      }
      content.appendChild(document.createTextNode('Monto: $' + (parseFloat(item.monto) || 0).toFixed(2)));
      content.appendChild(document.createElement('br'));
      if (item.descripcion && item.descripcion.trim() !== '') {
        content.appendChild(document.createTextNode('Desc: ' + item.descripcion));
        content.appendChild(document.createElement('br'));
      }
    } else if (conFecha && typeof item === 'object' && item !== null) {
      // RECORDATORIOS: fecha + texto con salto
      var dateSpan = document.createElement('span');
      dateSpan.className = 'date';
      dateSpan.innerHTML = item.date || 'Sin fecha';
      content.appendChild(dateSpan);
      content.appendChild(document.createElement('br'));
      content.appendChild(document.createTextNode(item.text || '[Sin texto]'));
      // NO <br> extra al final
    } else {
      // LISTAS NORMALES (Compras, Diarios, Libre): solo texto, SIN ningún <br>
      var texto = '';
      if (typeof item === 'string') {
        texto = item.trim();
      } else if (item && typeof item === 'object' && item.text) {
        texto = item.text.trim();
      } else {
        texto = '[Item vacío]';
      }
      content.appendChild(document.createTextNode(texto));
      // ¡Importante! NO agregamos <br> aquí
    }

    li.appendChild(content);

    var buttons = document.createElement('div');
    buttons.className = 'buttons';

    var edit = document.createElement('button');
    edit.innerHTML = '✏️';
    edit.onclick = (function(idx, lista, grupo, fecha, monto) { return function() { editar(idx, lista, grupo, fecha, monto); }; })(i, idLista, idGrupo, conFecha, conMonto);
    buttons.appendChild(edit);

    var del = document.createElement('button');
    del.innerHTML = '🗑️';
    del.onclick = (function(idx, lista, grupo, fecha, monto) { return function() { borrar(idx, lista, grupo, fecha, monto); }; })(i, idLista, idGrupo, conFecha, conMonto);
    buttons.appendChild(del);

    var up = document.createElement('button');
    up.innerHTML = '⬆️';
    up.onclick = (function(idx, lista, grupo) { return function() { mover(idx, lista, grupo, -1); }; })(i, idLista, idGrupo);
    buttons.appendChild(up);

    var down = document.createElement('button');
    down.innerHTML = '⬇️';
    down.onclick = (function(idx, lista, grupo) { return function() { mover(idx, lista, grupo, 1); }; })(i, idLista, idGrupo);
    buttons.appendChild(down);

    li.appendChild(buttons);
    ul.appendChild(li);
  }

  if (idGrupo === 'gastos') {
    var suma = calcularSumatoria(idGrupo, idLista);
    var sumDiv = document.getElementById('sum-' + idLista);
    if (sumDiv) sumDiv.innerHTML = 'Sumatoria: $' + suma.toFixed(2);
    guardar();
  }
}

function agregarItem(idLista, idGrupo, conFecha, conMonto) {
  if (!config.datos[idGrupo]) config.datos[idGrupo] = {};
  if (!config.datos[idGrupo][idLista]) config.datos[idGrupo][idLista] = [];

  var items = config.datos[idGrupo][idLista];

  if (conMonto) {
    var fecha = conFecha ? prompt('Fecha (YYYY-MM-DD):') : '';
    var montoStr = prompt('Monto (número):');
    var descripcion = prompt('Descripción (opcional):', '');

    if (!montoStr) return;

    var monto = parseFloat(montoStr) || 0;

    items.push({
      fecha: fecha ? fecha.trim() : '',
      monto: monto,
      descripcion: descripcion ? descripcion.trim() : ''
    });
  } else if (conFecha) {
    var fecha = prompt('Fecha (YYYY-MM-DD):');
    var texto = prompt('Texto:');

    items.push({
      date: fecha ? fecha.trim() : '',
      text: texto ? texto.trim() : ''
    });
  } else {
    var texto = prompt('Nuevo item:');
    if (texto && texto.trim() !== '') {
      items.push(texto.trim());
    } else {
      return;
    }
  }

  guardar();
  renderizarLista(idLista, idGrupo, conFecha, conMonto);
}

function editar(index, idLista, idGrupo, conFecha, conMonto) {
  if (!config.datos[idGrupo] || !config.datos[idGrupo][idLista]) return;
  var items = config.datos[idGrupo][idLista];
  var item = items[index];

  if (conMonto) {
    var fecha = conFecha ? prompt('Fecha (YYYY-MM-DD):', item.fecha || '') : item.fecha;
    var monto = prompt('Monto:', item.monto || '');
    var desc = prompt('Descripción (opcional):', item.descripcion || '');

    if (fecha !== null) item.fecha = fecha.trim();
    if (monto !== null) item.monto = parseFloat(monto) || 0;
    if (desc !== null) item.descripcion = desc.trim();
  } else if (conFecha) {
    var fecha = prompt('Fecha (YYYY-MM-DD):', item.date || '');
    var texto = prompt('Texto:', item.text || '');

    if (fecha !== null) item.date = fecha.trim();
    if (texto !== null) item.text = texto.trim();
  } else {
    var valorActual = typeof item === 'string' ? item : '[Item vacío]';
    var nuevo = prompt('Editar item:', valorActual);
    if (nuevo !== null) {
      items[index] = nuevo.trim() || '[Item vacío]';
    }
  }

  guardar();
  renderizarLista(idLista, idGrupo, conFecha, conMonto);
}

function borrar(index, idLista, idGrupo, conFecha, conMonto) {
  if (confirm('¿Borrar?')) {
    config.datos[idGrupo][idLista].splice(index, 1);
    guardar();
    renderizarLista(idLista, idGrupo, conFecha, conMonto);
  }
}

function mover(index, idLista, idGrupo, dir) {
  var items = config.datos[idGrupo][idLista];
  var nuevo = index + dir;
  if (nuevo >= 0 && nuevo < items.length) {
    var temp = items[index];
    items[index] = items[nuevo];
    items[nuevo] = temp;
    guardar();
    renderizarLista(idLista, idGrupo, false, false); // conFecha y conMonto no afectan orden
  }
}

function exportarJSON() {
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config));
  var a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", "listas-app.json");
  a.click();
}

function exportarListaJSON(idLista, idGrupo, nombreArchivo) {
  var listaData = {
    items: config.datos[idGrupo][idLista] || [],
    sumatoria: config.datos[idGrupo][idLista + '_sumatoria'] || 0
  };
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(listaData));
  var a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", nombreArchivo || 'lista.json');
  a.click();
}

function importarJSON(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      config = JSON.parse(e.target.result);
      guardar();
      generarGrupos();
      alert('Importado correctamente');
    } catch (err) {
      alert('Error: ' + err);
    }
  };
  reader.readAsText(file);
}

window.onload = cargarJSON;