// 앱 진입점 (v0.5 IA): 지도 전체화면 + 플로팅 칩·마이 + 시트/팝업/작성창 배선
import { CONFIG } from './config.js';
import { initStore, getState, getDistrict, resetAll } from './store.js';
import { loadDictionary } from './moderation.js';
import { initMap, refreshMap, updateSingleTag, renderTags, panToDistrict, invalidateMapSize } from './map.js';
import { getCurrentGuId, setCurrentGuId } from './mock-toss.js';
import { toast, openSheet, closeSheets } from './ui.js';
import { initPopup, openPopup, closePopup } from './popup.js';
import { initComposer, openComposer, closeComposer } from './composer.js';
import { initChip, renderChip } from './chips.js';
import { initDistrictSheet, openDistrict, refreshDistrict } from './screens/district.js';
import { renderRankingSheet } from './screens/ranking.js';
import { initMySheet, renderMySheet } from './screens/my.js';

async function main() {
  try {
    await Promise.all([initStore(), loadDictionary()]);
  } catch (e) {
    console.error('데이터 로드 실패', e);
    toast('데이터를 불러오지 못했어요. 새로고침으로 다시 시도해주세요.');
    return;
  }

  initMap({
    onTagClick: (tagId) => { closeComposer(); openPopup(tagId); },
    onEmptyTap: (guId, lat, lng) => { closePopup(); openComposer(guId, lat, lng); },
  });

  initPopup({
    onChange: (tagId) => { updateSingleTag(tagId); refreshDistrict(); renderChip(); },
    onOpenDistrict: goDistrict,
  });
  initComposer({
    onCreated: () => { renderTags(); refreshDistrict(); renderChip(); renderMySheet(); },
    onOpenDistrict: goDistrict,
  });
  initChip(() => { closePopup(); closeComposer(); renderRankingSheet(); openSheet('ranking'); });
  initDistrictSheet({ onDataChange: (tagId) => { updateSingleTag(tagId); renderChip(); } });
  initMySheet({ onDataChange: () => { refreshMap(); renderMySheet(); } });

  document.getElementById('my-icon').addEventListener('click', () => {
    closePopup();
    closeComposer();
    renderMySheet();
    openSheet('my');
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('프로토타입 데이터를 초기화할까요?')) resetAll();
  });
  document.getElementById('sheet-dim').addEventListener('click', closeSheets);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-sheet]')) closeSheets();
  });

  initDevBar();
  invalidateMapSize();
}

function goDistrict(guId) {
  openDistrict(guId);
}

// 개발용 위치 시뮬레이션 바 — 실제 앱에서는 위치 SDK로 대체
function initDevBar() {
  const select = document.getElementById('dev-location');
  getState().districts
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
