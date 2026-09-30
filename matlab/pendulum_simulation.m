%% =========================================================================
%  MECHSIM PRO - PENDULUM DYNAMICAL SIMULATION SCRIPT
%  Solves Non-Linear & Linear Simple and Compound Pendulums using ODE45
%  Verified for MATLAB (R2018b - R2024b) and GNU Octave
% =========================================================================
clear; clc; close all;

%% 1. SYSTEM PARAMETERS (Matching MechSim Pro UI)
type      = 'simple';    % Options: 'simple' (bob on string) or 'compound' (solid rod)
m         = 1.0;         % Mass (kg)
L         = 1.0;         % Total Length (m)
g         = 9.81;        % Gravitational acceleration (m/s^2)
b         = 0.05;        % Viscous damping coefficient (N*m*s/rad)
theta0_deg= 45.0;        % Initial angle release (degrees)
omega0    = 0.0;         % Initial angular velocity (rad/s)
t_span    = [0, 10];     % Simulation time interval (0 to 10 seconds)

%% 2. INERTIA & EFFECTIVE DAMPING CALCULATION
theta0 = deg2rad(theta0_deg);

if strcmp(type, 'simple')
    % Simple pendulum: point mass at length L
    I_pivot = m * L^2;
    d_cg    = L;
    fprintf('=== SIMPLE PENDULUM SIMULATION ===\n');
else
    % Compound pendulum: uniform rigid rod pivoted at one end
    % By Parallel Axis Theorem: I = (1/12)*m*L^2 + m*(L/2)^2 = (1/3)*m*L^2
    I_pivot = (1/3) * m * L^2;
    d_cg    = L / 2;
    fprintf('=== COMPOUND (PHYSICAL) PENDULUM SIMULATION ===\n');
end

% Natural angular frequency (small-angle linear)
omega_n = sqrt((m * g * d_cg) / I_pivot);
T_linear = 2 * pi / omega_n;
fprintf('Natural Frequency (omega_n): %.3f rad/s\n', omega_n);
fprintf('Small-Angle Linear Period  : %.3f s\n', T_linear);

%% 3. STATE-SPACE ODE DEFINITION
% State Vector: z = [theta; omega]
% z(1) = theta  (Angle in rad)
% z(2) = omega  (Angular velocity in rad/s)
%
% 1) Exact Non-Linear ODE:  I * theta'' + b * theta' + m*g*d * sin(theta) = 0
%    dz(1)/dt = z(2)
%    dz(2)/dt = -(m*g*d*sin(z(1)) + b*z(2)) / I_pivot
%
% 2) Linearized ODE (sin(theta) approx theta):
%    dz(2)/dt = -(m*g*d*z(1) + b*z(2)) / I_pivot

ode_nonlinear = @(t, z) [ z(2); ...
                         -(m * g * d_cg * sin(z(1)) + b * z(2)) / I_pivot ];

ode_linear    = @(t, z) [ z(2); ...
                         -(m * g * d_cg * z(1) + b * z(2)) / I_pivot ];

%% 4. NUMERICAL INTEGRATION USING ODE45 (Runge-Kutta 4th/5th Order)
options = odeset('RelTol', 1e-8, 'AbsTol', 1e-10);
z0 = [theta0; omega0];

[t_nl, z_nl] = ode45(ode_nonlinear, t_span, z0, options);
[t_lin, z_lin] = ode45(ode_linear, t_span, z0, options);

theta_nl  = z_nl(:, 1);
omega_nl  = z_nl(:, 2);
theta_lin = z_lin(:, 1);

%% 5. MECHANICAL ENERGY CALCULATION
% Kinetic Energy:   KE = 0.5 * I_pivot * omega^2
% Potential Energy: PE = m * g * d_cg * (1 - cos(theta))
KE = 0.5 * I_pivot * (omega_nl.^2);
PE = m * g * d_cg * (1 - cos(theta_nl));
Total_E = KE + PE;

%% 6. PUBLICATION-QUALITY PLOTTING
figure('Color', [0.10, 0.12, 0.16], 'Position', [100, 100, 1100, 750], 'Name', 'MechSim Pro - Pendulum Dynamics');

% --- Subplot 1: Angle vs Time (Exact vs Linearized) ---
subplot(2, 2, 1);
plot(t_nl, rad2deg(theta_nl), 'Color', [0.22, 0.74, 0.98], 'LineWidth', 2.2, 'DisplayName', 'Nonlinear (sin \theta)');
hold on;
plot(t_lin, rad2deg(theta_lin), '--', 'Color', [0.94, 0.58, 0.20], 'LineWidth', 1.8, 'DisplayName', 'Linear (\theta)');
grid on; set(gca, 'Color', [0.14, 0.17, 0.23], 'XColor', [0.8, 0.8, 0.8], 'YColor', [0.8, 0.8, 0.8]);
xlabel('Time (s)', 'Color', 'w', 'FontWeight', 'bold');
ylabel('Angle \theta (deg)', 'Color', 'w', 'FontWeight', 'bold');
title('Displacement: Nonlinear vs Linear', 'Color', 'w');
legend('TextColor', 'w', 'Color', [0.18, 0.22, 0.30], 'Location', 'northeast');

% --- Subplot 2: Angular Velocity vs Time ---
subplot(2, 2, 2);
plot(t_nl, omega_nl, 'Color', [0.30, 0.85, 0.40], 'LineWidth', 2.0);
grid on; set(gca, 'Color', [0.14, 0.17, 0.23], 'XColor', [0.8, 0.8, 0.8], 'YColor', [0.8, 0.8, 0.8]);
xlabel('Time (s)', 'Color', 'w', 'FontWeight', 'bold');
ylabel('Angular Velocity \omega (rad/s)', 'Color', 'w', 'FontWeight', 'bold');
title('Angular Velocity \omega(t)', 'Color', 'w');

% --- Subplot 3: Phase-Plane Portrait (omega vs theta) ---
subplot(2, 2, 3);
plot(rad2deg(theta_nl), omega_nl, 'Color', [0.90, 0.35, 0.85], 'LineWidth', 2.0);
hold on;
plot(rad2deg(theta_nl(1)), omega_nl(1), 'go', 'MarkerFaceColor', 'g', 'MarkerSize', 8, 'DisplayName', 'Start');
plot(rad2deg(theta_nl(end)), omega_nl(end), 'ro', 'MarkerFaceColor', 'r', 'MarkerSize', 8, 'DisplayName', 'End');
grid on; set(gca, 'Color', [0.14, 0.17, 0.23], 'XColor', [0.8, 0.8, 0.8], 'YColor', [0.8, 0.8, 0.8]);
xlabel('Angle \theta (deg)', 'Color', 'w', 'FontWeight', 'bold');
ylabel('Angular Velocity \omega (rad/s)', 'Color', 'w', 'FontWeight', 'bold');
title('Phase Portrait (State-Space Orbit)', 'Color', 'w');
legend('TextColor', 'w', 'Color', [0.18, 0.22, 0.30], 'Location', 'northeast');

% --- Subplot 4: Total Mechanical Energy Conservation ---
subplot(2, 2, 4);
plot(t_nl, Total_E, 'Color', [1.0, 0.84, 0.0], 'LineWidth', 2.2, 'DisplayName', 'Total Energy E');
hold on;
plot(t_nl, KE, 'Color', [0.22, 0.74, 0.98], 'LineWidth', 1.4, 'DisplayName', 'Kinetic (KE)');
plot(t_nl, PE, 'Color', [0.94, 0.35, 0.35], 'LineWidth', 1.4, 'DisplayName', 'Potential (PE)');
grid on; set(gca, 'Color', [0.14, 0.17, 0.23], 'XColor', [0.8, 0.8, 0.8], 'YColor', [0.8, 0.8, 0.8]);
xlabel('Time (s)', 'Color', 'w', 'FontWeight', 'bold');
ylabel('Energy (Joules)', 'Color', 'w', 'FontWeight', 'bold');
title(sprintf('Mechanical Energy (Damping b = %.3f)', b), 'Color', 'w');
legend('TextColor', 'w', 'Color', [0.18, 0.22, 0.30], 'Location', 'northeast');

fprintf('Simulation complete! Plots rendered successfully.\n');
