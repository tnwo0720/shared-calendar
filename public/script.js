const socket = io();

// 전역 변수
let myUsername = '';
let myColor = '#ff6b6b';
let myAvatar = '☕';
let currentDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let eventsList = [];
let weatherData = {};
let typingTimeout = null;
let myCategory = '';
let replyToMsg = null;
let lastChatDate = '';
let chatOpen = false;
let unreadCount = 0;

// DOM
const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username-input');
const colorOptions = document.querySelectorAll('.color-option');
const avatarOptions = document.querySelectorAll('.avatar-option');
const joinBtn = document.getElementById('join-btn');
const myColorBadge = document.getElementById('my-color-badge');
const myUsernameDisplay = document.getElementById('my-username-display');
const logoutBtn = document.getElementById('logout-btn');
const toastContainer = document.getElementById('toast-container');
const themeToggle = document.getElementById('theme-toggle');

const eventIdInput = document.getElementById('edit-event-id');
const eventDateInput = document.getElementById('event-date');
const eventEndDateInput = document.getElementById('event-end-date');
const eventTitleInput = document.getElementById('event-title');
const eventIsDdayInput = document.getElementById('event-is-dday');
const addEventBtn = document.getElementById('add-event-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const eventFormTitle = document.getElementById('event-form-title');

// 테마 (다크모드)
let isDarkMode = localStorage.getItem('cal_theme') === 'dark';
if(isDarkMode) { document.body.classList.add('dark-mode'); themeToggle.textContent = '☀️'; }
themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    localStorage.setItem('cal_theme', isDarkMode ? 'dark' : 'light');
});

// 자동 로그인
function checkSavedLogin() {
    const savedName = localStorage.getItem('cal_username');
    const savedColor = localStorage.getItem('cal_color');
    const savedAvatar = localStorage.getItem('cal_avatar');
    if (savedName && savedColor) {
        myUsername = savedName; myColor = savedColor;
        if(savedAvatar) myAvatar = savedAvatar;
        loginOverlay.classList.add('hidden');
        updateProfileUI(); fetchWeather(); initCalendar();
    } else { loginOverlay.classList.remove('hidden'); }
}

colorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        colorOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        myColor = opt.dataset.color;
    });
});

avatarOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        avatarOptions.forEach(o => { o.classList.remove('selected'); o.style.opacity = '0.5'; o.style.transform = 'scale(1)'; });
        opt.classList.add('selected');
        opt.style.opacity = '1';
        opt.style.transform = 'scale(1.2)';
        myAvatar = opt.dataset.avatar;
    });
});

usernameInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') joinBtn.click(); });

joinBtn.addEventListener('click', () => {
    const val = usernameInput.value.trim();
    if(val.length > 0) {
        myUsername = val;
        localStorage.setItem('cal_username', myUsername);
        localStorage.setItem('cal_color', myColor);
        localStorage.setItem('cal_avatar', myAvatar);
        document.querySelector('.login-box h2').textContent = '환영합니다!';
        joinBtn.textContent = '입장하기';
        loginOverlay.classList.add('hidden');
        updateProfileUI(); fetchWeather(); initCalendar();
    } else { alert("이름을 입력해주세요!"); }
});

logoutBtn.addEventListener('click', () => {
    usernameInput.value = myUsername;
    colorOptions.forEach(o => { o.classList.toggle('selected', o.dataset.color === myColor); });
    document.querySelector('.login-box h2').textContent = '프로필 수정';
    joinBtn.textContent = '수정 완료';
    loginOverlay.classList.remove('hidden');
});

function updateProfileUI() {
    myUsernameDisplay.textContent = myUsername;
    myColorBadge.style.backgroundColor = myColor;
    document.getElementById('my-avatar-display').textContent = myAvatar;
    eventDateInput.valueAsDate = new Date();
    socket.emit('user_joined', { username: myUsername, color: myColor, avatar: myAvatar });
}

// 카테고리 선택
const catOptions = document.querySelectorAll('.cat-option');
catOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        catOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        myCategory = opt.dataset.cat;
    });
});

// 이모지 피커
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
});
emojiPicker.querySelectorAll('span').forEach(em => {
    em.addEventListener('click', () => {
        chatInput.value += em.textContent;
        emojiPicker.classList.add('hidden');
        chatInput.focus();
    });
});
document.addEventListener('click', () => emojiPicker.classList.add('hidden'));

// 답장 기능
const replyPreview = document.getElementById('reply-preview');
const replyPreviewText = document.getElementById('reply-preview-text');
const replyCancelBtn = document.getElementById('reply-cancel');

function setReply(msg) {
    replyToMsg = { username: msg.username, text: msg.text || msg.fileName || '' };
    replyPreviewText.textContent = `↩️ ${msg.username}: ${replyToMsg.text}`;
    replyPreview.classList.remove('hidden');
    chatInput.focus();
}
replyCancelBtn.addEventListener('click', () => {
    replyToMsg = null;
    replyPreview.classList.add('hidden');
});

// 플로팅 채팅 패널 토글
const chatFab = document.getElementById('chat-fab');
const chatPanel = document.getElementById('chat-panel');
const chatCloseBtn = document.getElementById('chat-close');
const unreadBadge = document.getElementById('unread-badge');

chatFab.addEventListener('click', () => {
    chatOpen = !chatOpen;
    chatPanel.classList.toggle('hidden', !chatOpen);
    if(chatOpen) {
        unreadCount = 0;
        unreadBadge.classList.add('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatInput.focus();
    }
});
chatCloseBtn.addEventListener('click', () => {
    chatOpen = false;
    chatPanel.classList.add('hidden');
});

function updateUnread() {
    if(!chatOpen) {
        unreadCount++;
        unreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        unreadBadge.classList.remove('hidden');
    }
}

function showToast(message, color) {
    const toast = document.createElement('div');
    toast.className = 'toast'; toast.style.borderLeftColor = color;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { if(toastContainer.contains(toast)) toastContainer.removeChild(toast); }, 4500);
}

// Socket
socket.on('init_data', (data) => {
    eventsList = data.events;
    const cm = document.getElementById('chat-messages');
    cm.innerHTML = '';
    lastChatDate = '';
    data.chatHistory.forEach(msg => appendMessage(msg));
    if(myUsername) { initCalendar(); updateDdayBanner(); }
});

socket.on('sync_events', (events) => {
    eventsList = events;
    if(myUsername) { initCalendar(); updateDdayBanner(); }
});

socket.on('update_users', (users) => {
    const container = document.getElementById('active-users-container');
    container.innerHTML = '';
    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'online-user-badge';
        div.innerHTML = `<div class="msg-avatar" style="background: ${u.color}; width:20px; height:20px; font-size:0.7rem;">${u.avatar || '☕'}</div><span>${u.username}</span>`;
        container.appendChild(div);
    });
});

socket.on('event_added', (e) => {
    showToast(`🔔 <b>${e.username}</b>님이 새 일정 추가: ${e.title}`, e.color);
});

socket.on('receive_message', (msg) => {
    appendMessage(msg);
    updateUnread();
});

// 타이핑 인디케이터
const typingIndicator = document.getElementById('typing-indicator');
let activeTypers = new Set();
socket.on('user_typing', (user) => {
    activeTypers.add(user);
    updateTypingIndicator();
});
socket.on('user_stopped_typing', () => {
    activeTypers.clear(); // 단순화: 누군가 멈추면 일단 다 지움
    updateTypingIndicator();
});
function updateTypingIndicator() {
    if(activeTypers.size > 0) {
        typingIndicator.textContent = Array.from(activeTypers).join(', ') + '님이 입력 중...💬';
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.classList.add('hidden');
    }
}

// 채팅 기능
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const chatFileInput = document.getElementById('chat-file-input');
let selectedFile = null;

chatFileInput.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        chatInput.placeholder = `[${selectedFile.name}] 전송 대기중...`;
    }
});

chatInput.addEventListener('input', () => {
    socket.emit('typing', myUsername);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('stop_typing'), 1500);
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if(!text && !selectedFile) return;

    if (selectedFile) {
        if(selectedFile.size > 5 * 1024 * 1024) { // 5MB 제한
            alert("파일은 5MB 이하만 전송 가능합니다.");
            return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
            socket.emit('send_message', { 
                username: myUsername, text: text, color: myColor, avatar: myAvatar,
                fileData: evt.target.result, fileName: selectedFile.name, fileType: selectedFile.type
            });
            resetChatInput();
        };
        reader.readAsDataURL(selectedFile);
    } else {
        socket.emit('send_message', { username: myUsername, text: text, color: myColor, avatar: myAvatar, replyTo: replyToMsg });
        resetChatInput();
    }
});

function resetChatInput() {
    chatInput.value = '';
    chatInput.placeholder = "메시지 입력...";
    selectedFile = null;
    chatFileInput.value = '';
    socket.emit('stop_typing');
    replyToMsg = null;
    replyPreview.classList.add('hidden');
}

function appendMessage(msg) {
    // 시스템 메시지
    if(msg.isSystem) {
        const sysDiv = document.createElement('div');
        sysDiv.className = 'system-message';
        sysDiv.textContent = msg.text;
        chatMessages.appendChild(sysDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return;
    }
    
    // 날짜 구분선
    const msgDate = msg.time ? new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' }) : '';
    if(msg.time && msgDate !== lastChatDate) {
        lastChatDate = msgDate;
        const divider = document.createElement('div');
        divider.className = 'chat-date-divider';
        divider.textContent = msgDate;
        chatMessages.appendChild(divider);
    }
    
    const isMine = msg.username === myUsername;
    const div = document.createElement('div');
    div.className = `message ${isMine ? 'mine' : 'others'}`;
    
    let parsedText = msg.text || '';
    if (parsedText) {
        parsedText = parsedText.replace(/@([가-힣a-zA-Z0-9]+)/g, '<span style="color:var(--primary); font-weight:800; background:rgba(195,154,107,0.2); padding:2px 4px; border-radius:4px;">@$1</span>');
    }
    
    let contentHtml = '';
    // 답장 표시
    if(msg.replyTo) {
        contentHtml += `<div class="reply-bubble">↩️ ${msg.replyTo.username}: ${msg.replyTo.text}</div>`;
    }
    contentHtml += parsedText ? `<div>${parsedText}</div>` : '';
    
    if (msg.fileData) {
        if (msg.fileType && msg.fileType.startsWith('image/')) {
            contentHtml += `<img src="${msg.fileData}" class="chat-file-preview" alt="${msg.fileName}">`;
        } else {
            contentHtml += `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-file-link">📁 ${msg.fileName} 다운로드</a>`;
        }
    }

    div.innerHTML = `
        <div class="msg-header"><div class="msg-avatar" style="background:${msg.color}">${msg.avatar || '☕'}</div>
        <span>${msg.username}</span><span style="font-size:0.7rem; opacity:0.7;">${msg.time}</span>
        <button class="msg-reply-btn" title="답장">↩️</button></div>
        <div class="msg-bubble-wrapper">
            <div class="msg-bubble">${contentHtml}</div>
            <div class="msg-reactions">
                <button class="reaction-btn" onclick="sendReaction(${msg.id}, '👍')">👍<span class="reaction-count" id="react-thumb-${msg.id}">${msg.reactions?.['👍'] || ''}</span></button>
                <button class="reaction-btn" onclick="sendReaction(${msg.id}, '❤️')">❤️<span class="reaction-count" id="react-heart-${msg.id}">${msg.reactions?.['❤️'] || ''}</span></button>
            </div>
        </div>
    `;
    // 답장 버튼 클릭
    div.querySelector('.msg-reply-btn').addEventListener('click', () => setReply(msg));
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendReaction = function(msgId, emoji) {
    socket.emit('add_reaction', { msgId, reaction: emoji });
}

socket.on('update_reaction', (data) => {
    const thumbSpan = document.getElementById(`react-thumb-${data.msgId}`);
    const heartSpan = document.getElementById(`react-heart-${data.msgId}`);
    if(thumbSpan) thumbSpan.textContent = data.reactions['👍'] > 0 ? data.reactions['👍'] : '';
    if(heartSpan) heartSpan.textContent = data.reactions['❤️'] > 0 ? data.reactions['❤️'] : '';
});

// 이미지 모달 로직
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeImageModalBtn = document.getElementById('close-image-modal');

function openImageModal(src) {
    modalImage.src = src;
    imageModal.classList.remove('hidden');
}
// 이미지 클릭 이벤트 위임 (XSS 방지)
chatMessages.addEventListener('click', (e) => {
    if(e.target.classList.contains('chat-file-preview')) {
        openImageModal(e.target.src);
    }
});
closeImageModalBtn.addEventListener('click', () => imageModal.classList.add('hidden'));
imageModal.addEventListener('click', (e) => {
    if(e.target === imageModal) imageModal.classList.add('hidden');
});

// 채팅방 파일 드래그 앤 드롭 업로드 로직
const chatContainerNode = document.querySelector('.chat-container');

chatContainerNode.addEventListener('dragover', (e) => {
    e.preventDefault();
    chatContainerNode.style.boxShadow = 'inset 0 0 0 3px var(--primary)';
});
chatContainerNode.addEventListener('dragleave', (e) => {
    e.preventDefault();
    chatContainerNode.style.boxShadow = 'none';
});
chatContainerNode.addEventListener('drop', (e) => {
    e.preventDefault();
    chatContainerNode.style.boxShadow = 'none';
    if(e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        if(droppedFile.size > 5 * 1024 * 1024) { alert('파일은 5MB 이하만 전송 가능합니다.'); return; }
        const reader = new FileReader();
        reader.onload = function(evt) {
            socket.emit('send_message', {
                username: myUsername, text: '', color: myColor, avatar: myAvatar,
                fileData: evt.target.result, fileName: droppedFile.name, fileType: droppedFile.type
            });
        };
        reader.readAsDataURL(droppedFile);
    }
});

// 일정 상세 모달 로직
const eventDetailModal = document.getElementById('event-detail-modal');
const detailEventTitle = document.getElementById('detail-event-title');
const detailEventDate = document.getElementById('detail-event-date');
const detailEventAuthor = document.getElementById('detail-event-author');
const detailEventColor = document.getElementById('detail-event-color');
const detailEditBtn = document.getElementById('detail-edit-btn');
const detailDelBtn = document.getElementById('detail-del-btn');
const closeEventDetail = document.getElementById('close-event-detail');

function openEventDetailModal(e) {
    detailEventTitle.textContent = e.title;
    detailEventDate.textContent = e.date;
    detailEventAuthor.textContent = e.username;
    detailEventColor.style.backgroundColor = e.color;
    
    detailEditBtn.onclick = () => {
        eventDetailModal.classList.add('hidden');
        startEditEvent(e);
    };
    detailDelBtn.onclick = () => {
        if(confirm("이 일정을 삭제하시겠습니까?")) {
            socket.emit('delete_event', e.id);
            eventDetailModal.classList.add('hidden');
            resetEventForm();
        }
    };
    
    eventDetailModal.classList.remove('hidden');
}

closeEventDetail.addEventListener('click', () => eventDetailModal.classList.add('hidden'));
eventDetailModal.addEventListener('click', (e) => {
    if(e.target === eventDetailModal) eventDetailModal.classList.add('hidden');
});

// 날씨 API 연동 (Open-Meteo)
async function fetchWeather() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo');
        const data = await res.json();
        const getEmoji = (code) => {
            if (code <= 1) return '☀️'; if (code <= 3) return '⛅';
            if (code <= 49) return '☁️'; if (code <= 69) return '🌧️';
            if (code <= 79) return '❄️'; return '⛈️';
        };
        data.daily.time.forEach((date, i) => {
            weatherData[date] = { emoji: getEmoji(data.daily.weather_code[i]), max: Math.round(data.daily.temperature_2m_max[i]), min: Math.round(data.daily.temperature_2m_min[i]) };
        });
        if(myUsername) initCalendar();
    } catch(e) { console.log('Weather fetch error', e); }
}

const koreanHolidays = {
    // 2025
    "2025-01-01": "신정", "2025-01-28": "설날 연휴", "2025-01-29": "설날", "2025-01-30": "설날 연휴",
    "2025-03-01": "삼일절", "2025-05-05": "어린이날", "2025-05-06": "대체공휴일",
    "2025-05-12": "부처님오신날", "2025-06-06": "현충일", "2025-08-15": "광복절",
    "2025-10-03": "개천절", "2025-10-05": "추석 연휴", "2025-10-06": "추석", "2025-10-07": "추석 연휴", "2025-10-08": "대체공휴일",
    "2025-10-09": "한글날", "2025-12-25": "기독탄신일",
    // 2026
    "2026-01-01": "신정", "2026-02-16": "설날 연휴", "2026-02-17": "설날", "2026-02-18": "설날 연휴",
    "2026-03-01": "삼일절", "2026-03-02": "대체공휴일",
    "2026-05-05": "어린이날", "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일",
    "2026-06-06": "현충일", "2026-08-15": "광복절", "2026-08-17": "대체공휴일",
    "2026-09-24": "추석 연휴", "2026-09-25": "추석", "2026-09-26": "추석 연휴",
    "2026-10-03": "개천절", "2026-10-05": "대체공휴일", "2026-10-09": "한글날", "2026-12-25": "기독탄신일",
    // 2027
    "2027-01-01": "신정", "2027-02-06": "설날 연휴", "2027-02-07": "설날", "2027-02-08": "설날 연휴",
    "2027-03-01": "삼일절", "2027-05-05": "어린이날", "2027-05-13": "부처님오신날",
    "2027-06-06": "현충일", "2027-08-15": "광복절", "2027-08-16": "대체공휴일",
    "2027-09-14": "추석 연휴", "2027-09-15": "추석", "2027-09-16": "추석 연휴",
    "2027-10-03": "개천절", "2027-10-04": "대체공휴일", "2027-10-09": "한글날", "2027-12-25": "기독탄신일",
    // 2028
    "2028-01-01": "신정", "2028-01-25": "설날 연휴", "2028-01-26": "설날", "2028-01-27": "설날 연휴",
    "2028-03-01": "삼일절", "2028-05-02": "부처님오신날", "2028-05-05": "어린이날",
    "2028-06-06": "현충일", "2028-08-15": "광복절",
    "2028-10-02": "추석 연휴", "2028-10-03": "추석/개천절", "2028-10-04": "추석 연휴",
    "2028-10-09": "한글날", "2028-12-25": "기독탄신일",
    // 2029
    "2029-01-01": "신정", "2029-02-12": "설날 연휴", "2029-02-13": "설날", "2029-02-14": "설날 연휴",
    "2029-03-01": "삼일절", "2029-05-05": "어린이날", "2029-05-20": "부처님오신날",
    "2029-06-06": "현충일", "2029-08-15": "광복절",
    "2029-09-21": "추석 연휴", "2029-09-22": "추석", "2029-09-23": "추석 연휴",
    "2029-10-03": "개천절", "2029-10-09": "한글날", "2029-12-25": "기독탄신일",
    // 2030
    "2030-01-01": "신정", "2030-02-02": "설날 연휴", "2030-02-03": "설날", "2030-02-04": "설날 연휴",
    "2030-03-01": "삼일절", "2030-05-05": "어린이날", "2030-05-09": "부처님오신날",
    "2030-06-06": "현충일", "2030-08-15": "광복절",
    "2030-09-11": "추석 연휴", "2030-09-12": "추석", "2030-09-13": "추석 연휴",
    "2030-10-03": "개천절", "2030-10-09": "한글날", "2030-12-25": "기독탄신일"
};

const monthDisplay = document.getElementById('month-display');
const calendarGrid = document.getElementById('calendar-grid');

document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); initCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); initCalendar(); });

function initCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    monthDisplay.textContent = `${year}년 ${month + 1}월`;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 달의 주 수에 따라 동적으로 5줄 또는 6줄로 변경
    const totalCells = firstDay + daysInMonth;
    const rows = Math.ceil(totalCells / 7);
    calendarGrid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    
    for(let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div'); cell.className = 'day-cell empty'; calendarGrid.appendChild(cell);
    }
    
    const today = new Date();
    for(let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div'); cell.className = 'day-cell';
        if(year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) cell.classList.add('today-cell');
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const dayOfWeek = new Date(year, month, i).getDay(); 
        
        const holidayName = koreanHolidays[dateStr];
        let dateClasses = 'date-number';
        if (dayOfWeek === 0 || holidayName) dateClasses += ' sunday';
        else if (dayOfWeek === 6) dateClasses += ' saturday';
        
        let weatherHtml = '';
        if(weatherData[dateStr]) {
            weatherHtml = `<div class="weather-icon">${weatherData[dateStr].emoji} <span class="weather-temp">${weatherData[dateStr].max}°</span></div>`;
        }
        
        cell.innerHTML = `
            <div class="date-header">
                <div class="${dateClasses}">${i} ${weatherHtml}</div>
                <span class="holiday-name">${holidayName || ''}</span>
            </div>
        `;
        
        // 드래그 앤 드롭 목적지 이벤트
        cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', (e) => {
            e.preventDefault(); cell.classList.remove('drag-over');
            const dragId = e.dataTransfer.getData('text/plain');
            const targetEvent = eventsList.find(ev => ev.id == dragId);
            if(targetEvent && targetEvent.date !== dateStr) {
                socket.emit('edit_event', { id: targetEvent.id, date: dateStr, title: targetEvent.title, isDday: targetEvent.isDday });
            }
        });
        
        const dayEvents = eventsList.filter(e => e.date === dateStr);
        dayEvents.forEach(e => {
            const evDiv = document.createElement('div');
            evDiv.className = 'event-item';
            evDiv.style.backgroundColor = e.color;
            evDiv.setAttribute('draggable', 'true');
            if(e.isDday) evDiv.style.border = '2px solid white'; // D-Day 하이라이트
            
            evDiv.innerHTML = `
                <div class="event-info">
                    <span class="event-author">${e.username}</span>
                    <span class="event-title-text">${e.category || ''}${e.isDday ? '🎯' : ''} ${e.title}</span>
                </div>
            `;
            
            // 드래그 앤 드롭 시작 이벤트
            evDiv.addEventListener('dragstart', (evt) => {
                evt.dataTransfer.setData('text/plain', e.id);
            });
            
            // 클릭 시 팝업(모달) 열기
            evDiv.addEventListener('click', () => {
                openEventDetailModal(e);
            });
            cell.appendChild(evDiv);
        });
        
        cell.addEventListener('click', (e) => {
            if(!e.target.closest('.event-item')) {
                eventDateInput.value = dateStr;
                eventEndDateInput.value = '';
                // 모바일에서 일정 입력 폼으로 자동 스크롤
                if(window.innerWidth <= 900) {
                    document.querySelector('.add-event-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
        
        calendarGrid.appendChild(cell);
    }
}

// D-Day 배너 업데이트 로직
function updateDdayBanner() {
    const ddayBanner = document.getElementById('dday-banner');
    const today = new Date(); today.setHours(0,0,0,0);
    
    // 다가오는 미래의 D-Day 찾기
    const futureDdays = eventsList.filter(e => e.isDday && new Date(e.date) >= today);
    futureDdays.sort((a,b) => new Date(a.date) - new Date(b.date)); // 가장 가까운 순
    
    if(futureDdays.length > 0) {
        const nextDday = futureDdays[0];
        const diffTime = new Date(nextDday.date) - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        document.getElementById('dday-title').textContent = nextDday.title;
        document.getElementById('dday-count').textContent = diffDays === 0 ? 'D-Day!!' : `D-${diffDays}`;
        ddayBanner.classList.remove('hidden');
    } else {
        ddayBanner.classList.add('hidden');
    }
}

// 일정 추가 및 수정
addEventBtn.addEventListener('click', () => {
    const id = eventIdInput.value;
    const startDate = eventDateInput.value;
    const endDate = eventEndDateInput.value;
    const title = eventTitleInput.value.trim();
    const isDday = eventIsDdayInput.checked;
    
    if(!startDate) return alert("날짜를 선택해주세요!");
    if(!title) return alert("일정 내용을 입력해주세요!");
    
    if (id) {
        socket.emit('edit_event', { id: parseInt(id), date: startDate, title: title, isDday: isDday });
        resetEventForm();
    } else {
        if (endDate && endDate >= startDate) {
            const eventsToAdd = [];
            let current = new Date(startDate); const end = new Date(endDate);
            while (current <= end) {
                const dateStr = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
                eventsToAdd.push({ date: dateStr, title: title, username: myUsername, color: myColor, avatar: myAvatar, isDday: isDday, category: myCategory });
                current.setDate(current.getDate() + 1);
            }
            socket.emit('add_events_batch', { events: eventsToAdd });
        } else {
            socket.emit('add_event', { date: startDate, title: title, username: myUsername, color: myColor, avatar: myAvatar, isDday: isDday, category: myCategory });
        }
        eventTitleInput.value = ''; eventEndDateInput.value = ''; eventIsDdayInput.checked = false;
    }
});

function startEditEvent(e) {
    eventFormTitle.textContent = "일정 수정하기"; addEventBtn.textContent = "수정 완료"; cancelEditBtn.classList.remove('hidden');
    eventEndDateInput.classList.add('hidden'); document.getElementById('date-tilde').classList.add('hidden');
    eventIdInput.value = e.id; eventDateInput.value = e.date; eventTitleInput.value = e.title; eventIsDdayInput.checked = e.isDday;
}

cancelEditBtn.addEventListener('click', resetEventForm);
function resetEventForm() {
    eventFormTitle.textContent = "새로운 일정 공유"; addEventBtn.textContent = "일정 추가"; cancelEditBtn.classList.add('hidden');
    eventEndDateInput.classList.remove('hidden'); document.getElementById('date-tilde').classList.remove('hidden');
    eventIdInput.value = ''; eventTitleInput.value = ''; eventEndDateInput.value = ''; eventIsDdayInput.checked = false;
}

window.deleteEvent = function(e, id) {
    e.stopPropagation();
    if(confirm("이 일정을 삭제하시겠습니까?")) { socket.emit('delete_event', id); resetEventForm(); }
}

window.startEditEventWrap = function(e, id) {
    e.stopPropagation();
    const eventObj = eventsList.find(ev => ev.id === id);
    if(eventObj) startEditEvent(eventObj);
}

checkSavedLogin();
