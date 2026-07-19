// 캔디 수채 레벨 팔레트 (design-brief.md §3·§4 "안료 가장자리")
// 색 값은 tokens.css의 CSS 변수(--gu-lvN/--gu-edgeN/--gu-edge-deep)에서 런타임 로드 —
// 하드코딩 hex 금지·단일 진실 지점 유지. Leaflet 스타일은 var()를 못 쓰므로 읽어와 주입.
let GU_FILL = {};
let GU_EDGE = {};
let EDGE_DEEP = ''; // Lv6~10 경계 보간 앵커

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// 스타일시트 로드 후 1회 호출 (renderDistricts 전에 필수)
export function buildPalette() {
  for (let i = 1; i <= 5; i++) {
    GU_FILL[i] = cssVar(`--gu-lv${i}`);
    GU_EDGE[i] = cssVar(`--gu-edge${i}`);
  }
  EDGE_DEEP = cssVar('--gu-edge-deep');
}

// #rrggbb 선형 보간
function hexMix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Lv1~5 = 토큰 테이블, Lv6~10 = 동일 색조 심화 (채움은 edge5쪽, 경계는 더 진하게 연장)
function lvIndex(level) { return Math.max(1, Math.min(5, level || 1)); }
export function levelFill(level) {
  if ((level || 1) <= 5) return GU_FILL[lvIndex(level)];
  return hexMix(GU_FILL[5], GU_EDGE[5], Math.min(1, (level - 5) / 5));
}
export function levelEdge(level) {
  if ((level || 1) <= 5) return GU_EDGE[lvIndex(level)];
  return hexMix(GU_EDGE[5], EDGE_DEEP, Math.min(1, (level - 5) / 5));
}
