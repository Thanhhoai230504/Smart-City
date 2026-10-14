const { DEFAULT_MODELS, getModelChain, withModelFallback } = require('../../src/services/geminiModels');

const fakeGenAI = (behaviours) => ({
  getGenerativeModel: jest.fn(({ model }) => ({ name: model, run: behaviours[model] })),
});

describe('geminiModels', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the default chain unless GEMINI_MODELS is set', () => {
    expect(getModelChain({})).toEqual(DEFAULT_MODELS);
    expect(getModelChain({ GEMINI_MODELS: ' model-a , ,model-b ' })).toEqual(['model-a', 'model-b']);
    // Không còn model đã bị Google gỡ trong chuỗi mặc định
    expect(DEFAULT_MODELS.some((name) => name.startsWith('gemini-2.0'))).toBe(false);
  });

  it('moves on after any error and reports which model answered', async () => {
    const genAI = fakeGenAI({
      first: () => { throw Object.assign(new Error('Service Unavailable'), { status: 503 }); },
      second: () => { throw Object.assign(new Error('model is no longer available'), { status: 404 }); },
      third: () => 'ok',
    });

    const result = await withModelFallback(genAI, { models: ['first', 'second', 'third'] }, async (model) => model.run());

    expect(result).toEqual({ modelName: 'third', value: 'ok' });
    expect(genAI.getGenerativeModel.mock.calls.map(([params]) => params.model)).toEqual(['first', 'second', 'third']);
  });

  it('passes the per-call timeout and merges per-model config', async () => {
    const genAI = fakeGenAI({ 'gemini-2.5-flash': () => 'ok' });

    await withModelFallback(
      genAI,
      { models: ['gemini-2.5-flash'], generationConfig: { responseMimeType: 'application/json' }, timeoutMs: 1234 },
      async (model) => model.run(),
    );

    expect(genAI.getGenerativeModel).toHaveBeenCalledWith(
      {
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      },
      { timeout: 1234 },
    );
  });

  it('throws with every attempt listed when all models fail', async () => {
    const genAI = fakeGenAI({
      a: () => { throw Object.assign(new Error('quota exceeded'), { status: 429 }); },
      b: () => { throw new Error('timeout'); },
    });

    await expect(withModelFallback(genAI, { models: ['a', 'b'] }, async (model) => model.run()))
      .rejects.toMatchObject({ attempts: [expect.stringContaining('a: 429'), expect.stringContaining('b: timeout')] });
  });
});
