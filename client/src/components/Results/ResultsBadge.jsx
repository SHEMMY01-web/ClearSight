import React, { useEffect, useState } from 'react';

/**
 * ResultsBadge
 * Shows a large animated banner indicating whether the document is clean or flagged.
 * Props:
 *   riskStatus: 'clean' | 'flagged'
 *   flagCount: number (only shown when flagged)
 */
const ResultsBadge = ({ riskStatus, flagCount = 0, pageStats = null }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [riskStatus]);

  const isFailed = riskStatus === 'failed';
  const isClean = riskStatus === 'clean' && !isFailed;
  const isTruncated = pageStats?.extractionTruncated || pageStats?.translationTruncated;

  if (isFailed) {
    return (
      <div className="w-full flex flex-col gap-3">
        <div className="w-full flex items-center justify-between gap-4 px-8 py-6 border-l-4 shadow-xl bg-amber-50 border-amber-500">
          <div className="flex items-center gap-4">
            <span className="text-4xl" role="img" aria-label="error">⚠️</span>
            <div>
              <p className="font-sans font-extrabold text-xl tracking-tight text-amber-900">
                Analysis Encountered an Issue
              </p>
              <p className="font-sans text-xs mt-0.5 text-amber-700">
                The server could not complete full AI processing (e.g. rate limits or server connection). Retrying may resolve the issue.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-amber-400 text-amber-800 bg-amber-100">
            Processing Incomplete
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
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
              className={`font-sans font-extrabold text-xl tracking-tight
                ${isClean ? 'text-emerald-800' : 'text-red-800'}`}
            >
              {isClean
                ? 'No Predatory Clauses Detected'
                : `${flagCount} Predatory Clause${flagCount !== 1 ? 's' : ''} Detected`}
            </p>
            <p
              className={`font-sans text-xs mt-0.5
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

      {/* Persistent Page Analysis Coverage Banner */}
      {pageStats && (
        <div className={`px-6 py-2.5 text-[11px] font-sans font-medium flex items-center justify-between border-l-4 ${
          isTruncated ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-gray-50 border-gray-400 text-gray-700'
        }`}>
          <span>
            📄 <strong>ANALYSIS COVERAGE:</strong> Scanned {pageStats.analyzedPages} of {pageStats.totalPages} pages
            {pageStats.translationTruncated ? `, translated through page ${pageStats.translatedThroughPage}` : ''}
          </span>
          {isTruncated && (
            <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
              ⚠️ Partial Read
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsBadge;
