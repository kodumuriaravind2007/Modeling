# Mechanical Systems Simulation Platform

An interactive engineering simulation and analysis platform for classical mechanical systems. Combines high-fidelity numerical integration (RK45), rigorous analytical validation, design optimization, sensitivity analysis, data export, and an embedded Google Gemini AI physics assistant.

---

## Features

- **4 Core Mechanical Simulation Modules**:
  - **Simple Pendulum**: Linear vs. nonlinear dynamics, large-angle elliptic solutions, damping, and phase portrait analysis.
  - **Compound Pendulum**: Rigid body dynamics, radius of gyration, effective length, and center of percussion.
  - **Slider-Crank Mechanism**: Piston kinematics, displacement, velocity, acceleration, and stroke profiling.
  - **Four-Bar Linkage**: Grashof criteria classification (crank-rocker, double-crank, double-rocker) and transmission angle checks.
- **High-Accuracy Numerical Integration**: Adaptive step-size Runge-Kutta-Fehlberg (RK45) integration implemented in SciPy and NumPy.
- **Analytical Validation & Benchmarking**: Real-time error calculations against closed-form theoretical equations and paper benchmarks.
- **Engineering Analysis Suite**:
  - **Reverse Solver**: Compute required physical parameters to achieve targeted performance (e.g. desired period or stroke).
  - **Sensitivity Analysis**: Evaluate how design parameter variations influence performance metrics.
  - **Design Sweep**: Multi-dimensional parametric sweeping across design variables.
  - **Optimization**: Numerical parameter optimization for target objective functions.
- **Report & Data Export**: Generate professional engineering PDF reports (with diagrams, tables, and parameters) and raw CSV data logs.
- **Embedded AI Assistant**: Integrated Google Gemini AI assistant acting as a mechanical engineering professor to explain equations, interpret graphs, and derive formulas.
- **Unified Full-Stack App**: Flask serves both the Python simulation API and the compiled React + Vite frontend dashboard.

---

## Project Structure

```
Modeling/
├── analysis/             # Design sweeps, optimization, reverse solver, sensitivity
├── simulations/          # RK45 numerical physics formulations
├── validation/           # Closed-form analytical equations & benchmark datasets
├── dist/                 # Pre-built React frontend assets served by Flask
├── public/               # Static assets & icons
├── src/                  # React dashboard source code
├── ai_assistant.py       # Google Gemini GenAI integration
├── app.py                # Flask REST API & static file server
├── export.py             # PDF (ReportLab) and CSV generation
├── requirements.txt      # Python dependencies (includes gunicorn)
├── package.json          # Node dependencies & scripts
├── vite.config.js        # Vite build configuration
├── index.html            # Vite entry HTML
├── .env.example          # Sample environment variables
├── .gitignore
└── README.md
```

---

## Deployment (Render)

- **Language / Runtime**: `Python 3`
- **Root Directory**: *(Leave empty / blank)*
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn app:app`

---

## Local Development

### Python Backend & Full-Stack Server
```bash
# Install dependencies
pip install -r requirements.txt

# Run server (serves frontend at http://localhost:5000)
python app.py
```

### Vite Frontend (Hot Module Replacement)
```bash
# Install dependencies
npm install

# Start Vite dev server with proxy to backend
npm run dev

# Build production frontend into dist/
npm run build
```

---

## License

MIT License
