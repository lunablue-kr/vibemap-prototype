// 온보딩 (설계서 §5 v0.5.3): 첫 실행 1회 강제 — ① 간단 튜토리얼 → ② 서울/비서울 선택.
// 비서울 → 출신 지역 선택 → region_votes(오픈 투표) 기록 + "○○이 열리면 알려드릴게요".
// 출신 지역 선택은 홈 설정이 아님. 홈 없는 유저: 홈 태그 불가 / 리액션 어디서나 / 서울 방문 시 원정 태그.
// 서울/비서울 답은 홈 로직의 전제라 스킵 불가(라우팅 필수). 프로모 바텀시트가 아닌 필수 온보딩 카드(§9-0).
// 토스 로그인은 여기서 안 받음 — 구경은 무마찰, 첫 기여(글쓰기·리액션) 시점에 게이트(§2 가입 마찰 제거·§4).
import { CONFIG } from './config.js';
import { getState, save } from './store.js';
import { icon } from './icons.js';

let onDone = null;

export function initOnboarding(handlers = {}) {
  onDone = handlers.onDone;
  const s = getState();
  if (s.user.onboarded && !CONFIG.DEV_FORCE_ONBOARDING) return; // 완료 시 재노출 금지(테스트 플래그면 매번 노출)
  const el = document.getElementById('onboarding');
  el.hidden = false;
  el.addEventListener('click', handleClick);
  renderTutorial();
}

// 카드 교체. 페이드 인은 .onboard-card CSS 애니메이션이 마운트 시 자동 처리(rAF 의존 없음).
function paint(html) {
  document.getElementById('onboarding').innerHTML = html;
}

// ① 튜토리얼 — 앱을 어떻게 즐기는지 3가지 (brief §1 요소 절제)
function renderTutorial() {
  const row = (ic, title, desc) => `
    <li class="onboard-tip">${icon(ic, 26)}<div><b>${title}</b><span>${desc}</span></div></li>`;
  paint(`
    <div class="onboard-card">
      <h2 class="onboard-title">우리동네 바이브</h2>
      <p class="onboard-sub">동네의 감정이 지도에 스며들어요.</p>
      <ul class="onboard-tips">
        ${row('i-hip', '지도로 구경해요', '어느 동네가 어떤 감정으로 뜨는지 한눈에 볼 수 있어요')}
        ${row('i-home', '빈 곳을 눌러 남겨요', '지금 이 동네의 한마디를 태그로 남겨요')}
        ${row('i-like', '리액션으로 마음을 표현해요', '마음에 드는 태그에 리액션을 남겨요')}
      </ul>
      <div class="onboard-actions">
        <button class="btn primary" data-onboard="next">시작하기</button>
      </div>
    </div>`);
}

// ② 서울/비서울 선택 (스킵 없음 — 홈 라우팅 필수)
function renderStep1() {
  paint(`
    <div class="onboard-card">
      <p class="onboard-emoji">${icon('i-home', 40)}</p>
      <h2 class="onboard-title">서울에 사세요?</h2>
      <p class="onboard-sub">우리 동네를 홈으로 정하면 어디서든 태그를 남길 수 있어요.</p>
      <div class="onboard-actions">
        <button class="btn primary" data-onboard="seoul">네, 서울에 살아요</button>
        <button class="btn" data-onboard="outside">아니요, 다른 지역이에요</button>
      </div>
    </div>`);
}

function renderStep2() {
  const chips = CONFIG.ORIGIN_CITIES
    .map((c) => `<button class="onboard-city" data-city="${c.id}">${c.name}</button>`)
    .join('');
  paint(`
    <div class="onboard-card">
      <h2 class="onboard-title">지금은 서울만 열려 있어요</h2>
      <p class="onboard-sub">어느 지역에서 오셨어요? 열리면 가장 먼저 알려드릴게요.</p>
      <div class="onboard-cities">${chips}</div>
    </div>`);
}

function handleClick(e) {
  const step = e.target.closest('[data-onboard]');
  if (step) {
    const v = step.dataset.onboard;
    if (v === 'next') renderStep1(); // 튜토리얼 → 서울 선택
    else if (v === 'seoul') finishSeoul();
    else renderStep2(); // outside
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
