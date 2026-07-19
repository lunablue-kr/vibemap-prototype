// 공용 UI 유틸: 토스트, 시트 열기/닫기 (v0.5 IA: 하단 탭 없음, 지도 위 시트 구조)
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

// 현장 리액션 순간 피드백 (§9-1, v0.5.2): 누르는 순간 "현장 ×2!" 액센트 필이 팝 후 소멸.
// 상시 아이콘(📍) 없이 현장 2배를 알림. near = 기준 요소(눌린 버튼)면 그 위에 띄움.
export function onsitePop(near) {
  const el = document.createElement('div');
  el.className = 'onsite-pop';
  el.textContent = '현장 ×2!';
  document.body.appendChild(el);
  const r = near?.getBoundingClientRect?.();
  if (r) {
    el.style.left = r.left + r.width / 2 + 'px';
    el.style.top = r.top - 6 + 'px';
  } else {
    el.style.left = '50%';
    el.style.top = '38%';
  }
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.remove(), 800);
}

const SHEETS = ['district', 'ranking', 'my'];

// 시트는 유저 액션으로만 열림 (진입 즉시 자동 오픈 금지 — 앱인토스 검수)
export function openSheet(name) {
  SHEETS.forEach((s) => {
    document.getElementById('sheet-' + s).classList.toggle('open', s === name);
  });
  document.getElementById('sheet-dim').hidden = false;
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
  SHEETS.forEach((s) => document.getElementById('sheet-' + s).classList.remove('open'));
  document.getElementById('sheet-dim').hidden = true;
}

export function anySheetOpen() {
  return SHEETS.some((s) => document.getElementById('sheet-' + s).classList.contains('open'));
}

// (히스토리 처리) 오버레이 열림/닫힘은 히스토리를 건드리지 않는다.
// 뒤로가기 대응은 app.js의 센티널 트랩이 담당 — UI 열고 닫기와 레이스 없음.

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
