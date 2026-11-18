import type { CommentItem, LiveStatus } from './types';

const SIDECAR_URL = 'ws://localhost:21213';
const MAX_COMMENTS = 5000;

export interface SidecarState {
  isWsConnected: boolean;
  liveStatus: LiveStatus;
  targetUsername: string;
  viewerCount: number;
  commentsPerSec: number;
  totalComments: number;
  totalGifts: number;
  totalDiamonds: number;
  errorMessage: string | null;
}

export class SidecarClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private recentBatchCount = 0;
  private rateInterval: any = null;
  private listeners: Set<(comments: CommentItem[], state: SidecarState) => void> = new Set();
  private mockInterval: any = null;

  public comments: CommentItem[] = [];
  public state: SidecarState = {
    isWsConnected: false,
    liveStatus: 'DISCONNECTED',
    targetUsername: '',
    viewerCount: 0,
    commentsPerSec: 0,
    totalComments: 0,
    totalGifts: 0,
    totalDiamonds: 0,
    errorMessage: null,
  };

  constructor() {
    this.startRateCalculator();
    this.connectWs();
  }

  private startRateCalculator() {
    this.rateInterval = setInterval(() => {
      this.state.commentsPerSec = this.recentBatchCount;
      this.recentBatchCount = 0;
      this.notify();
    }, 1000);
  }

  public subscribe(fn: (comments: CommentItem[], state: SidecarState) => void) {
    this.listeners.add(fn);
    fn(this.comments, this.state);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const fn of this.listeners) {
      fn(this.comments, this.state);
    }
  }

  private connectWs() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(SIDECAR_URL);

      this.ws.onopen = () => {
        this.state.isWsConnected = true;
        this.state.errorMessage = null;
        this.notify();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleMessage(payload);
        } catch (e) {
          console.error('[SidecarClient] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.state.isWsConnected = false;
        this.notify();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.state.isWsConnected = false;
        this.notify();
      };
    } catch (_) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWs();
    }, 2000);
  }

  private handleMessage(payload: any) {
    switch (payload.event) {
      case 'INIT_STATE': {
        this.state.liveStatus = payload.status;
        this.state.targetUsername = payload.username || '';
        this.state.viewerCount = payload.viewerCount || 0;
        this.notify();
        break;
      }
      case 'STATUS': {
        this.state.liveStatus = payload.status;
        if (payload.username) this.state.targetUsername = payload.username;
        this.notify();
        break;
      }
      case 'CONNECTED': {
        this.state.liveStatus = 'CONNECTED';
        this.state.targetUsername = payload.username;
        this.state.errorMessage = null;
        this.notify();
        break;
      }
      case 'VIEWER_COUNT': {
        this.state.viewerCount = payload.count;
        this.notify();
        break;
      }
      case 'BATCH_COMMENTS': {
        const batch: CommentItem[] = payload.data || [];
        if (batch.length > 0) {
          this.recentBatchCount += batch.length;
          for (const item of batch) {
            if (item.type === 'chat') this.state.totalComments++;
            if (item.type === 'gift') {
              this.state.totalGifts += (item.repeatCount || 1);
              this.state.totalDiamonds += ((item.diamondCount || 0) * (item.repeatCount || 1));
            }
          }
          // Append batch and enforce Memory Capping (Section 5: max 5.000 item)
          this.comments = this.comments.concat(batch).slice(-MAX_COMMENTS);
          this.notify();
        }
        break;
      }
      case 'ERROR': {
        this.state.errorMessage = payload.message;
        this.state.liveStatus = 'DISCONNECTED';
        this.notify();
        break;
      }
    }
  }

  public connect(username: string) {
    this.stopMock();
    const cleanUsername = username.trim().replace(/^@/, '');
    if (!cleanUsername) return;

    this.state.targetUsername = cleanUsername;
    this.state.liveStatus = 'CONNECTING';
    this.state.errorMessage = null;
    this.notify();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'CONNECT', username: cleanUsername }));
    } else {
      this.connectWs();
      // Retry sending once connected
      const checkAndSend = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          clearInterval(checkAndSend);
          this.ws.send(JSON.stringify({ action: 'CONNECT', username: cleanUsername }));
        }
      }, 300);
      setTimeout(() => clearInterval(checkAndSend), 5000);
    }
  }

  public disconnect() {
    this.stopMock();
    this.state.liveStatus = 'DISCONNECTED';
    this.notify();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'DISCONNECT' }));
    }
  }

  public clearComments() {
    this.comments = [];
    this.state.totalComments = 0;
    this.state.totalGifts = 0;
    this.state.totalDiamonds = 0;
    this.notify();
  }

  // Demo simulator for testing UI, scrolling, & resizability instantly
  public startMock(username = 'demo_streamer') {
    this.disconnect();
    this.state.targetUsername = username;
    this.state.liveStatus = 'CONNECTED';
    this.state.viewerCount = 1420;
    this.state.errorMessage = null;
    this.notify();

    const sampleUsers = [
      { name: 'Alex_Gamer', nick: 'Alex' },
      { name: 'Sarah_Live', nick: 'Sarah' },
      { name: 'Budi_Santoso', nick: 'Budi Santoso' },
      { name: 'Rina_Cute', nick: 'Rina Chan' },
      { name: 'CyberWolf99', nick: 'Cyber Wolf' },
      { name: 'Vina_Dance', nick: 'Vina' },
      { name: 'GamerID', nick: 'PRO Player' }
    ];

    const sampleMsgs = [
      'Halo bang salam dari Jakarta!',
      'Keren banget gameplay nya!',
      'Follow balik dong kak',
      'GGWP seru banget gameplaynya',
      'Next game main apa bang?',
      'Semangat terus live streamingnya!',
      'Mantap banget posisinya',
      'First time nonton live ini, langsung betah!'
    ];

    const sampleGifts = [
      { name: 'Rose', diamonds: 1 },
      { name: 'TikTok Note', diamonds: 1 },
      { name: 'Heart Me', diamonds: 10 },
      { name: 'Cap', diamonds: 99 },
      { name: 'Dragon', diamonds: 1000 }
    ];

    this.mockInterval = setInterval(() => {
      const user = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
      const isGift = Math.random() < 0.2;

      let item: CommentItem;
      if (isGift) {
        const gift = sampleGifts[Math.floor(Math.random() * sampleGifts.length)];
        item = {
          id: `mock-gift-${Date.now()}-${Math.random()}`,
          type: 'gift',
          uniqueId: user.name,
          nickname: user.nick,
          giftName: gift.name,
          repeatCount: Math.floor(Math.random() * 5) + 1,
          diamondCount: gift.diamonds,
          timestamp: Date.now()
        };
        this.state.totalGifts += (item.repeatCount || 1);
        this.state.totalDiamonds += (gift.diamonds * (item.repeatCount || 1));
      } else {
        const msg = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)];
        item = {
          id: `mock-chat-${Date.now()}-${Math.random()}`,
          type: 'chat',
          uniqueId: user.name,
          nickname: user.nick,
          comment: msg,
          isSubscriber: Math.random() < 0.3,
          isModerator: Math.random() < 0.1,
          timestamp: Date.now()
        };
        this.state.totalComments++;
      }

      this.recentBatchCount++;
      this.comments = this.comments.concat([item]).slice(-MAX_COMMENTS);
      this.notify();
    }, 150);
  }

  public stopMock() {
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
  }

  public destroy() {
    if (this.rateInterval) clearInterval(this.rateInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopMock();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
