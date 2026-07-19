// 앱인토스 SDK 목(mock) — 프로토타입 전용.
// 실제 앱에서는 토스 로그인 / startUpdateLocation SDK로 교체한다 (apps-in-toss-sdk 스킬 참조).

const LS_KEY = 'vibemap.mock.location';

// 토스 로그인 식별 키 목
export function getTossKey() {
  return 'mock-user-001';
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
