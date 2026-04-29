const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

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
      
      // If pdf-parse returns very little text, it might be a scanned PDF
      // For MVP, we use pdf-parse first. If we wanted to handle scanned PDFs with Tesseract,
      // we would convert the PDF to images first (e.g. using pdf2pic) and then run Tesseract.
      // Since that requires Ghostscript, we'll rely on pdf-parse for PDFs for now, and Tesseract for direct images.
      
      return text;
    } catch (error) {
      console.error('PDF Parse Error Details:', error);
      throw new Error('Failed to parse PDF document: ' + error.message);
    }
  } else if (mimetype.startsWith('image/')) {
    try {
      // Run Tesseract.js on the image buffer
      const result = await Tesseract.recognize(buffer, 'eng');
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
