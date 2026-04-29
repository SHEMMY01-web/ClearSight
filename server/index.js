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
  // Pre-warm the AI model so the first user request is instant
  warmupEmbedder().catch(err => console.warn('Embedder warmup skipped:', err.message));
  // Load ChromaDB (non-blocking — runs in background)
  initKnowledgeBase().catch(err => console.warn('ChromaDB init failed:', err.message));
});
