// 온보딩 (설계서 §5 v0.5.3): 첫 실행 1회 강제 — ① 튜토리얼 → ② 서울/비서울 선택.
// 서울 → 우리 동네(홈 구) 선택(§5 최초 자유 설정). 비서울 → 출신 지역 → region_votes(오픈 투표) 기록 +
//   "N명 모이면 열려요" 오픈 조건 공개(참여·공유 유도, §5) + 비서울 유저가 지금 할 수 있는 것 안내.
// 홈 없는 유저: 홈 태그 불가 / 리액션 어디서나 / 서울 방문 시 원정 태그. 스킵 불가(라우팅 필수, §9-0 자동 프로모 아님).
// 토스 로그인은 여기서 안 받음 — 구경은 무마찰, 첫 기여 시점에 게이트(§2·§4).
import { CONFIG } from './config.js';
import { getState, save } from './store.js';
import { setHome } from './home.js';
import { shareContent } from './mock-toss.js';
import { icon } from './icons.js';
import { toast } from './ui.js';

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
  const chips = CONFIG.ORIGIN_CITIES.slice()
    .sort((a, b) => (a.id === 'etc' ? 1 : b.id === 'etc' ? -1 : a.name.localeCompare(b.name, 'ko'))) // 가나다, '그 외' 마지막
    .map((c) => `<button class="onboard-city" data-city="${c.id}">${c.name}</button>`)
    .join('');
  paint(`
    <div class="onboard-card">
      <h2 class="onboard-title">지금은 서울만 열려 있어요</h2>
      <p class="onboard-sub">어느 지역에서 오셨어요? 열리면 가장 먼저 알려드릴게요.</p>
      <div class="onboard-cities scroll">${chips}</div>
    </div>`);
}

// ③-서울: 우리 동네(홈 구) 선택 — §5 최초 1회 자유 설정(GPS 무관)
function renderHomePicker() {
  const gus = getState().districts.slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((d) => `<button class="onboard-city" data-home="${d.guId}">${d.name}</button>`)
    .join('');
  paint(`
    <div class="onboard-card">
      <h2 class="onboard-title">우리 동네는 어디예요?</h2>
      <p class="onboard-sub">홈 지역구에는 어디서든 태그를 남길 수 있어요.<br />바꿀 땐 그 동네에 가서 한 번 확인하면 되고, 28일에 한 번 옮길 수 있어요.</p>
      <div class="onboard-cities scroll">${gus}</div>
    </div>`);
}

// ③-비서울: 오픈 조건 공개 + 지금 할 수 있는 것 (참여·공유 유도, §5)
function renderRegionInfo(cityId) {
  const name = cityName(cityId);
  const n = CONFIG.REGION_OPEN_THRESHOLD.toLocaleString('ko-KR');
  const can = (ic, t, d) => `<li class="onboard-tip">${icon(ic, 22)}<div><b>${t}</b><span>${d}</span></div></li>`;
  paint(`
    <div class="onboard-card">
      <p class="onboard-emoji">${icon('i-flag', 40)}</p>
      <h2 class="onboard-title">${name}, 곧 만나요!</h2>
      <p class="onboard-sub">${name}에서 ${n}명이 모이면 열려요. 방금 표를 보탰어요!</p>
      <ul class="onboard-tips">
        ${can('i-like', '리액션은 어디서든', '어느 동네 태그든 마음을 표현할 수 있어요')}
        ${can('i-flag', '서울에 가면 태그도', '그 동네에 있을 때 방문 태그를 남길 수 있어요')}
      </ul>
      <div class="onboard-actions">
        <button class="btn accent" data-onboard="share">친구에게 알리기</button>
        <button class="btn" data-onboard="done">둘러보기</button>
      </div>
    </div>`);
}

function handleClick(e) {
  const step = e.target.closest('[data-onboard]');
  if (step) {
    const v = step.dataset.onboard;
    if (v === 'next') renderStep1(); // 튜토리얼 → 서울 선택
    else if (v === 'seoul') renderHomePicker(); // 서울 → 홈 구 선택
    else if (v === 'outside') renderStep2(); // 비서울 → 출신 지역
    else if (v === 'share') shareRegion(step);
    else if (v === 'done') close();
    return;
  }
  const homeBtn = e.target.closest('[data-home]');
  if (homeBtn) { finishSeoul(homeBtn.dataset.home); return; }
  const city = e.target.closest('[data-city]');
  if (city) selectOrigin(city.dataset.city);
}

// 서울 유저: 홈 구 확정(§5 최초 자유) 후 완료
function finishSeoul(guId) {
  const s = getState();
  setHome(guId); // 최초 설정 = 자유(GPS 무관), homeChangedAt 기산
  s.user.onboarded = true;
  s.user.originCity = null;
  save();
  close();
}

// 비서울 유저: 출신 지역 = 오픈 투표 기록(홈 아님) → 오픈 안내 화면
let pendingCity = null;
function selectOrigin(cityId) {
  const s = getState();
  s.user.onboarded = true;
  s.user.originCity = cityId;
  s.regionVotes.push({ cityId, at: Date.now() }); // 오픈 투표 (§5)
  save();
  pendingCity = cityId;
  renderRegionInfo(cityId);
}

function shareRegion(btn) {
  const name = cityName(pendingCity);
  btn.disabled = true; // 응답 전 연타로 공유 시트 중복 방지
  shareContent(`${name}에 우리동네 바이브를 열어주세요! ${CONFIG.REGION_OPEN_THRESHOLD.toLocaleString('ko-KR')}명이 모이면 열려요.`)
    .then(() => { toast('공유했어요. 함께하면 더 빨리 열려요!'); close(); })
    .catch(() => { btn.disabled = false; }); // 취소·실패 시 다시 시도 가능
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
