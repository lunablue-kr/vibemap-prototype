// 서비스 상수 — 설계서 v0.5 기준. 운영 조정 값은 전부 여기(하드코딩 금지, §10).
export const CONFIG = {
  APP_NAME: '서울 바이브맵 (가칭)',

  TAG_MAX_LENGTH: 30, // v0.5: 50→30자

  // 하루 제한 (§6)
  DAILY_POST_LIMIT: 3,
  DAILY_REACTION_LIMIT: 20,
  AD_BONUS_POSTS: 3,

  // 리액션 4종 (v0.5 개편: 💪힘내 삭제 → ✨힙해요)
  REACTION_TYPES: [
    { id: 'like', label: '공감', emoji: '👍' },
    { id: 'funny', label: '웃겨요', emoji: '😂' },
    { id: 'hug', label: '위로', emoji: '🫂' },
    { id: 'hip', label: '힙해요', emoji: '✨' },
  ],
  ONSITE_MULTIPLIER: 2,
  WEEKLY_REACTION_SCORE_CAP: 50, // 태그당 주간 점수 반영 상한

  // 점수 정의 (§8 확정): 태그 등록 +3 / 리액션 수신 +1 (현장 2배)
  SCORE_PER_TAG: 3,
  SCORE_PER_REACTION: 1,

  // 승격·자리싸움 (§6, §9-3 확정)
  PROMOTE_MID_THRESHOLD: 3, // 합산 3 = 중간 크기
  BIG_TOP_N: 10, // 구 내 합산 상위 10개만 큰 크기
  INITIAL_ZOOM_BOOST: 0.4, // 시작 줌: 전체 fit보다 이만큼 확대 (좌우 살짝 잘림 감수). 최소 줌도 이 값으로 고정
  MAP_CAP_FAR: 1, // 서울 전체 줌: 구당 상위 1~2개 (과밀 방지로 1)
  MAP_CAPS_BY_ZOOM: { 11: 3, 12: 6, 13: 10 }, // 줌인할수록 상위 10개까지 점진 확대 (§9-3)
  MAP_NEAR_ZOOM: 11, // 이 줌 이상부터 크기 단계 표시
  LABEL_CHARS: { big: 12, mid: 9, small: 6 }, // 크기 단계별 표시 글자수 (1줄 제한)

  // 구 레벨 (§8 확정): Lv2~Lv10 필요 누적 점수
  LEVEL_MAX: 10,
  LEVEL_THRESHOLDS: [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7500],

  // 신고 (§7)
  REPORT_BLIND_COUNT: 3,

  // 홈 지역구 (§5 확정): 최초 자유, 변경은 현지 GPS 1회 + 쿨다운
  HOME_CHANGE_COOLDOWN_DAYS: 28,

  // 주간 결산 (§8) — Phase 1: 총점+급상승 2부문. DAU 기준 도달 시 5부문
  MIN_WEEKLY_CONTRIBUTORS: 10,
  LAUNCH_CATEGORIES: ['top', 'rising'],
  ALL_CATEGORIES: [
    { id: 'funny', label: '😂 웃긴 동네', metric: 'ratio' },
    { id: 'hug', label: '🫂 따스한 동네', metric: 'ratio' },
    { id: 'hip', label: '✨ 힙한 동네', metric: 'ratio' }, // v0.5: 응원의 동네 교체
    { id: 'rising', label: '🔥 급상승 동네', metric: 'growth' },
    { id: 'top', label: '👑 최다 활동', metric: 'total' },
  ],

  // 랭킹 롤링 칩 (§9-0): Phase 1은 총점·급상승 2종 롤링
  CHIP_ROTATE_MS: 4000,
};
