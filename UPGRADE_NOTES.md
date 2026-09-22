# Delivery Note v0.2 — scope and verification

2026-09-22. Original baseline: 8b009ae. The implementation was committed locally as eda3396 before this publication follow-up.

## What works

Customer purpose → explicit acceptance conditions → actual file bytes and source recomputation → optional isolated static-web execution → evidence-backed criterion report. The browser is one adapter, not the product boundary; see PRODUCT_SCOPE.md.

18 Python tests and 12 Node tests passed for the implementation. Additional local UI, static-hosting and browser evidence is in verification/. Synthetic same-count corruption (50 changed to 500) was caught by independent source recomputation. Correct data passed its declared contract. A broken quotation page failed discount and zero-quantity assertions; a correct page passed normal, discount and invalid-input journeys.

These are functional checks on synthetic examples, not an accuracy benchmark on unknown customer deliveries. Currently supported inputs are UTF-8 text, CSV, JSON and offline static-web assets. Arbitrary programs, production services, Office/PDF and independent real-world source authentication remain outside this release.

## AI and publication boundaries

Original recorded SERV responses remain available under legacy/. New planning and explanation interfaces have substitute-response tests, which do not establish live model quality. Browser-console testing is a separate validation path and does not establish the application's backend integration.

The public static client performs fresh file checks without automatic uploads. It does not execute the local browser runner or make live SERV requests. No repeat contest entry, account-setting change, customers, revenue or award is implied. Publication state is established by repository history and the GitHub Pages deployment, not by a local commit alone.

## Follow-up scope correction

The README, interface and PRODUCT_SCOPE.md now explicitly identify the product as general-purpose delivery review. Broader goal coverage, document/content reasoning, program behavior and full-system workflows are next priorities, not more website-only demonstrations.
