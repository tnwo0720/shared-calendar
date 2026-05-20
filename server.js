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

// VAPID 설정 — Render 환경변수로 관리 (없으면 기본값 사용)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEceyky9Ss-OZGysALzxz23UTf2IAd_tADpcL7rtGlJYY-ok8VD4YUH0AYQorgBAYsqhy6qwREtpPktHuUVIu1Y';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'DQOLtoLL41apYhOyUJYLqRDCR_23TWyBrdtIikkZA6A';
webpush.setVapidDetails(`mailto:${process.env.VAPID_EMAIL || 'tnwo0720@gmail.com'}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const dataFile = path.join(__dirname, 'data.json');
let events = [];
let chatHistory = [];
let activeUsers = {};
let notes = {};
let pushSubscriptions = [];

// 서버 켜질 때 기존 저장된 데이터 불러오기
if (fs.existsSync(dataFile)) {
    try {
        const raw = fs.readFileSync(dataFile, 'utf8');
        const parsed = JSON.parse(raw);
        events = parsed.events || [];
        chatHistory = parsed.chatHistory || [];
        if(parsed.notes) notes = parsed.notes;
        if(parsed.pushSubscriptions) pushSubscriptions = parsed.pushSubscriptions;
    } catch(e) { console.log('데이터 읽기 오류:', e); }
}

// 데이터 파일에 쓰기(저장) 함수 — fileData(Base64)는 제외하여 용량 폭발 방지
function saveData() {
    try {
        const chatToSave = chatHistory.map(msg => {
            const { fileData, ...rest } = msg;
            return rest;
        });
        fs.writeFileSync(dataFile, JSON.stringify({ events, chatHistory: chatToSave, notes, pushSubscriptions }));
    } catch(e) { console.log('데이터 저장 오류:', e); }
}

// 모든 구독자에게 푸시 알림 전송
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

// 푸시 공개키 전달
app.get('/vapid-public-key', (req, res) => res.json({ key: VAPID_PUBLIC_KEY }));

// 푸시 구독 등록
app.post('/subscribe', (req, res) => {
    const sub = req.body;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: 'invalid subscription' });
    const exists = pushSubscriptions.some(s => s.endpoint === sub.endpoint);
    if (!exists) { pushSubscriptions.push(sub); saveData(); }
    res.json({ ok: true });
});

let pinnedMessage = null;

io.on('connection', (socket) => {
    socket.emit('init_data', { events, chatHistory, pinnedMessage, notes });

    socket.on('user_joined', (userData) => {
        const isNew = !activeUsers[socket.id];
        activeUsers[socket.id] = userData;
        io.emit('update_users', Object.values(activeUsers));
        if(isNew) {
            io.emit('receive_message', {
                id: Date.now(), username: 'SYSTEM', text: `${userData.username}님이 입장했습니다 👋`,
                color: '#888', avatar: '📢', isSystem: true,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                reactions: { '👍': 0, '❤️': 0 }
            });
        }
    });

    socket.on('send_message', (data) => {
        const message = {
            id: Date.now(),
            username: data.username,
            text: data.text,
            color: data.color,
            avatar: data.avatar || '☕',
            reactions: { '👍': 0, '❤️': 0 },
            replyTo: data.replyTo || null,
            fileData: data.fileData || null,
            fileName: data.fileName || null,
            fileType: data.fileType || null,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };
        chatHistory.push(message);
        if (chatHistory.length > 200) chatHistory.shift(); // 최근 200개 유지
        saveData();
        io.emit('receive_message', message);
    });
    
    // 리액션 처리
    socket.on('add_reaction', (data) => {
        const msg = chatHistory.find(m => m.id === data.msgId);
        if(msg) {
            msg.reactions = msg.reactions || { '👍': 0, '❤️': 0 };
            msg.reactions[data.reaction] = (msg.reactions[data.reaction] || 0) + 1;
            saveData();
            io.emit('update_reaction', { msgId: data.msgId, reactions: msg.reactions });
        }
    });
    
    // 메시지 삭제
    socket.on('delete_message', (msgId) => {
        const idx = chatHistory.findIndex(m => m.id === msgId);
        if(idx !== -1 && chatHistory[idx].username === (activeUsers[socket.id]?.username || '')) {
            chatHistory.splice(idx, 1);
            saveData();
            io.emit('message_deleted', msgId);
        }
    });

    // 메시지 고정(핀)
    socket.on('pin_message', (msg) => {
        pinnedMessage = msg;
        io.emit('message_pinned', pinnedMessage);
    });
    socket.on('unpin_message', () => {
        pinnedMessage = null;
        io.emit('message_unpinned');
    });

    // 공유 메모
    socket.on('save_note', (data) => {
        if(data.text.trim()) { notes[data.date] = data.text; }
        else { delete notes[data.date]; }
        saveData();
        io.emit('note_updated', { date: data.date, text: data.text });
    });

    // 타이핑 인디케이터
    socket.on('typing', (username) => {
        socket.broadcast.emit('user_typing', username);
    });
    socket.on('stop_typing', () => {
        socket.broadcast.emit('user_stopped_typing');
    });

    socket.on('add_event', (eventData) => {
        const newEvent = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            date: eventData.date,
            title: eventData.title,
            username: eventData.username,
            color: eventData.color,
            avatar: eventData.avatar || '☕',
            isDday: eventData.isDday || false,
            category: eventData.category || ''
        };
        events.push(newEvent);
        saveData();
        socket.broadcast.emit('event_added', newEvent);
        io.emit('sync_events', events);
        // 푸시 알림
        sendPushToAll({ title: '📅 새 일정 추가', body: `${newEvent.username}님: ${newEvent.title}`, tag: 'event-added' });
    });

    // 다중 일자 일정 일괄 추가 (알림 1회만 발생)
    socket.on('add_events_batch', (batchData) => {
        const newEvents = batchData.events.map((eventData, i) => ({
            id: Date.now() + i * 10 + Math.floor(Math.random() * 10),
            date: eventData.date,
            title: eventData.title,
            username: eventData.username,
            color: eventData.color,
            avatar: eventData.avatar || '☕',
            isDday: eventData.isDday || false,
            category: eventData.category || ''
        }));
        events.push(...newEvents);
        saveData();
        // 앱 내 알림
        const first = batchData.events[0];
        const count = batchData.events.length;
        socket.broadcast.emit('event_added', {
            username: first.username,
            title: `${first.title} (${count}일간)`,
            color: first.color
        });
        io.emit('sync_events', events);
        // 푸시 알림
        sendPushToAll({ title: '📅 새 일정 추가', body: `${first.username}님: ${first.title} (${count}일간)`, tag: 'event-added' });
    });
    
    socket.on('edit_event', (eventData) => {
        const index = events.findIndex(e => e.id === eventData.id);
        if(index !== -1) {
            events[index].title = eventData.title;
            events[index].date = eventData.date;
            if(eventData.isDday !== undefined) events[index].isDday = eventData.isDday;
            saveData();
            io.emit('sync_events', events);
        }
    });

    socket.on('delete_event', (eventId) => {
        events = events.filter(e => e.id !== eventId);
        saveData();
        io.emit('sync_events', events);
    });

    socket.on('disconnect', () => {
        if (activeUsers[socket.id]) {
            const name = activeUsers[socket.id].username;
            delete activeUsers[socket.id];
            io.emit('update_users', Object.values(activeUsers));
            io.emit('receive_message', {
                id: Date.now(), username: 'SYSTEM', text: `${name}님이 나갔습니다`,
                color: '#888', avatar: '📢', isSystem: true,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                reactions: { '👍': 0, '❤️': 0 }
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버 오픈: http://localhost:${PORT}`);
});
