const { generate } = require('../config/ollama');

/**
 * Build the KYC extraction prompt for the Ollama LLM.
 * The prompt instructs the model to return ONLY valid JSON with specific fields.
 *
 * @param {string} rawText - OCR-extracted raw text from the document
 * @returns {string} Formatted prompt
 */
function buildExtractionPrompt(rawText) {
  return `You are a KYC document parser. Extract the following fields from the provided OCR text.
Return ONLY a valid JSON object with these exact keys. If a field is not found, use null.
Do not include any explanation or text outside the JSON object.

Fields to extract:
- full_name: string (person's full name)
- pan_number: string (10-char alphanumeric PAN, e.g. ABCDE1234F)
- dob: string (date of birth in YYYY-MM-DD format)
- document_type: string (one of: "aadhaar", "pan", "passport", "other")

OCR Text:
"""
${rawText}
"""

Return only JSON:`;
}

/**
 * Build a stricter retry prompt when the first attempt fails to produce valid JSON.
 */
function buildStrictPrompt(rawText) {
  return `You MUST return ONLY a valid JSON object. No markdown, no explanation, no extra text.
The JSON must have exactly these keys: full_name, pan_number, dob, document_type.
Use null for any field not found. Example format:
{"full_name": "John Doe", "pan_number": "ABCDE1234F", "dob": "1990-01-15", "document_type": "pan"}

OCR Text:
"""
${rawText}
"""

JSON:`;
}

/**
 * Attempt to parse JSON from the LLM response string.
 * Handles cases where the model wraps JSON in markdown code blocks.
 *
 * @param {string} responseText - Raw LLM response
 * @returns {Object} Parsed JSON object
 */
function parseJsonResponse(responseText) {
  let cleaned = responseText.trim();

  // Strip markdown code block wrappers if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  // Try to extract JSON object if there's surrounding text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return JSON.parse(cleaned);
}

/**
 * Extract structured data from OCR text using Ollama LLM.
 * Sends a structured extraction prompt and parses the JSON response.
 * If the first attempt fails to produce valid JSON, retries once with a stricter prompt.
 *
 * @param {string} rawText - OCR-extracted raw text
 * @returns {{ full_name: string|null, pan_number: string|null, dob: string|null, document_type: string|null }}
 */
async function extractStructuredData(rawText) {
  // First attempt with standard prompt
  try {
    const response = await generate(buildExtractionPrompt(rawText), undefined, 30000);
    const parsed = parseJsonResponse(response);
    return normalizeResult(parsed);
  } catch (firstErr) {
    console.warn('[LLM] First extraction attempt failed:', firstErr.message);
  }

  // Retry with stricter prompt
  try {
    const response = await generate(buildStrictPrompt(rawText), undefined, 30000);
    const parsed = parseJsonResponse(response);
    return normalizeResult(parsed);
  } catch (retryErr) {
    console.error('[LLM] Retry extraction also failed:', retryErr.message);
    // Return nulls rather than crashing — the document status will be set to extraction_failed
    return {
      full_name: null,
      pan_number: null,
      dob: null,
      document_type: null,
    };
  }
}

/**
 * Normalize the parsed result to ensure all expected fields exist.
 * @param {Object} parsed - Parsed JSON from LLM
 * @returns {Object} Normalized result with all fields
 */
function normalizeResult(parsed) {
  return {
    full_name: parsed.full_name || null,
    pan_number: parsed.pan_number || null,
    dob: parsed.dob || null,
    document_type: parsed.document_type || null,
  };
}

module.exports = { extractStructuredData };
