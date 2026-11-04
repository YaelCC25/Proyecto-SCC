// Datos sintéticos exclusivos de las pruebas; no se cargan en la aplicación.
const custodiosPrueba = [
  { id: 1, nombre: 'Ana Torres', empleado: 'E-1001', area: 'Sistemas' },
  { id: 2, nombre: 'Luis Ramírez', empleado: 'E-1002', area: 'Laboratorios' },
  { id: 3, nombre: 'Marta Solís', empleado: 'E-1003', area: 'Administración' },
  { id: 4, nombre: 'Jorge Peña', empleado: 'E-1004', area: 'Biblioteca' }];
const DESC = ['Equipo de cómputo', 'Monitor', 'Escritorio', 'Silla ergonómica', 'Proyector', 'Impresora', 'Archivero', 'Mesa de trabajo'];
const UBIC = ['Laboratorio 2', 'Oficina 5', 'Biblioteca', 'Aula 3', 'Almacén'];
/* Lugares de la facultad. Edita esta lista con los reales (o se completa al importar la base). */
const lugaresPrueba = ['Laboratorio 1', 'Laboratorio 2', 'Laboratorio 3', 'Oficina 5', 'Oficina 9', 'Biblioteca', 'Aula 1', 'Aula 2', 'Aula 3', 'Almacén', 'Sala de maestros', 'Dirección', 'Cubículo 1', 'Cubículo 2'];
const bienesPrueba = Array.from({ length: 48 }, (_, i) => ({
  inv: 'INV-' + String(100 + i).padStart(5, '0'), desc: DESC[i % DESC.length], custodio: custodiosPrueba[i % 4].id,
  ubic: UBIC[i % UBIC.length], estado: 'pendiente', obs: ''
}));

CUSTODIOS.push(...custodiosPrueba);
LUGARES.push(...lugaresPrueba);
BIENES.push(...bienesPrueba);
