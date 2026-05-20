// ========================================
// app.js — 소켓 이벤트 핸들러 & 앱 초기화
// ========================================
const pinnedBar = document.getElementById('pinned-bar');
const pinnedText = document.getElementById('pinned-text');
const unpinBtn = document.getElementById('unpin-btn');

unpinBtn.addEventListener('click', () => socket.emit('unpin_message'));

function showPinned(msg) {
    if(msg) { pinnedText.textContent = `${msg.username}: ${msg.text}`; pinnedBar.classList.remove('hidden'); }
    else { pinnedBar.classList.add('hidden'); }
}

// 서버에서 데이터 수신
socket.on('init_data', (data) => {
    eventsList = data.events;
    const cm = document.getElementById('chat-messages');
    cm.innerHTML = '';
    lastChatDate = '';
    data.chatHistory.forEach(msg => appendMessage(msg));
    if(data.pinnedMessage) showPinned(data.pinnedMessage);
    if(myUsername) { initCalendar(); updateDdayBanner(); updateUpcomingEvents(); checkDdayAlerts(); checkUrlHash(); }
    // 추억앨범 & 우리의 지도 초기 데이터
    if(data.photos) renderAlbum(data.photos);
    if(data.mapPins) { window._mapPins = data.mapPins; renderMapPins(data.mapPins); }
});

socket.on('sync_events', (events) => {
    eventsList = events;
    if(myUsername) { initCalendar(); updateDdayBanner(); updateUpcomingEvents(); }
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

socket.on('message_deleted', (msgId) => {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if(el) { el.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => el.remove(), 300); }
});

socket.on('message_pinned', (msg) => showPinned(msg));
socket.on('message_unpinned', () => showPinned(null));

// D-Day 자동 알림 (접속 시 확인)
function checkDdayAlerts() {
    const today = new Date(); today.setHours(0,0,0,0);
    const ddayEvents = eventsList.filter(e => e.isDday);
    ddayEvents.forEach(e => {
        const diff = Math.ceil((new Date(e.date) - today) / (1000*60*60*24));
        if(diff === 0) showToast(`🎯 오늘이 <b>${e.title}</b> D-Day입니다!`, '#e11d48');
        else if(diff === 1) showToast(`⏰ 내일이 <b>${e.title}</b> D-Day! (D-1)`, '#f97316');
        else if(diff === 3) showToast(`📢 <b>${e.title}</b>까지 3일 남았습니다! (D-3)`, '#8b5cf6');
    });
}

// ========================================
// 푸시 알림 구독 설정
// ========================================
async function setupPushNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // 이미 구독 중

        const { key } = await fetch('/vapid-public-key').then(r => r.json());
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key)
        });
        await fetch('/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
    } catch (e) { console.warn('푸시 구독 실패:', e); }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ========================================
// 풀스크린 인트로
// ========================================
(function() {
    const intro = document.getElementById('intro-screen');
    if (!intro) return;

    function dismissIntro() {
        intro.classList.add('fade-out');
        setTimeout(() => intro.remove(), 950);
    }

    // 2.6초 후 자동 종료
    const timer = setTimeout(dismissIntro, 2600);

    // 탭/클릭으로 빨리 넘기기
    intro.addEventListener('click', () => { clearTimeout(timer); dismissIntro(); });
})();

// 앱 시작!
checkSavedLogin();
