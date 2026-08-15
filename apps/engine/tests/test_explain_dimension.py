import pytest

from harness.tools.explain_dimension import explain_dimension


def test_valid_input_returns_explanation_unchanged():
    result = explain_dimension(
        {
            "dimension": "physical_precision",
            "score": 84,
            "evidence": {"tempo_stability": 0.03},
            "explanation": "Beat stability is extremely high (0.03).",
        }
    )
    assert result == {"explanation": "Beat stability is extremely high (0.03)."}


def test_invalid_dimension_raises():
    with pytest.raises(ValueError):
        explain_dimension(
            {
                "dimension": "not_a_real_dimension",
                "score": 50,
                "evidence": {"tempo_stability": 0.03},
                "explanation": "whatever",
            }
        )


@pytest.mark.parametrize("score", [-1, 101, 1000])
def test_score_out_of_range_raises(score):
    with pytest.raises(ValueError):
        explain_dimension(
            {
                "dimension": "vital_tension",
                "score": score,
                "evidence": {"tempo_stability": 0.03},
                "explanation": "whatever",
            }
        )


@pytest.mark.parametrize("evidence", [{}, None, "not a dict"])
def test_invalid_evidence_raises(evidence):
    with pytest.raises(ValueError):
        explain_dimension(
            {
                "dimension": "vital_tension",
                "score": 50,
                "evidence": evidence,
                "explanation": "whatever",
            }
        )


def test_empty_explanation_raises():
    with pytest.raises(ValueError):
        explain_dimension(
            {
                "dimension": "emotional_depth",
                "score": 88,
                "evidence": {"tempo_stability": 0.03},
                "explanation": "   ",
            }
        )
