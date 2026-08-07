jest.mock('../../src/models/Issue');

const Issue = require('../../src/models/Issue');
const {
  lexicalSimilarity,
  cosineSimilarity,
  scoreDuplicateCandidate,
  findDuplicateCandidates,
} = require('../../src/services/duplicateCandidateService');

const query = {
  title: 'Cây đổ chắn đường Lê Lợi',
  description: 'Cây lớn đổ ngang đường sau bão',
  category: 'tree',
  latitude: 16.06,
  longitude: 108.21,
};

describe('DuplicateCandidateService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('normalizes Vietnamese text for lexical fallback', () => {
    expect(lexicalSimilarity('Cây đổ chắn đường', 'cay do chan duong')).toBe(1);
    expect(lexicalSimilarity('ngập nước', 'đèn đường')).toBe(0);
  });

  it('computes cosine similarity and rejects incompatible dimensions', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1], [1, 0])).toBeNull();
  });

  it('keeps score breakdown transparent and bounded', () => {
    const result = scoreDuplicateCandidate({
      query,
      candidate: {
        title: query.title,
        description: query.description,
        category: 'tree',
        distanceMeters: 0,
        createdAt: '2026-08-01T12:00:00.000Z',
      },
      referenceDate: new Date('2026-08-01T12:00:00.000Z'),
    });
    expect(result.duplicateScore).toBe(1);
    expect(result.confidence).toBe('high');
    expect(result.method).toBe('lexical_fallback');
  });

  it('uses compatible candidate vectors and never returns raw embeddings', async () => {
    Issue.aggregate.mockResolvedValue([{
      _id: 'candidate-1',
      title: query.title,
      description: query.description,
      category: 'tree',
      status: 'reported',
      location: 'Lê Lợi',
      latitude: 16.0601,
      longitude: 108.2101,
      voteCount: 2,
      createdAt: new Date(),
      distanceMeters: 12,
      embedding: {
        status: 'ready', model: 'model-a', version: 'v1', vector: [1, 0],
      },
    }]);
    const provider = {
      name: 'mock', model: 'model-a', version: 'v1', dimensions: 2, available: true,
      embed: jest.fn().mockResolvedValue([1, 0]),
    };

    const result = await findDuplicateCandidates(query, { provider });
    expect(result.candidates[0].method).toBe('embedding');
    expect(result.candidates[0].duplicateScore).toBeGreaterThan(0.9);
    expect(result.candidates[0].issue.embedding).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('"vector"');
  });

  it('falls back to lexical scoring when provider fails', async () => {
    Issue.aggregate.mockResolvedValue([{
      _id: 'candidate-1',
      ...query,
      status: 'reported',
      location: 'Lê Lợi',
      voteCount: 1,
      createdAt: new Date(),
      distanceMeters: 10,
      embedding: { status: 'pending' },
    }]);
    const provider = {
      name: 'mock', model: 'model-a', version: 'v1', dimensions: 2, available: true,
      embed: jest.fn().mockRejectedValue(new Error('quota exceeded')),
    };

    const result = await findDuplicateCandidates(query, { provider });
    expect(result.meta.mode).toBe('lexical_fallback');
    expect(result.meta.providerError).toContain('quota');
    expect(result.candidates[0].method).toBe('lexical_fallback');
  });
});
