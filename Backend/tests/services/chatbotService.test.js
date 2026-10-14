const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: mockGetGenerativeModel })),
}));
jest.mock('../../src/models/Issue', () => ({}));

const { chat } = require('../../src/services/chatbotService');

const httpError = (status, message) => Object.assign(new Error(message), { status });

// behaviours: { tênModel: () => câu trả lời hoặc ném lỗi }
const scriptModels = (behaviours) => {
  mockGetGenerativeModel.mockImplementation(({ model }) => ({
    startChat: jest.fn(() => ({
      sendMessage: jest.fn(async () => {
        const behaviour = behaviours[model];
        if (!behaviour) throw httpError(404, `models/${model} is not found`);
        return { response: { text: () => behaviour() } };
      }),
    })),
  }));
};

const calledModels = () => mockGetGenerativeModel.mock.calls.map(([params]) => params.model);

describe('chatbotService.chat', () => {
  beforeEach(() => {
    mockGetGenerativeModel.mockReset();
    delete process.env.GEMINI_MODELS;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers from the next model when the first one is overloaded', async () => {
    scriptModels({
      'gemini-3.5-flash-lite': () => { throw httpError(503, 'Service Unavailable'); },
      'gemini-2.5-flash': () => 'Bạn vào mục Báo cáo sự cố để gửi phản ánh.',
    });

    const reply = await chat(`Làm sao để báo cáo? ${Date.now()}`);

    expect(reply).toBe('Bạn vào mục Báo cáo sự cố để gửi phản ánh.');
    expect(calledModels()).toEqual(['gemini-3.5-flash-lite', 'gemini-2.5-flash']);
  });

  it('returns a friendly message when every model fails', async () => {
    scriptModels({});

    const reply = await chat(`Xin chào ${Date.now()}`);

    expect(reply).toBe('Trợ lý AI đang tạm thời không phản hồi. Vui lòng thử lại sau ít phút.');
    expect(calledModels()).toEqual(['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.1-flash-lite']);
  });
});
