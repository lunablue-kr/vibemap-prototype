// 하루 제한: 글 3회 / 리액션 20회, 보상형 광고 시청 시 글 +3회 (설계서 §6)
import { CONFIG } from './config.js';
import { getState, save } from './store.js';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayLimits() {
  const s = getState();
  const key = todayKey();
  if (!s.dailyLimits[key]) s.dailyLimits[key] = { postsUsed: 0, reactionsUsed: 0, adBonus: 0 };
  return s.dailyLimits[key];
}

export function getLimitStatus() {
  const l = todayLimits();
  return {
    postsLeft: CONFIG.DAILY_POST_LIMIT + l.adBonus - l.postsUsed,
    reactionsLeft: CONFIG.DAILY_REACTION_LIMIT - l.reactionsUsed,
    adUsed: l.adBonus > 0,
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
  return { ok: true, message: `글쓰기 ${CONFIG.AD_BONUS_POSTS}회가 충전되었어요.` };
}
