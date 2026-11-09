# Hojas en orden

Aplicación estática en español para importar fotografías, proponer números de página mediante OCR local, revisar el orden y exportar Word o fotografías en ZIP. No requiere cuentas ni Python para usar la versión publicada.

## Uso

1. Selecciona o arrastra JPG, PNG o WEBP. Puedes agregar más después; cada fotografía muestra una miniatura y un campo de página.
2. Para mejorar el reconocimiento, abre una miniatura y dibuja un rectángulo alrededor del número. Aplica la región a esa foto o a todas. Las coordenadas son proporcionales: comprueba su posición si las hojas tienen encuadres diferentes. Puedes ampliar y girar la imagen. Girar elimina su región anterior.
3. Pulsa **Reconocer números**. Se omiten las fotografías ya marcadas como revisadas. El motor busca en cuatro zonas de márgenes o en la región indicada; también permite buscar en toda la hoja. Si hay varios números candidatos, el campo queda vacío. Si no reconoce ninguno, no inventa numeración.
4. Consulta el candidato, corrige el número y marca cada fotografía como revisada. El porcentaje procede del motor, no es una probabilidad de acierto. Desmarca «Revisada» para volver a ejecutar el OCR. Los números admitidos son enteros positivos de hasta seis dígitos.
5. Pulsa **Ordenar por número**; las flechas permiten un orden excepcional. Revisa los duplicados, huecos y pendientes. Los huecos se calculan entre números existentes: una secuencia que empieza en 15 no implica páginas 1–14 ausentes.
6. Pulsa **Confirmar orden**. Se muestra la secuencia y se pide aceptación explícita de los conflictos. Cualquier modificación invalida la confirmación. Word y ZIP utilizan el mismo orden confirmado.
7. Descarga el Word o el ZIP. El Word usa carta con márgenes de media pulgada, una imagen por página y proporciones conservadas. El ZIP conserva los bytes y formatos originales; usa sufijos únicos para duplicados y `sin-numero` para páginas desconocidas aceptadas explícitamente.

La sesión vive en memoria: recargar o cerrar pierde el trabajo. Los archivos de origen nunca se sobrescriben. El giro se aplica a Word; ZIP conserva el original intacto. Los ajustes de contraste y brillo sólo afectan al OCR. Algunos exploradores de ZIP ordenan por nombre: un orden manual contrario a la numeración puede no verse igual en ellos.

## Desarrollo

Requiere Node.js 24 y npm para desarrollar, no para el usuario final.

```sh
cd version-web
npm ci
npm run build
npm run dev
```

`build` copia el trabajador, los binarios WebAssembly y el modelo inglés a `public/ocr/`, y produce `dist/`. Después de una instalación nueva ejecuta `npm run build` antes de probar OCR en desarrollo. Los modelos no se descargan de terceros durante el uso: se sirven desde el mismo sitio.

```sh
npm test
# En otra terminal, mantener npm run dev activo:
npm run test:browser
```

La prueba de navegador usa Chromium de `/usr/bin/chromium`. Puedes definir `BROWSER_PATH` para otra instalación de Chromium. Los tests no necesitan fotografías privadas: generan imágenes reproducibles en Canvas. El conjunto automatizado no sustituye pruebas en dispositivos físicos.

## Publicar en GitHub Pages

Se incluye `.github/workflows/pages.yml` en la raíz del repositorio, con activación **manual**.

1. Sube los archivos a tu repositorio; no subas `node_modules`, `public/ocr` ni `dist`.
2. En **Settings → Pages → Build and deployment**, selecciona **GitHub Actions**.
3. En **Actions → Publicar Hojas en orden → Run workflow**, ejecuta el flujo.
4. El flujo instala dependencias fijadas, ejecuta tests unitarios, compila y publica `version-web/dist`.
5. Abre la dirección indicada por GitHub Pages. No abras `index.html` con `file://`: los módulos y el trabajador necesitan HTTP(S).

Vite usa rutas relativas (`base: './'`) y el OCR resuelve sus recursos respecto a la dirección de la aplicación: funciona bajo la subruta del repositorio. También puedes subir el contenido completo de `dist/`, incluidos sus archivos OCR, a otro alojamiento estático HTTPS.

La publicación no se ha ejecutado desde esta sesión.

## Arquitectura

- `src/main.js`: interfaz, estado de sesión, revisión, regiones, progreso, cancelación y confirmación.
- `src/imports.js`: validación e importación individual sin modificar originales.
- `src/images.js`: decodificación, miniaturas, giro y preprocesamiento de regiones.
- `src/ocr.js`: trabajador OCR local, búsqueda por zonas, candidatos y confianza.
- `src/model.js`: validación de números, orden, duplicados, huecos y nombres de exportación.
- `src/word.js` y `src/zip.js`: generación independiente de cada formato.
- `src/exports.js`: interfaz común y descarga a partir del orden confirmado.
- `scripts/assets.mjs`: preparación de los recursos OCR para publicación autónoma.
- `tests/`: pruebas de reglas y flujo real de navegador.

## Elección del OCR y limitaciones

Tesseract.js 6 ejecuta Tesseract mediante WebAssembly y un trabajador. Se limita la salida a dígitos y se prueban regiones pequeñas, con contraste, brillo, escala de grises y nitidez configurables. Para una región manual se utiliza segmentación de palabra; para márgenes, texto disperso. La opción de probar giros realiza cuatro orientaciones, pero no modifica automáticamente el original ni corrige inclinaciones pequeñas o perspectiva.

**No se garantiza precisión en manuscritos.** La [FAQ oficial de Tesseract](https://tesseract-ocr.github.io/tessdoc/FAQ.html#can-i-use-tesseract-for-handwriting-recognition) explica que está diseñado para texto impreso y no funciona bien con escritura a mano. Un candidato único también puede ser un número del contenido, no la página. Por eso siempre queda pendiente de revisión y la búsqueda en hoja completa advierte de más falsos positivos.

Alternativas evaluadas conceptualmente, no implementadas ni comparadas con fotografías privadas:

- Clasificadores de dígitos como MNIST pueden ejecutarse con TensorFlow.js u ONNX Runtime Web, pero clasifican dígitos aislados: requieren localizar y separar correctamente números de varias cifras. No resuelven por sí solos este problema.
- [TrOCR](https://github.com/microsoft/unilm/tree/master/trocr) ofrece modelos para manuscritos; su documentación lista 334 millones de parámetros para Base y 558 millones para Large (también existen modelos Small). Para esta aplicación requiere un modelo compatible/exportado, más memoria y una etapa de localización. Integrarlo y declarar una mejora requiere un conjunto de fotografías representativas y mediciones; no se añade un modelo pesado sin esa validación.

Se eligió Tesseract como base local reproducible con revisión obligatoria, no como solución demostrada al manuscrito de una persona concreta. Para evaluar precisión real utiliza fotos autorizadas con números conocidos, mide aciertos, omisiones y falsos candidatos, e incluye lápiz tenue, giros, sombras y números de varias cifras.

## Privacidad, memoria y conexión

No hay APIs externas, analítica ni subida de imágenes. Bibliotecas, trabajador y modelo se sirven con la aplicación. Las fotografías y correcciones no se guardan permanentemente. El motor puede almacenar el modelo de idioma en la caché interna del navegador; no las fotografías.

El OCR usa un trabajador y procesa secuencialmente: una foto y un recorte cada vez. Las miniaturas se reducen y sus URLs se liberan al eliminar imágenes. «Detener» termina el recorte OCR actual y evita los siguientes; la preparación inicial del motor tampoco es instantáneamente cancelable. Las fotos incompletas no se incorporan como resultados parciales.

No se establece un límite de fotos, pero los originales y el resultado de Word/ZIP ocupan memoria. En teléfonos, dividir documentos muy grandes puede ser necesario. Word convierte WEBP y fotografías giradas a PNG; esto puede aumentar mucho el tamaño. Para JPEG/PNG sin giro conserva los bytes de imagen. La preparación de ZIP conserva los originales, pero el archivo final se genera en memoria.

No se declara soporte sin conexión: no hay service worker que garantice conservar todos los recursos. La aplicación abierta puede continuar si sus recursos ya están cargados, pero reabrir sin red no está garantizado.

## Bibliotecas

- Tesseract.js 6.0.1 y tesseract.js-core: OCR local (Apache-2.0).
- Modelo `@tesseract.js-data/eng` 1.0.0: datos ingleses utilizados para reconocimiento de dígitos; consulta sus licencias de distribución.
- docx 9.5.1: generación de OOXML (MIT).
- JSZip 3.10.1: archivo ZIP (MIT o GPLv3; uso bajo MIT).
- Vite 6.4.1: desarrollo y compilación (MIT).
- Playwright 1.56.1: automatización de pruebas (Apache-2.0).

Se conservan avisos de licencia en las dependencias y recursos copiados. Consulta `VALIDACION.md` para resultados concretos y pruebas pendientes.
