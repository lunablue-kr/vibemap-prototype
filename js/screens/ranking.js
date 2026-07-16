// 랭킹 화면: 주간 구 순위 + 구 레벨 + 내 기여도 (설계서 §9-1번 화면 구성 3)
// 출시 시점 활성 부문: 최다 활동(총점) + 급상승 (설계서 §8 활성화 조건)
import { activeCategories, categoryRanking, weeklyStats, myWeeklyContribution } from './../ranking.js';
import { getTossKey } from './../mock-toss.js';

export function renderRankingScreen() {
  const my = myWeeklyContribution(getTossKey());
  document.getElementById('my-contribution').textContent =
    `이번 주 내 기여: 태그 ${my.tags}개 · 리액션 ${my.reactions}개`;

  const container = document.getElementById('ranking-categories');
  container.innerHTML = activeCategories().map((cat) => {
    const rows = categoryRanking(cat.id).slice(0, 10).map((d, i) => `
      <li class="rank-row">
        <span class="rank-no">${i + 1}</span>
        <span class="rank-name">${d.name} <small>Lv.${d.level}</small></span>
        <span class="rank-val">${cat.id === 'rising' ? '×' + d.growth.toFixed(2) : d.score + '점'}</span>
      </li>`).join('');
    return `
      <section class="rank-section">
        <h3>${cat.label}</h3>
        <ol class="rank-list">${rows || '<li class="empty">집계 대상 구가 없어요</li>'}</ol>
      </section>`;
  }).join('') + emberSection();
}

// 불씨 구: 주간 활성 기여자 10명 미만 → 집계 제외, 목표 부여 (설계서 §8 악용 방지)
function emberSection() {
  const embers = weeklyStats().filter((d) => d.isEmber);
  if (!embers.length) return '';
  return `
    <section class="rank-section ember">
      <h3>🔥 불씨</h3>
      <p class="ember-hint">이번 주 활성 기여자 10명이 모이면 랭킹에 들어가요</p>
      <p class="ember-list">${embers.map((d) => `${d.name}(${d.activeContributors}명)`).join(' · ')}</p>
    </section>`;
}
