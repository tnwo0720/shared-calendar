// ========================================
// events.js — 일정 관리, D-Day, 상세 모달, 선택 날짜 패널
// ========================================
const eventIdInput = document.getElementById('edit-event-id');
const eventDateInput = document.getElementById('event-date');
const eventEndDateInput = document.getElementById('event-end-date');
const eventTitleInput = document.getElementById('event-title');
const eventIsDdayInput = document.getElementById('event-is-dday');
const addEventBtn = document.getElementById('add-event-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const eventFormTitle = document.getElementById('event-form-title');

// 일정 상세 모달
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
    
    detailEditBtn.onclick = () => { eventDetailModal.classList.add('hidden'); startEditEvent(e); };
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
eventDetailModal.addEventListener('click', (e) => { if(e.target === eventDetailModal) eventDetailModal.classList.add('hidden'); });

// 선택 날짜 일정 패널
function updateSelectedDatePanel(dateStr) {
    selectedDateStr = dateStr;
    const title = document.getElementById('selected-date-title');
    const container = document.getElementById('selected-date-events');
    const d = new Date(dateStr + 'T00:00:00');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    title.textContent = `📅 ${d.getMonth()+1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
    
    const events = eventsList.filter(e => e.date === dateStr);
    if(events.length === 0) {
        container.innerHTML = '<p class="no-events">일정이 없습니다</p>';
        return;
    }
    container.innerHTML = '';
    events.forEach(e => {
        const item = document.createElement('div');
        item.className = 'selected-event-item';
        item.innerHTML = `
            <div class="selected-event-dot" style="background:${e.color}"></div>
            <div class="selected-event-info">
                <div class="selected-event-title">${e.category || ''} ${e.isDday ? '🎯' : ''} ${e.title}</div>
                <div class="selected-event-meta">${e.username}</div>
            </div>
        `;
        item.addEventListener('click', () => openEventDetailModal(e));
        container.appendChild(item);
    });
}

// D-Day 배너
function updateDdayBanner() {
    const ddayBanner = document.getElementById('dday-banner');
    const today = new Date(); today.setHours(0,0,0,0);
    
    const futureDdays = eventsList.filter(e => e.isDday && new Date(e.date) >= today);
    futureDdays.sort((a,b) => new Date(a.date) - new Date(b.date));
    
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

// 일정 추가/수정
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
