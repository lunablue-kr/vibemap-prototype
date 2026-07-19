// 마이 시트 (설계서 §9-0): 홈 지역구 설정(§5 규칙), 잔여 횟수, 뱃지·포인트·공유(Phase 2 자리)
// 데이터 초기화는 개발 바(dev-bar) 전용 — 정식 화면에 두면 홈 쿨다운(§5) 우회 경로가 됨
import { CONFIG } from './../config.js';
import { getState, getDistrict } from './../store.js';
import { getLimitStatus, watchAdForBonus, claimShareReward } from './../limits.js';
import { setHome, cooldownLeftDays } from './../home.js';
import { cityName } from './../onboarding.js';
import { shareInvite } from './../mock-toss.js';
import { toast } from './../ui.js';
import { icon } from './../icons.js';
import { computeBadges } from './../badges.js';

let onDataChange = null;

// 마이 아이콘 = 항시 'MY' (사용자 결정 — 홈 구 이니셜 대신 고정. 홈 유무는 배경색으로만 구분)
export function renderMyIcon() {
  const s = getState();
  const btn = document.getElementById('my-icon');
  btn.textContent = 'MY';
  btn.classList.toggle('no-home', !s.user.homeGuId);
}

export function initMySheet(handlers) {
  onDataChange = handlers.onDataChange;
  const el = document.getElementById('sheet-my');
  el.addEventListener('click', (e) => {
    if (e.target.id === 'watch-ad-btn') {
      toast(watchAdForBonus().message);
      renderMySheet();
    }
    // 공유 리워드(§4): 초대 공유 시트(SDK) 성공 시 오늘 글쓰기 +N회. 취소·실패 대비 catch.
    if (e.target.id === 'share-invite-btn') {
      e.target.disabled = true; // 응답 전 연타로 공유 시트 중복 방지
      shareInvite()
        .then(() => { toast(claimShareReward().message); renderMySheet(); })
        .catch(() => { toast('친구 초대가 취소되었어요.'); renderMySheet(); });
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
  const originVotes = origin ? s.regionVotes.filter((v) => v.cityId === s.user.originCity).length : 0;
  const threshold = CONFIG.REGION_OPEN_THRESHOLD;

  // 비서울(무소속 구경꾼)은 서울 홈 선택 대신 "내 지역" 현황을 보여준다 (§5). 서울 유저만 홈 지역구 관리.
  const homeOrRegion = origin
    ? `<div class="my-section region-note">
        <h3>내 지역</h3>
        <p class="hint">${origin} · 열리면 가장 먼저 알려드릴게요.</p>
        <p class="progress-line">${originVotes.toLocaleString('ko-KR')} / ${threshold.toLocaleString('ko-KR')}명 참여 중</p>
        <p class="hint">그때까지 리액션은 어디서든, 서울에 오면 그 동네에 태그도 남길 수 있어요.</p>
      </div>`
    : `<div class="my-section">
        <h3>홈 지역구</h3>
        <p class="hint">홈 지역구에는 어디서든 태그를 남길 수 있어요.<br />
          ${s.user.homeGuId
            ? `그 구에서 한 번 위치를 확인하면 바꿀 수 있어요 · 다음 변경까지 28일${left > 0 ? ` (남은 ${left}일)` : ' (변경 가능)'}`
            : '처음 한 번은 자유롭게 설정할 수 있어요'}</p>
        ${!s.user.homeGuId ? '<p class="cta-line">아직 홈이 없어요. 우리 동네를 정하고 첫 태그를 남겨보세요!</p>' : ''}
        <select id="home-gu-select">
          <option value="" ${!s.user.homeGuId ? 'selected' : ''}>선택 안 함</option>${options}
        </select>
      </div>`;

  document.getElementById('sheet-my').innerHTML = `
    <div class="sheet-grab"></div>
    <div class="sheet-title-row"><h2>마이</h2><button data-close-sheet aria-label="닫기">✕</button></div>
    ${homeOrRegion}
    <div class="my-section">
      <h3>오늘의 활동</h3>
      <p>오늘 남은 횟수 · 태그 작성 ${l.postsLeft}회 · 리액션 ${l.reactionsLeft}회</p>
      <button id="watch-ad-btn" class="btn" ${l.adUsed ? 'disabled' : ''}>광고 보고 태그 ${CONFIG.AD_BONUS_POSTS}회 충전받기</button>
      ${CONFIG.FLAGS.shareReward ? `<button id="share-invite-btn" class="btn accent" ${l.shareUsed ? 'disabled' : ''}>친구 초대하고 태그 ${CONFIG.SHARE_REWARD_POSTS}회 충전받기</button>` : ''}
    </div>
    ${CONFIG.FLAGS.badgeExpansion ? badgeSection() : `<div class="my-section placeholder">
      <h3>뱃지 · 포인트 · 공유 카드</h3>
      <p class="hint">곧 만나볼 수 있어요</p>
    </div>`}`;
}

// 뱃지 확장 (§12 (A)): badgeExpansion 플래그 on일 때만 획득/미획득 그리드로 교체.
// off면 기존 placeholder 유지. 라벨·힌트는 해요체 임시 초안(카피 감수 대상).
function badgeSection() {
  const items = computeBadges().map((b) => `
    <li class="badge-item ${b.earned ? 'earned' : 'locked'}">
      ${icon(b.icon, 28)}
      <span class="badge-label">${b.label}</span>
      <span class="badge-hint">${b.earned ? '받았어요' : b.hint}</span>
    </li>`).join('');
  return `<div class="my-section">
      <h3>내 뱃지</h3>
      <ul class="badge-grid">${items}</ul>
    </div>`;
}
