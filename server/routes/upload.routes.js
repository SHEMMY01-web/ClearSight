const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { extractText } = require('../services/extraction.service');
const { chunkAndAnalyze } = require('../services/analysis.service');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF and images
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDFs and images are supported.'));
    }
  }
});

router.post('/', upload.single('contract'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { buffer, mimetype, originalname } = req.file;
    // Persona sent from the frontend dropdown: general | freelancer | founder | market_trader
    const persona = req.body?.persona || 'general';

    // 1. Extract Text
    const text = await extractText(buffer, mimetype);

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Could not extract text from the provided file.' });
    }

    // 2. Chunk & Analyze (KB + RAG + Persona + Consequence Engine)
    const analysisResults = await chunkAndAnalyze(text, persona);

    res.json({
      success: true,
      filename: originalname,
      persona,
      extractedTextPreview: text.substring(0, 500) + '...',
      analysis: analysisResults
    });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

module.exports = router;
