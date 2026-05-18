const socket = io();

// 전역 변수
let myUsername = '';
let myColor = '#ff6b6b';
let currentDate = new Date(2026, 4, 1);
let eventsList = [];
let weatherData = {}; // 날씨 캐시
let typingTimeout = null;

// DOM
const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username-input');
const colorOptions = document.querySelectorAll('.color-option');
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
    if (savedName && savedColor) {
        myUsername = savedName; myColor = savedColor;
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

joinBtn.addEventListener('click', () => {
    const val = usernameInput.value.trim();
    if(val.length > 0) {
        myUsername = val;
        localStorage.setItem('cal_username', myUsername);
        localStorage.setItem('cal_color', myColor);
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
    eventDateInput.valueAsDate = new Date();
    socket.emit('user_joined', { username: myUsername, color: myColor });
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
    document.getElementById('chat-messages').innerHTML = '';
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
        div.innerHTML = `<div class="online-user-dot" style="background: ${u.color}"></div><span>${u.username}</span>`;
        container.appendChild(div);
    });
});

socket.on('event_added', (e) => {
    showToast(`🔔 <b>${e.username}</b>님이 새 일정 추가: ${e.title}`, e.color);
});

socket.on('receive_message', appendMessage);

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
                username: myUsername, text: text, color: myColor,
                fileData: evt.target.result, fileName: selectedFile.name, fileType: selectedFile.type
            });
            resetChatInput();
        };
        reader.readAsDataURL(selectedFile);
    } else {
        socket.emit('send_message', { username: myUsername, text: text, color: myColor });
        resetChatInput();
    }
});

function resetChatInput() {
    chatInput.value = '';
    chatInput.placeholder = "메시지 입력...";
    selectedFile = null;
    chatFileInput.value = '';
    socket.emit('stop_typing');
}

function appendMessage(msg) {
    const isMine = msg.username === myUsername;
    const div = document.createElement('div');
    div.className = `message ${isMine ? 'mine' : 'others'}`;
    
    let contentHtml = msg.text ? `<div>${msg.text}</div>` : '';
    
    if (msg.fileData) {
        if (msg.fileType && msg.fileType.startsWith('image/')) {
            contentHtml += `<img src="${msg.fileData}" class="chat-file-preview" alt="${msg.fileName}" onclick="openImageModal('${msg.fileData}')">`;
        } else {
            contentHtml += `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-file-link">📁 ${msg.fileName} 다운로드</a>`;
        }
    }

    div.innerHTML = `
        <div class="msg-header"><div class="msg-color-dot" style="background:${msg.color}"></div>
        <span>${msg.username}</span><span style="font-size:0.7rem; opacity:0.7;">${msg.time}</span></div>
        <div class="msg-bubble">${contentHtml}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 이미지 모달 로직
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeImageModalBtn = document.getElementById('close-image-modal');

window.openImageModal = function(src) {
    modalImage.src = src;
    imageModal.classList.remove('hidden');
}
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
        selectedFile = e.dataTransfer.files[0];
        // 드래그 앤 드롭 시 즉시 전송
        chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
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
    "2026-01-01": "신정", "2026-03-01": "삼일절", "2026-05-05": "어린이날", "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일", "2026-06-06": "현충일", "2026-08-15": "광복절", "2026-09-25": "추석", "2026-10-03": "개천절", "2026-10-09": "한글날", "2026-12-25": "기독탄신일"
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
    calendarGrid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    for(let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div'); cell.className = 'day-cell empty'; calendarGrid.appendChild(cell);
    }
    
    for(let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div'); cell.className = 'day-cell';
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
                    <span class="event-title-text">${e.isDday ? '🎯' : ''} ${e.title}</span>
                </div>
                <div class="event-actions">
                    <button class="edit-btn" title="수정" onclick="startEditEventWrap(event, ${e.id})">✏️</button>
                    <button class="del-btn" title="삭제" onclick="deleteEvent(event, ${e.id})">×</button>
                </div>
            `;
            
            // 드래그 앤 드롭 시작 이벤트
            evDiv.addEventListener('dragstart', (evt) => {
                evt.dataTransfer.setData('text/plain', e.id);
            });
            
            // 클릭 시 텍스트 확장(말줄임 해제) 토글
            evDiv.addEventListener('click', (evt) => {
                if(!evt.target.closest('button')) {
                    evDiv.classList.toggle('expanded');
                }
            });
            cell.appendChild(evDiv);
        });
        
        cell.addEventListener('click', (e) => {
            if(!e.target.closest('.event-item')) {
                eventDateInput.value = dateStr;
                eventEndDateInput.value = ''; 
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
            let current = new Date(startDate); const end = new Date(endDate);
            while (current <= end) {
                const dateStr = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
                socket.emit('add_event', { date: dateStr, title: title, username: myUsername, color: myColor, isDday: isDday });
                current.setDate(current.getDate() + 1);
            }
        } else {
            socket.emit('add_event', { date: startDate, title: title, username: myUsername, color: myColor, isDday: isDday });
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
