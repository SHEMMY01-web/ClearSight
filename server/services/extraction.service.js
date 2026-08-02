const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { Readable } = require('stream');

/**
 * Highly efficient stream-based image pre-processing.
 * Processes pixel data chunk-by-chunk to minimize RAM footprint on the server.
 * Performs: Grayscale, Contrast Normalization, Sharpening, and Auto-rotation.
 * @param {Buffer} imageBuffer 
 * @returns {Promise<Buffer>} Processed Image Buffer
 */
async function preprocessImageForOCR(imageBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const readStream = Readable.from(imageBuffer);
      
      const transformer = sharp()
        // 1. Auto-orient based on EXIF data (fixes upside-down phone uploads)
        .rotate() 
        // 2. Convert to grayscale (removes color noise)
        .greyscale() 
        // 3. Normalize contrast (stretches luminance to make text pop against background)
        .normalize() 
        // 4. Sharpen edges (enhances text characters for easier character recognition)
        .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.0 })
        // 5. Output as a clean, uncompressed PNG stream for Tesseract
        .toFormat('png');
        
      const chunks = [];
      transformer.on('data', chunk => chunks.push(chunk));
      transformer.on('end', () => resolve(Buffer.concat(chunks)));
      transformer.on('error', err => {
        console.error("Stream transformation failed:", err);
        resolve(imageBuffer); // Fallback to raw buffer
      });

      readStream.pipe(transformer);
    } catch (error) {
      console.error("Stream pre-processing setup failed:", error);
      resolve(imageBuffer); // Fallback
    }
  });
}

const MAX_PDF_PAGES = 10;

/**
 * Extracts text from single/multiple files (PDF or Images).
 * Returns { text, pageStats } with page-count capping and avgCharsPerPage derivation.
 * @param {Buffer|Array<Buffer|object>} fileOrFiles - Single file object or array of file objects { buffer, mimetype }
 * @param {string} [mimetype] - Required if single Buffer is passed
 * @returns {Promise<{ text: string, pageStats: object }>}
 */
async function extractText(fileOrFiles, mimetype = null) {
  let text = '';
  let totalPages = 1;
  let analyzedPages = 1;

  // Handle multi-file array upload (e.g. multi-image scanned document)
  if (Array.isArray(fileOrFiles)) {
    totalPages = fileOrFiles.length;
    analyzedPages = Math.min(totalPages, MAX_PDF_PAGES);
    const textSegments = [];

    for (let i = 0; i < analyzedPages; i++) {
      const item = fileOrFiles[i];
      const buf = item.buffer || item;
      const mime = item.mimetype || mimetype || 'image/png';

      if (mime === 'application/pdf') {
        const data = await pdfParse(buf, { max: MAX_PDF_PAGES });
        textSegments.push(data.text);
      } else {
        const cleanBuf = await preprocessImageForOCR(buf);
        const res = await Tesseract.recognize(cleanBuf, 'eng');
        textSegments.push(res.data.text);
      }
    }
    text = textSegments.join('\n\n--- Page Break ---\n\n');
  } else {
    // Single file upload
    const buffer = fileOrFiles.buffer || fileOrFiles;
    const mime = fileOrFiles.mimetype || mimetype;

    if (mime === 'application/pdf') {
      try {
        const data = await pdfParse(buffer, { max: MAX_PDF_PAGES });
        totalPages = data.numpages || 1;
        analyzedPages = Math.min(totalPages, MAX_PDF_PAGES);
        text = data.text || '';
      } catch (error) {
        console.error('PDF Parse Error Details:', error);
        throw new Error('Failed to parse PDF document: ' + error.message);
      }
    } else if (mime && mime.startsWith('image/')) {
      try {
        totalPages = 1;
        analyzedPages = 1;
        const cleanImageBuffer = await preprocessImageForOCR(buffer);
        const result = await Tesseract.recognize(cleanImageBuffer, 'eng');
        text = result.data.text || '';
      } catch (error) {
        console.error('Tesseract Error:', error);
        throw new Error('Failed to extract text from image.');
      }
    } else {
      throw new Error('Unsupported file format for extraction.');
    }
  }

  const avgCharsPerPage = Math.max(1, Math.round(text.length / (analyzedPages || 1)));

  const pageStats = {
    totalPages,
    analyzedPages,
    avgCharsPerPage,
    extractionTruncated: totalPages > analyzedPages,
    translationTruncated: false,
    translatedThroughPage: analyzedPages
  };

  return { text, pageStats };
}

module.exports = {
  extractText,
  MAX_PDF_PAGES
};


