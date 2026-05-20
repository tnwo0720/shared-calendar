// ========================================
// album.js — 추억앨범
// ========================================
let albumPhotos = [];
let pendingPhotoData = null;

const albumFileInput = document.getElementById('album-file-input');
const albumUploadForm = document.getElementById('album-upload-form');
const albumPreviewImg = document.getElementById('album-preview-img');
const albumCaptionInput = document.getElementById('album-caption-input');
const albumSubmitBtn = document.getElementById('album-submit-btn');
const albumCancelBtn = document.getElementById('album-cancel-btn');
const albumGrid = document.getElementById('album-grid');
const albumLightbox = document.getElementById('album-lightbox');
const albumLightboxImg = document.getElementById('album-lightbox-img');
const albumLightboxInfo = document.getElementById('album-lightbox-info');
const albumLightboxClose = document.getElementById('album-lightbox-close');

// 사진 선택
albumFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('사진 크기는 2MB 이하여야 해요', '#e11d48'); albumFileInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
        pendingPhotoData = evt.target.result;
        albumPreviewImg.src = pendingPhotoData;
        albumCaptionInput.value = '';
        albumUploadForm.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    albumFileInput.value = '';
});

albumCancelBtn.addEventListener('click', () => {
    albumUploadForm.classList.add('hidden');
    pendingPhotoData = null;
});

albumSubmitBtn.addEventListener('click', () => {
    if (!pendingPhotoData || !myUsername) return;
    socket.emit('add_photo', { data: pendingPhotoData, caption: albumCaptionInput.value.trim(), username: myUsername, color: myColor, avatar: myAvatar });
    albumUploadForm.classList.add('hidden');
    pendingPhotoData = null;
});

albumCaptionInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') albumSubmitBtn.click(); });

// 그리드 렌더링
function renderAlbum(photos) {
    albumPhotos = photos;
    albumGrid.innerHTML = '';
    if (!photos.length) {
        albumGrid.innerHTML = '<div class="album-empty">📷 아직 사진이 없어요<br>첫 번째 추억을 올려보세요!</div>';
        return;
    }
    [...photos].reverse().forEach(photo => {
        const card = document.createElement('div');
        card.className = 'album-card';
        const canDelete = myUsername && photo.username === myUsername;
        card.innerHTML = `
            <img src="${photo.data}" alt="${photo.caption}" loading="lazy">
            <div class="album-card-info">
                <div class="album-card-caption">${photo.caption || '(캡션 없음)'}</div>
                <div class="album-card-meta">
                    <span style="display:flex;align-items:center;gap:5px;">
                        <span style="width:14px;height:14px;border-radius:50%;background:${photo.color};display:inline-block;"></span>
                        ${photo.username} · ${photo.date}
                    </span>
                    ${canDelete ? `<button class="album-card-delete" data-id="${photo.id}">🗑️</button>` : ''}
                </div>
            </div>`;
        card.querySelector('img').addEventListener('click', () => openLightbox(photo));
        const delBtn = card.querySelector('.album-card-delete');
        if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('사진을 삭제할까요?')) socket.emit('delete_photo', photo.id); });
        albumGrid.appendChild(card);
    });
}

// 라이트박스
function openLightbox(photo) {
    albumLightboxImg.src = photo.data;
    albumLightboxInfo.innerHTML = `<b>${photo.caption || ''}</b>${photo.caption ? '<br>' : ''}${photo.username} · ${photo.date}`;
    albumLightbox.classList.remove('hidden');
}
albumLightboxClose.addEventListener('click', () => albumLightbox.classList.add('hidden'));
albumLightbox.addEventListener('click', (e) => { if (e.target === albumLightbox) albumLightbox.classList.add('hidden'); });

// 소켓
socket.on('sync_photos', (photos) => renderAlbum(photos));

// init_data에서 photos 수신
const _origInitData = window._origInitData;
