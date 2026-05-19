// ========================================
// calendar.js — 캘린더 렌더링, 날씨, 툴팁, 주간뷰
// ========================================
const monthDisplay = document.getElementById('month-display');
const calendarGrid = document.getElementById('calendar-grid');
let isWeekView = false;
let currentWeekStart = new Date();

const viewToggleBtn = document.getElementById('view-toggle');
viewToggleBtn.addEventListener('click', () => {
    isWeekView = !isWeekView;
    viewToggleBtn.textContent = isWeekView ? '📆' : '📅';
    viewToggleBtn.title = isWeekView ? '월간 뷰로 전환' : '주간 뷰로 전환';
    if(isWeekView) {
        const today = new Date();
        currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay());
    }
    initCalendar();
});

document.getElementById('prev-month').addEventListener('click', () => {
    if(isWeekView) { currentWeekStart.setDate(currentWeekStart.getDate() - 7); }
    else { currentDate.setMonth(currentDate.getMonth() - 1); }
    initCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
    if(isWeekView) { currentWeekStart.setDate(currentWeekStart.getDate() + 7); }
    else { currentDate.setMonth(currentDate.getMonth() + 1); }
    initCalendar();
});

// 날씨 API (Open-Meteo)
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

// 캘린더 그리기
function initCalendar() {
    if(isWeekView) return initWeekView();
    calendarGrid.className = 'calendar-grid';
    calendarGrid.innerHTML = '';
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    monthDisplay.textContent = `${year}년 ${month + 1}월`;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
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
        
        // 드래그 앤 드롭 목적지
        cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', (e) => {
            e.preventDefault(); cell.classList.remove('drag-over');
            const dragId = e.dataTransfer.getData('text/plain');
            const targetEvent = eventsList.find(ev => ev.id == dragId);
            if(targetEvent && targetEvent.date !== dateStr) {
                if(e.altKey || e.ctrlKey) {
                    // Alt/Ctrl + 드래그 = 복사
                    socket.emit('add_event', { date: dateStr, title: targetEvent.title, username: targetEvent.username, color: targetEvent.color, avatar: targetEvent.avatar, isDday: targetEvent.isDday, category: targetEvent.category || '' });
                    showToast(`📋 일정이 ${dateStr}로 복사되었습니다`, targetEvent.color);
                } else {
                    // 일반 드래그 = 이동
                    socket.emit('edit_event', { id: targetEvent.id, date: dateStr, title: targetEvent.title, isDday: targetEvent.isDday });
                }
            }
        });
        
        // 일정 표시
        const dayEvents = eventsList.filter(e => e.date === dateStr);
        dayEvents.forEach(e => {
            const evDiv = document.createElement('div');
            evDiv.className = 'event-item';
            evDiv.style.backgroundColor = e.color;
            evDiv.setAttribute('draggable', 'true');
            if(e.isDday) evDiv.style.border = '2px solid white';
            
            evDiv.innerHTML = `
                <div class="event-info">
                    <span class="event-author">${e.username}</span>
                    <span class="event-title-text">${e.category || ''}${e.isDday ? '🎯' : ''} ${e.title}</span>
                </div>
            `;
            evDiv.addEventListener('dragstart', (evt) => { evt.dataTransfer.setData('text/plain', e.id); });
            evDiv.addEventListener('click', () => { openEventDetailModal(e); });
            cell.appendChild(evDiv);
        });
        
        // 툴팁
        cell.addEventListener('mouseenter', (evt) => showDayTooltip(evt, dateStr, i, dayEvents, holidayName));
        cell.addEventListener('mouseleave', hideDayTooltip);
        
        // 날짜 클릭
        cell.addEventListener('click', (e) => {
            if(!e.target.closest('.event-item')) {
                document.getElementById('event-date').value = dateStr;
                document.getElementById('event-end-date').value = '';
                updateSelectedDatePanel(dateStr);
                if(window.innerWidth <= 900) {
                    document.querySelector('.add-event-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
        
        calendarGrid.appendChild(cell);
    }
    
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    if(!selectedDateStr) updateSelectedDatePanel(todayStr);
}

// 주간뷰 렌더링
function initWeekView() {
    calendarGrid.innerHTML = '';
    calendarGrid.className = 'week-view';
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date(); today.setHours(0,0,0,0);
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    monthDisplay.textContent = `${currentWeekStart.getMonth()+1}/${currentWeekStart.getDate()} ~ ${weekEnd.getMonth()+1}/${weekEnd.getDate()} (주간)`;
    
    for(let i = 0; i < 7; i++) {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const isToday = d.getTime() === today.getTime();
        const holidayName = koreanHolidays[dateStr];
        
        const cell = document.createElement('div');
        cell.className = `week-day-cell${isToday ? ' today-cell' : ''}`;
        
        let headerClass = i === 0 ? 'sunday' : (i === 6 ? 'saturday' : '');
        cell.innerHTML = `<div class="week-day-header">
            <span class="${headerClass}">${d.getDate()}</span>
            <span class="day-name">${dayNames[i]}</span>
        </div>${holidayName ? `<div class="holiday-name" style="font-size:0.7rem; margin-bottom:4px;">${holidayName}</div>` : ''}`;
        
        // 날씨
        if(weatherData[dateStr]) {
            const wDiv = document.createElement('div');
            wDiv.style.fontSize = '0.75rem'; wDiv.style.marginBottom = '6px';
            wDiv.textContent = `${weatherData[dateStr].emoji} ${weatherData[dateStr].max}°`;
            cell.appendChild(wDiv);
        }
        
        // 일정
        const dayEvents = eventsList.filter(e => e.date === dateStr);
        dayEvents.forEach(e => {
            const evDiv = document.createElement('div');
            evDiv.className = 'event-item';
            evDiv.style.backgroundColor = e.color;
            if(e.isDday) evDiv.style.border = '2px solid white';
            evDiv.innerHTML = `<div class="event-info"><span class="event-title-text">${e.category || ''} ${e.title}</span></div>`;
            evDiv.addEventListener('click', () => openEventDetailModal(e));
            cell.appendChild(evDiv);
        });
        
        cell.addEventListener('click', (e) => {
            if(!e.target.closest('.event-item')) {
                document.getElementById('event-date').value = dateStr;
                updateSelectedDatePanel(dateStr);
            }
        });
        
        calendarGrid.appendChild(cell);
    }
}

// 툴팁
const dayTooltip = document.getElementById('day-tooltip');
function showDayTooltip(evt, dateStr, day, events, holiday) {
    let html = `<div class="tooltip-date">${dateStr.replace(/-/g, '.')}${holiday ? ' 🎉' + holiday : ''}</div>`;
    if(events.length > 0) {
        events.forEach(e => {
            html += `<div class="tooltip-event"><span class="tooltip-dot" style="background:${e.color}"></span>${e.category || ''} ${e.title}</div>`;
        });
    } else {
        html += `<div class="tooltip-empty">일정이 없습니다</div>`;
    }
    dayTooltip.innerHTML = html;
    const rect = evt.currentTarget.getBoundingClientRect();
    dayTooltip.style.left = Math.min(rect.right + 10, window.innerWidth - 270) + 'px';
    dayTooltip.style.top = rect.top + 'px';
    dayTooltip.classList.add('visible');
}
function hideDayTooltip() { dayTooltip.classList.remove('visible'); }

// 일정 검색
const eventSearchInput = document.getElementById('event-search');
const searchResults = document.getElementById('search-results');
let searchDebounce = null;

eventSearchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        const query = eventSearchInput.value.trim().toLowerCase();
        if(query.length < 1) { searchResults.classList.add('hidden'); return; }
        
        const results = eventsList.filter(e => 
            e.title.toLowerCase().includes(query) || 
            e.username.toLowerCase().includes(query) ||
            e.date.includes(query)
        ).slice(0, 10);
        
        if(results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item"><span class="search-result-title">검색 결과가 없습니다</span></div>';
        } else {
            searchResults.innerHTML = results.map(e => {
                const highlighted = e.title.replace(new RegExp(`(${query})`, 'gi'), '<span class="search-highlight">$1</span>');
                return `<div class="search-result-item" data-date="${e.date}">
                    <span class="search-result-date">${e.date}</span>
                    <span class="selected-event-dot" style="background:${e.color}; width:8px; height:8px; border-radius:50%; flex-shrink:0;"></span>
                    <span class="search-result-title">${e.category || ''} ${highlighted}</span>
                </div>`;
            }).join('');
        }
        searchResults.classList.remove('hidden');
    }, 200);
});

searchResults.addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if(item && item.dataset.date) {
        const d = new Date(item.dataset.date + 'T00:00:00');
        currentDate = new Date(d.getFullYear(), d.getMonth(), 1);
        initCalendar();
        updateSelectedDatePanel(item.dataset.date);
        eventSearchInput.value = '';
        searchResults.classList.add('hidden');
    }
});

document.addEventListener('click', (e) => {
    if(!e.target.closest('.search-bar')) searchResults.classList.add('hidden');
});
