// ========================================
// map-page.js — 우리의 지도
// ========================================
let leafletMap = null;
let mapMarkers = {};
let pendingLatLng = null;
let selectedPinCategory = 'visited';

const pinModal = document.getElementById('map-pin-modal');
const pinNameInput = document.getElementById('pin-name-input');
const pinMemoInput = document.getElementById('pin-memo-input');
const pinSubmitBtn = document.getElementById('pin-submit-btn');
const pinCancelBtn = document.getElementById('pin-cancel-btn');
const pinCatBtns = document.querySelectorAll('.pin-cat-btn');

pinCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        pinCatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPinCategory = btn.dataset.cat;
    });
});

function initMapPage() {
    if (leafletMap) { leafletMap.invalidateSize(); return; }

    leafletMap = L.map('map-container', { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(leafletMap);

    // 현재 위치 이동
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => leafletMap.setView([pos.coords.latitude, pos.coords.longitude], 13),
            () => leafletMap.setView([37.5512, 126.9882], 12)
        );
    } else {
        leafletMap.setView([37.5512, 126.9882], 12);
    }

    // 지도 클릭 → 핀 추가 모달
    leafletMap.on('click', (e) => {
        pendingLatLng = e.latlng;
        pinNameInput.value = '';
        pinMemoInput.value = '';
        pinCatBtns.forEach(b => b.classList.toggle('active', b.dataset.cat === 'visited'));
        selectedPinCategory = 'visited';
        pinModal.classList.remove('hidden');
        setTimeout(() => pinNameInput.focus(), 100);
    });

    // 기존 핀 렌더
    renderMapPins(window._mapPins || []);
}

function makePinIcon(category) {
    const color = category === 'visited' ? '#16a34a' : '#ea580c';
    return L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [22, 22], iconAnchor: [11, 11]
    });
}

function renderMapPins(pins) {
    window._mapPins = pins;
    if (!leafletMap) return;
    // 기존 마커 제거
    Object.values(mapMarkers).forEach(m => m.remove());
    mapMarkers = {};
    pins.forEach(pin => addPinMarker(pin));
}

function addPinMarker(pin) {
    const marker = L.marker([pin.lat, pin.lng], { icon: makePinIcon(pin.category) }).addTo(leafletMap);
    const label = pin.category === 'visited' ? '🟢 가봤어요' : '🟠 가고싶어요';
    const canDelete = myUsername && pin.username === myUsername;
    marker.bindPopup(`
        <div style="min-width:160px;font-family:Pretendard,sans-serif;">
            <b style="font-size:0.95rem;">${pin.name}</b>
            ${pin.memo ? `<p style="margin:4px 0 0;font-size:0.8rem;color:#666;">${pin.memo}</p>` : ''}
            <p style="margin:6px 0 0;font-size:0.75rem;color:#888;">${label} · ${pin.username}</p>
            ${canDelete ? `<button onclick="deletePin(${pin.id})" style="margin-top:8px;padding:4px 10px;background:#e11d48;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:700;">삭제</button>` : ''}
        </div>`);
    mapMarkers[pin.id] = marker;
}

window.deletePin = function(id) {
    if (confirm('이 장소를 삭제할까요?')) socket.emit('delete_pin', id);
};

pinSubmitBtn.addEventListener('click', () => {
    if (!pendingLatLng || !myUsername) return;
    const name = pinNameInput.value.trim() || '새 장소';
    socket.emit('add_pin', { lat: pendingLatLng.lat, lng: pendingLatLng.lng, name, memo: pinMemoInput.value.trim(), category: selectedPinCategory, username: myUsername, color: myColor });
    pinModal.classList.add('hidden');
    pendingLatLng = null;
});

pinCancelBtn.addEventListener('click', () => { pinModal.classList.add('hidden'); pendingLatLng = null; });
pinNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') pinSubmitBtn.click(); });

socket.on('sync_pins', (pins) => renderMapPins(pins));
