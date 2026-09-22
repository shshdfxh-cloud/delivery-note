# Delivery Note

Catch inconsistent delivery claims before they reach a client. A small, working SERV Reasoning demo for software and data handoffs.

[Interactive demo](https://shshdfxh-cloud.github.io/delivery-note/) · [SERV integration reference](https://docs.openserv.ai/serv-reasoning/sdk-integration)

## What it does

1. Checks a synthetic delivery packet: do the row counts balance, are the reported tests complete, and is the inventory well formed?
2. Separates internal consistency from claims that need outside evidence, including payment and customer acceptance.
3. Sends only derived facts and findings to SERV, which writes a short draft citing the evidence IDs.
4. Displays the deterministic verdict beside the AI draft and exports both with the original synthetic packet.

Three examples demonstrate a balanced handoff, a missing row, and an unverified payment claim. This prototype does **not** authenticate real file bytes, test execution, external delivery, acceptance, or payments. It is not a production accounting or verification service.

## Public replay and live inference

The public demo explicitly replays three **real SERV responses recorded on September 22, 2026**. It does not make API calls or need a visitor's key. The request IDs, timestamps, model, token usage, facts and responses are in `docs/examples.json` and the matching package asset. All inputs are synthetic; the file hash is a placeholder.

For live inference, use Python 3.10+ and your own SERV key in the server environment:

```sh
export SERV_API_KEY="your-own-key"
python -m delivery_note.app
```

On Windows PowerShell, set `$env:SERV_API_KEY` instead of `export`. Open `http://127.0.0.1:8766`, select a scenario and click **Review with SERV**. Requests use `https://inference-api.openserv.ai/v1/chat/completions` with `gpt-5.6-luna` and a 2,048 completion-token cap. No additional Python packages are required.

The server binds to loopback, accepts only the three built-in sample IDs, checks Host/Origin, never sends arbitrary uploads, and limits each default session to three API attempts including failures. `--max-calls 1` reduces this to one; the maximum allowed is six. This is a per-process limit, not a lifetime account spending cap. API calls use the key owner's provider balance. There is no retry, payment, top-up or card integration. Keep the key outside the repo; it never goes into frontend code.

To run only the free static replay locally:

```sh
python -m http.server 8767 --directory docs
```

## Validation

```sh
python -m unittest discover -s preflight -p "test_delivery_note*.py" -v
```

12 tests cover count mismatches, incomplete tests, unsupported payment claims, material sent to SERV, truncated/provider failures, rejected arbitrary requests and exhausted call limits. A live browser → local server → SERV → browser run was also completed on September 22. Replaying saved responses is not a new model request or an independent accuracy evaluation.

## Why this project

Small freelance deliveries often end with a confident message and an ambiguous evidence packet. Delivery Note makes missing evidence visible before generating the message. A future useful extension would verify uploaded file bytes and imported test results, with explicit data consent. Those features are not implemented here. There are no claimed customers, sales, or proven revenue.

Built for the September 2026 SERV Hackathon Open Track. Entry status and awards are not implied by this repository. MIT licensed.
