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
 * Tries providers in order: Primary -> Gemini -> Anthropic -> OpenAI
 * (Skipping any that lack API keys)
 */
async function extractWithVisionLLM(imagePath) {
    if (process.env.VISION_LLM_ENABLED === 'false') return null;

    const imageData = fs.readFileSync(imagePath).toString('base64');
    
    // Priority list of providers to try
    const primary = process.env.VISION_LLM_PROVIDER || 'gemini';
    const providers = [primary, 'gemini', 'anthropic', 'openai'];
    const uniqueProviders = [...new Set(providers)]; // Remove duplicates

    for (const provider of uniqueProviders) {
        try {
            console.log(`[Vision] Attempting extraction with ${provider}...`);
            
            if (provider === 'openai' && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-key-here') {
                return await tryOpenAI(imageData);
            }
            if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-your-key-here') {
                return await tryAnthropic(imageData);
            }
            if (provider === 'gemini' && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'placeholder') {
                return await tryGemini(imageData);
            }
        } catch (err) {
            console.error(`[Vision] ${provider} failed:`, err.message);
            // Continue to next provider in the loop
        }
    }

    return null; // All vision providers failed
}

async function tryOpenAI(imageData) {
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
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    return JSON.parse(response.data.choices[0].message.content);
}

async function tryAnthropic(imageData) {
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
        }
    });
    let text = res.data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

async function tryGemini(imageData) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent([
        SYSTEM_PROMPT,
        { inlineData: { data: imageData, mimeType: "image/png" } }
    ]);
    let text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
}

module.exports = { extractWithVisionLLM };
