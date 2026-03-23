// backend/src/services/llm.service.js
const { generate } = require('../config/ollama');

function buildExtractionPrompt(rawText) {
  return `You are a KYC document parser for Indian identity documents.
Extract the following fields from the OCR text below.
Return ONLY a valid JSON object. No explanation, no markdown, just raw JSON.

Required JSON keys (use null if not found):
- name: string (person's full name — look for "Name:" label or prominent text)
- pan_number: string (10-char: 5 letters + 4 digits + 1 letter, e.g. ABCDE1234F)
- aadhaar_number: string (12 digits, strip any spaces)
- dob: string (date of birth in YYYY-MM-DD format — look for "DOB:", "Date of Birth:", "जन्म तिथि")
- document_type: "aadhaar" | "pan" | "passport" | null

OCR Text:
"""
${rawText}
"""

JSON:`;
}

function buildStrictPrompt(rawText) {
  return `Return ONLY this JSON structure, nothing else:
{"name":null,"pan_number":null,"aadhaar_number":null,"dob":null,"document_type":null}

Replace null with actual values found in this text:
"""
${rawText}
"""

JSON:`;
}

function parseJsonResponse(responseText) {
  let cleaned = responseText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];
  return JSON.parse(cleaned);
}

async function extractStructuredData(rawText) {
  try {
    const response = await generate(buildExtractionPrompt(rawText), undefined, 120000);
    const parsed = parseJsonResponse(response);
    return normalizeResult(parsed);
  } catch (firstErr) {
    console.warn('[LLM] First attempt failed:', firstErr.message);
  }

  try {
    const response = await generate(buildStrictPrompt(rawText), undefined, 120000);
    const parsed = parseJsonResponse(response);
    return normalizeResult(parsed);
  } catch (retryErr) {
    console.error('[LLM] Retry also failed:', retryErr.message);
    return { name: null, pan_number: null, aadhaar_number: null, dob: null, document_type: null };
  }
}

function normalizeResult(parsed) {
  // FIX: Ollama was returning 'full_name' but the DB column and visionExtractor
  // both use 'name'. Accept both and normalise to 'name'.
  const rawName = parsed.name || parsed.full_name || null;

  let dob = parsed.dob || null;
  if (dob) {
    // Normalise common Indian date formats to YYYY-MM-DD
    // Handles: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const dmyMatch = dob.match(/^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})$/);
    if (dmyMatch) {
      dob = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
    if (isNaN(Date.parse(dob))) {
      console.warn(`[LLM] Invalid DOB after normalisation: ${dob}`);
      dob = null;
    }
  }

  // Strip aadhaar spaces: "1234 5678 9012" → "123456789012"
  const rawAadhaar = parsed.aadhaar_number
    ? String(parsed.aadhaar_number).replace(/\s/g, '').substring(0, 20)
    : null;

  // Validate PAN format
  const rawPan = parsed.pan_number
    ? String(parsed.pan_number).replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 10)
    : null;
  const panValid = rawPan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(rawPan);

  return {
    name: rawName ? String(rawName).substring(0, 255) : null,
    pan_number: panValid ? rawPan : null,
    aadhaar_number: rawAadhaar,
    dob,
    document_type: parsed.document_type ? String(parsed.document_type).substring(0, 50) : null,
  };
}

module.exports = { extractStructuredData };