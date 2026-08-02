import React, { useState } from 'react';
import DOMPurify from 'dompurify';

const fixEncoding = (str = '') => str.replace(/â‚¦/g, '₦');

const sanitizePlainEnglish = (text) => {
  if (!text) return '';
  const constraintIdx = text.indexOf('SYSTEMATIC CONSTRAINT LAYER');
  if (constraintIdx !== -1) {
    const adviceMarkers = ['This clause', 'The landlord', 'You could', 'The other party', 'Every piece', 'Your employer', 'If anything goes wrong', 'After this contract', 'Any dispute'];
    for (const marker of adviceMarkers) {
      const markerIdx = text.indexOf(marker);
      if (markerIdx > constraintIdx) {
        let advice = text.substring(markerIdx);
        advice = advice.replace(/[⚖️📖].*/s, '').trim();
        return `✅ WHAT THIS MEANS: ${advice}`;
      }
    }
    return '✅ WHAT THIS MEANS: This clause contains terms that could be unfair or illegal under Nigerian law.';
  }
  return text;
};

const SEVERITY_CONFIG = {
  HIGH: {
    border: 'border-red-700',
    badge: 'bg-red-700 text-white',
    dot: 'bg-red-700',
    label: 'HIGH RISK',
  },
  MEDIUM: {
    border: 'border-gold',
    badge: 'bg-gold text-ink',
    dot: 'bg-gold',
    label: 'MEDIUM RISK',
  },
};

const TAB_IDS = ['summary', 'advisory', 'foresight', 'negotiate'];
const TAB_LABELS = {
  summary: '💡 Plain English',
  advisory: '⚖️ Legal Advisory',
  foresight: '🔮 Foresight',
  negotiate: '💬 Negotiate',
};

const ClauseCard = ({ clause, index, onFlag, onEscalate, persona }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [clauseExpanded, setClauseExpanded] = useState(false);

  const config = SEVERITY_CONFIG[clause.severity] || SEVERITY_CONFIG.MEDIUM;

  const tabContent = {
    summary: (
      <p
        className="text-[13px] leading-relaxed text-ink/80"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sanitizePlainEnglish(clause.plainEnglish) || 'No plain English summary available.') }}
      />
    ),
    advisory: (
      <div className="space-y-4">
        {/* Critic */}
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-red-700 mb-2">THE RISK</p>
          <p className="text-[12px] leading-relaxed whitespace-pre-line text-ink/80">{clause.critic}</p>
        </div>
        {/* Advocate */}
        <div className="pt-4 border-t border-ink/5">
          <p className="text-[9px] uppercase tracking-widest font-bold text-gray mb-2">WHY THEY WROTE IT</p>
          <p className="text-[12px] leading-relaxed text-ink/50 italic">{clause.advocate}</p>
        </div>
        {/* Precedent */}
        {clause.technicalAnalysis?.precedent && (
          <div className="bg-white/60 p-3 border-l-2 border-gold/40">
            <p className="text-[9px] uppercase tracking-widest font-bold opacity-50 mb-1">Legal Precedent</p>
            <p className="text-[11px] italic text-ink/70">"{clause.technicalAnalysis.precedent}"</p>
            {clause.technicalAnalysis?.citation && (
              <span className="text-[9px] font-sans text-gray mt-1 block">— {clause.technicalAnalysis.citation}</span>
            )}
          </div>
        )}
      </div>
    ),
    foresight: (
      <p className="text-[13px] leading-relaxed text-ink/80 whitespace-pre-line">
        {clause.foresight || 'No foresight data available for this clause.'}
      </p>
    ),
    negotiate: (
      <div className="space-y-3">
        <p className="text-[9px] uppercase tracking-widest font-bold text-ink-mid mb-2">NEGOTIATION STRATEGY</p>
        <p className="text-[13px] leading-relaxed text-ink/80">
          {clause.negotiation_tip || 'Request a legal review before signing. Negotiate mutual obligations and cap all financial exposure.'}
        </p>
      </div>
    ),
  };

  return (
    <div
      className={`bg-white border border-ink/5 border-l-4 ${config.border} overflow-hidden transition-all hover:shadow-lg`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Card Header */}
      <div className="px-5 pt-5 pb-4">
        {/* Top row: severity badge + category + confidence */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${config.badge}`}>
              {config.label}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold">{clause.riskCategory}</span>
          </div>
          <div className="flex items-center gap-3 text-[9px] font-sans text-gray">
            <span>Confidence: {clause.confidence}% {clause.flagConfidence !== undefined ? `(${clause.flagConfidence})` : ''}</span>
            <span className="text-ink/20">|</span>
            <span className="bg-ink/5 px-2 py-0.5 truncate max-w-[120px]">{clause.id}</span>
          </div>
        </div>

        {/* Original clause text (collapsed by default — Progressive Disclosure) */}
        <div className="bg-white/50 p-3 mb-4">
          <button
            onClick={() => setClauseExpanded(!clauseExpanded)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-widest font-bold opacity-50">📄 Original Clause</span>
              <span className="text-[9px] font-bold text-gold">{clauseExpanded ? 'Collapse ▲' : 'Expand ▼'}</span>
            </div>
            {!clauseExpanded && (
              <p className="text-[11px] italic text-gray line-clamp-2 leading-relaxed">
                {clause.text}
              </p>
            )}
          </button>
          {clauseExpanded && (
            <p
              className="text-[11px] italic text-gray leading-relaxed mt-1"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(fixEncoding(clause.text)) }}
            />
          )}
        </div>

        {/* Tab Navigation (Hick's Law: 4 clear choices) */}
        <div className="flex border-b border-ink/5 -mx-1 mb-4 overflow-x-auto">
          {TAB_IDS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 -mb-[1px] ${
                activeTab === tab
                  ? 'border-gold text-ink'
                  : 'border-transparent text-gray hover:text-ink'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[80px]">
          {tabContent[activeTab]}
        </div>
      </div>

      {/* Card Footer: Action Buttons (Fitts's Law: wide tap targets) */}
      <div className="px-5 py-3 bg-white/30 border-t border-ink/5 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => onFlag(clause)}
          className="text-[9px] font-bold uppercase tracking-widest text-red-700 hover:underline flex items-center gap-1"
        >
          🚩 Flag for Community
        </button>
        {(persona === 'founder' || persona === 'freelancer') && (
          <button
            onClick={() => onEscalate(clause)}
            className="text-[9px] font-bold uppercase tracking-widest text-ink-mid hover:underline flex items-center gap-1 border-l border-ink/10 pl-3"
          >
            ⚖️ Escalate to Human
          </button>
        )}
      </div>
    </div>
  );
};

export default ClauseCard;
