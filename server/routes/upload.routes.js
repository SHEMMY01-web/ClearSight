const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { extractText } = require('../services/extraction.service');
const { chunkAndAnalyze } = require('../services/analysis.service');
const { supabase } = require('../services/supabase.service');

const router = express.Router();

const uploadSchema = z.object({
  persona: z.string().optional().default('general'),
  strategySettings: z.string().optional(),
  userId: z.string().optional()
});

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
    const validation = uploadSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error.format() });
    }

    const { persona, strategySettings: strategySettingsRaw, userId } = validation.data;
    const strategySettings = strategySettingsRaw ? JSON.parse(strategySettingsRaw) : null;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { buffer, mimetype, originalname } = req.file;

    // 1. Extract Text
    const text = await extractText(buffer, mimetype);

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Could not extract text from the provided file.' });
    }

    // 2. Chunk & Analyze (KB + RAG + Translation + Persona + Consequence Engine)
    const { flaggedClauses, plainTranslation, riskStatus } = await chunkAndAnalyze(text, persona, strategySettings);

    // Save to Supabase if userId is present
    if (req.body.userId && req.body.userId !== 'null') {
      const highRisks = flaggedClauses.filter(c => c.severity === 'HIGH').length;
      const score = Math.max(0, 100 - (highRisks * 25) - ((flaggedClauses.length - highRisks) * 10));

      const { error } = await supabase
        .from('contracts')
        .insert({
          user_id: req.body.userId,
          filename: req.file.originalname,
          risk_score: score,
          analysis_results: flaggedClauses,
          plain_translation: plainTranslation,
          risk_status: riskStatus,
          strategic_summary: "CAMA 2020 Validated"
        });
      if (error) console.error('Supabase Save Error:', error);
    }

    res.json({
      success: true,
      filename: originalname,
      persona,
      riskStatus,
      plainTranslation,
      extractedTextPreview: text.substring(0, 500) + '...',
      analysis: flaggedClauses
    });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

module.exports = router;
