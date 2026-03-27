// backend/src/services/visionExtractor.service.js
const fs = require('fs');
const axios = require('axios');

const SYSTEM_PROMPT = `You are an Indian identity document OCR specialist.
Extract fields from the provided ID card image (Aadhaar/PAN/Passport).
Return ONLY a valid JSON object with NO markdown, NO explanation, just raw JSON.
{
  "name": string | null,
  "dob": "YYYY-MM-DD" | null,
  "pan_number": string | null,
  "aadhaar_number": string | null,
  "document_type": "pan" | "aadhaar" | "passport" | null
}
Rules:
- PAN format: 5 uppercase letters + 4 digits + 1 letter (e.g. ABCDE1234F)
- Aadhaar: 12 digits, strip spaces (e.g. "1234 5678 9012" -> "123456789012")
- DOB: convert any format to YYYY-MM-DD
- Use null for any field you cannot read clearly.`;

async function tryGemini(imageData, imagePath) {
    console.log('[Vision] Attempting Gemini via REST API (v1 stable)...');

    // Detect MIME type from file extension
    const ext = imagePath.split('.').pop().toLowerCase();
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };
    const mimeType = mimeMap[ext] || 'image/jpeg';

    // Model name verified by user to be available on their specific key
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const body = {
        contents: [{
            parts: [
                { text: SYSTEM_PROMPT },
                {
                    inline_data: {
                        mime_type: mimeType,
                        data: imageData
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
        }
    };

    // Retry logic with exponential backoff for rate limits
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            });

            if (!response.data.candidates || !response.data.candidates[0].content) {
                throw new Error('Invalid response from Gemini API');
            }

            let text = response.data.candidates[0].content.parts[0].text.trim();
            
            // 1. Robust JSON extraction (regex for first { to last })
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            let jsonString = jsonMatch ? jsonMatch[0] : text;

            // 2. Simple repair for common truncation/malformed issues
            // If it ends with a comma or doesn't end with } or ], try to close it
            if (!jsonString.endsWith('}')) {
                // Count opening and closing braces to attempt a basic repair
                const opens = (jsonString.match(/\{/g) || []).length;
                const closes = (jsonString.match(/\}/g) || []).length;
                if (opens > closes) {
                    jsonString += '}'.repeat(opens - closes);
                }
            }

            try {
                const parsed = JSON.parse(jsonString);
                console.log('[Vision] Gemini extracted:', parsed);
                return parsed;
            } catch (jsonErr) {
                console.warn('[Vision] Gemini JSON parse failed, text snippet:', text.substring(0, 50));
                throw new Error(`Unterminated string in JSON or malformed output: ${jsonErr.message}`);
            }

            console.log('[Vision] Gemini extracted:', parsed);
            return parsed;
        } catch (err) {
            if (err.response?.status === 429 && attempt < 3) {
                const delay = attempt * 2000;
                console.warn(`[Vision] Gemini rate limited, retrying in ${delay}ms (attempt ${attempt}/3)...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw err;
        }
    }
}

async function tryAnthropic(imageData) {
    console.log('[Vision] Attempting Anthropic (claude-haiku)...');
    const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
            role: 'user',
            content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
                { type: 'text', text: SYSTEM_PROMPT }
            ]
        }]
    }, {
        headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        timeout: 20000
    });
    let text = res.data.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

async function tryOpenAI(imageData) {
    console.log('[Vision] Attempting OpenAI (gpt-4o-mini)...');
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini', 
        max_tokens: 512,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: SYSTEM_PROMPT },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${imageData}` } }
            ]
        }],
        response_format: { type: 'json_object' }
    }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 20000
    });
    return JSON.parse(response.data.choices[0].message.content);
}

async function extractWithVisionLLM(imagePath) {
    if (process.env.VISION_LLM_ENABLED === 'false') return null;

    const imageData = fs.readFileSync(imagePath).toString('base64');

    if (process.env.GEMINI_API_KEY) {
        try {
            return await tryGemini(imageData, imagePath);
        } catch (err) {
            console.warn('[Vision] Gemini failed:', err.message);
        }
    }

    if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes('your-key')) {
        try {
            return await tryAnthropic(imageData);
        } catch (err) {
            console.warn('[Vision] Anthropic failed:', err.message);
        }
    }

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
        try {
            return await tryOpenAI(imageData);
        } catch (err) {
            console.warn('[Vision] OpenAI failed:', err.message);
        }
    }

    return null;
}

module.exports = { extractWithVisionLLM };