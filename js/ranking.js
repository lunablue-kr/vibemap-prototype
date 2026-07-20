// 주간 랭킹·구 레벨 (설계서 §8)
// 출시 시점: 총점 + 급상승 2부문만 활성 (LAUNCH_CATEGORIES). 5부문 로직은 준비 완료.
import { CONFIG } from './config.js';
import { getState, isArchived } from './store.js';
import { weeklyReactionScore, recentReactionCounts } from './reactions.js';

// 이번 주 시작 (월요일 0시)
export function weekStart() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 월=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

// 구별 이번 주 집계: 점수(태그 1점 + 리액션 캡 적용 점수), 활성 기여자, 리액션 비율
export function weeklyStats() {
  const s = getState();
  const ws = weekStart();
  // 급상승 분모: 직전 4주 주평균. 신규 구(이력 0)는 전체 평균으로 대체 (설계서 §8 분모 0 방지)
  const avgs = s.districts.map((d) => d.weeklyHistory.reduce((a, b) => a + b, 0) / d.weeklyHistory.length);
  const positiveAvgs = avgs.filter((a) => a > 0);
  const overallAvg = positiveAvgs.length ? positiveAvgs.reduce((a, b) => a + b, 0) / positiveAvgs.length : 0;
  return s.districts.map((d) => {
    const tags = s.tags.filter((t) => t.guId === d.guId && t.state === 'public');
    const weekTags = tags.filter((t) => t.createdAt >= ws);
    let score = weekTags.length * CONFIG.SCORE_PER_TAG; // 태그 등록 +3 (설계서 §8 확정)
    const reactionTotals = { total: 0 };
    CONFIG.REACTION_TYPES.forEach((rt) => { reactionTotals[rt.id] = 0; });
    const contributors = new Set(weekTags.map((t) => t.tossKey));

    tags.forEach((t) => {
      score += weeklyReactionScore(t.id, ws);
      s.reactions.forEach((r) => {
        if (r.tagId !== t.id || r.createdAt < ws) return;
        reactionTotals[r.type]++;
        reactionTotals.total++;
        contributors.add(r.tossKey);
      });
    });

    // 급상승 = 이번 주 점수 ÷ (직전 4주 주평균, 신규 구는 전체 평균 대체)
    const pastAvg = d.weeklyHistory.reduce((a, b) => a + b, 0) / d.weeklyHistory.length;
    const denom = pastAvg > 0 ? pastAvg : overallAvg;
    const growth = denom > 0 ? score / denom : 0;

    return {
      guId: d.guId, name: d.name, level: d.level,
      score, growth, reactionTotals,
      activeContributors: contributors.size,
      isEmber: contributors.size < CONFIG.MIN_WEEKLY_CONTRIBUTORS, // 불씨: 집계 제외
    };
  });
}

// 부문별 순위 (활성 부문만). 불씨 구는 집계 제외.
export function categoryRanking(categoryId) {
  const stats = weeklyStats().filter((d) => !d.isEmber);
  const sorted = [...stats];
  if (categoryId === 'top') sorted.sort((a, b) => b.score - a.score);
  else if (categoryId === 'rising') sorted.sort((a, b) => b.growth - a.growth);
  else {
    // 비율 부문 (Phase 2 활성화 대기): 해당 리액션 비율 기준
    sorted.sort((a, b) => ratio(b, categoryId) - ratio(a, categoryId));
  }
  return sorted;
}

function ratio(stat, type) {
  return stat.reactionTotals.total > 0 ? stat.reactionTotals[type] / stat.reactionTotals.total : 0;
}

// 활성 부문 목록. Phase 2 게이트: 랭킹 시트는 FLAGS.fiveCategories, 롤링 칩은 FLAGS.chip5로
// 각각 독립 판정 (chip:true면 칩 기준). 플래그 off면 LAUNCH_CATEGORIES(총점·급상승 2종)만.
export function activeCategories({ chip = false } = {}) {
  const expand = chip ? CONFIG.FLAGS.chip5 : CONFIG.FLAGS.fiveCategories;
  if (expand) return CONFIG.ALL_CATEGORIES; // 5부문 전체
  return CONFIG.ALL_CATEGORIES.filter((c) => CONFIG.LAUNCH_CATEGORIES.includes(c.id));
}

// 랭킹 롤링 칩 데이터 (설계서 §9-0): 활성 부문별 1위 구. Phase 1 = 👑·🔥 2종 (chip5 on 시 5종)
export function rollingChips() {
  return activeCategories({ chip: true }).map((cat) => {
    const first = categoryRanking(cat.id)[0];
    return {
      categoryId: cat.id,
      icon: cat.icon, // vibe-icons.svg 심볼 id
      guName: first ? first.name : '집계 중',
    };
  });
}

// 구별 "지금 1위" 태그 id (고정석: 구 중심 고정 — §9-3 v0.5.4).
// 지도 크기와 "같은 지표"(최근 SIZE_WINDOW_DAYS 리액션 수)를 쓴다 — 작은 태그에 1위 배지가 붙는 모순 제거.
// 주간 결산(구 랭킹·5부문·구 레벨·명예의 전당)은 고정 주간(월~일) 그대로 별도 레이어로 유지.
export function topTagIdByGu() {
  const s = getState();
  const result = {};
  s.districts.forEach((d) => {
    let best = null;
    let bestCount = 0; // 최근 리액션 1개 이상이어야 고정석
    let bestAt = 0;
    s.tags.forEach((t) => {
      if (t.guId !== d.guId || t.state !== 'public' || isArchived(t)) return;
      const c = recentReactionCounts(t.id).total;
      // 동률이면 최신 우선 — tagsForMap 정렬(total desc, createdAt desc)과 일치시켜
      // 지도 1위 슬롯과 고정석 배지가 서로 다른 태그에 붙지 않게 한다
      if (c > bestCount || (c === bestCount && c > 0 && t.createdAt > bestAt)) {
        best = t.id; bestCount = c; bestAt = t.createdAt;
      }
    });
    if (best) result[d.guId] = best;
  });
  return result;
}

// 내 기여도 (이번 주)
export function myWeeklyContribution(tossKey) {
  const s = getState();
  const ws = weekStart();
  const myTags = s.tags.filter((t) => t.tossKey === tossKey && t.createdAt >= ws && t.state !== 'deleted');
  const myReactions = s.reactions.filter((r) => r.tossKey === tossKey && r.createdAt >= ws);
  return { tags: myTags.length, reactions: myReactions.length };
}
