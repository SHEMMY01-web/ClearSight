// Analysis Service
const SYSTEM_PREAMBLE_MARKERS = [
  "SYSTEMATIC CONSTRAINT LAYER",
  "STRATEGIC PROFILE OVERRIDE",
  "NIGERIAN LAW BASELINE"
];

const MAX_CLAUSES_SCANNED = 50;

// Concurrency limiter — caps parallel async operations to avoid overwhelming
// external services (ChromaDB hosted server returns HTTP 429 at ~10+ concurrent requests).
// Limits searchLaw/searchCases Promise.all bursts to CHROMA_CONCURRENCY_LIMIT at a time.
const CHROMA_CONCURRENCY_LIMIT = 5;
function pLimit(concurrency) {
  const queue = [];
  let active = 0;
  function next() {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  }
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}
const limitChroma = pLimit(CHROMA_CONCURRENCY_LIMIT);

/**
 * Server-side exact-match denylist sanitizer.
 * Removes system prompt preamble lines/blocks from user-facing completion outputs.
 */
function sanitizeUserFacingText(text) {
  if (!text || typeof text !== 'string') return '';
  let clean = text;
  for (const marker of SYSTEM_PREAMBLE_MARKERS) {
    if (clean.includes(marker)) {
      const lines = clean.split('\n');
      clean = lines.filter(l => !SYSTEM_PREAMBLE_MARKERS.some(m => l.includes(m))).join('\n');
    }
  }
  return clean.trim();
}

/**
 * Validates legal precedent sentence quality.
 * Enforces >= 6 words, legal context keywords, and rejects OCR noise/fragments like '4682020 No.'
 */
function isValidPrecedentSentence(sentence) {
  if (!sentence || typeof sentence !== 'string') return false;
  const clean = sentence.trim();
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 6) return false;

  // Reject garbled OCR noise (e.g., "1. A 4682020 No.", "4682020 No.")
  if (/^\d+[\s\.\,\-\_]+[A-Z0-9\s]+No\.?$/i.test(clean)) return false;
  if (/^[\d\s\.\,\-_]+No\.?$/i.test(clean)) return false;
  if (/\b\d{6,}\s*No\b/i.test(clean)) return false;

  // Legal context keywords requirement
  const legalKeywords = ['court', 'section', 'act', 'law', 'cama', 'held', 'right', 'duty', 'shall', 'liability', 'contract', 'party', 'tenant', 'landlord', 'employee', 'employer', 'provision', 'precedent'];
  const lower = clean.toLowerCase();
  return legalKeywords.some(kw => lower.includes(kw));
}

/**
 * Validates whether a text chunk is a genuine operative contract clause
 * filters out Table of Contents lines, bare headers, and document metadata.
 */
function isValidClauseChunk(chunkText) {
  if (!chunkText || typeof chunkText !== 'string') return false;
  const clean = chunkText.trim();
  if (clean.length < 30) return false;

  // Filter Table of Contents lines & dots lines (e.g. "1.1 Definitions ..... 4", "Page 2 of 15")
  if (/table of contents/i.test(clean)) return false;
  if (/\.{4,}/.test(clean)) return false;
  if (/page\s+\d+\s+of\s+\d+/i.test(clean)) return false;
  if (/^\s*(?:contents|index|table of clauses)\s*$/i.test(clean)) return false;

  // Filter bare section titles / headers that lack operative contract language
  // e.g. "5. PRICING, PAYMENT, AND PENALTY INTEREST." without any underlying body text
  if (clean.length < 140) {
    const operativeVerbs = /\b(shall|must|agrees?|pays?|payment|terminat\w+|indemnif\w+|liable|liability|rights?|duty|duties|warrants?|repossess\w*|forfeit\w*|deduct\w*|renew\w*|obligat\w+|penalt\w+|incurs?|applies|default|variat\w+|notice|accept\w*|fees?|fine|breach)\b/i;
    if (!operativeVerbs.test(clean)) {
      return false;
    }
  }

  return true;
}

/**
 * Semantically chunks text based on clause and sub-clause structures
 * e.g., "1.", "1.1", "4.2(b)", "Clause 3.3", "(a)"
 */
function chunkByClauses(text) {
  const clauseRegex = /(?:^|\n)(?=(?:(?:Section|Article|Clause)\s+\d+(?:\.\d+)?(?:\([a-z0-9]+\))?|\d+\.(?:\d+)?(?:\([a-z0-9]+\))?|\([a-z0-9]+\))[\s\t:A-Z])/gi;
  
  let rawParts = text.split(clauseRegex).map(p => p.trim()).filter(p => p.length > 10);

  if (rawParts.length <= 1) {
    rawParts = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 10);
  }

  // Secondary fallback for dense unformatted text: split by period sentence boundaries (~350-500 chars)
  if (rawParts.length <= 1) {
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    rawParts = [];
    let currentChunk = '';
    for (const s of sentences) {
      currentChunk += ' ' + s.trim();
      if (currentChunk.length >= 350) {
        rawParts.push(currentChunk.trim());
        currentChunk = '';
      }
    }
    if (currentChunk.trim().length > 10) rawParts.push(currentChunk.trim());
  }

  // Apply sanity filter: discard TOC lines, bare headers, and duplicate fragments
  const seenTexts = new Set();
  const validParts = [];
  for (const part of rawParts) {
    if (isValidClauseChunk(part)) {
      const normalized = part.toLowerCase().replace(/\s+/g, ' ');
      if (!seenTexts.has(normalized)) {
        seenTexts.add(normalized);
        validParts.push(part);
      }
    }
  }

  console.log(`[Analysis] Contract text split into ${validParts.length} valid operative clause chunks (filtered from ${rawParts.length} raw sections).`);

  return validParts.map((p, i) => {
    const firstLine = p.split('\n')[0].trim().substring(0, 60);
    return {
      id: firstLine || `Clause_${i+1}`,
      clauseText: p
    };
  });
}

const fs = require('fs');
const path = require('path');
const { searchLaw, searchCases } = require('./rag.service');
const { generatePlainEnglish, generateDynamicForesight, translateFullDocument } = require('./llm.service');

// Load Knowledge Base
const kbPath = path.join(__dirname, '../knowledge_base.json');
let knowledgeBase = { tenancy_law: [] };
try {
  knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
} catch (e) {
  console.error("Could not load knowledge_base.json", e);
}

function detectContractType(text) {
  const lower = text.toLowerCase();
  const scores = { tenancy: 0, employment: 0, corporate: 0, ip: 0, arbitration: 0 };

  if (/\b(tenant|landlord|rent|lease|tenancy|premises|occupation of premises)\b/.test(lower)) scores.tenancy += 4;
  if (/\b(lagos|abuja|victoria island|ikeja)\b/.test(lower)) scores.tenancy += 1;
  if (/\b(employee|employer|salary|wages|dismissal|termination|intern|volunteer|internship|offer letter|probation)\b/.test(lower)) scores.employment += 5;
  if (/\b(director|shareholder|company|board|trustee|trustees|management|cama|memorandum|articles)\b/.test(lower)) scores.corporate += 4;
  if (/\b(intellectual property|copyright|trademark|patent|invention|disclosure)\b/.test(lower)) scores.ip += 4;
  if (/\b(arbitration|mediation|dispute resolution|conciliation)\b/.test(lower)) scores.arbitration += 3;

  const topType = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  return scores[topType] > 0 ? topType : 'general';
}

const CATEGORY_TYPE_MAP = {
  tenancy_law: 'tenancy',
  employment_law: 'employment',
  commercial_law: 'corporate',
  ip_law: 'ip',
  arbitration_law: 'arbitration'
};

function topicToCategory(topic) {
  const map = {
    'Rent Increase': 'unfair rent increase',
    'Structural Repairs': 'unbalanced liability',
    'Notice to Quit': 'predatory financial terms',
    'Unlawful Eviction': 'unbalanced liability',
    'Dilapidations / Excessive Reinstatement': 'unbalanced liability',
    'Forfeiture of Security Deposit': 'predatory financial terms',
    'Subletting / Assignment Prohibition': 'unfair terms',
    'Penalty Clauses': 'predatory financial terms',
    'Unbalanced Liability / Indemnity': 'unbalanced liability',
    'Intellectual Property Assignment': 'unbalanced liability',
    'Termination for Convenience': 'predatory financial terms',
    'Jurisdiction & Governing Law': 'unfair terms',
    'Exclusivity / Non-Compete': 'unfair terms',
    'Shortfall Penalty / Purchase Minimums': 'predatory financial terms',
    'Retention of Title / Immediate Forfeiture': 'unbalanced liability',
    'Deemed Acceptance / Renewal by Silence': 'unfair terms',
    'Unilateral Price Variation': 'predatory financial terms',
    'Non-Exclusive Appointment / Unlimited Competing Distributors': 'unfair terms',
    'Asymmetric Delivery and Payment Liability': 'unbalanced liability',
    'Unilateral Set-Off Rights': 'predatory financial terms',
    'Uncapped / One-Sided Indemnity': 'unbalanced liability',
    'Excessive Interest Rate on Overdue Payments': 'predatory financial terms',
    'Automatic Escalation / Evergreen Contracts': 'unfair terms',
    'Unilateral Contract Amendment': 'unfair terms',
    'Broad Force Majeure Favouring Stronger Party': 'unbalanced liability',
    'Waiver of Right to Dispute / Audit': 'unfair terms',
    'Exclusion of Consequential Loss (One-Sided)': 'unbalanced liability',
    'Wrongful Termination': 'unbalanced liability',
    'Deduction from Wages': 'predatory financial terms',
    'Training Bond / Repayment Clawback': 'predatory financial terms',
    'Garden Leave / Non-Solicitation': 'unfair terms',
    'Unilateral Variation of Employment Terms': 'unfair terms',
    'Excessive Confidentiality / IP Ownership (Employment)': 'unbalanced liability',
    'Probationary Period Abuse': 'unfair terms'
  };
  return map[topic] || 'unbalanced liability';
}

function getAllMatchingStatutes(clauseText, contractType = null, allowCrossCategory = false, targetJurisdictions = ['NG', 'GLOBAL']) {
  const lowerText = clauseText.toLowerCase();
  const matches = [];
  for (const category in knowledgeBase) {
    const categoryType = CATEGORY_TYPE_MAP[category];
    const isPrimary = !contractType || !categoryType || categoryType === contractType;

    if (!allowCrossCategory && contractType && categoryType && categoryType !== contractType && category !== 'commercial_law') {
      continue;
    }

    for (const law of knowledgeBase[category]) {
      // Jurisdiction Filter: check if law.jurisdiction overlaps with targetJurisdictions
      if (law.jurisdiction && Array.isArray(law.jurisdiction)) {
        const matchesJ = law.jurisdiction.some(j => targetJurisdictions.includes(j) || j === 'GLOBAL');
        if (!matchesJ) continue;
      }

      for (const flag of law.red_flags) {
        const flagLower = flag.toLowerCase();
        const flagRegex = new RegExp(`\\b${flagLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        
        if (flagRegex.test(lowerText)) {
          if (!allowCrossCategory && !isPrimary && law.severity !== 'HIGH') continue;
          matches.push({
            statute: law.statute,
            rule: law.rule,
            topic: law.topic,
            severity: law.severity || 'MEDIUM',
            negotiation_tip: law.negotiation_tip || null,
            matchedFlag: flag,
            category,
            patternMatchStrength: lowerText.includes(flagLower) ? 1.0 : 0.7
          });
          break;
        }
      }
    }
  }
  return matches;
}

function extractBestSentence(ragResult, query) {
  const chunk = ragResult?.text || ragResult || '';
  if (!chunk || chunk.length < 20) return null;
  const sentences = chunk.match(/[^.!?]+[.!?]*/g) || [chunk];
  if (sentences.length === 1) {
    const candidate = chunk.substring(0, 220).trim();
    return isValidPrecedentSentence(candidate) ? candidate : null;
  }
  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  );
  let best = null, bestScore = -1;
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!isValidPrecedentSentence(trimmed)) continue;
    let score = 0;
    for (const w of queryWords) if (trimmed.toLowerCase().includes(w)) score++;
    if (score > bestScore) { bestScore = score; best = trimmed; }
  }
  return best;
}

// Named fallback constants for RAG similarity scoring
const RAG_NO_HIT_FALLBACK_SIMILARITY = 0.70; // Moderate fallback when RAG vector DB returns no hits (exact pattern scores 0.88)
const RAG_DEFAULT_HIT_SIMILARITY = 0.70;     // Default fallback when RAG hit exists but similarity property is missing

/**
 * Flag clause based on authoritative flagConfidence score and profile threshold
 */
function flagClause(clauseText, contractType = null, strategySettings = null, ragHits = [], targetJurisdictions = ['NG', 'GLOBAL']) {
  const cleanText = clauseText.replace(/â‚¦/g, '₦').replace(/Naira /g, '₦');
  const riskAppetite = strategySettings?.riskAppetite || 'balanced';
  const strategicGoal = strategySettings?.strategicGoal || 'liquidity';

  let threshold = 0.85;
  let allowCrossCategory = false;
  if (riskAppetite === 'conservative') {
    threshold = 0.65;
    allowCrossCategory = true;
  } else if (riskAppetite === 'aggressive') {
    threshold = 0.95;
  }
  if (strategicGoal === 'protection' && riskAppetite !== 'aggressive') {
    threshold = Math.min(threshold, 0.65);
    allowCrossCategory = true;
  }

  const matches = getAllMatchingStatutes(cleanText, contractType, allowCrossCategory, targetJurisdictions);
  if (matches.length === 0) return null;

  const topRagHit = ragHits && ragHits.length > 0 ? ragHits[0] : null;

  const validMatches = [];
  for (const match of matches) {
    if (threshold === 0.95 && match.severity !== 'HIGH') continue;

    const patternMatchStrength = match.patternMatchStrength || 1.0;
    // FIX: A low-similarity RAG hit must NEVER make the confidence WORSE than
    // having no RAG hits at all. Previously, a RAG hit with similarity 0.50
    // would produce flagConfidence 0.80 (below balanced threshold 0.85),
    // while NO RAG hit would produce 0.88 (above threshold). This caused
    // the 7→1 flag regression: ChromaDB being online and returning weak
    // matches silently unflagged clauses that would have been flagged if
    // ChromaDB were offline. The fix: floor the RAG score at the no-hit
    // fallback value, so RAG can only BOOST confidence, never reduce it.
    const rawRagSim = topRagHit ? (topRagHit.similarity || RAG_DEFAULT_HIT_SIMILARITY) : RAG_NO_HIT_FALLBACK_SIMILARITY;
    const ragSimilarityScore = Math.max(rawRagSim, RAG_NO_HIT_FALLBACK_SIMILARITY);
    const flagConfidence = Number((0.6 * patternMatchStrength + 0.4 * ragSimilarityScore).toFixed(2));

    console.log(`[Analysis] Clause candidate match: "${match.topic}" | pattern: ${patternMatchStrength} | rag: ${ragSimilarityScore} -> flagConfidence: ${flagConfidence} (threshold: ${threshold})`);

    if (flagConfidence >= threshold) {
      validMatches.push({
        match,
        flagConfidence,
        category: topicToCategory(match.topic)
      });
    }
  }

  if (validMatches.length === 0) return null;

  const top = validMatches[0];
  return {
    isRisky: true,
    category: top.category,
    score: top.flagConfidence,
    flagConfidence: top.flagConfidence,
    statute: `${top.match.statute}: ${top.match.rule}`,
    severity: top.match.severity,
    negotiation_tip: top.match.negotiation_tip,
    allMatches: validMatches.map(vm => vm.match)
  };
}

function buildAdvocate(topMatch) {
  const topic = topMatch?.topic || '';
  const advocateMap = {
    'Rent Increase': 'This clause is framed to give the Landlord predictable revenue growth and the ability to respond to real estate market conditions.',
    'Structural Repairs': 'This clause attempts to shift maintenance responsibility to the party in physical possession daily.',
    'Notice to Quit': 'The drafting party frames this as an operational necessity for urgent redevelopment.',
    'Penalty Clauses': 'The drafting party uses this clause to ensure performance accountability and create financial incentive.',
    'Shortfall Penalty / Purchase Minimums': 'The supplier uses purchase minimums to secure volume discount commitments and cover baseline manufacturing runs.',
    'Retention of Title / Immediate Forfeiture': 'The seller includes retention of title to protect unpaid inventory against insolvency risks.',
    'Deemed Acceptance / Renewal by Silence': 'The service provider uses automatic renewal to prevent service interruption and streamline continuity.',
    'Unbalanced Liability / Indemnity': 'The drafting party presents this as standard risk allocation.',
    'Unilateral Price Variation': 'The seller uses price variation flexibility to buffer against inflation and raw material supply shifts.',
    'Excessive Interest Rate on Overdue Payments': 'The creditor uses default interest rates to deter non-payment and offset financing costs.',
    'Uncapped / One-Sided Indemnity': 'The drafting party seeks full indemnification for all potential third-party operational risks.'
  };
  return advocateMap[topic] || 'This clause is framed to protect commercial interests under standard business practice.';
}

function buildCritic(topMatch, riskAppetite = 'balanced') {
  if (!topMatch) {
    return 'This clause contains potentially unfair terms. Detailed review against Nigerian statutes is advised.';
  }
  const severityPrefix = topMatch.severity === 'HIGH' ? '🚨 HIGH RISK: ' : '⚠️ MEDIUM RISK: ';
  let tone = '';
  if (riskAppetite === 'conservative') {
    tone = "🛡️ CONSERVATIVE ADVISORY: This clause presents a high liability profile that should be modified for zero exposure.";
  } else if (riskAppetite === 'aggressive') {
    tone = "🚀 STRATEGIC NOTE: Acceptable if commercial upside is high; ensure leverage elsewhere.";
  } else {
    tone = "⚖️ BALANCED VIEW: This clause deviates from market standards and should be neutralized in negotiation.";
  }
  
  return `${severityPrefix}${topMatch.rule}\n\n${tone}\n\nApplicable Law: ${topMatch.statute}`;
}

async function buildPlainEnglish(topMatch, clauseText = null, persona = 'general') {
  if (!topMatch) return null;
  if (clauseText) {
    try {
      const dynamicResult = await generatePlainEnglish(clauseText, topMatch.rule, topMatch.statute, persona);
      if (dynamicResult) return sanitizeUserFacingText(dynamicResult);
    } catch (e) {
      console.warn("[Analysis] Dynamic Plain English failed, using fallback.");
    }
  }

  const INTRO_MAP = {
    'Rent Increase': 'The landlord can raise your rent by any amount, at any time, without your agreement.',
    'Structural Repairs': 'This clause tries to make YOU responsible for major building repairs.',
    'Notice to Quit': 'You could be asked to leave the property with very little notice.',
    'Penalty Clauses': 'You could be charged large, automatic fines for minor breaches.',
    'Shortfall Penalty / Purchase Minimums': 'You are forced to pay hefty financial penalties if you fail to buy a strict minimum quota of goods.',
    'Retention of Title / Immediate Forfeiture': 'The supplier can immediately seize back all delivered goods and forfeit your payments upon any minor default.',
    'Deemed Acceptance / Renewal by Silence': 'Your silence or failure to object is legally treated as full agreement to contract renewal and price increases.',
    'Unbalanced Liability / Indemnity': 'If anything goes wrong, you alone will be responsible for paying all costs.',
    'Unilateral Price Variation': 'The supplier can raise contract prices at any time at their sole discretion without your prior consent.',
    'Excessive Interest Rate on Overdue Payments': 'You are charged punitive, high default interest rates on late payments.',
    'Uncapped / One-Sided Indemnity': 'You are exposed to unlimited, uncapped financial liability for third-party claims.'
  };

  const intro = INTRO_MAP[topMatch.topic] || 'This clause contains terms that could be unfair or illegal under law.';
  return `✅ WHAT THIS MEANS: ${intro} [Statutory Rule Pattern]`;
}

async function buildForesight(topMatch, persona = 'general', historicalOutcomes = [], clauseText = null) {
  if (!topMatch) return null;
  if (clauseText) {
    try {
      const dynamicResult = await generateDynamicForesight(clauseText, topMatch.rule, persona);
      if (dynamicResult) {
         let statsStr = '';
         if (historicalOutcomes && historicalOutcomes.length > 0) {
           const wins = historicalOutcomes.filter(o => o === 'WON').length;
           const total = historicalOutcomes.length;
           const winRate = Math.round((wins / total) * 100);
           statsStr = `\n\n📊 Real Court Data: Based on ${total} similar historical cases in Nigerian courts, businesses won ${winRate}% of the time.`;
         }
         return `${sanitizeUserFacingText(dynamicResult)}${statsStr}`;
      }
    } catch (e) {
      console.warn("[Analysis] Dynamic Foresight failed, using fallback.");
    }
  }

  const topic = topMatch.topic;
  const FORESIGHT = {
    'Shortfall Penalty / Purchase Minimums': {
      general: 'In 6 months, an unexpected drop in retail demand could trigger a ₦2M shortfall penalty fee that drains working capital.'
    },
    'Retention of Title / Immediate Forfeiture': {
      general: 'If a payment is delayed by 7 days, the supplier can repossess all warehouse stock, halting your customer deliveries.'
    },
    'Deemed Acceptance / Renewal by Silence': {
      general: 'In 12 months, your contract will automatically renew at a 25% higher rate because you missed the 30-day opt-out window.'
    }
  };

  const insight = FORESIGHT[topic]?.[persona] || FORESIGHT[topic]?.general || 'This clause presents long-term cash flow and operational risks.';
  const safePersona = String(persona || 'general');
  return `🔮 Data Foresight [${safePersona.replace('_', ' ').toUpperCase()}]: ${insight} [Legal Rule Engine]`;
}

function buildSystematicHeader(strategySettings) {
  const riskAppetite = strategySettings?.riskAppetite || 'balanced';
  const industryContext = strategySettings?.industryContext || 'General Commercial';
  const strategicGoal = strategySettings?.strategicGoal || 'liquidity';

  return `⚖️ SYSTEMATIC CONSTRAINT LAYER (NIGERIAN LAW BASELINE)
- All analysis MUST be grounded in CAMA 2020 and Evidence Act.
🎯 STRATEGIC PROFILE OVERRIDE [${String(riskAppetite).toUpperCase()} | ${String(strategicGoal).toUpperCase()}]
- Focus: ${String(industryContext).toUpperCase()}.`;
}

/**
 * Main pipeline: chunks text, flags risks, runs advocate-critic.
 * Passes pageStats with updated translation truncation metrics.
 */
async function chunkAndAnalyze(fullText, persona = 'general', strategySettings = null, initialPageStats = null) {
  const t0 = Date.now();
  const chunks = chunkByClauses(fullText);
  const contractType = detectContractType(fullText);

  const targetJurisdictions = (persona === 'freelancer')
    ? ['NG', 'GLOBAL', 'US', 'UK', 'CA', 'IN', 'UAE_GULF']
    : ['NG', 'GLOBAL'];

  console.log(`[Analysis] Pipeline started | contractType: ${contractType} | persona: ${persona} | jurisdictions: ${targetJurisdictions.join(',')} | strategySettings: ${JSON.stringify(strategySettings)} | textLength: ${fullText.length}`);

  const strategyHeader = buildSystematicHeader(strategySettings);
  const validChunks = chunks.filter(c => c.clauseText.length >= 30).slice(0, MAX_CLAUSES_SCANNED);

  console.log(`[Analysis] ${validChunks.length} valid chunks (>= 30 chars) from ${chunks.length} total chunks`);

  // Stage 1: RAG law search for all candidate chunks
  // Concurrency-limited to CHROMA_CONCURRENCY_LIMIT (5) to prevent ChromaDB HTTP 429 bursts
  const ragHitsPerChunk = await Promise.all(
    validChunks.map(c => limitChroma(() => searchLaw(c.clauseText, 1, targetJurisdictions).catch((err) => {
      console.warn(`[Analysis] RAG searchLaw error for chunk: ${err.message}`);
      return [];
    })))
  );

  console.log(`[Analysis] Stage 1 RAG complete | hits per chunk: [${ragHitsPerChunk.map(h => h.length).join(', ')}]`);

/**
 * Extracts parent clause identifier (e.g., "4" from "4.2(b)" or "5" from "5.3")
 */
function extractParentClauseInfo(chunkId, clauseText) {
  if (!chunkId || typeof chunkId !== 'string') return { parentNum: 'General', subRef: 'Clause' };
  const match = chunkId.match(/^(?:Clause|Section|Article)?\s*(\d+)(?:\.(\d+))?(?:\(([a-z0-9]+)\))?/i);
  if (match) {
    const parentNum = match[1];
    const subNum = match[2] ? `.${match[2]}` : '';
    const subLetter = match[3] ? `(${match[3]})` : '';
    const subRef = `${parentNum}${subNum}${subLetter}`;
    return { parentNum, subRef };
  }
  const textMatch = (chunkId + ' ' + (clauseText || '').substring(0, 80)).match(/\b(\d+)\.\d+(?:\(([a-z0-9]+)\))?/);
  if (textMatch) {
    return { parentNum: textMatch[1], subRef: textMatch[0] };
  }
  return { parentNum: chunkId.substring(0, 30), subRef: chunkId.substring(0, 30) };
}

/**
 * Collapses sub-clause fragments sharing the same parent clause and risk category
 * into a single representative risk card with a combined sub-clause header.
 */
function collapseFragmentFlags(rawFlags) {
  if (!rawFlags || rawFlags.length <= 1) return rawFlags;
  const collapsedMap = new Map();

  for (const item of rawFlags) {
    const info = extractParentClauseInfo(item.chunk.id, item.chunk.clauseText);
    const parentNum = info.parentNum;
    const category = item.risk.category || 'unbalanced liability';
    const key = `${parentNum}:${category}`;

    const existing = collapsedMap.get(key);
    if (!existing) {
      collapsedMap.set(key, {
        ...item,
        parentNum,
        subClauseRefs: [info.subRef],
        mergedChunks: [item.chunk]
      });
    } else {
      if (!existing.subClauseRefs.includes(info.subRef)) {
        existing.subClauseRefs.push(info.subRef);
      }
      existing.mergedChunks.push(item.chunk);
      if (item.risk.score > existing.risk.score || (item.risk.severity === 'HIGH' && existing.risk.severity !== 'HIGH')) {
        existing.chunk = item.chunk;
        existing.risk = item.risk;
      }
    }
  }

  const collapsed = Array.from(collapsedMap.values()).map(item => {
    if (item.subClauseRefs.length > 1) {
      const parentLabel = item.parentNum !== 'General' ? `Clause ${item.parentNum}` : 'Clause';
      const uniqueRefs = [...new Set(item.subClauseRefs)];
      const updatedId = `${parentLabel} (${uniqueRefs.join(', ')})`;
      return {
        ...item,
        chunk: {
          ...item.chunk,
          id: updatedId
        }
      };
    }
    return item;
  });

  console.log(`[Analysis] Collapsed ${rawFlags.length} raw sub-clause flags into ${collapsed.length} distinct parent-clause risk cards.`);
  return collapsed;
}

  // Stage 2: Flagging based on flagConfidence and strategy profile threshold
  const rawFlagged = validChunks
    .map((chunk, idx) => ({
      chunk,
      risk: flagClause(chunk.clauseText, contractType, strategySettings, ragHitsPerChunk[idx], targetJurisdictions)
    }))
    .filter(({ risk }) => risk?.isRisky);

  console.log(`[Analysis] Stage 2 flagging complete | ${rawFlagged.length} raw clauses flagged from ${validChunks.length} candidates`);

  // Collapse sub-clause fragments under parent clauses before Stage 3/4 generation
  const flagged = collapseFragmentFlags(rawFlagged);

  // Stage 3: Full Document Translation & Case Search
  const [translationObj, casesResults] = await Promise.all([
    translateFullDocument(fullText, initialPageStats).catch(err => {
      console.warn('[Analysis] Translation failed:', err.message);
      return { fullTranslation: null, pageStats: initialPageStats };
    }),
    Promise.all(flagged.map(({ chunk }) => limitChroma(() => searchCases(chunk.clauseText).catch(() => []))))
  ]);

  const plainTranslation = translationObj.fullTranslation;
  const pageStats = translationObj.pageStats || initialPageStats;

  // Stage 4: Build rich clause objects
  const flaggedClauses = await Promise.all(
    flagged.map(async ({ chunk, risk }, idx) => {
      const ragHits = ragHitsPerChunk[validChunks.indexOf(chunk)] || [];
      const caseHits = casesResults[idx] || [];
      const topMatch = risk.allMatches?.[0] || null;
      const riskAppetite = strategySettings?.riskAppetite || 'balanced';

      let advocate = sanitizeUserFacingText(buildAdvocate(topMatch));
      let critic = sanitizeUserFacingText(buildCritic(topMatch, riskAppetite));

      if (strategySettings?.strategicGoal === 'protection') {
        critic = `🛡️ PROTECTION FOCUS: ${critic}`;
      } else if (strategySettings?.strategicGoal === 'liquidity') {
        advocate = `💰 CASH-FIRST FOCUS: ${advocate}`;
      }

      // Add independent RAG precedent citation if clearing distance <= 0.45 and sentence validity
      let ragBestSentence = null;
      let ragCitation = null;
      if (ragHits.length > 0) {
        const precedents = ragHits
          .map(r => ({ sentence: extractBestSentence(r, chunk.clauseText), citation: r.citation }))
          .filter(p => p.sentence && isValidPrecedentSentence(p.sentence));
        
        if (precedents.length > 0) {
          ragBestSentence = precedents[0].sentence;
          ragCitation = precedents[0].citation;
          const citationStr = ragCitation ? ` [${ragCitation}]` : '';
          critic += `\n\n🔍 Legal Precedent${citationStr}:\n1. "${ragBestSentence}"`;
        }
      }

      let plainEnglish = null;
      try {
        plainEnglish = await buildPlainEnglish(topMatch, chunk.clauseText, persona);
      } catch (peErr) {
        console.warn(`[Analysis] buildPlainEnglish failed for chunk ${chunk.id}:`, peErr.message);
        plainEnglish = `✅ WHAT THIS MEANS: ${topMatch?.rule || 'This clause contains restrictive terms.'}`;
      }
      plainEnglish = sanitizeUserFacingText(plainEnglish || `✅ WHAT THIS MEANS: ${topMatch?.rule || 'This clause contains restrictive terms.'}`);

      let foresight = null;
      try {
        foresight = await buildForesight(topMatch, persona, caseHits, chunk.clauseText);
      } catch (fsErr) {
        console.warn(`[Analysis] buildForesight failed for chunk ${chunk.id}:`, fsErr.message);
        foresight = `🔮 Data Foresight: This clause presents potential legal and financial obligations under Nigerian commercial practice.`;
      }
      foresight = sanitizeUserFacingText(foresight || `🔮 Data Foresight: This clause presents potential legal and financial obligations under Nigerian commercial practice.`);

      const technicalAnalysis = {
        statute: topMatch?.statute,
        rule: topMatch?.rule,
        citation: ragCitation,
        precedent: ragBestSentence,
        constraintLayer: strategyHeader
      };

      return {
        id: chunk.id,
        text: chunk.clauseText,
        riskCategory: risk.category,
        severity: risk.severity || 'MEDIUM',
        confidence: Math.round(risk.flagConfidence * 100),
        flagConfidence: risk.flagConfidence,
        advocate,
        critic,
        plainEnglish,
        foresight,
        technicalAnalysis,
        negotiation_tip: risk.negotiation_tip || '💡 Request a legal review before signing.'
      };
    })
  );

  const riskStatus = flaggedClauses.length > 0 ? 'flagged' : 'clean';

  return {
    flaggedClauses,
    plainTranslation,
    riskStatus,
    pageStats
  };
}

module.exports = {
  chunkAndAnalyze,
  sanitizeUserFacingText,
  isValidPrecedentSentence,
  chunkByClauses,
  flagClause,
  SYSTEM_PREAMBLE_MARKERS
};
