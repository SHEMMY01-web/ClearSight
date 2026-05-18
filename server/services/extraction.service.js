const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

/**
 * Pre-processes an uploaded image buffer to maximize OCR accuracy.
 * Performs: Grayscale, Contrast Normalization, Sharpening, and Auto-rotation.
 * @param {Buffer} imageBuffer 
 * @returns {Promise<Buffer>} Processed Image Buffer
 */
async function preprocessImageForOCR(imageBuffer) {
  try {
    return await sharp(imageBuffer)
      // 1. Auto-orient based on EXIF data (fixes upside-down phone uploads)
      .rotate() 
      
      // 2. Convert to grayscale (removes color noise)
      .greyscale() 
      
      // 3. Normalize contrast (stretches luminance to make text pop against background)
      .normalize() 
      
      // 4. Sharpen edges (enhances text characters for easier character recognition)
      .sharpen({
        sigma: 1.5,
        m1: 0.5,
        m2: 2.0
      })
      
      // 5. Output as a clean, uncompressed PNG buffer for Tesseract
      .toFormat('png')
      .toBuffer();
  } catch (error) {
    console.error("Image pre-processing failed, falling back to raw buffer:", error);
    return imageBuffer; // Fallback to raw if processing fails
  }
}

/**
 * Extracts text from a file buffer based on its mimetype.
 * @param {Buffer} buffer 
 * @param {string} mimetype 
 * @returns {Promise<string>}
 */
async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    try {
      // Limit to 20 pages for demo stability
      const data = await pdfParse(buffer, { max: 20 });
      let text = data.text;
      
      return text;
    } catch (error) {
      console.error('PDF Parse Error Details:', error);
      throw new Error('Failed to parse PDF document: ' + error.message);
    }
  } else if (mimetype.startsWith('image/')) {
    try {
      // Phase 1: Heavy lifting preprocessing
      const cleanImageBuffer = await preprocessImageForOCR(buffer);
      
      // Phase 2: Perform OCR
      const result = await Tesseract.recognize(cleanImageBuffer, 'eng');
      return result.data.text;
    } catch (error) {
      console.error('Tesseract Error:', error);
      throw new Error('Failed to extract text from image.');
    }
  } else {
    throw new Error('Unsupported file format for extraction.');
  }
}

module.exports = {
  extractText
};

