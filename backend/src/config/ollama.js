const axios = require('axios');

/**
 * Ollama HTTP client configuration.
 * Used for both text generation (LLM) and embedding generation.
 */
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

const ollamaClient = axios.create({
  baseURL: OLLAMA_BASE_URL,
  timeout: 180000, // Increased to 180s for slow VM environments
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Generate text using Ollama's /api/generate endpoint.
 * @param {string} prompt - The prompt to send
 * @param {string} model - Model name (defaults to OLLAMA_MODEL)
 * @param {number} timeout - Request timeout in ms (default 120000)
 * @returns {string} Generated text response
 */
async function generate(prompt, model = OLLAMA_MODEL, timeout = 120000) {
  const response = await ollamaClient.post('/api/generate', {
    model,
    prompt,
    stream: false,
  }, { timeout });

  return response.data.response;
}

/**
 * Generate embeddings using Ollama's /api/embeddings endpoint.
 * @param {string} text - Text to embed
 * @param {string} model - Embedding model name (defaults to OLLAMA_EMBED_MODEL)
 * @returns {Array<number>} Embedding vector
 */
async function embed(text, model = OLLAMA_EMBED_MODEL) {
  const response = await ollamaClient.post('/api/embeddings', {
    model,
    prompt: text,
  }, { timeout: 15000 });

  return response.data.embedding;
}

module.exports = {
  ollamaClient,
  generate,
  embed,
  OLLAMA_MODEL,
  OLLAMA_EMBED_MODEL,
};
