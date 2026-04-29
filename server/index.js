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

app.post('/api/simulate', (req, res) => {
  try {
    const { buyoutOffer, monthlyStreams, strategySettings } = req.body;
    if (!buyoutOffer || isNaN(buyoutOffer)) {
      return res.status(400).json({ error: 'Valid buyoutOffer is required' });
    }
    const result = analyzeMusicContract(Number(buyoutOffer), Number(monthlyStreams) || 100000, strategySettings);
    res.json(result);
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // Pre-warm the AI model so the first user request is instant
  warmupEmbedder().catch(err => console.warn('Embedder warmup skipped:', err.message));
  // Load ChromaDB (non-blocking — runs in background)
  initKnowledgeBase().catch(err => console.warn('ChromaDB init failed:', err.message));
});
