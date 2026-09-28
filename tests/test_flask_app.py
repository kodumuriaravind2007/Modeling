"""
Test suite for Flask backend application (app.py).
Verifies route responses, feasibility checks, and exception sanitization (no stack traces).
"""

import pytest
import json
from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_feasibility_endpoint_ok(client):
    """POST /feasibility with valid 4-bar params returns status 'ok'."""
    res = client.post('/feasibility', json={
        'sim_type': 'four_bar',
        'params': {
            'link_ground': 4.0,
            'link_crank': 1.0,
            'link_coupler': 2.5,
            'link_rocker': 3.0
        }
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'ok'
    assert data['is_feasible'] is True


def test_feasibility_endpoint_lockup(client):
    """POST /feasibility with slider crank lockup returns status 'impossible'."""
    res = client.post('/feasibility', json={
        'sim_type': 'slider_crank',
        'params': {
            'crank_length': 0.4,
            'conn_length': 0.3
        }
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'impossible'
    assert any(c['id'] == 'slider_crank.lockup' for c in data['checks'])


def test_exception_sanitization_no_traceback(client):
    """Corrupted payload or invalid route should return clean JSON error without leaking Python tracebacks."""
    res = client.post('/feasibility', data="bad raw json", content_type='application/json')
    # Flask either returns 400 or handled error
    assert res.status_code in (400, 500)
    data = res.get_json()
    assert 'traceback' not in str(data).lower()
    assert 'file "e:\\' not in str(data).lower()
