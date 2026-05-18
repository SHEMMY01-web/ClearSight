require('dotenv').config();
const { initKnowledgeBase, searchLaw, searchCases } = require('./services/rag.service');

async function test() {
  try {
    console.log("Initializing KB...");
    await initKnowledgeBase();
    console.log("KB Initialized. Testing search...");
    const results = await searchLaw("If an employee is fired without notice, what are the consequences?");
    console.log("Search Results:", JSON.stringify(results, null, 2));
    
    // Check chunking structure
    const cases = await searchCases("termination without notice");
    console.log("Cases:", cases);
  } catch (err) {
    console.error(err);
  }
}
test();
