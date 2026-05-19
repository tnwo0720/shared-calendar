const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs'); // 파일 저장을 위한 모듈 추가

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 파일 전송을 위해 최대 용량 증가 (약 100MB)

app.use(express.static(path.join(__dirname, 'public')));

const dataFile = path.join(__dirname, 'data.json');
let events = [];
let chatHistory = [];
let activeUsers = {}; 

// 서버 켜질 때 기존 저장된 데이터 불러오기
if (fs.existsSync(dataFile)) {
    try {
        const raw = fs.readFileSync(dataFile, 'utf8');
        const parsed = JSON.parse(raw);
        events = parsed.events || [];
        chatHistory = parsed.chatHistory || [];
    } catch(e) { console.log('데이터 읽기 오류:', e); }
}

// 데이터 파일에 쓰기(저장) 함수 — fileData(Base64)는 제외하여 용량 폭발 방지
function saveData() {
    try {
        const chatToSave = chatHistory.map(msg => {
            const { fileData, ...rest } = msg;
            return rest;
        });
        fs.writeFileSync(dataFile, JSON.stringify({ events, chatHistory: chatToSave }));
    } catch(e) { console.log('데이터 저장 오류:', e); }
}

let pinnedMessage = null;

io.on('connection', (socket) => {
    socket.emit('init_data', { events, chatHistory, pinnedMessage });

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
        // 알림은 1번만
        const first = batchData.events[0];
        const count = batchData.events.length;
        socket.broadcast.emit('event_added', { 
            username: first.username, 
            title: `${first.title} (${count}일간)`, 
            color: first.color 
        });
        io.emit('sync_events', events);
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
