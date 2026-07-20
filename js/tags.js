// 태그 작성·조회 로직 (설계서 §5, §6)
import { CONFIG } from './config.js';
import { getState, save, isArchived } from './store.js';
import { getTossKey, getCurrentGuId } from './mock-toss.js';
import { checkText } from './moderation.js';
import { canPost, usePost } from './limits.js';
import { reactionCounts, recentReactionCounts } from './reactions.js';

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
  // 첫 태그 축하 (§4 초기 활성화): 지도에 실제 표시되는 첫 태그(공개)에만 1회성 트리거
  const firstTag = !check.held && !s.user.firstTagDone;
  if (firstTag) s.user.firstTagDone = true;
  save();

  return {
    ok: true,
    held: !!check.held,
    firstTag,
    id: tag.id,
    guId,
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

// 자리싸움 크기 단계 (설계서 §9-3 v0.5.4): 기준 수치는 "최근 SIZE_WINDOW_DAYS 리액션 수"(누적 아님).
// count 기반 3단계 — 인기가 크기로 그대로 드러나게(구 내 순위 기반이던 것을 v0.5.4에서 변경).
export function sizeTier(total) {
  if (total >= CONFIG.PROMOTE_BIG_THRESHOLD) return 'big';
  if (total >= CONFIG.PROMOTE_MID_THRESHOLD) return 'mid';
  return 'small';
}

// 지도 표시용 (§9-3 v0.5.4): 아카이브 태그는 지도에서 제외.
// 크기·구 내 순위·최다 리액션 아이콘은 전부 "최근 SIZE_WINDOW_DAYS" 기준 — 롤링이라 절벽 없이
// 반응이 끊기면 자연 침전한다. 누적 수치는 팝업·구 상세(기록)에서만 쓴다.
export function tagsForMap() {
  const byGu = {};
  visibleTags().filter((t) => !isArchived(t)).forEach((t) => {
    const counts = recentReactionCounts(t.id);
    const topType = CONFIG.REACTION_TYPES.reduce(
      (best, rt) => (counts[rt.id] > counts[best.id] ? rt : best),
      CONFIG.REACTION_TYPES[0]
    );
    (byGu[t.guId] = byGu[t.guId] || []).push({ ...t, counts, topType });
  });
  Object.values(byGu).forEach((list) => {
    list.sort((a, b) => b.counts.total - a.counts.total || b.createdAt - a.createdAt);
    list.forEach((t, rank) => {
      t.guRank = rank; // 노출 순위(cap·prefix)용 — 크기는 count 기반이라 rank 무관
      t.tier = sizeTier(t.counts.total);
    });
  });
  return byGu; // { guId: [순위순 태그] }
}

// 구 상세 피드 = 활성 태그만 (리액션순/최신순). 표시 수치는 누적(그 태그의 기록)
export function districtFeed(guId, sort) {
  const list = visibleTags(guId)
    .filter((t) => !isArchived(t))
    .map((t) => ({ ...t, counts: reactionCounts(t.id) }));
  if (sort === 'popular') list.sort((a, b) => b.counts.total - a.counts.total);
  else list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

// 지난 기록 = 활성 기간이 끝나 잠긴 태그. 지도에선 내려가고 구 상세에만 남는다 (최신순)
export function archivedTags(guId) {
  return visibleTags(guId)
    .filter((t) => isArchived(t))
    .map((t) => ({ ...t, counts: reactionCounts(t.id) }))
    .sort((a, b) => b.createdAt - a.createdAt);
}
