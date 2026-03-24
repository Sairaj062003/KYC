// backend/src/services/fieldValidator.service.js

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates and merges OCR results from multiple sources (Vision LLM and Tesseract/Ollama).
 * @param {Object} visionResult - JSON result from Vision LLM layer.
 * @param {Object} ollamaResult - JSON result from Tesseract + Ollama layer.
 * @returns {Object} - Final validated and merged fields.
 */
function validateAndMerge(visionResult, ollamaResult) {
    const merged = {
        name: null,
        dob: null,
        pan_number: null,
        aadhaar_number: null,
        document_type: null
    };

    const sources = [visionResult, ollamaResult].filter(Boolean);

    // 1. Name: Prefer longer non-null value
    const names = sources
        .map(s => s?.name)
        .filter(n => typeof n === 'string' && n.length > 2 && !['null', 'applicant name', 'he ln'].includes(n.toLowerCase()))
        .sort((a, b) => b.length - a.length);
    merged.name = names[0] || null;

    // 2. PAN Number: Pick first that passes regex
    merged.pan_number = sources
        .map(s => s?.pan_number?.toUpperCase()?.replace(/\s/g, ''))
        .filter(v => typeof v === 'string' && PAN_REGEX.test(v) && !['ABCDE1234F', 'ABCD1234F'].includes(v))[0] || null;

    // 3. Aadhaar Number: Strip spaces, pick first that is 12 digits
    merged.aadhaar_number = sources
        .map(s => s?.aadhaar_number?.replace(/\s/g, ''))
        .filter(v => typeof v === 'string' && AADHAAR_REGEX.test(v) && !['123456789012', '012345678901'].includes(v))[0] || null;

    // 4. DOB: Prefer YYYY-MM-DD format
    merged.dob = sources
        .map(s => s?.dob)
        .filter(v => typeof v === 'string' && DOB_REGEX.test(v))[0] || null;

    // 5. Document Type
    merged.document_type = sources
        .map(s => s?.document_type?.toLowerCase())
        .filter(t => ['pan', 'aadhaar', 'passport'].includes(t))[0] || null;

    // Deduce document type if null but we have a number
    if (!merged.document_type) {
        if (merged.pan_number) merged.document_type = 'pan';
        else if (merged.aadhaar_number) merged.document_type = 'aadhaar';
    }

    return merged;
}

module.exports = { validateAndMerge };
