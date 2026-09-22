"""HTTP boundary tests with an explicitly substituted provider; no live inference."""
import json, os, threading, unittest
from pathlib import Path
from http.client import HTTPConnection
from http.server import HTTPServer
from unittest.mock import patch
from delivery_note.app import Handler
ROOT=Path(__file__).resolve().parents[1]
SAMPLE=json.loads((ROOT/'delivery_note/web/semantic-sample.json').read_text(encoding='utf-8'))
RESPONSE=json.loads((ROOT/'delivery_note/web/semantic-recording.json').read_text(encoding='utf-8'))['response']
class GeneralService(unittest.TestCase):
 def setUp(self):
  self.env=patch.dict(os.environ,{'SERV_API_KEY':'unit-test-placeholder'});self.env.start()
  self.server=HTTPServer(('127.0.0.1',0),Handler);self.server.remaining_calls=1
  self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
 def tearDown(self):
  self.server.shutdown();self.server.server_close();self.thread.join();self.env.stop()
 def request(self,data,origin=None):
  c=HTTPConnection('127.0.0.1',self.server.server_port,timeout=10)
  headers={'Content-Type':'application/json'}
  if origin:headers['Origin']=origin
  c.request('POST','/api/general-review',json.dumps(data).encode(),headers)
  r=c.getresponse();out=(r.status,json.loads(r.read()));c.close();return out
 def body(self):return {'objective':SAMPLE['objective'],'documents':SAMPLE['documents'],'consent':True}
 def test_complete_route_checks_actual_material_and_provider_quotes(self):
  with patch('delivery_note.app.call_serv',return_value=(json.dumps(RESPONSE),{'model':'substituted-for-test'})) as call:
   status,r=self.request(self.body());self.assertEqual(status,200);self.assertEqual(r['report']['status'],'advisory_needs_correction')
   self.assertTrue(r['report']['verification']['quotes_match']);self.assertEqual(call.call_count,1)
 def test_consent_and_cross_site_are_rejected_before_model(self):
  with patch('delivery_note.app.call_serv') as call:
   b=self.body();b['consent']=False;self.assertEqual(self.request(b)[0],400)
   self.assertEqual(self.request(self.body(),'https://example.invalid')[0],403);call.assert_not_called()
 def test_invalid_files_rejected_before_model(self):
  with patch('delivery_note.app.call_serv') as call:
   b=self.body();b['documents']=[{'name':'../private.txt','role':'deliverable','content':'x'}]
   self.assertEqual(self.request(b)[0],400);call.assert_not_called();self.assertEqual(self.server.remaining_calls,1)
 def test_fabricated_quote_never_becomes_a_report_and_consumes_slot(self):
  raw=json.loads(json.dumps(RESPONSE));raw['requirements'][0]['evidence'][0]['quote']='fabricated'
  with patch('delivery_note.app.call_serv',return_value=(json.dumps(raw),{})) as call:
   self.assertEqual(self.request(self.body())[0],400);self.assertEqual(self.request(self.body())[0],429);self.assertEqual(call.call_count,1)
 def test_missing_key_is_explicit_and_does_not_consume_slot(self):
  with patch.dict(os.environ,{'SERV_API_KEY':''}),patch('delivery_note.app.call_serv') as call:
   self.assertEqual(self.request(self.body())[0],503);self.assertEqual(self.server.remaining_calls,1);call.assert_not_called()
 def test_failed_provider_has_no_retry(self):
  with patch('delivery_note.app.call_serv',side_effect=RuntimeError('provider unavailable')) as call:
   self.assertEqual(self.request(self.body())[0],502);self.assertEqual(self.request(self.body())[0],429);self.assertEqual(call.call_count,1)
if __name__=='__main__':unittest.main()
