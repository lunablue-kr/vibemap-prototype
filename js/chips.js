// 랭킹 롤링 칩 (설계서 §9-0): 부문 아이콘 + 1위 구 이름, 수 초 간격 교체
// 칩 = 현황판 + 랭킹 진입 버튼 겸용. Phase 1은 👑총점·🔥급상승 2종 롤링.
import { CONFIG } from './config.js';
import { rollingChips } from './ranking.js';
import { icon } from './icons.js';
import { escapeHtml } from './ui.js';

let idx = 0;
let timer = null;
let lastCat = null; // 부문 전환 감지 (전환 순간만 모션 — 리액션 리렌더 깜빡임 방지)

export function initChip(onTap) {
  document.getElementById('rank-chip').addEventListener('click', onTap);
  startChipRotation();
}

export function startChipRotation() {
  clearInterval(timer);
  renderChip();
  timer = setInterval(() => {
    idx++;
    renderChip();
  }, CONFIG.CHIP_ROTATE_MS);
}

export function renderChip() {
  const chips = rollingChips();
  if (!chips.length) return;
  const c = chips[idx % chips.length];
  const el = document.getElementById('rank-chip');
  el.innerHTML = `${icon(c.icon, 16)}<span class="chip-gu">${escapeHtml(c.guName)}</span>`;
  if (c.categoryId !== lastCat) { // 부문 전환 시에만 페이드
    el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
    lastCat = c.categoryId;
  }
}
