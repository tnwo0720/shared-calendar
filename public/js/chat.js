// ========================================
// chat.js — 채팅, 이모지, 답장, 파일, 플로팅 패널
// ========================================
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const chatFileInput = document.getElementById('chat-file-input');
let selectedFile = null;

// 카테고리 선택
const catOptions = document.querySelectorAll('.cat-option');
catOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        catOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        myCategory = opt.dataset.cat;
    });
});

// 이모지 피커
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
});
emojiPicker.querySelectorAll('span').forEach(em => {
    em.addEventListener('click', () => {
        chatInput.value += em.textContent;
        emojiPicker.classList.add('hidden');
        chatInput.focus();
    });
});
document.addEventListener('click', () => emojiPicker.classList.add('hidden'));

// 답장 기능
const replyPreview = document.getElementById('reply-preview');
const replyPreviewText = document.getElementById('reply-preview-text');
const replyCancelBtn = document.getElementById('reply-cancel');

function setReply(msg) {
    replyToMsg = { username: msg.username, text: msg.text || msg.fileName || '' };
    replyPreviewText.textContent = `↩️ ${msg.username}: ${replyToMsg.text}`;
    replyPreview.classList.remove('hidden');
    chatInput.focus();
}
replyCancelBtn.addEventListener('click', () => {
    replyToMsg = null;
    replyPreview.classList.add('hidden');
});

// 플로팅 채팅 패널 토글
const chatFab = document.getElementById('chat-fab');
const chatPanel = document.getElementById('chat-panel');
const chatCloseBtn = document.getElementById('chat-close');
const unreadBadge = document.getElementById('unread-badge');

chatFab.addEventListener('click', () => {
    chatOpen = !chatOpen;
    chatPanel.classList.toggle('hidden', !chatOpen);
    if(chatOpen) {
        unreadCount = 0;
        unreadBadge.classList.add('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatInput.focus();
    }
});
chatCloseBtn.addEventListener('click', () => {
    chatOpen = false;
    chatPanel.classList.add('hidden');
});

function updateUnread() {
    if(!chatOpen) {
        unreadCount++;
        unreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        unreadBadge.classList.remove('hidden');
    }
}

// 타이핑 인디케이터
const typingIndicator = document.getElementById('typing-indicator');
let activeTypers = new Set();
function updateTypingIndicator() {
    if(activeTypers.size > 0) {
        typingIndicator.textContent = Array.from(activeTypers).join(', ') + '님이 입력 중...💬';
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.classList.add('hidden');
    }
}

// 파일 선택
chatFileInput.addEventListener('change', (e) => {
    if(e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        chatInput.placeholder = `[${selectedFile.name}] 전송 대기중...`;
    }
});

// 타이핑 감지
chatInput.addEventListener('input', () => {
    socket.emit('typing', myUsername);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('stop_typing'), 1500);
});

// 메시지 전송
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if(!text && !selectedFile) return;

    if (selectedFile) {
        if(selectedFile.size > 5 * 1024 * 1024) { alert("파일은 5MB 이하만 전송 가능합니다."); return; }
        const reader = new FileReader();
        reader.onload = function(evt) {
            socket.emit('send_message', { 
                username: myUsername, text: text, color: myColor, avatar: myAvatar,
                fileData: evt.target.result, fileName: selectedFile.name, fileType: selectedFile.type
            });
            resetChatInput();
        };
        reader.readAsDataURL(selectedFile);
    } else {
        socket.emit('send_message', { username: myUsername, text: text, color: myColor, avatar: myAvatar, replyTo: replyToMsg });
        resetChatInput();
    }
});

function resetChatInput() {
    chatInput.value = '';
    chatInput.placeholder = "메시지 입력...";
    selectedFile = null;
    chatFileInput.value = '';
    socket.emit('stop_typing');
    replyToMsg = null;
    replyPreview.classList.add('hidden');
}

// 메시지 렌더링
function appendMessage(msg) {
    if(msg.isSystem) {
        const sysDiv = document.createElement('div');
        sysDiv.className = 'system-message';
        sysDiv.textContent = msg.text;
        chatMessages.appendChild(sysDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return;
    }
    
    const msgDate = msg.time ? new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' }) : '';
    if(msg.time && msgDate !== lastChatDate) {
        lastChatDate = msgDate;
        const divider = document.createElement('div');
        divider.className = 'chat-date-divider';
        divider.textContent = msgDate;
        chatMessages.appendChild(divider);
    }
    
    const isMine = msg.username === myUsername;
    const div = document.createElement('div');
    div.className = `message ${isMine ? 'mine' : 'others'}`;
    div.setAttribute('data-msg-id', msg.id);
    
    let parsedText = msg.text || '';
    if (parsedText) {
        parsedText = parsedText.replace(/@([가-힣a-zA-Z0-9]+)/g, '<span style="color:var(--primary); font-weight:800; background:rgba(195,154,107,0.2); padding:2px 4px; border-radius:4px;">@$1</span>');
    }
    
    let contentHtml = '';
    if(msg.replyTo) {
        contentHtml += `<div class="reply-bubble">↩️ ${msg.replyTo.username}: ${msg.replyTo.text}</div>`;
    }
    contentHtml += parsedText ? `<div>${parsedText}</div>` : '';
    
    if (msg.fileData) {
        if (msg.fileType && msg.fileType.startsWith('image/')) {
            contentHtml += `<img src="${msg.fileData}" class="chat-file-preview" alt="${msg.fileName}">`;
        } else {
            contentHtml += `<a href="${msg.fileData}" download="${msg.fileName}" class="chat-file-link">📁 ${msg.fileName} 다운로드</a>`;
        }
    }

    div.innerHTML = `
        <div class="msg-header"><div class="msg-avatar" style="background:${msg.color}">${msg.avatar || '☕'}</div>
        <span>${msg.username}</span><span style="font-size:0.7rem; opacity:0.7;">${msg.time}</span>
        <button class="msg-reply-btn" title="답장">↩️</button>${isMine ? `<button class="msg-delete-btn" title="삭제">🗑️</button>` : ''}</div>
        <div class="msg-bubble-wrapper">
            <div class="msg-bubble">${contentHtml}</div>
            <div class="msg-reactions">
                <button class="reaction-btn" onclick="sendReaction(${msg.id}, '👍')">👍<span class="reaction-count" id="react-thumb-${msg.id}">${msg.reactions?.['👍'] || ''}</span></button>
                <button class="reaction-btn" onclick="sendReaction(${msg.id}, '❤️')">❤️<span class="reaction-count" id="react-heart-${msg.id}">${msg.reactions?.['❤️'] || ''}</span></button>
            </div>
        </div>
    `;
    div.querySelector('.msg-reply-btn').addEventListener('click', () => setReply(msg));
    const delBtn = div.querySelector('.msg-delete-btn');
    if(delBtn) delBtn.addEventListener('click', () => {
        if(confirm('이 메시지를 삭제하시겠습니까?')) socket.emit('delete_message', msg.id);
    });
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.sendReaction = function(msgId, emoji) {
    socket.emit('add_reaction', { msgId, reaction: emoji });
}

// 이미지 모달
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeImageModalBtn = document.getElementById('close-image-modal');

function openImageModal(src) { modalImage.src = src; imageModal.classList.remove('hidden'); }
chatMessages.addEventListener('click', (e) => {
    if(e.target.classList.contains('chat-file-preview')) openImageModal(e.target.src);
});
closeImageModalBtn.addEventListener('click', () => imageModal.classList.add('hidden'));
imageModal.addEventListener('click', (e) => { if(e.target === imageModal) imageModal.classList.add('hidden'); });

// 드래그 앤 드롭
const chatContainerNode = document.querySelector('.chat-container');
chatContainerNode.addEventListener('dragover', (e) => { e.preventDefault(); chatContainerNode.style.boxShadow = 'inset 0 0 0 3px var(--primary)'; });
chatContainerNode.addEventListener('dragleave', (e) => { e.preventDefault(); chatContainerNode.style.boxShadow = 'none'; });
chatContainerNode.addEventListener('drop', (e) => {
    e.preventDefault();
    chatContainerNode.style.boxShadow = 'none';
    if(e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        if(droppedFile.size > 5 * 1024 * 1024) { alert('파일은 5MB 이하만 전송 가능합니다.'); return; }
        const reader = new FileReader();
        reader.onload = function(evt) {
            socket.emit('send_message', {
                username: myUsername, text: '', color: myColor, avatar: myAvatar,
                fileData: evt.target.result, fileName: droppedFile.name, fileType: droppedFile.type
            });
        };
        reader.readAsDataURL(droppedFile);
    }
});
