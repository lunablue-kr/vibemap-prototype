// 서비스 상수 — 설계서.md 기준. "미결" 표시 값은 설계서 §13 확정 전 임시값.
export const CONFIG = {
  APP_NAME: '서울 바이브맵 (가칭)',

  TAG_MAX_LENGTH: 50,

  // 하루 제한 (설계서 §6)
  DAILY_POST_LIMIT: 3,
  DAILY_REACTION_LIMIT: 20,
  AD_BONUS_POSTS: 3, // 보상형 광고 시청 시 글 +3회

  // 리액션 (설계서 §6) — 다운보트 없음, 종류별 점수 차등 없음
  REACTION_TYPES: [
    { id: 'like', label: '공감', emoji: '👍' },
    { id: 'funny', label: '웃겨', emoji: '😂' },
    { id: 'cheer', label: '힘내', emoji: '💪' },
    { id: 'hug', label: '위로', emoji: '🫂' },
  ],
  ONSITE_MULTIPLIER: 2, // 현장 리액션 점수 2배
  WEEKLY_REACTION_SCORE_CAP: 50, // 태그당 주간 점수 반영 상한 (표시 수는 무제한)

  // 승격 임계값 — 미결(설계서 §13), 임시값
  PROMOTE_THRESHOLD: 5,

  // 구 레벨 (설계서 §8) — 점수 테이블 미결(§13), 임시값
  LEVEL_MAX: 10,
  LEVEL_THRESHOLDS: [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000],

  // 신고 자동 블라인드 (설계서 §7)
  REPORT_BLIND_COUNT: 3,

  // 주간 결산 (설계서 §8) — 출시 시점엔 2부문만 활성, 5부문 코드는 준비
  MIN_WEEKLY_CONTRIBUTORS: 10, // 미만이면 집계 제외 = 불씨
  LAUNCH_CATEGORIES: ['top', 'rising'],
  ALL_CATEGORIES: [
    { id: 'funny', label: '😂 웃긴 동네', metric: 'ratio' },
    { id: 'hug', label: '🫂 따스한 동네', metric: 'ratio' },
    { id: 'cheer', label: '💪 응원의 동네', metric: 'ratio' },
    { id: 'rising', label: '🔥 급상승 동네', metric: 'growth' },
    { id: 'top', label: '👑 최다 활동', metric: 'total' },
  ],
};
