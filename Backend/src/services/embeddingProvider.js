const axios = require('axios');
const ApiError = require('../utils/apiError');
const { EMBEDDING_CONFIG, EMBEDDING_VERSION } = require('../utils/duplicateConfig');

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class GeminiEmbeddingProvider {
  constructor({
    apiKey = process.env.GEMINI_API_KEY,
    model = EMBEDDING_CONFIG.model,
    dimensions = EMBEDDING_CONFIG.dimensions,
    timeoutMs = EMBEDDING_CONFIG.timeoutMs,
    maxAttempts = EMBEDDING_CONFIG.maxAttempts,
    httpClient = axios,
  } = {}) {
    this.name = 'gemini';
    this.model = model;
    this.version = EMBEDDING_VERSION;
    this.dimensions = dimensions;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = maxAttempts;
    this.httpClient = httpClient;
  }

  get available() {
    return Boolean(this.apiKey);
  }

  async embed(text) {
    if (!this.available) {
      throw ApiError.serviceUnavailable('Embedding provider chưa được cấu hình');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:embedContent`;
    let lastError;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const { data } = await this.httpClient.post(
          endpoint,
          {
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
            taskType: 'SEMANTIC_SIMILARITY',
            outputDimensionality: this.dimensions,
          },
          {
            timeout: this.timeoutMs,
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': this.apiKey,
            },
          }
        );

        const vector = data?.embedding?.values;
        if (!Array.isArray(vector) || !vector.length || vector.some((value) => !Number.isFinite(value))) {
          throw new Error('Embedding response không hợp lệ');
        }
        return vector;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxAttempts) await delay(150 * attempt);
      }
    }

    throw lastError;
  }
}

class DisabledEmbeddingProvider {
  constructor() {
    this.name = 'disabled';
    this.model = 'none';
    this.version = EMBEDDING_VERSION;
    this.dimensions = 0;
    this.available = false;
  }

  async embed() {
    throw ApiError.serviceUnavailable('Embedding provider đang tắt');
  }
}

const createEmbeddingProvider = (options = {}) => {
  const providerName = options.provider || EMBEDDING_CONFIG.provider;
  if (providerName === 'disabled' || providerName === 'none') {
    return new DisabledEmbeddingProvider();
  }
  if (providerName !== 'gemini') {
    throw new Error(`Embedding provider không được hỗ trợ: ${providerName}`);
  }
  return new GeminiEmbeddingProvider(options);
};

let providerInstance;
const getEmbeddingProvider = () => {
  if (!providerInstance) providerInstance = createEmbeddingProvider();
  return providerInstance;
};

const setEmbeddingProviderForTests = (provider) => {
  providerInstance = provider;
};

module.exports = {
  GeminiEmbeddingProvider,
  DisabledEmbeddingProvider,
  createEmbeddingProvider,
  getEmbeddingProvider,
  setEmbeddingProviderForTests,
};
