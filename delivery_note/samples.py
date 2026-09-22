"""Fixed, synthetic examples. No user/customer files are sent to SERV."""
from copy import deepcopy


def examples():
    base = {
        "example_only": True,
        "rows": {"input": 120, "kept": 113, "duplicates": 5, "rejected": 2},
        "tests": {"passed": 8, "failed": 0, "skipped": 0, "total": 8},
        "files": [{"name": "synthetic-output.csv", "sha256": "a" * 64}],
        "claims": ["ready_for_review"],
    }
    clean, missing, payment = (deepcopy(base) for _ in range(3))
    missing["rows"]["kept"] = 112
    payment["claims"] = ["paid", "customer_accepted"]
    return {
        "balanced": {"title": "Ready for review", "caption": "Every reported row is accounted for.", "packet": clean},
        "missing-row": {"title": "One row is missing", "caption": "A success message would hide a mismatch.", "packet": missing},
        "unproven-payment": {"title": "A claim needs a receipt", "caption": "A self-reported payment is not proof.", "packet": payment},
    }
