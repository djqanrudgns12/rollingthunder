import { supabase } from './supabase';

export interface Mission {
  id: string;
  type: 'daily' | 'weekly' | 'achievement' | 'hidden';
  title: string;
  description: string;
  goal_amount: number;
  reward_chips: number;
  reward_item_type: string | null;
  reward_item_code: string | null;
  condition_type: string;
}

export interface UserMission {
  id: string;
  user_id: string;
  mission_id: string;
  progress: number;
  completed: boolean;
  is_collected: boolean;
  assigned_date?: string; // For daily/weekly
  updated_at?: string; // For achievements
  mission: Mission;
}

class StampService {
  private localEvents: Record<string, number> = {};

  // 이벤트 로컬에 누적 (예: 점프 1회, 벽 충돌 1회 등)
  public trackEvent(conditionType: string, amount: number = 1) {
    if (!this.localEvents[conditionType]) {
      this.localEvents[conditionType] = 0;
    }
    this.localEvents[conditionType] += amount;
  }

  // 게임 종료 시 누적된 이벤트를 서버로 일괄 전송
  public async flushPlayEvents() {
    if (Object.keys(this.localEvents).length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // 로그인 안 된 경우 무시

      const { error } = await supabase.rpc('update_mission_progress', {
        p_user_id: user.id,
        p_events: this.localEvents
      });

      if (error) {
        console.error('Failed to flush stamp events:', error);
      } else {
        // 성공적으로 전송 시 로컬 캐시 초기화
        this.localEvents = {};
      }
    } catch (err) {
      console.error('Error flushing stamp events:', err);
    }
  }

  // 일일/주간 미션 강제 할당 (보통 로그인 시 혹은 백그라운드에서 호출)
  public async assignMissions(userId: string) {
    const { error } = await supabase.rpc('assign_random_missions', {
      p_user_id: userId
    });
    if (error) {
      console.error('Error assigning missions:', error);
    }
  }

  // 보상 수령
  public async claimReward(userId: string, tableType: 'mission' | 'achievement', recordId: string) {
    const { data, error } = await supabase.rpc('claim_mission_reward', {
      p_user_id: userId,
      p_table_type: tableType,
      p_record_id: recordId
    });

    if (error) {
      console.error('Error claiming reward:', error);
      throw error;
    }

    return data; // { chips, itemType, itemCode }
  }

  // 데이터 로드
  public async getUserMissions(userId: string, type: 'daily' | 'weekly') {
    const { data, error } = await supabase
      .from('user_missions')
      .select('*, mission:missions(*)')
      .eq('user_id', userId)
      .eq('mission.type', type)
      .order('completed', { ascending: true }) // 미완료 우선
      .order('is_collected', { ascending: true });
    
    // mission relation filter might need some care in post-processing depending on pgREST, 
    // but inner join via supabase JS handles this nicely by returning null for non-matching.
    if (error) throw error;
    return (data || []).filter((d: any) => d.mission !== null) as UserMission[];
  }

  public async getUserAchievements(userId: string) {
    // 모든 업적 목록과 유저의 진행 상태를 가져옴
    // Left join 처리가 필요하므로, missions 테이블을 기준으로 쿼리
    const { data, error } = await supabase
      .from('missions')
      .select('*, user_achievements(*)')
      .in('type', ['achievement', 'hidden']);
      
    if (error) throw error;

    // 포맷팅
    return (data || []).map((mission: any) => {
      const userRecord = mission.user_achievements.find((ua: any) => ua.user_id === userId);
      return {
        id: userRecord ? userRecord.id : 'unstarted',
        user_id: userId,
        mission_id: mission.id,
        progress: userRecord ? userRecord.progress : 0,
        completed: userRecord ? userRecord.completed : false,
        is_collected: userRecord ? userRecord.is_collected : false,
        mission: {
          id: mission.id,
          type: mission.type,
          title: mission.title,
          description: mission.description,
          goal_amount: mission.goal_amount,
          reward_chips: mission.reward_chips,
          reward_item_type: mission.reward_item_type,
          reward_item_code: mission.reward_item_code,
          condition_type: mission.condition_type
        }
      } as UserMission;
    }).sort((a, b) => {
      // 진행중인것 최상단, 완료/미수령 그 다음, 완료/수령 최하단
      if (a.completed && !a.is_collected) return -1;
      if (b.completed && !b.is_collected) return 1;
      if (a.is_collected && !b.is_collected) return 1;
      if (!a.is_collected && b.is_collected) return -1;
      return 0;
    });
  }
}

export const stampService = new StampService();
