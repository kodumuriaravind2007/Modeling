/**
 * @file EquationBlock.jsx
 * @description React components for rendering KaTeX equations and parameters in the mechanical simulation app.
 */

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * A component that renders a KaTeX math equation.
 * 
 * @param {Object} props - Component props
 * @param {string} props.latex - KaTeX math string to render
 * @param {string} [props.label] - Title label above the equation
 * @param {boolean} [props.displayMode=true] - Whether to render in display mode
 * @param {string} [props.className=''] - Additional CSS class
 * @returns {React.JSX.Element} The rendered equation block
 */
export const EquationBlock = ({ latex, label, displayMode = true, className = '' }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
      });
    } catch (error) {
      console.error('KaTeX error:', error);
      return `<span class="katex-error">${latex}</span>`;
    }
  }, [latex, displayMode]);

  return (
    <div className={`equation-block ${className}`.trim()}>
      {label && <div className="equation-label">{label}</div>}
      <div 
        className="equation-content"
        dangerouslySetInnerHTML={{ __html: html }} 
      />
    </div>
  );
};

/**
 * A card component that wraps multiple EquationBlocks or related content.
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Title of the card
 * @param {string} [props.icon] - Emoji icon for the card header
 * @param {React.ReactNode} props.children - Content of the card
 * @param {string} [props.className=''] - Additional CSS class
 * @returns {React.JSX.Element} The rendered equation card
 */
export const EquationCard = ({ title, icon, children, className = '' }) => {
  return (
    <div className={`equation-card ${className}`.trim()}>
      <div className="equation-card-header">
        {icon && <span className="equation-card-icon">{icon}</span>}
        <h3 className="equation-card-title">{title}</h3>
      </div>
      <div className="equation-card-content">
        {children}
      </div>
    </div>
  );
};

/**
 * A component that displays parameter substitutions in a row of chips.
 * 
 * @param {Object} props - Component props
 * @param {string} [props.label] - Label for the substitution row
 * @param {Array<{symbol: string, value: string|number, unit?: string}>} props.items - Parameter items to display
 * @param {string} [props.className=''] - Additional CSS class
 * @returns {React.JSX.Element} The rendered parameter substitution row
 */
export const ParamSubstitution = ({ label, items, className = '' }) => {
  return (
    <div className={`param-substitution ${className}`.trim()}>
      {label && <span className="param-substitution-label">{label}: </span>}
      <div className="param-items">
        {items.map((item, index) => (
          <div key={index} className="param-chip">
            <span className="param-symbol">{item.symbol}</span>
            <span className="param-equals"> = </span>
            <span className="param-value">{item.value}</span>
            {item.unit && <span className="param-unit"> {item.unit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
