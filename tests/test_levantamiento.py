"""Pruebas del recorrido de revisión sobre la aplicación real, con Chromium."""
import csv
import functools
import http.server
import os
from pathlib import Path
import shutil
import tempfile
import threading
import unittest

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class TestLevantamiento(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/Index.html'
        cls.playwright = sync_playwright().start()
        chromium = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        cls.browser = cls.playwright.chromium.launch(
            executable_path=chromium, headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1280, 'height': 900})
        # El recorrido y la exportación deben funcionar aunque el CDN no responda.
        self.context.route('**/*', lambda route: route.continue_()
                           if route.request.url.startswith('http://127.0.0.1:') else route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url)
        self.page.locator('#l-ok').click()
        self.go('levantamiento')
        self.inv = self.page.locator('#revision-inv')
        self.result = self.page.locator('#resultado-revision')

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [])
        finally:
            self.context.close()

    def go(self, view):
        self.page.locator(f'#nav [data-r="{view}"]').click()

    def select(self, ubic='Laboratorio 2', cust='1'):
        self.page.locator('#fu').select_option(ubic)
        self.page.locator('#fc').select_option(cust)

    def scan(self, inv='INV-00100'):
        self.inv.fill(inv)
        self.inv.press('Enter')

    def asset(self, index=0):
        return self.page.evaluate('(i) => ({...BIENES[i]})', index)

    def assert_catalog(self):
        self.assertEqual(self.page.evaluate('BIENES.length'), 48)
        self.assertEqual(self.asset()['custodio'], 1)
        self.assertEqual(self.asset()['ubic'], 'Laboratorio 2')

    def test_hoja_por_ubicacion_custodio_y_busqueda(self):
        self.page.locator('#fu').select_option('Laboratorio 2')
        self.assertEqual(self.page.locator('#lista [data-bien]').count(), 10)
        self.page.locator('#fc').select_option('1')
        self.assertEqual(self.page.locator('#lista [data-bien]').count(), 3)
        expect(self.inv).to_be_focused()
        self.page.locator('#q').fill('INV-00100')
        self.assertEqual(self.page.locator('#lista [data-bien]').count(), 1)
        expect(self.page.locator('#lista')).to_contain_text('Ana Torres')
        self.page.locator('#q').fill('No existe')
        self.assertEqual(self.page.locator('#lista [data-bien]').count(), 0)

    def test_consulta_sin_contexto_no_verifica(self):
        self.scan(' inv-00101 ')
        expect(self.result).to_contain_text('Monitor')
        expect(self.result).to_contain_text('Luis Ramírez')
        expect(self.result).to_contain_text('Oficina 5')
        expect(self.result).to_contain_text('Sin revisar')
        self.assertEqual(self.asset(1)['estado'], 'pendiente')
        self.assertNotIn('verificacion', self.asset(1))
        self.select(ubic='Oficina 5', cust='2')
        self.inv.press('Enter')
        self.assertEqual(self.asset(1)['estado'], 'encontrado')

    def test_coincidencia_enter_prepara_siguiente_sin_duplicar(self):
        self.select()
        for inv in ['INV-00100', 'INV-00120', ' inv-00100 ']:
            self.scan(inv)
            expect(self.result).to_contain_text('ubicación y custodio coinciden')
            expect(self.inv).to_have_value('')
            expect(self.inv).to_be_focused()
            expect(self.page.locator('#fu')).to_have_value('Laboratorio 2')
            expect(self.page.locator('#fc')).to_have_value('1')
        self.assert_catalog()
        self.assertEqual(self.asset()['estado'], 'encontrado')
        expect(self.page.locator('#resumen-ubicacion .stat b')).to_have_text(['3', '1', '2', '0', '0'])
        self.go('panel')
        expect(self.page.locator('.stat b')).to_have_text(['48', '2', '46', '4%', '0'])

    def test_custodio_distinto_alerta_sin_reasignar(self):
        self.select(cust='2')
        self.scan()
        expect(self.result.locator('[role="alert"]')).to_contain_text('Custodio distinto')
        expect(self.result.locator('[role="alert"]')).not_to_contain_text('Ubicación distinta')
        expect(self.result).to_contain_text('Ana Torres')
        expect(self.result).to_contain_text('Luis Ramírez')
        expect(self.page.locator('#alertas-revision')).to_contain_text('INV-00100')
        expect(self.page.locator('#resumen-ubicacion .stat b').last).to_have_text('1')
        self.assert_catalog()
        self.assertEqual(self.asset()['estado'], 'encontrado')
        self.assertEqual(self.asset()['verificacion']['custodio'], 2)
        self.select(cust='1')
        self.page.locator('#fe').select_option('alerta')
        expect(self.page.locator('#lista [data-bien="INV-00100"]')).to_contain_text('Revisar asignación')

    def test_ubicacion_distinta_alerta_sin_mover(self):
        self.select(ubic='Oficina 5')
        self.scan()
        expect(self.result.locator('[role="alert"]')).to_contain_text('Ubicación distinta')
        expect(self.result.locator('[role="alert"]')).not_to_contain_text('Custodio distinto')
        expect(self.result).to_contain_text('Laboratorio 2')
        expect(self.result).to_contain_text('Oficina 5')
        self.assert_catalog()

    def test_ambas_diferencias_permanecen_al_pasar_al_siguiente(self):
        self.select(ubic='Oficina 5', cust='2')
        self.scan()
        expect(self.result.locator('[role="alert"]')).to_contain_text('Ubicación distinta y Custodio distinto')
        self.scan('INV-00101')
        expect(self.result).to_contain_text('coinciden')
        expect(self.page.locator('#alertas-revision')).to_contain_text('INV-00100')
        self.assert_catalog()
        self.go('panel')
        expect(self.page.locator('.stat b')).to_have_text(['48', '2', '46', '4%', '1'])
        self.go('levantamiento')
        self.select(ubic='Oficina 5', cust='2')
        expect(self.page.locator('#alertas-revision')).to_contain_text('INV-00100')

    def test_inventario_desconocido_y_vacio_no_crean_bienes(self):
        self.select()
        self.scan('INEXISTENTE-999')
        expect(self.page.locator('#revision-error')).to_contain_text('no existe en la hoja')
        expect(self.inv).to_have_value('INEXISTENTE-999')
        self.assert_catalog()
        self.scan('   ')
        expect(self.page.locator('#revision-error')).to_contain_text('Escribe el número')
        self.scan('')
        self.assertTrue(self.inv.evaluate('(input) => input.validity.valueMissing'))
        self.assertEqual(self.asset()['estado'], 'pendiente')
        self.scan()
        expect(self.result).to_contain_text('coinciden')

    def test_correccion_explicita_resuelve_alerta_y_conserva_evidencia(self):
        self.select(ubic='Oficina 5', cust='2')
        self.scan()
        before = self.asset()
        self.result.locator('[data-editar]').click()
        expect(self.page.locator('#edicion-custodio')).to_have_value('2')
        expect(self.page.locator('#edicion-ubic')).to_have_value('Oficina 5')
        self.assert_catalog()
        self.page.get_by_role('button', name='Guardar corrección', exact=True).click()
        after = self.asset()
        self.assertEqual(after['custodio'], 2)
        self.assertEqual(after['ubic'], 'Oficina 5')
        self.assertEqual(after['verificacion'], before['verificacion'])
        self.assertEqual(after['verificacion']['registrada'], {'custodio': 1, 'ubic': 'Laboratorio 2'})
        self.assertEqual(after['desc'], before['desc'])
        self.assertEqual(after['obs'], before['obs'])
        expect(self.page.locator('#alertas-revision')).to_be_hidden()
        expect(self.result).to_contain_text('coinciden')
        expect(self.result).to_contain_text('Asignación al comprobar el bien, antes de corregir: Ana Torres · Laboratorio 2')
        self.go('reportes')
        expect(self.page.locator('#reporte-discrepancias h3')).to_have_text('Bienes con discrepancias (0)')

    def test_edicion_invalida_conserva_campos_y_cancelacion(self):
        self.select()
        before = self.asset()
        self.page.locator('[data-bien="INV-00100"] [data-editar]').click()
        self.page.locator('#edicion-inv').fill(' inv-00101 ')
        self.page.locator('#edicion-ubic').select_option('Oficina 5')
        self.page.get_by_role('button', name='Guardar corrección', exact=True).click()
        expect(self.page.locator('#edicion-error')).to_contain_text('ya existe')
        expect(self.page.locator('#edicion-inv')).to_have_value(' inv-00101 ')
        expect(self.page.locator('#edicion-ubic')).to_have_value('Oficina 5')
        self.assertEqual(self.asset(), before)
        self.page.locator('#edicion-inv').fill('')
        self.page.get_by_role('button', name='Guardar corrección', exact=True).click()
        self.assertTrue(self.page.locator('#edicion-inv').evaluate('(input) => input.validity.valueMissing'))
        self.page.locator('#cancelar-edicion').click()
        expect(self.page.locator('#editar-asignacion')).to_be_hidden()
        expect(self.inv).to_be_focused()
        self.assertEqual(self.asset(), before)

    def test_corregir_hoja_sin_revisar_no_marca_encontrado(self):
        self.select()
        self.page.locator('[data-bien="INV-00100"] [data-editar]').click()
        self.page.locator('#edicion-custodio').select_option('2')
        self.page.get_by_role('button', name='Guardar corrección', exact=True).click()
        self.assertEqual(self.asset()['estado'], 'pendiente')
        self.assertNotIn('verificacion', self.asset())

    def test_no_encontrado_y_pendiente(self):
        self.select()
        card = self.page.locator('[data-bien="INV-00100"]')
        card.locator('[data-e="no"]').click()
        self.go('reportes')
        expect(self.page.locator('#reporte-discrepancias tbody')).to_contain_text('No encontrado')
        self.go('levantamiento')
        self.select()
        card.locator('[data-e="pendiente"]').click()
        self.assertEqual(self.asset()['estado'], 'pendiente')
        self.assertNotIn('verificacion', self.asset())

    def test_reporte_y_csv_incluyen_asignacion_registrada_y_observada(self):
        self.select(ubic='Oficina 5', cust='2')
        self.scan()
        self.go('reportes')
        report = self.page.locator('#reporte-discrepancias')
        expect(report.locator('h3')).to_have_text('Bienes con discrepancias (1)')
        expect(report.locator('tbody tr')).to_have_count(1)
        expect(report).to_contain_text('Ana Torres')
        expect(report).to_contain_text('Luis Ramírez')
        expect(report).to_contain_text('Laboratorio 2')
        expect(report).to_contain_text('Oficina 5')
        expect(report).to_contain_text('Encontrado')
        with self.page.expect_download() as download_info:
            self.page.locator('#csv').click()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'discrepancias.csv'
            download_info.value.save_as(path)
            with path.open(encoding='utf-8-sig', newline='') as stream:
                rows = list(csv.reader(stream))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1][0], 'INV-00100')
        self.assertEqual(rows[1][2:8], ['Ana Torres', 'Luis Ramírez', 'Laboratorio 2', 'Oficina 5', 'Encontrado', 'Ubicación distinta y Custodio distinto'])

    def test_vista_movil_y_revision_desde_boton(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.select()
        self.page.locator('[data-bien="INV-00100"] [data-e="encontrado"]').click()
        expect(self.result).to_contain_text('coinciden')
        self.assertEqual(self.asset()['estado'], 'encontrado')
        self.select(ubic='Oficina 5', cust='2')
        self.scan()
        expect(self.result.locator('[role="alert"]')).to_be_visible()
        for locator in [self.inv, self.page.locator('#fu'), self.page.locator('#fc')]:
            box = locator.bounding_box()
            self.assertGreaterEqual(box['x'], 0)
            self.assertLessEqual(box['x'] + box['width'], 390)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)


if __name__ == '__main__':
    unittest.main(verbosity=2)
