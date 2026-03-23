const axios = require('axios');

/**
 * Qdrant vector database REST client.
 * Provides helper methods for collection management and point operations.
 */
const QDRANT_BASE_URL = `${process.env.QDRANT_HOST || 'http://vector-db'}:${process.env.QDRANT_PORT || 6333}`;
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'kyc_embeddings';

const qdrantClient = axios.create({
  baseURL: QDRANT_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Ensure the Qdrant collection exists; create it if missing.
 * Uses vector_size 768 (nomic-embed-text output dimension) and Cosine distance.
 */
async function ensureCollection() {
  try {
    await qdrantClient.get(`/collections/${COLLECTION_NAME}`);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.log(`[Qdrant] Collection "${COLLECTION_NAME}" not found — creating...`);
      await qdrantClient.put(`/collections/${COLLECTION_NAME}`, {
        vectors: {
          size: 768,
          distance: 'Cosine',
        },
      });
      console.log(`[Qdrant] Collection "${COLLECTION_NAME}" created successfully.`);
    } else {
      throw err;
    }
  }
}

/**
 * Upsert points into the collection.
 * @param {Array} points - Array of { id, vector, payload } objects
 */
async function upsertPoints(points) {
  await ensureCollection();
  await qdrantClient.put(`/collections/${COLLECTION_NAME}/points`, {
    points,
  });
}

/**
 * Search for similar vectors in the collection.
 * @param {Array<number>} vector - Query vector
 * @param {number} limit - Number of top results
 * @param {Object} filter - Optional Qdrant filter
 * @returns {Array} Scored results with payload
 */
async function searchSimilar(vector, limit = 5, filter = null) {
  await ensureCollection();

  const body = {
    vector,
    limit,
    with_payload: true,
    with_vector: false,   // don't return vectors in results — saves bandwidth
  };

  if (filter) body.filter = filter;

  const response = await qdrantClient.post(
    `/collections/${COLLECTION_NAME}/points/search`,
    body
  );

  return response.data.result || [];
}

/**
 * Retrieve specific points by IDs.
 * @param {Array<string>} ids - Point IDs to retrieve
 * @returns {Array} Points with vectors and payloads
 */
async function getPoints(ids) {
  await ensureCollection();
  const response = await qdrantClient.post(
    `/collections/${COLLECTION_NAME}/points`,
    { ids, with_vector: true, with_payload: true }  // with_vector: true is critical
  );

  const results = response.data.result || [];

  // Log warning if vectors are missing — indicates a Qdrant version issue
  results.forEach(point => {
    if (!point.vector) {
      console.warn(`[Qdrant] Point ${point.id} returned without vector — check Qdrant version`);
    }
  });

  return results;
}

module.exports = {
  qdrantClient,
  ensureCollection,
  upsertPoints,
  searchSimilar,
  getPoints,
  COLLECTION_NAME,
};
