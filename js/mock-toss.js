// 앱인토스 SDK 목(mock) — 프로토타입 전용.
// 실제 앱에서는 토스 로그인 / startUpdateLocation SDK로 교체한다 (apps-in-toss-sdk 스킬 참조).
import { getState, save } from './store.js';

const LS_KEY = 'vibemap.mock.location';

// 토스 로그인 식별 키 목 (실제: appLogin 인가코드 → 서버 교환. getAnonymousKey는 제재·중복방지 불가라 부적합)
export function getTossKey() {
  return 'mock-user-001';
}

// 로그인 상태 (첫 기여 시점 게이트 — §2 가입 마찰 제거: 구경은 무마찰, 쓸 때만 로그인)
export function isLoggedIn() {
  return !!getState().user.loggedIn;
}

// 토스 로그인 목 — 실제는 앱인토스 appLogin(동의 시트 → 인가코드). 중복방지·유저 제재의 근거 식별키.
export function appLogin() {
  console.info('[토스 로그인 목] appLogin 동의 시트 → 성공');
  return Promise.resolve({ ok: true });
}

// 기여(글쓰기·리액션) 직전 호출: 미로그인 시 로그인 시트를 띄우고 성공 시 true. 취소·실패 시 false.
// 진행 중 재호출은 같은 프로미스 반환(동의 시트 중복·중복 재생 방지).
let loginInFlight = null;
export function requireLogin() {
  if (isLoggedIn()) return Promise.resolve(true);
  if (loginInFlight) return loginInFlight;
  loginInFlight = appLogin()
    .then((r) => {
      if (!r?.ok) return false;
      getState().user.loggedIn = true;
      save();
      return true;
    })
    .catch(() => false)
    .finally(() => { loginInFlight = null; });
  return loginInFlight;
}

// 현재 위치 시뮬레이션: 개발용 바에서 선택한 구 id를 현재 위치로 간주
export function getCurrentGuId() {
  return localStorage.getItem(LS_KEY) || null;
}

export function setCurrentGuId(guId) {
  if (guId) localStorage.setItem(LS_KEY, guId);
  else localStorage.removeItem(LS_KEY);
}

// 기능성 메시지 API 목 — 콘솔 + 토스트로 대체
export function sendFunctionalMessage(text) {
  console.info('[기능성 메시지 목]', text);
}

// 공유 리워드 SDK 목 (§4·§9-6 v0.5.3 Phase 1) — 실제 앱은 앱인토스 공유 리워드 SDK.
// 친구 초대 공유 시트를 띄우고 성공 시 resolve. 목은 즉시 성공 반환.
export function shareInvite() {
  console.info('[공유 리워드 SDK 목] 친구 초대 공유 시트 → 성공');
  return Promise.resolve({ shared: true });
}

// 공유하기 SDK 목 (§9-6 바이럴) — 지역 오픈 투표 독려 등 일반 공유. 리워드와 별개.
export function shareContent(text) {
  console.info('[공유하기 SDK 목] 공유 시트:', text);
  return Promise.resolve({ shared: true });
}
