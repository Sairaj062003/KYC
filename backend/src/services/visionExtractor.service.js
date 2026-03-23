// backend/src/services/visionExtractor.service.js
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const SYSTEM_PROMPT = `You are an Indian identity document OCR specialist.
Extract fields from the provided ID card image and return ONLY valid JSON.
Never guess — return null for fields you cannot read clearly.

Return this exact JSON structure:
{
  "name": string | null,
  "dob": "YYYY-MM-DD" | null,
  "pan_number": string | null,
  "aadhaar_number": string | null,
  "document_type": "pan" | "aadhaar" | "passport" | null
}
PAN format: 5 uppercase letters + 4 digits + 1 uppercase letter (e.g. ABCDE1234F)
Aadhaar format: 12 digits (XXXX XXXX XXXX or XXXXXXXXXXXX)
DOB format: YYYY-MM-DD. If it's DD/MM/YYYY on card, convert it.`;

/**
 * Extracts structured data from an image using a Vision LLM.
 * @param {string} imagePath - Path to the image file.
 * @returns {Promise<Object>} - Extracted fields.
 */
async function extractWithVisionLLM(imagePath) {
    if (process.env.VISION_LLM_ENABLED === 'false') {
        console.log('Vision LLM is disabled via environment variable.');
        return null;
    }

    try {
        const imageData = fs.readFileSync(imagePath).toString('base64');
        const provider = process.env.VISION_LLM_PROVIDER || 'openai';

        if (provider === 'openai') {
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-key-here') {
                throw new Error('OpenAI API Key is not configured.');
            }

            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4o',
                max_tokens: 500,
                response_format: { type: "json_object" },
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: SYSTEM_PROMPT },
                        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageData}` } }
                    ]
                }]
            }, { 
                headers: { 
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                } 
            });

            return JSON.parse(res.data.choices[0].message.content);
        }

        if (provider === 'anthropic') {
            if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
                throw new Error('Anthropic API Key is not configured.');
            }

            const res = await axios.post('https://api.anthropic.com/v1/messages', {
                model: 'claude-3-haiku-20240307', // Corrected model name for Haiku 3
                max_tokens: 500,
                system: SYSTEM_PROMPT,
                messages: [{ 
                    role: 'user', 
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
                        { type: 'text', text: 'Extract the fields from this ID card into JSON format.' }
                    ]
                }]
            }, { 
                headers: { 
                    'x-api-key': process.env.ANTHROPIC_API_KEY, 
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                } 
            });

            // Anthropic returns text which might need parsing if it's not strictly JSON
            let text = res.data.content[0].text;
            // Extract JSON block if present
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                text = jsonMatch[0];
            }
            return JSON.parse(text);
        }

        throw new Error(`Unsupported Vision LLM provider: ${provider}`);
    } catch (error) {
        console.error('Error in extractWithVisionLLM:', error.response?.data || error.message);
        return null;
    }
}

module.exports = { extractWithVisionLLM };
