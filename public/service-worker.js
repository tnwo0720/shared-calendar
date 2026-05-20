const CACHE_NAME = 'shared-calendar-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/js/state.js',
    '/js/auth.js',
    '/js/chat.js',
    '/js/calendar.js',
    '/js/events.js',
    '/js/app.js',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.json'
];

// 설치: 정적 에셋 캐싱
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// 활성화: 오래된 캐시 정리
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 네트워크 요청: Cache First (정적 에셋), Network First (소켓/API)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // socket.io, /subscribe 등 API 요청은 캐시하지 않음
    if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/subscribe') || url.pathname.startsWith('/vapid')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') return response;
                const cloned = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                return response;
            }).catch(() => caches.match('/index.html'));
        })
    );
});

// 푸시 알림 수신
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: data.tag || 'calendar-notification',
            renotify: true,
            data: { url: '/' },
            vibrate: [200, 100, 200]
        })
    );
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow('/');
        })
    );
});
