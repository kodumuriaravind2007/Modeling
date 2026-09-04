import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None

SYSTEM_CONTEXT = """You are an expert mechanical engineering professor specializing in vibrations, 
kinematics, and dynamics. You are embedded in an interactive simulation platform that runs 
real-time mechanical simulations. Your role is to:
1. Explain the physics and equations behind the current simulation
2. Interpret the numerical results and graphs
3. Derive equations step-by-step when asked
4. Explain sources of error between numerical and analytical solutions
5. Connect the simulation to real-world engineering applications
6. Use LaTeX math notation where helpful (wrap in $...$ for inline, $$...$$ for block)

Always be concise, educational, and relate your answers to the current simulation state provided."""


def build_simulation_context(sim_type: str, params: dict, results: dict) -> str:
    ctx = f"""
CURRENT SIMULATION STATE:
- Simulation Type: {sim_type.replace('_', ' ').title()}
- Parameters: {params}
- Key Results: {results}
"""
    return ctx


def ask_ai(user_query: str, sim_type: str, params: dict, results: dict) -> str:
    sim_ctx = build_simulation_context(sim_type, params, results)
    
    full_prompt = f"""{SYSTEM_CONTEXT}

{sim_ctx}

USER QUESTION: {user_query}

Provide a clear, educational response (2-4 paragraphs). Use equations where relevant.
"""
    
    try:
        if client:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=full_prompt
            )
            return response.text
        else:
            return fallback_response(user_query, sim_type, params, results)
    except Exception as e:
        # Fallback rule-based responses
        return fallback_response(user_query, sim_type, params, results)


def fallback_response(query: str, sim_type: str, params: dict, results: dict) -> str:
    """Rule-based fallback when API is unavailable."""
    query_lower = query.lower()
    
    if sim_type == "simple_pendulum":
        if any(w in query_lower for w in ["period", "frequency", "time"]):
            L = params.get("length", 1.0)
            g = params.get("gravity", 9.81)
            T0 = 2 * 3.14159 * (L/g)**0.5
            return (f"**Period of Simple Pendulum**\n\n"
                    f"The small-angle period formula is T₀ = 2π√(L/g).\n"
                    f"With L = {L}m and g = {g} m/s², T₀ = {T0:.3f} s.\n\n"
                    f"For large angles, the exact period uses elliptic integrals:\n"
                    f"T = 4√(L/g) × K(sin(θ₀/2))\n\n"
                    f"The nonlinear correction increases the period with amplitude.")
        elif any(w in query_lower for w in ["energy", "conservation"]):
            return ("**Energy Conservation in Pendulum**\n\n"
                    "Total mechanical energy E = KE + PE = ½mL²ω² + mgL(1-cosθ)\n"
                    "For an undamped pendulum, E remains constant.\n"
                    "The energy drift shown in the simulation measures numerical stability.")
        elif any(w in query_lower for w in ["equation", "motion", "ode"]):
            return ("**Equation of Motion — Simple Pendulum**\n\n"
                    "The nonlinear equation of motion is:\n"
                    "θ'' + (b/mL²)θ' + (g/L)sin(θ) = 0\n\n"
                    "Where: θ = angle, b = damping, m = mass, L = length, g = gravity\n\n"
                    "The RK45 integrator solves this as a system of first-order ODEs:\n"
                    "State: [θ, ω], where ω = θ'")
    
    elif sim_type == "slider_crank":
        if any(w in query_lower for w in ["position", "displacement", "stroke"]):
            r = params.get("crank_length", 0.1)
            l = params.get("conn_length", 0.3)
            return (f"**Slider-Crank Position Analysis**\n\n"
                    f"The slider position is given by the loop closure equation:\n"
                    f"x = r·cos(θ) + √(l² - r²·sin²(θ))\n\n"
                    f"With r = {r}m and l = {l}m, the stroke = 2r = {2*r}m.\n\n"
                    f"The λ = r/l = {r/l:.3f} ratio determines nonlinearity of motion.")
    
    elif sim_type == "four_bar":
        return ("**Four-Bar Mechanism Analysis**\n\n"
                "The Freudenstein equation relates input (crank) and output (rocker) angles:\n"
                "K₁·cos(θ₄) - K₂·cos(θ₂) + K₃ = cos(θ₂ - θ₄)\n\n"
                "Where K₁=d/a, K₂=d/c, K₃=(a²-b²+c²+d²)/(2ac)\n\n"
                "The Grashof condition (S+L ≤ P+Q) determines if continuous rotation is possible.")
    
    return ("I can explain the physics, equations, energy analysis, or error sources for this simulation. "
            "Try asking about the equation of motion, period calculation, energy conservation, "
            "or validation errors!")
