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

const { initKnowledgeBase } = require('./services/rag.service');

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ClearSight API'
  });
});

app.listen(PORT, async () => {
  await initKnowledgeBase();
  console.log(`Server is running on port ${PORT}`);
});
