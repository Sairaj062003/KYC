// backend/src/services/imagePreprocessor.service.js
const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const fs = require('fs');
const execAsync = util.promisify(exec);

/**
 * Pre-processes an image using a Python script (OpenCV).
 * @param {string} inputPath - Path to the original image.
 * @returns {Promise<string>} - Path to the cleaned image.
 */
async function preprocessImage(inputPath) {
    try {
        const absoluteInputPath = path.resolve(inputPath);
        const outputExt = '_clean.png';
        const outputPath = absoluteInputPath.replace(/\.[^/.]+$/, "") + outputExt;
        const scriptPath = path.join(__dirname, '../scripts/preprocess.py');

        console.log(`Pre-processing image: ${absoluteInputPath} -> ${outputPath}`);
        
        // Execute the Python script
        const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${absoluteInputPath}" "${outputPath}"`);
        
        if (stderr) {
            console.warn(`Pre-processing warning: ${stderr}`);
        }
        
        if (!fs.existsSync(outputPath)) {
            throw new Error(`Output file not created: ${outputPath}`);
        }

        return outputPath;
    } catch (error) {
        console.error('Error in preprocessImage:', error);
        // If pre-processing fails, fall back to the original image path
        return inputPath;
    }
}

module.exports = { preprocessImage };
