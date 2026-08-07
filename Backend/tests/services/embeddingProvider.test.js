const {
  GeminiEmbeddingProvider,
  DisabledEmbeddingProvider,
} = require('../../src/services/embeddingProvider');

describe('EmbeddingProvider', () => {
  it('calls Gemini embedding API without putting the key in the request body', async () => {
    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { embedding: { values: [0.1, 0.2, 0.3] } } }),
    };
    const provider = new GeminiEmbeddingProvider({
      apiKey: 'secret-key',
      model: 'gemini-embedding-001',
      dimensions: 768,
      httpClient,
    });

    const vector = await provider.embed('urban issue text');

    expect(vector).toEqual([0.1, 0.2, 0.3]);
    expect(httpClient.post).toHaveBeenCalledWith(
      expect.stringContaining('gemini-embedding-001'),
      expect.objectContaining({
        taskType: 'SEMANTIC_SIMILARITY',
        outputDimensionality: 768,
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'secret-key' }),
      })
    );
    expect(JSON.stringify(httpClient.post.mock.calls[0][1])).not.toContain('secret-key');
  });

  it('retries transient provider failures', async () => {
    const httpClient = {
      post: jest.fn()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValueOnce({ data: { embedding: { values: [1, 0] } } }),
    };
    const provider = new GeminiEmbeddingProvider({
      apiKey: 'key',
      maxAttempts: 2,
      httpClient,
    });

    await expect(provider.embed('text')).resolves.toEqual([1, 0]);
    expect(httpClient.post).toHaveBeenCalledTimes(2);
  });

  it('fails clearly when the provider is disabled', async () => {
    const provider = new DisabledEmbeddingProvider();
    await expect(provider.embed('text')).rejects.toMatchObject({ statusCode: 503 });
  });
});
