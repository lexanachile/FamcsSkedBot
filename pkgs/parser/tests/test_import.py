"""Exercise silent imports and the baseline used by subsequent scheduled runs."""
import copy
import io
import os
import runpy
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import Mock, mock_open, patch


PARSER_PATH = Path(__file__).parents[1] / 'parser.py'
TEST_ENV = {
    'GOOGLE_SERVICE_ACCOUNT_JSON': '{}',
    'DRIVE_FOLDER_ID': 'test-folder',
    'BACKEND_URL': 'https://backend.invalid',
    'BACKEND_AUTH_TOKEN': 'test-token',
}


class ImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.dict(os.environ, TEST_ENV):
            cls.namespace = runpy.run_path(str(PARSER_PATH))

    def setUp(self):
        self.old = dict(course=1, groupName='1', dayOfWeek=1,
                        startTime='08:15', endTime='09:35', isCommon=1,
                        classTitleA='Алгебра', professorNameA='Иванов', classroomA='101')
        self.new = dict(self.old, classroomA='102')
        self.groups = {'1': self.entry([self.old], 'old')}
        self.records = {'1': [self.old]}
        self.calls = []

    def entry(self, records, version):
        return dict(version=version, previousVersion=None, updatedAt='test',
                    fingerprint=self.namespace['_group_fingerprint'](records),
                    recordCount=len(records))

    def post_import(self, url, headers, payload):
        self.calls.append(copy.deepcopy(payload))
        mode = payload['mode']
        if mode == 'state':
            return {'data': {'groups': copy.deepcopy(self.groups)}}
        if mode == 'group-state':
            return {'data': {'records': self.records[payload['group']]}}
        if mode == 'group':
            self.records[payload['group']] = payload['classes']
            return {'data': {'entry': self.entry(payload['classes'], 'new')}}
        if mode == 'finalize':
            self.groups = copy.deepcopy(payload['groups'])
            return {'version': payload['importId']}
        self.fail(f'Unexpected mode: {mode}')

    def send(self, records, **kwargs):
        function = self.namespace['send_to_backend']
        with patch.dict(function.__globals__, {'_post_import': self.post_import}), \
                redirect_stdout(io.StringIO()):
            function(records, 1, **kwargs)

    def test_silent_import_updates_baseline_without_later_resending(self):
        self.send([self.new], send_notifications=False)
        self.assertEqual([call['mode'] for call in self.calls], ['state', 'group', 'finalize'])
        self.assertFalse(self.calls[-1]['notify'])
        self.assertEqual(self.calls[-1]['notifications'], {})
        self.assertEqual(self.groups['1']['fingerprint'], self.entry([self.new], 'new')['fingerprint'])

        self.calls.clear()
        self.send([self.new], send_notifications=True)
        self.assertEqual([call['mode'] for call in self.calls], ['state'])

        self.calls.clear()
        self.send([dict(self.new, classroomA='103')], send_notifications=True)
        message = self.calls[-1]['notifications']['1']
        self.assertIn('102 → 103', message)
        self.assertNotIn('101', message)

    def test_notifications_stay_enabled_by_default(self):
        self.send([self.new])
        self.assertTrue(self.calls[-1]['notify'])
        self.assertIn('101 → 102', self.calls[-1]['notifications']['1'])

    def test_silent_group_removal_is_published(self):
        removed = dict(self.old, groupName='2')
        self.groups['2'] = self.entry([removed], 'removed')
        self.records['2'] = [removed]
        self.send([self.old], send_notifications=False)
        self.assertEqual([call['mode'] for call in self.calls], ['state', 'finalize'])
        self.assertEqual(set(self.groups), {'1'})
        self.assertEqual(self.calls[-1]['notifications'], {})

    def test_silent_incomplete_import_keeps_missing_groups(self):
        removed = dict(self.old, groupName='2')
        self.groups['2'] = self.entry([removed], 'removed')
        self.send([self.new], allow_removals=False, send_notifications=False)
        self.assertEqual(set(self.groups), {'1', '2'})
        self.assertEqual(self.calls[-1]['notifications'], {})

    def test_environment_flag(self):
        for value, expected in (('true', True), ('false', False), (' TRUE ', True), ('', False)):
            with self.subTest(value=value), patch.dict(os.environ, {**TEST_ENV, 'SEND_NOTIFICATIONS': value}):
                namespace = runpy.run_path(str(PARSER_PATH))
                self.assertIs(namespace['SEND_NOTIFICATIONS'], expected)

    def test_main_passes_notification_flag_to_import(self):
        function = self.namespace['main']
        for notify in (False, True):
            send = Mock()
            replacements = dict(
                SEND_NOTIFICATIONS=notify,
                get_drive_service=Mock(return_value=object()),
                list_files_in_folder=Mock(return_value=[{'id': 'test', 'name': '1 курс.xlsx'}]),
                read_file_as_bytes=Mock(return_value=b'test'),
                parse_excel_file=Mock(return_value=[self.new]),
                send_to_backend=send,
            )
            with self.subTest(notify=notify), patch.dict(function.__globals__, replacements), \
                    patch('builtins.open', mock_open()), redirect_stdout(io.StringIO()):
                function()
            send.assert_called_once_with([self.new], 1, allow_removals=True, send_notifications=notify)


if __name__ == '__main__':
    unittest.main()
