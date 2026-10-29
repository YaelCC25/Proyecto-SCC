Pruebas del levantamiento con un servidor local y Chromium real. No necesitan base de datos ni acceso al CDN: comprueban consulta, coincidencias, diferencias de custodio y ubicación, corrección explícita, exportación CSV y vista móvil. Cada prueba parte de los 48 bienes de ejemplo.

Desde la raíz del proyecto:

```bash
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
python -B -m unittest discover -s tests -v
```

En Windows puedes usar `py` en lugar de `python`. En Linux también se puede usar `python3`; si Chromium necesita bibliotecas del sistema, Playwright ofrece `python3 -m playwright install --with-deps chromium`.

Si existe `chromium` en PATH, las pruebas lo utilizan. También puedes indicar su ejecutable con la variable `CHROMIUM_PATH`. Las pruebas inician y cierran su propio servidor en un puerto libre y no modifican los archivos de la aplicación.
