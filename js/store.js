// 상태 저장소 — localStorage 목 백엔드.
// 실제 앱에서는 Supabase로 교체 (테이블 구조는 설계서 §10 "데이터 테이블" 기준).

const LS_KEY = 'vibemap.state.v2'; // v2: 리액션 개편(hip)·홈 변경 이력 — v1 상태와 비호환

const state = {
  districts: [], // { guId, name, level, totalScore, weeklyHistory, centroid: [lat,lng] }
  tags: [],      // { id, tossKey, guId, lat, lng, text, isResident, state, createdAt }
  reactions: [], // { tossKey, tagId, type, isOnsite, createdAt }
  reports: [],   // { tagId, tossKey, reason, createdAt }
  dailyLimits: {}, // { 'YYYY-MM-DD': { postsUsed, reactionsUsed, adBonus } }
  user: { homeGuId: null, homeChangedAt: null }, // homeChangedAt: 쿨다운 판정 (설계서 §5)
  moderationQueue: [], // 부정어 감지 → 노출 보류 태그 id
};

export function getState() {
  return state;
}

export function save() {
  const { districts, tags, reactions, reports, dailyLimits, user, moderationQueue } = state;
  localStorage.setItem(LS_KEY, JSON.stringify({ tags, reactions, reports, dailyLimits, user, moderationQueue,
    districtLevels: districts.map((d) => ({ guId: d.guId, level: d.level, totalScore: d.totalScore })) }));
}

export function resetAll() {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem('vibemap.state.v1'); // 구버전 잔재 정리
  localStorage.removeItem('vibemap.mock.location');
  location.reload();
}

// GeoJSON + 시드 데이터 로드 후 저장된 유저 상태 병합
export async function initStore() {
  const [geo, seed] = await Promise.all([
    fetch('./data/seoul-25gu.geojson').then((r) => r.json()),
    fetch('./data/seed-tags.json').then((r) => r.json()),
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
    };
  });

  const byName = Object.fromEntries(state.districts.map((d) => [d.name, d.guId]));
  state.tags = seed.tags.map((t, i) => ({
    id: 'seed-' + i,
    tossKey: 'seed-user-' + (i % 7),
    guId: byName[t.gu],
    lat: t.lat, lng: t.lng, text: t.text,
    isResident: t.resident,
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
    state.tags = state.tags.concat(p.tags.filter((t) => !t.id.startsWith('seed-')));
    state.reactions = state.reactions.concat(p.reactions.filter((r) => !r.tossKey.startsWith('seed-')));
    state.reports = p.reports || [];
    state.dailyLimits = p.dailyLimits || {};
    state.user = p.user || { homeGuId: null, homeChangedAt: null };
    state.moderationQueue = p.moderationQueue || [];
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

// 폴리곤 외곽 꼭짓점 평균 (프로토타입용 근사 중심)
function ringCentroid(geometry) {
  const rings = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.coordinates.flat();
  const pts = rings[0];
  const lng = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return [lat, lng];
}

export function applyReportState(tagId) {
  const count = state.reports.filter((r) => r.tagId === tagId).length;
  const tag = state.tags.find((t) => t.id === tagId);
  // 보류(held) 상태도 신고 누적 시 블라인드로 확정 (관리자 검토 우선순위 표시)
  if (tag && count >= 3 && (tag.state === 'public' || tag.state === 'held')) tag.state = 'blinded';
}
