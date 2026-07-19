// 리액션 4종 로직 (설계서 §5, §6)
// 어디서나 가능. 현장(그 구에 있거나 홈 구)은 점수 2배 (v0.5.2: 상시 📍 삭제 → 누르는 순간 "현장 ×2!" 피드백). 태그당 유저 1개.
import { CONFIG } from './config.js';
import { getState, save, getDistrict } from './store.js';
import { getTossKey, getCurrentGuId, sendFunctionalMessage } from './mock-toss.js';
import { canReact, useReaction } from './limits.js';

export function myReaction(tagId) {
  const s = getState();
  return s.reactions.find((r) => r.tagId === tagId && r.tossKey === getTossKey()) || null;
}

export function reactionCounts(tagId) {
  const s = getState();
  const counts = { total: 0 };
  CONFIG.REACTION_TYPES.forEach((rt) => { counts[rt.id] = 0; });
  s.reactions.forEach((r) => {
    if (r.tagId !== tagId) return;
    counts[r.type]++;
    counts.total++;
  });
  return counts;
}

// 현장 여부: 리액션 시점에 그 구에 있거나, 홈 구의 태그인 경우
function isOnsite(tagGuId) {
  const s = getState();
  return getCurrentGuId() === tagGuId || s.user.homeGuId === tagGuId;
}

export function addReaction(tagId, type) {
  const s = getState();
  const tag = s.tags.find((t) => t.id === tagId);
  if (!tag) return { ok: false, message: '태그를 찾을 수 없어요.' };
  // Phase 2: 명예의 전당 이월 태그 확정 시 tag.hofLocked 설정 (현재 설정 코드 없음)
  if (tag.hofLocked) return { ok: false, message: '명예의 전당 태그에는 리액션할 수 없어요.' };
  if (myReaction(tagId)) return { ok: false, message: '이미 리액션한 태그예요.' };
  if (!canReact()) return { ok: false, message: '오늘 리액션 횟수를 다 썼어요. 내일 다시 채워져요.' };

  const onsite = isOnsite(tag.guId);
  s.reactions.push({
    tossKey: getTossKey(),
    tagId, type,
    isOnsite: onsite,
    createdAt: Date.now(),
  });
  useReaction();
  save();
  // 기능성 메시지(§9-6 리텐션): 태그가 공감 10개 도달 순간 알림 (목 — 실제는 tag.tossKey 대상 발송)
  const total = reactionCounts(tagId).total;
  if (total === CONFIG.REACTION_MILESTONE) {
    sendFunctionalMessage(`내 태그가 ${getDistrict(tag.guId).name}에서 리액션 ${total}개를 받았어요!`);
  }
  return { ok: true, isOnsite: onsite }; // isOnsite: "현장 ×2!" 순간 피드백용 (§9-1)
}

// 구 점수 계산용: 태그당 주간 리액션 점수 반영 상한 적용 (설계서 §8 악용 방지)
// 1점 균일, 현장 2배, 태그당 주간 CAP개까지만 반영. 표시 수는 캡 없이 계속 증가.
export function weeklyReactionScore(tagId, weekStart) {
  const s = getState();
  const inWeek = s.reactions
    .filter((r) => r.tagId === tagId && r.createdAt >= weekStart)
    .slice(0, CONFIG.WEEKLY_REACTION_SCORE_CAP);
  return inWeek.reduce(
    (sum, r) => sum + CONFIG.SCORE_PER_REACTION * (r.isOnsite ? CONFIG.ONSITE_MULTIPLIER : 1),
    0
  );
}
