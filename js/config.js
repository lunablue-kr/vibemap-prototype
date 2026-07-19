// 서비스 상수 — 설계서 v0.5 기준. 운영 조정 값은 전부 여기(하드코딩 금지, §10).
export const CONFIG = {
  APP_NAME: '우리동네 바이브',

  // [테스트/데모 전용] true면 온보딩을 매 진입마다 재노출(onboarded 무시). 출시 시 false — §11 체크리스트
  DEV_FORCE_ONBOARDING: true,

  TAG_MAX_LENGTH: 30, // v0.5: 50→30자

  // 하루 제한 (§6, v0.5.3 조정)
  DAILY_POST_LIMIT: 2, // v0.5.3: 3→2 (생산 조여 품질↑)
  DAILY_REACTION_LIMIT: 15, // v0.5.3: 20→15 (소비는 소폭만 — 지도 활력 유지)
  AD_BONUS_POSTS: 2, // v0.5.3: 3→2

  // 리액션 4종 (v0.5 개편: 💪힘내 삭제 → ✨힙해요)
  // icon = vibe-icons.svg 심볼 id (v0.5.2: 자체 제작 SVG로 교체, 이모지는 약칭 폴백)
  // done = 리액션 누른 순간 피드백 팝에 뜨는 표시 이름 (해요체 통일)
  REACTION_TYPES: [
    { id: 'like', label: '공감', emoji: '👍', icon: 'i-like', done: '공감해요' },
    { id: 'funny', label: '웃겨요', emoji: '😂', icon: 'i-funny', done: '웃겨요' },
    { id: 'hug', label: '위로', emoji: '🫂', icon: 'i-hug', done: '위로해요' },
    { id: 'hip', label: '힙해요', emoji: '✨', icon: 'i-hip', done: '힙해요' },
  ],
  ONSITE_MULTIPLIER: 2,
  WEEKLY_REACTION_SCORE_CAP: 50, // 태그당 주간 점수 반영 상한
  REACTION_MILESTONE: 10, // 태그가 이 리액션 수 도달 시 기능성 메시지 알림 (§9-6)

  // 점수 정의 (§8 확정): 태그 등록 +3 / 리액션 수신 +1 (현장 2배)
  SCORE_PER_TAG: 3,
  SCORE_PER_REACTION: 1,

  // 승격·자리싸움 (§6, §9-3 확정)
  PROMOTE_MID_THRESHOLD: 3, // 합산 3 = 중간 크기
  BIG_TOP_N: 10, // 구 내 합산 상위 10개만 큰 크기
  INITIAL_ZOOM_BOOST: 0.9, // 시작 줌: 전체 fit보다 이만큼 확대 (좌우 살짝 잘림 감수, §9-2). 세로 여백 축소. 최소 줌도 이 값으로 고정
  MAP_CAP_FAR: 1, // 서울 전체 줌: 구당 상위 1~2개 (과밀 방지로 1)
  MAP_CAPS_BY_ZOOM: { 11: 3, 12: 6, 13: 10 }, // 줌인할수록 상위 10개까지 점진 확대 (§9-3)
  MAP_NEAR_ZOOM: 11, // 이 줌 이상부터 구당 상한 확대 시작
  LABEL_FULLSIZE_ZOOM: 12.5, // 이 줌 이상부터 크기 단계(big/mid) 표시 — 이르면 라벨이 커져 노출 수가 역행함
  LABEL_CHARS: { big: 12, mid: 9, small: 6 }, // 크기 단계별 표시 글자수 (1줄 제한)

  // 구 레벨 (§8 확정): Lv2~Lv10 필요 누적 점수
  LEVEL_MAX: 10,
  LEVEL_THRESHOLDS: [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7500],

  // 신고 (§7)
  REPORT_BLIND_COUNT: 3,

  // 뱃지 획득 임계값 (§8 보상·§12 (A) 뱃지 확장) — badgeExpansion 플래그 on일 때만 사용
  BADGE_GU_POST_COUNT: 10, // 한 구에 이 개수만큼 태그 → 동네 터줏대감(i-crown)
  BADGE_DISTINCT_GU: 5, // 이 개수만큼 서로 다른 구에 태그 → 동네 탐험가(i-flag)

  // 홈 지역구 (§5 확정): 최초 자유, 변경은 현지 GPS 1회 + 쿨다운
  HOME_CHANGE_COOLDOWN_DAYS: 28,

  // 주간 결산 (§8) — Phase 1: 총점+급상승 2부문. DAU 기준 도달 시 5부문
  MIN_WEEKLY_CONTRIBUTORS: 10,
  LAUNCH_CATEGORIES: ['top', 'rising'],
  // icon = vibe-icons.svg 심볼 id. label은 텍스트만 (아이콘은 렌더 시 별도 주입)
  ALL_CATEGORIES: [
    { id: 'funny', label: '웃긴 동네', metric: 'ratio', icon: 'i-funny' },
    { id: 'hug', label: '따스한 동네', metric: 'ratio', icon: 'i-hug' },
    { id: 'hip', label: '힙한 동네', metric: 'ratio', icon: 'i-hip' }, // v0.5: 응원의 동네 교체
    { id: 'rising', label: '급상승 동네', metric: 'growth', icon: 'i-fire' },
    { id: 'top', label: '최다 활동 동네', metric: 'total', icon: 'i-crown' },
  ],

  // 랭킹 롤링 칩 (§9-0): Phase 1은 총점·급상승 2종 롤링
  CHIP_ROTATE_MS: 4000,

  // 랭킹 구 탭 → 카메라 이동 시 최대 줌 (크기 단계가 보이는 줌 이상으로)
  PAN_TO_DISTRICT_MAX_ZOOM: 12.5,

  // 초기 활성화 (§4, v0.5.3 Phase 1): 공유 리워드 = 친구 초대 시 오늘 글쓰기 +N회
  SHARE_REWARD_POSTS: 3, // 사행성 무관(현금 아님·앱 내 행동 보상). 브리프·설계서 미지정이라 기본 3회로 config화

  // 비서울 온보딩 (§5, v0.5.3): 출신 지역 선택 → region_votes(오픈 투표)에 반영.
  // 홈 설정 아님 — "○○이 열리면 알려드릴게요". id = 오픈 투표 city_id (서울은 이미 오픈이라 제외)
  ORIGIN_CITIES: [
    { id: 'busan', name: '부산' }, { id: 'incheon', name: '인천' }, { id: 'daegu', name: '대구' },
    { id: 'daejeon', name: '대전' }, { id: 'gwangju', name: '광주' }, { id: 'ulsan', name: '울산' },
    { id: 'sejong', name: '세종' }, { id: 'gyeonggi', name: '경기' }, { id: 'gangwon', name: '강원' },
    { id: 'chungbuk', name: '충북' }, { id: 'chungnam', name: '충남' }, { id: 'jeonbuk', name: '전북' },
    { id: 'jeonnam', name: '전남' }, { id: 'gyeongbuk', name: '경북' }, { id: 'gyeongnam', name: '경남' },
    { id: 'jeju', name: '제주' }, { id: 'etc', name: '그 외' },
  ],

  // 피처 플래그 (v0.5.3) — Phase 2 (A)군은 미리 구현하되 Phase 1 빌드에선 off로 격리.
  // 노출을 잠가도 코드는 존재하므로 실행 경로 차단 필수(테스트 안 된 코드의 버그 표면적 방지).
  // DAU 기준 도달 시 개별 on. (B)군(내돈내산·정식광고·후보·검토)은 여기 없음 — 트래픽/검수 후 별도.
  FLAGS: {
    fiveCategories: false, // 5부문 결산 (로직 준비됨, ALL_CATEGORIES)
    hallOfFame: false, // 명예의 전당
    masterTag: false, // 마스터태그
    conquestMedal: false, // 정복 훈장
    chip5: false, // 롤링 칩 5종 확장
    badgeExpansion: false, // 뱃지 확장(첫 태그·10회·5구 방문 등)
    shareReward: true, // 공유 리워드 SDK — v0.5.3 Phase 1로 이동(초기 활성화, 현금 아님)
  },
};
