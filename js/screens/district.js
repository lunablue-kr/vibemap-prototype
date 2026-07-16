// 구 상세 화면: 태그 피드(공감순/최신순), 글쓰기, 주민·방문자 구분 (설계서 §9-1번 화면 구성 2)
import { CONFIG } from './../config.js';
import { getState, getDistrict } from './../store.js';
import { districtFeed, canWriteIn } from './../tags.js';
import { addReaction, myReaction } from './../reactions.js';
import { reportTag, REPORT_REASONS } from './../moderation.js';
import { getTossKey } from './../mock-toss.js';
import { toast, escapeHtml } from './../ui.js';

let currentGuId = null;
let currentSort = 'popular';
let onWriteRequest = null;
let onDataChange = null;

export function initDistrictScreen(handlers) {
  onWriteRequest = handlers.onWriteRequest;
  onDataChange = handlers.onDataChange;
  document.getElementById('district-sort').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sort]');
    if (!btn) return;
    currentSort = btn.dataset.sort;
    render();
  });
  document.getElementById('district-write-btn').addEventListener('click', () => {
    onWriteRequest?.(currentGuId);
  });
  document.getElementById('district-back').addEventListener('click', handlers.onBack);
  document.getElementById('district-feed').addEventListener('click', handleFeedClick);
}

export function openDistrict(guId) {
  currentGuId = guId;
  render();
}

// 열려 있는 구 상세를 데이터 변경 후 다시 그림
export function refreshDistrict() {
  if (currentGuId) render();
}

function handleFeedClick(e) {
  const reactBtn = e.target.closest('[data-react]');
  if (reactBtn) {
    const r = addReaction(reactBtn.dataset.tag, reactBtn.dataset.react);
    if (!r.ok) { toast(r.message); return; }
    render();
    onDataChange?.();
    return;
  }
  const reportBtn = e.target.closest('[data-report]');
  if (reportBtn) {
    const idx = prompt(
      '신고 사유 번호를 입력해주세요:\n' + REPORT_REASONS.map((r, i) => `${i + 1}. ${r}`).join('\n')
    );
    const reason = REPORT_REASONS[Number(idx) - 1];
    if (!reason) return;
    const r = reportTag(reportBtn.dataset.report, getTossKey(), reason);
    toast(r.message);
    if (!r.ok) return;
    render();
    onDataChange?.();
  }
}

function render() {
  const d = getDistrict(currentGuId);
  if (!d) return;
  const s = getState();
  document.getElementById('district-title').textContent = `${d.name} Lv.${d.level}`;
  document.getElementById('district-home-badge').hidden = s.user.homeGuId !== d.guId;

  const eligible = canWriteIn(currentGuId);
  const writeBtn = document.getElementById('district-write-btn');
  writeBtn.disabled = !eligible.ok;
  document.getElementById('district-write-hint').textContent = eligible.ok
    ? (eligible.isResident ? '홈 지역구 — 언제든 쓸 수 있어요' : '지금 이 동네에 있어요 — 🚩 원정 태그')
    : eligible.message;

  document.querySelectorAll('#district-sort [data-sort]').forEach((b) => {
    b.classList.toggle('active', b.dataset.sort === currentSort);
  });

  const feed = districtFeed(currentGuId, currentSort);
  const feedEl = document.getElementById('district-feed');
  if (!feed.length) {
    feedEl.innerHTML = '<p class="empty">아직 태그가 없어요. 첫 이야기를 남겨주세요!</p>';
    return;
  }
  feedEl.innerHTML = feed.map((t) => tagCard(t)).join('');
}

function tagCard(t) {
  const mine = myReaction(t.id);
  const reactions = CONFIG.REACTION_TYPES.map((rt) => {
    const isMine = mine?.type === rt.id;
    const onsite = mine && isMine && mine.isOnsite ? '📍' : '';
    return `<button class="react-btn ${isMine ? 'mine' : ''}" data-tag="${t.id}" data-react="${rt.id}">
      ${rt.emoji} ${t.counts[rt.id]}${onsite}</button>`;
  }).join('');
  return `
    <article class="tag-card ${t.promoted ? 'promoted' : ''}">
      <div class="tag-card-head">
        <span class="tag-origin">${t.isResident ? '🏠 주민' : '🚩 방문'}</span>
        <button class="report-btn" data-report="${t.id}" aria-label="신고">신고</button>
      </div>
      <p class="tag-text">${escapeHtml(t.text)}</p>
      <div class="tag-card-foot">${reactions}</div>
    </article>`;
}
