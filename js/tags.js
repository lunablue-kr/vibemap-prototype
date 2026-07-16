// 태그 작성·조회 로직 (설계서 §5, §6)
import { CONFIG } from './config.js';
import { getState, save, getDistrict } from './store.js';
import { getTossKey, getCurrentGuId, sendFunctionalMessage } from './mock-toss.js';
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
      ? '이 동네에 있을 때만 글을 남길 수 있어요.'
      : '홈 지역구를 설정하거나, 이 동네에 있을 때 글을 남길 수 있어요.',
  };
}

// 태그 생성. 반환: { ok, message, held? }
export function createTag(guId, lat, lng, text) {
  const eligible = canWriteIn(guId);
  if (!eligible.ok) return eligible;
  if (!canPost()) return { ok: false, message: '오늘 글쓰기 횟수를 다 썼어요. 광고를 보면 3회 충전돼요.' };

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

// 승격: 리액션 4종 합산이 임계값 이상이면 지도에 크게 표시 (설계서 §7, §8)
export function isPromoted(tag) {
  const c = reactionCounts(tag.id);
  return c.total >= CONFIG.PROMOTE_THRESHOLD;
}

// 지도에 표시할 태그: 승격(리액션 합산 임계값 이상) 여부 포함
export function tagsForMap() {
  return visibleTags().map((t) => ({ ...t, promoted: isPromoted(t), counts: reactionCounts(t.id) }));
}

// 구 상세 피드 정렬
export function districtFeed(guId, sort) {
  const list = visibleTags(guId).map((t) => ({ ...t, counts: reactionCounts(t.id), promoted: isPromoted(t) }));
  if (sort === 'popular') list.sort((a, b) => b.counts.total - a.counts.total);
  else list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

// 공감 알림 목 (기능성 메시지 — 설계서 §9-1)
export function notifyReactionMilestone(tag) {
  const c = reactionCounts(tag.id);
  if (c.total === 10) {
    const gu = getDistrict(tag.guId);
    sendFunctionalMessage(`내 태그가 ${gu.name}에서 공감 10개를 받았어요!`);
  }
}
