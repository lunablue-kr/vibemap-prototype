// 주간 랭킹·구 레벨 (설계서 §8)
// 출시 시점: 총점 + 급상승 2부문만 활성 (LAUNCH_CATEGORIES). 5부문 로직은 준비 완료.
import { CONFIG } from './config.js';
import { getState } from './store.js';
import { weeklyReactionScore } from './reactions.js';

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

export function activeCategories() {
  return CONFIG.ALL_CATEGORIES.filter((c) => CONFIG.LAUNCH_CATEGORIES.includes(c.id));
}

// 랭킹 롤링 칩 데이터 (설계서 §9-0): 활성 부문별 1위 구. Phase 1 = 👑·🔥 2종
export function rollingChips() {
  return activeCategories().map((cat) => {
    const first = categoryRanking(cat.id)[0];
    return {
      categoryId: cat.id,
      icon: cat.label.split(' ')[0],
      guName: first ? first.name : '—',
    };
  });
}

// 구별 주간 1위 태그 id (자리싸움 고정석: 구 중심 고정 — §9-3)
export function weeklyTopTagIdByGu() {
  const s = getState();
  const ws = weekStart();
  const result = {};
  s.districts.forEach((d) => {
    let best = null;
    let bestScore = -1;
    s.tags.forEach((t) => {
      if (t.guId !== d.guId || t.state !== 'public') return;
      // 실제 점수 기준과 동일하게 현장 2배·주간 캡 반영
      const score = weeklyReactionScore(t.id, ws);
      if (score > bestScore) { best = t.id; bestScore = score; }
    });
    if (best && bestScore > 0) result[d.guId] = best;
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
