jest.mock('../../src/models/Issue');

const {
  EMBEDDING_METADATA_PROJECTION,
  sanitizeEmbeddingText,
  buildEmbeddingText,
  createSourceHash,
  generateIssueEmbedding,
} = require('../../src/services/embeddingService');
const Issue = require('../../src/models/Issue');

describe('EmbeddingService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redacts email and phone-like values before sending text to a provider', () => {
    const sanitized = sanitizeEmbeddingText('Liên hệ test@example.com hoặc 0901234567 ngay');
    expect(sanitized).toContain('[email]');
    expect(sanitized).toContain('[phone]');
    expect(sanitized).not.toContain('test@example.com');
    expect(sanitized).not.toContain('0901234567');
  });

  it('only builds provider input from category, title and description', () => {
    const text = buildEmbeddingText({
      category: 'flooding',
      title: 'Ngập đường',
      description: 'Nước dâng cao',
      phone: '0900000000',
      userId: 'private-user',
    });
    expect(text).toContain('category: flooding');
    expect(text).not.toContain('private-user');
    expect(text).not.toContain('0900000000');
  });

  it('creates deterministic cache hashes that change with model metadata', () => {
    const provider = { name: 'gemini', model: 'model-a', version: 'v1', dimensions: 768 };
    const first = createSourceHash({ text: 'same text', provider });
    const second = createSourceHash({ text: 'same text', provider });
    const changed = createSourceHash({ text: 'same text', provider: { ...provider, model: 'model-b' } });
    expect(first).toBe(second);
    expect(first).not.toBe(changed);
  });

  it('selects vector metadata without a parent/child MongoDB projection collision', () => {
    const fields = EMBEDDING_METADATA_PROJECTION.split(' ');
    expect(fields).toContain('+embedding.vector');
    expect(fields).toContain('embedding.status');
    expect(fields).not.toContain('embedding');
  });

  it('uses a cached vector when source hash and model version still match', async () => {
    const provider = {
      name: 'gemini', model: 'model-a', version: 'v1', dimensions: 2,
      embed: jest.fn(),
    };
    const text = buildEmbeddingText({ category: 'tree', title: 'Cây đổ', description: 'Cây chắn đường' });
    const sourceHash = createSourceHash({ text, provider });
    const issue = {
      _id: 'issue-1',
      category: 'tree',
      title: 'Cây đổ',
      description: 'Cây chắn đường',
      embedding: {
        status: 'ready', sourceHash, model: 'model-a', version: 'v1', vector: [1, 0],
      },
    };
    Issue.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(issue),
    });

    const result = await generateIssueEmbedding('issue-1', { provider });
    expect(result.cached).toBe(true);
    expect(provider.embed).not.toHaveBeenCalled();
    expect(Issue.updateOne).not.toHaveBeenCalled();
  });
});
