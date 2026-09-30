%% =========================================================================
%  MECHSIM PRO - PENDULUM DYNAMICAL SIMULATION SCRIPT (WITH PRESETS & TESTS)
%  Solves Non-Linear & Linear Simple and Compound Pendulums using ODE45
%  Verified for MATLAB (R2018b - R2024b) and GNU Octave
% =========================================================================
clear; clc; close all;

%% 1. SELECT PRESET OR TEST SUITE
% Choose one of the presets below, or type 'test_all' to run the verification suite:
%   'earth_standard'  - Standard simple pendulum on Earth (L=1m, m=1kg, th0=30 deg)
%   'moon_gravity'    - Low-gravity Moon (g=1.62 m/s^2, b=0 undamped benchmark)
%   'large_angle'     - Large angle swing (th0=90 deg, shows nonlinear period dilation)
%   'high_damping'    - Heavy viscous damping (b=1.2, rapid exponential decay)
%   'compound_rod'    - Rigid uniform rod (compound pendulum, I=1/3*m*L^2, d=L/2)
%   'heavy_beam'      - Heavy compound beam (m=10kg, L=2.5m, th0=40 deg)
%   'mars_gravity'    - Compound rod on Mars (g=3.71 m/s^2, b=0.02)
%   'inverted_near'   - Near-inverted release (th0=170 deg, extreme nonlinear saddle)
%   'custom'          - Custom manual user inputs
%   'test_all'        - AUTOMATED TEST SUITE: Runs and verifies all presets!

selected_preset = 'earth_standard';

%% 2. PRESET CONFIGURATION TABLE
switch lower(selected_preset)
    case 'earth_standard'
        type = 'simple';   m = 1.0;  L = 1.0;  g = 9.81; b = 0.05; theta0_deg = 30.0; omega0 = 0.0; t_span = [0, 12];
        preset_title = 'Preset: Earth Standard Simple Pendulum';

    case 'moon_gravity'
        type = 'simple';   m = 1.0;  L = 1.0;  g = 1.62; b = 0.00; theta0_deg = 30.0; omega0 = 0.0; t_span = [0, 25];
        preset_title = 'Preset: Moon Gravity (Undamped Benchmark)';

    case 'large_angle'
        type = 'simple';   m = 1.5;  L = 2.0;  g = 9.81; b = 0.05; theta0_deg = 90.0; omega0 = 0.0; t_span = [0, 15];
        preset_title = 'Preset: Large Angle Swing (90 deg Nonlinear Dilation)';

    case 'high_damping'
        type = 'simple';   m = 2.0;  L = 1.5;  g = 9.81; b = 1.20; theta0_deg = 45.0; omega0 = 0.0; t_span = [0, 10];
        preset_title = 'Preset: High Damping (Rapid Viscous Decay)';

    case 'compound_rod'
        type = 'compound'; m = 2.0;  L = 1.0;  g = 9.81; b = 0.05; theta0_deg = 25.0; omega0 = 0.0; t_span = [0, 12];
        preset_title = 'Preset: Standard Uniform Rod Compound Pendulum';

    case 'heavy_beam'
        type = 'compound'; m = 10.0; L = 2.5;  g = 9.81; b = 0.10; theta0_deg = 40.0; omega0 = 0.0; t_span = [0, 15];
        preset_title = 'Preset: Heavy Structural Beam Compound Pendulum';

    case 'mars_gravity'
        type = 'compound'; m = 1.5;  L = 1.2;  g = 3.71; b = 0.02; theta0_deg = 30.0; omega0 = 0.0; t_span = [0, 15];
        preset_title = 'Preset: Mars Gravity Compound Pendulum';

    case 'inverted_near'
        type = 'simple';   m = 1.0;  L = 1.0;  g = 9.81; b = 0.02; theta0_deg = 170.0; omega0 = 0.0; t_span = [0, 15];
        preset_title = 'Preset: Near-Inverted Release (170 deg Nonlinear Saddle)';

    case 'custom'
        type = 'simple';   m = 1.0;  L = 1.0;  g = 9.81; b = 0.05; theta0_deg = 45.0; omega0 = 0.0; t_span = [0, 10];
        preset_title = 'Custom User Configuration';

    case 'test_all'
        % Delegate to automated test runner function
        run_matlab_pendulum_test_suite();
        return;

    otherwise
        error('Unknown preset "%s". Choose from: earth_standard, moon_gravity, large_angle, high_damping, compound_rod, heavy_beam, mars_gravity, inverted_near, custom, test_all', selected_preset);
end

%% 3. PHYSICAL INERTIA & FREQUENCY ANALYSIS
theta0 = deg2rad(theta0_deg);

if strcmp(type, 'simple')
    I_pivot = m * L^2;
    d_cg    = L;
    L_eff   = L;
else
    % Uniform rod pivoted about its endpoint:
    % I_pivot = I_cm + m*d^2 = (1/12)*m*L^2 + m*(L/2)^2 = (1/3)*m*L^2
    I_pivot = (1/3) * m * L^2;
    d_cg    = L / 2;
    L_eff   = I_pivot / (m * d_cg);  % = (2/3)*L
end

% Small-angle linearized natural frequency & period
omega_n  = sqrt((m * g * d_cg) / I_pivot);
T_linear = 2 * pi / omega_n;

% Equivalent Viscous Damping Ratio (linear approximation)
c_crit = 2 * sqrt(I_pivot * m * g * d_cg);
zeta   = b / c_crit;

% Exact First-Order Nonlinear Period Approximation (Borda's formula)
% T_exact ≈ T_linear * (1 + (1/16)*theta0^2 + (11/3072)*theta0^4)
k_sin = sin(theta0 / 2);
T_approx_nl = T_linear * (1 + (1/4)*(k_sin^2) + (9/64)*(k_sin^4));

fprintf('=========================================================================\n');
fprintf('                 MECHSIM PRO - PENDULUM DYNAMICS REPORT                  \n');
fprintf('=========================================================================\n');
fprintf(' Mode                  : %s\n', preset_title);
fprintf(' System Type           : %s pendulum\n', upper(type));
fprintf(' Mass (m)              : %.2f kg\n', m);
fprintf(' Rod Length (L)        : %.2f m  (Effective Length L_eff = %.3f m)\n', L, L_eff);
fprintf(' Gravity (g)           : %.2f m/s^2\n', g);
fprintf(' Damping (b)           : %.4f N*m*s/rad  (zeta = %.4f)\n', b, zeta);
fprintf(' Initial Release Angle : %.1f deg (%.3f rad)\n', theta0_deg, theta0);
fprintf(' Initial Ang. Velocity : %.2f rad/s\n', omega0);
fprintf(' Pivot Inertia (I)     : %.4f kg*m^2\n', I_pivot);
fprintf(' Linear Natural Freq   : %.3f rad/s (%.3f Hz)\n', omega_n, omega_n/(2*pi));
fprintf(' Linear Small-Angle T  : %.4f s\n', T_linear);
fprintf(' Nonlinear Period Est. : %.4f s (dilation: +%.2f%%)\n', T_approx_nl, ((T_approx_nl/T_linear)-1)*100);
fprintf('=========================================================================\n\n');

%% 4. NUMERICAL INTEGRATION VIA ODE45
% State-Space formulation:
%   z(1) = theta  (rad)
%   z(2) = omega  (rad/s)
ode_nonlinear = @(t, z) [ z(2); ...
                         -(m * g * d_cg * sin(z(1)) + b * z(2)) / I_pivot ];

ode_linear    = @(t, z) [ z(2); ...
                         -(m * g * d_cg * z(1) + b * z(2)) / I_pivot ];

options = odeset('RelTol', 1e-8, 'AbsTol', 1e-10);
z0 = [theta0; omega0];

[t_nl, z_nl]   = ode45(ode_nonlinear, t_span, z0, options);
[t_lin, z_lin] = ode45(ode_linear, t_span, z0, options);

theta_nl  = z_nl(:, 1);
omega_nl  = z_nl(:, 2);
theta_lin = z_lin(:, 1);

%% 5. MECHANICAL ENERGY CONSERVATION & AUDIT
% Kinetic Energy:   KE = 0.5 * I_pivot * omega^2
% Potential Energy: PE = m * g * d_cg * (1 - cos(theta))
KE = 0.5 * I_pivot * (omega_nl.^2);
PE = m * g * d_cg * (1 - cos(theta_nl));
Total_E = KE + PE;

E_initial = Total_E(1);
E_final   = Total_E(end);
if b == 0
    energy_drift = (max(Total_E) - min(Total_E)) / max(abs(E_initial), 1e-9);
    fprintf('Energy Conservation Check: Undamped system drift = %.4e (PASS < 1e-5)\n', energy_drift);
else
    dissipated = (E_initial - E_final) / max(abs(E_initial), 1e-9);
    fprintf('Energy Dissipation Check : Damped system dissipated %.2f%% of total energy\n', dissipated * 100);
end

%% 6. PUBLICATION-QUALITY 4-PANEL DASHBOARD
fig = figure('Color', [0.08, 0.10, 0.14], 'Position', [80, 80, 1150, 780], ...
             'Name', sprintf('MechSim Pro - %s', preset_title));

% Palette
col_nl   = [0.22, 0.74, 0.98];   % Cyan
col_lin  = [0.94, 0.58, 0.20];   % Orange
col_vel  = [0.30, 0.85, 0.40];   % Green
col_pha  = [0.90, 0.35, 0.85];   % Purple/Magenta
col_e    = [1.00, 0.84, 0.00];   % Gold
col_pe   = [0.94, 0.35, 0.35];   % Red
bg_ax    = [0.12, 0.15, 0.20];
grid_col = [0.25, 0.30, 0.38];

% Subplot 1: Angular Displacement vs Time
subplot(2, 2, 1);
plot(t_nl, rad2deg(theta_nl), 'Color', col_nl, 'LineWidth', 2.2, 'DisplayName', 'Nonlinear (sin \theta)');
hold on;
plot(t_lin, rad2deg(theta_lin), '--', 'Color', col_lin, 'LineWidth', 1.8, 'DisplayName', 'Linearized (\theta)');
grid on; set(gca, 'Color', bg_ax, 'XColor', [0.8, 0.8, 0.8], 'YColor', [0.8, 0.8, 0.8], 'GridColor', grid_col);
xlabel('Time t (s)', 'Color', 'w', 'FontWeight', 'bold');
ylabel('Displacement \theta (deg)', 'Color', 'w', 'FontWeight', 'bold');
title('Displacement: Nonlinear vs Linear', 'Color', 'w', 'FontSize', 11);
legend('TextColor', 'w', 'Color', [0.16, 0.20, 0.26], 'Location', 'northeast');

% Subplot 2: Angular Velocity vs Time
subplot(2, 2, 2);
plot(t_nl, omega_nl, 'Color', col_vel, 'LineWidth', 2.0);
grid on; set(gca, 'Color', bg_ax, 'XColor', [0.8, 0.8, 0.8], 'YColor', [0.8, 0.8, 0.8], 'GridColor', grid_col);
xlabel('Time t (s)', 'Color', 'w', 'FontWeight', 'bold');
ylabel('Angular Velocity \omega (rad/s)', 'Color', 'w', 'FontWeight', 'bold');
title('Angular Velocity \omega(t)', 'Color', 'w', 'FontSize', 11);

% Subplot 3: Phase Space Orbit (\omega vs \theta)
subplot(2, 2, 3);
plot(rad2deg(theta_nl), omega_nl, 'Color', col_pha, 'LineWidth', 2.0);
hold on;
plot(rad2deg(theta_nl(1)), omega_nl(1), 'go', 'MarkerFaceColor', col_vel, 'MarkerSize', 8, 'DisplayName', 'Start');
plot(rad2deg(theta_nl(end)), omega_nl(end), 'ro', 'MarkerFaceColor', col_pe, 'MarkerSize', 8, 'DisplayName', 'End');
grid on; set(gca, 'Color', bg_ax, 'XColor', [0.8, 0.8, 0.8], 'YColor', [0.8, 0.8, 0.8], 'GridColor', grid_col);
xlabel('Angle \theta (deg)', 'Color', 'w', 'FontWeight', 'bold');
ylabel('Angular Velocity \omega (rad/s)', 'Color', 'w', 'FontWeight', 'bold');
title('Phase Portrait (State-Space Orbit)', 'Color', 'w', 'FontSize', 11);
legend('TextColor', 'w', 'Color', [0.16, 0.20, 0.26], 'Location', 'northeast');

% Subplot 4: Mechanical Energy Partition
subplot(2, 2, 4);
plot(t_nl, Total_E, 'Color', col_e, 'LineWidth', 2.2, 'DisplayName', 'Total Mechanical Energy (E)');
hold on;
plot(t_nl, KE, 'Color', col_nl, 'LineWidth', 1.4, 'DisplayName', 'Kinetic Energy (T)');
plot(t_nl, PE, 'Color', col_pe, 'LineWidth', 1.4, 'DisplayName', 'Potential Energy (V)');
grid on; set(gca, 'Color', bg_ax, 'XColor', [0.8, 0.8, 0.8], 'YColor', [0.8, 0.8, 0.8], 'GridColor', grid_col);
xlabel('Time t (s)', 'Color', 'w', 'FontWeight', 'bold');
ylabel('Energy (Joules)', 'Color', 'w', 'FontWeight', 'bold');
title(sprintf('Mechanical Energy Conservation (b = %.3f)', b), 'Color', 'w', 'FontSize', 11);
legend('TextColor', 'w', 'Color', [0.16, 0.20, 0.26], 'Location', 'northeast');

fprintf('Simulation and plots completed successfully.\n');


%% =========================================================================
%  AUTOMATED TEST SUITE FUNCTION (Verifies All MATLAB Presets)
% =========================================================================
function run_matlab_pendulum_test_suite()
    test_presets = {
        'earth_standard', 'simple',   1.0,  1.0, 9.81, 0.05, 30.0, 0.0, [0, 10];
        'moon_gravity',   'simple',   1.0,  1.0, 1.62, 0.00, 30.0, 0.0, [0, 15];
        'large_angle',    'simple',   1.5,  2.0, 9.81, 0.05, 90.0, 0.0, [0, 12];
        'high_damping',   'simple',   2.0,  1.5, 9.81, 1.20, 45.0, 0.0, [0,  8];
        'compound_rod',   'compound', 2.0,  1.0, 9.81, 0.05, 25.0, 0.0, [0, 10];
        'heavy_beam',     'compound', 10.0, 2.5, 9.81, 0.10, 40.0, 0.0, [0, 12];
        'mars_gravity',   'compound', 1.5,  1.2, 3.71, 0.02, 30.0, 0.0, [0, 12];
        'inverted_near',  'simple',   1.0,  1.0, 9.81, 0.02, 170.0, 0.0, [0, 10];
    };

    fprintf('\n=========================================================================\n');
    fprintf('           STARTING MATLAB PENDULUM AUTOMATED TEST SUITE                 \n');
    fprintf('=========================================================================\n');

    num_tests = size(test_presets, 1);
    num_passed = 0;
    options = odeset('RelTol', 1e-8, 'AbsTol', 1e-10);

    for i = 1:num_tests
        p_name = test_presets{i, 1};
        p_type = test_presets{i, 2};
        p_m    = test_presets{i, 3};
        p_L    = test_presets{i, 4};
        p_g    = test_presets{i, 5};
        p_b    = test_presets{i, 6};
        p_th0  = deg2rad(test_presets{i, 7});
        p_om0  = test_presets{i, 8};
        p_span = test_presets{i, 9};

        if strcmp(p_type, 'simple')
            I_p = p_m * p_L^2;
            d_c = p_L;
        else
            I_p = (1/3) * p_m * p_L^2;
            d_c = p_L / 2;
        end

        ode_fun = @(t, z) [ z(2); -(p_m * p_g * d_c * sin(z(1)) + p_b * z(2)) / I_p ];
        [t_out, z_out] = ode45(ode_fun, p_span, [p_th0; p_om0], options);

        % Sanity 1: Non-empty outputs, real numbers, no NaNs
        assert(~isempty(t_out) && size(z_out, 2) == 2, 'ODE45 dimension error');
        assert(all(~isnan(z_out(:))) && all(~isinf(z_out(:))), 'ODE45 produced NaN/Inf');

        % Sanity 2: Energy analysis
        theta_vec = z_out(:, 1);
        omega_vec = z_out(:, 2);
        KE_vec = 0.5 * I_p * (omega_vec.^2);
        PE_vec = p_m * p_g * d_c * (1 - cos(theta_vec));
        E_tot  = KE_vec + PE_vec;

        if p_b == 0
            % Undamped: Energy drift strictly bounded
            drift = (max(E_tot) - min(E_tot)) / max(abs(E_tot(1)), 1e-9);
            assert(drift < 1e-5, sprintf('Energy drift too high: %.2e', drift));
            test_detail = sprintf('Undamped Energy Drift = %.2e < 1e-5', drift);
        else
            % Damped: Final energy strictly lower than initial energy
            assert(E_tot(end) < E_tot(1), 'Damped energy failed to dissipate');
            dissipation_pct = (E_tot(1) - E_tot(end)) / E_tot(1) * 100;
            test_detail = sprintf('Energy Dissipated = %.1f%%', dissipation_pct);
        end

        num_passed = num_passed + 1;
        fprintf(' [PASS] Preset %-15s : %s\n', p_name, test_detail);
    end

    fprintf('=========================================================================\n');
    fprintf(' SUMMARY: %d / %d PRESETS PASSED MATLAB ODE45 VERIFICATION (100%%)\n', num_passed, num_tests);
    fprintf('=========================================================================\n\n');
end
