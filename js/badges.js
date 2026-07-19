// 뱃지 획득 계산 (설계서 §8 보상·§12 (A) 뱃지 확장) — badgeExpansion 플래그 게이트.
// 클라이언트 계산 가능 3종(첫 태그·한 구 10회·5개 구 방문) + 서버 의존 1종(정복 훈장).
// 새 비주얼 없이 기존 vibe-icons.svg 심볼만 재사용 (i-hip/i-crown/i-flag/i-medal).
import { CONFIG } from './config.js';
import { getState } from './store.js';
import { getTossKey } from './mock-toss.js';
import { conquestEarned } from './phase2.js';

// 현재 유저가 획득한/미획득 뱃지 목록. 각 항목: { id, icon, label, hint, earned }
// 라벨·힌트는 해요체 임시 초안 (카피 감수 대상).
export function computeBadges() {
  const s = getState();
  const key = getTossKey();
  // 공개 태그만 집계 — 보류(held)·블라인드 태그는 뱃지 기여 제외(지도·랭킹과 동일 기준)
  const myTags = s.tags.filter((t) => t.tossKey === key && t.state === 'public');

  const perGu = {};
  const guSet = new Set();
  myTags.forEach((t) => {
    perGu[t.guId] = (perGu[t.guId] || 0) + 1;
    guSet.add(t.guId);
  });
  const maxGuCount = Object.values(perGu).reduce((m, n) => Math.max(m, n), 0);

  const badges = [
    {
      id: 'first-tag', icon: 'i-hip', label: '첫 태그',
      hint: '첫 태그를 남기면 받아요',
      earned: !!s.user.firstTagDone,
    },
    {
      id: 'gu-master', icon: 'i-crown', label: '동네 터줏대감',
      hint: `한 동네에 태그 ${CONFIG.BADGE_GU_POST_COUNT}개를 남기면 받아요`,
      earned: maxGuCount >= CONFIG.BADGE_GU_POST_COUNT,
    },
    {
      id: 'explorer', icon: 'i-flag', label: '동네 탐험가',
      hint: `서로 다른 ${CONFIG.BADGE_DISTINCT_GU}개 동네에 태그를 남기면 받아요`,
      earned: guSet.size >= CONFIG.BADGE_DISTINCT_GU,
    },
  ];

  // 정복 훈장: 명예의 전당(서버 주간 배치) 의존 — conquestMedal 플래그 on일 때만 노출·집계.
  // 데이터 없으면 미획득. 프로토타입엔 hallOfFame 빈 배열이라 항상 미획득 상태로 표시.
  if (CONFIG.FLAGS.conquestMedal) {
    badges.push({
      id: 'conquest', icon: 'i-medal', label: '정복 훈장',
      hint: '내 방문 태그가 다른 동네 명예의 전당에 오르면 받아요',
      earned: conquestEarned(key),
    });
  }
  return badges;
}
