import { TikTokLiveConnection } from 'tiktok-live-connector';

const tiktokUsername = (process.argv[2] || 'target_username').replace(/^@/, '');
const tiktokLiveConnection = new TikTokLiveConnection(tiktokUsername, {
  processInitialData: false,
  enableExtendedGiftInfo: false,
  fetchRoomInfoOnConnect: true,
});

let commentBuffer = [];

// Event Handlers
tiktokLiveConnection.on('chat', (data) => {
  const commentText = data.content || data.comment || '';
  if (!commentText) return;

  const user = data.user || {};
  const avatarUrl = user.avatarThumb?.urls?.[0] || user.profilePicture?.urls?.[0] || data.profilePictureUrl || '';

  commentBuffer.push({
    id: data.common?.msgId || data.msgId,
    type: 'chat',
    userId: user.userId || data.userId,
    uniqueId: user.uniqueId || data.uniqueId || 'anonymous',
    nickname: user.nickname || data.nickname || user.uniqueId || 'Viewer',
    profilePictureUrl: avatarUrl,
    comment: commentText,
    timestamp: Date.now()
  });
});

tiktokLiveConnection.on('gift', (data) => {
  const user = data.user || {};
  const giftName = data.gift?.name || data.giftDetails?.giftName || data.giftName || 'Gift';
  const repeatCount = data.repeatCount || data.gift?.repeat_count || 1;
  const diamondCount = data.gift?.diamond_count || data.diamondCount || 0;
  const avatarUrl = user.avatarThumb?.urls?.[0] || data.profilePictureUrl || '';
  const giftIconUrl = data.gift?.image?.url_list?.[0] || data.giftPictureUrl || '';

  commentBuffer.push({
    id: data.common?.msgId || data.msgId,
    type: 'gift',
    nickname: user.nickname || data.nickname || user.uniqueId || 'Viewer',
    uniqueId: user.uniqueId || data.uniqueId || 'anonymous',
    giftName,
    giftPictureUrl: giftIconUrl,
    repeatCount,
    diamondCount,
    timestamp: Date.now()
  });
});

tiktokLiveConnection.on('like', (data) => {
  const user = data.user || {};
  commentBuffer.push({
    id: `like-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'like',
    nickname: user.nickname || data.nickname || user.uniqueId || 'Viewer',
    uniqueId: user.uniqueId || data.uniqueId || 'anonymous',
    likeCount: data.count || data.likeCount || 1,
    totalLikes: data.total || data.totalLikes,
    timestamp: Date.now()
  });
});

tiktokLiveConnection.on('member', (data) => {
  const user = data.user || {};
  commentBuffer.push({
    id: `member-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'member',
    nickname: user.nickname || data.nickname || user.uniqueId || 'Viewer',
    uniqueId: user.uniqueId || data.uniqueId || 'anonymous',
    timestamp: Date.now()
  });
});

tiktokLiveConnection.on('roomUser', (data) => {
  process.stdout.write(JSON.stringify({ event: 'VIEWER_COUNT', count: data.viewerCount || data.total || 0 }) + '\n');
});

tiktokLiveConnection.on('disconnected', () => {
  process.stdout.write(JSON.stringify({ event: 'STATUS', status: 'DISCONNECTED' }) + '\n');
});

tiktokLiveConnection.on('streamEnd', () => {
  process.stdout.write(JSON.stringify({ event: 'STATUS', status: 'STREAM_ENDED' }) + '\n');
});

// Flush batch ke stdout / IPC setiap 100ms
setInterval(() => {
  if (commentBuffer.length > 0) {
    const batch = commentBuffer.splice(0, commentBuffer.length);
    process.stdout.write(JSON.stringify({ event: 'BATCH_COMMENTS', data: batch }) + '\n');
  }
}, 100);

tiktokLiveConnection.connect().then(state => {
  process.stdout.write(JSON.stringify({ 
    event: 'CONNECTED', 
    roomId: state.roomId, 
    username: tiktokUsername 
  }) + '\n');
}).catch((err) => {
  process.stdout.write(JSON.stringify({ event: 'ERROR', message: err.message }) + '\n');
});
