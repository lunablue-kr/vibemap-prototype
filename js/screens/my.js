// 마이 시트 (설계서 §9-0): 홈 지역구 설정(§5 규칙), 잔여 횟수, 뱃지·포인트·공유(Phase 2 자리)
// 데이터 초기화는 개발 바(dev-bar) 전용 — 정식 화면에 두면 홈 쿨다운(§5) 우회 경로가 됨
import { CONFIG } from './../config.js';
import { getState, getDistrict } from './../store.js';
import { getLimitStatus, watchAdForBonus } from './../limits.js';
import { setHome, cooldownLeftDays } from './../home.js';
import { cityName } from './../onboarding.js';
import { toast } from './../ui.js';

let onDataChange = null;

// 마이 아이콘 = 홈 구 이니셜 1자 원형 뱃지 (design-brief.md §7, 프로필 사진 없음)
export function renderMyIcon() {
  const s = getState();
  const home = s.user.homeGuId ? getDistrict(s.user.homeGuId) : null;
  const btn = document.getElementById('my-icon');
  btn.textContent = home ? Array.from(home.name)[0] : '나'; // 홈 미설정 시 '나'
  btn.classList.toggle('no-home', !home);
}

export function initMySheet(handlers) {
  onDataChange = handlers.onDataChange;
  const el = document.getElementById('sheet-my');
  el.addEventListener('click', (e) => {
    if (e.target.id === 'watch-ad-btn') {
      toast(watchAdForBonus().message);
      renderMySheet();
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.id !== 'home-gu-select') return;
    const r = setHome(e.target.value || null);
    toast(r.message);
    renderMySheet();
    renderMyIcon(); // 홈 변경 시 이니셜 뱃지 갱신
    if (r.ok) onDataChange?.();
  });
}

export function renderMySheet() {
  const s = getState();
  const l = getLimitStatus();
  const left = cooldownLeftDays();
  const options = s.districts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((d) => `<option value="${d.guId}" ${s.user.homeGuId === d.guId ? 'selected' : ''}>${d.name}</option>`)
    .join('');

  const origin = s.user.originCity ? cityName(s.user.originCity) : null;

  document.getElementById('sheet-my').innerHTML = `
    <div class="sheet-grab"></div>
    <div class="sheet-title-row"><h2>마이</h2><button data-close-sheet aria-label="닫기">✕</button></div>
    ${origin ? `<div class="my-section region-note">
      <h3>내 지역</h3>
      <p class="hint">${origin} · 열리면 가장 먼저 알려드릴게요. 그때까지 리액션은 어디서든 남길 수 있어요. 서울에 오면 그 동네에 태그도 남겨보세요!</p>
    </div>` : ''}
    <div class="my-section">
      <h3>홈 지역구</h3>
      <p class="hint">홈 지역구에는 어디서든 태그를 남길 수 있어요.<br />
        ${s.user.homeGuId
          ? `그 구에서 한 번 위치를 확인하면 바꿀 수 있어요 · 다음 변경까지 28일${left > 0 ? ` (남은 ${left}일)` : ' (변경 가능)'}`
          : '처음 한 번은 자유롭게 설정할 수 있어요'}</p>
      ${!s.user.homeGuId && !origin ? '<p class="cta-line">아직 홈이 없어요. 우리 동네를 정하고 첫 태그를 남겨보세요!</p>' : ''}
      <select id="home-gu-select">
        <option value="" ${!s.user.homeGuId ? 'selected' : ''}>선택 안 함</option>${options}
      </select>
    </div>
    <div class="my-section">
      <h3>오늘의 활동</h3>
      <p>오늘 남은 횟수 · 태그 작성 ${l.postsLeft}회 · 리액션 ${l.reactionsLeft}회</p>
      <button id="watch-ad-btn" class="btn" ${l.adUsed ? 'disabled' : ''}>광고 보고 태그 ${CONFIG.AD_BONUS_POSTS}회 충전받기</button>
    </div>
    <div class="my-section placeholder">
      <h3>뱃지 · 포인트 · 공유 카드</h3>
      <p class="hint">곧 만나볼 수 있어요</p>
    </div>`;
}
