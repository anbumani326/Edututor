from app.evaluation import score_cases
def test_scoring():
    fake = lambda q: [("Deadlocks.pdf", 17, 0.9)] if "safe" in q else []
    m, d = score_cases([("safe state?", "deadlocks", 17), ("safe state?", "deadlocks", 99), ("latest Windows?", "", None)], fake)
    assert m["retrieval_hit_rate"] == 0.5 and m["top1_citation_accuracy"] == 0.5 and m["unsupported_refusal_rate"] == 1.0
