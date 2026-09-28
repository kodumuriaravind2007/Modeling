import React, { useEffect } from 'react';
import MathModel from '../MathModel';

export const LearnModal = ({
  isOpen,
  onClose,
  simType,
  params
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="learn-modal-title">
      <div className="learn-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-category-badge">THEORY & LAB MANUAL</div>
            <h2 id="learn-modal-title" className="modal-title">
              Mathematical Model & Electrical Analogies
            </h2>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close learn modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="learn-modal-body">
          <div className="learn-content-scroll">
            <MathModel simType={simType} params={params} />
          </div>
        </div>
      </div>
    </div>
  );
};
