from app.quiz import bkt, valid
def test_bkt_direction():
    assert bkt(0.3, True) > 0.3 > bkt(0.3, False) - 0.15 and bkt(0.3, True) > bkt(0.3, False)
def test_validation():
    q = {"question": "q", "options": ["a", "b", "c", "d"], "correct_index": 2, "concept": "x", "explanation": "e"}
    assert valid(q) and not valid({**q, "options": ["a", "a", "c", "d"]}) and not valid({**q, "correct_index": 9})
