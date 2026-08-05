import React, { useRef } from 'react';
import DOMPurify from 'dompurify';

/**
 * Checks if a translated paragraph is semantically related to a specific flagged clause.
 * Requires section ID match or high-precision domain-specific n-gram overlap.
 * Filters generic stopwords (shall, supplier, distributor, agreement, etc.) to prevent mis-alignment.
 */
const GENERIC_LEGAL_STOPWORDS = new Set([
  'shall', 'supplier', 'distributor', 'agreement', 'parties', 'section', 'article',
  'clause', 'provided', 'subject', 'under', 'herein', 'thereof', 'whereof', 'forth',
  'terms', 'conditions', 'order', 'orders', 'party', 'other', 'first', 'second'
]);

function findMatchingClause(paragraph, flaggedClauses, matchedClauseIds = new Set()) {
  if (!flaggedClauses || flaggedClauses.length === 0) return { matched: false, clause: null };

  const paraLower = paragraph.toLowerCase();

  // 1. Direct section/clause ID match (handles single and compound IDs like "Clause 4 (4.1, 4.2(a))")
  for (const clause of flaggedClauses) {
    if (matchedClauseIds.has(clause.id)) continue;
    const clauseIdClean = (clause.id || '').trim().toLowerCase();
    
    // Extract individual clause numbers from compound string e.g. ["4.1", "4.2"]
    const numbersInId = clauseIdClean.match(/\b\d+(?:\.\d+)?(?:\([a-z0-9]+\))?/g) || [];
    const hasDirectMatch = paraLower.includes(clauseIdClean) || numbersInId.some(num => num.length >= 2 && paraLower.includes(num));

    if (clauseIdClean && hasDirectMatch) {
      matchedClauseIds.add(clause.id);
      return { matched: true, clause };
    }
  }

  // 2. High-precision domain-specific keyword & n-gram matching
  for (const clause of flaggedClauses) {
    if (matchedClauseIds.has(clause.id)) continue;
    const clauseTextLower = (clause.text || '').toLowerCase();

    // Check exact substring overlap (25+ contiguous characters)
    const snippet = clauseTextLower.substring(0, 40).replace(/^[0-9\.\(\)\s]+/, '').trim();
    if (snippet.length >= 20 && paraLower.includes(snippet)) {
      matchedClauseIds.add(clause.id);
      return { matched: true, clause };
    }

    // Filter stopwords and count domain-specific word matches
    const domainWords = clauseTextLower
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 4 && !GENERIC_LEGAL_STOPWORDS.has(w));

    const uniqueDomainWords = [...new Set(domainWords)].slice(0, 10);
    const matchCount = uniqueDomainWords.filter(w => paraLower.includes(w)).length;

    if (matchCount >= 3) {
      matchedClauseIds.add(clause.id);
      return { matched: true, clause };
    }
  }

  return { matched: false, clause: null };
}

/**
 * PlainTranslationPanel
 * Renders the full-document plain English translation.
 * Flagged paragraphs are rendered as Split-Cards (original legalese | plain translation).
 *
 * Props:
 *   plainTranslation: string - Full plain English document
 *   flaggedClauses: array - The risky clause objects from the analysis
 *   riskStatus: 'clean' | 'flagged'
 *   onJumpToRisks: function - Callback to scroll to risk cards section
 */
const PlainTranslationPanel = ({
  plainTranslation,
  flaggedClauses = [],
  riskStatus,
  onJumpToRisks,
  pageStats = null,
}) => {
  const panelRef = useRef(null);

  if (!plainTranslation) {
    return (
      <div className="bg-white/40 border border-ink/5 p-10 text-center">
        <p className="font-sans text-xs text-gray">
          Translation unavailable. The document text may be too short or in an unsupported format.
        </p>
      </div>
    );
  }

  const paragraphs = plainTranslation
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const isTruncated = pageStats?.extractionTruncated || pageStats?.translationTruncated || plainTranslation.includes('exceeded 10 pages') || plainTranslation.includes('30,000 characters limit');

  const matchedClauseIds = new Set();

  return (
    <div ref={panelRef} className="relative">

      {/* Panel Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="section-label">Plain English Translation</div>
          <h3 className="font-sans text-3xl font-black">
            Your Contract, <em>Simplified</em>
          </h3>
        </div>
        {riskStatus === 'flagged' && onJumpToRisks && (
          <button
            onClick={onJumpToRisks}
            className="shrink-0 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest px-5 py-2 transition-colors shadow-md"
          >
            🚨 Jump to Risks ↓
          </button>
        )}
      </div>

      {/* Paragraph-by-paragraph rendering */}
      <div className="space-y-4">
        {paragraphs.map((para, idx) => {
          const { matched, clause } = findMatchingClause(para, flaggedClauses, matchedClauseIds);

          // ── Split-Card: Flagged paragraph ──
          if (matched && clause) {
            const isCritical = clause.severity === 'HIGH';
            const borderColor = isCritical ? 'border-red-400' : 'border-amber-400';
            const bgBadge = isCritical ? 'bg-red-500' : 'bg-amber-500';
            const bgLeft = isCritical ? 'bg-red-50' : 'bg-amber-50';

            return (
              <div
                key={idx}
                className={`border-2 ${borderColor} overflow-hidden shadow-md animate-fade-up`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* Risk label bar */}
                <div className={`${bgBadge} px-4 py-1.5 flex items-center gap-2`}>
                  <span className="text-white text-[9px] font-bold uppercase tracking-widest">
                    {isCritical ? '🚨 HIGH RISK' : '⚠️ MEDIUM RISK'} — {clause.riskCategory}
                  </span>
                  <span className="ml-auto text-white/70 text-[9px] font-sans">{clause.id}</span>
                </div>

                {/* Split body */}
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {/* Left: Original Legalese */}
                  <div className={`${bgLeft} p-5 border-r border-ink/5`}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-3 opacity-60">
                      📄 Original Contract Language
                    </p>
                    <p
                      className="font-serif text-[12px] leading-relaxed text-gray-700 italic"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          clause.text.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
                        )
                      }}
                    />
                  </div>

                  {/* Right: Plain English */}
                  <div className="bg-white p-5">
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-3 text-ink opacity-80">
                      ✅ ClearSight Plain English
                    </p>
                    <p className="font-sans text-[13px] leading-relaxed text-ink">
                      {para}
                    </p>
                    {clause.plainEnglish && (
                      <div className="mt-3 pt-3 border-t border-ink/5">
                        <p className="text-[10px] font-bold text-amber-600 leading-relaxed">
                          💸 {clause.plainEnglish.replace(/^✅\s*WHAT THIS MEANS:\s*/i, '')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // ── Normal clean paragraph ──
          return (
            <p
              key={idx}
              className="text-[13px] leading-relaxed text-ink/80 px-1 py-2 border-l-2 border-transparent hover:border-gold/30 hover:bg-gold/5 transition-colors rounded-sm"
              style={{ animationDelay: `${idx * 20}ms` }}
            >
              {para}
            </p>
          );
        })}
      </div>

      {/* Truncation note */}
      {isTruncated && (
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 text-[11px] font-sans text-amber-800 rounded">
          ⚠️ <strong>Partial Analysis Notice:</strong> This document exceeded analysis capacity limit (10 pages / 30,000 characters).
          {pageStats && ` Scanned ${pageStats.analyzedPages} of ${pageStats.totalPages} total pages (translated through page ${pageStats.translatedThroughPage || pageStats.analyzedPages}).`}
        </div>
      )}
    </div>
  );
};

export default PlainTranslationPanel;
