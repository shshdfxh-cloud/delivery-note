import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from delivery_note.checker import inspect_packet


class EvidenceChecks(unittest.TestCase):
    def setUp(self):
        self.packet = json.loads((ROOT / 'delivery_note/synthetic_example.json').read_text(encoding='utf-8'))

    def test_consistent_packet_only_claims_internal_review(self):
        result = inspect_packet(self.packet)
        self.assertEqual(result['status'], 'ready_for_human_review')
        self.assertIn('Not authentication', result['scope'])

    def test_missing_rows_cannot_be_hidden_in_a_success_note(self):
        self.packet['rows']['kept'] -= 1
        result = inspect_packet(self.packet)
        self.assertEqual(result['status'], 'needs_correction')
        self.assertIn('row_balance', [f['id'] for f in result['findings']])

    def test_boolean_negative_and_string_are_not_counts(self):
        for bad in [True, -1, '120']:
            packet = copy.deepcopy(self.packet)
            packet['rows']['input'] = bad
            self.assertEqual(inspect_packet(packet)['status'], 'needs_correction')

    def test_skipped_tests_and_duplicate_inventory_need_correction(self):
        self.packet['tests'] = {'passed':7,'failed':0,'skipped':1,'total':8}
        self.packet['files'] *= 2
        result = inspect_packet(self.packet)
        self.assertEqual({f['id'] for f in result['findings']}, {'tests_incomplete','duplicate_file'})

    def test_payment_and_acceptance_are_not_proven_by_self_report(self):
        self.packet['claims'] = ['paid','customer_accepted']
        result = inspect_packet(self.packet)
        self.assertEqual(result['status'], 'needs_external_confirmation')
        self.assertEqual(result['findings'][0]['id'], 'external_confirmation')


if __name__ == '__main__':
    unittest.main()
