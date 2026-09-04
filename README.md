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
- **Interactive UI**: Real-time HTML5 Canvas animation and Chart.js plots built with React and Vite.

---

## Project Structure

```
mech-sim/
├── backend/
│   ├── analysis/             # Design sweeps, optimization, reverse solver, sensitivity
│   ├── simulations/          # RK45 numerical physics formulations
│   ├── validation/           # Closed-form analytical equations & benchmark datasets
│   ├── ai_assistant.py       # Google Gemini GenAI integration
│   ├── app.py                # Flask REST API endpoints
│   ├── export.py             # PDF (ReportLab) and CSV generation
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Sample environment variables
├── frontend/
│   ├── public/               # Static assets & icons
│   ├── src/
│   │   ├── assets/           # UI graphics
│   │   ├── App.jsx           # Main simulation dashboard & UI logic
│   │   ├── renderers.js      # HTML5 Canvas physics renderers
│   │   ├── main.jsx          # React DOM entrypoint
│   │   └── App.css           # Styling
│   ├── package.json          # Node dependencies & scripts
│   └── vite.config.js        # Vite build configuration
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**

---

### Backend Setup

1. Open a terminal in the `backend` directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. *(Optional)* Set up your Gemini API key for the AI assistant:
   ```bash
   cp .env.example .env
   # Edit .env and set GEMINI_API_KEY=your_key_here
   ```

5. Start the Flask server:
   ```bash
   python app.py
   ```
   The backend API will run at `http://localhost:5000`.

---

### Frontend Setup

1. Open a new terminal in the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Open the displayed URL (usually `http://localhost:5173`) in your browser.

---

## License

MIT License
