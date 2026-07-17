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
  notifyOverlayOpened();
}

// 뒤로가기로 닫기 위해 오버레이 열림을 알림 (히스토리 처리는 app.js)
export function notifyOverlayOpened() {
  document.dispatchEvent(new CustomEvent('overlayopened'));
}

// 시트 스와이프 다운 닫기 (그랩바·타이틀 영역에서 아래로 90px 이상 끌면 닫힘)
export function initSheetDrag() {
  SHEETS.forEach((s) => {
    const el = document.getElementById('sheet-' + s);
    let startY = null;
    let dragging = false;
    el.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.sheet-grab, .sheet-title-row, .district-head')) return;
      startY = e.touches[0].clientY;
      dragging = true;
      el.style.transition = 'none';
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dy = Math.max(0, e.touches[0].clientY - startY);
      el.style.transform = `translate(-50%, ${dy}px)`;
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!dragging) return;
      dragging = false;
      el.style.transition = '';
      el.style.transform = '';
      if (e.changedTouches[0].clientY - startY > 90) closeSheets();
    });
  });
}

export function closeSheets() {
  const wasOpen = SHEETS.some((s) => document.getElementById('sheet-' + s).classList.contains('open'));
  SHEETS.forEach((s) => document.getElementById('sheet-' + s).classList.remove('open'));
  document.getElementById('sheet-dim').hidden = true;
  if (wasOpen) consumeOverlayHistory();
}

// 오버레이가 back 이외의 방법으로 닫힐 때, 열림 시 쌓은 히스토리 엔트리를 소모
// (안 하면 시스템 백 버튼이 유령 엔트리만 소모해 "한 번 더 눌러야 나가지는" 버그)
// back()은 비동기라 중복 호출 방지 플래그 필요. popstate로 닫히는 경우엔
// history.state가 이미 null이라 guard에 걸려 아무것도 안 함.
let backPending = false;
window.addEventListener('popstate', () => { backPending = false; });
export function consumeOverlayHistory() {
  if (backPending) return;
  if (history.state?.overlay) {
    backPending = true;
    history.back();
  }
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
