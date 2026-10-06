# Formato de circuito (JSON)

Un archivo por circuito en `circuits/`, registrado en `circuits/index.json`.
La app web lo carga con `?c=<id>`; una app móvil puede leer exactamente los mismos archivos.

| Campo | Descripción |
|---|---|
| `schemaVersion` | Versión del formato (para migraciones futuras). |
| `id` | Identificador único. También define la clave del progreso guardado. |
| `version` | Súbela al cambiar ruta o paradas: el progreso guardado de la versión anterior se descarta. |
| `settings` | Radios en metros: llegada a parada, fuera de ruta, precisión mínima de GPS, entrada/salida del modo "lejos" y radio de la vista de seguimiento. |
| `route` | Geometría GeoJSON `LineString`, coordenadas `[lng, lat]`. Se puede pegar la salida de `togeojson` o de una API de rutas. |
| `stops[]` | **En orden de recorrido.** `id`, `label` (texto en el mapa), `type` (`start`/`poi`/`end`), `name`, `description`, `coordinates` `[lng, lat]`. |

Para agregar un circuito: crea `circuits/<id>.json`, añádelo a `index.json` y a `FILES` en `sw.js`
(opcional, para que funcione sin conexión desde la primera visita) y sube `CACHE` en `sw.js`.
