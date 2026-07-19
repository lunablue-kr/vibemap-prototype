// 자체 제작 아이콘 스프라이트 로더 + 렌더 헬퍼 (design-brief.md §6)
// 이모지 폰트 미사용 — 전량 assets/icons/vibe-icons.svg 의 <symbol>을 <use>로 참조.
// 세트 규칙(무윤곽·투톤·좌상단 하이라이트·라운드 조인)은 SVG 파일이 강제.
let loaded = false;

// 부트스트랩에서 1회 호출: 스프라이트를 body 최상단에 숨겨 주입 (fetch 1회, 캐시)
export async function loadIcons() {
  if (loaded) return;
  const res = await fetch('./assets/icons/vibe-icons.svg');
  if (!res.ok) throw new Error(`아이콘 스프라이트 로드 실패 (${res.status})`); // 에러 HTML 주입 방지
  const text = await res.text();
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = text;
  document.body.prepend(holder);
  loaded = true;
}

// 심볼 id(i-like 등) → 인라인 SVG 문자열. size=px, cls=추가 클래스
export function icon(id, size = 16, cls = '') {
  return `<svg class="vibe-ic ${cls}" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><use href="#${id}"/></svg>`;
}

// 핀 id → 아이콘 심볼 매핑. 리액션·부문 아이콘은 CONFIG.REACTION_TYPES[].icon / ALL_CATEGORIES[].icon이 단일 진실원
export const PIN_ICON = { home: 'i-home', away: 'i-flag' };
