# Key-free review through the existing AI assistant

This is an integration mode for an AI assistant that already has browser tools, not an autonomous browser connection created by the web page. It does not read credentials, cookies or private key files. The optional SERV API transport remains separate.

## Start

Run `python -m delivery_note.app --agent-review --max-calls 3`, or double-click `start-browser-review.cmd`. Open the local general review page in an existing browser window. Select the customer's objective and actual materials, explicitly consent to sending those materials, inspect the preview and click the agent-review button.

## Instructions for the connected assistant (Codex / AgentDock)

1. Read `GET http://localhost:8766/api/agent-jobs` only after the user has queued an opted-in task. Respect a configured alternative port. Each pending job provides its `id`, `system`, `prompt` and material `packet_id`. Never inspect unrelated files or browser messages to fill gaps.
2. In a new TAB of the existing signed-in SERV Playground window, submit the job's system + prompt. Preserve existing drafts and tabs. Before every input or submit, verify the target tab ID, URL origin/path, intended input element and exact prepared content. Use explicit tabId plus DOM references/selectors; never fall back to global typing, active-window paste or estimated desktop coordinates. Never type project links into the assistant chat. No new browser window, profile, cookie extraction, key extraction, payment or account-setting change is needed. The comparison Playground may run both raw and SERV models; one submission is not necessarily one billed model request. Do not resubmit automatically after timeouts.
3. Read only the completed SERV-side response belonging to this job. Do not edit or fabricate model conclusions, citations, tool observations or receipts. Obtain its complete JSON and verify the packet id matches. Text pasted from a browser is not a cryptographic provider attestation.
4. Return the complete response to `POST /api/agent-jobs/{id}` with JSON `{"response": <complete model object>}`. The application independently validates exact quotes and objective fragments, rejects stale or fabricated references, executes supported bounded checks and stores one result. A completed job cannot be overwritten.
5. The page retrieves that result and exports its evidence JSON/Markdown. GET `/api/agent-jobs/{id}` can recover the result while the process remains open. Record the actual SERV observation separately; never label imported text as an authenticated API run.

Only loopback Host and same-origin browser requests are accepted. At most four jobs exist per process; the configured call limit also limits job creation. This is not an account-wide spending cap or a limit on actions performed independently by the connected assistant. Jobs and selected text are held in process memory, not persisted automatically. Uploaded programs are not executed; optional offline static-web journeys require additional explicit consent.

If no assistant is connected, the queue waits: the standalone public site does not control other websites. Use the portable copy/import flow or explicitly configure your own local SERV API instead. Never describe a queued job, recording, model statement or test double as a completed live run.

## Additional real end-to-end evidence

`verification/live-agent-request.json`, `live-agent-response.json` and `live-agent-result.json` record a real local UI → consented job → existing SERV-enhanced browser response → job return → visible report flow from 22 September. The exact packet and unique request ID were compared in the provider page. The model-selected CSV count independently returned 10 rather than the claimed 12; goal/quotation validation succeeded. Missing owner evidence stayed unverified. This is browser/connected-agent evidence, not an authenticated API receipt. The same returned material is validated again against the consolidated release in `verification/consolidated-live-result.json`.
