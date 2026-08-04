/**
 * Diagnostic script to investigate the 7→1 flag regression.
 * 
 * This script traces every stage of the pipeline with real-world contract text
 * to identify exactly where flags are being dropped.
 * 
 * Stages traced:
 *   1. chunkByClauses: raw split → isValidClauseChunk filter → valid chunks
 *   2. flagClause on each valid chunk: pattern match candidates → threshold gate
 *   3. Final flaggedClauses count returned by chunkAndAnalyze
 */

const {
  chunkAndAnalyze,
  chunkByClauses,
  flagClause
} = require('../services/analysis.service');

// ============================================================================
// This is a realistic multi-clause commercial distribution contract that
// approximates the structure and content density of a real 32-page PDF.
// It contains 8 distinct operative clauses that SHOULD be flagged.
// ============================================================================
const REALISTIC_CONTRACT = `
EXCLUSIVE DISTRIBUTION AGREEMENT

THIS AGREEMENT is made on the 15th day of March, 2024

BETWEEN:

GREAT PRODUCTS NIGERIA LIMITED (RC 123456) a company incorporated under the laws of the Federal Republic of Nigeria, having its registered office at 22 Marina Road, Victoria Island, Lagos ("the Supplier")

AND

BRIGHT STORES LIMITED (RC 789012) a company incorporated under the laws of the Federal Republic of Nigeria, having its registered office at 14 Wuse II, Abuja ("the Distributor")

WHEREAS the Supplier is the manufacturer and sole owner of the products described in Schedule 1 ("the Products") and desires to appoint the Distributor to sell and distribute the Products within the Territory; and WHEREAS the Distributor desires to be appointed as the exclusive distributor of the Products in the Territory.

NOW THEREFORE, in consideration of the mutual promises and covenants herein, the Parties agree as follows:

1. APPOINTMENT AND TERRITORY

1.1 The Supplier hereby appoints the Distributor as the exclusive distributor of the Products within the Federal Republic of Nigeria ("the Territory"), subject to the terms and conditions of this Agreement.

1.2 The Distributor accepts such appointment and agrees to use its best commercial efforts to promote, market, and distribute the Products throughout the Territory.

1.3 Notwithstanding Clause 1.1, the Supplier reserves the right to appoint additional distributors within the Territory at its sole discretion and without prior written notice to the Distributor.

2. MINIMUM PURCHASE OBLIGATIONS AND SHORTFALL PENALTIES

2.1 The Distributor shall purchase a minimum quantity of Ten Thousand (10,000) units of the Products per calendar quarter ("Minimum Purchase Quota").

2.2 In the event that the Distributor fails to purchase the Minimum Purchase Quota in any given quarter, the Distributor shall pay to the Supplier a shortfall penalty equal to thirty percent (30%) of the invoice value of the unpurchased balance.

2.3 The shortfall penalty shall be calculated automatically at the end of each quarter and shall be payable within fourteen (14) days of the Supplier's written demand. Failure to pay the shortfall penalty within the stipulated period shall constitute an Event of Default under Clause 9.

2.4 For the avoidance of doubt, the Supplier's right to claim the shortfall penalty is in addition to, and not in substitution for, any other rights or remedies available under this Agreement or at law.

3. PRICING, PAYMENT AND PENALTY INTEREST

3.1 The prices of the Products shall be as set out in the current Price List issued by the Supplier from time to time.

3.2 The Supplier reserves the right to vary and amend the prices of the Products at any time at its sole discretion without prior written consent of the Distributor. Any such price variation shall take effect immediately upon notification.

3.3 Payment for all Products ordered shall be made by the Distributor within thirty (30) days from the date of invoice.

3.4 In the event of late payment, the Distributor shall pay default interest on the outstanding amount at the rate of six and a half percent (6.5%) per month, compounding monthly, equivalent to seventy-nine percent (79%) per annum. This default interest shall accrue automatically without notice from the date the payment becomes due until the date of actual payment in full.

3.5 The Supplier shall be entitled to set off any amounts owed by the Distributor under this Agreement (including shortfall penalties, default interest, and damages) against any sums otherwise payable by the Supplier to the Distributor, without prior notice.

4. DELIVERY, ACCEPTANCE AND DEEMED APPROVAL

4.1 The Supplier shall deliver the Products to the Distributor's warehouse at the address specified in writing. Risk in the Products shall pass to the Distributor upon delivery.

4.2 The Distributor shall inspect all Products within forty-eight (48) hours of delivery and notify the Supplier in writing of any defects or shortages.

4.3 If the Distributor fails to notify the Supplier of defects within the forty-eight (48) hour period, the Products shall be deemed accepted in full and the Distributor shall have no further right to claim against the Supplier in respect of quality, quantity, or condition.

4.4 Continued use or resale of the Products by the Distributor after delivery shall constitute irrevocable deemed acceptance and approval of any and all terms, conditions, pricing, and specifications, including any unilateral amendments thereto.

5. RETENTION OF TITLE AND FORFEITURE

5.1 Notwithstanding delivery, title and legal ownership in the Products shall not pass from the Supplier to the Distributor until the Supplier has received payment in full for all sums due under this Agreement and any other agreement between the parties.

5.2 Until title passes, the Distributor holds the Products as fiduciary bailee for the Supplier and shall store them separately and in a manner that clearly identifies them as the Supplier's property.

5.3 In the event of any default (including late payment of any invoice by more than seven (7) days), the Supplier shall have the immediate right to enter the Distributor's premises and repossess all Products in which title has not passed, without liability for trespass or damages.

5.4 Upon exercise of the right of repossession under Clause 5.3, ALL payments previously made by the Distributor for the repossessed Products shall be immediately and irrevocably forfeited to the Supplier as liquidated damages.

6. INDEMNIFICATION AND LIABILITY

6.1 The Distributor shall indemnify and hold harmless the Supplier, its directors, officers, employees, and agents from and against any and all losses, claims, damages, liabilities, costs, and expenses (including reasonable legal fees) arising out of or in connection with:
(a) the Distributor's distribution, marketing, or sale of the Products;
(b) any breach by the Distributor of any term of this Agreement;
(c) any act or omission of the Distributor, its employees, agents, or sub-distributors;
(d) any product liability claims made by end users or third parties.

6.2 The indemnification obligation under Clause 6.1 shall be unlimited in amount and shall survive the termination or expiry of this Agreement indefinitely.

6.3 The Supplier's total aggregate liability under this Agreement, whether in contract, tort (including negligence), or otherwise, shall not exceed the sum of Fifty Thousand Naira (₦50,000).

6.4 In no event shall the Supplier be liable for any indirect, consequential, special, or incidental damages, loss of profits, loss of business, or loss of opportunity, even if advised of the possibility of such damages.

7. TERMINATION

7.1 The Supplier may terminate this Agreement immediately by written notice to the Distributor if:
(a) the Distributor fails to meet the Minimum Purchase Quota for any two consecutive quarters;
(b) the Distributor fails to make any payment when due under this Agreement;
(c) the Distributor becomes insolvent, enters administration, or has a receiver appointed;
(d) in the sole opinion of the Supplier, the Distributor has acted in a manner prejudicial to the Supplier's reputation or business interests.

7.2 The Distributor may only terminate this Agreement by giving twelve (12) months prior written notice to the Supplier, such notice to be accompanied by a termination fee equal to the average quarterly purchase value over the preceding four quarters.

7.3 Upon termination for any reason, all amounts owing by the Distributor to the Supplier shall become immediately due and payable. The Distributor shall have no claim for compensation, damages, or loss of goodwill arising from or in connection with the termination.

8. NON-COMPETITION AND NON-SOLICITATION

8.1 During the term of this Agreement and for a period of five (5) years after its termination or expiry, the Distributor shall not, directly or indirectly:
(a) engage in the distribution, sale, or promotion of any products that compete with the Products within the Territory;
(b) solicit or entice away any customer, supplier, employee, or agent of the Supplier;
(c) establish or participate in any business that competes with the Supplier's business.

8.2 The restrictions in Clause 8.1 shall apply worldwide and shall not be limited to the Territory.

9. EVENTS OF DEFAULT AND REMEDIES

9.1 Each of the following shall constitute an Event of Default:
(a) failure to pay any sum due within fourteen (14) days of the due date;
(b) breach of any warranty, representation, or undertaking by the Distributor;
(c) any material adverse change in the Distributor's financial condition.

9.2 Upon an Event of Default, all amounts owing shall immediately accelerate and become due and payable, and the Supplier may exercise any or all of its rights under this Agreement, including repossession under Clause 5 and forfeiture of payments under Clause 5.4.

10. GOVERNING LAW AND DISPUTE RESOLUTION

10.1 This Agreement shall be governed by and construed in accordance with the Laws of the Federal Republic of Nigeria.

10.2 Any dispute arising out of or in connection with this Agreement shall be submitted exclusively to the jurisdiction of the courts of Lagos State. The Distributor hereby irrevocably waives any right to challenge the jurisdiction of such courts or to commence proceedings in any other forum.

IN WITNESS WHEREOF the Parties have executed this Agreement on the date first above written.

_________________________               _________________________
For and on behalf of                     For and on behalf of
GREAT PRODUCTS NIGERIA LIMITED           BRIGHT STORES LIMITED
`;

async function diagnose() {
  console.log('=' .repeat(80));
  console.log('DIAGNOSTIC: Flag Regression Investigation');
  console.log('=' .repeat(80));
  console.log(`Contract text length: ${REALISTIC_CONTRACT.length} chars`);
  console.log();

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 1: Chunking
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('─'.repeat(80));
  console.log('STAGE 1: chunkByClauses (raw split → isValidClauseChunk filter)');
  console.log('─'.repeat(80));

  const chunks = chunkByClauses(REALISTIC_CONTRACT);
  console.log(`\nTotal valid chunks produced: ${chunks.length}`);
  chunks.forEach((c, i) => {
    console.log(`  [${i+1}] id: "${c.id.substring(0, 60)}" | length: ${c.clauseText.length} chars`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 2: Individual flagClause on each chunk
  // ═══════════════════════════════════════════════════════════════════════════
  console.log();
  console.log('─'.repeat(80));
  console.log('STAGE 2: flagClause per chunk (balanced/liquidity, no RAG hits)');
  console.log('─'.repeat(80));

  const balancedSettings = { riskAppetite: 'balanced', strategicGoal: 'liquidity' };
  const conservativeSettings = { riskAppetite: 'conservative', strategicGoal: 'protection' };
  
  let balancedFlagCount = 0;
  let conservativeFlagCount = 0;

  for (const chunk of chunks) {
    const balancedResult = flagClause(chunk.clauseText, null, balancedSettings, []);
    const conservativeResult = flagClause(chunk.clauseText, null, conservativeSettings, []);

    const bFlag = balancedResult?.isRisky ? '✅ FLAGGED' : '❌ NOT FLAGGED';
    const cFlag = conservativeResult?.isRisky ? '✅ FLAGGED' : '❌ NOT FLAGGED';

    if (balancedResult?.isRisky) balancedFlagCount++;
    if (conservativeResult?.isRisky) conservativeFlagCount++;

    console.log(`\n  Chunk: "${chunk.id.substring(0, 55)}..." (${chunk.clauseText.length} chars)`);
    console.log(`    Balanced (threshold 0.85):      ${bFlag}${balancedResult?.isRisky ? ` | topic: ${balancedResult.allMatches?.[0]?.topic} | confidence: ${balancedResult.flagConfidence}` : ''}`);
    console.log(`    Conservative (threshold 0.65):   ${cFlag}${conservativeResult?.isRisky ? ` | topic: ${conservativeResult.allMatches?.[0]?.topic} | confidence: ${conservativeResult.flagConfidence}` : ''}`);
  }

  console.log();
  console.log('─'.repeat(80));
  console.log('STAGE 2 SUMMARY');
  console.log('─'.repeat(80));
  console.log(`  Balanced (balanced/liquidity):        ${balancedFlagCount} / ${chunks.length} chunks flagged`);
  console.log(`  Conservative (conservative/protection): ${conservativeFlagCount} / ${chunks.length} chunks flagged`);

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 3: Full chunkAndAnalyze pipeline (both profiles)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log();
  console.log('─'.repeat(80));
  console.log('STAGE 3: Full chunkAndAnalyze pipeline');
  console.log('─'.repeat(80));

  console.log('\n  [A] balanced / liquidity:');
  const resultBalanced = await chunkAndAnalyze(REALISTIC_CONTRACT, 'general', balancedSettings, null);
  console.log(`  → flaggedClauses.length = ${resultBalanced.flaggedClauses.length}`);
  console.log(`  → riskStatus = ${resultBalanced.riskStatus}`);
  resultBalanced.flaggedClauses.forEach((c, i) => {
    console.log(`    [${i+1}] id: "${c.id.substring(0, 50)}" | category: ${c.riskCategory} | severity: ${c.severity} | confidence: ${c.confidence}%`);
  });

  console.log('\n  [B] conservative / protection:');
  const resultConservative = await chunkAndAnalyze(REALISTIC_CONTRACT, 'general', conservativeSettings, null);
  console.log(`  → flaggedClauses.length = ${resultConservative.flaggedClauses.length}`);
  console.log(`  → riskStatus = ${resultConservative.riskStatus}`);
  resultConservative.flaggedClauses.forEach((c, i) => {
    console.log(`    [${i+1}] id: "${c.id.substring(0, 50)}" | category: ${c.riskCategory} | severity: ${c.severity} | confidence: ${c.confidence}%`);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSIS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log();
  console.log('=' .repeat(80));
  console.log('DIAGNOSIS');
  console.log('=' .repeat(80));

  if (resultBalanced.flaggedClauses.length >= 5) {
    console.log('✅ Balanced profile correctly flags multiple clauses.');
  } else {
    console.log(`🚨 REGRESSION CONFIRMED: Balanced profile only flags ${resultBalanced.flaggedClauses.length} clauses (expected >= 5).`);
    console.log('   Root cause is likely:');
    console.log('   - threshold 0.85 rejecting pattern-only matches (flagConfidence 0.88 is barely above)');
    console.log('   - isValidClauseChunk filtering out operative clauses');
    console.log('   - contractType detection misrouting category filtering');
  }

  if (resultConservative.flaggedClauses.length >= 7) {
    console.log('✅ Conservative profile correctly flags 7+ clauses.');
  } else {
    console.log(`⚠️  Conservative profile only flags ${resultConservative.flaggedClauses.length} clauses (expected >= 7).`);
  }
}

diagnose().catch(err => {
  console.error('Diagnostic script failed:', err);
  process.exit(1);
});
