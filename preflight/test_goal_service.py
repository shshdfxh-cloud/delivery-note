import io
import json
import os
import threading
import unittest
from http.client import HTTPConnection
from http.server import HTTPServer
from pathlib import Path
from unittest.mock import patch

from delivery_note.app import Handler
from delivery_note.goal_serv import propose

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((ROOT / 'delivery_note/web/cases.json').read_text(encoding='utf-8'))['cases']


class GoalServiceTests(unittest.TestCase):
    def setUp(self):
        self.server = HTTPServer(('127.0.0.1', 0), Handler)
        self.server.remaining_calls = 1
        self.worker = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.worker.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.worker.join()

    def request(self, path, body, origin=None):
        connection = HTTPConnection('127.0.0.1', self.server.server_port, timeout=15)
        headers = {'Content-Type': 'application/json'}
        if origin:
            headers['Origin'] = origin
        connection.request('POST', path, body=json.dumps(body), headers=headers)
        response = connection.getresponse()
        result = response.status, json.loads(response.read())
        connection.close()
        return result

    def test_actual_bytes_are_recomputed_by_server_not_a_client_verdict(self):
        status, report = self.request('/api/audit', {'package': CASES[0]['package'], 'status': 'criteria_satisfied'})
        self.assertEqual(status, 200)
        self.assertEqual(report['status'], 'needs_correction')
        self.assertEqual(report['results'][3]['status'], 'fail')

    def test_cross_site_and_missing_execution_consent_block_before_browser(self):
        with patch('delivery_note.app.run_browser') as runner:
            self.assertEqual(self.request('/api/audit', {'package': CASES[2]['package']}, origin='https://evil.invalid')[0], 403)
            self.assertEqual(self.request('/api/audit', {'package': CASES[2]['package'], 'execute_browser': True})[0], 400)
            runner.assert_not_called()

    def test_no_provider_call_without_explicit_data_consent(self):
        with patch('delivery_note.app.propose') as provider, patch.dict(os.environ, {'SERV_API_KEY': 'synthetic-test-key'}):
            self.assertEqual(self.request('/api/plan', {'package': CASES[1]['package']})[0], 400)
            provider.assert_not_called()
            self.assertEqual(self.server.remaining_calls, 1)

    def test_failure_consumes_only_one_bounded_provider_attempt(self):
        with patch.dict(os.environ, {'SERV_API_KEY': 'synthetic-test-key'}), patch('delivery_note.app.propose', side_effect=RuntimeError('SERV unavailable')) as provider:
            body = {'package': CASES[1]['package'], 'consent': True}
            self.assertEqual(self.request('/api/plan', body)[0], 502)
            self.assertEqual(self.request('/api/plan', body)[0], 429)
            self.assertEqual(provider.call_count, 1)

    def test_browser_unavailable_is_reported_as_unverified_not_pass(self):
        with patch('delivery_note.app.run_browser', side_effect=RuntimeError('Browser not installed')):
            status, report = self.request('/api/audit', {'package': CASES[3]['package'], 'execute_browser': True, 'execution_consent': True})
            self.assertEqual(status, 200)
            self.assertEqual(report['status'], 'not_proven')
            self.assertIn('not installed', report['runtime_warning'])


class PlannerMaterialTests(unittest.TestCase):
    def test_planner_sends_structure_not_secret_file_contents_and_does_not_accept_assumptions(self):
        captured = []
        def opener(request, timeout):
            captured.append(json.loads(request.data))
            self.assertEqual(timeout, 60)
            content = json.dumps({'requirements': [{'id': 'R1', 'title': 'Outcome', 'critical': True, 'check': {'type': 'manual', 'reason': 'Need proof'}}], 'assumptions': ['Unconfirmed external fact']})
            return io.StringIO(json.dumps({'choices': [{'finish_reason': 'stop', 'message': {'content': content}}]}))
        package = {'objective': 'Review quotation', 'profile': 'web', 'files': [{'name': 'index.html', 'role': 'deliverable', 'content': '<input id="quantity" value="SECRET_CUSTOMER_VALUE"><script>const key="SECRET_CODE_VALUE"</script>'}]}
        result = propose(package, [{'name': 'index.html', 'role': 'deliverable'}], api_key='SECRET_API_KEY', opener=opener)
        material = captured[0]['messages'][1]['content']
        self.assertIn('quantity', material)
        for secret in ['SECRET_CUSTOMER_VALUE', 'SECRET_CODE_VALUE', 'SECRET_API_KEY', '<script>']:
            self.assertNotIn(secret, material)
        self.assertEqual(result['requirements'][-1]['check']['type'], 'manual')
        self.assertTrue(result['requirements'][-1]['critical'])


if __name__ == '__main__':
    unittest.main()
