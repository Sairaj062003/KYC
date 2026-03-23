// backend/src/services/visionExtractor.service.js
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are an Indian identity document OCR specialist.
Extract fields from the provided ID card image (Aadhaar/PAN/Passport).
Return ONLY a valid JSON object with the following keys:
{
  "name": string | null,
  "dob": "YYYY-MM-DD" | null,
  "pan_number": string | null,
  "aadhaar_number": string | null,
  "document_type": "pan" | "aadhaar" | "passport" | null
}
If a field is not found or unreadable, use null.
Do NOT include any markdown formatting, preamble, or explanation.`;

/**
 * Super-Resilient Vision Extraction
 * Tries providers in order: Gemini -> OpenAI -> Anthropic
 */
async function extractWithVisionLLM(imagePath) {
    if (process.env.VISION_LLM_ENABLED === 'false') return null;

    // Log key presence for debugging (without revealing the keys)
    console.log('[Vision] Key Check:', {
        GEMINI: !!process.env.GEMINI_API_KEY,
        OPENAI: !!process.env.OPENAI_API_KEY,
        ANTHROPIC: !!process.env.ANTHROPIC_API_KEY
    });

    const imageData = fs.readFileSync(imagePath).toString('base64');
    
    // Strict priority order as requested
    const providers = ['gemini', 'openai', 'anthropic'];

    for (const provider of providers) {
        try {
            if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
                return await tryGemini(imageData);
            }
            if (provider === 'openai' && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here') {
                return await tryOpenAI(imageData);
            }
            if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-your-key-here') {
                return await tryAnthropic(imageData);
            }
        } catch (err) {
            console.warn(`[Vision] ${provider} attempt failed:`, err.message);
            // If it's a rate limit (429) and we have more providers, we continue immediately
        }
    }

    return null; // All vision providers failed or were skipped
}

async function tryOpenAI(imageData, retryCount = 0) {
    try {
        console.log('[Vision] Attempting OpenAI...');
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: SYSTEM_PROMPT },
                    { type: 'image_url', image_url: { url: `data:image/png;base64,${imageData}` } }
                ]
            }],
            response_format: { type: 'json_object' }
        }, {
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
            timeout: 15000 // 15s timeout
        });
        return JSON.parse(response.data.choices[0].message.content);
    } catch (err) {
        if (err.response?.status === 429 && retryCount < 1) {
            console.log('[Vision] OpenAI Rate limited. Retrying in 2s...');
            await new Promise(r => setTimeout(r, 2000));
            return tryOpenAI(imageData, retryCount + 1);
        }
        throw err;
    }
}

async function tryAnthropic(imageData) {
    console.log('[Vision] Attempting Anthropic...');
    const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
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
        timeout: 15000
    });
    let text = res.data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

async function tryGemini(imageData) {
    console.log('[Vision] Attempting Gemini (gemini-1.5-pro)...');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Using gemini-1.5-pro as it's more stable for extraction tasks
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    const result = await model.generateContent([
        SYSTEM_PROMPT,
        { inlineData: { data: imageData, mimeType: "image/png" } }
    ]);
    
    let text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

module.exports = { extractWithVisionLLM };
