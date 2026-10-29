# Control de inventario

Demo de revisión física de bienes institucionales. Incluye 48 bienes precargados con número de inventario, descripción, custodio responsable y ubicación según una hoja de inventario.

Los datos y las revisiones viven en memoria: recargar la página reinicia la demo. No hay conexión a una base de datos.

## Ejecutar

Desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

En Windows puedes usar `py`; en Linux/macOS, `python3`. Abre `http://localhost:8000/Index.html` y entra con los datos demo prellenados. No requiere npm ni compilación.

## Simular la revisión

1. En **Levantamiento**, selecciona la ubicación y el custodio que estás revisando. Abajo aparece la lista de bienes que les corresponden según la hoja.
2. Escribe el número de inventario del bien físico y presiona **Enter**.
3. La pantalla muestra la asignación de la hoja y lo observado. Si coinciden, el bien queda **Encontrado**. Si difieren, también queda encontrado físicamente, con una alerta de ubicación, custodio o ambos.
4. El número se limpia y las selecciones permanecen para revisar el siguiente. Las alertas permanecen en la lista de la revisión y en **Reportes**.
5. **Corregir asignación** permite cambiar explícitamente la información de la hoja. Revisar un bien por sí solo conserva su asignación registrada.

Puedes consultar un número sin seleccionar ubicación y custodio: muestra su responsable y ubicación, sin marcarlo como encontrado. Un número inexistente muestra una alerta y no crea bienes automáticamente. Para cargar otra hoja está disponible **Importar base** (Excel/CSV).

Ejemplos precargados:

| Inventario | Bien | Custodio en la hoja | Ubicación en la hoja |
| --- | --- | --- | --- |
| INV-00100 | Equipo de cómputo | Ana Torres | Laboratorio 2 |
| INV-00101 | Monitor | Luis Ramírez | Oficina 5 |

Para demostrar una coincidencia, selecciona **Oficina 5 / Luis Ramírez** y escribe **INV-00101**. Para demostrar una alerta, selecciona **Laboratorio 2 / Ana Torres** y escribe ese mismo número: la hoja indica otro custodio y otra ubicación.

**Reportes** muestra bienes no encontrados y diferencias de asignación. Su CSV incluye tanto el custodio y ubicación registrados como los observados. La gráfica y la lectura de Excel/CSV utilizan bibliotecas de cdnjs; si la gráfica no carga, las tablas y la exportación siguen disponibles.

## Pruebas

Consulta [tests/README.md](tests/README.md). Las pruebas usan Chromium real, levantan su propio servidor y verifican el recorrido sin depender de las bibliotecas externas.
