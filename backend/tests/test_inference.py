from app.services.inference import _normalize_box


def test_normalize_box():
    assert _normalize_box((100.0, 50.0, 300.0, 150.0), 400, 200) == (
        0.25,
        0.25,
        0.5,
        0.5,
    )


def test_normalize_box_clamps_to_image():
    assert _normalize_box((-10.0, -10.0, 500.0, 300.0), 400, 200) == (
        0.0,
        0.0,
        1.0,
        1.0,
    )


def test_normalize_box_rejects_degenerate():
    assert _normalize_box((200.0, 10.0, 200.0, 100.0), 400, 200) is None
    assert _normalize_box((10.0, 100.0, 100.0, 100.0), 400, 200) is None
    assert _normalize_box((100.0, 50.0, 300.0, 150.0), 0, 200) is None


def test_normalize_box_rejects_zero_after_rounding():
    assert _normalize_box((0.0, 0.0, 0.01, 0.01), 1000, 1000) is None
