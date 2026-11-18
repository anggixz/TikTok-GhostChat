export type EventType = 'chat' | 'gift' | 'like' | 'member';

export interface CommentItem {
  id: string;
  type: EventType;
  userId?: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  comment?: string;
  giftName?: string;
  giftPictureUrl?: string;
  repeatCount?: number;
  diamondCount?: number;
  likeCount?: number;
  totalLikes?: number;
  isModerator?: boolean;
  isSubscriber?: boolean;
  badges?: any[];
  timestamp: number;
}

export type LiveStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'STREAM_ENDED';

export interface WindowPreset {
  label: string;
  width: number;
  height: number;
}
