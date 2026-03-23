// backend/src/services/ocr.service.js
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

async function convertPdfToImage(pdfPath) {
  const outputPrefix = pdfPath.replace(/\.pdf$/i, '_converted');
  await execAsync(`pdftoppm -png -f 1 -l 1 -r 300 "${pdfPath}" "${outputPrefix}"`);
  const expectedOutput = `${outputPrefix}-1.png`;
  if (fs.existsSync(expectedOutput)) return expectedOutput;
  const dir = path.dirname(pdfPath);
  const baseName = path.basename(outputPrefix);
  const files = fs.readdirSync(dir).filter(f => f.startsWith(baseName) && f.endsWith('.png'));
  if (files.length > 0) return path.join(dir, files[0]);
  throw new Error('PDF to image conversion produced no output');
}

async function preprocessImage(inputPath) {
  const outputPath = inputPath.replace(/(\.[\w\d]+)$/i, '_preprocessed.png');

  // FIX: Removed .threshold() — hard binarization destroys Devanagari character
  // strokes and ruins mixed-script text. Gentle grayscale + normalize is enough
  // for Tesseract and preserves fine strokes in Hindi glyphs.
  await sharp(inputPath)
    .grayscale()
    .normalize()       // stretch contrast — helps with shadows and uneven lighting
    .sharpen({ sigma: 1.5 })  // mild sharpen only, not aggressive
    .png({ quality: 100 })
    .toFile(outputPath);

  return outputPath;
}

async function withRetry(fn, retries = 3, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`[OCR] Attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt < retries) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error(`OCR failed after ${retries} attempts: ${lastError.message}`);
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let imagePath = filePath;
  let tempPdfImage = null;

  if (ext === '.pdf') {
    imagePath = await convertPdfToImage(filePath);
    tempPdfImage = imagePath;
  }

  const preprocessedPath = await preprocessImage(imagePath);

  // FIX: PSM 6 = "Assume a single uniform block of text"
  // This is the correct mode for ID cards which are structured, card-sized
  // text blocks. PSM 3 (auto) tries to detect columns/paragraphs which
  // confuses Tesseract on the sparse layout of an ID card.
  const tesseractOptions = {
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
    // FIX: Added Hindi language data — critical for Aadhaar cards
    // which print the holder's name in both Devanagari and English
    logger: () => { },
  };

  let text = await withRetry(async () => {
    const result = await Tesseract.recognize(
      preprocessedPath,
      'eng+hin',  // eng = English, hin = Hindi/Devanagari
      tesseractOptions
    );
    return result.data.text;
  }, 2, 1000);

  // Fallback: if preprocessed result is poor, try original image
  if (!text || text.trim().length < 50) {
    console.log(`[OCR] Pre-processed text too short (${text?.length || 0} chars), trying original...`);
    const fallbackText = await withRetry(async () => {
      const result = await Tesseract.recognize(imagePath, 'eng+hin', tesseractOptions);
      return result.data.text;
    }, 2, 1000);
    if ((fallbackText?.length || 0) > (text?.length || 0)) {
      text = fallbackText;
    }
  }

  // Cleanup temp files
  [preprocessedPath, tempPdfImage].filter(Boolean).forEach(p => {
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch { }
    }
  });

  return text;
}

module.exports = { extractText, withRetry };