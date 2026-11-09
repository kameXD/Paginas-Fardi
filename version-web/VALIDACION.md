# Validación realizada

## Resultados

- Cinco pruebas unitarias aprobadas: orden numérico, entradas inválidas, conflictos y huecos, nombres únicos de ZIP y extracción de candidatos.
- Flujo automatizado en Chromium del sistema aprobado: importación de cuatro fotografías desordenadas, región relativa aplicada a todas, ejecución real del OCR, corrección manual, revisión, duplicados y huecos, confirmación, Word, ZIP, invalidación de confirmación, incorporación y eliminación de fotografías, y viewport de teléfono sin desbordamiento horizontal.
- ZIP inspeccionado: nombres `001.png`, `003.png`, `008.png`, `015.png`; bytes comparados con las imágenes de entrada, idénticos.
- DOCX descomprimido e inspeccionado: tamaño carta, cuatro dibujos, cuatro recursos de imagen y tres saltos antes de párrafo. No se ha inspeccionado visualmente su paginación en Microsoft Word o LibreOffice; se reserva espacio vertical para el párrafo y se evitan saltos al final.
- Compilación de producción aprobada y flujo completo repetido desde `/Paginas-Fardi/` con recursos OCR locales.
- Pruebas adicionales aprobadas: archivo dañado, JPEG y WEBP, giro, conversión a PNG para Word, duplicados con formatos distintos y detención del OCR con recuperación de la interfaz.
- Durante el flujo principal no se observaron solicitudes HTTP(S) a hosts externos; los recursos se sirvieron localmente.

## OCR: resultados reproducibles, sin extrapolar precisión

La prueba genera cuatro imágenes impresas con Canvas: 15, 3, 8 y 1 en la esquina superior derecha. Selecciona una región y ejecuta el motor real. Reconoció 3, 8 y 15; dejó el 1 vacío. Las correcciones manuales completaron la secuencia `1 → 3 → 8 → 15`. No se contabiliza esto como precisión manuscrita.

Una muestra adicional de trazos dibujados sintéticamente que representa «15» fue reconocida como 15 con confianza del motor 37. Es un único ejemplo artificial, no una medida de precisión. No se dispone de fotografías manuscritas reales del usuario. Quedan pendientes pruebas con lápiz, sombras, perspectiva y distintas escrituras.

## Compatibilidad

Validación ejecutada en Chromium, con viewport de escritorio y móvil. Chrome, Brave y Edge comparten motor, pero no se probaron sus aplicaciones directamente. Se intentó instalar Firefox y WebKit para ampliar cobertura: las descargas fueron bloqueadas con HTTP 403 «Domain forbidden» por la política de red del entorno. Safari, Firefox y dispositivos físicos siguen pendientes. No se afirma compatibilidad verificada en todos ellos.

## Reproducir

```sh
npm ci
npm run build
npm test
npm run dev
# En otra terminal:
npm run test:browser
```

El script imprime los resultados OCR observados y falla si faltan los candidatos esperados para las muestras de control, si hay errores JavaScript o si difieren los archivos inspeccionados. Las fotografías se generan dentro del navegador sin recursos externos.

Para repetir el flujo con la compilación de producción, ejecuta `node tests/serve-production.mjs` después de compilar y, en otra terminal, `APP_URL=http://localhost:5180/Paginas-Fardi/ SKIP_DIAGNOSTIC=1 node tests/browser.mjs`. El diagnóstico de trazos sintéticos importa módulos fuente y se ejecuta sólo en desarrollo.
