const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// VAPID 설정
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEceyky9Ss-OZGysALzxz23UTf2IAd_tADpcL7rtGlJYY-ok8VD4YUH0AYQorgBAYsqhy6qwREtpPktHuUVIu1Y';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'DQOLtoLL41apYhOyUJYLqRDCR_23TWyBrdtIikkZA6A';
webpush.setVapidDetails(`mailto:${process.env.VAPID_EMAIL || 'tnwo0720@gmail.com'}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const dataFile = path.join(__dirname, 'data.json');

// groups: { [groupId]: { events, chatHistory, notes, pinnedMessage } }
let groups = {};
let pushSubscriptions = [];

function defaultGroup() {
    return { events: [], chatHistory: [], notes: {}, pinnedMessage: null };
}

function getGroup(id) {
    if (!groups[id]) groups[id] = defaultGroup();
    return groups[id];
}

// 데이터 로드 & 구버전 마이그레이션
if (fs.existsSync(dataFile)) {
    try {
        const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        if (parsed.groups) {
            groups = parsed.groups;
            // pinnedMessage 필드 보정
            Object.values(groups).forEach(g => { if (!('pinnedMessage' in g)) g.pinnedMessage = null; });
        } else {
            // 구버전 마이그레이션: 기존 데이터 → default 그룹
            groups.default = {
                events: parsed.events || [],
                chatHistory: parsed.chatHistory || [],
                notes: parsed.notes || {},
                pinnedMessage: null
            };
        }
        if (parsed.pushSubscriptions) pushSubscriptions = parsed.pushSubscriptions;
    } catch(e) { console.log('데이터 읽기 오류:', e); }
}

function saveData() {
    try {
        const groupsToSave = {};
        Object.entries(groups).forEach(([id, g]) => {
            groupsToSave[id] = {
                ...g,
                chatHistory: g.chatHistory.map(({ fileData, ...rest }) => rest)
            };
        });
        fs.writeFileSync(dataFile, JSON.stringify({ groups: groupsToSave, pushSubscriptions }));
    } catch(e) { console.log('데이터 저장 오류:', e); }
}

function sendPushToAll(payload) {
    const dead = [];
    pushSubscriptions.forEach((sub, i) => {
        webpush.sendNotification(sub, JSON.stringify(payload)).catch(() => dead.push(i));
    });
    if (dead.length > 0) {
        pushSubscriptions = pushSubscriptions.filter((_, i) => !dead.includes(i));
        saveData();
    }
}

// REST 엔드포인트
app.get('/vapid-public-key', (req, res) => res.json({ key: VAPID_PUBLIC_KEY }));

app.post('/subscribe', (req, res) => {
    const sub = req.body;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'invalid subscription' });
    if (!pushSubscriptions.some(s => s.endpoint === sub.endpoint)) {
        pushSubscriptions.push(sub); saveData();
    }
    res.json({ ok: true });
});

app.get('/api/groups', (req, res) => {
    res.json(Object.keys(groups));
});

// 그룹별 접속자 { [groupId]: { [socketId]: userData } }
const activeUsers = {};

io.on('connection', (socket) => {
    const groupId = (socket.handshake.query.group || 'default').trim().toLowerCase().replace(/[^a-z0-9가-힣_-]/g, '') || 'default';
    socket.join(groupId);

    const g = getGroup(groupId);
    socket.emit('init_data', { events: g.events, chatHistory: g.chatHistory, pinnedMessage: g.pinnedMessage, notes: g.notes });

    socket.on('user_joined', (userData) => {
        if (!activeUsers[groupId]) activeUsers[groupId] = {};
        const isNew = !activeUsers[groupId][socket.id];
        activeUsers[groupId][socket.id] = userData;
        io.to(groupId).emit('update_users', Object.values(activeUsers[groupId]));
        if (isNew) {
            io.to(groupId).emit('receive_message', {
                id: Date.now(), username: 'SYSTEM', text: `${userData.username}님이 입장했습니다 👋`,
                color: '#888', avatar: '📢', isSystem: true,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                reactions: { '👍': 0, '❤️': 0 }
            });
        }
    });

    socket.on('send_message', (data) => {
        const message = {
            id: Date.now(), username: data.username, text: data.text, color: data.color,
            avatar: data.avatar || '☕', reactions: { '👍': 0, '❤️': 0 },
            replyTo: data.replyTo || null, fileData: data.fileData || null,
            fileName: data.fileName || null, fileType: data.fileType || null,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };
        g.chatHistory.push(message);
        if (g.chatHistory.length > 200) g.chatHistory.shift();
        saveData();
        io.to(groupId).emit('receive_message', message);
    });

    socket.on('add_reaction', (data) => {
        const msg = g.chatHistory.find(m => m.id === data.msgId);
        if (msg) {
            msg.reactions = msg.reactions || { '👍': 0, '❤️': 0 };
            msg.reactions[data.reaction] = (msg.reactions[data.reaction] || 0) + 1;
            saveData();
            io.to(groupId).emit('update_reaction', { msgId: data.msgId, reactions: msg.reactions });
        }
    });

    socket.on('delete_message', (msgId) => {
        const user = activeUsers[groupId]?.[socket.id];
        const idx = g.chatHistory.findIndex(m => m.id === msgId);
        if (idx !== -1 && g.chatHistory[idx].username === (user?.username || '')) {
            g.chatHistory.splice(idx, 1);
            saveData();
            io.to(groupId).emit('message_deleted', msgId);
        }
    });

    socket.on('pin_message', (msg) => {
        g.pinnedMessage = msg;
        saveData();
        io.to(groupId).emit('message_pinned', g.pinnedMessage);
    });
    socket.on('unpin_message', () => {
        g.pinnedMessage = null;
        saveData();
        io.to(groupId).emit('message_unpinned');
    });

    socket.on('save_note', (data) => {
        if (data.text.trim()) g.notes[data.date] = data.text;
        else delete g.notes[data.date];
        saveData();
        io.to(groupId).emit('note_updated', { date: data.date, text: data.text });
    });

    socket.on('typing', (username) => socket.to(groupId).emit('user_typing', username));
    socket.on('stop_typing', () => socket.to(groupId).emit('user_stopped_typing'));

    socket.on('add_event', (eventData) => {
        const newEvent = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            date: eventData.date, title: eventData.title, username: eventData.username,
            color: eventData.color, avatar: eventData.avatar || '☕',
            isDday: eventData.isDday || false, category: eventData.category || '', votes: { attending: [], notAttending: [], undecided: [] }
        };
        g.events.push(newEvent);
        saveData();
        socket.to(groupId).emit('event_added', newEvent);
        io.to(groupId).emit('sync_events', g.events);
        sendPushToAll({ title: '📅 새 일정 추가', body: `${newEvent.username}님: ${newEvent.title}`, tag: 'event-added' });
    });

    socket.on('add_events_batch', (batchData) => {
        const newEvents = batchData.events.map((ev, i) => ({
            id: Date.now() + i * 10 + Math.floor(Math.random() * 10),
            date: ev.date, title: ev.title, username: ev.username, color: ev.color,
            avatar: ev.avatar || '☕', isDday: ev.isDday || false, category: ev.category || '',
            votes: { attending: [], notAttending: [], undecided: [] }
        }));
        g.events.push(...newEvents);
        saveData();
        const first = batchData.events[0]; const count = batchData.events.length;
        socket.to(groupId).emit('event_added', { username: first.username, title: `${first.title} (${count}일간)`, color: first.color });
        io.to(groupId).emit('sync_events', g.events);
        sendPushToAll({ title: '📅 새 일정 추가', body: `${first.username}님: ${first.title} (${count}일간)`, tag: 'event-added' });
    });

    socket.on('edit_event', (eventData) => {
        const idx = g.events.findIndex(e => e.id === eventData.id);
        if (idx !== -1) {
            g.events[idx].title = eventData.title;
            g.events[idx].date = eventData.date;
            if (eventData.isDday !== undefined) g.events[idx].isDday = eventData.isDday;
            saveData();
            io.to(groupId).emit('sync_events', g.events);
        }
    });

    socket.on('delete_event', (eventId) => {
        g.events = g.events.filter(e => e.id !== eventId);
        saveData();
        io.to(groupId).emit('sync_events', g.events);
    });

    socket.on('vote_event', ({ eventId, username, vote }) => {
        const ev = g.events.find(e => e.id === eventId);
        if (!ev) return;
        if (!ev.votes) ev.votes = { attending: [], notAttending: [], undecided: [] };
        ev.votes.attending    = ev.votes.attending.filter(u => u !== username);
        ev.votes.notAttending = ev.votes.notAttending.filter(u => u !== username);
        ev.votes.undecided    = ev.votes.undecided.filter(u => u !== username);
        if (vote === 'attending')    ev.votes.attending.push(username);
        if (vote === 'notAttending') ev.votes.notAttending.push(username);
        if (vote === 'undecided')    ev.votes.undecided.push(username);
        saveData();
        io.to(groupId).emit('sync_events', g.events);
    });

    socket.on('disconnect', () => {
        if (activeUsers[groupId]?.[socket.id]) {
            const name = activeUsers[groupId][socket.id].username;
            delete activeUsers[groupId][socket.id];
            io.to(groupId).emit('update_users', Object.values(activeUsers[groupId]));
            io.to(groupId).emit('receive_message', {
                id: Date.now(), username: 'SYSTEM', text: `${name}님이 나갔습니다`,
                color: '#888', avatar: '📢', isSystem: true,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                reactions: { '👍': 0, '❤️': 0 }
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`서버 오픈: http://localhost:${PORT}`));
