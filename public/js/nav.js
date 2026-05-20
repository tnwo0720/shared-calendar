// ========================================
// nav.js — 하단 탭 네비게이션
// ========================================
const navBtns = document.querySelectorAll('.nav-btn');

window.showPage = function(pageId) {
    const calendarPage = document.querySelector('.app-container');
    const chatFab = document.getElementById('chat-fab');
    const chatPanel = document.getElementById('chat-panel');

    // 캘린더 표시/숨김
    if (calendarPage) calendarPage.style.display = pageId === 'calendar' ? '' : 'none';
    if (chatFab) chatFab.style.display = pageId === 'calendar' ? '' : 'none';
    if (pageId !== 'calendar' && chatPanel) chatPanel.classList.add('hidden');

    // 나머지 페이지
    ['album', 'map', 'picker'].forEach(id => {
        const el = document.getElementById('page-' + id);
        if (!el) return;
        if (id === pageId) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // 지도 초기화 (처음 열 때)
    if (pageId === 'map' && typeof initMapPage === 'function') {
        setTimeout(initMapPage, 50);
    }

    // 탭 하이라이트
    navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageId);
    });
};

navBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        window.showPage(this.dataset.page);
    });
});

// 기본: 캘린더 탭 활성화
window.showPage('calendar');
