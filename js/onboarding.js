// 온보딩 (설계서 §5 v0.5.3): 비서울 유저 = "홈 없음(무소속 구경꾼)" 분기.
// "서울에 사세요?" → 아니오 → 출신 지역 선택 → region_votes(오픈 투표) 기록 + "○○이 열리면 알려드릴게요".
// 출신 지역 선택은 홈 설정이 아님. 홈 없는 유저: 홈 태그 불가 / 리액션 어디서나 / 서울 방문 시 원정 태그.
// 첫 실행 1회. 자동 오픈되는 건 프로모 바텀시트가 아니라 필수 온보딩 카드(검수 다크패턴 무관, §9-0).
import { CONFIG } from './config.js';
import { getState, save } from './store.js';
import { icon } from './icons.js';

let onDone = null;

export function initOnboarding(handlers = {}) {
  onDone = handlers.onDone;
  const s = getState();
  if (s.user.onboarded) return; // 이미 완료 — 재노출 금지
  const el = document.getElementById('onboarding');
  el.hidden = false;
  el.addEventListener('click', handleClick);
  renderStep1();
}

function renderStep1() {
  document.getElementById('onboarding').innerHTML = `
    <div class="onboard-card">
      <p class="onboard-emoji">${icon('i-home', 40)}</p>
      <h2 class="onboard-title">서울에 사세요?</h2>
      <p class="onboard-sub">우리 동네를 홈으로 정하면 어디서든 태그를 남길 수 있어요.</p>
      <div class="onboard-actions">
        <button class="btn primary" data-onboard="seoul">네, 서울에 살아요</button>
        <button class="btn" data-onboard="outside">아니요, 다른 지역이에요</button>
      </div>
    </div>`;
}

function renderStep2() {
  const chips = CONFIG.ORIGIN_CITIES
    .map((c) => `<button class="onboard-city" data-city="${c.id}">${c.name}</button>`)
    .join('');
  document.getElementById('onboarding').innerHTML = `
    <div class="onboard-card">
      <h2 class="onboard-title">지금은 서울만 열려 있어요</h2>
      <p class="onboard-sub">어느 지역에서 오셨어요? 열리면 가장 먼저 알려드릴게요.</p>
      <div class="onboard-cities">${chips}</div>
    </div>`;
}

function handleClick(e) {
  const step1 = e.target.closest('[data-onboard]');
  if (step1) {
    if (step1.dataset.onboard === 'seoul') finishSeoul();
    else renderStep2();
    return;
  }
  const city = e.target.closest('[data-city]');
  if (city) finishOutside(city.dataset.city);
}

function finishSeoul() {
  const s = getState();
  s.user.onboarded = true;
  s.user.originCity = null;
  save();
  close();
}

function finishOutside(cityId) {
  const s = getState();
  s.user.onboarded = true;
  s.user.originCity = cityId; // 홈 아님 — 출신 지역만 기록
  s.regionVotes.push({ cityId, at: Date.now() }); // 오픈 투표 (§5)
  save();
  close();
}

function cityName(cityId) {
  return CONFIG.ORIGIN_CITIES.find((c) => c.id === cityId)?.name || '';
}

function close() {
  const el = document.getElementById('onboarding');
  el.hidden = true;
  el.removeEventListener('click', handleClick);
  el.innerHTML = '';
  onDone?.();
}

export { cityName };
