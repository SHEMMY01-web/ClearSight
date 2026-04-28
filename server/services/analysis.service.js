const { HfInference } = require('@huggingface/inference');

const hf = new HfInference(process.env.HF_API_KEY);

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
const { searchLaw } = require('./rag.service');

// Load Knowledge Base
const kbPath = path.join(__dirname, '../knowledge_base.json');
let knowledgeBase = { tenancy_law: [] };
try {
  knowledgeBase = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
} catch (e) {
  console.error("Could not load knowledge_base.json", e);
}



/**
 * Finds ALL matching statutes from the knowledge base.
 * Returns enriched match objects with severity and negotiation tips.
 */
function getAllMatchingStatutes(clauseText) {
  const lowerText = clauseText.toLowerCase();
  const matches = [];
  for (const category in knowledgeBase) {
    for (const law of knowledgeBase[category]) {
      for (const flag of law.red_flags) {
        if (lowerText.includes(flag.toLowerCase())) {
          matches.push({
            statute: law.statute,
            rule: law.rule,
            topic: law.topic,
            severity: law.severity || 'MEDIUM',
            negotiation_tip: law.negotiation_tip || null,
            matchedFlag: flag,
            category
          });
          break; // Only match each law once per topic
        }
      }
    }
  }
  return matches;
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
 * Primary: KB keyword matching. BART used only as fallback enrichment.
 * @param {string} clauseText 
 * @returns {Promise<{ isRisky: boolean, category: string, score: number, statute: string } | null>}
 */
async function flagClause(clauseText) {
  // Clean up OCR artifacts for Naira symbol
  const cleanText = clauseText.replace(/â‚¦/g, 'Naira ').replace(/₦/g, 'Naira ');

  // ── Primary: JSON KB Keyword Matching (instant, deterministic) ──
  const matches = getAllMatchingStatutes(cleanText);
  if (matches.length > 0) {
    const topMatch = matches[0];
    // HIGH severity gets 0.97, MEDIUM gets 0.91
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

  // ── Secondary: BART-MNLI Zero-Shot (for clauses not in KB) ──
  try {
    const contextText = cleanText;
    const candidateLabels = [
      "unfair rent increase",
      "unbalanced liability",
      "predatory financial terms",
      "standard business clause"
    ];

    const result = await hf.zeroShotClassification({
      model: 'facebook/bart-large-mnli',
      inputs: contextText,
      parameters: { candidate_labels: candidateLabels, multi_label: false }
    });

    const topLabel = Array.isArray(result) ? result[0].labels[0] : result.labels[0];
    const topScore = Array.isArray(result) ? result[0].scores[0] : result.scores[0];

    if (topLabel !== "standard business clause" && topScore > 0.6) {
      return { isRisky: true, category: topLabel, score: topScore, statute: null };
    }
  } catch (error) {
    // BART is secondary — timeouts are acceptable, we just skip it
    console.warn('BART-MNLI skipped (timeout/error):', error.message?.substring(0, 60));
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
function buildCritic(clauseText, topMatch) {
  if (!topMatch) {
    return 'This clause contains potentially unfair terms. A detailed review against applicable Nigerian statutes is strongly advised before signing.';
  }
  const severityPrefix = topMatch.severity === 'HIGH' ? '🚨 HIGH RISK: ' : '⚠️ MEDIUM RISK: ';
  return `${severityPrefix}${topMatch.rule}\n\nApplicable Law: ${topMatch.statute}`;
}

/**
 * Advocate-Critic Analysis — fully dynamic, KB-driven for all 10+ topics.
 * ChromaDB runs in parallel with no blocking.
 */
async function generateAdvocateCritic(clauseText, riskCategory, relevantStatute, severity, negotiation_tip, allMatches) {
  const topMatch = allMatches?.[0] || null;

  const advocate = buildAdvocate(clauseText, topMatch);
  let critic = buildCritic(clauseText, topMatch);

  // ── Layer 1: KB Statute grounding (already embedded in buildCritic, add full rule if different) ──
  if (relevantStatute && topMatch && !relevantStatute.includes(topMatch.statute)) {
    critic += `\n\n📜 Additional Statutory Basis:\n${relevantStatute}`;
  }

  // ── Layer 2: ChromaDB RAG (always runs, non-blocking via Promise) ──
  try {
    const ragResults = await searchLaw(clauseText);
    if (ragResults && ragResults.length > 0) {
      const unique = ragResults.filter(r =>
        !topMatch?.rule || !r.toLowerCase().includes(topMatch.rule.substring(0, 40).toLowerCase())
      );
      if (unique.length > 0) {
        critic += `\n\n🔍 Supporting Precedent (ChromaDB):\n${unique.slice(0, 2).map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
      }
    }
  } catch (ragErr) {
    console.warn('ChromaDB RAG search failed (non-fatal):', ragErr.message?.substring(0, 60));
  }

  // ── Layer 3: Additional matched KB laws ──
  if (allMatches && allMatches.length > 1) {
    const additional = allMatches.slice(1).map(m => `• [${m.severity}] ${m.statute} — ${m.topic}`).join('\n');
    critic += `\n\n⚖️ Also Triggered:\n${additional}`;
  }

  return {
    advocate,
    critic,
    negotiation_tip: negotiation_tip || '💡 Request a legal review before signing. Negotiate mutual obligations and cap all financial exposure.',
    severity: severity || 'MEDIUM'
  };
}

/**
 * Main pipeline: chunks text, flags risks, runs advocate-critic.
 * Chunks are processed in PARALLEL (up to 5 at a time) for speed.
 */
async function chunkAndAnalyze(fullText) {
  const chunks = chunkByClauses(fullText);
  
  // Filter short chunks upfront
  const validChunks = chunks.filter(c => c.clauseText.length >= 50).slice(0, 12);

  // Process in parallel batches of 5 to avoid rate limits while being fast
  const BATCH_SIZE = 5;
  const flaggedClauses = [];

  for (let i = 0; i < validChunks.length; i += BATCH_SIZE) {
    const batch = validChunks.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (chunk) => {
        const risk = await flagClause(chunk.clauseText);
        if (!risk?.isRisky) return null;

        const advocateCritic = await generateAdvocateCritic(
          chunk.clauseText,
          risk.category,
          risk.statute,
          risk.severity,
          risk.negotiation_tip,
          risk.allMatches
        );

        return {
          id: chunk.id,
          text: chunk.clauseText,
          riskCategory: risk.category,
          severity: risk.severity || 'MEDIUM',
          confidence: Math.round(risk.score * 100),
          advocate: advocateCritic.advocate,
          critic: advocateCritic.critic,
          negotiation_tip: advocateCritic.negotiation_tip
        };
      })
    );

    flaggedClauses.push(...batchResults.filter(Boolean));
  }

  return flaggedClauses;
}

module.exports = { chunkAndAnalyze };
