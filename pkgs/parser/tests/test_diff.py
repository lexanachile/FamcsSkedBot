"""Exercise pure diff logic without credentials or importing Google/Excel clients."""
import ast
import re
import unittest
from itertools import zip_longest
from pathlib import Path
from typing import Dict, List

source = ast.parse((Path(__file__).parents[1] / 'parser.py').read_text(encoding='utf-8'))
function = next(node for node in source.body if isinstance(node, ast.FunctionDef) and node.name == '_format_group_diff')
namespace = dict(re=re, zip_longest=zip_longest, Dict=Dict, List=List)
exec(compile(ast.Module(body=[function], type_ignores=[]), 'parser.py', 'exec'), namespace)
diff = namespace['_format_group_diff']


class DiffTests(unittest.TestCase):
    def setUp(self):
        self.lesson = dict(course=1, groupName='1', dayOfWeek=1, startTime='08:15', endTime='09:35',
                           classTitleA='Алгебра', professorNameA='Иванов', classroomA='101', isCommon=1)

    def test_multiple_lessons_at_same_time_do_not_hide_a_change(self):
        alternative = dict(self.lesson, classTitleA='Анализ')
        result = diff('1', [self.lesson, alternative], [dict(self.lesson, classroomA='102'), alternative])
        self.assertIn('101 → 102', result)
        self.assertNotIn('Анализ', result)

    def test_reordering_alternatives_is_not_a_change(self):
        alternative = dict(self.lesson, classTitleA='Анализ')
        self.assertEqual(diff('1', [self.lesson, alternative], [alternative, self.lesson]), '')

    def test_comments_and_lesson_type_changes_are_reported(self):
        result = diff('1', [self.lesson], [dict(self.lesson, comments='Только 21 сентября')])
        self.assertIn('Только 21 сентября', result)
        result = diff('1', [self.lesson], [dict(self.lesson, isLecture=1)])
        self.assertIn('Практика', result)
        self.assertIn('Лекция', result)

    def test_single_room_change_keeps_existing_format(self):
        result = diff('1', [self.lesson], [dict(self.lesson, classroomA='102')])
        self.assertIn('Смена аудитории:', result)
        self.assertIn('101 → 102 ауд.', result)


if __name__ == '__main__':
    unittest.main()
