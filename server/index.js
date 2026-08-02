const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Middleware — CORS must come BEFORE helmet
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://clear-sight-five.vercel.app',
    /\.vercel\.app$/   // Allow all Vercel preview deployments
  ],
  credentials: true
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Routes
const uploadRoutes = require('./routes/upload.routes');

app.use('/api/upload', uploadRoutes);

const { initKnowledgeBase, warmupEmbedder } = require('./services/rag.service');

app.get('/', (req, res) => {
  res.status(200).send('ClearSight API Live');
});

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
  const { riskAppetite, monthlyExpenses, strategicGoal, industryContext } = strategySettings;

  // Route to the advanced Monte Carlo simulator if the user is a Musician
  if (industryContext === 'Afrobeats Music') {
    const musicResult = analyzeMusicContract(buyoutOffer, monthlyStreams, strategySettings);
    return res.json({
      optimalDecision: musicResult.optimalDecision,
      dealRisk: musicResult.dealRisk,
      confidenceScore: musicResult.confidenceScore,
      roi: musicResult.foresightSummary // We'll display the advanced summary here
    });
  }

  // Generic M&A Business Logic
  // 1. Calculate Baseline Liability Risk (₦)
  const annualBurn = monthlyExpenses * 12;
  const liabilityMultiplier = riskAppetite === 'aggressive' ? 0.5 : riskAppetite === 'balanced' ? 1.5 : 2.5;
  const estimatedExposure = annualBurn * liabilityMultiplier;

  // 2. Calculate Strategic ROI
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Lazy-load heavy tasks to avoid blocking the port binding health check
  setTimeout(async () => {
    console.log('⚡ Starting background AI initialization...');

    try {
      const { warmupEmbedder, initKnowledgeBase } = require('./services/rag.service');
      const { warmupLLM } = require('./services/llm.service');

      // 1. Pre-warm embedding model
      await warmupEmbedder();

      // 2. Init ChromaDB
      await initKnowledgeBase();

      // 3. Pre-warm LLM (Now uses Cloud API, no memory overhead)
      await warmupLLM();

      console.log('🚀 All systems ready in background.');
    } catch (err) {
      console.error('❌ Background Initialization Failed:', err.message);
    }
  }, 5000); // 5 second delay to let Render health check pass
});
