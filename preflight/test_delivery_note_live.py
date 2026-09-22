import io
import json
import sys
import threading
import unittest
from http.client import HTTPConnection
from http.server import HTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from delivery_note.app import Handler
from delivery_note.serv import generate


class ServBoundaries(unittest.TestCase):
    def test_only_derived_synthetic_material_is_sent(self):
        captured = []
        def opener(request, timeout):
            captured.append(json.loads(request.data))
            self.assertEqual(timeout, 60)
            return io.StringIO(json.dumps({"model":"gpt-5.6-luna", "choices":[{"finish_reason":"stop","message":{"content":"Correction required [row_balance]."}}],"usage":{"total_tokens":42}}))
        result = generate('missing-row', api_key='test-secret', opener=opener)
        payload = json.dumps(captured[0])
        self.assertNotIn('test-secret', payload)
        self.assertNotIn('synthetic-output.csv', payload)
        self.assertNotIn('a' * 64, payload)
        self.assertIn('row_balance', payload)
        self.assertEqual(captured[0]['max_completion_tokens'], 2048)
        self.assertTrue(result['serv_called'])
        self.assertEqual(result['review']['status'], 'needs_correction')

    def test_truncated_output_is_not_presented_as_complete(self):
        def opener(*args, **kwargs):
            return io.StringIO(json.dumps({'choices':[{'finish_reason':'length','message':{'content':'Partial'}}]}))
        with self.assertRaisesRegex(RuntimeError,'complete'):
            generate('balanced', api_key='test', opener=opener)

    def test_provider_failure_is_not_retried_or_leaked(self):
        with patch('delivery_note.serv.urlopen') as unused:
            calls=[]
            def opener(*args,**kwargs):
                calls.append(1)
                raise HTTPError('https://example.invalid',402,'private error detail',{},None)
            with self.assertRaisesRegex(RuntimeError,'^SERV returned HTTP 402; no automatic retry$'):
                generate('balanced', api_key='test', opener=opener)
            self.assertEqual(len(calls),1)
            unused.assert_not_called()

    def test_unknown_sample_never_calls_provider(self):
        with patch('delivery_note.serv.urlopen') as opener:
            with self.assertRaises(ValueError):
                generate('private-file',api_key='test',opener=opener)
            opener.assert_not_called()


class LocalDemoBoundaries(unittest.TestCase):
    def setUp(self):
        self.server=HTTPServer(('127.0.0.1',0),Handler)
        self.server.remaining_calls=1
        self.worker=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.worker.start()

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.worker.join()

    def request(self,body,headers=None):
        connection=HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        connection.request('POST','/api/review',body=json.dumps(body),headers=headers or {'Content-Type':'application/json'})
        response=connection.getresponse();result=(response.status,json.loads(response.read()));connection.close()
        return result

    def test_cross_site_and_arbitrary_content_rejected_before_call(self):
        with patch('delivery_note.app.generate') as provider:
            self.assertEqual(self.request({'case_id':'balanced'},{'Content-Type':'application/json','Origin':'https://example.invalid'})[0],403)
            self.assertEqual(self.request({'case_id':'balanced','packet':{'secret':'do not send'}})[0],400)
            self.assertEqual(self.request({'case_id':'other'})[0],400)
            self.assertEqual(self.server.remaining_calls,1)
            provider.assert_not_called()

    def test_failure_consumes_slot_and_next_call_is_stopped(self):
        with patch('delivery_note.app.generate',side_effect=RuntimeError('SERV returned HTTP 402; no automatic retry')) as provider:
            self.assertEqual(self.request({'case_id':'balanced'})[0],502)
            self.assertEqual(self.request({'case_id':'balanced'})[0],429)
            self.assertEqual(provider.call_count,1)

    def test_successful_live_route_returns_review(self):
        with patch('delivery_note.app.generate',return_value={'serv_called':True,'note':'Review draft'}) as provider:
            status,result=self.request({'case_id':'missing-row'})
            self.assertEqual(status,200);self.assertTrue(result['serv_called'])
            provider.assert_called_once_with('missing-row')


if __name__=='__main__':
    unittest.main()
