// 메인 지도 (설계서 v0.5 §9-2, §9-3)
// 베이스 타일 없음: 단색 배경 + 구 폴리곤 + 태그. 더블탭은 Leaflet 기본 줌 제스처로 예약.
// 자리싸움: 크기 단계(§9-3)·줌별 구당 표시 상한·앵커(탭 좌표)·고정석(주간 1위 = 구 중심).
// 와이어프레임 단계: 색·음영은 회색 임시. design-brief 확정 후 팔레트 적용.
import { CONFIG } from './config.js';
import { getState } from './store.js';
import { tagsForMap, sizeTier } from './tags.js';
import { reactionCounts } from './reactions.js';
import { weeklyTopTagIdByGu } from './ranking.js';

let map = null;
let geoLayer = null;
let tagLayerGroup = null;
let guLabelGroup = null;
let markersByTagId = {};
let handlers = {}; // { onTagClick(tagId), onEmptyTap(guId, lat, lng) }

// 레벨(1~10) → 회색 채움 농도 (임시)
function levelFill(level) {
  const t = (level - 1) / 9;
  const g = Math.round(235 - t * 130);
  return `rgb(${g},${g},${g})`;
}

export function initMap(h) {
  handlers = h;
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
  map.on('zoomend', () => { renderGuLabels(); renderTags(); }); // 전체 재배치는 진입·줌 변경 시에만 (§9-3)
  // 지도 조작(팬·줌) 시작 = 오버레이 자연스럽게 닫힘 (B안)
  map.on('movestart zoomstart', () => handlers.onMapMoveStart?.());
  map.on('click', (e) => handlers.onBareMapTap?.(e)); // 오버레이 닫기 규칙용 (폴리곤·마커 탭에서도 발생)
  window.__vibemapMap = map; // 프로토타입 디버그용 (출시 전 제거)
}

export function renderDistricts() {
  const s = getState();
  if (geoLayer) geoLayer.remove();
  geoLayer = L.geoJSON(s.geojson, {
    style: (f) => {
      const d = s.districts.find((x) => x.guId === f.properties.code);
      const isHome = s.user.homeGuId === f.properties.code;
      return {
        color: isHome ? '#111' : '#777',
        weight: isHome ? 2.5 : 1.2,
        fillColor: levelFill(d?.level || 1),
        fillOpacity: 0.6,
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
    guLabelGroup.addLayer(
      L.marker(d.centroid, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          html: `<span class="gu-label ${near ? 'near' : ''}">Lv.${d.level} ${d.name}</span>`,
          className: 'gu-label-wrap',
          iconSize: null,
        }),
        zIndexOffset: -1000, // 태그 라벨 아래
      })
    );
  });
}

// 태그 = 지점 핀(🏠/🚩, 정확한 좌표에 고정) + 오른쪽 박스([최다 리액션 + 총합] 텍스트 1줄)
// offsetY: 충돌 회피 시 박스만 밀리고 핀은 지점에 남음 (어느 지점의 태그인지 항상 명확)
const PIN_GAP = 9; // 핀 중심 → 박스 간격(px)
// flip: 서울 동쪽 경계 근처면 박스를 핀 왼쪽에 (화면 밖 잘림 방지)
function tagHtml(t, displayTier, offsetY = 0, flip = false) {
  const tier = displayTier || t.tier;
  const chars = CONFIG.LABEL_CHARS[tier];
  const text = t.text.length > chars ? t.text.slice(0, chars) + '…' : t.text;
  const pin = t.isResident ? '🏠' : '🚩';
  const count = t.counts.total > 0 ? `${t.topType.emoji} ${t.counts.total} ` : '';
  const x = flip ? `calc(-100% - ${PIN_GAP}px)` : `${PIN_GAP}px`;
  const style = `transform: translate(${x}, calc(-50% + ${offsetY}px));`;
  return `<span class="tag-pin ${tier}" data-tag="${t.id}">${pin}</span>` +
    `<span class="tag-marker ${tier}" data-tag="${t.id}" style="${style}">${count}${escapeHtml(text)}</span>`;
}

// 줌별 구당 표시 상한 (§9-3): 전체 뷰 = 1개, 줌인할수록 상위 10개까지 점진 확대
function guCap() {
  const zoom = Math.floor(map.getZoom());
  let cap = CONFIG.MAP_CAP_FAR;
  Object.entries(CONFIG.MAP_CAPS_BY_ZOOM).forEach(([z, c]) => {
    if (zoom >= Number(z)) cap = c;
  });
  return cap;
}

// 라벨 픽셀 크기 근사 (충돌 계산용)
function labelBox(t, tier) {
  const chars = Math.min(t.text.length, CONFIG.LABEL_CHARS[tier]);
  const px = tier === 'big' ? 14 : tier === 'mid' ? 12 : 10;
  return { w: 44 + chars * px, h: tier === 'big' ? 30 : tier === 'mid' ? 24 : 18 };
}

export function renderTags() {
  tagLayerGroup.clearLayers();
  markersByTagId = {};
  const s = getState();
  const byGu = tagsForMap();
  const topByGu = weeklyTopTagIdByGu();
  const cap = guCap();

  // ── 노출 규칙 (확정) ──────────────────────────────────────────
  // 1. 구별 노출은 항상 리액션 순위 1위부터 "연속"이어야 한다 (prefix 보장).
  //    k위가 자리를 못 잡으면 그 구의 k+1위 이하도 그 줌에서는 노출하지 않는다.
  // 2. 줌이 깊어질수록 구당 상한(cap)이 늘어 2위, 3위…가 순서대로 추가된다.
  // 3. 배치 우선권은 전역 리액션 합산순 (동률이면 구 내 순위 우선).
  // 지역 추가·실시간 순위 변동에도 이 규칙이 유지되어야 함.
  const shown = Object.entries(byGu)
    .flatMap(([guId, list]) => list.slice(0, cap))
    .sort((a, b) => b.counts.total - a.counts.total || a.guRank - b.guRank);

  const placedBoxes = []; // 절대 투영 좌표(화면 중심 무관) 기준 충돌 회피 — 팬 중에도 배치 유지
  const zoom = map.getZoom();
  const blockedGu = new Set(); // k위가 생략된 구 — 하위 순위도 생략 (prefix 보장)
  const eastX = map.project(geoLayer.getBounds().getNorthEast(), zoom).x; // 서울 동쪽 경계 (박스 뒤집기 기준)
  shown.forEach((t) => {
    if (blockedGu.has(t.guId)) return;
    const d = s.districts.find((x) => x.guId === t.guId);
    // 앵커 = 항상 실제 좌표. 고정석(§9-3: 주간 1위 = 구 중심)만 예외 — 줌 경계 점프 방지
    const useCentroid = d && topByGu[t.guId] === t.id;
    const anchor = useCentroid ? d.centroid : [t.lat, t.lng];
    const pp = map.project(anchor, zoom); // 줌에만 의존하는 절대 픽셀 좌표

    // 크기: LABEL_FULLSIZE_ZOOM부터 §9-3 크기 단계, 그 전엔 전부 작게.
    // 큰 크기가 자리를 못 잡으면 생략 대신 작은 크기로 강등 시도 — 확대 중 태그가 사라지는 역행 방지.
    // 배치: 상하 1칸까지만 밀어내기, 밀린 위치는 자기 구 안이어야 함 (§9-3 "구 경계 안에서만")
    const tiersToTry =
      zoom >= CONFIG.LABEL_FULLSIZE_ZOOM && t.tier !== 'small' ? [t.tier, 'small'] : ['small'];
    let placement = null;
    for (const tier of tiersToTry) {
      const box = labelBox(t, tier);
      const h = box.h * 0.9;
      const flip = pp.x + 9 + box.w > eastX + 10; // 동쪽 경계 밖으로 나가면 왼쪽으로
      const bx = pp.x + (flip ? -(9 + box.w / 2) : 9 + box.w / 2);
      const usable = (dy) => {
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
      const dy = [0, h, -h].find(usable);
      if (dy !== undefined) { placement = { tier, box, dy, bx, flip }; break; }
    }
    if (!placement) {
      blockedGu.add(t.guId); // 이 구는 여기서 끊음 — 하위 순위가 먼저 튀어나오는 것 방지
      return;
    }
    const displayTier = placement.tier;
    const offsetY = placement.dy;
    placedBoxes.push({ x: placement.bx, y: pp.y + offsetY, w: placement.box.w, h: placement.box.h });

    const marker = L.marker(anchor, {
      icon: L.divIcon({ html: tagHtml(t, displayTier, offsetY, placement.flip), className: 'tag-marker-wrap', iconSize: null }),
      zIndexOffset: t.tier === 'big' ? 1000 : t.tier === 'mid' ? 500 : 0,
    });
    marker.on('click', () => handlers.onTagClick?.(t.id));
    tagLayerGroup.addLayer(marker);
    markersByTagId[t.id] = { marker, tag: t, offsetY, flip: placement.flip };
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
  const counts = reactionCounts(tagId);
  const topType = CONFIG.REACTION_TYPES.reduce(
    (best, rt) => (counts[rt.id] > counts[best.id] ? rt : best),
    CONFIG.REACTION_TYPES[0]
  );
  // 임계값 돌파 시 크기 단계 즉시 반영 (§9-3 체감 실시간 승격. 구 내 순위 재계산은 재배치 시)
  const tier = sizeTier(counts.total, entry.tag.guRank);
  const t = { ...entry.tag, counts, topType, tier };
  const displayTier = map.getZoom() < CONFIG.LABEL_FULLSIZE_ZOOM ? 'small' : tier;
  entry.marker.setIcon(
    L.divIcon({ html: tagHtml(t, displayTier, entry.offsetY || 0, entry.flip), className: 'tag-marker-wrap', iconSize: null })
  );
}

export function refreshMap() {
  renderDistricts();
  renderGuLabels();
  renderTags();
}

export function invalidateMapSize() {
  map?.invalidateSize();
}

export function panToDistrict(guId) {
  if (!map || !geoLayer) return;
  geoLayer.eachLayer((layer) => {
    if (layer.feature.properties.code === guId) {
      map.fitBounds(layer.getBounds(), { maxZoom: 12 });
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
