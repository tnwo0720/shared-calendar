// ========================================
// picker.js — 랜덤뽑기
// ========================================
let pickerItems = JSON.parse(localStorage.getItem('picker_items') || '[]');
let pickerHistory = JSON.parse(localStorage.getItem('picker_history') || '[]');
let isSpinning = false;

const pickerInput = document.getElementById('picker-input');
const pickerAddBtn = document.getElementById('picker-add-btn');
const pickerItemsEl = document.getElementById('picker-items');
const pickerSpinBtn = document.getElementById('picker-spin-btn');
const pickerRoulette = document.getElementById('picker-roulette');
const pickerRouletteText = document.getElementById('picker-roulette-text');
const pickerResultDisplay = document.getElementById('picker-result-display');
const pickerResultText = document.getElementById('picker-result-text');
const pickerHistoryEl = document.getElementById('picker-history');

function savePickerItems() {
    localStorage.setItem('picker_items', JSON.stringify(pickerItems));
}

function renderPickerItems() {
    pickerItemsEl.innerHTML = '';
    pickerItems.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'picker-item';
        el.innerHTML = `<span>${item}</span><button class="picker-item-del" data-i="${i}">×</button>`;
        el.querySelector('.picker-item-del').addEventListener('click', () => {
            pickerItems.splice(i, 1);
            savePickerItems();
            renderPickerItems();
        });
        pickerItemsEl.appendChild(el);
    });
    pickerSpinBtn.disabled = pickerItems.length < 2;
}

function addPickerItem() {
    const val = pickerInput.value.trim();
    if (!val || pickerItems.includes(val)) return;
    pickerItems.push(val);
    savePickerItems();
    renderPickerItems();
    pickerInput.value = '';
    pickerInput.focus();
}

pickerAddBtn.addEventListener('click', addPickerItem);
pickerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addPickerItem(); });

function renderPickerHistory() {
    pickerHistoryEl.innerHTML = '';
    pickerHistory.slice(-3).reverse().forEach(item => {
        const el = document.createElement('div');
        el.className = 'picker-history-item';
        el.textContent = item;
        pickerHistoryEl.appendChild(el);
    });
}

pickerSpinBtn.addEventListener('click', () => {
    if (isSpinning || pickerItems.length < 2) return;
    isSpinning = true;
    pickerResultDisplay.classList.add('hidden');
    pickerSpinBtn.disabled = true;

    const result = pickerItems[Math.floor(Math.random() * pickerItems.length)];

    // 스핀 중 텍스트 번쩍임
    let tick = 0;
    const interval = setInterval(() => {
        pickerRouletteText.textContent = pickerItems[tick % pickerItems.length];
        tick++;
    }, 80);

    pickerRoulette.classList.add('spinning');

    setTimeout(() => {
        clearInterval(interval);
        pickerRoulette.classList.remove('spinning');
        pickerRouletteText.textContent = result;

        // 결과 표시
        pickerResultText.textContent = `🎉 ${result}`;
        pickerResultDisplay.classList.remove('hidden');

        // 폭죽
        if (typeof confetti !== 'undefined') {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#8b6f4e','#ff6b6b','#4ecdc4','#ffe66d','#c77dff'] });
        }

        // 기록 저장
        pickerHistory.push(result);
        if (pickerHistory.length > 10) pickerHistory.shift();
        localStorage.setItem('picker_history', JSON.stringify(pickerHistory));
        renderPickerHistory();

        isSpinning = false;
        pickerSpinBtn.disabled = pickerItems.length < 2;
    }, 2600);
});

// 초기 렌더링
renderPickerItems();
renderPickerHistory();
