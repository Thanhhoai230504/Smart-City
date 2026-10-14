/**
 * Chuỗi model Gemini dùng chung cho phân loại ảnh (aiService) và chatbot (chatbotService).
 *
 * Gọi lần lượt từng model tới khi một model trả kết quả hợp lệ. Mọi lỗi đều chuyển sang
 * model kế tiếp: quá tải (503), hết hạn mức (429), model đã bị Google gỡ (404), quá thời
 * gian, JSON hỏng… Trước 14/10/2026 chuỗi chỉ chuyển model khi lỗi 429, trong khi hai model
 * dự phòng `gemini-2.0-flash*` đã ngừng từ 01/06/2026, nên một lỗi 503 của model chính là
 * đủ làm AI trả kết quả mặc định.
 *
 * Đổi chuỗi không cần sửa mã: đặt `GEMINI_MODELS` trong .env, ví dụ
 * `GEMINI_MODELS=gemini-3.5-flash-lite,gemini-2.5-flash`.
 */

// Đo ngày 14/10/2026 với prompt phân loại ảnh: 3.5 Flash-Lite khoảng 1,2 s; 2.5 Flash (tắt
// suy luận) khoảng 3 s; 3.1 Flash-Lite khoảng 3 s nhưng kém chính xác hơn nên để cuối.
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];

// Cấu hình riêng theo model, ghép đè lên cấu hình của lời gọi. 2.5 Flash bật suy luận theo
// mặc định (chậm gấp đôi, token suy luận tính tiền như token đầu ra) mà việc phân loại hay
// trả lời chatbot không cần.
const MODEL_CONFIG = {
  'gemini-2.5-flash': { thinkingConfig: { thinkingBudget: 0 } },
};

// Thời gian chờ cho mỗi lượt gọi một model; cả chuỗi phải xong trước hạn chờ 30 s của client.
const DEFAULT_TIMEOUT_MS = 9000;

const getModelChain = (env = process.env) => {
  const fromEnv = String(env.GEMINI_MODELS || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_MODELS;
};

const describeError = (error) =>
  `${error?.status ?? ''} ${String(error?.message ?? error)}`.replace(/\s+/g, ' ').trim().slice(0, 160);

/**
 * Chạy `run(model, modelName)` với từng model trong chuỗi tới khi thành công.
 * @returns {Promise<{ modelName: string, value: any }>}
 * @throws Error có `attempts` (danh sách lỗi theo model) khi mọi model đều lỗi.
 */
const withModelFallback = async (
  genAI,
  { generationConfig = {}, timeoutMs = DEFAULT_TIMEOUT_MS, logLabel = 'Gemini', models = getModelChain() } = {},
  run,
) => {
  const attempts = [];
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel(
        { model: modelName, generationConfig: { ...generationConfig, ...MODEL_CONFIG[modelName] } },
        { timeout: timeoutMs },
      );
      const value = await run(model, modelName);
      return { modelName, value };
    } catch (error) {
      attempts.push(`${modelName}: ${describeError(error)}`);
      console.warn(`${logLabel} [${modelName}] failed:`, describeError(error));
    }
  }
  const error = new Error(`Mọi model Gemini đều lỗi (${attempts.length} lượt)`);
  error.attempts = attempts;
  throw error;
};

module.exports = { DEFAULT_MODELS, MODEL_CONFIG, getModelChain, withModelFallback };
