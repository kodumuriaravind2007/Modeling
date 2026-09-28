"""
Test suite for Feasibility Diagnostic Engine (validation/feasibility.py).
Verifies that all physical constraints, kinematic checks, and diagnostic contracts
return the correct statuses, severities, and structured explanation fields.
"""

import pytest
from validation.feasibility import check_feasibility


def test_four_bar_feasibility_ok():
    """Valid Grashof Crank-Rocker should have status 'ok' and 0 error checks."""
    res = check_feasibility('four_bar', {
        'link_ground': 4.0,
        'link_crank': 1.0,
        'link_coupler': 2.5,
        'link_rocker': 3.0,
        'dt': 0.005,
        't_max': 10.0
    })
    assert res['status'] == 'ok'
    assert res['is_feasible'] is True
    assert len([c for c in res['checks'] if c['severity'] == 'error']) == 0
    assert res['metrics']['grashof_type'] == 'Grashof Crank-Rocker'


def test_four_bar_triangle_inequality_violation():
    """Linkage with longest link >= sum of others cannot assemble (impossible)."""
    res = check_feasibility('four_bar', {
        'link_ground': 2.0,
        'link_crank': 3.0,
        'link_coupler': 4.0,
        'link_rocker': 10.0  # 10 >= 2 + 3 + 4 = 9
    })
    assert res['status'] == 'impossible'
    assert res['is_feasible'] is False
    check_ids = [c['id'] for c in res['checks']]
    assert 'four_bar.assembly_impossible' in check_ids
    check = next(c for c in res['checks'] if c['id'] == 'four_bar.assembly_impossible')
    assert check['severity'] == 'error'
    assert 'Triangle Assembly Inequality Violated' in check['title']


def test_four_bar_non_grashof_warning():
    """Non-Grashof linkage (s+l > p+q) cannot rotate 360 degrees (warning)."""
    # 5, 4, 2, 2 -> max=5, others=8 (assembles). S=2, L=5 (S+L=7); P=4, Q=2 (P+Q=6) -> Non-Grashof
    res = check_feasibility('four_bar', {
        'link_ground': 5.0,
        'link_crank': 4.0,
        'link_coupler': 2.0,
        'link_rocker': 2.0
    })
    assert res['status'] == 'warning'
    assert res['is_feasible'] is True  # assembles, but constrained
    check_ids = [c['id'] for c in res['checks']]
    assert 'four_bar.non_grashof' in check_ids


def test_four_bar_change_point():
    """Change point linkage (s+l = p+q) should be flagged with warning."""
    # 3, 1, 2, 2 -> S=1, L=3 (S+L=4); P=2, Q=2 (P+Q=4)
    res = check_feasibility('four_bar', {
        'link_ground': 3.0,
        'link_crank': 1.0,
        'link_coupler': 2.0,
        'link_rocker': 2.0
    })
    assert res['status'] == 'warning'
    check_ids = [c['id'] for c in res['checks']]
    assert 'four_bar.change_point' in check_ids


def test_slider_crank_lockup():
    """Connecting rod length <= crank length + offset causes geometric lockup."""
    res = check_feasibility('slider_crank', {
        'crank_length': 0.4,
        'conn_length': 0.3,  # l < r!
        'offset': 0.0
    })
    assert res['status'] == 'impossible'
    assert res['is_feasible'] is False
    check_ids = [c['id'] for c in res['checks']]
    assert 'slider_crank.lockup' in check_ids
    check = next(c for c in res['checks'] if c['id'] == 'slider_crank.lockup')
    assert check['severity'] == 'error'


def test_slider_crank_high_obliquity():
    """High rod obliquity lambda = r/l > 0.45 triggers warning."""
    res = check_feasibility('slider_crank', {
        'crank_length': 0.2,
        'conn_length': 0.4,  # lambda = 0.50
        'offset': 0.0,
        'dt': 0.005,
        't_max': 5.0
    })
    assert res['status'] == 'warning'
    check_ids = [c['id'] for c in res['checks']]
    assert 'slider_crank.high_obliquity' in check_ids


def test_simple_pendulum_string_inversion():
    """String suspension with theta0 > 90° triggers error (cannot push)."""
    res = check_feasibility('simple_pendulum', {
        'length': 1.0,
        'mass': 1.0,
        'theta0': 120.0,
        'suspension_type': 'string'
    })
    assert res['status'] == 'impossible'
    check_ids = [c['id'] for c in res['checks']]
    assert 'pendulum.string_suspension' in check_ids


def test_simple_pendulum_over_the_top():
    """Excess energy exceeding 2*m*g*L triggers over_the_top warning."""
    res = check_feasibility('simple_pendulum', {
        'length': 1.0,
        'mass': 1.0,
        'theta0': 170.0,
        'omega0': 3.0,
        'suspension_type': 'rod'
    })
    check_ids = [c['id'] for c in res['checks']]
    assert 'pendulum.over_the_top' in check_ids


def test_universal_negative_damping():
    """Negative damping violates second law of thermodynamics (error)."""
    res = check_feasibility('simple_pendulum', {
        'damping': -0.2
    })
    assert res['status'] == 'impossible'
    check_ids = [c['id'] for c in res['checks']]
    assert 'universal.damping' in check_ids
    check = next(c for c in res['checks'] if c['id'] == 'universal.damping')
    assert check['severity'] == 'error'


def test_diagnostic_report_schema():
    """Verify that every diagnostic check complies with the 7-field schema."""
    res = check_feasibility('four_bar', {
        'link_ground': 5.0,
        'link_crank': 4.0,
        'link_coupler': 2.0,
        'link_rocker': 2.0
    })
    assert len(res['checks']) > 0
    required_keys = {'id', 'severity', 'title', 'what', 'why', 'consequence', 'fix'}
    for c in res['checks']:
        assert required_keys.issubset(c.keys()), f"Check {c} missing required keys"
        assert c['severity'] in ('error', 'warning', 'info')
        assert len(c['title']) > 0
        assert len(c['what']) > 0
        assert len(c['why']) > 0
        assert len(c['consequence']) > 0
        assert isinstance(c['fix'], list) and len(c['fix']) > 0
