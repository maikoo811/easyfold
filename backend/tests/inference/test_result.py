from easyfold.inference.result import ModelResult, nullable_float


def test_model_result_to_dict_roundtrips() -> None:
    result = ModelResult(
        model="alphafold3",
        name="job1",
        cif="data_x\n",
        plddt=[70.5, 72.0],
        pae=[[0.0, 5.0], [5.0, 0.0]],
        iptm=0.45,
        ptm=0.81,
        ranking_score=0.79,
        sample_dir_name="seed-1_sample-0",
        extras={"summary_confidences": {"ptm": 0.81}},
    )

    assert result.to_dict() == {
        "model": "alphafold3",
        "name": "job1",
        "cif": "data_x\n",
        "plddt": [70.5, 72.0],
        "pae": [[0.0, 5.0], [5.0, 0.0]],
        "iptm": 0.45,
        "ptm": 0.81,
        "ranking_score": 0.79,
        "sample_dir_name": "seed-1_sample-0",
        "extras": {"summary_confidences": {"ptm": 0.81}},
    }


def test_model_result_extras_defaults_to_empty_dict() -> None:
    result = ModelResult(
        model="boltz2",
        name="job2",
        cif="data_y\n",
        plddt=[],
        pae=None,
        iptm=None,
        ptm=None,
        ranking_score=None,
        sample_dir_name="job2_model_0",
    )
    assert result.extras == {}
    # Frozen dataclass: confirm we can't accidentally mutate the default
    # by way of two instances sharing the same dict.
    other = ModelResult(
        model="boltz2",
        name="job3",
        cif="",
        plddt=[],
        pae=None,
        iptm=None,
        ptm=None,
        ranking_score=None,
        sample_dir_name="job3_model_0",
    )
    assert result.extras is not other.extras


def test_nullable_float_handles_common_inputs() -> None:
    assert nullable_float(None) is None
    assert nullable_float(0.5) == 0.5
    assert nullable_float(1) == 1.0
    assert nullable_float("0.81") == 0.81
    assert nullable_float("not-a-number") is None
    assert nullable_float([1, 2]) is None
