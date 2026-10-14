import pytest
from app.quiz import bkt, valid, diagnose_misconception

def test_bkt_convergence():
    # Test that consecutive correct answers drive mastery towards 1.0
    p = 0.2
    for _ in range(5):
        p = bkt(p, True)
    assert p > 0.85

    # Test that consecutive incorrect answers drive mastery down
    p_fail = 0.8
    for _ in range(4):
        p_fail = bkt(p_fail, False)
    assert p_fail < 0.40

def test_misconception_diagnosis_heuristic():
    diag = diagnose_misconception(
        llm=None,
        question="Which organelle generates ATP?",
        options=["Nucleus", "Ribosome", "Mitochondria", "Golgi"],
        correct_idx=2,
        student_idx=1,
        explanation="Mitochondria produce ATP through oxidative phosphorylation."
    )
    assert isinstance(diag, str)
    assert "Ribosome" in diag or "Mitochondria" in diag
