// 모더레이션 1차 자동 필터 (설계서 §7)
// 사전은 /data/moderation-dictionary.json (v0.1) — 코드 배포 없이 갱신 가능.
// block = 등록 거부 (어떤 단어인지 특정하지 않음 — 우회 학습 방지)
// hold = 등록 허용 + 노출 보류 + 관리자 대기열 (오탐 허용, 안전 우선)

import { getState, save, applyReportState } from './store.js';
import { CONFIG } from './config.js';

let DICT = { block: [], hold: [], patterns: [] };

// 매칭 전 정규화 (사전 _meta 규칙): 전각→반각(NFKC), 공백·특수문자 제거.
// NFKC가 호환 자모(ㅅㅂ)를 조합형 자모로 바꾸므로 조합형 범위(ᄀ-ᇿ)도 보존하고,
// 사전 항목과 입력 텍스트에 같은 정규화를 적용해 일치를 보장한다.
function normalize(text) {
  return text.normalize('NFKC').replace(/[^0-9a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣᄀ-ᇿ]/g, '');
}

export async function loadDictionary() {
  const d = await fetch('./data/moderation-dictionary.json').then((r) => r.json());
  DICT = {
    block: Object.values(d.block).flat().map(normalize),
    hold: Object.values(d.hold).flat().map(normalize),
    patterns: Object.values(d.patterns).map((p) => new RegExp(p, 'i')),
  };
}

// 반환: { ok, blocked?, held?, message? }
export function checkText(text) {
  const t = text.trim();
  if (!t) return { ok: false, message: '내용을 입력해주세요.' };
  if (t.length > CONFIG.TAG_MAX_LENGTH) {
    return { ok: false, message: `태그는 ${CONFIG.TAG_MAX_LENGTH}자까지 쓸 수 있어요.` };
  }
  if (DICT.patterns.some((p) => p.test(t))) {
    return { ok: false, blocked: true, message: '연락처나 외부 링크는 남길 수 없어요.' };
  }
  const n = normalize(t);
  if (DICT.block.some((w) => n.includes(w))) {
    return { ok: false, blocked: true, message: '커뮤니티 규칙에 맞지 않는 표현이 있어요.' };
  }
  if (DICT.hold.some((w) => n.includes(w))) {
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
