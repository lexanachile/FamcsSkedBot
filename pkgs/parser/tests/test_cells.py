"""Check module startup and Excel values without network requests or real secrets."""
import io
import os
import runpy
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from openpyxl import Workbook, load_workbook


class CellTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Execute module definitions too: AST-only tests miss broken imports.
        with patch.dict(os.environ, {
            'GOOGLE_SERVICE_ACCOUNT_JSON': '{}',
            'DRIVE_FOLDER_ID': 'test-folder',
            'BACKEND_URL': '',
            'BACKEND_AUTH_TOKEN': '',
        }), redirect_stdout(io.StringIO()):
            cls.namespace = runpy.run_path(
                str(Path(__file__).parents[1] / 'parser.py'))

    def test_cell_values(self):
        ws = Workbook().active
        for value, expected in (
            (None, None),
            (101, '101'),
            (101.0, '101'),
            (0.0, '0'),
            (-101.0, '-101'),
            (101.5, '101.5'),
            ('0101', '0101'),
            ('130 ФМО', '130 ФМО'),
            (True, 'True'),
        ):
            with self.subTest(value=value):
                ws['A1'] = value
                self.assertEqual(
                    self.namespace['get_cell_value'](ws, 1, 1), expected)

    def test_merged_numeric_cell(self):
        ws = Workbook().active
        ws.merge_cells('A1:B2')
        ws['A1'] = 101.0
        self.assertEqual(self.namespace['get_cell_value'](ws, 2, 2), '101')

    def test_empty_merged_cell(self):
        ws = Workbook().active
        ws.merge_cells('A1:B2')
        self.assertIsNone(self.namespace['get_cell_value'](ws, 2, 2))

    def test_classroom_normalization(self):
        for value, expected in (
            (None, None), ('  ', None),
            (105, '105'), (105.0, '105'),
            ('105.0', '105'), ('105.00', '105'),
            ('0105.0', '0105'),
            (' 105.0  ФМО ', '105 ФМО'),
            ('105.0; 106.0', '105; 106'),
            ('105.0/106.0', '105/106'),
            ('105.0а', '105а'),
            ('105.5', '105.5'), ('105.05', '105.05'),
            ('05.09', '05.09'), ('05.01.2026', '05.01.2026'),
            ('105а', '105а'), ('130 ФМО', '130 ФМО'),
        ):
            with self.subTest(value=value):
                self.assertEqual(self.namespace['normalize_classroom'](value), expected)

    def test_classroom_output_after_xlsx_roundtrip(self):
        for value, expected in (
            (105.0, '105'), ('105.0', '105'),
            ('105.0 ФМО', '105 ФМО'),
            ('105.0; 106.0', '105; 106'),
            ('105.05', '105.05'),
        ):
            for layout in ('subgroups', 'merged-room', 'lecture'):
                with self.subTest(value=value, layout=layout):
                    ws = Workbook().active
                    ws['A1'] = 'Предмет 2.0'
                    ws['A3'] = 'Иванов'
                    options = {}
                    if layout == 'lecture':
                        ws.merge_cells('A1:D2')
                        ws['C4'] = value
                        options = dict(lecture_coverage_start=1, lecture_coverage_end=4)
                    else:
                        ws['B1'] = 'Предмет 2.0'
                        ws['B3'] = 'Иванов'
                        ws['A4'] = value
                        if layout == 'merged-room':
                            ws.merge_cells('A4:B4')
                        else:
                            ws['B4'] = '107.0'
                    stream = io.BytesIO()
                    ws.parent.save(stream)
                    stream.seek(0)
                    sheet = load_workbook(stream, data_only=True).active
                    lesson = self.namespace['extract_class'](
                        sheet, (1, 1, 4, 2), '1', 3, 1, '08:15-09:35', **options)[0]
                    self.assertEqual(lesson['classroomA'], expected)
                    self.assertEqual(lesson['classroomB'], '107' if layout == 'subgroups' else None)
                    self.assertEqual(lesson['classTitleA'], 'Предмет 2.0')


if __name__ == '__main__':
    unittest.main()
