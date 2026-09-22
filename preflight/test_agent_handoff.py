import json
import threading
import unittest
from http.client import HTTPConnection
from http.server import HTTPServer
from pathlib import Path
from delivery_note.app import Handler
ROOT=Path(__file__).resolve().parents[1]
class AgentHandoff(unittest.TestCase):
 def setUp(self):
  self.server=HTTPServer(('127.0.0.1',0),Handler);self.server.remaining_calls=2;self.server.agent_review=True;self.server.jobs={}
  self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
  self.sample=json.loads((ROOT/'delivery_note/web/semantic-sample.json').read_text(encoding='utf-8'))
  self.raw=json.loads((ROOT/'delivery_note/web/semantic-recording.json').read_text(encoding='utf-8'))['response']
 def tearDown(self):
  self.server.shutdown();self.server.server_close();self.thread.join()
 def request(self,method,path,body=None,origin=None):
  c=HTTPConnection('127.0.0.1',self.server.server_port,timeout=10);headers={'Content-Type':'application/json'}
  if origin:headers['Origin']=origin
  c.request(method,path,None if body is None else json.dumps(body),headers);r=c.getresponse();result=(r.status,json.loads(r.read()));c.close();return result
 def test_consent_and_cross_site_boundaries(self):
  self.assertEqual(self.request('POST','/api/general-review',{'objective':self.sample['objective'],'documents':self.sample['documents'],'consent':False})[0],400)
  self.assertEqual(self.request('GET','/api/agent-jobs',origin='https://foreign.invalid')[0],403)
  self.assertEqual(self.server.remaining_calls,2);self.assertEqual(self.server.jobs,{})
 def test_queue_validate_complete_and_prevent_overwriting(self):
  status,queued=self.request('POST','/api/general-review',{'objective':self.sample['objective'],'documents':self.sample['documents'],'consent':True});self.assertEqual(status,202)
  path='/api/agent-jobs/'+queued['job_id'];self.assertEqual(self.request('GET',path)[1]['status'],'awaiting_agent')
  bad={**self.raw,'packet_id':'wrong'};self.assertEqual(self.request('POST',path,{'response':bad})[0],400)
  status,result=self.request('POST',path,{'response':self.raw});self.assertEqual(status,200)
  self.assertEqual(result['report']['status'],'advisory_needs_correction');self.assertTrue(result['report']['verification']['quotes_match'])
  self.assertFalse(result['provenance']['live_api_verified']);self.assertEqual(self.request('POST',path,{'response':self.raw})[0],409)
  self.assertEqual(self.request('GET',path)[1]['status'],'complete');self.assertEqual(self.server.remaining_calls,1)
