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
    minZoom: 9,
    maxZoom: 13,
    zoomSnap: 0.5, // 서울 경계 fit이 정수 줌에 갇히지 않게
  });
  renderDistricts();
  tagLayerGroup = L.layerGroup().addTo(map);
  map.setView([37.5665, 126.978], 10);
  // 레이아웃 확정 후 서울 전체에 맞춤 (컨테이너 크기 0 문제 방지)
  requestAnimationFrame(() => {
    map.invalidateSize();
    map.fitBounds(geoLayer.getBounds(), { padding: [8, 8] });
    renderTags();
  });
  map.on('zoomend', renderTags); // 전체 재배치는 진입·줌 변경 시에만 (§9-3)
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
    },
  }).addTo(map);
}

// 태그 라벨 HTML: [최다 리액션 아이콘 + 총합] + 텍스트 1줄 (크기별 글자수 제한)
function tagHtml(t, displayTier) {
  const tier = displayTier || t.tier;
  const chars = CONFIG.LABEL_CHARS[tier];
  const text = t.text.length > chars ? t.text.slice(0, chars) + '…' : t.text;
  const marker = t.isResident ? '🏠' : '🚩';
  const count = t.counts.total > 0 ? `${t.topType.emoji} ${t.counts.total} ` : `${marker} `;
  return `<span class="tag-marker ${tier}" data-tag="${t.id}">${count}${escapeHtml(text)}</span>`;
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

  // 표시 대상: 구당 상한 적용 후 전체를 리액션순으로 (상위 태그가 좋은 자리 선점)
  const shown = Object.entries(byGu)
    .flatMap(([guId, list]) => list.slice(0, cap))
    .sort((a, b) => b.counts.total - a.counts.total);

  const placedBoxes = []; // 픽셀 공간 전역 충돌 회피
  const farView = map.getZoom() < CONFIG.MAP_NEAR_ZOOM;
  shown.forEach((t) => {
    const d = s.districts.find((x) => x.guId === t.guId);
    // 고정석(§9-3): 주간 1위 태그 = 구 중심. 전체 뷰에선 구당 1개뿐이므로 모두 구 중심 앵커
    const useCentroid = d && (farView || topByGu[t.guId] === t.id);
    const anchor = useCentroid ? d.centroid : [t.lat, t.lng];
    // 전체 뷰: 공간이 좁아 전부 작은 크기 (줌인하면 §9-3 크기 단계 적용)
    const displayTier = farView ? 'small' : t.tier;
    const box = labelBox(t, displayTier);
    const pt = map.latLngToContainerPoint(anchor);

    // 플로팅 칩·아이콘 아래로는 침범 금지 (상단 킵아웃)
    if (pt.y < 64) pt.y = 64;
    // 앵커에서 아래로 밀어내며 빈자리 탐색 (§9-3 근사 구현 — 정식 구현은 구 경계 내 제한)
    let tries = 0;
    while (
      tries < 20 &&
      placedBoxes.some(
        (p) => Math.abs(p.x - pt.x) < (p.w + box.w) / 2 && Math.abs(p.y - pt.y) < (p.h + box.h) / 2
      )
    ) {
      pt.y += box.h * 0.75;
      tries++;
    }
    placedBoxes.push({ x: pt.x, y: pt.y, w: box.w, h: box.h });

    const marker = L.marker(map.containerPointToLatLng(pt), {
      icon: L.divIcon({ html: tagHtml(t, displayTier), className: 'tag-marker-wrap', iconSize: null }),
      zIndexOffset: t.tier === 'big' ? 1000 : t.tier === 'mid' ? 500 : 0,
    });
    marker.on('click', () => handlers.onTagClick?.(t.id));
    tagLayerGroup.addLayer(marker);
    markersByTagId[t.id] = { marker, tag: t };
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
  const displayTier = map.getZoom() < CONFIG.MAP_NEAR_ZOOM ? 'small' : tier;
  entry.marker.setIcon(L.divIcon({ html: tagHtml(t, displayTier), className: 'tag-marker-wrap', iconSize: null }));
}

export function refreshMap() {
  renderDistricts();
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
