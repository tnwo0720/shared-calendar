// ========================================
// app.js — 소켓 이벤트 핸들러 & 앱 초기화
// ========================================

// 서버에서 데이터 수신
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
    if(myUsername) { initCalendar(); updateDdayBanner(); if(selectedDateStr) updateSelectedDatePanel(selectedDateStr); }
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

socket.on('user_typing', (user) => { activeTypers.add(user); updateTypingIndicator(); });
socket.on('user_stopped_typing', () => { activeTypers.clear(); updateTypingIndicator(); });

socket.on('update_reaction', (data) => {
    const thumbSpan = document.getElementById(`react-thumb-${data.msgId}`);
    const heartSpan = document.getElementById(`react-heart-${data.msgId}`);
    if(thumbSpan) thumbSpan.textContent = data.reactions['👍'] > 0 ? data.reactions['👍'] : '';
    if(heartSpan) heartSpan.textContent = data.reactions['❤️'] > 0 ? data.reactions['❤️'] : '';
});

// 앱 시작!
checkSavedLogin();
