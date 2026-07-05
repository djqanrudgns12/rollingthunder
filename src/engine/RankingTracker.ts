import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export interface ParticipantRank {
  id: string;
  y: number;
  rank: number;
}

export class RankingTracker {
  // [성능 최적화] activeChips 배열을 직접 받아 순위 산정 — forEachRigidBody 제거.
  // 왜: world.forEachRigidBody는 칩 외의 모든 강체(벽, 기물)도 순회하므로 낭비.
  // activeChips는 칩만 담긴 배열이라 불필요한 타입 체크가 사라진다.
  static updateRankingsFromChips(activeChips: RAPIER.RigidBody[]): ParticipantRank[] {
    const participants: ParticipantRank[] = [];

    for (const body of activeChips) {
      const data = body.userData as UserData;
      if (data && data.type === 'chip' && data.id) {
        participants.push({
          id: data.id,
          y: body.translation().y,
          rank: 0 
        });
      }
    }

    // Y값이 큰 순서대로 내림차순 정렬
    participants.sort((a, b) => b.y - a.y);

    // 순위 배정
    participants.forEach((p, index) => {
      p.rank = index + 1;
    });

    return participants;
  }

  // 하위 호환: world를 직접 받는 기존 메서드 유지 (에디터 프리뷰 등에서 사용 가능)
  static updateRankings(world: RAPIER.World): ParticipantRank[] {
    const participants: ParticipantRank[] = [];

    world.forEachRigidBody((body) => {
      const data = body.userData as UserData;
      if (data && data.type === 'chip' && data.id) {
        participants.push({
          id: data.id,
          y: body.translation().y,
          rank: 0 
        });
      }
    });

    // Y값이 큰 순서대로 내림차순 정렬
    participants.sort((a, b) => b.y - a.y);

    // 순위 배정
    participants.forEach((p, index) => {
      p.rank = index + 1;
    });

    return participants;
  }
}
