# Control de inventario

Aplicación de revisión física de bienes institucionales a partir de una hoja de inventario Excel o CSV. Arranca sin bienes, custodios ni ubicaciones precargados: los catálogos se crean con los datos importados.

## Ejecutar

Desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

En Windows puedes usar `py`; en Linux/macOS, `python3`. Abre `http://localhost:8000/Index.html`. No requiere npm ni compilación.

El correo y la contraseña comienzan vacíos. Para entrar se exige un correo con formato válido y una contraseña no vacía. Al cerrar sesión ambos campos se limpian, sin borrar el inventario guardado. El acceso actual identifica la sesión y permite elegir un perfil de trabajo, pero **no autentica cuentas ni comprueba contraseñas**. Los perfiles no son controles de seguridad. Para usuarios reales con permisos y datos compartidos se necesita integrar un servicio de autenticación y una base de datos de servidor.

## Cargar la base

1. Identifica la sesión con tu correo y entra con el perfil Administrador o Responsable de inventario.
2. En **Importar base**, selecciona o arrastra un archivo `.xlsx`, `.xls` o `.csv`. Se lee la primera hoja.
3. Relaciona las columnas de número de inventario, descripción, custodio y ubicación. La columna de inventario es obligatoria; las demás pueden omitirse.
4. Revisa la vista previa y los conteos. Los inventarios vacíos se omiten; los duplicados se detectan sin distinguir mayúsculas y minúsculas. Se eliminan espacios al inicio y al final del identificador.
5. Confirma la importación. Los bienes nuevos se agregan como **Pendientes**; los existentes no se reemplazan ni se marcan como verificados.

Custodios y ubicaciones registradas se crean a partir del archivo. Los lugares donde se encuentra físicamente un bien se eligen de un catálogo fijo de 29 nombres, independiente de la hoja importada. Un bien sin estos datos puede consultarse; para registrar una revisión y corregir su asignación se necesita un custodio y una ubicación válidos.

## Guardado y alcance

La base importada, las revisiones, las correcciones de asignación y las observaciones se guardan automáticamente en el almacenamiento local del navegador. Se restauran al recargar; las credenciales de acceso no se guardan.

Este guardado corresponde al mismo navegador y dirección de la aplicación. Mantén la misma dirección y puerto, por ejemplo `http://localhost:8000`. No se comparte entre usuarios, equipos, perfiles de navegador ni direcciones diferentes. Borrar los datos del sitio elimina el inventario guardado; conserva el archivo original. En navegación privada el almacenamiento puede ser temporal. El CSV de discrepancias es un reporte, no una copia completa de la base con todas sus revisiones.

Si no es posible guardar un cambio, la operación se cancela y se muestra un aviso. Si el inventario guardado no se puede abrir, no se sobrescribe automáticamente. Una base compartida y el acceso con cuentas reales quedan pendientes de configurar según el servicio elegido.

## Revisar los bienes

1. En **Levantamiento**, **Filtrar ubicación en la hoja** permite consultar la asignación importada. En **Lugar donde se encontró el bien** selecciona una de las 29 ubicaciones autorizadas y elige el custodio. Si el filtro coincide exactamente con un lugar autorizado, se propone ese lugar hasta que elijas otro explícitamente.
2. Escribe un número de inventario y presiona **Enter**.
3. Si la asignación coincide, el bien queda **Encontrado**. Si difiere, se registra como encontrado con una alerta de ubicación, custodio o ambos.
4. El número se limpia y las selecciones permanecen para revisar el siguiente. Las alertas aparecen en la revisión y en **Reportes**.
5. **Corregir asignación** permite modificar explícitamente la hoja; revisar un bien conserva la asignación registrada y la evidencia de lo observado.

Sin seleccionar un lugar de hallazgo y un custodio puedes consultar un inventario sin marcarlo como encontrado. Elegir el lugar de hallazgo conserva la ubicación original; solo **Guardar corrección** modifica la asignación registrada. El selector de corrección también usa los 29 lugares autorizados; si la ubicación anterior no pertenece al catálogo, exige elegir una antes de guardar. Un número inexistente muestra una alerta y no crea bienes.

**Reportes** muestra bienes no encontrados y discrepancias. Su CSV incluye las asignaciones registradas y observadas. La gráfica y el lector de Excel/CSV requieren las bibliotecas externas de cdnjs; si el lector no carga, la página lo indica y no importa archivos. Las tablas y la exportación CSV funcionan sin la gráfica.

## Pruebas

Consulta [tests/README.md](tests/README.md). Las pruebas usan Chromium real. Sus datos sintéticos están aislados en `tests/inventario_fixture.js` y no se cargan en la aplicación normal. Incluyen arranque vacío, primera importación, persistencia después de recargar, fallos de almacenamiento y el recorrido de revisión.
