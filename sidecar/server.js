import http from 'http';
import { WebSocketServer } from 'ws';
import { TikTokLiveConnection } from 'tiktok-live-connector';

const PORT = parseInt(process.env.PORT || '21213', 10);
const MAX_BUFFER_SIZE = 10000;

class RingBuffer {
  constructor(maxSize = MAX_BUFFER_SIZE) {
    this.maxSize = maxSize;
    this.buffer = [];
  }

  push(item) {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.splice(0, 1000);
    }
    this.buffer.push(item);
  }

  flush() {
    if (this.buffer.length === 0) return [];
    return this.buffer.splice(0, this.buffer.length);
  }

  clear() {
    this.buffer = [];
  }

  get length() {
    return this.buffer.length;
  }
}

const ringBuffer = new RingBuffer();
let activeConnection = null;
let currentUsername = null;
let viewerCount = 0;
let roomInfo = null;

// HTTP Server with dedicated Google TTS streaming proxy
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (parsedUrl.pathname === '/api/tts') {
      const q = parsedUrl.searchParams.get('q') || '';
      const tl = parsedUrl.searchParams.get('tl') || 'id';

      if (!q.trim()) {
        res.writeHead(400);
        res.end('Missing text query parameter q');
        return;
      }

      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(q)}`;
      const googleRes = await fetch(googleUrl, {
        headers: {
          'Referer': 'https://translate.google.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!googleRes.ok) {
        res.writeHead(googleRes.status);
        res.end('Google TTS returned status: ' + googleRes.status);
        return;
      }

      const audioBuffer = await googleRes.arrayBuffer();
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength,
        'Cache-Control': 'no-cache'
      });
      res.end(Buffer.from(audioBuffer));
      return;
    }
  } catch (err) {
    res.writeHead(500);
    res.end('Server error: ' + err.message);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocketServer({ server });
server.listen(PORT, () => {
  console.log(`[TikTok Sidecar] HTTP & WebSocket server running on port ${PORT}`);
});

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}

function emitLog(level, msg) {
  const payload = { event: 'LOG', level, message: msg, timestamp: Date.now() };
  console.log(`[TikTok Sidecar] [${level.toUpperCase()}] ${msg}`);
  broadcast(payload);
}

function setupTikTokConnection(username) {
  if (activeConnection) {
    try {
      activeConnection.disconnect();
    } catch (_) {}
    activeConnection = null;
  }

  ringBuffer.clear();
  currentUsername = username;
  viewerCount = 0;
  roomInfo = null;

  emitLog('info', `Connecting to @${username}...`);
  broadcast({ event: 'STATUS', status: 'CONNECTING', username });

  // 100% Free connection without EulerStream business features
function extractAvatar(user, data) {
  const u = user || {};
  const d = data || {};

  const candidates = [
    u.avatarThumb,
    u.avatarMedium,
    u.avatarLarge,
    u.avatar,
    u.profilePicture,
    d.avatarThumb,
    d.profilePicture,
    d.userDetails
  ];

  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string' && c.startsWith('http')) return c;
    if (Array.isArray(c.urlList) && c.urlList.length > 0) return c.urlList[0];
    if (Array.isArray(c.url_list) && c.url_list.length > 0) return c.url_list[0];
    if (Array.isArray(c.urls) && c.urls.length > 0) return c.urls[0];
    if (Array.isArray(c.profilePictureUrls) && c.profilePictureUrls.length > 0) return c.profilePictureUrls[0];
  }

  if (typeof d.profilePictureUrl === 'string' && d.profilePictureUrl.startsWith('http')) {
    return d.profilePictureUrl;
  }
  if (Array.isArray(d.profilePictureUrls) && d.profilePictureUrls.length > 0) {
    return d.profilePictureUrls[0];
  }
  if (typeof u.profilePictureUrl === 'string' && u.profilePictureUrl.startsWith('http')) {
    return u.profilePictureUrl;
  }
  return '';
}

function extractGiftImage(gift, data) {
  const g = gift || {};
  const d = data || {};
  const candidates = [g.image, g.icon, d.giftPictureUrl, d.giftDetails?.giftImage];
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'string' && c.startsWith('http')) return c;
    if (Array.isArray(c.urlList) && c.urlList.length > 0) return c.urlList[0];
    if (Array.isArray(c.url_list) && c.url_list.length > 0) return c.url_list[0];
    if (Array.isArray(c.urls) && c.urls.length > 0) return c.urls[0];
  }
  return '';
}

  const conn = new TikTokLiveConnection(username, {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    fetchRoomInfoOnConnect: true,
  });

  conn.on('chat', (data) => {
    try {
      const commentText = data.content || data.comment || '';
      if (!commentText) return;

      const user = data.user || {};
      const avatarUrl = extractAvatar(user, data);

      ringBuffer.push({
        id: data.common?.msgId || data.msgId || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'chat',
        userId: user.userId || data.userId,
        uniqueId: user.uniqueId || user.displayId || data.uniqueId || 'viewer',
        nickname: user.nickname || data.nickname || user.uniqueId || 'Viewer',
        profilePictureUrl: avatarUrl,
        comment: commentText,
        isModerator: !!data.isModerator,
        isSubscriber: !!data.isSubscriber,
        badges: data.userBadges || [],
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('[TikTok Sidecar] Chat parse error:', e.message);
    }
  });

  conn.on('gift', (data) => {
    try {
      const user = data.user || {};
      const giftName = data.gift?.name || data.giftDetails?.giftName || data.giftName || 'Gift';
      const repeatCount = data.repeatCount || data.gift?.repeat_count || 1;
      const diamondCount = data.gift?.diamond_count || data.diamondCount || 0;
      const avatarUrl = extractAvatar(user, data);
      const giftIconUrl = extractGiftImage(data.gift, data);

      ringBuffer.push({
        id: data.common?.msgId || data.msgId || `gift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'gift',
        userId: user.userId || data.userId,
        uniqueId: user.uniqueId || user.displayId || data.uniqueId || 'viewer',
        nickname: user.nickname || data.nickname || user.uniqueId || 'Viewer',
        profilePictureUrl: avatarUrl,
        giftName,
        giftPictureUrl: giftIconUrl,
        repeatCount,
        diamondCount,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('[TikTok Sidecar] Gift parse error:', e.message);
    }
  });

  conn.on('like', (data) => {
    try {
      const user = data.user || {};
      ringBuffer.push({
        id: `like-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'like',
        userId: user.userId || data.userId,
        uniqueId: user.uniqueId || user.displayId || data.uniqueId || 'viewer',
        nickname: user.nickname || data.nickname || user.uniqueId || 'Viewer',
        profilePictureUrl: extractAvatar(user, data),
        likeCount: data.count || data.likeCount || 1,
        totalLikes: data.total || data.totalLikes,
        timestamp: Date.now()
      });
    } catch (_) {}
  });

  conn.on('member', (data) => {
    try {
      const user = data.user || {};
      ringBuffer.push({
        id: `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'member',
        userId: user.userId || data.userId,
        uniqueId: user.uniqueId || user.displayId || data.uniqueId || 'viewer',
        nickname: user.nickname || data.nickname || user.uniqueId || 'Viewer',
        profilePictureUrl: extractAvatar(user, data),
        timestamp: Date.now()
      });
    } catch (_) {}
  });

  conn.on('roomUser', (data) => {
    try {
      viewerCount = data.viewerCount || data.total || viewerCount;
      broadcast({ event: 'VIEWER_COUNT', count: viewerCount });
    } catch (_) {}
  });

  conn.on('disconnected', () => {
    emitLog('warn', `Disconnected from @${username}`);
    broadcast({ event: 'STATUS', status: 'DISCONNECTED', username });
    if (activeConnection === conn) activeConnection = null;
  });

  conn.on('streamEnd', () => {
    emitLog('warn', `Live stream for @${username} has ended.`);
    broadcast({ event: 'STATUS', status: 'STREAM_ENDED', username });
    if (activeConnection === conn) activeConnection = null;
  });

  conn.connect().then(state => {
    activeConnection = conn;
    roomInfo = {
      roomId: state.roomId,
      roomInfo: state.roomInfo
    };
    emitLog('info', `Connected successfully to room ${state.roomId} (@${username})`);
    broadcast({ 
      event: 'CONNECTED', 
      roomId: state.roomId, 
      username,
      status: 'CONNECTED' 
    });
  }).catch((err) => {
    emitLog('error', `Connection error: ${err.message}`);
    broadcast({ event: 'ERROR', message: err.message, username });
    broadcast({ event: 'STATUS', status: 'DISCONNECTED', username });
    if (activeConnection === conn) activeConnection = null;
  });
}

function disconnectCurrent() {
  if (activeConnection) {
    try {
      activeConnection.disconnect();
    } catch (_) {}
    activeConnection = null;
  }
  const oldUsername = currentUsername;
  currentUsername = null;
  broadcast({ event: 'STATUS', status: 'DISCONNECTED', username: oldUsername });
  emitLog('info', 'Disconnected by user request.');
}

// 100ms Batching Dispatcher
setInterval(() => {
  const batch = ringBuffer.flush();
  if (batch.length > 0) {
    const payload = { event: 'BATCH_COMMENTS', data: batch };
    broadcast(payload);
    process.stdout.write(JSON.stringify(payload) + '\n');
  }
}, 100);

// WebSocket client connections
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    event: 'INIT_STATE',
    status: activeConnection ? 'CONNECTED' : 'DISCONNECTED',
    username: currentUsername,
    viewerCount,
    roomInfo
  }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      switch (parsed.action || parsed.type) {
        case 'CONNECT': {
          const username = (parsed.username || '').trim().replace(/^@/, '');
          if (username) {
            setupTikTokConnection(username);
          } else {
            ws.send(JSON.stringify({ event: 'ERROR', message: 'Username cannot be empty.' }));
          }
          break;
        }
        case 'DISCONNECT': {
          disconnectCurrent();
          break;
        }
        case 'PING': {
          ws.send(JSON.stringify({ event: 'PONG', timestamp: Date.now() }));
          break;
        }
        default: {
          console.warn(`[TikTok Sidecar] Unknown action:`, parsed);
        }
      }
    } catch (e) {
      console.error('[TikTok Sidecar] Invalid message payload:', e.message);
    }
  });

  ws.on('error', (err) => {
    console.error('[TikTok Sidecar] Client connection error:', err.message);
  });
});

process.on('SIGINT', () => {
  console.log('[TikTok Sidecar] Shutting down...');
  if (activeConnection) {
    try { activeConnection.disconnect(); } catch (_) {}
  }
  wss.close(() => process.exit(0));
});
