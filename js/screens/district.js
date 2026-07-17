// 구 상세 바텀시트 (설계서 §9-0): 태그 리스트(리액션순/최신순), 주민·방문자 구분, 신고 직접 노출
// 침전 태그·최신순은 지도에 안 보이므로 이 리스트가 커뮤니티 필터 구조의 전제.
import { CONFIG } from './../config.js';
import { getState, getDistrict } from './../store.js';
import { districtFeed } from './../tags.js';
import { addReaction, myReaction } from './../reactions.js';
import { reportTag, REPORT_REASONS } from './../moderation.js';
import { getTossKey } from './../mock-toss.js';
import { toast, escapeHtml, openSheet } from './../ui.js';

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
    const r = addReaction(reactBtn.dataset.tag, reactBtn.dataset.react);
    if (!r.ok) { toast(r.message); return; }
    render();
    onDataChange?.(reactBtn.dataset.tag);
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

  document.getElementById('sheet-district').innerHTML = `
    <div class="sheet-grab"></div>
    <div class="district-head">
      <h2>${d.name} Lv.${d.level}</h2>
      ${s.user.homeGuId === d.guId ? '<span class="home-badge">🏠 내 홈</span>' : ''}
    </div>
    <div class="sort-bar">
      <button data-sort="popular" class="${currentSort === 'popular' ? 'active' : ''}">리액션순</button>
      <button data-sort="recent" class="${currentSort === 'recent' ? 'active' : ''}">최신순</button>
    </div>
    <div class="district-feed">
      ${feed.length ? feed.map(tagCard).join('') : '<p class="empty">아직 태그가 없어요. 지도의 빈 곳을 눌러 첫 이야기를 남겨주세요!</p>'}
    </div>
    <p class="hint">글쓰기는 지도에서 빈 곳을 터치하면 돼요</p>`;
}

function tagCard(t) {
  const mine = myReaction(t.id);
  const reactions = CONFIG.REACTION_TYPES.map((rt) => {
    const isMine = mine?.type === rt.id;
    const onsite = isMine && mine.isOnsite ? '📍' : '';
    return `<button class="react-btn ${isMine ? 'mine' : ''}" data-tag="${t.id}" data-react="${rt.id}">
      ${rt.emoji} ${t.counts[rt.id]}${onsite}</button>`;
  }).join('');
  return `
    <article class="tag-card">
      <div class="tag-card-head">
        <span class="tag-origin">${t.isResident ? '🏠 주민' : '🚩 방문'}</span>
        <button class="report-btn" data-report="${t.id}">신고</button>
      </div>
      <p class="tag-text">${escapeHtml(t.text)}</p>
      <div class="tag-card-foot">${reactions}</div>
      <div class="report-menu" id="report-menu-${t.id}" hidden>
        ${REPORT_REASONS.map((r, i) => `<button class="report-reason" data-reason="${i}" data-tagid="${t.id}">${r}</button>`).join('')}
      </div>
    </article>`;
}
