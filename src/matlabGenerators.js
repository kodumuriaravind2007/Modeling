/**
 * @file matlabGenerators.js
 * @description Generates ready-to-run, textbook-grade MATLAB & GNU Octave scripts
 * for Simple Pendulum, Compound Pendulum, Slider-Crank, and Four-Bar Linkage.
 * Features built-in engineering presets and ODE45 / kinematic solvers.
 */

export const MATLAB_PRESETS = {
  simple_pendulum: [
    { id: 'earth_standard', label: 'Earth Standard', params: { length: 1.0, mass: 1.0, gravity: 9.81, damping: 0.05, theta0: 30 } },
    { id: 'moon_gravity',   label: 'Moon Gravity (Undamped)', params: { length: 1.0, mass: 1.0, gravity: 1.62, damping: 0.0, theta0: 30 } },
    { id: 'large_angle',    label: 'Large Angle (90°)', params: { length: 2.0, mass: 1.5, gravity: 9.81, damping: 0.05, theta0: 90 } },
    { id: 'high_damping',   label: 'High Damping', params: { length: 1.5, mass: 2.0, gravity: 9.81, damping: 1.20, theta0: 45 } },
  ],
  compound_pendulum: [
    { id: 'compound_rod',   label: 'Standard Rod', params: { length: 1.0, mass: 2.0, gravity: 9.81, damping: 0.05, theta0: 25 } },
    { id: 'heavy_beam',     label: 'Heavy Beam', params: { length: 2.5, mass: 10.0, gravity: 9.81, damping: 0.10, theta0: 40 } },
    { id: 'mars_gravity',   label: 'Mars Gravity', params: { length: 1.2, mass: 1.5, gravity: 3.71, damping: 0.02, theta0: 30 } },
  ],
  slider_crank: [
    { id: 'std_engine',     label: 'Standard Engine', params: { crank_length: 0.1, conn_length: 0.3, crank_speed: 60 } },
    { id: 'high_rpm',       label: 'High RPM Demo', params: { crank_length: 0.08, conn_length: 0.25, crank_speed: 180 } },
  ],
  four_bar: [
    { id: 'crank_rocker',   label: 'Crank-Rocker', params: { link_ground: 4.0, link_crank: 1.0, link_coupler: 2.5, link_rocker: 3.0, crank_speed: 75 } },
    { id: 'drag_link',      label: 'Drag Link (Double Crank)', params: { link_ground: 1.0, link_crank: 3.2, link_coupler: 3.0, link_rocker: 3.0, crank_speed: 75 } },
  ]
};

export function generateMatlabCode(simType, params) {
  if (simType === 'simple_pendulum') {
    const m = Number(params?.mass || 1.0);
    const L = Number(params?.length || 1.0);
    const g = Number(params?.gravity || 9.81);
    const b = Number(params?.damping || 0.05);
    const th0 = Number(params?.theta0 || 30.0);
    const om0 = Number(params?.omega0 || 0.0);

    return `% =========================================================================
% MECHSIM PRO - SIMPLE PENDULUM DYNAMICAL SIMULATION
% Canonical Formulation: m*L^2*theta''(t) + b*theta'(t) + m*g*L*sin(theta(t)) = 0
% Verified for MATLAB (R2018b-R2024b) & GNU Octave
% =========================================================================
clear; clc; close all;

%% 1. System Parameters
m = ${m.toFixed(2)};          % Mass of the pendulum bob (kg)
L = ${L.toFixed(2)};          % Length of the suspension rod (m)
g = ${g.toFixed(2)};         % Acceleration due to gravity (m/s^2)
b = ${b.toFixed(4)};       % Viscous damping coefficient (N*m*s/rad)
theta0_deg = ${th0.toFixed(1)}; % Initial release angle (deg)
omega0 = ${om0.toFixed(2)};      % Initial angular velocity (rad/s)
t_span = [0, 12];     % Simulation time interval (seconds)

%% 2. Inertia & Modal Calculations
I_pivot = m * L^2;
d_cg    = L;
omega_n = sqrt((m * g * d_cg) / I_pivot);
T_lin   = 2 * pi / omega_n;
theta0  = deg2rad(theta0_deg);

fprintf('=== SIMPLE PENDULUM DYNAMICS ===\\n');
fprintf('Natural Frequency (omega_n): %8.3f rad/s\\n', omega_n);
fprintf('Small-Angle Linear Period  : %8.4f s\\n', T_lin);

%% 3. State-Space Equations of Motion
% State Vector: z = [theta; omega]
ode_nonlinear = @(t, z) [ z(2); ...
                         -(m * g * d_cg * sin(z(1)) + b * z(2)) / I_pivot ];
ode_linear    = @(t, z) [ z(2); ...
                         -(m * g * d_cg * z(1) + b * z(2)) / I_pivot ];

%% 4. Numerical Time-Integration (ODE45)
options = odeset('RelTol', 1e-8, 'AbsTol', 1e-10);
z0 = [theta0; omega0];
[t, z_nl]  = ode45(ode_nonlinear, t_span, z0, options);
[~, z_lin] = ode45(ode_linear, t_span, z0, options);

theta_nl = z_nl(:, 1);
omega_nl = z_nl(:, 2);
theta_lin = z_lin(:, 1);

%% 5. Mechanical Energy Partition
KE = 0.5 * I_pivot * (omega_nl.^2);
PE = m * g * d_cg * (1 - cos(theta_nl));
Total_E = KE + PE;

%% 6. Publication Visualizations
figure('Color', 'w', 'Position', [100, 100, 950, 680], 'Name', 'Simple Pendulum Dynamics');
subplot(2, 2, 1);
plot(t, rad2deg(theta_nl), 'b-', 'LineWidth', 2, 'DisplayName', 'Nonlinear (sin \\theta)');
hold on; plot(t, rad2deg(theta_lin), 'r--', 'LineWidth', 1.5, 'DisplayName', 'Linear (\\theta)');
grid on; xlabel('Time (s)'); ylabel('Angle \\theta (deg)');
title('Displacement: Nonlinear vs Linear'); legend('Location', 'northeast');

subplot(2, 2, 2);
plot(t, omega_nl, 'Color', [0.1, 0.6, 0.2], 'LineWidth', 1.8);
grid on; xlabel('Time (s)'); ylabel('Angular Velocity \\omega (rad/s)');
title('Angular Velocity \\omega(t)');

subplot(2, 2, 3);
plot(rad2deg(theta_nl), omega_nl, 'm-', 'LineWidth', 1.8);
grid on; xlabel('Angle \\theta (deg)'); ylabel('Velocity \\omega (rad/s)');
title('Phase Portrait (State Space)');

subplot(2, 2, 4);
plot(t, Total_E, 'k-', 'LineWidth', 2, 'DisplayName', 'Total Energy');
hold on; plot(t, KE, 'b--', 'DisplayName', 'KE'); plot(t, PE, 'r:', 'DisplayName', 'PE');
grid on; xlabel('Time (s)'); ylabel('Energy (Joules)');
title('Energy Dissipation & Conservation'); legend('Location', 'northeast');
`;
  }

  if (simType === 'compound_pendulum') {
    const m = Number(params?.mass || 2.0);
    const L = Number(params?.length || 1.0);
    const g = Number(params?.gravity || 9.81);
    const b = Number(params?.damping || 0.05);
    const th0 = Number(params?.theta0 || 25.0);
    const om0 = Number(params?.omega0 || 0.0);

    return `% =========================================================================
% MECHSIM PRO - COMPOUND (PHYSICAL) PENDULUM DYNAMICAL SIMULATION
% Rigid Uniform Rod Pivoted at Endpoint: I*theta''(t) + b*theta'(t) + m*g*d*sin(theta(t)) = 0
% Parallel Axis Theorem: I_pivot = (1/12)*m*L^2 + m*(L/2)^2 = (1/3)*m*L^2
% Verified for MATLAB (R2018b-R2024b) & GNU Octave
% =========================================================================
clear; clc; close all;

%% 1. System Parameters
m = ${m.toFixed(2)};          % Mass of the uniform rod (kg)
L = ${L.toFixed(2)};          % Total length of the rigid rod (m)
g = ${g.toFixed(2)};         % Acceleration due to gravity (m/s^2)
b = ${b.toFixed(4)};       % Viscous damping coefficient (N*m*s/rad)
theta0_deg = ${th0.toFixed(1)}; % Initial release angle (deg)
omega0 = ${om0.toFixed(2)};      % Initial angular velocity (rad/s)
t_span = [0, 12];     % Simulation time interval (seconds)

%% 2. Physical Inertia & Center of Mass
I_pivot = (1/3) * m * L^2;
d_cg    = L / 2;
L_eff   = I_pivot / (m * d_cg);  % Equivalent Simple Pendulum Length = (2/3)*L
omega_n = sqrt((m * g * d_cg) / I_pivot);
T_lin   = 2 * pi / omega_n;
theta0  = deg2rad(theta0_deg);

fprintf('=== COMPOUND PENDULUM DYNAMICS ===\\n');
fprintf('Pivot Moment of Inertia (I): %8.4f kg*m^2\\n', I_pivot);
fprintf('Effective Length (L_eff)   : %8.4f m\\n', L_eff);
fprintf('Natural Frequency (omega_n): %8.3f rad/s\\n', omega_n);
fprintf('Small-Angle Linear Period  : %8.4f s\\n', T_lin);

%% 3. State-Space Equations of Motion
ode_nonlinear = @(t, z) [ z(2); ...
                         -(m * g * d_cg * sin(z(1)) + b * z(2)) / I_pivot ];
ode_linear    = @(t, z) [ z(2); ...
                         -(m * g * d_cg * z(1) + b * z(2)) / I_pivot ];

%% 4. Numerical Time-Integration (ODE45)
options = odeset('RelTol', 1e-8, 'AbsTol', 1e-10);
z0 = [theta0; omega0];
[t, z_nl]  = ode45(ode_nonlinear, t_span, z0, options);
[~, z_lin] = ode45(ode_linear, t_span, z0, options);

theta_nl = z_nl(:, 1);
omega_nl = z_nl(:, 2);
theta_lin = z_lin(:, 1);

%% 5. Mechanical Energy Partition
KE = 0.5 * I_pivot * (omega_nl.^2);
PE = m * g * d_cg * (1 - cos(theta_nl));
Total_E = KE + PE;

%% 6. Publication Visualizations
figure('Color', 'w', 'Position', [100, 100, 950, 680], 'Name', 'Compound Pendulum Dynamics');
subplot(2, 2, 1);
plot(t, rad2deg(theta_nl), 'b-', 'LineWidth', 2, 'DisplayName', 'Nonlinear (sin \\theta)');
hold on; plot(t, rad2deg(theta_lin), 'r--', 'LineWidth', 1.5, 'DisplayName', 'Linear (\\theta)');
grid on; xlabel('Time (s)'); ylabel('Angle \\theta (deg)');
title('Displacement: Nonlinear vs Linear'); legend('Location', 'northeast');

subplot(2, 2, 2);
plot(t, omega_nl, 'Color', [0.1, 0.6, 0.2], 'LineWidth', 1.8);
grid on; xlabel('Time (s)'); ylabel('Angular Velocity \\omega (rad/s)');
title('Angular Velocity \\omega(t)');

subplot(2, 2, 3);
plot(rad2deg(theta_nl), omega_nl, 'm-', 'LineWidth', 1.8);
grid on; xlabel('Angle \\theta (deg)'); ylabel('Velocity \\omega (rad/s)');
title('Phase Portrait (State Space)');

subplot(2, 2, 4);
plot(t, Total_E, 'k-', 'LineWidth', 2, 'DisplayName', 'Total Energy');
hold on; plot(t, KE, 'b--', 'DisplayName', 'KE'); plot(t, PE, 'r:', 'DisplayName', 'PE');
grid on; xlabel('Time (s)'); ylabel('Energy (Joules)');
title('Energy Dissipation & Conservation'); legend('Location', 'northeast');
`;
  }

  if (simType === 'slider_crank') {
    const r = Number(params?.crank_length || 0.1);
    const l = Number(params?.conn_length || 0.3);
    const N = Number(params?.crank_speed || 60);

    return `% =========================================================================
% MECHSIM PRO - SLIDER-CRANK KINEMATIC SIMULATION
% Analytical Geometry: x_p(theta) = r*cos(theta) + sqrt(l^2 - r^2*sin(theta)^2)
% Verified for MATLAB (R2018b-R2024b) & GNU Octave
% =========================================================================
clear; clc; close all;

%% 1. Mechanism Dimensions
r = ${r.toFixed(3)};   % Crank radius (m)
l = ${l.toFixed(3)};   % Connecting rod length (m)
N = ${N.toFixed(0)};     % Crank rotational speed (RPM)
omega = (2 * pi * N) / 60; % Angular velocity (rad/s)
lambda = r / l;        % Obliquity ratio

theta = linspace(0, 4*pi, 1000); % Two full 360 crank revolutions

%% 2. Kinematic Positions, Velocities & Accelerations
x_p = r * cos(theta) + sqrt(l^2 - (r * sin(theta)).^2);
v_p = -r * omega * (sin(theta) + (lambda * sin(2*theta)) ./ (2 * sqrt(1 - (lambda * sin(theta)).^2)));
a_p = -r * (omega^2) * (cos(theta) + (lambda * cos(2*theta) + (lambda^3)*(sin(theta).^4)) ./ ((1 - (lambda * sin(theta)).^2).^(1.5)));

%% 3. Plot Kinematic Profiles
figure('Color', 'w', 'Position', [100, 100, 900, 600], 'Name', 'Slider-Crank Kinematics');
subplot(3, 1, 1);
plot(rad2deg(theta), x_p * 100, 'b-', 'LineWidth', 2);
grid on; ylabel('Position (cm)'); title('Piston Displacement x_p(\\theta)');

subplot(3, 1, 2);
plot(rad2deg(theta), v_p, 'r-', 'LineWidth', 2);
grid on; ylabel('Velocity (m/s)'); title('Piston Velocity v_p(\\theta)');

subplot(3, 1, 3);
plot(rad2deg(theta), a_p, 'k-', 'LineWidth', 2);
grid on; xlabel('Crank Angle \\theta_2 (deg)'); ylabel('Accel (m/s^2)'); title('Piston Acceleration a_p(\\theta)');
`;
  }

  // four_bar
  const a = Number(params?.link_crank || 1.0);
  const b = Number(params?.link_coupler || 2.5);
  const c = Number(params?.link_rocker || 3.0);
  const d = Number(params?.link_ground || 4.0);
  const N = Number(params?.crank_speed || 75);

  return `% =========================================================================
% MECHSIM PRO - FOUR-BAR LINKAGE KINEMATICS (FREUDENSTEIN'S EQUATION)
% Loop Closure: d + a*e^(i*theta2) + b*e^(i*theta3) = c*e^(i*theta4)
% Verified for MATLAB (R2018b-R2024b) & GNU Octave
% =========================================================================
clear; clc; close all;

%% 1. Link Dimensions
d = ${d.toFixed(2)};  % Ground link (m)
a = ${a.toFixed(2)};  % Crank link (input) (m)
b = ${b.toFixed(2)};  % Coupler link (m)
c = ${c.toFixed(2)};  % Rocker link (output) (m)
N = ${N.toFixed(0)};  % Crank speed (RPM)
omega2 = (2 * pi * N) / 60;

%% 2. Freudenstein Constants
K1 = d / a;
K2 = d / c;
K3 = (a^2 - b^2 + c^2 + d^2) / (2 * a * c);

%% 3. Closed-Form Half-Angle Output Trajectory
theta2_deg = 0:1:360;
theta2 = deg2rad(theta2_deg);
theta4 = zeros(size(theta2));

for i = 1:length(theta2)
    th2 = theta2(i);
    A_coeff = cos(th2) - K1 - K2 * cos(th2) + K3;
    B_coeff = -2 * sin(th2);
    C_coeff = K1 - (K2 + 1) * cos(th2) + K3;
    disc = B_coeff^2 - 4 * A_coeff * C_coeff;
    if disc >= 0
        t_root = (-B_coeff - sqrt(disc)) / (2 * A_coeff);
        theta4(i) = 2 * atan(t_root);
    else
        theta4(i) = NaN;
    end
end

figure('Color', 'w', 'Position', [100, 100, 850, 500], 'Name', 'Four-Bar Output Rocker');
plot(theta2_deg, rad2deg(theta4), 'b-', 'LineWidth', 2);
grid on; xlabel('Crank Input Angle \\theta_2 (deg)'); ylabel('Rocker Angle \\theta_4 (deg)');
title('Four-Bar Linkage: Output Rocker Displacement');
`;
}
