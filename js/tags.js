// 태그 작성·조회 로직 (설계서 §5, §6)
import { CONFIG } from './config.js';
import { getState, save } from './store.js';
import { getTossKey, getCurrentGuId } from './mock-toss.js';
import { checkText } from './moderation.js';
import { canPost, usePost } from './limits.js';
import { reactionCounts } from './reactions.js';

// 글쓰기 자격: 홈 지역구는 위치 무관, 타 지역구는 현재 위치가 그 구일 때만
export function canWriteIn(guId) {
  const s = getState();
  if (s.user.homeGuId === guId) return { ok: true, isResident: true };
  if (getCurrentGuId() === guId) return { ok: true, isResident: false };
  return {
    ok: false,
    message: s.user.homeGuId
      ? '이 동네에 있을 때만 태그를 남길 수 있어요.'
      : '홈 지역구를 설정하거나, 이 동네에 있을 때 태그를 남길 수 있어요.',
  };
}

// 태그 생성. 반환: { ok, message, held? }
export function createTag(guId, lat, lng, text) {
  const eligible = canWriteIn(guId);
  if (!eligible.ok) return eligible;
  if (!canPost()) return { ok: false, message: `오늘 태그 작성 횟수를 다 썼어요. 광고를 보면 ${CONFIG.AD_BONUS_POSTS}회 충전돼요.` };

  const check = checkText(text);
  if (!check.ok) return check;

  const s = getState();
  const tag = {
    id: 'tag-' + Date.now(),
    tossKey: getTossKey(),
    guId, lat, lng,
    text: text.trim(),
    isResident: eligible.isResident,
    state: check.held ? 'held' : 'public', // held = 노출 보류 (부정어 감지)
    createdAt: Date.now(),
  };
  s.tags.push(tag);
  if (check.held) s.moderationQueue.push(tag.id);
  usePost();
  save();

  return {
    ok: true,
    held: !!check.held,
    message: check.held
      ? '등록되었어요. 확인 후 지도에 표시돼요.'
      : '태그가 지도에 표시되었어요!',
  };
}

// 노출 가능한 태그 (공개 상태만. 보류·블라인드·삭제 제외)
export function visibleTags(guId) {
  const s = getState();
  return s.tags.filter((t) => t.state === 'public' && (!guId || t.guId === guId));
}

// 자리싸움 크기 단계 (설계서 §9-3): 합산 3 이상 = 중간, 구 내 상위 10 = 큰 크기
// guRank는 구 내 리액션 합산 순위 (0부터)
export function sizeTier(total, guRank) {
  if (total >= CONFIG.PROMOTE_MID_THRESHOLD && guRank < CONFIG.BIG_TOP_N) return 'big';
  if (total >= CONFIG.PROMOTE_MID_THRESHOLD) return 'mid';
  return 'small';
}

// 지도 표시용: 구별 리액션 합산 순위·크기 단계·최다 리액션 종류 포함
export function tagsForMap() {
  const byGu = {};
  visibleTags().forEach((t) => {
    const counts = reactionCounts(t.id);
    const topType = CONFIG.REACTION_TYPES.reduce(
      (best, rt) => (counts[rt.id] > counts[best.id] ? rt : best),
      CONFIG.REACTION_TYPES[0]
    );
    (byGu[t.guId] = byGu[t.guId] || []).push({ ...t, counts, topType });
  });
  Object.values(byGu).forEach((list) => {
    list.sort((a, b) => b.counts.total - a.counts.total || b.createdAt - a.createdAt);
    list.forEach((t, rank) => {
      t.guRank = rank;
      t.tier = sizeTier(t.counts.total, rank);
    });
  });
  return byGu; // { guId: [순위순 태그] }
}

// 구 상세 피드 정렬 (리액션순/최신순)
export function districtFeed(guId, sort) {
  const list = visibleTags(guId).map((t) => ({ ...t, counts: reactionCounts(t.id) }));
  if (sort === 'popular') list.sort((a, b) => b.counts.total - a.counts.total);
  else list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}
