// ========================================
// nav.js — 하단 탭 네비게이션
// ========================================
const navBtns = document.querySelectorAll('.nav-btn');
const calendarPage = document.querySelector('.app-container');
const chatFab = document.getElementById('chat-fab');
const chatPanel = document.getElementById('chat-panel');

function showPage(pageId) {
    // 캘린더
    calendarPage.style.display = pageId === 'calendar' ? '' : 'none';
    chatFab.style.display = pageId === 'calendar' ? '' : 'none';
    if (pageId !== 'calendar') chatPanel.classList.add('hidden');

    // 다른 페이지들
    ['album', 'map', 'picker'].forEach(id => {
        const el = document.getElementById(`page-${id}`);
        if (el) el.classList.toggle('hidden', id !== pageId);
    });

    // 지도 페이지 활성화 시 Leaflet resize 처리
    if (pageId === 'map' && typeof initMapPage === 'function') initMapPage();

    // 탭 하이라이트
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.page === pageId));
}

navBtns.forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// 기본: 캘린더
showPage('calendar');
