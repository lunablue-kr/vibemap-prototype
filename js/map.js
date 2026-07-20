// 메인 지도 (설계서 v0.5 §9-2, §9-3)
// 베이스 타일 없음: 단색 배경 + 구 폴리곤 + 태그. 더블탭은 Leaflet 기본 줌 제스처로 예약.
// 자리싸움: 크기 단계(§9-3)·줌별 구당 표시 상한·앵커(탭 좌표)·고정석(지금 1위 = 구 중심).
// 색·음영: design-brief.md v1.0 "캔디 수채" 팔레트 (tokens.css 변수, §4 안료 가장자리).
import { CONFIG } from './config.js';
import { getState } from './store.js';
import { tagsForMap, sizeTier } from './tags.js';
import { recentReactionCounts } from './reactions.js';
import { topTagIdByGu } from './ranking.js';
import { escapeHtml } from './ui.js';
import { icon, PIN_ICON } from './icons.js';
import { buildPalette, levelFill, levelEdge } from './palette.js';
import { isHof, masterTitle } from './phase2.js';

let map = null;
let geoLayer = null;
let tagLayerGroup = null;
let guLabelGroup = null;
let programmaticMove = false; // 앱 주도 이동 중 (오버레이 자동 닫힘 예외)
let markersByTagId = {};
let topByGuCache = {}; // 구별 '지금 1위' 태그 id (renderTags에서 계산, updateSingleTag가 재사용)
let handlers = {}; // { onTagClick(tagId), onEmptyTap(guId, lat, lng) }

export function initMap(h) {
  handlers = h;
  buildPalette(); // tokens.css 로드 후 팔레트 주입 (renderDistricts 전에 필수)
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false, // 타일 제거로 저작권 표기 불필요 (GeoJSON은 자체 데이터)
    doubleClickZoom: true, // §9-1: 더블탭 = 줌 제스처 (상세 진입에 쓰지 않음)
    minZoom: 9, // 초기화 후 fit+부스트 값으로 재설정됨
    maxZoom: 13,
    zoomSnap: 0.1, // fit이 정수 줌에 갇히지 않게
    maxBoundsViscosity: 1.0, // 서울 밖으로 팬 금지 (아래 setMaxBounds와 세트)
  });
  renderDistricts();
  guLabelGroup = L.layerGroup().addTo(map);
  tagLayerGroup = L.layerGroup().addTo(map);
  map.setView([37.5665, 126.978], 10);
  // 레이아웃 확정 후 시작 뷰 설정: 전체 fit + 부스트 (좌우 살짝 잘림 감수, 더 축소 불가)
  // setTimeout: 백그라운드 탭에서도 실행되도록 (rAF는 탭이 안 보이면 안 돎)
  setTimeout(() => {
    map.invalidateSize();
    const bounds = geoLayer.getBounds();
    const startZoom = map.getBoundsZoom(bounds) + CONFIG.INITIAL_ZOOM_BOOST;
    map.setMinZoom(startZoom);
    map.setMaxBounds(bounds.pad(0.05));
    map.setView(bounds.getCenter(), startZoom);
    renderGuLabels();
    renderTags();
  });
  // 재배치는 뷰 변경 완료 시에만 (§9-3 취지 = 리액션마다 재배치 금지. 팬 후엔
  // 화면 기준 플립·킵아웃 재계산이 필요해서 moveend 재배치 — 줌도 moveend를 발생시킴)
  map.on('zoomend', renderGuLabels);
  let relayoutTimer = null;
  map.on('moveend', () => {
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(renderTags, 120);
  });
  // 지도 조작(팬·줌) 시작 = 오버레이 자연스럽게 닫힘 (B안)
  // 단, 앱이 스스로 움직이는 경우(센터링 팬 등)는 예외
  map.on('movestart zoomstart', () => {
    if (!programmaticMove) handlers.onMapMoveStart?.();
  });
  map.on('click', (e) => handlers.onBareMapTap?.(e)); // 오버레이 닫기 규칙용 (폴리곤·마커 탭에서도 발생)
  window.__vibemapMap = map; // TODO(release-blocker): 프로토타입 디버그 훅, 출시 전 제거
}

export function renderDistricts() {
  const s = getState();
  if (geoLayer) geoLayer.remove();
  geoLayer = L.geoJSON(s.geojson, {
    style: (f) => {
      const d = s.districts.find((x) => x.guId === f.properties.code);
      const level = d?.level || 1;
      // 경계는 안료 가장자리(gu-edge)만 — 홈 구 강조는 브리프 미규정이라 배제(홈 식별은 🏠핀·마이 이니셜)
      return {
        color: levelEdge(level),
        weight: 1.1,
        lineJoin: 'round',
        fillColor: levelFill(level),
        fillOpacity: 0.9,
      };
    },
    onEachFeature: (f, layer) => {
      // 더블탭(줌)의 1차 탭이 작성창을 열지 않도록 짧게 지연 후 실행 (§9-1)
      let clickTimer = null;
      layer.on('click', (e) => {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          handlers.onEmptyTap?.(f.properties.code, e.latlng.lat, e.latlng.lng);
        }, 280);
      });
      layer.on('dblclick', () => clearTimeout(clickTimer));
      // 롱프레스 = 이 지점에 태그 (지도 앱 관례. Leaflet이 모바일 롱프레스를 contextmenu로 매핑)
      layer.on('contextmenu', (e) => {
        clearTimeout(clickTimer);
        handlers.onLongPress?.(f.properties.code, e.latlng.lat, e.latlng.lng);
      });
    },
  }).addTo(map);
}

// 구 이름 + 레벨 반투명 오버레이 (확대 시 길 잃음 방지)
// 전체 뷰에선 태그 라벨과 겹쳐 소음이라 줌인 시에만 표시
export function renderGuLabels() {
  guLabelGroup.clearLayers();
  const near = map.getZoom() >= CONFIG.MAP_NEAR_ZOOM;
  if (!near) return;
  getState().districts.forEach((d) => {
    // 마스터태그 칭호 (§8): masterTag 플래그 && 수상 이력 있을 때만. 프로토타입엔 데이터가 없어
    // masterTitle이 null → 아무것도 안 붙음 (서버 주간 배치가 state.weeklyAwards를 채운다).
    const title = CONFIG.FLAGS.masterTag ? masterTitle(d.guId) : null;
    guLabelGroup.addLayer(
      L.marker(d.centroid, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          html: `<span class="gu-label ${near ? 'near' : ''}">Lv.${d.level} ${d.name}${title ? `<em class="gu-master-title">${escapeHtml(title)}</em>` : ''}</span>`,
          className: 'gu-label-wrap',
          iconSize: null,
        }),
        zIndexOffset: -1000, // 태그 라벨 아래
      })
    );
  });
}

// 태그 = 지점 핀(🏠/🚩, 정확한 좌표에 고정) + 오른쪽 박스([최다 리액션 아이콘] 텍스트 1줄. 숫자 제거)
// offsetY: 충돌 회피 시 박스만 밀리고 핀은 지점에 남음 (어느 지점의 태그인지 항상 명확)
const PIN_GAP = 9; // 핀 중심 → 박스 간격(px)
// offsetX: 핀 기준 박스 왼쪽 끝 위치(px). 배치 로직이 화면 안으로 클램프해서 전달
function tagHtml(t, displayTier, offsetY = 0, offsetX = PIN_GAP, seat = false) {
  const tier = displayTier || t.tier;
  const chars = CONFIG.LABEL_CHARS[tier];
  // 코드포인트 단위 절단 (이모지 포함 텍스트에서 서로게이트 쌍 깨짐 방지)
  const cps = Array.from(t.text);
  const truncated = cps.length > chars;
  // 말줄임 대신 페이드 (brief §10 권장 — 수채 결과 동질). 폭 계산은 그대로 chars 기준
  const shown = escapeHtml(truncated ? cps.slice(0, chars).join('') : t.text);
  const textHtml = truncated ? `<span class="fade">${shown}</span>` : shown;
  const pinId = t.isResident ? PIN_ICON.home : PIN_ICON.away;
  const psz = { small: 15, mid: 18, big: 21 }[tier];
  const csz = { small: 11, mid: 13, big: 15 }[tier];
  // 지도 라벨엔 최다 리액션 아이콘만(숫자 제거 — 사용자 결정. 정확한 수치는 팝업·구 상세에). 크기가 인기를 표현
  const count = t.counts.total > 0 ? `${icon(t.topType.icon, csz)} ` : '';
  const style = `transform: translate(${offsetX}px, calc(-50% + ${offsetY}px));`;
  // 이 동네 1위(골드 필)·지난주1위 박제(라벤더 필) 둘 다 왕관 (design-brief §7 "크라운은 둘 다 골드 유지")
  const seatCls = seat ? ' seat' : '';
  const stampCls = isHof(t) ? ' stamped' : '';
  const crown = (seat || isHof(t)) ? `<span class="seat-crown">${icon('i-crown', csz + 3)}</span>` : '';
  return `<span class="tag-pin ${tier}" data-tag="${t.id}">${icon(pinId, psz)}</span>` +
    `<span class="tag-marker ${tier}${seatCls}${stampCls}" data-tag="${t.id}" style="${style}">${crown}${count}${textHtml}</span>`;
}

// 줌에 따른 표시 크기 단계 (2단계 완화 — 급변 팝 방지, v0.5.4):
// 근접 줌(MAP_NEAR_ZOOM)부터 mid까지, 풀사이즈 줌(LABEL_FULLSIZE_ZOOM)부터 big까지 드러난다.
// 이르게 big을 풀면 라벨이 커져 노출 수가 역행하므로(§9-3) 두 단계로 나눠 완만하게 키운다.
function zoomTier(tier, zoom) {
  if (zoom >= CONFIG.LABEL_FULLSIZE_ZOOM) return tier; // 전체 단계
  if (zoom >= CONFIG.MAP_NEAR_ZOOM) return tier === 'big' ? 'mid' : tier; // big은 한 단계 낮춰
  return 'small';
}

// 줌별 구당 표시 상한 (§9-3): 전체 뷰 = 1개, 줌인할수록 상위 10개까지 점진 확대
function guCap() {
  const zoom = map.getZoom(); // 소수 임계(11.4 등) 비교 위해 floor 안 함
  let cap = CONFIG.MAP_CAP_FAR;
  Object.entries(CONFIG.MAP_CAPS_BY_ZOOM)
    .sort((a, b) => Number(a[0]) - Number(b[0])) // 오름차순 — 가장 높은 충족 임계가 최종
    .forEach(([z, c]) => { if (zoom >= Number(z)) cap = c; });
  return cap;
}

// 라벨 픽셀 크기 근사 (충돌 계산용)
function labelBox(t, tier) {
  const chars = Math.min(Array.from(t.text).length, CONFIG.LABEL_CHARS[tier]);
  const px = tier === 'big' ? 15 : tier === 'mid' ? 13 : 10; // CSS font-size와 맞춘 충돌 근사
  return { w: 44 + chars * px, h: tier === 'big' ? 32 : tier === 'mid' ? 25 : 18 };
}

export function renderTags() {
  tagLayerGroup.clearLayers();
  markersByTagId = {};
  const s = getState();
  const byGu = tagsForMap();
  const topByGu = topTagIdByGu();
  topByGuCache = topByGu; // updateSingleTag 재사용 (매 리액션 전체 재계산 방지, §9-3)
  const cap = guCap();

  // ── 노출 규칙 (확정) ──────────────────────────────────────────
  // 1. 구별 노출은 항상 리액션 순위 1위부터 "연속"이어야 한다 (prefix 보장).
  //    k위가 자리를 못 잡으면 그 구의 k+1위 이하도 그 줌에서는 노출하지 않는다.
  // 2. 줌이 깊어질수록 구당 상한(cap)이 늘어 2위, 3위…가 순서대로 추가된다.
  // 3. 배치 우선권은 전역 리액션 합산순 (동률이면 구 내 순위 우선).
  // 4. [예외] 고정석(지금 1위, §9-3)은 cap·prefix와 무관하게 항상 표시.
  //    표시 순위와 벌어져도 "지금 1위 = 구 중심"은 불변.
  // 지역 추가·실시간 순위 변동에도 이 규칙이 유지되어야 함.
  const shown = Object.entries(byGu)
    .flatMap(([guId, list]) => {
      const slice = list.slice(0, cap);
      const topId = topByGu[guId];
      if (topId && !slice.some((t) => t.id === topId)) {
        const seat = list.find((t) => t.id === topId);
        if (seat) slice.push(seat); // 고정석 예외 (규칙 4)
      }
      // 박제(지난주 1위, hofLocked)도 cap·prefix 무관 항상 표시 (§9-3) — hallOfFame 플래그 게이트
      list.forEach((t) => { if (isHof(t) && !slice.some((x) => x.id === t.id)) slice.push(t); });
      return slice;
    })
    .sort((a, b) => b.counts.total - a.counts.total || a.guRank - b.guRank);

  const placedBoxes = []; // 절대 투영 좌표 기준 충돌 회피 (플립·킵아웃은 화면 기준 → moveend마다 재배치)
  const zoom = map.getZoom();
  const blockedGu = new Set(); // k위가 생략된 구 — 하위 순위도 생략 (prefix 보장)
  // 현재 화면의 절대 픽셀 경계 — 박스 좌우 플립·상단 킵아웃은 "보이는 화면" 기준
  const vb = map.getPixelBounds();
  const TOP_KEEPOUT = 80; // 개발 바 + 플로팅 칩·아이콘 영역

  // 핀이 화면(여유 30px) 안에 있는지 — 화면 밖 태그는 클램프·킵아웃 대상이 아님
  // (적용하면 먼 구의 박스가 화면 가장자리로 끌려 들어오는 "따라오기" 현상 발생)
  const pinInView = (pp) =>
    pp.x > vb.min.x - 30 && pp.x < vb.max.x + 30 && pp.y > vb.min.y - 30 && pp.y < vb.max.y + 30;

  // 박스 X 배치: 기본 핀 오른쪽. 화면 오른쪽을 넘으면 왼쪽으로 플립,
  // 그래도 안 되면 화면 안으로 슬라이드 (핀이 보이는 태그만 — 박스는 항상 화면 안에 온전히)
  const placeBoxX = (pp, box) => {
    let left = pp.x + 9;
    if (!pinInView(pp)) return { tx: 9, bx: left + box.w / 2 };
    if (left + box.w > vb.max.x - 6) left = pp.x - 9 - box.w;
    left = Math.min(Math.max(left, vb.min.x + 6), vb.max.x - 6 - box.w);
    return { tx: left - pp.x, bx: left + box.w / 2 };
  };

  shown.forEach((t) => {
    const isSeat = topByGu[t.guId] === t.id;
    const pinned = isSeat || isHof(t); // 고정석·박제: blockedGu·생략 규칙의 예외
    if (blockedGu.has(t.guId) && !pinned) {
      window.__labelDrops?.push({ id: t.id, gu: t.guId, rank: t.guRank, reason: 'blocked-prefix' });
      return;
    }
    const d = s.districts.find((x) => x.guId === t.guId);
    // 앵커 = 항상 실제 좌표. 고정석(§9-3: 주간 1위 = 구 중심)만 예외 — 줌 경계 점프 방지
    const useCentroid = d && isSeat;
    const anchor = useCentroid ? d.centroid : [t.lat, t.lng];
    const pp = map.project(anchor, zoom); // 줌에만 의존하는 절대 픽셀 좌표

    // 크기: 줌 2단계(zoomTier)로 완만하게 드러남. 자리를 못 잡으면 작은 크기로 강등 시도(생략 대신).
    // 배치: 상하 1칸까지만 밀어내기, 밀린 위치는 자기 구 안이어야 함 (§9-3 "구 경계 안에서만")
    const zTier = zoomTier(t.tier, zoom);
    const tiersToTry = zTier !== 'small' ? [zTier, 'small'] : ['small'];
    let placement = null;
    for (const tier of tiersToTry) {
      const box = labelBox(t, tier);
      const h = box.h * 0.9;
      const { tx, bx } = placeBoxX(pp, box);
      const usable = (dy) => {
        // 상단 킵아웃: 박스가 "화면 안(가로) + 상단 띠(칩·마이 영역)"에 실제로 걸치면 배제.
        // 핀이 화면 밖이어도 박스는 화면 안으로 뻗어 상단 UI를 침범할 수 있으므로 박스 기준으로 판정.
        const boxTop = pp.y + dy - box.h / 2, boxBottom = pp.y + dy + box.h / 2;
        const onScreenX = bx + box.w / 2 > vb.min.x && bx - box.w / 2 < vb.max.x;
        if (onScreenX && boxBottom > vb.min.y && boxTop < vb.min.y + TOP_KEEPOUT) return false;
        const hit = placedBoxes.some(
          (p) => Math.abs(p.x - bx) < (p.w + box.w) / 2 && Math.abs(p.y - (pp.y + dy)) < (p.h + box.h) / 2
        );
        if (hit) return false;
        if (dy !== 0 && d) {
          const ll = map.unproject(L.point(pp.x, pp.y + dy), zoom);
          if (!pointInDistrict(ll.lat, ll.lng, d.geometry)) return false;
        }
        return true;
      };
      const dy = [0, h, -h, 2 * h, -2 * h].find(usable);
      if (dy !== undefined) { placement = { tier, box, dy, bx, tx }; break; }
    }
    if (!placement) {
      // 최대 줌 부근: 생략 금지 — 자리 없으면 작은 크기·겹침 허용으로라도 표시
      // 고정석·박제도 동일 (규칙 4: 항상 표시)
      if (zoom >= map.getMaxZoom() - 0.5 || pinned) {
        const tier = 'small';
        const box = labelBox(t, tier);
        const { tx, bx } = placeBoxX(pp, box);
        // 상단 킵아웃: 박스가 화면 안(가로)일 때만 아래로 밀어 상단 UI를 피함 (usable과 동일 기준)
        const onScreenX = bx + box.w / 2 > vb.min.x && bx - box.w / 2 < vb.max.x;
        const minY = vb.min.y + TOP_KEEPOUT + box.h / 2;
        const dy = onScreenX && pp.y < minY ? minY - pp.y : 0;
        placement = { tier, box, dy, bx, tx };
      } else {
        blockedGu.add(t.guId); // 이 구는 여기서 끊음 — 하위 순위가 먼저 튀어나오는 것 방지
        window.__labelDrops?.push({ id: t.id, gu: t.guId, rank: t.guRank, reason: 'no-slot' });
        return;
      }
    }
    const displayTier = placement.tier;
    const offsetY = placement.dy;
    placedBoxes.push({ x: placement.bx, y: pp.y + offsetY, w: placement.box.w, h: placement.box.h });

    const marker = L.marker(anchor, {
      icon: L.divIcon({ html: tagHtml(t, displayTier, offsetY, placement.tx, isSeat), className: 'tag-marker-wrap', iconSize: null }),
      zIndexOffset: (isSeat || isHof(t)) ? 1500 : t.tier === 'big' ? 1000 : t.tier === 'mid' ? 500 : 0,
    });
    marker.on('click', () => handlers.onTagClick?.(t.id));
    tagLayerGroup.addLayer(marker);
    markersByTagId[t.id] = { marker, tag: t, offsetY, tx: placement.tx };
  });
}

// 리액션 발생 시 해당 태그만 갱신 (§9-3: 매 리액션 전체 재배치 금지)
export function updateSingleTag(tagId) {
  const entry = markersByTagId[tagId];
  if (!entry) return;
  // 블라인드·삭제된 태그는 지도에서 즉시 제거 (§7 노출 중단)
  const live = getState().tags.find((t) => t.id === tagId);
  if (!live || live.state !== 'public') {
    tagLayerGroup.removeLayer(entry.marker);
    delete markersByTagId[tagId];
    return;
  }
  const counts = recentReactionCounts(tagId); // 지도 크기·아이콘은 최근 창 기준 (tagsForMap과 동일)
  const topType = CONFIG.REACTION_TYPES.reduce(
    (best, rt) => (counts[rt.id] > counts[best.id] ? rt : best),
    CONFIG.REACTION_TYPES[0]
  );
  // 임계값 돌파 시 크기 단계 즉시 반영 (§9-3 체감 실시간 승격. 구 내 순위 재계산은 재배치 시)
  const prevTier = entry.tag.tier;
  const tier = sizeTier(counts.total);
  const t = { ...entry.tag, counts, topType, tier };
  const displayTier = zoomTier(tier, map.getZoom());
  const seat = topByGuCache[t.guId] === tagId; // 캐시된 고정석 기준(전체 재계산은 moveend renderTags에서만)
  entry.marker.setIcon(
    L.divIcon({ html: tagHtml(t, displayTier, entry.offsetY || 0, entry.tx ?? 9, seat), className: 'tag-marker-wrap', iconSize: null })
  );
  entry.tag = t; // 다음 승격 비교 기준 갱신
  // 시그니처 "감정 스밈" (brief §2): 크기 단계 상승 순간만 말풍선 팝 + 구 색 파동
  if (TIER_ORDER[tier] > TIER_ORDER[prevTier]) emotionSeep(entry.marker, t.guId);
}

const TIER_ORDER = { small: 0, mid: 1, big: 2 };
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// 시그니처 "감정 스밈" 파동 파라미터 (design-brief.md §2 확정표).
// 상승·하강은 base.css .leaflet-interactive transition(fill-opacity 0.3s ease)가 담당,
// delta=순간 짙어지는 양, hold=유지 후 원복까지(총 연출 ≈ 0.3s+hold+0.3s, §2 "0.6~1s 이내").
const SEEP_PROMOTE = { delta: 0.18, hold: 420 }; // 승격 순간 파동
const SEEP_CELEBRATE = { delta: 0.28, hold: 700 }; // 첫 태그 축하(더 짙게·길게, §4)

// 말풍선 탱글 팝 (재발동 위해 클래스 리셋 후 재부여)
function popMarker(marker) {
  const el = marker?.getElement?.()?.querySelector?.('.tag-marker');
  if (el) { el.classList.remove('promote'); void el.offsetWidth; el.classList.add('promote'); }
}

// 구 채움색이 한 번 짙어졌다 돌아오는 파동 (감정 스밈). CSS 트랜지션과 맞물려 피었다 사라짐
function pulseDistrict(guId, delta, ms) {
  if (!geoLayer) return;
  geoLayer.eachLayer((layer) => {
    if (layer.feature?.properties?.code !== guId) return;
    const base = layer.options.fillOpacity;
    layer.setStyle({ fillOpacity: Math.min(1, base + delta) });
    setTimeout(() => layer.setStyle({ fillOpacity: base }), ms);
  });
}

// 승격 연출: 말풍선 팝 + 해당 구 짧은 파동
function emotionSeep(marker, guId) {
  if (reduceMotion) return;
  popMarker(marker);
  pulseDistrict(guId, SEEP_PROMOTE.delta, SEEP_PROMOTE.hold);
}

// 첫 태그 축하 (§4 초기 활성화): 시그니처 "감정 스밈"을 승격보다 크게(더 짙게·길게).
// 새 태그가 구당 표시 상한에 걸려 마커가 없어도 구 색 파동은 항상 실행 — 붐비는 구에서도 첫 흔적이 보이도록.
export function celebrateTag(tagId, guId) {
  if (reduceMotion) return;
  const entry = markersByTagId[tagId];
  if (entry) popMarker(entry.marker);
  pulseDistrict(guId, SEEP_CELEBRATE.delta, SEEP_CELEBRATE.hold); // 승격보다 강한 파동
}

export function refreshMap() {
  renderDistricts();
  renderGuLabels();
  renderTags();
}

export function invalidateMapSize() {
  map?.invalidateSize();
}

// 센터링 팬 (구글맵 관례): 탭한 태그를 화면 중앙으로 부드럽게 이동.
// 이동 완료 후 콜백 (팝업을 안정된 뷰에서 열기 위함)
export function gentlePanTo(latlng, onDone) {
  // 이미 중앙 근처면 이동 생략 (panTo가 no-op이면 moveend가 안 와서 콜백이 유실됨)
  const p = map.latLngToContainerPoint(latlng);
  const c = map.getSize().divideBy(2);
  if (Math.hypot(p.x - c.x, p.y - c.y) < 24) {
    onDone?.();
    return;
  }
  programmaticMove = true;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    programmaticMove = false;
    onDone?.();
  };
  map.once('moveend', finish);
  // maxBounds 클램프로 이동이 0이면 moveend가 안 옴 — 콜백 유실 방지 타이머
  setTimeout(finish, 700);
  map.panTo(latlng, { animate: true, duration: 0.3 });
}

export function tagLatLng(tagId) {
  return markersByTagId[tagId]?.marker.getLatLng() || null;
}

export function panToDistrict(guId) {
  if (!map || !geoLayer) return;
  geoLayer.eachLayer((layer) => {
    if (layer.feature.properties.code === guId) {
      map.fitBounds(layer.getBounds(), { maxZoom: CONFIG.PAN_TO_DISTRICT_MAX_ZOOM });
    }
  });
}

// 좌표 → 화면 픽셀 (인라인 작성창·팝업 위치 계산용)
export function latLngToPagePoint(lat, lng) {
  const rect = document.getElementById('map').getBoundingClientRect();
  const p = map.latLngToContainerPoint([lat, lng]);
  return { x: rect.left + p.x, y: rect.top + p.y };
}

// 태그 라벨의 실제 화면 위치 (충돌 오프셋 포함) — 팝업을 라벨 옆에 띄울 때 사용
export function tagScreenPoint(tagId) {
  const entry = markersByTagId[tagId];
  if (!entry) return null;
  const ll = entry.marker.getLatLng();
  const pt = latLngToPagePoint(ll.lat, ll.lng);
  return { x: pt.x, y: pt.y + (entry.offsetY || 0) };
}

// 점이 구 폴리곤 안에 있는지 (ray casting). 좌표는 GeoJSON [lng, lat]
function pointInDistrict(lat, lng, geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.some((rings) => rayCast(lat, lng, rings[0]));
}

function rayCast(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
