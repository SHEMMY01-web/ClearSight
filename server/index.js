const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
const uploadRoutes = require('./routes/upload.routes');

app.use('/api/upload', uploadRoutes);

const { initKnowledgeBase, warmupEmbedder } = require('./services/rag.service');

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ClearSight API'
  });
});

const { analyzeMusicContract } = require('./services/ConsequenceEngine');

app.post('/api/simulate', async (req, res) => {
  const { buyoutOffer, monthlyStreams, strategySettings } = req.body;
  const { riskAppetite, monthlyExpenses, strategicGoal } = strategySettings;

  // 1. Calculate Baseline Liability Risk (₦)
  // High risk = 2.5x annual burn exposure | Balanced = 1.0x | Conservative = 0.5x
  const annualBurn = monthlyExpenses * 12;
  const liabilityMultiplier = riskAppetite === 'aggressive' ? 0.5 : riskAppetite === 'balanced' ? 1.5 : 2.5;
  const estimatedExposure = annualBurn * liabilityMultiplier;

  // 2. Calculate Strategic ROI
  // Protection goal focuses on minimizing loss | Liquidity goal focuses on cash multiples
  const roi = (buyoutOffer / (annualBurn || 1)).toFixed(2);
  const confidence = strategicGoal === 'protection' ? '85%' : '65%';

  // 3. Optimal Decision Logic
  let optimalDecision = "PROCEED WITH CAUTION";
  if (roi > 3 && riskAppetite !== 'conservative') optimalDecision = "STRATEGIC EXIT RECOMMENDED";
  if (roi < 1 && strategicGoal === 'protection') optimalDecision = "REJECT: SUB-OPTIMAL TERMS";
  if (estimatedExposure > 5000000 && riskAppetite === 'conservative') optimalDecision = "REJECT: HIGH LEGAL EXPOSURE";

  res.json({
    optimalDecision,
    dealRisk: `₦${(estimatedExposure / 1000000).toFixed(1)}M Est. Exposure`,
    confidenceScore: confidence,
    roi: `${roi}x Burn Multiple`
  });
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  console.log('⚡ Pre-warming local embedding model...');
  try {
    const { warmupEmbedder } = require('./services/rag.service');
    await warmupEmbedder();
    console.log('✓ Embedding model ready.');
  } catch (err) {
    console.warn('⚠️ Embedding model failed to load, but server is continuing.');
  }

  // Initialize ChromaDB asynchronously so it doesn't block startup
  initializeChroma().catch(err => {
    console.error('❌ ChromaDB Initialization Failed:', err.message);
    console.warn('🛡️ ClearSight is running in "Direct-AI" mode (No RAG).');
  });
});

async function initializeChroma() {
  const { initKnowledgeBase } = require('./services/rag.service');
  await initKnowledgeBase();
}
