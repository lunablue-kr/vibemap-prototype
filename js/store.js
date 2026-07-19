// 상태 저장소 — localStorage 목 백엔드.
// 실제 앱에서는 Supabase로 교체 (테이블 구조는 설계서 §10 "데이터 테이블" 기준).
import { CONFIG } from './config.js';

const LS_KEY = 'vibemap.state.v2'; // v2: 리액션 개편(hip)·홈 변경 이력 — v1 상태와 비호환

const state = {
  districts: [], // { guId, name, level, totalScore, weeklyHistory, centroid: [lat,lng] }
  tags: [],      // { id, tossKey, guId, lat, lng, text, isResident, state, createdAt }
  reactions: [], // { tossKey, tagId, type, isOnsite, createdAt }
  reports: [],   // { tagId, tossKey, reason, createdAt }
  dailyLimits: {}, // { 'YYYY-MM-DD': { postsUsed, reactionsUsed, adBonus } }
  // homeGuId null 허용 (§5 v0.5.3: 홈 없는 비서울 구경꾼). originCity: 비서울 출신(오픈 투표 연결)
  // firstTagDone: 첫 태그 축하 1회성 트리거 (§4). loggedIn: 토스 로그인(첫 기여 시점 게이트, §2·§7)
  user: { homeGuId: null, homeChangedAt: null, originCity: null, onboarded: false, firstTagDone: false, loggedIn: false },
  regionVotes: [], // { cityId, at } — 잠긴 지역 오픈 요청 투표 (§5)
  moderationQueue: [], // 부정어 감지 → 노출 보류 태그 id
  // Phase 2 (A)군 — 서버 주간 결산 배치가 채우는 영속 데이터 (§8·§10 테이블).
  // 프로토타입엔 배치가 없어 항상 빈 배열. FLAGS(masterTag/conquestMedal) 게이트와 함께 사용.
  weeklyAwards: [], // { guId, week, category } — 부문별 주간 1위 이력 (마스터태그 칭호 근거)
  hallOfFame: [], // { guId, week, tagId, category } — 부문별 1위 태그 박제 (정복 훈장 근거)
};

const DEFAULT_USER = { homeGuId: null, homeChangedAt: null, originCity: null, onboarded: false, firstTagDone: false, loggedIn: false };

export function getState() {
  return state;
}

export function save() {
  const { districts, tags, reactions, reports, dailyLimits, user, regionVotes, moderationQueue, weeklyAwards, hallOfFame } = state;
  localStorage.setItem(LS_KEY, JSON.stringify({ tags, reactions, reports, dailyLimits, user, regionVotes, moderationQueue, weeklyAwards, hallOfFame,
    districtLevels: districts.map((d) => ({ guId: d.guId, level: d.level, totalScore: d.totalScore })) }));
}

export function resetAll() {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem('vibemap.state.v1'); // 구버전 잔재 정리
  localStorage.removeItem('vibemap.mock.location');
  location.reload();
}

// GeoJSON + 시드 데이터 로드 후 저장된 유저 상태 병합
// demo-tags.json = 프로토타입 시연 전용 (리액션 과장 프리셋).
// 본개발 전환 시 출시 규격인 seed-tags.json으로 교체할 것 (각 파일 _meta 참조)
export async function initStore() {
  const [geo, seed] = await Promise.all([
    fetch('./data/seoul-25gu.geojson').then((r) => r.json()),
    fetch('./data/demo-tags.json').then((r) => r.json()),
  ]);

  state.geojson = geo;
  state.districts = geo.features.map((f) => {
    const s = seed.districts[f.properties.name] || {};
    return {
      guId: f.properties.code,
      name: f.properties.name,
      level: s.level || 1,
      totalScore: s.totalScore || 0,
      weeklyHistory: s.weeklyHistory || [0, 0, 0, 0], // 직전 4주 점수 (급상승 분모)
      centroid: ringCentroid(f.geometry), // 고정석(주간 1위 구 중심 고정) 앵커용
      geometry: f.geometry, // 라벨 밀어내기 구 경계 검사용 (§9-3)
    };
  });

  const byName = Object.fromEntries(state.districts.map((d) => [d.name, d.guId]));
  state.tags = seed.tags.map((t, i) => ({
    id: 'seed-' + i,
    tossKey: 'seed-user-' + (i % 7),
    guId: byName[t.gu],
    lat: t.lat, lng: t.lng, text: t.text,
    isResident: t.resident,
    hofLocked: !!t.hofLocked, // 명예의 전당 박제(지난주 1위) — 리액션 불가
    state: 'public',
    createdAt: Date.now() - t.daysAgo * 86400000,
  }));
  state.reactions = [];
  seed.tags.forEach((t, i) => {
    Object.entries(t.reactions || {}).forEach(([type, count]) => {
      for (let k = 0; k < count; k++) {
        state.reactions.push({
          tossKey: 'seed-reactor-' + k, tagId: 'seed-' + i, type,
          isOnsite: k % 3 === 0, createdAt: Date.now() - t.daysAgo * 86400000,
        });
      }
    });
  });

  // 저장된 세션 상태 병합 (유저가 만든 태그·리액션·설정)
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    const p = JSON.parse(saved);
    // 손상·부분 저장본 방어 (필드 누락 시 빈 배열)
    state.tags = state.tags.concat((p.tags || []).filter((t) => !t.id.startsWith('seed-')));
    state.reactions = state.reactions.concat((p.reactions || []).filter((r) => !r.tossKey.startsWith('seed-')));
    state.reports = p.reports || [];
    state.dailyLimits = p.dailyLimits || {};
    state.user = { ...DEFAULT_USER, ...(p.user || {}) }; // 구 저장본에 없는 신규 필드 기본값 병합
    state.regionVotes = p.regionVotes || [];
    state.moderationQueue = p.moderationQueue || [];
    state.weeklyAwards = p.weeklyAwards || []; // Phase 2: 서버 배치 미존재 시 빈 배열 유지
    state.hallOfFame = p.hallOfFame || [];
    (p.districtLevels || []).forEach((dl) => {
      const d = state.districts.find((x) => x.guId === dl.guId);
      if (d) { d.level = dl.level; d.totalScore = dl.totalScore; }
    });
    // 시드 태그에 대한 신고 상태 반영
    state.reports.forEach((r) => applyReportState(r.tagId));
  }
  return state;
}

export function getDistrict(guId) {
  return state.districts.find((d) => d.guId === guId);
}

// 터치 지점이 구 경계에 너무 가까우면(핀 소속이 모호해 보임) 무게중심 쪽으로 당겨 보정
const BOUNDARY_MARGIN = 0.0008; // 위도 기준 약 80m
export function snapIntoDistrict(guId, lat, lng) {
  const d = state.districts.find((x) => x.guId === guId);
  if (!d) return [lat, lng];
  const ring = (d.geometry.type === 'Polygon' ? d.geometry.coordinates : d.geometry.coordinates.flat())[0];
  let p = [lat, lng];
  for (let i = 0; i < 10; i++) {
    if (distToRing(p[0], p[1], ring) >= BOUNDARY_MARGIN) break;
    p = [p[0] + (d.centroid[0] - p[0]) * 0.25, p[1] + (d.centroid[1] - p[1]) * 0.25];
  }
  return p;
}

// 점→경계 근사 거리 (도 단위, 경도축 0.8 스케일)
function distToRing(lat, lng, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((lng - x1) * dx + (lat - y1) * dy) / (dx * dx + dy * dy)));
    const nx = x1 + t * dx;
    const ny = y1 + t * dy;
    best = Math.min(best, Math.hypot((lng - nx) * 0.8, lat - ny));
  }
  return best;
}

// 폴리곤 면적 무게중심 (신발끈 공식) — 꼭짓점 평균보다 오목한 구에서도 정중앙에 가까움
function ringCentroid(geometry) {
  const rings = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.coordinates.flat();
  const pts = rings[0];
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const cross = pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    area += cross;
    cx += (pts[i][0] + pts[i + 1][0]) * cross;
    cy += (pts[i][1] + pts[i + 1][1]) * cross;
  }
  if (area === 0) return [pts[0][1], pts[0][0]];
  return [cy / (3 * area), cx / (3 * area)]; // [lat, lng]
}

export function applyReportState(tagId) {
  const count = state.reports.filter((r) => r.tagId === tagId).length;
  const tag = state.tags.find((t) => t.id === tagId);
  // 보류(held) 상태도 신고 누적 시 블라인드로 확정 (관리자 검토 우선순위 표시). 임계값은 config (§10 하드코딩 금지)
  if (tag && count >= CONFIG.REPORT_BLIND_COUNT && (tag.state === 'public' || tag.state === 'held')) tag.state = 'blinded';
}
