// ================================================
// Trading Calculator Pro - Step-by-Step App
// ================================================

const FMP_KEY = 'WhZvG1WwRoLOE0vJQGsiS9b5XqTft5rK';
const FMP_URL = 'https://financialmodelingprep.com/api/v3';

// State
let state = {
    balance: 10000,
    currency: 'USD',
    leverage: 50,
    riskMode: 'percent',
    riskPercent: 2,
    riskAmount: 200,
    rr: 3,
    pair: null,
    pip: 0.0001,
    unit: 100000,
    entryPrice: 0,
    slPrice: 0,
    tpPrice: 0,
    direction: 'long'
};

let marketData = {};
let atrData = { atr14: null, atrPct: null, slPips: null, timeframe: '15min' };
let currentStep = 1;
const TOTAL_STEPS = 5;

// ================================================
// FMP Data Fetching
// ================================================

async function fetchQuote(symbol) {
    try {
        const r = await fetch(`${FMP_URL}/quote/${symbol}?apikey=${FMP_KEY}`);
        if (!r.ok) return null;
        const d = await r.json();
        return d[0] || null;
    } catch (e) { return null; }
}

async function fetchHistory(symbol, interval = '15min') {
    try {
        const r = await fetch(`${FMP_URL}/historical-chart/${interval}/${symbol}?apikey=${FMP_KEY}`);
        if (!r.ok) return null;
        return await r.json();
    } catch (e) { return null; }
}

async function loadAllData() {
    showLoading('กำลังดึงข้อมูลตลาด...');
    try {
        const syms = ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','XAUUSD','BTCUSD','ETHUSD','EURGBP','EURJPY','GBPJPY','EURAUD','GBPAUD'];
        const promises = syms.map(s => fetchQuote(s));
        const results = await Promise.allSettled(promises);
        results.forEach((r, i) => {
            if (r.status === 'fulfilled' && r.value) marketData[syms[i]] = r.value;
        });
        renderTicker();
        updateAllPairPrices();
        if (state.pair) await loadATR(state.pair);
        hideLoading();
    } catch (e) {
        hideLoading();
    }
}

async function loadATR(symbol) {
    const interval = (symbol === 'XAUUSD' || symbol === 'BTCUSD' || symbol === 'ETHUSD') ? '15min' : 'daily';
    const bars = await fetchHistory(symbol, interval);
    if (!bars || bars.length < 20) return;

    atrData.timeframe = interval;
    let trs = [];
    for (let i = 0; i < bars.length - 1; i++) {
        const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i+1].close), Math.abs(bars[i].low - bars[i+1].close));
        trs.push(tr);
    }
    atrData.atr14 = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
    const price = bars[0].close;
    atrData.atrPct = (atrData.atr14 / price) * 100;
    atrData.slPips = atrData.atr14 / state.pip;
    atrData.daily = interval === '15min' ? atrData.atr14 * 8 : atrData.atr14;

    // Percentile
    if (bars.length >= 50) {
        let allTrs = [];
        for (let i = 0; i < bars.length - 1; i++) {
            allTrs.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i+1].close), Math.abs(bars[i].low - bars[i+1].close)));
        }
        const sorted = [...allTrs].sort((a, b) => a - b);
        const rank = sorted.filter(v => v <= trs[0]).length;
        atrData.percentile = Math.round((rank / sorted.length) * 100);
    }

    renderATR();
}

function renderTicker() {
    const scroll = document.getElementById('ticker-scroll');
    if (!scroll) return;
    const watch = ['EURUSD','GBPUSD','USDJPY','XAUUSD','BTCUSD','ETHUSD','AUDUSD','USDCAD'];
    let html = '';
    watch.forEach(s => {
        const d = marketData[s];
        if (!d) return;
        const chg = d.changesPercentage;
        const cls = chg >= 0 ? 'up' : 'down';
        const sign = chg >= 0 ? '+' : '';
        const isAct = s === state.pair;
        const dec = (s.includes('JPY') || s === 'XAUUSD' || s === 'BTCUSD' || s === 'ETHUSD') ? 2 : 5;
        html += `<div class="ticker-item ${isAct ? 'active' : ''}" onclick="tickerSelect('${s}')">
            <span class="ticker-sym">${s.replace('USD','/USD')}</span>
            <span class="ticker-price">${d.price.toFixed(dec)}</span>
            <span class="ticker-chg ${cls}">${sign}${chg.toFixed(2)}%</span>
        </div>`;
    });
    scroll.innerHTML = html;
}

function updateAllPairPrices() {
    const pairs = ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','USDCAD','NZDUSD','XAUUSD','BTCUSD','ETHUSD','EURGBP','EURJPY','GBPJPY','EURAUD','GBPAUD','GBPCAD','EURNZD','EURCHF','GBPNZD','NZDJPY','AUDCAD'];
    pairs.forEach(s => {
        const el = document.getElementById('price-' + s);
        if (!el) return;
        const d = marketData[s];
        if (!d) { el.textContent = '--'; return; }
        const dec = (s.includes('JPY') || s === 'XAUUSD' || s === 'BTCUSD' || s === 'ETHUSD') ? 2 : 5;
        el.textContent = d.price.toFixed(dec);
    });
    // Also update metals section prices (separate IDs)
    ['price-XAUUSD2','price-BTCUSD','price-ETHUSD'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const sym = id.replace('price-','').replace('2','');
        const d = marketData[sym];
        if (!d) { el.textContent = '--'; return; }
        el.textContent = d.price.toFixed(sym.includes('JPY') || sym === 'XAUUSD' || sym === 'BTCUSD' || sym === 'ETHUSD' ? 2 : 5);
    });
}

function renderATR() {
    const badge = document.getElementById('atr-badge');
    if (atrData.atrPct !== null) {
        if (atrData.atrPct < 0.1) { badge.className = 'atr-badge low'; badge.textContent = '🟢 Low Vol'; }
        else if (atrData.atrPct < 0.5) { badge.className = 'atr-badge medium'; badge.textContent = '🟡 Medium Vol'; }
        else { badge.className = 'atr-badge high'; badge.textContent = '🔴 High Vol'; }
    }
    document.getElementById('asi-atr').textContent = atrData.atr14 ? atrData.atr14.toFixed(2) : '--';
    document.getElementById('asi-pct').textContent = atrData.atrPct ? atrData.atrPct.toFixed(3) + '%' : '--';
    document.getElementById('asi-sl').textContent = atrData.slPips ? atrData.slPips.toFixed(0) + ' pips' : '--';
}

// ================================================
// Step Navigation
// ================================================

function goToStep(n) {
    if (n < 1 || n > TOTAL_STEPS) return;
    currentStep = n;

    // Update panels
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('step-' + n);
    if (target) {
        target.classList.add('active');
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Update progress bar
    const fill = document.getElementById('step-fill');
    if (fill) fill.style.width = ((n / TOTAL_STEPS) * 100) + '%';

    // Update dots
    document.querySelectorAll('.step-dot').forEach(d => {
        const s = parseInt(d.dataset.step);
        d.classList.remove('active', 'completed');
        if (s === n) d.classList.add('active');
        else if (s < n) d.classList.add('completed');
    });

    // If going to step 3 (pair selection) and we have market data already
    if (n === 3 && Object.keys(marketData).length > 0) {
        updateAllPairPrices();
    }

    // If going to step 4 and pair selected, load ATR for that pair
    if (n === 4 && state.pair) {
        updatePairInfoStep4();
        loadATR(state.pair);
    }

    // If going to step 5, run calculation
    if (n === 5) {
        runCalculation();
    }
}

function nextStep() {
    if (currentStep === 3 && !state.pair) {
        shakeElement(document.getElementById('step3-next'));
        return;
    }
    if (currentStep < TOTAL_STEPS) {
        animateBtnClick(event.target);
        setTimeout(() => goToStep(currentStep + 1), 150);
    }
}

function prevStep() {
    if (currentStep > 1) {
        animateBtnClick(event.target);
        setTimeout(() => goToStep(currentStep - 1), 150);
    }
}

// ================================================
// Form Interactions
// ================================================

function onBalanceChange(el) {
    state.balance = parseFloat(el.value) || 0;
    updateRiskPreview();
}

function setCurrency(val) {
    state.currency = val;
    document.querySelectorAll('#currency-seg .seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === val);
    });
    pulseElement(b);
}

function setLeverage(val) {
    state.leverage = parseInt(val);
    document.querySelectorAll('.lev-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val) === state.leverage);
    });
    pulseElement(b);
}

function setRiskMode(mode) {
    state.riskMode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.mode === mode);
    });
    document.getElementById('risk-percent-group').classList.toggle('hidden', mode !== 'percent');
    document.getElementById('risk-amount-group').classList.toggle('hidden', mode !== 'amount');
    pulseElement(event.target);
}

function onRiskSliderChange(val) {
    state.riskPercent = parseFloat(val);
    document.getElementById('risk-pct-label').textContent = val + '%';
    updateRiskPreview();
}

function updateRiskPreview() {
    const amount = state.riskMode === 'percent'
        ? (state.riskPercent / 100) * state.balance
        : state.riskAmount;
    document.getElementById('risk-preview-usd').textContent = '$' + amount.toFixed(2);
    document.getElementById('risk-preview-pct-label').textContent = state.riskMode === 'percent'
        ? `ของ $${state.balance.toLocaleString()}`
        : '';
}

function setRR(val) {
    state.rr = parseFloat(val);
    document.getElementById('rr-custom').value = val;
    document.querySelectorAll('.rr-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.textContent.replace('1:','')) === state.rr);
    });
    pulseElement(b);
}

// ================================================
// Pair Selection
// ================================================

function selectPair(el) {
    // Clear previous selection
    document.querySelectorAll('.pair-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    pulseElement(el);

    state.pair = el.dataset.pair;
    state.pip = parseFloat(el.dataset.pip);
    state.unit = parseInt(el.dataset.unit);

    // Enable next button
    const nextBtn = document.getElementById('step3-next');
    if (nextBtn) nextBtn.disabled = false;

    // Update step 4 pair info
    updatePairInfoStep4();
}

function tickerSelect(symbol) {
    // Find pair button and select it
    const card = document.querySelector(`.pair-card[data-pair="${symbol}"]`);
    if (card) {
        // Switch to step 3 first if not there
        goToStep(3);
        setTimeout(() => selectPair(card), 300);
    }
}

function updatePairInfoStep4() {
    // Update entry price placeholder
    const entryInput = document.getElementById('entry-price');
    const slInput = document.getElementById('sl-price');
    const tpInput = document.getElementById('tp-price');
    if (!state.pair) return;

    const dec = (state.pair.includes('JPY') || state.pair === 'XAUUSD' || state.pair === 'BTCUSD' || state.pair === 'ETHUSD') ? 2 : 5;
    const step = (state.pair.includes('JPY') || state.pair === 'XAUUSD' || state.pair === 'BTCUSD' || state.pair === 'ETHUSD') ? '0.01' : '0.00001';
    [entryInput, slInput, tpInput].forEach(inp => {
        if (inp) { inp.step = step; inp.placeholder = 'ราคา'; }
    });

    // Auto-fill entry with live price
    fillEntry();
}

function setDirection(dir) {
    state.direction = dir;
    document.querySelectorAll('.dir-btn-app').forEach(b => {
        b.classList.toggle('active', b.classList.contains(dir));
    });
    pulseElement(event.target);
}

// ================================================
// Price Fill Buttons
// ================================================

function fillEntry() {
    const d = marketData[state.pair];
    if (!d) return;
    const dec = (state.pair.includes('JPY') || state.pair === 'XAUUSD' || state.pair === 'BTCUSD' || state.pair === 'ETHUSD') ? 2 : 5;
    document.getElementById('entry-price').value = d.price.toFixed(dec);
    state.entryPrice = d.price;
    updatePriceSummary();
}

function fillSL() {
    if (!atrData.slPips || !state.entryPrice) return;
    const slDist = atrData.slPips * state.pip;
    const sl = state.direction === 'long' ? state.entryPrice - slDist : state.entryPrice + slDist;
    const dec = (state.pair.includes('JPY') || state.pair === 'XAUUSD' || state.pair === 'BTCUSD' || state.pair === 'ETHUSD') ? 2 : 5;
    document.getElementById('sl-price').value = sl.toFixed(dec);
    state.slPrice = sl;
    updatePriceSummary();
}

function fillTP() {
    if (!state.entryPrice || !state.slPrice) return;
    const slDist = Math.abs(state.entryPrice - state.slPrice);
    const tpDist = slDist * state.rr;
    const tp = state.direction === 'long' ? state.entryPrice + tpDist : state.entryPrice - tpDist;
    const dec = (state.pair.includes('JPY') || state.pair === 'XAUUSD' || state.pair === 'BTCUSD' || state.pair === 'ETHUSD') ? 2 : 5;
    document.getElementById('tp-price').value = tp.toFixed(dec);
    state.tpPrice = tp;
    updatePriceSummary();
}

function updatePriceSummary() {
    const entry = parseFloat(document.getElementById('entry-price').value) || 0;
    const sl = parseFloat(document.getElementById('sl-price').value) || 0;
    const tp = parseFloat(document.getElementById('tp-price').value) || 0;
    state.entryPrice = entry;
    state.slPrice = sl;
    state.tpPrice = tp;

    if (!entry || !sl) {
        document.getElementById('price-summary').style.display = 'none';
        return;
    }

    const slPips = Math.abs(entry - sl) / state.pip;
    const tpPips = Math.abs(tp - entry) / state.pip;
    const actualRR = slPips > 0 ? tpPips / slPips : 0;

    const summary = document.getElementById('price-summary');
    summary.style.display = 'flex';
    document.getElementById('ps-sl').textContent = slPips.toFixed(1) + ' pips';
    document.getElementById('ps-tp').textContent = tpPips.toFixed(1) + ' pips';
    document.getElementById('ps-rr').textContent = '1 : ' + actualRR.toFixed(2);
}

// ================================================
// Calculation
// ================================================

function calculateAndGoToResult() {
    animateBtnClick(event.target);
    setTimeout(() => {
        readPricesFromInputs();
        runCalculation();
        goToStep(5);
    }, 200);
}

function readPricesFromInputs() {
    state.entryPrice = parseFloat(document.getElementById('entry-price').value) || 0;
    state.slPrice = parseFloat(document.getElementById('sl-price').value) || 0;
    state.tpPrice = parseFloat(document.getElementById('tp-price').value) || 0;
}

function runCalculation() {
    // Read latest values
    state.balance = parseFloat(document.getElementById('balance').value) || 0;
    state.riskAmount = state.riskMode === 'amount'
        ? (parseFloat(document.getElementById('risk-amount-input').value) || 0)
        : (state.riskPercent / 100) * state.balance;
    state.rr = parseFloat(document.getElementById('rr-custom').value) || 3;
    readPricesFromInputs();

    const riskAmt = state.riskMode === 'percent'
        ? (state.riskPercent / 100) * state.balance
        : state.riskAmount;

    const slPips = Math.abs(state.entryPrice - state.slPrice) / state.pip;
    const tpPips = Math.abs(state.tpPrice - state.entryPrice) / state.pip;

    const pipVal = state.unit * state.pip;
    const lot = slPips > 0 ? riskAmt / (slPips * pipVal) : 0;
    const posUnits = lot * state.unit;
    const posPipVal = slPips > 0 ? riskAmt / slPips : 0;
    const profit = tpPips * posPipVal;
    const loss = slPips * posPipVal;
    const actualRR = slPips > 0 ? tpPips / slPips : 0;
    const margin = posUnits / state.leverage;
    const riskPct = state.balance > 0 ? (riskAmt / state.balance) * 100 : 0;

    // Update result hero
    const lotEl = document.getElementById('rhc-lot');
    lotEl.textContent = lot.toFixed(2);
    animateNumber(lotEl);

    document.getElementById('rhc-pair').textContent = state.pair ? state.pair.replace('USD', '/USD') : '--';
    document.getElementById('result-desc').textContent = state.pair
        ? `สำหรับ ${state.pair.replace('USD','/USD')} ที่ $${state.entryPrice.toFixed(2)}`
        : 'ผลลัพธ์การคำนวณ';

    // Summary row
    document.getElementById('rmc-risk').textContent = '$' + riskAmt.toFixed(2);
    document.getElementById('rmc-rr').textContent = '1 : ' + actualRR.toFixed(2);
    document.getElementById('rmc-profit').textContent = '+$' + profit.toFixed(2);

    // Detail cards
    document.getElementById('rd-risk-amount').textContent = '$' + riskAmt.toFixed(2);
    document.getElementById('rd-position').textContent = posUnits.toLocaleString() + ' Units';
    document.getElementById('rd-pip-value').textContent = '$' + posPipVal.toFixed(2) + '/lot';
    document.getElementById('rd-sl-pips').textContent = slPips.toFixed(1) + ' pips';
    document.getElementById('rd-tp-pips').textContent = tpPips.toFixed(1) + ' pips';
    document.getElementById('rd-margin').textContent = '$' + margin.toFixed(2);
    document.getElementById('rd-risk-pct').textContent = riskPct.toFixed(2) + '%';
    document.getElementById('rd-loss').textContent = '-$' + loss.toFixed(2);

    // Risk bar
    const maxRisk = state.balance * 0.05;
    const fillPct = Math.min((riskAmt / maxRisk) * 100, 100);
    document.getElementById('rvb-fill').style.width = fillPct + '%';
    const badge = document.getElementById('rvb-badge');
    if (riskPct <= 1) { badge.textContent = '🟢 ปลอดภัยมาก'; badge.style.background = 'rgba(34,197,94,0.15)'; badge.style.color = '#22c55e'; }
    else if (riskPct <= 2) { badge.textContent = '🟢 ปลอดภัย'; badge.style.background = 'rgba(34,197,94,0.15)'; badge.style.color = '#22c55e'; }
    else if (riskPct <= 5) { badge.textContent = '🟡 ระวัง'; badge.style.background = 'rgba(234,179,8,0.15)'; badge.style.color = '#eab308'; }
    else { badge.textContent = '🔴 เสี่ยงสูง'; badge.style.background = 'rgba(239,68,68,0.15)'; badge.style.color = '#ef4444'; }

    document.getElementById('rvb-max-label').textContent = `5% ($${maxRisk.toFixed(0)})`;
}

function restartCalculator() {
    pulseElement(event.target);
    state.pair = null;
    state.entryPrice = 0;
    state.slPrice = 0;
    state.tpPrice = 0;
    document.querySelectorAll('.pair-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('selected-pair-banner').style.display = 'none';
    document.getElementById('step3-next').disabled = true;
    document.getElementById('entry-price').value = '';
    document.getElementById('sl-price').value = '';
    document.getElementById('tp-price').value = '';
    document.getElementById('price-summary').style.display = 'none';
    setTimeout(() => goToStep(1), 300);
}

// ================================================
// Refresh All
// ================================================

async function refreshAll() {
    const btn = document.getElementById('header-refresh-btn');
    if (btn) btn.classList.add('spinning');
    showLoading('กำลังรีเฟรชข้อมูล...');
    await loadAllData();
    if (btn) btn.classList.remove('spinning');
    hideLoading();
}

// ================================================
// Utility Animations
// ================================================

function animateBtnClick(el) {
    if (!el) return;
    el.classList.add('pulse-click');
    setTimeout(() => el.classList.remove('pulse-click'), 200);
}

function pulseElement(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'clickPulse 0.2s ease';
}

function shakeElement(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.4s ease';
}

function animateNumber(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'countUp 0.4s ease';
}

// ================================================
// Toastify Notifications ★ FROM toastify-js (2.5K ⭐)
// ================================================

function showToast(message, type = 'success') {
    if (typeof Toastify === 'undefined') {
        console.log('Toastify not loaded, falling back to alert:', message);
        return;
    }
    const colors = {
        success: 'linear-gradient(135deg, #1a7f37, #2ecc71)',
        error: 'linear-gradient(135deg, #c0392b, #e74c3c)',
        warning: 'linear-gradient(135deg, #b8860b, #f39c12)',
        info: 'linear-gradient(135deg, #1a5276, #3498db)'
    };
    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: {
            background: colors[type] || colors.success,
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: "'Prompt', sans-serif",
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 9999
        },
        stopOnFocus: true
    }).showToast();
}

// ================================================
// Loading Overlay
// ================================================

function showLoading(text) {
    const ov = document.getElementById('loading-overlay');
    if (!ov) return;
    document.getElementById('loading-text').textContent = text || 'กำลังโหลด...';
    ov.style.display = 'flex';
}

function hideLoading() {
    const ov = document.getElementById('loading-overlay');
    if (ov) ov.style.display = 'none';
}

// ================================================
// Init
// ================================================

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Attach price input listeners for live summary
    ['entry-price', 'sl-price', 'tp-price'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                setTimeout(updatePriceSummary, 300);
            });
        }
    });

    // RR custom input
    document.getElementById('rr-custom')?.addEventListener('input', function() {
        const v = parseFloat(this.value);
        if (!isNaN(v) && v > 0) {
            state.rr = v;
            document.querySelectorAll('.rr-btn').forEach(b => {
                b.classList.toggle('active', parseInt(b.textContent.replace('1:','')) === v);
            });
        }
    });

    // Initialize
    goToStep(1);
    await loadAllData();
    updateRiskPreview();

    // Sync step-3 next button state
    const nextBtn = document.getElementById('step3-next');
    if (nextBtn) nextBtn.disabled = !state.pair;
});

// Add shake keyframe to page
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
}
`;
document.head.appendChild(shakeStyle);