# Delivery Note — evidence report

**criteria_satisfied**

## Customer objective
将原始订单按 order_id 去重，保留第一次出现的记录，去掉所有字段两端空格，保持顺序。应交付4笔订单，原值不得篡改；summary.json 的 total 应等于交付明细 amount 合计。

Created: 2026-09-22T05:31:38.154Z
Engine: 0.2.0
Snapshot: d6b44f39d4230ad4646409ae9d00aceeafbe6ddf3540e0ef7fe0af37a7d76f2c

Mandatory criteria: 5/5 passed; 0 failed; 0 unverified.

## Results

### R1 · pass · Required order columns / 订单字段完整
Layer 2; mandatory; evidence: E001

### R2 · pass · Four delivered orders / 交付4笔订单
Layer 3; mandatory; evidence: E002

### R3 · pass · No repeated order IDs / 订单号不重复
Layer 3; mandatory; evidence: E003

### R4 · pass · Every cell matches the intended transformation / 按客户规则逐格核对
Layer 3; mandatory; evidence: E004

### R5 · pass · Summary agrees with delivered amounts / 汇总与明细金额一致
Layer 3; mandatory; evidence: E005

## Evidence

### E001 / R1 / csv_columns
Required columns found: order_id, customer, amount
- orders.csv (deliverable) SHA-256 2c365c9dc654d58d3450c306efac2d19bf9d7dc441d0baf12cd22990fbf7a45c

### E002 / R2 / csv_row_count
Parsed data records (header excluded): 4; expected: 4
- orders.csv (deliverable) SHA-256 2c365c9dc654d58d3450c306efac2d19bf9d7dc441d0baf12cd22990fbf7a45c

### E003 / R3 / csv_unique
Checked 4 CSV records against csv_unique on order_id
- orders.csv (deliverable) SHA-256 2c365c9dc654d58d3450c306efac2d19bf9d7dc441d0baf12cd22990fbf7a45c

### E004 / R4 / csv_transform
Independently recomputed from 5 source records: expected 4, delivered 4. Every output cell matches the declared trim/deduplicate-first recipe.
- orders.csv (deliverable) SHA-256 2c365c9dc654d58d3450c306efac2d19bf9d7dc441d0baf12cd22990fbf7a45c
- source.csv (reference) SHA-256 ca39005a80a2fdce62b9d3acd84404ac9ae0cfe117b299f4b861dd6afdbd304b

### E005 / R5 / sum_matches_json
Source CSV sum (amount, 4 records): 425; delivered JSON /total: 425. Source agreement, not external truth.
- summary.json (deliverable) SHA-256 0a59a66744f9fa4f87dacd2e9fdc9bfa011a757a20caac2f80577fb6e9999dfd
- orders.csv (deliverable) SHA-256 2c365c9dc654d58d3450c306efac2d19bf9d7dc441d0baf12cd22990fbf7a45c

## File inventory
- source.csv | reference | 111 bytes | SHA-256 ca39005a80a2fdce62b9d3acd84404ac9ae0cfe117b299f4b861dd6afdbd304b
- orders.csv | deliverable | 88 bytes | SHA-256 2c365c9dc654d58d3450c306efac2d19bf9d7dc441d0baf12cd22990fbf7a45c
- summary.json | deliverable | 28 bytes | SHA-256 0a59a66744f9fa4f87dacd2e9fdc9bfa011a757a20caac2f80577fb6e9999dfd

## Limits
- Conclusions apply only to these byte hashes, objective and declared acceptance criteria.
- Source agreement is not independent verification of real-world truth, customer acceptance, receipt or payment.
- No arbitrary code, authenticated website, production API, PDF or Office document verification is provided.
- Browser execution is an isolated offline sample journey, not a security certification or complete production test.