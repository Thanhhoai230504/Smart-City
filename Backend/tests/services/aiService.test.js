const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));

const { classifyIssueImage } = require('../../src/services/aiService');

const reply = (json) => ({ response: { text: () => (typeof json === 'string' ? json : JSON.stringify(json)) } });
const httpError = (status, message) => Object.assign(new Error(message), { status });

// behaviours: { tênModel: () => kết quả hoặc ném lỗi }
const scriptModels = (behaviours) => {
  mockGetGenerativeModel.mockImplementation(({ model }) => ({
    generateContent: jest.fn(async () => {
      const behaviour = behaviours[model];
      if (!behaviour) throw httpError(404, `models/${model} is not found`);
      return behaviour();
    }),
  }));
};

let imageSeq = 0;
// Mỗi test một ảnh riêng để bộ nhớ đệm của test trước không ảnh hưởng
const uniqueImage = () => Buffer.from(`ảnh thử ${++imageSeq} ${Date.now()}`);
const calledModels = () => mockGetGenerativeModel.mock.calls.map(([params]) => params.model);

describe('aiService.classifyIssueImage', () => {
  beforeEach(() => {
    mockGetGenerativeModel.mockReset();
    delete process.env.GEMINI_MODELS;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to the next model when the first one is overloaded (503)', async () => {
    scriptModels({
      'gemini-3.5-flash-lite': () => { throw httpError(503, 'This model is currently experiencing high demand'); },
      'gemini-2.5-flash': () => reply({ category: 'tree', confidence: 0.9, description: 'Cây đổ' }),
    });

    const result = await classifyIssueImage(uniqueImage());

    expect(result).toEqual({ category: 'tree', confidence: 0.9, description: 'Cây đổ' });
    expect(calledModels()).toEqual(['gemini-3.5-flash-lite', 'gemini-2.5-flash']);
    expect(mockGetGenerativeModel).toHaveBeenLastCalledWith(
      {
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
      },
      { timeout: expect.any(Number) },
    );
  });

  it('skips malformed JSON and removed models until one answers', async () => {
    scriptModels({
      'gemini-3.5-flash-lite': () => reply('không phải JSON'),
      'gemini-2.5-flash': () => { throw httpError(404, 'models/gemini-2.5-flash is no longer available'); },
      'gemini-3.1-flash-lite': () => reply('```json\n{"category":"flooding","confidence":0.7,"description":"Ngập"}\n```'),
    });

    const result = await classifyIssueImage(uniqueImage());

    expect(result.category).toBe('flooding');
    expect(calledModels()).toEqual(['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.1-flash-lite']);
  });

  it('returns the default result with confidence 0 when every model fails', async () => {
    scriptModels({});

    const result = await classifyIssueImage(uniqueImage());

    expect(result).toEqual({ category: 'other', confidence: 0, description: 'Không thể phân tích ảnh' });
  });

  it('normalises unknown categories and clamps confidence', async () => {
    scriptModels({ 'gemini-3.5-flash-lite': () => reply({ category: 'volcano', confidence: 7, description: 'x' }) });

    const result = await classifyIssueImage(uniqueImage());

    expect(result).toMatchObject({ category: 'other', confidence: 1 });
  });

  it('caches by the whole image, so images sharing the first bytes get their own result', async () => {
    let call = 0;
    scriptModels({
      'gemini-3.5-flash-lite': () => reply(++call === 1
        ? { category: 'pothole', confidence: 0.8, description: 'Ổ gà' }
        : { category: 'garbage', confidence: 0.8, description: 'Rác' }),
    });
    // Hai ảnh JPEG cùng bộ mã hoá thường trùng phần đầu tệp; khoá cũ là 100 byte đầu
    const header = Buffer.alloc(200, 0xff);
    const first = Buffer.concat([header, Buffer.from(`A${Date.now()}`)]);
    const second = Buffer.concat([header, Buffer.from(`B${Date.now()}`)]);

    const a1 = await classifyIssueImage(first);
    const a2 = await classifyIssueImage(first);
    const b = await classifyIssueImage(second);

    expect(a1.category).toBe('pothole');
    expect(a2).toBe(a1);
    expect(b.category).toBe('garbage');
    expect(call).toBe(2);
  });

  it('follows the model chain from GEMINI_MODELS', async () => {
    process.env.GEMINI_MODELS = 'model-x,model-y';
    scriptModels({ 'model-y': () => reply({ category: 'garbage', confidence: 0.6, description: 'Rác' }) });

    const result = await classifyIssueImage(uniqueImage());

    expect(result.category).toBe('garbage');
    expect(calledModels()).toEqual(['model-x', 'model-y']);
  });
});
