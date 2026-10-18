import React from 'react';
import { EquationBlock } from './EquationBlock.jsx';

/**
 * Converts a 2D numeric array into a KaTeX bmatrix LaTeX string.
 */
/**
 * Formats physical units for KaTeX math mode without syntax errors.
 */
function formatUnitLatex(unit) {
  if (!unit) return '';
  if (unit.includes('cdot') || unit.includes('*') || unit === 'N s/m' || unit === 'N·s/m') {
    return '\\text{N}\\cdot\\text{s}/\\text{m}';
  }
  return `\\text{${unit}}`;
}

/**
 * Converts a 2D numeric array into a KaTeX bmatrix LaTeX string.
 */
function matrixToLatex(matrix, symbol, unit) {
  if (!matrix || !Array.isArray(matrix) || matrix.length === 0) return '';
  const rows = matrix.map(row => {
    if (!Array.isArray(row)) return Number(row).toFixed(1);
    return row.map(val => {
      const num = Number(val);
      if (Math.abs(num) < 1e-9) return '0';
      return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
    }).join(' & ');
  }).join(' \\\\ ');

  const unitLatex = formatUnitLatex(unit);
  const symStr = symbol ? `\\mathbf{${symbol}} = ` : '';
  return `${symStr}\\begin{bmatrix} ${rows} \\end{bmatrix}${unitLatex ? ` \\; (${unitLatex})` : ''}`;
}

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
function toSubscript(num) {
  return String(num).split('').map(ch => SUBSCRIPT_DIGITS[parseInt(ch, 10)] || ch).join('');
}

/**
 * Professional CAD / Mathematical Matrix Display Component.
 * Formats mathematical KaTeX matrices cleanly with SDOF parameter clarity and multi-DOF coupling grids.
 */
export const MatrixDisplay = ({
  title,
  symbol = 'M',
  matrix,
  unit = '',
  isCondensed = false,
  scalarLabel = '',
  description = ''
}) => {
  if (!matrix || !Array.isArray(matrix)) {
    return (
      <div className="smd-matrix-card">
        <h4>{title}</h4>
        <div className="smd-matrix-empty">No matrix data</div>
      </div>
    );
  }

  const rows = matrix.length;
  const cols = Array.isArray(matrix[0]) ? matrix[0].length : 1;
  const is1x1 = rows === 1 && cols === 1;
  const latexStr = matrixToLatex(matrix, symbol, unit);
  const cleanUnit = unit.replace(/\\cdot/g, '·');

  const rawVal = Array.isArray(matrix[0]) ? matrix[0][0] : matrix[0];
  const scalarValNum = Number(rawVal);
  const formattedScalarVal = Number.isFinite(scalarValNum)
    ? (scalarValNum % 1 === 0 ? scalarValNum.toFixed(1) : scalarValNum.toFixed(2))
    : '0.0';

  return (
    <div className="smd-matrix-card">
      <div className="smd-matrix-card-header">
        <div className="smd-matrix-card-title-group">
          <h4>
            {title}
            {isCondensed && (
              <span className="smd-matrix-condensed-badge">
                {scalarLabel || '(Condensed SDOF)'}
              </span>
            )}
          </h4>
        </div>
        <span className="smd-matrix-dim-badge">
          {rows} × {cols}
        </span>
      </div>

      {/* KaTeX Mathematical Bracket Notation */}
      <div className="smd-matrix-latex-container">
        <EquationBlock latex={latexStr} displayMode={true} />
      </div>

      {/* Numerical Representation: SDOF parameter chip or Multi-DOF coupling table */}
      {is1x1 ? (
        <div className="smd-matrix-sdof-summary">
          <div className="smd-matrix-sdof-header">
            <span className="smd-matrix-sdof-dot"></span>
            <span className="smd-matrix-sdof-label">1-DOF Equivalent Dynamic Parameter</span>
          </div>
          <div className="smd-matrix-sdof-body">
            <span className="smd-matrix-sdof-math">
              {symbol}₁₁ = <strong>{formattedScalarVal}</strong> <span className="smd-matrix-sdof-unit">{cleanUnit}</span>
            </span>
            <span className="smd-matrix-sdof-note">
              {symbol === 'M' ? 'Direct Inertia (Mass)' : symbol === 'C' ? 'Direct Viscous Damping Coefficient' : 'Direct Restoring Stiffness'}
            </span>
          </div>
        </div>
      ) : (
        <div className="smd-matrix-grid-visual">
          <div className="smd-matrix-bracket smd-matrix-bracket-left"></div>
          <div className="smd-matrix-table-wrapper">
            <table className="smd-matrix-table">
              <thead>
                <tr>
                  <th className="smd-matrix-corner-th"></th>
                  {Array.from({ length: cols }).map((_, cIdx) => (
                    <th key={cIdx} className="smd-matrix-col-header" title={`Degree of freedom x${toSubscript(cIdx + 1)}`}>
                      x{toSubscript(cIdx + 1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, rIdx) => {
                  const rowArr = Array.isArray(row) ? row : [row];
                  return (
                    <tr key={rIdx}>
                      <th className="smd-matrix-row-header" title={`Degree of freedom x${toSubscript(rIdx + 1)}`}>
                        x{toSubscript(rIdx + 1)}
                      </th>
                      {rowArr.map((val, cIdx) => {
                        const num = Number(val);
                        const isDiag = rIdx === cIdx;
                        const isZero = Math.abs(num) < 1e-9;
                        return (
                          <td
                            key={cIdx}
                            className={`smd-matrix-cell ${isDiag ? 'diagonal-cell' : ''} ${isZero ? 'zero-cell' : 'coupling-cell'}`}
                            title={`Row ${rIdx + 1}, Col ${cIdx + 1} (${symbol}${toSubscript(rIdx + 1)}${toSubscript(cIdx + 1)}): ${num.toFixed(4)} ${cleanUnit}`}
                          >
                            <span className="smd-matrix-cell-val">
                              {num % 1 === 0 ? num.toFixed(1) : num.toFixed(2)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="smd-matrix-bracket smd-matrix-bracket-right"></div>
        </div>
      )}

      {/* Summary Footer */}
      {description && (
        <div className="smd-matrix-card-desc">
          {description}
        </div>
      )}
    </div>
  );
};
