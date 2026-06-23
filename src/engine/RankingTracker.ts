import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

export interface ParticipantRank {
  id: string;
  y: number;
  rank: number;
}

export class RankingTracker {
  // Y좌표 기준으로 순위를 산정 (Canvas 좌표계에서 Y값이 클수록 아래쪽이므로 더 많이 진행한 것)
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
