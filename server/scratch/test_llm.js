const { generatePlainEnglish, generateDynamicForesight } = require('../services/llm.service');

async function runTest() {
    console.log("🚀 Testing Dynamic Vocabulary Reduction...");
    
    const testClause = "The Landlord reserves the right to review the Rent at any time during the subsistence of this tenancy provided that such review shall be in accordance with the prevailing market rate.";
    const testRule = "Rent increases must be agreed upon by both parties and should follow statutory notice periods.";
    const testStatute = "Lagos State Tenancy Law 2011";
    const testPersona = "freelancer";

    console.log("\n--- Input Clause ---");
    console.log(testClause);

    console.log("\n--- Testing Plain English Generation ---");
    const plainEnglish = await generatePlainEnglish(testClause, testRule, testStatute, testPersona);
    console.log(plainEnglish || "❌ Failed to generate Plain English");

    console.log("\n--- Testing Foresight Generation ---");
    const foresight = await generateDynamicForesight(testClause, testRule, testPersona);
    console.log(foresight || "❌ Failed to generate Foresight");
    
    console.log("\n✅ Test Complete.");
}

runTest().catch(err => {
    console.error("Test Error:", err);
});
