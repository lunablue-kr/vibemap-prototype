// 빈 공간 터치 = 인라인 말풍선 작성창 (설계서 §9-1)
// 터치 지점에 입력창 생성. 머리 `○○구 ›` (태그 0개 구의 상세 진입로 겸함). ✕로 닫힘.
// 위치 규칙 위반 시 입력창 대신 같은 말풍선에 안내문.
import { CONFIG } from './config.js';
import { getDistrict } from './store.js';
import { createTag, canWriteIn } from './tags.js';
import { canPost } from './limits.js';
import { latLngToPagePoint } from './map.js';
import { toast, viewportBox } from './ui.js';

let pending = null; // { guId, lat, lng }
let onCreated = null;
let onOpenDistrict = null;

export function initComposer(handlers) {
  onCreated = handlers.onCreated;
  onOpenDistrict = handlers.onOpenDistrict;
  document.getElementById('composer').addEventListener('click', handleClick);
  document.getElementById('composer').addEventListener('input', (e) => {
    if (e.target.id !== 'composer-input') return;
    document.getElementById('composer-count').textContent =
      `${e.target.value.length}/${CONFIG.TAG_MAX_LENGTH}`;
  });
}

export function openComposer(guId, lat, lng) {
  pending = { guId, lat, lng };
  const el = document.getElementById('composer');
  const gu = getDistrict(guId);
  const eligible = canWriteIn(guId);

  // 고지문 (§9-1): 원정 시 "지금 계신 동네…" + 공통 "특정 가게…"
  const notice = eligible.ok && !eligible.isResident
    ? '지금 계신 동네에 대한 이야기를 남겨주세요'
    : '';
  const body = !eligible.ok
    ? `<p class="composer-blocked">${eligible.message}</p>`
    : !canPost()
    ? `<p class="composer-blocked">오늘 글쓰기 횟수를 다 썼어요. 광고를 보면 3회 충전돼요.</p>`
    : `<p class="hint">${notice ? notice + ' · ' : ''}특정 가게에 대한 부정적 후기는 삭제될 수 있어요</p>
       <textarea id="composer-input" rows="2" maxlength="${CONFIG.TAG_MAX_LENGTH}"
         placeholder="이 동네의 지금 분위기를 한 줄로"></textarea>
       <div class="composer-foot">
         <span id="composer-count" class="hint">0/${CONFIG.TAG_MAX_LENGTH}</span>
         <button id="composer-submit" class="btn primary">남기기</button>
       </div>`;

  el.innerHTML = `
    <div class="composer-head">
      <button class="popup-gu" data-gu="${guId}">${gu.name} ›</button>
      <button data-close aria-label="닫기">✕</button>
    </div>
    ${body}`;

  positionBalloon(el, latLngToPagePoint(lat, lng));
  el.hidden = false;
  document.getElementById('composer-input')?.focus();
}

function positionBalloon(el, pt) {
  const v = viewportBox();
  el.style.left = Math.min(Math.max(pt.x - 130, v.x + 8), v.x + v.w - 268) + 'px';
  el.style.top = Math.min(Math.max(pt.y - 20, v.y + 60), v.y + v.h - 180) + 'px';
}

export function isComposerOpen() {
  return !document.getElementById('composer').hidden;
}

// 팬·줌 시 작성창이 터치 지점을 따라다님 (입력 중 텍스트 유지)
export function repositionComposer() {
  const el = document.getElementById('composer');
  if (el.hidden || !pending) return;
  positionBalloon(el, latLngToPagePoint(pending.lat, pending.lng));
}

export function closeComposer() {
  document.getElementById('composer').hidden = true;
  pending = null;
}

function handleClick(e) {
  if (e.target.closest('[data-close]')) { closeComposer(); return; }
  const guBtn = e.target.closest('[data-gu]');
  if (guBtn) {
    closeComposer();
    onOpenDistrict?.(guBtn.dataset.gu);
    return;
  }
  if (e.target.id === 'composer-submit') {
    const text = document.getElementById('composer-input').value;
    const r = createTag(pending.guId, pending.lat, pending.lng, text);
    toast(r.message);
    if (r.ok) {
      closeComposer();
      onCreated?.();
    }
  }
}
