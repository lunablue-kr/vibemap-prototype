// 태그 완전체 카드 팝업 (설계서 §9-1)
// 구성: ① 머리 `○○구 ›` (상세 진입) ② 태그 전문 ③ 리액션 4종 수+버튼 ④ ⋯ → 신고 (한 겹 숨김)
import { CONFIG } from './config.js';
import { getState, getDistrict } from './store.js';
import { addReaction, myReaction, reactionCounts } from './reactions.js';
import { reportTag, REPORT_REASONS } from './moderation.js';
import { getTossKey } from './mock-toss.js';
import { tagScreenPoint } from './map.js';
import { toast, escapeHtml, viewportBox, reactionPop } from './ui.js';
import { icon, PIN_ICON } from './icons.js';
import { weeklyTopTagIdByGu } from './ranking.js';
import { isHof } from './phase2.js';

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
  requestAnimationFrame(() => el.classList.add('show')); // 페이드 인 (brief §2)
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
  const menu = document.getElementById('popup-report-menu'); // 팝업 첫 렌더 전엔 없음
  if (menu) menu.hidden = true;
  currentTagId = null;
}

function render() {
  const s = getState();
  const tag = s.tags.find((t) => t.id === currentTagId);
  if (!tag) return;
  const gu = getDistrict(tag.guId);
  const counts = reactionCounts(tag.id);
  const mine = myReaction(tag.id);

  const isSeat = weeklyTopTagIdByGu()[tag.guId] === tag.id; // 현재 주 1위 고정석
  const isStamped = isHof(tag); // 지난주 1위 박제 (명예의 전당) — hallOfFame 플래그 게이트

  // 박제(hofLocked)는 리액션 불가 — 버튼 자체를 제거 (설계서 §8·§9-3, 공감 인플레 방지)
  const reactions = isStamped
    ? `<p class="popup-hof">${icon('i-trophy', 15)} 명예의 전당 · 리액션할 수 없어요</p>`
    : CONFIG.REACTION_TYPES.map((rt) => {
        const isMine = mine?.type === rt.id;
        return `<button class="react-btn ${isMine ? 'mine' : ''}" data-react="${rt.id}">
          ${icon(rt.icon, 16)} ${counts[rt.id]}</button>`;
      }).join('');

  const origin = tag.isResident
    ? `${icon(PIN_ICON.home, 14)} 주민`
    : `${icon(PIN_ICON.away, 14)} 방문`;
  const crown = (isSeat || isStamped) ? `<span class="popup-crown">${icon('i-crown', 16)}</span>` : ''; // 이번주·지난주 1위 둘 다 왕관 (brief §7)
  const el = document.getElementById('tag-popup');
  el.className = 'popup-card' + (isStamped ? ' stamped' : isSeat ? ' seat' : '') + (el.hidden ? '' : ' show');
  el.innerHTML = `
    <div class="popup-head">
      ${crown}
      <button class="popup-gu" data-gu="${tag.guId}">${gu.name} ›</button>
      <span class="tag-origin">${origin}</span>
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
    const type = reactBtn.dataset.react;
    const r = addReaction(currentTagId, type);
    if (!r.ok) { toast(r.message); return; }
    const rt = CONFIG.REACTION_TYPES.find((x) => x.id === type);
    reactionPop(reactBtn, rt, r.isOnsite); // 누른 리액션 이름 + 현장 ×2 피드백 (§9-1)
    render();
    // 방금 반영된 버튼 탱글 팝
    const b = document.querySelector(`#tag-popup [data-react="${type}"]`);
    if (b) { b.classList.remove('reacted'); void b.offsetWidth; b.classList.add('reacted'); }
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
