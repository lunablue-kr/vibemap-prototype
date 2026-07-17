// 랭킹 롤링 칩 (설계서 §9-0): 부문 아이콘 + 1위 구 이름, 수 초 간격 교체
// 칩 = 현황판 + 랭킹 진입 버튼 겸용. Phase 1은 👑총점·🔥급상승 2종 롤링.
import { CONFIG } from './config.js';
import { rollingChips } from './ranking.js';

let idx = 0;
let timer = null;

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
  document.getElementById('rank-chip').textContent = `${c.icon} ${c.guName}`;
}
