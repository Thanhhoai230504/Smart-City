import type { DepartmentScoreLabel, EvaluationDecision } from '../types';

/**
 * Luật quyết định khen thưởng / phê bình — bản phía web của
 * Backend/src/utils/departmentEvaluationConfig.js để kiểm sớm trên form. Backend vẫn
 * kiểm lại và là nơi phán quyết cuối cùng.
 */
export const EVALUATION_DECISIONS: Array<{ value: EvaluationDecision; label: string; description: string }> = [
  { value: 'commend', label: 'Khen thưởng', description: 'Hoàn thành xuất sắc nhiệm vụ trong kỳ' },
  { value: 'acknowledge', label: 'Ghi nhận', description: 'Hoàn thành nhiệm vụ' },
  { value: 'remind', label: 'Nhắc nhở', description: 'Còn tồn tại cần khắc phục trong kỳ sau' },
  { value: 'criticize', label: 'Phê bình', description: 'Tồn tại nghiêm trọng hoặc kéo dài' },
];

export const DECISION_LABEL: Record<EvaluationDecision, string> = Object.fromEntries(
  EVALUATION_DECISIONS.map((d) => [d.value, d.label]),
) as Record<EvaluationDecision, string>;

/** Gợi ý của hệ thống ứng với quyết định nào. Hệ thống không bao giờ gợi ý phê bình. */
export const EXPECTED_DECISION: Record<DepartmentScoreLabel, EvaluationDecision | null> = {
  commend: 'commend',
  meet: 'acknowledge',
  improve: 'remind',
  insufficient: null,
};

export const EVALUATION_LIMITS = {
  contentMin: 10,
  contentMax: 2000,
  reasonMin: 10,
  reasonMax: 1000,
  documentMax: 100,
  revokeMin: 10,
  revokeMax: 500,
} as const;

export const suggestedDecision = (label: DepartmentScoreLabel) => EXPECTED_DECISION[label];

export const isDeviation = (decision: EvaluationDecision, label: DepartmentScoreLabel) => EXPECTED_DECISION[label] !== decision;

/** Câu nhắc khi quyết định khác gợi ý (null nếu không khác). */
export const deviationHint = (decision: EvaluationDecision, label: DepartmentScoreLabel, labelText: string | null) => {
  if (!isDeviation(decision, label)) return null;
  if (label === 'insufficient') {
    return 'Kỳ này hệ thống chưa đủ dữ liệu để gợi ý — hãy nêu căn cứ của quyết định.';
  }
  return `Hệ thống gợi ý "${labelText}", quyết định "${DECISION_LABEL[decision]}" khác gợi ý — hãy nêu lý do.`;
};

export interface EvaluationFormValue {
  decision: EvaluationDecision | null;
  content: string;
  documentNumber: string;
  deviationReason: string;
}

export type EvaluationFormErrors = Partial<Record<keyof EvaluationFormValue, string>>;

export const validateEvaluationForm = (v: EvaluationFormValue, label: DepartmentScoreLabel): EvaluationFormErrors => {
  const errors: EvaluationFormErrors = {};
  const L = EVALUATION_LIMITS;
  if (!v.decision) errors.decision = 'Chọn loại quyết định';
  const content = v.content.trim();
  if (content.length < L.contentMin || content.length > L.contentMax) {
    errors.content = `Nội dung từ ${L.contentMin} đến ${L.contentMax} ký tự`;
  }
  if (v.documentNumber.trim().length > L.documentMax) {
    errors.documentNumber = `Số văn bản không quá ${L.documentMax} ký tự`;
  }
  if (v.decision && isDeviation(v.decision, label)) {
    const reason = v.deviationReason.trim();
    if (reason.length < L.reasonMin || reason.length > L.reasonMax) {
      errors.deviationReason = `Lý do từ ${L.reasonMin} đến ${L.reasonMax} ký tự`;
    }
  }
  return errors;
};

const OPEN_PERIOD_MS = 60 * 60 * 1000;

/** Kỳ kéo đến "bây giờ" (vd. Tháng này, 30 ngày qua) — số liệu còn đang thay đổi. */
export const isOpenPeriod = (to: Date, now: Date = new Date()) => now.getTime() - to.getTime() < OPEN_PERIOD_MS;
