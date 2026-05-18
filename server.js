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

// 데이터 파일에 쓰기(저장) 함수
function saveData() {
    try { fs.writeFileSync(dataFile, JSON.stringify({ events, chatHistory })); } 
    catch(e) { console.log('데이터 저장 오류:', e); }
}

io.on('connection', (socket) => {
    socket.emit('init_data', { events, chatHistory });

    socket.on('user_joined', (userData) => {
        activeUsers[socket.id] = userData;
        io.emit('update_users', Object.values(activeUsers));
    });

    socket.on('send_message', (data) => {
        const message = {
            id: Date.now(),
            username: data.username,
            text: data.text,
            color: data.color,
            fileData: data.fileData || null,
            fileName: data.fileName || null,
            fileType: data.fileType || null,
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        };
        chatHistory.push(message);
        if (chatHistory.length > 50) chatHistory.shift(); // 메모리 관리를 위해 최근 50개 유지
        saveData(); // 채팅 발생 시 저장
        io.emit('receive_message', message);
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
            id: Date.now() + Math.floor(Math.random() * 1000), // 고유 ID 확률 높임
            date: eventData.date,
            title: eventData.title,
            username: eventData.username,
            color: eventData.color,
            isDday: eventData.isDday || false
        };
        events.push(newEvent);
        saveData(); // 일정 추가 시 저장
        socket.broadcast.emit('event_added', newEvent);
        io.emit('sync_events', events);
    });
    
    socket.on('edit_event', (eventData) => {
        const index = events.findIndex(e => e.id === eventData.id);
        if(index !== -1) {
            events[index].title = eventData.title;
            events[index].date = eventData.date;
            if(eventData.isDday !== undefined) events[index].isDday = eventData.isDday;
            saveData(); // 일정 수정 시 저장
            io.emit('sync_events', events);
        }
    });

    socket.on('delete_event', (eventId) => {
        events = events.filter(e => e.id !== eventId);
        saveData(); // 일정 삭제 시 저장
        io.emit('sync_events', events);
    });

    socket.on('disconnect', () => {
        if (activeUsers[socket.id]) {
            delete activeUsers[socket.id];
            io.emit('update_users', Object.values(activeUsers));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버 오픈: http://localhost:${PORT}`);
});
