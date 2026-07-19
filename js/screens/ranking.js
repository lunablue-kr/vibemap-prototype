// 랭킹 시트 (설계서 §9-0): 주간 구 순위 + 구 레벨 + 불씨 + 내 기여도
// Phase 1: 총점+급상승 2부문만. 마스터태그는 Phase 2.
import { activeCategories, categoryRanking, weeklyStats, myWeeklyContribution } from './../ranking.js';
import { getTossKey } from './../mock-toss.js';
import { icon } from './../icons.js';

export function renderRankingSheet() {
  const my = myWeeklyContribution(getTossKey());
  const sections = activeCategories().map((cat) => {
    const rows = categoryRanking(cat.id).slice(0, 10).map((d, i) => `
      <li class="rank-row" data-gu="${d.guId}">
        <span class="rank-no">${i + 1}</span>
        <span class="rank-name"><small>Lv.${d.level}</small> ${d.name}</span>
        <span class="rank-val">${cat.id === 'rising' ? '×' + d.growth.toFixed(2) : d.score + '점'}</span>
      </li>`).join('');
    return `
      <section class="rank-section">
        <h3>${icon(cat.icon, 18)} ${cat.label}</h3>
        <ol class="rank-list">${rows || '<li class="empty">집계 대상 구가 없어요</li>'}</ol>
      </section>`;
  }).join('');

  document.getElementById('sheet-ranking').innerHTML = `
    <div class="sheet-grab"></div>
    <div class="sheet-title-row"><h2>주간 랭킹</h2><button data-close-sheet aria-label="닫기">✕</button></div>
    <p class="hint">월~일 집계 · 일요일 밤 주간 결산 발표</p>
    <p class="my-contribution">이번 주 내 기여: 태그 ${my.tags}개 · 리액션 ${my.reactions}개</p>
    ${sections}
    ${emberSection()}`;
}

function emberSection() {
  const embers = weeklyStats().filter((d) => d.isEmber);
  if (!embers.length) return '';
  return `
    <section class="rank-section ember">
      <h3>${icon('i-ember', 18)} 불씨</h3>
      <p class="ember-hint">이번 주 활성 기여자 10명이 모이면 랭킹에 들어가요</p>
      <p class="ember-list">${embers.map((d) => `${d.name}(${d.activeContributors}명)`).join(' · ')}</p>
    </section>`;
}
