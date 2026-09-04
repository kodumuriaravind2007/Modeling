import io
import csv
import json
from datetime import datetime
import numpy as np

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Try importing reportlab; gracefully degrade if not available
try:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether, Image as RLImage, PageBreak
    )
    from reportlab.lib.utils import ImageReader
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def generate_csv(sim_data: dict, params: dict, sim_type: str) -> bytes:
    """Generate CSV bytes from simulation results."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header metadata
    writer.writerow(["Mechanical Systems Simulation Platform"])
    writer.writerow([f"Simulation: {sim_type.replace('_', ' ').title()}"])
    writer.writerow([f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
    writer.writerow([])
    
    # Parameters
    writer.writerow(["--- PARAMETERS ---"])
    for k, v in params.items():
        writer.writerow([k, v])
    writer.writerow([])
    
    # Determine columns based on sim type
    if sim_type in ("simple_pendulum", "compound_pendulum"):
        writer.writerow(["Time (s)", "Angle (rad)", "Angle (deg)", "Omega (rad/s)", "Alpha (rad/s²)", "KE (J)", "PE (J)", "Total E (J)"])
        t = sim_data.get("time", [])
        th = sim_data.get("theta", [])
        th_d = sim_data.get("theta_deg", [])
        om = sim_data.get("omega", [])
        al = sim_data.get("alpha", [])
        ke = sim_data.get("KE", [])
        pe = sim_data.get("PE", [])
        te = sim_data.get("total_E", [])
        for i in range(len(t)):
            writer.writerow([
                f"{t[i]:.4f}", f"{th[i]:.6f}", f"{th_d[i]:.4f}",
                f"{om[i]:.6f}", f"{al[i]:.6f}",
                f"{ke[i]:.6f}", f"{pe[i]:.6f}", f"{te[i]:.6f}"
            ])
    
    elif sim_type == "slider_crank":
        writer.writerow(["Time (s)", "Crank Angle (deg)", "Slider Pos (m)", "Slider Vel (m/s)", "Slider Acc (m/s²)", "Conn Rod Angle (deg)"])
        t = sim_data.get("time", [])
        ca = sim_data.get("crank_angle_deg", [])
        x = sim_data.get("x_slider", [])
        v = sim_data.get("v_slider", [])
        a = sim_data.get("a_slider", [])
        phi = sim_data.get("conn_rod_angle_deg", [])
        for i in range(len(t)):
            writer.writerow([f"{t[i]:.4f}", f"{ca[i]:.2f}", f"{x[i]:.6f}", f"{v[i]:.6f}", f"{a[i]:.6f}", f"{phi[i]:.4f}"])
    
    elif sim_type == "four_bar":
        writer.writerow(["Time (s)", "Crank Angle (deg)", "Coupler Angle (deg)", "Rocker Angle (deg)", "omega3 (rad/s)", "omega4 (rad/s)"])
        t = sim_data.get("time", [])
        ca = sim_data.get("crank_angle_deg", [])
        c3 = sim_data.get("coupler_angle_deg", [])
        c4 = sim_data.get("rocker_angle_deg", [])
        o3 = sim_data.get("omega3", [])
        o4 = sim_data.get("omega4", [])
        for i in range(len(t)):
            writer.writerow([f"{t[i]:.4f}", f"{ca[i]:.2f}", f"{c3[i]:.4f}", f"{c4[i]:.4f}", f"{o3[i]:.4f}", f"{o4[i]:.4f}"])
    
    return output.getvalue().encode('utf-8')


def _create_kinematic_plot(sim_data: dict, sim_type: str):
    plt.figure(figsize=(7.5, 3.5))
    try:
        if sim_type in ["simple_pendulum", "compound_pendulum"]:
            t = sim_data.get("time", [])[::5]
            th = sim_data.get("theta", [])[::5]
            om = sim_data.get("omega", [])[::5]
            plt.plot(t, th, label="Angle (rad)", color='#4f46e5', linewidth=1.5)
            plt.plot(t, om, label="Ang. Velocity (rad/s)", color='#06b6d4', linewidth=1.5)
        elif sim_type == "slider_crank":
            t = sim_data.get("time", [])[::5]
            x = sim_data.get("x_slider", [])[::5]
            v = sim_data.get("v_slider", [])[::5]
            plt.plot(t, x, label="Slider Pos (m)", color='#4f46e5')
            plt.plot(t, v, label="Slider Vel (m/s)", color='#06b6d4')
        elif sim_type == "four_bar":
            t = sim_data.get("time", [])[::5]
            c3 = sim_data.get("coupler_angle_deg", [])[::5]
            c4 = sim_data.get("rocker_angle_deg", [])[::5]
            plt.plot(t, c3, label="Coupler Angle (deg)", color='#4f46e5')
            plt.plot(t, c4, label="Rocker Angle (deg)", color='#06b6d4')
            
        plt.xlabel("Time (s)")
        plt.ylabel("Kinematic Value")
        plt.title(f"Simulation Output: {sim_type.replace('_', ' ').title()}")
        plt.grid(True, linestyle='--', alpha=0.5)
        plt.legend()
        plt.tight_layout()
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150)
        plt.close()
        buf.seek(0)
        return buf
    except Exception:
        plt.close()
        return None


def generate_pdf(sim_data: dict, params: dict, validation: dict, sim_type: str) -> bytes:
    """Generate PDF report using ReportLab."""
    if not REPORTLAB_AVAILABLE:
        return b"ReportLab not installed. Install with: pip install reportlab"
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'],
                                  fontSize=18, textColor=colors.HexColor('#4f46e5'),
                                  alignment=TA_CENTER, spaceAfter=6)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
                                     fontSize=10, textColor=colors.grey,
                                     alignment=TA_CENTER, spaceAfter=20)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'],
                                    fontSize=13, textColor=colors.HexColor('#1e293b'),
                                    spaceBefore=16, spaceAfter=8)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
                                  fontSize=9, leading=14, textColor=colors.HexColor('#374151'))
    
    story = []
    
    # Title
    story.append(Paragraph("Mechanical Systems Simulation Report", title_style))
    story.append(Paragraph(
        f"Simulation: {sim_type.replace('_', ' ').title()} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 0.3*cm))
    
    # Parameters Section
    story.append(Paragraph("Simulation Parameters", heading_style))
    param_data = [["Parameter", "Value", "Unit"]]
    param_units = {
        "length": "m", "mass": "kg", "gravity": "m/s²",
        "damping": "N·m·s/rad", "theta0": "°", "omega0": "rad/s",
        "crank_length": "m", "conn_length": "m", "crank_speed": "rpm",
        "link_ground": "m", "link_crank": "m", "link_coupler": "m", "link_rocker": "m"
    }
    for k, v in params.items():
        unit = param_units.get(k, "-")
        param_data.append([k.replace("_", " ").title(), f"{v}", unit])
    
    param_table = Table(param_data, colWidths=[6*cm, 5*cm, 4*cm])
    param_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(param_table)
    story.append(Spacer(1, 0.7*cm))
    
    # Kinematic Plot
    story.append(Paragraph("Simulation Results (Kinematics)", heading_style))
    plot_reader = _create_kinematic_plot(sim_data, sim_type)
    if plot_reader:
        # reportlab Image width/height
        # A4 width is 21cm, margins 2+2=4cm, so 17cm available. 
        img = RLImage(plot_reader, width=16*cm, height=7.5*cm)
        story.append(img)
    else:
        story.append(Paragraph("<i>Graph generation failed or no data available.</i>", body_style))
        
    story.append(Spacer(1, 0.5*cm))
    
    # Page Break before validation
    story.append(PageBreak())
    
    # Validation Section
    if validation:
        story.append(Paragraph("Validation Dashboard", heading_style))
        story.append(Paragraph(
            "Comparison of numerical simulation results against analytical (theoretical) "
            "and published research paper values.",
            body_style
        ))
        story.append(Spacer(1, 0.3*cm))
        
        val_data = [["Parameter", "Theoretical", "Numerical", "Paper Value", "Abs Error", "% Error", "Status"]]
        for row in validation.get("rows", []):
            status = "✓ PASS" if row.get("pass") else "✗ FAIL"
            val_data.append([
                row.get("name", ""),
                row.get("theoretical", "--"),
                row.get("numerical", "--"),
                row.get("paper", "--"),
                row.get("abs_error", "--"),
                row.get("pct_error", "--"),
                status
            ])
        
        val_table = Table(val_data, colWidths=[4.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2*cm, 1.8*cm, 1.7*cm])
        val_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('ALIGN', (1,0), (-1,-1), 'CENTER'),
            ('PADDING', (0,0), (-1,-1), 5),
        ]))
        
        # Color code pass/fail
        for i, row in enumerate(validation.get("rows", []), start=1):
            cell_color = colors.HexColor('#dcfce7') if row.get("pass") else colors.HexColor('#fee2e2')
            val_table.setStyle(TableStyle([('BACKGROUND', (6, i), (6, i), cell_color)]))
        
        story.append(val_table)
        story.append(Spacer(1, 0.5*cm))
    
    # Energy Conservation / Dissipation
    if "is_damped" in sim_data:
        is_damped = sim_data.get("is_damped", False)
        if is_damped:
            dissipation = sim_data.get("energy_dissipated", 0)
            story.append(Paragraph("Energy Analysis (Damped System)", heading_style))
            diss_pct = dissipation * 100
            story.append(Paragraph(
                f"Total Physical Energy Dissipated: {diss_pct:.4f}%",
                body_style
            ))
        else:
            drift = sim_data.get("energy_drift", 0)
            story.append(Paragraph("Numerical Energy Conservation Check (Undamped)", heading_style))
            drift_pct = drift * 100
            status = "EXCELLENT" if drift_pct < 0.01 else ("GOOD" if drift_pct < 0.1 else "POOR")
            story.append(Paragraph(
                f"Relative numerical energy error (drift): {drift_pct:.4f}%  — Stability: <b>{status}</b>",
                body_style
            ))
        story.append(Spacer(1, 0.3*cm))
    
    # Footer
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0')))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        "Generated by Mechanical Systems Simulation Platform | Adaptive Runge-Kutta 4(5) Numerical Integrator",
        ParagraphStyle('footer', parent=styles['Normal'], fontSize=7,
                       textColor=colors.grey, alignment=TA_CENTER)
    ))
    
    doc.build(story)
    return buffer.getvalue()
