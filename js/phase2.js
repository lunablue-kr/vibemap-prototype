// Phase 2 (A)군 공통 게이트 헬퍼 (설계서 §8·§9-3·§12).
// 각 기능은 config.FLAGS로 실행 경로까지 차단 — Phase 1 빌드(플래그 전부 off)에선
// 화면·데이터에 흔적이 0이어야 한다. 여기 함수들이 그 단일 게이트 지점.
import { CONFIG } from './config.js';
import { getState } from './store.js';

// 명예의 전당 박제 여부 (지난주 1위 태그, hofLocked 시드).
// hallOfFame off면 false → hofLocked 시드 태그가 일반 공개 태그처럼(리액션 가능·박제 시각 없음) 동작.
export function isHof(tag) {
  return !!tag?.hofLocked && CONFIG.FLAGS.hallOfFame;
}

// 마스터태그 칭호 (부문 누적/연속 수상 구의 지도 항시 칭호, §8).
// state.weeklyAwards는 서버 주간 결산 배치가 채운다 — 프로토타입엔 배치가 없어 항상 빈 배열이므로
// 언제나 null 반환(아무것도 안 그림). 데이터를 지어내지 않는다.
// 칭호 = [수식어] + 부문 공식 라벨(config ALL_CATEGORIES) 유지 — 랭킹 시트와 같은 단어 (카피 통일)
const MASTER_TITLE = {
  funny: '가장 웃긴 동네',
  hug: '감정이 따스한 동네',
  hip: '요즘 가장 힙한 동네',
  rising: '요즘 급상승 동네',
  top: '늘 최다 활동 동네',
};
export function masterTitle(guId) {
  if (!CONFIG.FLAGS.masterTag) return null; // 단일 게이트 계약(호출부 누락 대비 내부 가드)
  const awards = getState().weeklyAwards.filter((a) => a.guId === guId);
  if (!awards.length) return null; // 서버 배치 전(프로토타입)엔 항상 여기 도달
  // 누적 최다 수상 부문의 칭호
  const byCat = {};
  awards.forEach((a) => { byCat[a.category] = (byCat[a.category] || 0) + 1; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0][0];
  return MASTER_TITLE[top] || null;
}

// 정복 훈장 획득 여부 (§8 개인 뱃지): 내 원정(페넌트) 태그가 타구 명예의 전당 입성 시 획득.
// state.hallOfFame도 서버 주간 배치 의존 — 프로토타입엔 빈 배열이라 항상 false.
export function conquestEarned(tossKey) {
  if (!CONFIG.FLAGS.conquestMedal) return false; // 단일 게이트 계약(호출부 누락 대비 내부 가드)
  const s = getState();
  if (!s.hallOfFame.length) return false; // 서버 배치 전엔 데이터 없음
  return s.hallOfFame.some((h) => {
    const tag = s.tags.find((t) => t.id === h.tagId);
    return tag && tag.tossKey === tossKey && !tag.isResident; // 페넌트(원정) 태그만
  });
}
