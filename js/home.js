// 홈 지역구 설정·변경 규칙 (설계서 §5 v0.5 확정)
// 최초: 1회 자유 설정 (GPS 무관) / 변경: 해당 구에 실제 위치(GPS 1회 검증) + 쿨다운 28일
// 기존 태그의 🏠 표시는 작성 시점 기준 유지 (tags.isResident 불변)
import { CONFIG } from './config.js';
import { getState, save, getDistrict } from './store.js';
import { getCurrentGuId } from './mock-toss.js';

const DAY_MS = 86400000;

export function cooldownLeftDays() {
  const s = getState();
  if (!s.user.homeChangedAt) return 0;
  const elapsed = Date.now() - s.user.homeChangedAt;
  return Math.max(0, Math.ceil(CONFIG.HOME_CHANGE_COOLDOWN_DAYS - elapsed / DAY_MS));
}

// 반환: { ok, message? }
export function canSetHome(guId) {
  const s = getState();
  if (!guId) return { ok: false, message: '홈 지역구는 변경만 가능해요.' }; // 홈 1개 유지
  if (s.user.homeGuId === guId) return { ok: false, message: '이미 홈 지역구예요.' };
  if (!s.user.homeGuId) return { ok: true }; // 최초 설정: 자유

  const left = cooldownLeftDays();
  if (left > 0) {
    return { ok: false, message: `홈 변경은 ${left}일 후에 할 수 있어요.` };
  }
  if (getCurrentGuId() !== guId) {
    // 실제 앱: 위치 SDK로 그 순간 1회 검증
    return { ok: false, message: `${getDistrict(guId).name}에 있을 때 변경할 수 있어요.` };
  }
  return { ok: true };
}

export function setHome(guId) {
  const check = canSetHome(guId);
  if (!check.ok) return check;
  const s = getState();
  const isFirst = !s.user.homeGuId;
  s.user.homeGuId = guId;
  s.user.homeChangedAt = Date.now(); // 최초 설정부터 쿨다운 기산
  save();
  return {
    ok: true,
    message: isFirst
      ? `${getDistrict(guId).name}이(가) 홈 지역구가 되었어요.`
      : `홈 지역구가 ${getDistrict(guId).name}(으)로 바뀌었어요.`,
  };
}
