const Issue = require('../../src/models/Issue');

describe('Issue embedding schema', () => {
  it('does not select raw vectors by default', () => {
    expect(Issue.schema.path('embedding.vector').options.select).toBe(false);
  });

  it('stores resumable generation metadata and a supporting job index', () => {
    expect(Issue.schema.path('embedding.sourceHash')).toBeDefined();
    expect(Issue.schema.path('embedding.status')).toBeDefined();
    expect(Issue.schema.path('embedding.attempts')).toBeDefined();

    const indexes = Issue.schema.indexes();
    expect(indexes.some(([fields]) => (
      fields['embedding.status'] === 1 && fields['embedding.generatedAt'] === 1
    ))).toBe(true);
  });
});
