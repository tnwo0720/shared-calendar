// ========================================
// auth.js — 로그인, 프로필, 테마
// ========================================
const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username-input');
const colorOptions = document.querySelectorAll('.color-option');
const avatarOptions = document.querySelectorAll('.avatar-option');
const joinBtn = document.getElementById('join-btn');
const myColorBadge = document.getElementById('my-color-badge');
const myUsernameDisplay = document.getElementById('my-username-display');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');

// 다크모드 초기화
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
        setTimeout(setupPushNotifications, 2000);
    } else { loginOverlay.classList.remove('hidden'); }
}

// 색상 선택
colorOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        colorOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        myColor = opt.dataset.color;
    });
});

// 아바타 선택
avatarOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        avatarOptions.forEach(o => { o.classList.remove('selected'); o.style.opacity = '0.5'; o.style.transform = 'scale(1)'; });
        opt.classList.add('selected');
        opt.style.opacity = '1';
        opt.style.transform = 'scale(1.2)';
        myAvatar = opt.dataset.avatar;
    });
});

// Enter 키 로그인
usernameInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') joinBtn.click(); });

// 입장하기
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
        setTimeout(setupPushNotifications, 2000);
    } else { alert("이름을 입력해주세요!"); }
});

// 프로필 수정
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
    document.getElementById('event-date').valueAsDate = new Date();
    socket.emit('user_joined', { username: myUsername, color: myColor, avatar: myAvatar });
}
