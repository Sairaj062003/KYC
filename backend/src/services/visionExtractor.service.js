// backend/src/services/visionExtractor.service.js
const fs = require('fs');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

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

async function tryGemini(imageData) {
    console.log('[Vision] Attempting Gemini (gemini-1.5-flash)...');

    // New SDK — uses v1 stable API, not v1beta
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',   // works on v1 stable
        contents: [
            {
                parts: [
                    { text: SYSTEM_PROMPT },
                    { inlineData: { data: imageData, mimeType: 'image/jpeg' } }
                ]
            }
        ]
    });

    let text = response.text.trim();
    // Strip markdown fences if model wraps output in ```json
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    console.log('[Vision] Gemini extracted:', parsed);
    return parsed;
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
            return await tryGemini(imageData);
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