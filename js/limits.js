// 하루 제한 (설계서 §6 v0.5.3): 글 2회 / 리액션 15회, 보상형 광고 +2회, 공유 리워드 +3회. 전부 config
import { CONFIG } from './config.js';
import { getState, save } from './store.js';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLimits() {
  const s = getState();
  const key = todayKey();
  if (!s.dailyLimits[key]) s.dailyLimits[key] = { postsUsed: 0, reactionsUsed: 0, adBonus: 0, shareBonus: 0 };
  const l = s.dailyLimits[key];
  if (l.shareBonus === undefined) l.shareBonus = 0; // 구 저장본 마이그레이션
  return l;
}

export function getLimitStatus() {
  const l = todayLimits();
  return {
    postsLeft: CONFIG.DAILY_POST_LIMIT + l.adBonus + l.shareBonus - l.postsUsed,
    reactionsLeft: CONFIG.DAILY_REACTION_LIMIT - l.reactionsUsed,
    adUsed: l.adBonus > 0,
    shareUsed: l.shareBonus > 0,
  };
}

export function canPost() {
  return getLimitStatus().postsLeft > 0;
}

export function canReact() {
  return getLimitStatus().reactionsLeft > 0;
}

export function usePost() {
  todayLimits().postsUsed++;
  save();
}

export function useReaction() {
  todayLimits().reactionsUsed++;
  save();
}

// 보상형 광고 목 — 실제 앱에서는 인앱광고 SDK로 교체. 하루 1회.
export function watchAdForBonus() {
  const l = todayLimits();
  if (l.adBonus > 0) return { ok: false, message: '오늘은 이미 충전했어요.' };
  l.adBonus = CONFIG.AD_BONUS_POSTS;
  save();
  return { ok: true, message: `태그 작성 ${CONFIG.AD_BONUS_POSTS}회가 충전되었어요.` };
}

// 공유 리워드 (§4 초기 활성화, v0.5.3 Phase 1): 친구 초대 시 오늘 글쓰기 +N회. 하루 1회.
// 현금 아닌 앱 내 행동 보상이라 사행성 무관. 실제 앱은 공유 리워드 SDK 성공 콜백에서 호출.
export function claimShareReward() {
  if (!CONFIG.FLAGS.shareReward) return { ok: false, message: '' }; // 플래그 off 시 실행 경로 차단(방어)
  const l = todayLimits();
  if (l.shareBonus > 0) return { ok: false, message: '오늘은 이미 친구 초대로 충전했어요.' };
  l.shareBonus = CONFIG.SHARE_REWARD_POSTS;
  save();
  return { ok: true, message: `친구 초대 완료! 태그 작성 ${CONFIG.SHARE_REWARD_POSTS}회가 충전되었어요.` };
}
