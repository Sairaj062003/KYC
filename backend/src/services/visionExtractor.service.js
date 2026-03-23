// backend/src/services/visionExtractor.service.js
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const SYSTEM_PROMPT = `You are an Indian identity document OCR specialist.
Extract fields from the provided ID card image (Aadhaar/PAN/Passport).
Return ONLY a valid JSON object with the following keys:
{
  "name": string | null (person's full name),
  "dob": "YYYY-MM-DD" | null,
  "pan_number": string | null (10-char alphanumeric),
  "aadhaar_number": string | null (12 digits, no spaces),
  "document_type": "pan" | "aadhaar" | "passport" | null
}
If a field is not found or unreadable, use null.
Do NOT include any markdown formatting, preamble, or explanation.`;

/**
 * Extracts structured KYC data from an image using Vision LLMs.
 * Supports OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), and Google (Gemini 1.5 Pro).
 */
async function extractWithVisionLLM(imagePath) {
    if (process.env.VISION_LLM_ENABLED === 'false') {
        console.log('Vision LLM is disabled via environment variable.');
        return null;
    }

    const provider = process.env.VISION_LLM_PROVIDER || 'openai';
    const imageData = fs.readFileSync(imagePath).toString('base64');

    try {
        if (provider === 'openai') {
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-key-here') {
                throw new Error('OpenAI API Key is not configured.');
            }

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: SYSTEM_PROMPT },
                            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageData}` } }
                        ]
                    }
                ],
                response_format: { type: 'json_object' }
            }, {
                headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
            });

            return JSON.parse(response.data.choices[0].message.content);
        }

        if (provider === 'anthropic') {
            if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
                throw new Error('Anthropic API Key is not configured.');
            }

            const res = await axios.post('https://api.anthropic.com/v1/messages', {
                model: 'claude-3-5-sonnet-20240620',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
                            { type: 'text', text: SYSTEM_PROMPT }
                        ]
                    }
                ]
            }, {
                headers: {
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                }
            });

            let text = res.data.content[0].text;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) text = jsonMatch[0];
            return JSON.parse(text);
        }

        if (provider === 'gemini') {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error('Gemini API Key is not configured.');
            }

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const result = await model.generateContent([
                SYSTEM_PROMPT,
                {
                    inlineData: {
                        data: imageData,
                        mimeType: "image/png"
                    }
                }
            ]);

            let text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) text = jsonMatch[0];
            return JSON.parse(text);
        }

        throw new Error(`Unsupported Vision LLM provider: ${provider}`);

    } catch (error) {
        console.error(`Error in extractWithVisionLLM (${provider}):`, error.response?.data || error.message);
        return null;
    }
}

module.exports = { extractWithVisionLLM };
