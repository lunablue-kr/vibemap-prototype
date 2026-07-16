// 메인 지도 — Leaflet + CartoDB 라벨 없는 최소 타일 (설계서 §9-2: 지도는 미니멀)
// 와이어프레임 단계: 레벨별 채도는 회색 단계로 표현. design-brief.md 확정 후 팔레트 적용.
import { getState } from './store.js';
import { tagsForMap } from './tags.js';

let map = null;
let geoLayer = null;
let tagLayerGroup = null;
let onDistrictClick = null;
let onMapTap = null; // 구 내 자유 좌표 터치 → 글쓰기 (설계서 §3 코어 루프 2)

const SEOUL_CENTER = [37.5665, 126.978];

// 레벨(1~10) → 회색 채움 농도 (와이어프레임 임시)
function levelFill(level) {
  const t = (level - 1) / 9;
  const g = Math.round(230 - t * 120);
  return `rgb(${g},${g},${g})`;
}

export function initMap(handlers) {
  onDistrictClick = handlers.onDistrictClick;
  onMapTap = handlers.onMapTap;

  map = L.map('map', { zoomControl: false, attributionControl: true })
    .setView(SEOUL_CENTER, 11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 14, minZoom: 10,
  }).addTo(map);

  tagLayerGroup = L.layerGroup().addTo(map);
  renderDistricts();
  renderTags();
  map.on('zoomend', renderTags); // 줌 단계별 라벨 노출 갱신
  // 레이아웃 확정 후 서울 전체가 화면에 맞도록 조정
  requestAnimationFrame(() => {
    map.invalidateSize();
    if (geoLayer) map.fitBounds(geoLayer.getBounds(), { padding: [8, 8] });
  });
  window.__vibemapMap = map; // 프로토타입 디버그용
}

export function renderDistricts() {
  const s = getState();
  if (geoLayer) geoLayer.remove();
  geoLayer = L.geoJSON(s.geojson, {
    style: (f) => {
      const d = s.districts.find((x) => x.guId === f.properties.code);
      return { color: '#666', weight: 1.2, fillColor: levelFill(d?.level || 1), fillOpacity: 0.55 };
    },
    onEachFeature: (f, layer) => {
      const d = s.districts.find((x) => x.guId === f.properties.code);
      layer.bindTooltip(`${f.properties.name} Lv.${d?.level || 1}`, { sticky: true, direction: 'top' });
      layer.on('click', (e) => {
        // 짧은 탭: 좌표 전달 → 글쓰기 or 구 상세 선택은 앱 레이어에서 처리
        onMapTap?.(f.properties.code, e.latlng.lat, e.latlng.lng);
      });
      layer.on('dblclick', () => onDistrictClick?.(f.properties.code));
    },
  }).addTo(map);
}

// 태그 표시: 기본 작게, 공감 상위(승격)만 크게 (설계서 §7, §8)
// 라벨 과밀 방지: 줌아웃(<11)에서는 구별 최고 인기 태그 1개만 텍스트, 확대 시 승격 태그 전체 텍스트
export function renderTags() {
  tagLayerGroup.clearLayers();
  const s = getState();
  const tags = tagsForMap();
  const zoom = map.getZoom();
  const topByGu = {};
  tags.forEach((t) => {
    if (!t.promoted) return;
    if (!topByGu[t.guId] || t.counts.total > topByGu[t.guId].counts.total) topByGu[t.guId] = t;
  });
  tags.forEach((t) => {
    const icon = t.isResident ? '🏠' : '🚩';
    const showText = t.promoted && (zoom >= 11 || topByGu[t.guId] === t);
    const cls = t.promoted ? 'tag-marker promoted' : 'tag-marker';
    const html = showText
      ? `<span class="${cls}">${icon} ${escapeHtml(t.text)}</span>`
      : `<span class="${cls}">${icon}</span>`;
    const marker = L.marker([t.lat, t.lng], {
      icon: L.divIcon({ html, className: 'tag-marker-wrap', iconSize: null }),
    });
    marker.on('click', () => onDistrictClick?.(t.guId));
    tagLayerGroup.addLayer(marker);
  });
  // 홈 지역구 표시
  const home = s.districts.find((d) => d.guId === s.user.homeGuId);
  if (home && geoLayer) {
    geoLayer.eachLayer((layer) => {
      if (layer.feature.properties.code === home.guId) {
        layer.setStyle({ color: '#111', weight: 2.5 });
      }
    });
  }
}

export function refreshMap() {
  renderDistricts();
  renderTags();
}

export function invalidateMapSize() {
  map?.invalidateSize();
}

// 개발용 위치 시뮬레이션과 지도 뷰 동기화: 해당 구로 이동
export function panToDistrict(guId) {
  if (!map || !geoLayer) return;
  geoLayer.eachLayer((layer) => {
    if (layer.feature.properties.code === guId) {
      map.fitBounds(layer.getBounds(), { maxZoom: 12 });
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
