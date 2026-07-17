// 마이 시트 (설계서 §9-0): 홈 지역구 설정(§5 규칙), 잔여 횟수, 뱃지·포인트·공유(Phase 2 자리)
// 데이터 초기화는 개발 바(dev-bar) 전용 — 정식 화면에 두면 홈 쿨다운(§5) 우회 경로가 됨
import { getState } from './../store.js';
import { getLimitStatus, watchAdForBonus } from './../limits.js';
import { setHome, cooldownLeftDays } from './../home.js';
import { toast } from './../ui.js';

let onDataChange = null;

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

  document.getElementById('sheet-my').innerHTML = `
    <div class="sheet-grab"></div>
    <div class="sheet-title-row"><h2>마이</h2><button data-close-sheet aria-label="닫기">✕</button></div>
    <div class="my-section">
      <h3>홈 지역구</h3>
      <p class="hint">홈 지역구에는 어디서든 태그를 남길 수 있어요.<br />
        ${s.user.homeGuId
          ? `변경: 그 구에 있을 때 1회 위치 확인 · 쿨다운 28일${left > 0 ? ` (남은 ${left}일)` : ' (변경 가능)'}`
          : '처음 한 번은 자유롭게 설정할 수 있어요'}</p>
      <select id="home-gu-select">
        <option value="" ${!s.user.homeGuId ? 'selected' : ''}>선택 안 함</option>${options}
      </select>
    </div>
    <div class="my-section">
      <h3>오늘의 활동</h3>
      <p>오늘 남은 횟수 — 글쓰기 ${l.postsLeft}회 · 리액션 ${l.reactionsLeft}회</p>
      <button id="watch-ad-btn" class="btn" ${l.adUsed ? 'disabled' : ''}>광고 보고 글쓰기 3회 충전</button>
    </div>
    <div class="my-section placeholder">
      <h3>뱃지 · 포인트 · 공유 카드</h3>
      <p class="hint">Phase 2에서 열려요</p>
    </div>`;
}
