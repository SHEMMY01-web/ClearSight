import React, { useEffect, useState } from 'react';

/**
 * ResultsBadge
 * Shows a large animated banner indicating whether the document is clean or flagged.
 * Props:
 *   riskStatus: 'clean' | 'flagged'
 *   flagCount: number (only shown when flagged)
 */
const ResultsBadge = ({ riskStatus, flagCount = 0 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight delay so the animation triggers after paint
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [riskStatus]);

  const isClean = riskStatus === 'clean';

  return (
    <div
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(-24px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.45s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease',
      }}
      className={`w-full flex flex-col sm:flex-row items-center justify-between gap-4 px-8 py-6 border-l-4 shadow-xl
        ${isClean
          ? 'bg-emerald-50 border-emerald-500'
          : 'bg-red-50 border-red-500'
        }`}
    >
      {/* Icon + Label */}
      <div className="flex items-center gap-4">
        <span
          className={`text-4xl ${isClean ? 'animate-bounce-slow' : ''}`}
          role="img"
          aria-label={isClean ? 'checkmark' : 'warning'}
        >
          {isClean ? '✅' : '🚨'}
        </span>
        <div>
          <p
            className={`font-syne font-extrabold text-xl tracking-tight
              ${isClean ? 'text-emerald-800' : 'text-red-800'}`}
          >
            {isClean
              ? 'No Predatory Clauses Detected'
              : `${flagCount} Predatory Clause${flagCount !== 1 ? 's' : ''} Detected`}
          </p>
          <p
            className={`font-mono text-xs mt-0.5
              ${isClean ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {isClean
              ? 'ClearSight found no risks. Your full contract is translated below.'
              : 'Scroll down to review each flagged clause with legal guidance.'}
          </p>
        </div>
      </div>

      {/* Pill */}
      <div
        className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border
          ${isClean
            ? 'border-emerald-400 text-emerald-700 bg-emerald-100'
            : 'border-red-400 text-red-700 bg-red-100'
          }`}
      >
        {isClean ? 'CAMA 2020 Compliant' : 'Legal Review Required'}
      </div>
    </div>
  );
};

export default ResultsBadge;
