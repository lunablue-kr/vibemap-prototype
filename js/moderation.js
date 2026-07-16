// 모더레이션 1차 자동 필터 (설계서 §7)
// 금칙어·부정어 사전은 초안 미확정(설계서 §13) — 아래는 프로토타입용 최소 초안.

import { getState, save, applyReportState } from './store.js';
import { CONFIG } from './config.js';

// 금칙어: 욕설·혐오 + 연락처/URL 패턴 → 차단
const BANNED_WORDS = ['시발', '씨발', '병신', '새끼', '좆'];
const CONTACT_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\d{2,3}-\d{3,4}-\d{4}/, // 전화번호
  /[\w.-]+@[\w-]+\.\w{2,}/, // 이메일
  /카톡|카카오톡\s*아이디|오픈채팅|텔레그램|인스타\s*@/,
];
// 정치 관련 → 금칙어 사전 등재 (설계서 §7 판단기준 5)
const POLITICS_WORDS = ['민주당', '국민의힘', '보수 성향', '진보 성향', '좌파', '우파', '대통령'];

// 부정어: 차단이 아닌 노출 보류 + 관리자 대기열 (오탐 허용, 안전 우선)
// 치안·집값 서열화(설계서 §7 판단기준 4)는 무조건 삭제 대상이라 보류 대기열로 우선 격리
const NEGATIVE_WORDS = [
  '맛없', '최악', '별로', '불친절', '비추', '더럽', '바가지', '위생', '사기', '무례',
  '우범', '치안', '집값', '슬럼', '위험한 동네',
];

// 반환: { ok, blocked?, held?, message? }
export function checkText(text) {
  const t = text.trim();
  if (!t) return { ok: false, message: '내용을 입력해주세요.' };
  if (t.length > CONFIG.TAG_MAX_LENGTH) {
    return { ok: false, message: `태그는 ${CONFIG.TAG_MAX_LENGTH}자까지 쓸 수 있어요.` };
  }
  if (BANNED_WORDS.some((w) => t.includes(w)) || POLITICS_WORDS.some((w) => t.includes(w))) {
    return { ok: false, blocked: true, message: '등록할 수 없는 표현이 포함되어 있어요.' };
  }
  if (CONTACT_PATTERNS.some((p) => p.test(t))) {
    return { ok: false, blocked: true, message: '연락처나 링크는 남길 수 없어요.' };
  }
  if (NEGATIVE_WORDS.some((w) => t.includes(w))) {
    return { ok: true, held: true }; // 노출 보류 → 관리자 검토 대기열
  }
  return { ok: true };
}

// 신고 접수 → 3회 누적 시 자동 블라인드 (설계서 §7)
export function reportTag(tagId, tossKey, reason) {
  const s = getState();
  if (s.reports.some((r) => r.tagId === tagId && r.tossKey === tossKey)) {
    return { ok: false, message: '이미 신고한 태그예요.' };
  }
  s.reports.push({ tagId, tossKey, reason, createdAt: Date.now() });
  applyReportState(tagId);
  save();
  const blinded = s.tags.find((t) => t.id === tagId)?.state === 'blinded';
  return { ok: true, message: blinded ? '신고가 접수되어 태그가 가려졌어요.' : '신고가 접수되었어요.' };
}

// 신고 사유 목록 — "타 지역 비교/도발" 항목 포함 (설계서 §5 원정 태그 규칙)
export const REPORT_REASONS = [
  '사람(거주민) 조롱',
  '상호명 + 부정 표현',
  '치안·집값 서열화',
  '정치 관련',
  '타 지역 비교/도발',
  '욕설·혐오',
  '기타',
];
