// 태그 완전체 카드 팝업 (설계서 §9-1)
// 구성: ① 머리 `○○구 ›` (상세 진입) ② 태그 전문 ③ 리액션 4종 수+버튼 ④ ⋯ → 신고 (한 겹 숨김)
import { CONFIG } from './config.js';
import { getState, getDistrict } from './store.js';
import { addReaction, myReaction, reactionCounts } from './reactions.js';
import { reportTag, REPORT_REASONS } from './moderation.js';
import { getTossKey } from './mock-toss.js';
import { tagScreenPoint } from './map.js';
import { toast, escapeHtml, viewportBox } from './ui.js';

let currentTagId = null;
let onChange = null; // 리액션·신고 후 (지도 단일 갱신 등)
let onOpenDistrict = null;

export function initPopup(handlers) {
  onChange = handlers.onChange;
  onOpenDistrict = handlers.onOpenDistrict;
  document.getElementById('tag-popup').addEventListener('click', handleClick);
  // 지도 탭에 의한 닫힘은 app.js의 오버레이 규칙(닫기만, 액션 없음)에서 일괄 처리
}

export function isPopupOpen() {
  return !document.getElementById('tag-popup').hidden;
}

export function openPopup(tagId) {
  currentTagId = tagId;
  render();
  const el = document.getElementById('tag-popup');
  el.hidden = false;
  positionNearTag(el, tagId);
}

// 카드를 탭한 라벨 옆에 배치 — 실제 보이는 영역(visualViewport) 안으로 클램프
function positionNearTag(el, tagId) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const v = viewportBox();
  const pt = tagScreenPoint(tagId);
  if (!pt) {
    // 지도에 없는 태그면 보이는 영역 하단 중앙 폴백
    el.style.left = Math.max(v.x + (v.w - w) / 2, v.x + 8) + 'px';
    el.style.top = v.y + v.h - h - 24 + 'px';
    return;
  }
  const left = Math.min(Math.max(pt.x - w / 2, v.x + 8), Math.max(v.x + v.w - w - 8, v.x + 8));
  let top = pt.y + 16; // 기본: 라벨 아래
  if (top + h > v.y + v.h - 12) top = pt.y - h - 16; // 아래 공간 없으면 위
  if (top < v.y + 60) top = v.y + 60;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

export function closePopup() {
  document.getElementById('tag-popup').hidden = true;
  document.getElementById('popup-report-menu').hidden = true;
  currentTagId = null;
}

function render() {
  const s = getState();
  const tag = s.tags.find((t) => t.id === currentTagId);
  if (!tag) return;
  const gu = getDistrict(tag.guId);
  const counts = reactionCounts(tag.id);
  const mine = myReaction(tag.id);

  const reactions = CONFIG.REACTION_TYPES.map((rt) => {
    const isMine = mine?.type === rt.id;
    const onsite = isMine && mine.isOnsite ? '📍' : '';
    return `<button class="react-btn ${isMine ? 'mine' : ''}" data-react="${rt.id}">
      ${rt.emoji} ${counts[rt.id]}${onsite}</button>`;
  }).join('');

  document.getElementById('tag-popup').innerHTML = `
    <div class="popup-head">
      <button class="popup-gu" data-gu="${tag.guId}">${gu.name} ›</button>
      <span class="tag-origin">${tag.isResident ? '🏠 주민' : '🚩 방문'}</span>
      <button class="popup-more" data-more aria-label="더보기">⋯</button>
    </div>
    <p class="popup-text">${escapeHtml(tag.text)}</p>
    <div class="popup-reactions">${reactions}</div>
    <div id="popup-report-menu" hidden>
      ${REPORT_REASONS.map((r, i) => `<button class="report-reason" data-reason="${i}">${r}</button>`).join('')}
    </div>`;
}

function handleClick(e) {
  const guBtn = e.target.closest('[data-gu]');
  if (guBtn) {
    closePopup();
    onOpenDistrict?.(guBtn.dataset.gu);
    return;
  }
  const reactBtn = e.target.closest('[data-react]');
  if (reactBtn) {
    const r = addReaction(currentTagId, reactBtn.dataset.react);
    if (!r.ok) { toast(r.message); return; }
    render();
    onChange?.(currentTagId);
    return;
  }
  if (e.target.closest('[data-more]')) {
    const menu = document.getElementById('popup-report-menu');
    menu.hidden = !menu.hidden; // ⋯ 한 겹 숨김 = 실수 신고 방지
    positionNearTag(document.getElementById('tag-popup'), currentTagId); // 높이 변화 반영
    return;
  }
  const reasonBtn = e.target.closest('[data-reason]');
  if (reasonBtn) {
    const reason = REPORT_REASONS[Number(reasonBtn.dataset.reason)];
    const r = reportTag(currentTagId, getTossKey(), reason);
    toast(r.message);
    if (r.ok) { closePopup(); onChange?.(currentTagId); }
  }
}
