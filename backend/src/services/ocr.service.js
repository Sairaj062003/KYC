const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const sharp = require('sharp');

const execAsync = promisify(exec);

/**
 * Retry wrapper for async operations.
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Maximum number of attempts
 * @param {number} delayMs - Delay between retries in ms
 * @returns {*} Result of the function
 */
async function withRetry(fn, retries = 3, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`[OCR] Attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error(`OCR extraction failed after ${retries} attempts: ${lastError.message}`);
}

/**
 * Convert the first page of a PDF to a PNG image using poppler-utils (pdftoppm).
 * Returns the path to the generated image.
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {string} Path to the converted image
 */
async function convertPdfToImage(pdfPath) {
  const outputPrefix = pdfPath.replace(/\.pdf$/i, '_converted');
  // pdftoppm converts PDF pages to PPM/PNG images
  await execAsync(`pdftoppm -png -f 1 -l 1 -r 300 "${pdfPath}" "${outputPrefix}"`);

  // pdftoppm appends "-1" for the first page
  const expectedOutput = `${outputPrefix}-1.png`;
  // Some versions may use different naming — check for the file
  if (fs.existsSync(expectedOutput)) {
    return expectedOutput;
  }
  // Fallback: look for any generated PNG
  const dir = path.dirname(pdfPath);
  const baseName = path.basename(outputPrefix);
  const files = fs.readdirSync(dir).filter(
    (f) => f.startsWith(baseName) && f.endsWith('.png')
  );
  if (files.length > 0) {
    return path.join(dir, files[0]);
  }
  throw new Error('PDF to image conversion produced no output');
}

/**
 * Preprocess an image to improve OCR accuracy.
 * Converts to grayscale, normalizes contrast, and sharpens.
 * @param {string} inputPath - Path to the original image
 * @returns {string} Path to the preprocessed temporary image
 */
async function preprocessImage(inputPath) {
  const outputPath = inputPath.replace(/(\.[\w\d]+)$/i, '_preprocessed$1');
  await sharp(inputPath)
    .grayscale()
    .normalize() // Stretch contrast
    .sharpen()
    .toFile(outputPath);
  return outputPath;
}

/**
 * Extract text from an image or PDF file using Tesseract OCR.
 * For PDF files, the first page is converted to an image first.
 * Implements retry logic (up to 3 attempts).
 *
 * @param {string} filePath - Path to the file (PDF, PNG, or JPG)
 * @returns {string} Extracted raw text
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let imagePath = filePath;
  let tempImage = null;

  // If the file is a PDF, convert the first page to an image
  if (ext === '.pdf') {
    imagePath = await convertPdfToImage(filePath);
    tempImage = imagePath; // Track for cleanup
  }

  // Preprocess the image (even for converted PDFs) to improve accuracy
  const preprocessedPath = await preprocessImage(imagePath);
  const finalImagePath = preprocessedPath;

  // Run OCR with retry logic
  const text = await withRetry(async () => {
    const result = await Tesseract.recognize(finalImagePath, 'eng+hin', {
      tessedit_pageseg_mode: '3',
      preserve_interword_spaces: '1',
      logger: () => {}, 
    });
    return result.data.text;
  }, 3, 1000);

  // Clean up temporary preprocessed image
  if (fs.existsSync(preprocessedPath)) {
    try {
      fs.unlinkSync(preprocessedPath);
    } catch (cleanupErr) {
      console.warn('[OCR] Failed to clean up preprocessed image:', cleanupErr.message);
    }
  }

  // Clean up temporary converted image
  if (tempImage && fs.existsSync(tempImage)) {
    try {
      fs.unlinkSync(tempImage);
    } catch (cleanupErr) {
      console.warn('[OCR] Failed to clean up temp image:', cleanupErr.message);
    }
  }

  return text;
}

module.exports = { extractText, withRetry };
