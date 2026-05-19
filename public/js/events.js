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

// 다가오는 일정 목록
function updateSelectedDatePanel(dateStr) {
    selectedDateStr = dateStr;
    updateUpcomingEvents();
}

function updateUpcomingEvents() {
    const container = document.getElementById('upcoming-list');
    const today = new Date(); today.setHours(0,0,0,0);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    
    const upcoming = eventsList
        .filter(e => new Date(e.date + 'T00:00:00') >= today)
        .sort((a,b) => a.date.localeCompare(b.date))
        .slice(0, 20);
    
    if(upcoming.length === 0) {
        container.innerHTML = '<p class="no-events">다가오는 일정이 없습니다</p>';
        return;
    }
    
    container.innerHTML = '';
    let lastDate = '';
    
    upcoming.forEach(e => {
        const eDate = new Date(e.date + 'T00:00:00');
        const diff = Math.ceil((eDate - today) / (1000*60*60*24));
        
        // 날짜 구분선
        if(e.date !== lastDate) {
            const divider = document.createElement('div');
            divider.className = 'upcoming-date-divider';
            const d = new Date(e.date + 'T00:00:00');
            divider.textContent = `${d.getMonth()+1}/${d.getDate()} (${dayNames[d.getDay()]})`;
            container.appendChild(divider);
            lastDate = e.date;
        }
        
        // D-Day 배지 색상
        let badgeClass = 'upcoming-dday-far';
        if(diff === 0) badgeClass = 'upcoming-dday-today';
        else if(diff <= 3) badgeClass = 'upcoming-dday-soon';
        else if(diff <= 7) badgeClass = 'upcoming-dday-normal';
        
        const badgeText = diff === 0 ? 'TODAY' : `D-${diff}`;
        
        const item = document.createElement('div');
        item.className = 'upcoming-item';
        item.innerHTML = `
            <span class="upcoming-dday-badge ${badgeClass}">${badgeText}</span>
            <div class="upcoming-info">
                <div class="upcoming-title">${e.category || ''} ${e.isDday ? '🎯' : ''} ${e.title}</div>
                <div class="upcoming-meta">${e.username}</div>
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
const eventRepeatSelect = document.getElementById('event-repeat');
const eventRepeatCount = document.getElementById('event-repeat-count');

addEventBtn.addEventListener('click', () => {
    const id = eventIdInput.value;
    const startDate = eventDateInput.value;
    const endDate = eventEndDateInput.value;
    const title = eventTitleInput.value.trim();
    const isDday = eventIsDdayInput.checked;
    const repeat = eventRepeatSelect.value;
    const repeatCount = parseInt(eventRepeatCount.value);
    
    if(!startDate) return alert("날짜를 선택해주세요!");
    if(!title) return alert("일정 내용을 입력해주세요!");
    
    if (id) {
        socket.emit('edit_event', { id: parseInt(id), date: startDate, title: title, isDday: isDday });
        resetEventForm();
    } else {
        if (repeat !== 'none') {
            const eventsToAdd = [];
            let current = new Date(startDate + 'T00:00:00');
            for(let i = 0; i < repeatCount; i++) {
                const dateStr = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
                eventsToAdd.push({ date: dateStr, title: title, username: myUsername, color: myColor, avatar: myAvatar, isDday: isDday, category: myCategory });
                if(repeat === 'weekly') current.setDate(current.getDate() + 7);
                else if(repeat === 'biweekly') current.setDate(current.getDate() + 14);
                else if(repeat === 'monthly') current.setMonth(current.getMonth() + 1);
            }
            socket.emit('add_events_batch', { events: eventsToAdd });
            showToast(`🔁 ${title} — ${repeatCount}회 반복 일정 추가!`, myColor);
        } else if (endDate && endDate >= startDate) {
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
        eventRepeatSelect.value = 'none';
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

function checkUrlHash() {
    const hash = window.location.hash;
    const match = hash.match(/#date=([\d-]+)/);
    if(match) {
        const dateStr = match[1];
        const d = new Date(dateStr + 'T00:00:00');
        currentDate = new Date(d.getFullYear(), d.getMonth(), 1);
        setTimeout(() => { initCalendar(); }, 500);
    }
}

// 캘린더 내보내기 (.ics)
const exportBtn = document.getElementById('export-ics-btn');
exportBtn.addEventListener('click', () => {
    let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SharedCalendar//KO\nCALSCALE:GREGORIAN\n';
    eventsList.forEach(e => {
        const dateClean = e.date.replace(/-/g, '');
        ics += 'BEGIN:VEVENT\n';
        ics += `DTSTART;VALUE=DATE:${dateClean}\n`;
        ics += `DTEND;VALUE=DATE:${dateClean}\n`;
        ics += `SUMMARY:${e.category || ''} ${e.title}\n`;
        ics += `DESCRIPTION:추가: ${e.username}\n`;
        ics += `UID:${e.id}@shared-calendar\n`;
        ics += 'END:VEVENT\n';
    });
    ics += 'END:VCALENDAR';
    
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'shared-calendar.ics';
    link.click();
    showToast('📅 ICS 파일이 다운로드되었습니다!', '#43aa8b');
});

// 캘린더 내보내기 (엑셀 CSV)
const exportCsvBtn = document.getElementById('export-csv-btn');
exportCsvBtn.addEventListener('click', () => {
    const BOM = '\uFEFF';
    let csv = BOM + '날짜,일정,카테고리,작성자,D-Day\n';
    const sorted = [...eventsList].sort((a,b) => a.date.localeCompare(b.date));
    sorted.forEach(e => {
        csv += `${e.date},"${e.title}","${e.category || '없음'}","${e.username}",${e.isDday ? 'O' : ''}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'shared-calendar.csv';
    link.click();
    showToast('📊 엑셀 파일이 다운로드되었습니다!', '#43aa8b');
});

// 캘린더 내보내기 (PDF - 인쇄 화면)
const exportPdfBtn = document.getElementById('export-pdf-btn');
exportPdfBtn.addEventListener('click', () => {
    const sorted = [...eventsList].sort((a,b) => a.date.localeCompare(b.date));
    const printWin = window.open('', '_blank');
    let rows = sorted.map(e => 
        `<tr><td>${e.date}</td><td>${e.category || ''}</td><td>${e.title}</td><td>${e.username}</td><td>${e.isDday ? '🎯' : ''}</td></tr>`
    ).join('');
    
    printWin.document.write(`
    <html><head><title>공유 캘린더</title>
    <style>
        body { font-family: 'Noto Sans KR', sans-serif; padding: 30px; color: #333; }
        h1 { text-align: center; margin-bottom: 5px; }
        p.sub { text-align: center; color: #888; margin-bottom: 25px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #c39a6b; color: white; padding: 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background: #f9f6f1; }
        @media print { body { padding: 10px; } }
    </style></head><body>
    <h1>📅 공유 캘린더</h1>
    <p class="sub">총 ${sorted.length}개 일정 | 인쇄일: ${new Date().toLocaleDateString('ko-KR')}</p>
    <table>
        <thead><tr><th>날짜</th><th>카테고리</th><th>일정</th><th>작성자</th><th>D-Day</th></tr></thead>
        <tbody>${rows}</tbody>
    </table>
    </body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 300);
    showToast('🖨️ PDF 인쇄 화면이 열렸습니다!', '#43aa8b');
});
