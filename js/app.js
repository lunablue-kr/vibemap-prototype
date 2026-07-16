// 앱 진입점: 탭 내비게이션, 지도 터치 → 글쓰기 플로우, 개발용 위치 시뮬레이션
import { CONFIG } from './config.js';
import { initStore, getState, getDistrict } from './store.js';
import { initMap, refreshMap, invalidateMapSize, panToDistrict } from './map.js';
import { createTag, canWriteIn } from './tags.js';
import { getCurrentGuId, setCurrentGuId } from './mock-toss.js';
import { toast, showScreen } from './ui.js';
import { initDistrictScreen, openDistrict, refreshDistrict } from './screens/district.js';
import { renderRankingScreen } from './screens/ranking.js';
import { initMyScreen, renderMyScreen } from './screens/my.js';

let pendingWrite = null; // { guId, lat, lng }

async function main() {
  try {
    await initStore();
  } catch (e) {
    console.error('데이터 로드 실패', e);
    toast('데이터를 불러오지 못했어요. 새로고침으로 다시 시도해주세요.');
    return;
  }
  document.getElementById('app-title').textContent = CONFIG.APP_NAME;

  showScreen('map'); // 지도 컨테이너가 보이는 상태에서 Leaflet 초기화 (크기 0 방지)
  initMap({
    onDistrictClick: goDistrict,
    onMapTap: onMapTap,
  });
  initDistrictScreen({
    onWriteRequest: onWriteFromDistrict,
    onDataChange: refreshAll,
    onBack: () => { showScreen('map'); invalidateMapSize(); },
  });
  initMyScreen({ onDataChange: refreshAll });
  initDevBar();
  initTabs();
  initActionPanel();
  initWriteSheet();
}

function refreshAll() {
  refreshMap();
  renderRankingScreen();
  refreshDistrict();
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      showScreen(btn.dataset.screen);
      if (btn.dataset.screen === 'map') invalidateMapSize();
      if (btn.dataset.screen === 'ranking') renderRankingScreen();
      if (btn.dataset.screen === 'my') renderMyScreen();
    });
  });
}

function goDistrict(guId) {
  openDistrict(guId);
  showScreen('district');
}

// 지도 터치 → 하단 액션 패널 (유저 액션으로만 노출 — 진입 즉시 바텀시트 금지 준수)
function onMapTap(guId, lat, lng) {
  pendingWrite = { guId, lat, lng };
  const d = getDistrict(guId);
  document.getElementById('action-gu-name').textContent = d.name;
  document.getElementById('action-panel').hidden = false;
}

function initActionPanel() {
  document.getElementById('action-write').addEventListener('click', () => {
    document.getElementById('action-panel').hidden = true;
    tryOpenWriteSheet(pendingWrite.guId, pendingWrite.lat, pendingWrite.lng);
  });
  document.getElementById('action-detail').addEventListener('click', () => {
    document.getElementById('action-panel').hidden = true;
    goDistrict(pendingWrite.guId);
  });
  document.getElementById('action-close').addEventListener('click', () => {
    document.getElementById('action-panel').hidden = true;
  });
}

// 구 상세에서 글쓰기: 구 중심 근처 좌표 없음 → 지도에서 좌표를 고르게 안내하는 대신
// 프로토타입에선 해당 구 내 태그 평균 좌표 근처 랜덤 오프셋 사용
function onWriteFromDistrict(guId) {
  const s = getState();
  const guTags = s.tags.filter((t) => t.guId === guId);
  const base = guTags.length
    ? { lat: guTags[0].lat, lng: guTags[0].lng }
    : { lat: 37.5665, lng: 126.978 };
  tryOpenWriteSheet(guId, base.lat + (Math.random() - 0.5) * 0.01, base.lng + (Math.random() - 0.5) * 0.01);
}

function tryOpenWriteSheet(guId, lat, lng) {
  const eligible = canWriteIn(guId);
  if (!eligible.ok) { toast(eligible.message); return; }
  pendingWrite = { guId, lat, lng };
  const d = getDistrict(guId);
  document.getElementById('write-gu-name').textContent = d.name;
  // 원정 태그 고지 (설계서 §5) + 부정 후기 고지 (설계서 §7)
  document.getElementById('write-notice').textContent = eligible.isResident
    ? '특정 가게에 대한 부정적 후기는 삭제될 수 있어요'
    : '지금 계신 동네에 대한 이야기를 남겨주세요 · 특정 가게에 대한 부정적 후기는 삭제될 수 있어요';
  const input = document.getElementById('write-input');
  input.value = '';
  updateCharCount();
  document.getElementById('write-sheet').hidden = false;
  input.focus();
}

function updateCharCount() {
  const input = document.getElementById('write-input');
  document.getElementById('write-count').textContent = `${input.value.length}/${CONFIG.TAG_MAX_LENGTH}`;
}

function initWriteSheet() {
  const input = document.getElementById('write-input');
  input.maxLength = CONFIG.TAG_MAX_LENGTH;
  input.addEventListener('input', updateCharCount);
  document.getElementById('write-cancel').addEventListener('click', () => {
    document.getElementById('write-sheet').hidden = true;
  });
  document.getElementById('write-submit').addEventListener('click', () => {
    const r = createTag(pendingWrite.guId, pendingWrite.lat, pendingWrite.lng, input.value);
    toast(r.message);
    if (r.ok) {
      document.getElementById('write-sheet').hidden = true;
      refreshAll();
    }
  });
}

// 개발용 위치 시뮬레이션 바 — 실제 앱에서는 위치 SDK로 대체
function initDevBar() {
  const select = document.getElementById('dev-location');
  const s = getState();
  s.districts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .forEach((d) => select.add(new Option(d.name, d.guId)));
  select.value = getCurrentGuId() || '';
  select.addEventListener('change', () => {
    setCurrentGuId(select.value || null);
    if (select.value) {
      toast(`현재 위치: ${getDistrict(select.value).name} (시뮬레이션)`);
      panToDistrict(select.value);
    } else {
      toast('위치 꺼짐');
    }
  });
}

main();
