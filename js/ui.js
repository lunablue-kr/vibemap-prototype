// 공용 UI 유틸: 토스트, 시트 열기/닫기 (v0.5 IA: 하단 탭 없음, 지도 위 시트 구조)
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

const SHEETS = ['district', 'ranking', 'my'];

// 시트는 유저 액션으로만 열림 (진입 즉시 자동 오픈 금지 — 앱인토스 검수)
export function openSheet(name) {
  SHEETS.forEach((s) => {
    document.getElementById('sheet-' + s).classList.toggle('open', s === name);
  });
  document.getElementById('sheet-dim').hidden = false;
}

export function closeSheets() {
  SHEETS.forEach((s) => document.getElementById('sheet-' + s).classList.remove('open'));
  document.getElementById('sheet-dim').hidden = true;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 실제로 보이는 뷰포트 영역 (페이지가 핀치줌된 상태여도 카드가 화면 안에 오게)
export function viewportBox() {
  const vv = window.visualViewport;
  if (vv) return { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height };
  return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}
