// Analysis Service (100% Offline)
/**
 * Semantically chunks text based on clause structures
 * e.g., looks for "1. ", "1.1 ", "Section A", etc.
 * @param {string} text 
 * @returns {Array<{ id: string, clauseText: string }>}
 */
function chunkByClauses(text) {
  // Match numbered clauses at start of a line, e.g. "1.", "2.", "1.1", or "Section 3", "Article 2"
  // This handles both "1. TITLE:" and "Section 1" style headings
  const clauseRegex = /(?:^|\n)(?=(?:(?:Section|Article|Clause)\s+\d+[a-zA-Z]?|\d+\.(?:\d+)?)[\s\t:A-Z])/gi;
  
  const parts = text.split(clauseRegex).map(p => p.trim()).filter(p => p.length > 10);

  if (parts.length <= 1) {
    // Fallback: chunk by double newlines (paragraphs)
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 10).map((p, i) => ({
      id: `Paragraph_${i+1}`,
      clauseText: p.trim()
    }));
  }

  return parts.map((p, i) => {
    // Use first line as ID (clause heading)
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
const { generatePlainEnglish, generateDynamicForesight } = require('./llm.service');

// Load Knowledge Base
const kbPath = path.join(__dirname, '../knowledge_base.json');
let knowledgeBase = { tenancy_law: [] };
try {
  knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
} catch (e) {
  console.error("Could not load knowledge_base.json", e);
}



/**
 * Detects the primary contract type from the full document text.
 * Used to prevent cross-category KB hallucinations.
 */
function detectContractType(text) {
  const lower = text.toLowerCase();
  const scores = { tenancy: 0, employment: 0, corporate: 0, ip: 0, arbitration: 0 };

  // Tenancy Keywords
  if (/\b(tenant|landlord|rent|lease|tenancy|premises|occupation of premises)\b/.test(lower)) scores.tenancy += 4;
  if (/\b(lagos|abuja|victoria island|ikeja)\b/.test(lower)) scores.tenancy += 1;

  // Employment Keywords
  if (/\b(employee|employer|salary|wages|dismissal|termination|intern|volunteer|internship|offer letter|probation)\b/.test(lower)) scores.employment += 5;
  
  // Corporate Keywords
  if (/\b(director|shareholder|company|board|trustee|trustees|management|cama|memorandum|articles)\b/.test(lower)) scores.corporate += 4;

  // IP Keywords
  if (/\b(intellectual property|copyright|trademark|patent|invention|disclosure)\b/.test(lower)) scores.ip += 4;

  // Arbitration Keywords
  if (/\b(arbitration|mediation|dispute resolution|conciliation)\b/.test(lower)) scores.arbitration += 3;

  const topType = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  return scores[topType] > 0 ? topType : 'general';
}

// Category → contract type alignment map
const CATEGORY_TYPE_MAP = {
  tenancy_law: 'tenancy',
  employment_law: 'employment',
  commercial_law: 'corporate',
  ip_law: 'ip',
  arbitration_law: 'arbitration'
};

/**
 * Finds ALL matching statutes from the knowledge base.
 * Filters cross-category results to prevent hallucination:
 *   — Clauses from the primary contract type always pass.
 *   — Cross-category matches only pass if severity is HIGH.
 */
function getAllMatchingStatutes(clauseText, contractType = null) {
  const lowerText = clauseText.toLowerCase();
  const matches = [];
  for (const category in knowledgeBase) {
    const categoryType = CATEGORY_TYPE_MAP[category];
    const isPrimary = !contractType || !categoryType || categoryType === contractType;

    // Strict Filtering: Skip tenancy laws for employment docs and vice-versa.
    // commercial_law is always allowed as it contains general contract principles.
    if (contractType && categoryType && categoryType !== contractType && category !== 'commercial_law') {
      continue;
    }

    for (const law of knowledgeBase[category]) {
      for (const flag of law.red_flags) {
        const flagLower = flag.toLowerCase();
        // Use word boundary check to avoid partial matches (e.g., "Foundation" organization vs "foundation" building)
        const flagRegex = new RegExp(`\\b${flagLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        
        if (flagRegex.test(lowerText)) {
          // Anti-hallucination: skip cross-category matches unless severity is HIGH
          if (!isPrimary && law.severity !== 'HIGH') continue;
          matches.push({
            statute: law.statute,
            rule: law.rule,
            topic: law.topic,
            severity: law.severity || 'MEDIUM',
            negotiation_tip: law.negotiation_tip || null,
            matchedFlag: flag,
            category
          });
          break;
        }
      }
    }
  }
  return matches;
}

/**
 * From a raw RAG result object {text, citation}, extracts the most relevant sentence.
 */
function extractBestSentence(ragResult, query) {
  const chunk = ragResult?.text || ragResult || '';
  if (!chunk || chunk.length < 20) return null;
  const sentences = chunk.match(/[^.!?]+[.!?]*/g) || [chunk];
  if (sentences.length === 1) return chunk.substring(0, 220).trim();
  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  );
  let best = sentences[0], bestScore = 0;
  for (const s of sentences) {
    let score = 0;
    for (const w of queryWords) if (s.toLowerCase().includes(w)) score++;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best.trim();
}

/**
 * Maps KB topic to risk category label
 */
function topicToCategory(topic) {
  const map = {
    'Rent Increase': 'unfair rent increase',
    'Structural Repairs': 'unbalanced liability',
    'Notice to Quit': 'predatory financial terms',
    'Penalty Clauses': 'predatory financial terms',
    'Unbalanced Liability / Indemnity': 'unbalanced liability',
    'Intellectual Property Assignment': 'unbalanced liability',
    'Termination for Convenience': 'predatory financial terms'
  };
  return map[topic] || 'unbalanced liability';
}

/**
 * Primary: KB keyword matching. 100% offline and deterministic.
 * @param {string} clauseText
 * @param {string|null} contractType — detected type to prevent cross-category hallucinations
 * @returns {{ isRisky: boolean, category: string, score: number, statute: string } | null}
 */
function flagClause(clauseText, contractType = null) {
  // Fix OCR encoding: â‚¦ → ₦
  const cleanText = clauseText
    .replace(/â‚¦/g, '₦')
    .replace(/Naira /g, '₦'); // normalise any previously over-fixed text

  // ── JSON KB Keyword Matching (instant, deterministic, hallucination-guarded) ──
  const matches = getAllMatchingStatutes(cleanText, contractType);
  if (matches.length > 0) {
    const topMatch = matches[0];
    const confidence = topMatch.severity === 'HIGH' ? 0.97 : 0.91;
    return {
      isRisky: true,
      category: topicToCategory(topMatch.topic),
      score: confidence,
      statute: `${topMatch.statute}: ${topMatch.rule}`,
      severity: topMatch.severity,
      negotiation_tip: topMatch.negotiation_tip,
      allMatches: matches
    };
  }

  return null;
}

/**
 * Dynamically builds the Advocate voice from the clause text and the matched KB topic.
 */
function buildAdvocate(clauseText, topMatch) {
  const topic = topMatch?.topic || '';
  const advocateMap = {
    'Rent Increase': 'This clause is framed to give the Landlord predictable revenue growth and the ability to respond to real estate market conditions. Landlords argue this protects long-term asset value.',
    'Structural Repairs': 'This clause attempts to shift maintenance responsibility to the party in physical possession of the property daily, arguing they are best placed to spot and manage minor deterioration before it becomes major.',
    'Notice to Quit': 'The drafting party frames this as an operational necessity — quick repossession may be required for urgent redevelopment, sale, or to address persistent breach.',
    'Unlawful Eviction': 'This clause is presented as an enforcement mechanism to recover the property efficiently when a tenant breaches their obligations, particularly in cases of rent default.',
    'Penalty Clauses': 'The drafting party uses this clause to ensure performance accountability and to create a strong financial incentive for the other party to meet deadlines and obligations.',
    'Unbalanced Liability / Indemnity': 'The drafting party presents this as standard risk allocation — placing liability on the party most able to control or insure against the risk.',
    'Intellectual Property Assignment': 'The commissioning party argues they should own everything produced during the engagement since they are paying for the work, giving them full commercial freedom.',
    'Termination for Convenience': 'The stronger party argues this flexibility is necessary to manage business risks, pivot strategy, or exit non-performing relationships without prolonged contractual obligation.',
    'Jurisdiction & Governing Law': 'The drafting party (often a multinational) defaults to their home jurisdiction for consistency across contracts and access to familiar legal infrastructure.',
    'Exclusivity / Non-Compete': 'The drafting party argues this protects their legitimate business interests, trade secrets, client relationships, and competitive advantage.',
    'Wrongful Termination': 'The employer frames this as a necessary operational flexibility to respond quickly to performance issues, business restructuring, or economic downturns.',
    'Deduction from Wages': 'The employer argues this protects investment in training and equipment, and that recovery of costs from the employee is fair and contractually agreed.'
  };
  return advocateMap[topic] || 'This clause is framed to protect the commercial interests and risk exposure of the drafting party under standard business practice.';
}

/**
 * Dynamically builds the Critic voice directly from the KB rule, making it clause-specific.
 */
function buildCritic(clauseText, topMatch, riskAppetite = 'balanced') {
  if (!topMatch) {
    return 'This clause contains potentially unfair terms. A detailed review against applicable Nigerian statutes is strongly advised before signing.';
  }
  const severityPrefix = topMatch.severity === 'HIGH' ? '🚨 HIGH RISK: ' : '⚠️ MEDIUM RISK: ';
  let tone = '';
  if (riskAppetite === 'conservative') {
    tone = "🛡️ CONSERVATIVE ADVISORY: This clause is considered non-standard and presents a high liability profile that should be rejected or heavily modified to ensure zero exposure.";
  } else if (riskAppetite === 'aggressive') {
    tone = "🚀 STRATEGIC NOTE: While this is a risk, it may be acceptable if the commercial upside is high. Ensure you have secondary leverage elsewhere.";
  } else {
    tone = "⚖️ BALANCED VIEW: This clause deviates from industry standards and should be neutralized through negotiation.";
  }
  
  return `${severityPrefix}${topMatch.rule}\n\n${tone}\n\nApplicable Law: ${topMatch.statute}`;
}

/**
 * Builds a "Plain English" summary for a small business owner.
 * Dynamically generates text using an LLM, with a hardcoded fallback.
 */
async function buildPlainEnglish(topMatch, ragBestSentence, clauseText = null, persona = 'general') {
  if (!topMatch) return null;

  // ── Stage 1: Dynamic LLM Generation (Preferred) ──
  if (clauseText) {
    try {
      const dynamicResult = await generatePlainEnglish(clauseText, topMatch.rule, topMatch.statute, persona);
      if (dynamicResult) return dynamicResult;
    } catch (e) {
      console.warn("[Analysis] Dynamic Plain English failed, falling back to map.");
    }
  }

  // ── Stage 2: Deterministic Fallback ──
  const INTRO_MAP = {
    'Rent Increase':
      'The landlord can raise your rent by any amount, at any time, without your agreement.',
    'Structural Repairs':
      'This clause tries to make YOU responsible for major building repairs — like fixing the roof or foundation — that the landlord is legally required to handle.',
    'Notice to Quit':
      'You could be asked to leave the property with very little notice, even if you have done nothing wrong.',
    'Unlawful Eviction':
      'The landlord may be able to physically remove you from the property without going to court first, which is illegal in Nigeria.',
    'Penalty Clauses':
      'You could be charged large, automatic fines for minor breaches — many of which Nigerian courts will not enforce.',
    'Unbalanced Liability / Indemnity':
      'If anything goes wrong — even something outside your control — you alone will be responsible for paying all costs and damages.',
    'Intellectual Property Assignment':
      'Every piece of work you create under this contract — ideas, code, designs, content — immediately becomes their property, not yours.',
    'Termination for Convenience':
      'The other party can end this contract at any time, for any reason, without paying you compensation or giving a reason.',
    'Jurisdiction & Governing Law':
      'Any dispute must be resolved in a foreign or distant court that you may not be able to afford to travel to.',
    'Exclusivity / Non-Compete':
      'After this contract ends, you may be banned from working in your own industry or with your existing clients for years.',
    'Wrongful Termination':
      'Your employer can fire you without following the legal process, without warning, and potentially without paying your entitlements.',
    'Deduction from Wages':
      'Your employer can take money directly from your salary — without a court order — for reasons you may not have agreed to.'
  };

  const intro = INTRO_MAP[topMatch.topic] || 'This clause contains terms that could be unfair or illegal under Nigerian law.';
  
  // Return ONLY the advice for Plain English
  return `✅ WHAT THIS MEANS: ${intro}`;
}

/**
 * Consequence Engine — "Foresight Layer"
 * Predicts real-world consequences for the user in 3–12 months,
 * tailored to their persona (freelancer, founder, market_trader, general).
 */
/**
 * Consequence Engine — "Foresight Layer"
 * Dynamically predicts consequences using an LLM, with a hardcoded fallback.
 */
async function buildForesight(topMatch, persona = 'general', historicalOutcomes = [], clauseText = null) {
  if (!topMatch) return null;

  // ── Stage 1: Dynamic LLM Generation (Preferred) ──
  if (clauseText) {
    try {
      const dynamicResult = await generateDynamicForesight(clauseText, topMatch.rule, persona);
      if (dynamicResult) {
         // Append court data if available
         let statsStr = '';
         if (historicalOutcomes && historicalOutcomes.length > 0) {
           const wins = historicalOutcomes.filter(o => o === 'WON').length;
           const total = historicalOutcomes.length;
           const winRate = Math.round((wins / total) * 100);
           statsStr = `\n\n📊 Real Court Data: Based on ${total} similar historical appeal cases in Nigerian courts, businesses won only ${winRate}% of the time.`;
         }
         return `${dynamicResult}${statsStr}`;
      }
    } catch (e) {
      console.warn("[Analysis] Dynamic Foresight failed, falling back to map.");
    }
  }

  // ── Stage 2: Deterministic Fallback ──
  const topic = topMatch.topic;
  const FORESIGHT = {
    'Rent Increase': {
      general:      'In 12 months, uncapped rent could increase your costs by ₦500K–₦1M with no legal grounds to object.',
      freelancer:   'If your workspace rent increases mid-project, your profit margins shrink. Negotiate a rent-freeze tied to your contract duration.',
      founder:      'Unpredictable rent is a liability on your balance sheet. Investors will flag this as operational risk during due diligence.',
      market_trader:'A sudden rent hike could exceed your monthly sales margin, forcing relocation costs that wipe out 2–3 months of profit.'
    },
    'Structural Repairs': {
      general:      'You could face unexpected repair bills of ₦200K–₦2M for defects that existed before you moved in.',
      freelancer:   'A flooded office or broken AC — both your financial loss under this clause. Factor repair risk into your rental budget.',
      founder:      'Structural defects impacting your office could halt operations. This is an unquantified liability investors will scrutinize.',
      market_trader:'A burst pipe or damaged stall structure means you pay to fix it — and lose revenue while it is being repaired.'
    },
    'Unbalanced Liability / Indemnity': {
      general:      'One incident — a client injury, a data breach, a delayed delivery — and you absorb 100% of the cost with no cap.',
      freelancer:   'A single client claim (e.g., a bug causing data loss) could exceed your entire project fee. Demand a mutual liability cap equal to the contract value.',
      founder:      'Unlimited indemnity is a red flag for Series A investors. It suggests your legal team did not protect the company\'s downside risk.',
      market_trader:'If goods are damaged in transit, this clause means you alone pay — even if the courier is at fault. Insist on shared liability.'
    },
    'Intellectual Property Assignment': {
      general:      'Every idea, design, or code you produce under this contract is permanently theirs. You cannot reuse your own work for other clients.',
      freelancer:   'Scope creep risk: this clause historically leads to clients demanding more work under the same IP umbrella, reducing your effective hourly rate by 30–40% over the engagement.',
      founder:      'If you ever want to pivot or rebuild your product, you cannot use any of the core IP created under this agreement. It creates a permanent competitive disadvantage.',
      market_trader:'Any custom branding or product design you create for them — even your own ideas — become their property. Limit the assignment to project-specific deliverables.'
    },
    'Termination for Convenience': {
      general:      'They can end this agreement next month with no compensation, leaving you with no income and no recourse.',
      freelancer:   'Mid-project terminations with no kill fee are the #1 cause of cash flow crises for Nigerian freelancers. Negotiate a 25–50% kill fee clause.',
      founder:      'Investors see "termination for convenience" in key supplier or client contracts as a revenue concentration risk. Negotiate minimum commitment periods.',
      market_trader:'If they cancel your supply order mid-season, you are left with stock you bought on credit. Negotiate a minimum order guarantee or deposit clause.'
    },
    'Wrongful Termination': {
      general:      'You could lose your job tomorrow with no notice pay, gratuity, or right to challenge the decision.',
      freelancer:   'Abrupt project cancellations without a notice period mean you cannot plan your next engagement. Insist on 4–8 weeks written notice.',
      founder:      'A co-founder or key employee fired "at will" can become a litigation risk. Ensure termination clauses comply with the Labour Act and your shareholder agreement.',
      market_trader:'Losing a key staff member overnight during peak trading season can collapse your operations. Require a standard Labour Act notice period.'
    },
    'Penalty Clauses': {
      general:      'Automatic fines for minor delays can accumulate faster than your income, making the contract unprofitable within weeks.',
      freelancer:   'A 1-day delay triggering a 10% penalty means a 10-day project could cost you your entire fee. Cap penalties at 5% max and tie them to actual damages.',
      founder:      'Penalty clauses without a cap create an open-ended liability that will appear on your P&L. Insist on a maximum aggregate cap.',
      market_trader:'A delayed truck could trigger penalties that exceed the profit on the entire delivery. Always negotiate a Force Majeure clause covering road closures and fuel scarcity.'
    },
    'Notice to Quit': {
      general:      'Short notice means you have no time to find alternative premises. Budget for emergency relocation costs of ₦150K–₦500K.',
      freelancer:   'If your workspace disappears in 30 days, your active client projects are at risk. Negotiate at least 6 months notice as required by the Tenancy Law.',
      founder:      'Investors will not fund a company that can be evicted in 30 days. Secure a minimum 2-year lease with renewal rights before your next round.',
      market_trader:'30 days is not enough time to find a new stall, move stock, and retain your customer base. Negotiate a minimum 6-month notice clause.'
    },
    'Exclusivity / Non-Compete': {
      general:      'After this contract ends, you may be legally blocked from your own profession for 1–2 years.',
      freelancer:   'A broad non-compete could prevent you from taking any client in your industry after this project ends. Limit it to 6 months and direct competitors only.',
      founder:      'An overly broad non-compete on a co-founder or CTO could destroy your startup if they leave. Courts in Nigeria are unlikely to enforce broad restraints, but litigation is still costly.',
      market_trader:'If you cannot sell competing products after this contract, you lose your ability to diversify and survive market downturns. Negotiate the narrowest possible scope.'
    }
  };

  const insight = FORESIGHT[topic]?.[persona] || FORESIGHT[topic]?.general;
  if (!insight) return null;

  let statsStr = '';
  if (historicalOutcomes && historicalOutcomes.length > 0) {
    const wins = historicalOutcomes.filter(o => o === 'WON').length;
    const total = historicalOutcomes.length;
    const winRate = Math.round((wins / total) * 100);
    statsStr = `\n\n📊 Real Court Data: Based on ${total} similar historical appeal cases in Nigerian courts, businesses won only ${winRate}% of the time.`;
  }

  return `🔮 Data Foresight [${persona.replace('_', ' ').toUpperCase()}]: ${insight}${statsStr}`;
}

/**
 * Systematic Constraint Layer: Grounds AI in Nigerian Legal Standards
 * and Strategy Playbook goals.
 */
function buildSystematicHeader(strategySettings) {
  const { riskAppetite, industryContext, strategicGoal } = strategySettings || {
    riskAppetite: 'balanced',
    industryContext: 'General Commercial',
    strategicGoal: 'liquidity'
  };

  const baseline = `
⚖️ SYSTEMATIC CONSTRAINT LAYER (NIGERIAN LAW BASELINE)
- All analysis MUST be grounded in the Companies and Allied Matters Act (CAMA 2020) and Evidence Act.
- Flag any clause deviating from Nigerian 'Reasonableness' tests (e.g., excessive non-competes).
- If a clause conflicts with mandatory CAMA 2020 provisions, cite it as a 'CRITICAL RISK'.
`;

  const personalization = `
🎯 STRATEGIC PROFILE OVERRIDE [${riskAppetite.toUpperCase()} | ${strategicGoal.toUpperCase()}]
- Industry Focus: ${industryContext.toUpperCase()}.
- Goal: ${strategicGoal === 'protection' ? 'Prioritize IP retention and absolute liability protection over immediate commercial gains.' : 'Prioritize immediate cash flow and rapid deal execution, identifying only catastrophic risks.'}
- Appetite: ${riskAppetite === 'conservative' ? 'Flag even minor ambiguities as high risk.' : riskAppetite === 'aggressive' ? 'Only flag deal-breakers; suggest ways to weaponize clauses for growth.' : 'Balance safety with market standards.'}
`;

  return `${baseline}\n${personalization}\n`;
}

/**
 * Main pipeline: chunks text, flags risks, runs advocate-critic.
 */
async function chunkAndAnalyze(fullText, persona = 'general', strategySettings = null) {
  const t0 = Date.now();
  const chunks = chunkByClauses(fullText);

  // Detect contract type once from the full text — used to prevent hallucinations
  const contractType = detectContractType(fullText);
  console.log(`[Analysis] Contract type detected: ${contractType}`);

  // Build Systematic Constraint Header
  const strategyHeader = buildSystematicHeader(strategySettings);

  // Filter short chunks, cap at 20 clauses for very large contracts
  const validChunks = chunks.filter(c => c.clauseText.length >= 50).slice(0, 20);
  console.log(`[Analysis] ${validChunks.length} clauses to scan (from ${chunks.length} chunks)`);

  // ── Stage 1: Instant KB flagging (synchronous, hallucination-guarded) ──
  const flagged = validChunks
    .map(chunk => ({ chunk, risk: flagClause(chunk.clauseText, contractType) }))
    .filter(({ risk }) => risk?.isRisky);

  console.log(`[Analysis] KB flagged ${flagged.length} risky clauses in ${Date.now() - t0}ms`);

  // ── Stage 2: RAG searches & Case Data searches run in parallel for ALL flagged clauses ──
  const t1 = Date.now();
  const [ragResults, casesResults] = await Promise.all([
    Promise.all(flagged.map(({ chunk }) => searchLaw(chunk.clauseText).catch(() => []))),
    Promise.all(flagged.map(({ chunk }) => searchCases(chunk.clauseText).catch(() => [])))
  ]);
  console.log(`[Analysis] Semantic Search (Laws + Cases) completed in ${Date.now() - t1}ms`);

  // ── Stage 3: Build the final rich objects (Advocate, Critic, Plain English, Foresight) ──
  const flaggedClauses = await Promise.all(
    flagged.map(async ({ chunk, risk }, idx) => {
      const ragHits = ragResults[idx] || [];
      const caseHits = casesResults[idx] || [];
      const topMatch = risk.allMatches?.[0] || null;
      const riskAppetite = strategySettings?.riskAppetite || 'balanced';

      let advocate = buildAdvocate(chunk.clauseText, topMatch);
      let critic = buildCritic(chunk.clauseText, topMatch, riskAppetite);

      // Final contextual refinement based on strategic goal
      if (strategySettings?.strategicGoal === 'protection') {
        critic = `🛡️ PROTECTION FOCUS: ${critic}`;
      } else if (strategySettings?.strategicGoal === 'liquidity') {
        advocate = `💰 CASH-FIRST FOCUS: ${advocate}`;
      }

      // Add RAG results to critic output — best sentence + citation
      let ragBestSentence = null;
      let ragCitation = null;
      if (ragHits.length > 0) {
        const precedents = ragHits
          .map(r => ({ sentence: extractBestSentence(r, chunk.clauseText), citation: r.citation }))
          .filter(p => p.sentence)
          .filter(p => !topMatch?.rule || !p.sentence.toLowerCase().includes(topMatch.rule.substring(0, 40).toLowerCase()));
        if (precedents.length > 0) {
          ragBestSentence = precedents[0].sentence;
          ragCitation = precedents[0].citation;
          const citationStr = ragCitation ? ` [${ragCitation}]` : '';
          critic += `\n\n🔍 Legal Precedent${citationStr}:\n${precedents.slice(0, 2).map((p, i) => `${i + 1}. ${p.sentence}`).join('\n')}`;
        }
      }

      // Add additional matched laws
      if (risk.allMatches?.length > 1) {
        const additional = risk.allMatches.slice(1).map(m => `• [${m.severity}] ${m.statute} — ${m.topic}`).join('\n');
        critic += `\n\n⚖️ Also Triggered:\n${additional}`;
      }

      // Build Plain English + Foresight
      let plainEnglish = await buildPlainEnglish(topMatch, ragBestSentence, chunk.clauseText, persona);
      let foresight = await buildForesight(topMatch, persona, caseHits, chunk.clauseText);

      // Technical Analysis (Toggleable in UI)
      const technicalAnalysis = {
        statute: topMatch?.statute,
        rule: topMatch?.rule,
        citation: ragCitation,
        precedent: ragBestSentence,
        constraintLayer: strategyHeader // Move the header here
      };
      
      return {
        id: chunk.id,
        text: chunk.clauseText,
        riskCategory: risk.category,
        severity: risk.severity || 'MEDIUM',
        confidence: Math.round(risk.score * 100),
        advocate,
        critic,
        plainEnglish,
        foresight,
        technicalAnalysis,
        negotiation_tip: risk.negotiation_tip || '💡 Request a legal review before signing. Negotiate mutual obligations and cap all financial exposure.'
      };
    })
  );

  console.log(`[Analysis] Total pipeline: ${Date.now() - t0}ms for ${flaggedClauses.length} flagged clauses`);
  return flaggedClauses;
}

module.exports = { chunkAndAnalyze };
