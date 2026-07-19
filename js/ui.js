// 공용 UI 유틸: 토스트, 시트 열기/닫기 (v0.5 IA: 하단 탭 없음, 지도 위 시트 구조)
import { icon } from './icons.js';

export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

// 리액션 순간 피드백 (§9-1): 누른 리액션 이름(rt.done)을 아이콘과 함께 눌린 버튼 위로 팝.
// 현장(§5)이면 "· 현장 ×2!" 병합. rt = REACTION_TYPES 항목, near = 눌린 버튼.
export function reactionPop(near, rt, isOnsite) {
  const el = document.createElement('div');
  el.className = 'reaction-pop' + (isOnsite ? ' onsite' : '');
  el.innerHTML = `${icon(rt.icon, 15)} ${rt.done}${isOnsite ? ' · 현장 ×2!' : ''}`;
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
  setTimeout(() => el.remove(), 1000);
}

const SHEETS = ['district', 'ranking', 'my'];

// 시트는 유저 액션으로만 열림 (진입 즉시 자동 오픈 금지 — 앱인토스 검수)
export function openSheet(name) {
  SHEETS.forEach((s) => {
    document.getElementById('sheet-' + s).classList.toggle('open', s === name);
  });
  document.getElementById('sheet-dim').hidden = false;
}

// 시트 스와이프 다운 닫기: 그랩바·타이틀에서, 또는 콘텐츠가 최상단(scrollTop 0)일 때
// 아래로 90px 이상 끌면 닫힘 (맨 끝까지 올라간 시트를 한 번 더 당겨 닫는 관례)
export function initSheetDrag() {
  const INTERACTIVE = 'button, select, textarea, input, a, [data-react], [data-report], [data-reason]';
  const THRESHOLD = 8; // 이 이상 내려야 드래그로 인정 (탭 지터가 드래그로 오인되지 않게)
  SHEETS.forEach((s) => {
    const el = document.getElementById('sheet-' + s);
    let startY = null;
    let dragging = false;
    let moved = false;
    const reset = () => { dragging = false; el.style.transition = ''; el.style.transform = ''; };
    el.addEventListener('touchstart', (e) => {
      const onHandle = !!e.target.closest('.sheet-grab, .sheet-title-row, .district-head');
      // 그랩·타이틀은 항상 / 콘텐츠는 최상단일 때만, 단 버튼·셀렉트 등 인터랙티브 요소 탭은 제외
      if (!onHandle && (el.scrollTop > 0 || e.target.closest(INTERACTIVE))) { dragging = false; return; }
      startY = e.touches[0].clientY;
      dragging = true;
      moved = false;
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= THRESHOLD) return; // 임계값 전에는 유예 (탭·미세 이동은 스크롤/클릭에 양보)
      moved = true;
      if (e.cancelable) e.preventDefault(); // 콘텐츠 스크롤·바운스 방지
      el.style.transition = 'none';
      el.style.transform = `translate(-50%, ${dy}px)`;
    }, { passive: false });
    el.addEventListener('touchend', (e) => {
      if (!dragging) return;
      const close = moved && e.changedTouches[0].clientY - startY > 90;
      reset();
      if (close) closeSheets();
    });
    el.addEventListener('touchcancel', reset); // 통화 수신 등 터치 취소 시 위치 복구
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
