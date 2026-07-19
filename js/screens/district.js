// 구 상세 바텀시트 (설계서 §9-0): 태그 리스트(리액션순/최신순), 주민·방문자 구분, 신고 직접 노출
// 침전 태그·최신순은 지도에 안 보이므로 이 리스트가 커뮤니티 필터 구조의 전제.
import { CONFIG } from './../config.js';
import { getState, getDistrict } from './../store.js';
import { districtFeed } from './../tags.js';
import { addReaction, myReaction } from './../reactions.js';
import { reportTag, REPORT_REASONS } from './../moderation.js';
import { getTossKey } from './../mock-toss.js';
import { toast, escapeHtml, openSheet, reactionPop } from './../ui.js';
import { icon, PIN_ICON } from './../icons.js';
import { weeklyTopTagIdByGu } from './../ranking.js';

let currentGuId = null;
let currentSort = 'popular';
let onDataChange = null;

export function initDistrictSheet(handlers) {
  onDataChange = handlers.onDataChange;
  document.getElementById('sheet-district').addEventListener('click', handleClick);
}

export function openDistrict(guId) {
  currentGuId = guId;
  currentSort = 'popular';
  render();
  openSheet('district');
}

export function refreshDistrict() {
  if (currentGuId) render();
}

function handleClick(e) {
  const sortBtn = e.target.closest('[data-sort]');
  if (sortBtn) { currentSort = sortBtn.dataset.sort; render(); return; }

  const reactBtn = e.target.closest('[data-react]');
  if (reactBtn) {
    const tagId = reactBtn.dataset.tag;
    const type = reactBtn.dataset.react;
    const r = addReaction(tagId, type);
    if (!r.ok) { toast(r.message); return; }
    const rt = CONFIG.REACTION_TYPES.find((x) => x.id === type);
    reactionPop(reactBtn, rt, r.isOnsite); // 누른 리액션 이름 + 현장 ×2 피드백
    render();
    const b = document.querySelector(`#sheet-district [data-tag="${tagId}"][data-react="${type}"]`);
    if (b) { b.classList.remove('reacted'); void b.offsetWidth; b.classList.add('reacted'); }
    onDataChange?.(tagId);
    return;
  }

  const reportBtn = e.target.closest('[data-report]');
  if (reportBtn) {
    const menu = document.getElementById('report-menu-' + reportBtn.dataset.report);
    if (menu) menu.hidden = !menu.hidden;
    return;
  }
  const reasonBtn = e.target.closest('[data-reason]');
  if (reasonBtn) {
    const r = reportTag(reasonBtn.dataset.tagid, getTossKey(), REPORT_REASONS[Number(reasonBtn.dataset.reason)]);
    toast(r.message);
    if (r.ok) { render(); onDataChange?.(reasonBtn.dataset.tagid); }
  }
}

function render() {
  const d = getDistrict(currentGuId);
  if (!d) return;
  const s = getState();
  const feed = districtFeed(currentGuId, currentSort);
  const seatId = weeklyTopTagIdByGu()[currentGuId]; // 이번 주 1위 고정석

  // 고정석·박제는 정렬과 무관하게 리스트 최상단 고정 (지도 §9-3 우선 노출을 리스트에도 반영)
  const seatTag = feed.find((t) => t.id === seatId);
  const stamped = feed.filter((t) => t.hofLocked && t.id !== seatId);
  const rest = feed.filter((t) => t.id !== seatId && !t.hofLocked);
  const ordered = [seatTag, ...stamped, ...rest].filter(Boolean);

  document.getElementById('sheet-district').innerHTML = `
    <div class="sheet-grab"></div>
    <div class="district-head">
      <h2>Lv.${d.level} ${d.name}</h2>
      ${s.user.homeGuId === d.guId ? `<span class="home-badge">${icon(PIN_ICON.home, 13)} 내 홈</span>` : ''}
      <button data-close-sheet aria-label="닫기">✕</button>
    </div>
    <div class="sort-bar">
      <button data-sort="popular" class="${currentSort === 'popular' ? 'active' : ''}">리액션순</button>
      <button data-sort="recent" class="${currentSort === 'recent' ? 'active' : ''}">최신순</button>
    </div>
    <div class="district-feed">
      ${ordered.length ? ordered.map((t) => tagCard(t, seatId)).join('') : '<p class="empty">아직 태그가 없어요. 지도의 빈 곳을 눌러 첫 태그를 남겨주세요!</p>'}
    </div>
    <p class="hint">태그 작성은 지도에서 빈 곳을 터치하면 돼요</p>`;
}

function tagCard(t, seatId) {
  const isSeat = t.id === seatId; // 이번 주 1위 (리액션 O)
  const isStamped = !!t.hofLocked; // 지난주 1위 박제 (리액션 X, §8·§9-3)
  const mine = myReaction(t.id);
  // 박제는 리액션 버튼 제거 → 명예의 전당 라벨로 대체 (팝업과 동일 처리)
  const reactions = isStamped
    ? `<p class="hof-note">${icon('i-trophy', 14)} 명예의 전당 · 리액션할 수 없어요</p>`
    : CONFIG.REACTION_TYPES.map((rt) => {
        const isMine = mine?.type === rt.id;
        return `<button class="react-btn ${isMine ? 'mine' : ''}" data-tag="${t.id}" data-react="${rt.id}">
          ${icon(rt.icon, 15)} ${t.counts[rt.id]}</button>`;
      }).join('');
  const origin = t.isResident
    ? `${icon(PIN_ICON.home, 13)} 주민`
    : `${icon(PIN_ICON.away, 13)} 방문`;
  const rank = isSeat
    ? `<span class="rank-badge seat">${icon('i-crown', 13)} 이번 주 1위</span>`
    : isStamped
    ? `<span class="rank-badge stamped">${icon('i-crown', 13)} 지난주 1위 · 명예의 전당</span>`
    : '';
  const cardCls = isSeat ? ' seat' : isStamped ? ' stamped' : '';
  return `
    <article class="tag-card${cardCls}">
      <div class="tag-card-head">
        <span class="card-meta">${origin}${rank}</span>
        <button class="report-btn" data-report="${t.id}">신고</button>
      </div>
      <p class="tag-text">${escapeHtml(t.text)}</p>
      <div class="tag-card-foot">${reactions}</div>
      <div class="report-menu" id="report-menu-${t.id}" hidden>
        ${REPORT_REASONS.map((r, i) => `<button class="report-reason" data-reason="${i}" data-tagid="${t.id}">${r}</button>`).join('')}
      </div>
    </article>`;
}
