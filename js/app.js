// 앱 진입점 (v0.5 IA): 지도 전체화면 + 플로팅 칩·마이 + 시트/팝업/작성창 배선
import { CONFIG } from './config.js';
import { initStore, getState, getDistrict, resetAll } from './store.js';
import { loadDictionary } from './moderation.js';
import { initMap, refreshMap, updateSingleTag, renderTags, panToDistrict, invalidateMapSize } from './map.js';
import { getCurrentGuId, setCurrentGuId } from './mock-toss.js';
import { toast, openSheet, closeSheets } from './ui.js';
import { initPopup, openPopup, closePopup, isPopupOpen } from './popup.js';
import { initComposer, openComposer, closeComposer, isComposerOpen } from './composer.js';
import { initChip, renderChip } from './chips.js';
import { initDistrictSheet, openDistrict, refreshDistrict } from './screens/district.js';
import { renderRankingSheet } from './screens/ranking.js';
import { initMySheet, renderMySheet } from './screens/my.js';

// iOS Safari는 뷰포트 메타·touch-action으로 페이지 핀치줌이 안 막힘 — 사파리 전용
// 제스처 이벤트를 직접 차단 (지도 핀치줌은 Leaflet이 터치 이벤트로 자체 처리라 영향 없음)
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) =>
  document.addEventListener(type, (e) => e.preventDefault())
);

async function main() {
  try {
    await Promise.all([initStore(), loadDictionary()]);
  } catch (e) {
    console.error('데이터 로드 실패', e);
    toast('데이터를 불러오지 못했어요. 새로고침으로 다시 시도해주세요.');
    return;
  }

  initMap({
    // 태그 탭은 오버레이 열림 여부와 무관하게 동작 (팝업 전환 — 연속 탐색)
    onTagClick: (tagId) => { closeComposer(); openPopup(tagId); },
    // 빈 곳 탭: 오버레이(팝업·작성창)가 떠 있으면 "닫기만" — 밑의 액션 실행 안 함
    onEmptyTap: (guId, lat, lng) => {
      // 오버레이를 닫은 그 탭의 지연 콜백이면 소비하고 끝 (닫기만, 액션 없음)
      if (consumeSuppression()) return;
      if (isPopupOpen() || isComposerOpen()) { dismissOverlays(); return; }
      openComposer(guId, lat, lng);
    },
    // 지도 어디를 탭해도(폴리곤 밖 회색 포함) 즉시 닫기. 태그 탭은 예외
    onBareMapTap: (e) => {
      const target = e.originalEvent?.target;
      if (target?.closest?.('.tag-marker')) return;
      dismissOverlays(true); // 탭에 의한 닫기 → 같은 탭의 지연 콜백 억제
    },
    // 지도 조작(팬·줌) 시작 = 자연스럽게 닫힘 (B안). 억제 불필요 — 탭이 아니므로
    onMapMoveStart: () => dismissOverlays(false),
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

// 오버레이(팝업·작성창) 일괄 닫기.
// suppress=true(탭에 의한 닫기)면 그 탭의 폴리곤 지연 콜백(작성창 열기)이 실행되지 않도록
// 1회용 억제 플래그를 세움. 팬·줌에 의한 닫기는 억제 불필요 (다음 탭을 삼키면 안 됨).
// 플래그는 다음 콜백이 소비하거나 1.5초 후 만료 (더블탭 줌으로 콜백이 취소되는 경우 대비)
let suppressUntil = 0;
function dismissOverlays(suppress) {
  if (isPopupOpen() || isComposerOpen()) {
    closePopup();
    closeComposer();
    if (suppress) suppressUntil = Date.now() + 1500;
  }
}
function consumeSuppression() {
  if (Date.now() < suppressUntil) {
    suppressUntil = 0;
    return true;
  }
  return false;
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
