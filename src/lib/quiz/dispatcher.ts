import type {
  QuestionForValidation,
  StudentAnswer,
  ValidationResult,
} from '@/types/interaction';
import { validateMultipleChoice } from './validators/multiple-choice';
import { validateTrueFalse } from './validators/true-false';
import { validateSequencing } from './validators/sequencing';
import { validateMatching } from './validators/matching';
import { validateFillInBlank } from './validators/fill-in-blank';
import { validateMultiSelect } from './validators/multi-select';
import { validateDragDrop } from './validators/drag-drop';

// helper ของเรา: รับโจทย์พร้อมเฉลยและคำตอบ คืน ValidationResult; switch เลือก validator ตาม interaction_type
// Final Exam/Video Quiz เรียกบน Server; validator ไม่อ่าน Database เอง จึงต้องส่งเฉลยจากแหล่งที่ caller ตรวจสิทธิ์แล้ว
export function validateAnswer(
  question: QuestionForValidation,
  studentAnswer: StudentAnswer
): ValidationResult {
  switch (question.interaction_type) {
    case 'multiple_choice':
      return validateMultipleChoice(question, studentAnswer as any);

    case 'true_false':
      return validateTrueFalse(question, studentAnswer as any);

    case 'sequencing':
      return validateSequencing(question, studentAnswer as any);

    case 'matching':
      return validateMatching(question, studentAnswer as any);

    case 'fill_in_blank':
      return validateFillInBlank(question, studentAnswer as any);

    case 'multi_select':
      return validateMultiSelect(question, studentAnswer as any);

    case 'drag_drop':
      return validateDragDrop(question, studentAnswer as any);

    case 'note_callout':
      throw new Error('note_callout ไม่มีคำตอบให้ตรวจ — ห้ามเรียก validateAnswer กับ type นี้');

    default: {
      const _exhaustive: never = question.interaction_type;
      throw new Error(`Unknown interaction_type: ${_exhaustive}`);
    }
  }
}
