const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { extractText } = require('../services/extraction.service');
const { chunkAndAnalyze } = require('../services/analysis.service');
const { supabase } = require('../services/supabase.service');
const { authMiddleware } = require('../middleware/auth.middleware');

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

router.post('/', authMiddleware, upload.any(), async (req, res) => {
  try {
    const validation = uploadSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid request data', details: validation.error.format() });
    }

    const { persona, strategySettings: strategySettingsRaw } = validation.data;
    const strategySettings = strategySettingsRaw ? JSON.parse(strategySettingsRaw) : null;

    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const primaryFile = files[0];
    const originalname = files.length === 1 ? primaryFile.originalname : `${files.length}_scanned_pages.pdf`;

    // 1. Extract Text + Page Stats
    const { text, pageStats } = await extractText(files.length === 1 ? primaryFile : files);

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Could not extract text from the provided file. Please ensure the image is clear.' });
    }

    const wordCount = (text.match(/\b[a-zA-Z]{3,}\b/g) || []).length;
    if (wordCount < 5) {
      return res.status(400).json({ error: 'This does not appear to be a document. Please upload a clear photo or PDF containing readable text.' });
    }

    // 2. Initial DB Insert to get Job ID
    const { data: contractData, error: insertError } = await supabase
      .from('contracts')
      .insert({
        user_id: req.user.id,
        filename: originalname,
        risk_score: 0,
        analysis_results: [],
        plain_translation: "Processing...",
        risk_status: 'processing',
        strategic_summary: "Pending"
      })
      .select('id')
      .single();

    if (insertError || !contractData) {
      console.error('Initial insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create job.' });
    }

    const jobId = contractData.id;

    // 3. Return 202 Accepted immediately
    res.status(202).json({
      success: true,
      message: 'Processing started',
      jobId,
      filename: originalname,
      persona,
      pageStats,
      extractedTextPreview: text.substring(0, 500) + '...'
    });

    // 4. Background Processing
    (async () => {
      try {
        const { flaggedClauses, plainTranslation, riskStatus, pageStats: finalPageStats } = await chunkAndAnalyze(text, persona, strategySettings, pageStats);

        const highRisks = flaggedClauses.filter(c => c.severity === 'HIGH').length;
        const score = Math.max(0, 100 - (highRisks * 25) - ((flaggedClauses.length - highRisks) * 10));

        await supabase
          .from('contracts')
          .update({
            risk_score: score,
            analysis_results: flaggedClauses,
            plain_translation: plainTranslation,
            risk_status: riskStatus,
            strategic_summary: "CAMA 2020 Validated"
          })
          .eq('id', jobId);

      } catch (bgError) {
        console.error('Background processing error:', bgError);
        await supabase
          .from('contracts')
          .update({
            risk_status: 'failed',
            strategic_summary: 'Processing failed due to an internal error.'
          })
          .eq('id', jobId);
      }
    })();

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

module.exports = router;
