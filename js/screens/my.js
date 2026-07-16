// 마이 화면: 홈 지역구 설정, 오늘 남은 횟수, 광고 충전 (설계서 §9-1번 화면 구성 4)
// 뱃지·포인트·공유 카드는 Phase 2 이후 — 자리만 표시.
import { getState, save, resetAll } from './../store.js';
import { getLimitStatus, watchAdForBonus } from './../limits.js';
import { toast } from './../ui.js';

let onDataChange = null;

export function initMyScreen(handlers) {
  onDataChange = handlers.onDataChange;

  document.getElementById('home-gu-select').addEventListener('change', (e) => {
    const s = getState();
    s.user.homeGuId = e.target.value || null;
    save();
    toast(s.user.homeGuId ? '홈 지역구가 설정되었어요.' : '홈 지역구 설정이 해제되었어요.');
    renderMyScreen();
    onDataChange?.();
  });

  document.getElementById('watch-ad-btn').addEventListener('click', () => {
    const r = watchAdForBonus();
    toast(r.message);
    renderMyScreen();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('프로토타입 데이터를 초기화할까요?')) resetAll();
  });
}

export function renderMyScreen() {
  const s = getState();
  const select = document.getElementById('home-gu-select');
  if (select.options.length <= 1) {
    s.districts
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .forEach((d) => select.add(new Option(d.name, d.guId)));
  }
  select.value = s.user.homeGuId || '';

  const l = getLimitStatus();
  document.getElementById('limit-status').textContent =
    `오늘 남은 횟수 — 글쓰기 ${l.postsLeft}회 · 리액션 ${l.reactionsLeft}회`;
  document.getElementById('watch-ad-btn').disabled = l.adUsed;
}
