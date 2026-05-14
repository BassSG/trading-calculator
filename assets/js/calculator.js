// ================================================
// Trading Calculator Pro - Position Size Engine
// FMP Live Data + ATR Risk Management
// ================================================

const FMP_API_KEY = 'WhZvG1WwRoLOE0vJQGsiS9b5XqTft5rK';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

// State
let state = {
    balance: 10000,
    accountCurrency: 'USD',
    leverage: 50,
    riskMode: 'percent',
    riskPercent: 2,
    riskAmount: 200,
    riskReward: 3,
    pair: 'EURUSD',
    pip: 0.0001,
    unit: 100000,
    entryPrice: 1.0950,
    slPrice: 1.0900,
    tpPrice: 1.1050,
    direction: 'long'
};

// Live market data
let marketData = {};
let atrData = {
    atr14: null,
    atrPct: null,
    atrDaily: null,
    percentile: null,
    slRecommendation: null,
    timeframe: '15min'
};

// ================================================
// FMP Data Fetching
// ================================================

async function fetchQuote(symbol) {
    try {
        const res = await fetch(`${FMP_BASE_URL}/quote/${symbol}?apikey=${FMP_API_KEY}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data[0] || null;
    } catch (e) {
        console.warn(`FMP fetch error for ${symbol}:`, e);
        return null;
    }
}

async function fetchHistoricalChart(symbol, interval = '15min') {
    try {
        const res = await fetch(`${FMP_BASE_URL}/historical-chart/${interval}/${symbol}?apikey=${FMP_API_KEY}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn(`FMP historical fetch error for ${symbol}:`, e);
        return null;
    }
}

async function loadAllMarketData() {
    showLoading('กำลังดึงข้อมูลราคาตลาด...');
    try {
        const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'EURGBP', 'EURJPY', 'GBPJPY'];
        const promises = symbols.map(s => fetchQuote(s));
        const results = await Promise.allSettled(promises);
        results.forEach((result, i) => {
            if (result.status === 'fulfilled' && result.value) {
                marketData[symbols[i]] = result.value;
            }
        });

        // Load ATR for active pair
        await loadATRData(state.pair);

        renderPriceTicker();
        updatePairInfoBar();
        hideLoading();
    } catch (e) {
        console.warn('loadAllMarketData error:', e);
        hideLoading();
    }
}

async function loadATRData(symbol) {
    // For metals/crypto use 15min; for forex use daily
    const interval = (symbol === 'XAUUSD' || symbol === 'BTCUSD' || symbol === 'ETHUSD') ? '15min' : 'daily';
    const history = await fetchHistoricalChart(symbol, interval);

    if (!history || history.length < 20) return;

    // Keep full history in memory
    atrData.history = history.slice(0, 200); // keep 200 bars
    atrData.timeframe = interval;

    // Calculate ATR(14)
    const bars = history;
    let trs = [];
    for (let i = 0; i < bars.length - 1; i++) {
        const high = bars[i].high;
        const low = bars[i].low;
        const prevClose = bars[i + 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trs.push(tr);
    }

    // ATR(14) = Wilder's smoothing
    const atr14 = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14;
    atrData.atr14 = atr14;

    // ATR as % of price
    const currentPrice = bars[0].close;
    atrData.atrPct = (atr14 / currentPrice) * 100;

    // Daily ATR estimate (for 15min, extrapolate)
    if (interval === '15min') {
        atrData.atrDaily = atr14 * 8; // ~8 x 15min = 24h
    } else {
        atrData.atrDaily = atr14;
    }

    // Percentile rank (last 50 bars vs 200-bar history)
    if (atrData.history && atrData.history.length >= 50) {
        const recent50 = trs.slice(0, 50);
        const allBars = atrData.history;
        const allTrs = [];
        for (let i = 0; i < allBars.length - 1; i++) {
            const tr = Math.max(
                allBars[i].high - allBars[i].low,
                Math.abs(allBars[i].high - allBars[i + 1].close),
                Math.abs(allBars[i].low - allBars[i + 1].close)
            );
            allTrs.push(tr);
        }
        const sorted = [...allTrs].sort((a, b) => a - b);
        const rank = recent50[0]; // current ATR
        const below = sorted.filter(v => v <= rank).length;
        atrData.percentile = Math.round((below / sorted.length) * 100);
    }

    // SL Recommendation: 1x ATR
    const pipSize = symbol === 'XAUUSD' || symbol === 'BTCUSD' ? 0.01 : (symbol.includes('JPY') ? 0.01 : 0.0001);
    atrData.slRecommendation = atr14 / pipSize; // in pips

    renderATRPanel();
}

function renderPriceTicker() {
    const ticker = document.getElementById('price-ticker');
    const watchList = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'AUDUSD', 'USDCAD', 'NZDUSD'];

    let html = '';
    watchList.forEach(sym => {
        const data = marketData[sym];
        if (!data) return;
        const change = data.changesPercentage;
        const sign = change >= 0 ? '+' : '';
        const cls = change >= 0 ? 'up' : 'down';
        const isActive = sym === state.pair;
        html += `<div class="ticker-item ${isActive ? 'active' : ''}" onclick="tickerSelectPair('${sym}')">
            <span class="ticker-symbol">${sym.replace('USD', '/USD')}</span>
            <span class="ticker-price">${data.price.toFixed(sym === 'XAUUSD' || sym === 'BTCUSD' ? 2 : 5)}</span>
            <span class="ticker-change ${cls}">${sign}${change.toFixed(2)}%</span>
        </div>`;
    });

    html += `<button class="ticker-refresh" id="refresh-btn" onclick="refreshData()" title="รีเฟรชข้อมูล">🔄 Refresh</button>`;
    ticker.innerHTML = html;
}

function updatePairInfoBar() {
    const data = marketData[state.pair];
    if (!data) return;

    const isJPY = state.pair.includes('JPY');
    const isMetal = state.pair === 'XAUUSD' || state.pair === 'BTCUSD';
    const decimals = isJPY || isMetal ? 2 : 5;

    document.getElementById('live-price').textContent = data.price.toFixed(decimals);
    const spread = data.dayHigh - data.dayLow;
    document.getElementById('spread-value').textContent = spread.toFixed(decimals);
    document.getElementById('pip-size-display').textContent = state.pip;
    document.getElementById('unit-display').textContent = state.unit.toLocaleString();

    // Auto-fill entry price if empty
    const entryInput = document.getElementById('entry-price');
    if (!entryInput.value || parseFloat(entryInput.value) === 0) {
        entryInput.value = data.price.toFixed(decimals);
    }
}

function renderATRPanel() {
    // Update ATR stats
    document.getElementById('atr-value').textContent = atrData.atr14 ? atrData.atr14.toFixed(2) : '--';
    document.getElementById('atr-timeframe').textContent = atrData.timeframe;
    document.getElementById('atr-pct').textContent = atrData.atrPct ? atrData.atrPct.toFixed(3) + '%' : '--';
    document.getElementById('atr-daily').textContent = atrData.atrDaily ? atrData.atrDaily.toFixed(2) : '--';
    document.getElementById('atr-percentile').textContent = atrData.percentile ? atrData.percentile + '%' : '--';

    // Volatility badge
    const badge = document.getElementById('atr-vol-badge');
    if (atrData.atrPct !== null) {
        if (atrData.atrPct < 0.1) {
            badge.className = 'atr-badge low';
            badge.textContent = '🟢 Low Vol';
        } else if (atrData.atrPct < 0.5) {
            badge.className = 'atr-badge medium';
            badge.textContent = '🟡 Medium Vol';
        } else {
            badge.className = 'atr-badge high';
            badge.textContent = '🔴 High Vol';
        }
    }

    // SL Recommendation
    const slPips = atrData.slRecommendation;
    document.getElementById('atr-sl-value').textContent = slPips ? slPips.toFixed(0) + ' pips' : '--';
    document.getElementById('atr-sl-pips-val').textContent = slPips ? `≈ ${(slPips * state.pip).toFixed(state.pip === 0.01 ? 2 : 4)} price units` : '--';

    const entryInput = document.getElementById('entry-price');
    if (entryInput.value && parseFloat(entryInput.value) > 0) {
        document.getElementById('atr-sl-pips-text').textContent =
            `${slPips ? slPips.toFixed(0) + ' pips' : '--'} จากราคา ${parseFloat(entryInput.value).toFixed(2)}`;
    }
}

// ================================================
// Core Calculation Logic
// ================================================

function calculate() {
    readInputs();

    // 1. Risk amount
    let riskAmountCalc;
    if (state.riskMode === 'percent') {
        riskAmountCalc = (state.riskPercent / 100) * state.balance;
    } else {
        riskAmountCalc = state.riskAmount;
    }

    // 2. SL/TP distances in pips
    const slPips = Math.abs(state.entryPrice - state.slPrice) / state.pip;
    const tpPips = Math.abs(state.tpPrice - state.entryPrice) / state.pip;

    // 3. Pip value per lot
    const pipValuePerLot = calculatePipValue(state.pair, state.unit);

    // 4. Lot size
    const lotSize = slPips > 0 ? riskAmountCalc / (slPips * pipValuePerLot) : 0;

    // 5. Position details
    const positionUnits = lotSize * state.unit;
    const positionPipValue = slPips > 0 ? riskAmountCalc / slPips : 0;
    const estimatedProfit = tpPips * positionPipValue;
    const estimatedLoss = slPips * positionPipValue;
    const actualRR = slPips > 0 ? tpPips / slPips : 0;
    const marginRequired = positionUnits / state.leverage;
    const riskPct = state.balance > 0 ? (riskAmountCalc / state.balance) * 100 : 0;

    renderResults({
        lotSize,
        riskAmountCalc,
        positionUnits,
        slPips,
        tpPips,
        estimatedProfit,
        estimatedLoss,
        actualRR,
        marginRequired,
        riskPct,
        positionPipValue,
        pipValuePerLot
    });
}

function calculatePipValue(pair, unit) {
    const isJPY = pair.includes('JPY');
    const isMetal = (pair === 'XAUUSD');
    const pipSize = isJPY || isMetal ? 0.01 : 0.0001;
    // For XAUUSD: 1 lot = 100 oz, 1 pip = $1
    return unit * pipSize;
}

function renderResults(r) {
    const fmt = (n, decimals = 2) => {
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (Math.abs(n) >= 1e3) return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        return n.toFixed(decimals);
    };

    const fmtMoney = (n) => {
        const sign = n < 0 ? '-' : '';
        return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Hero results
    document.getElementById('lot-size').textContent = r.lotSize.toFixed(2);
    document.getElementById('risk-value').textContent = fmtMoney(r.riskAmountCalc);
    document.getElementById('rr-ratio').textContent = `1 : ${r.actualRR.toFixed(2)}`;
    document.getElementById('profit-result').textContent = `+${fmtMoney(r.estimatedProfit)}`;
    document.getElementById('loss-result').textContent = `-${fmtMoney(r.estimatedLoss)}`;

    // Detailed cards
    document.getElementById('risk-amount-result').textContent = fmtMoney(r.riskAmountCalc);
    document.getElementById('position-size-result').textContent = `${r.positionUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })} Units`;
    document.getElementById('pip-value-result').textContent = `$${r.positionPipValue.toFixed(2)}/lot`;
    document.getElementById('sl-pips-result').textContent = `${r.slPips.toFixed(1)} pips`;
    document.getElementById('tp-pips-result').textContent = `${r.tpPips.toFixed(1)} pips`;
    document.getElementById('margin-result').textContent = fmtMoney(r.marginRequired);
    document.getElementById('rr-detail-result').textContent = `1 : ${r.actualRR.toFixed(2)}`;
    document.getElementById('risk-pct-result').textContent = `${r.riskPct.toFixed(2)}%`;

    // Risk bar
    document.getElementById('account-balance-display').textContent = `Balance: $${state.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const maxRisk = state.balance * 0.05;
    const riskBarWidth = Math.min((r.riskAmountCalc / maxRisk) * 100, 100);
    document.getElementById('risk-bar-fill').style.width = riskBarWidth + '%';
    document.getElementById('risk-bar-max').textContent = '$' + maxRisk.toLocaleString('en-US', { maximumFractionDigits: 0 });
    document.getElementById('risk-pct-bar-max').textContent = '5%';

    // Risk badge
    const badge = document.getElementById('risk-level-badge');
    badge.className = 'risk-badge';
    if (r.riskPct <= 1) badge.textContent = '🟢 ปลอดภัยมาก';
    else if (r.riskPct <= 2) badge.textContent = '🟢 ปลอดภัย';
    else if (r.riskPct <= 5) { badge.textContent = '🟡 ระวัง'; badge.classList.add('warning'); }
    else badge.textContent = '🔴 เสี่ยงสูง';

    // Reference table
    renderLotRefTable(r.positionPipValue);
    animateResults();
}

// ================================================
// Input Reading
// ================================================

function readInputs() {
    state.balance = parseFloat(document.getElementById('balance').value) || 0;
    state.accountCurrency = document.getElementById('account-currency').value;
    state.leverage = parseInt(document.getElementById('leverage').value);
    state.riskPercent = parseFloat(document.getElementById('risk-percent').value) || 0;
    state.riskAmount = parseFloat(document.getElementById('risk-amount').value) || 0;
    state.riskReward = parseFloat(document.getElementById('rr-custom').value) || 3;
    state.entryPrice = parseFloat(document.getElementById('entry-price').value) || 0;
    state.slPrice = parseFloat(document.getElementById('sl-price').value) || 0;
    state.tpPrice = parseFloat(document.getElementById('tp-price').value) || 0;
}

// ================================================
// UI Interactions
// ================================================

function setRiskMode(mode) {
    state.riskMode = mode;
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.getElementById('risk-percent-group').classList.toggle('hidden', mode !== 'percent');
    document.getElementById('risk-amount-group').classList.toggle('hidden', mode !== 'amount');
}

function setRR(ratio) {
    state.riskReward = ratio;
    document.getElementById('rr-custom').value = ratio;
    document.querySelectorAll('.rr-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.textContent.replace('1:', '')) === ratio);
    });
    // Auto-calculate TP based on R:R
    autoFillTP();
}

function selectPair(el) {
    // Clear active from all pair buttons
    document.querySelectorAll('.pair-btn-v2').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');

    state.pair = el.dataset.pair;
    state.pip = parseFloat(el.dataset.pip);
    state.unit = parseInt(el.dataset.unit);

    // Update placeholders
    const isJPY = state.pair.includes('JPY');
    const isMetal = (state.pair === 'XAUUSD' || state.pair === 'BTCUSD');
    const decimals = (isJPY || isMetal) ? 2 : 5;
    const entryInput = document.getElementById('entry-price');
    entryInput.step = isJPY || isMetal ? '0.01' : '0.00001';
    entryInput.placeholder = '0.00000'.slice(0, decimals + 2);

    // Update pair info bar
    updatePairInfoBar();

    // Reload ATR for new pair
    loadATRData(state.pair);

    // Auto-fill from live price
    fillEntryFromLive();
}

function showPairTab(tab) {
    document.querySelectorAll('.pair-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('pair-majors').style.display = tab === 'majors' ? '' : 'none';
    document.getElementById('pair-minors').style.display = tab === 'minors' ? '' : 'none';
    document.getElementById('pair-metals').style.display = tab === 'metals' ? '' : 'none';
}

function setDirection(dir) {
    state.direction = dir;
    document.querySelectorAll('.dir-btn').forEach(btn => {
        btn.classList.toggle('active', btn.classList.contains(dir));
    });
}

function fillEntryFromLive() {
    const data = marketData[state.pair];
    if (!data) return;
    const isJPY = state.pair.includes('JPY');
    const isMetal = (state.pair === 'XAUUSD' || state.pair === 'BTCUSD');
    const decimals = (isJPY || isMetal) ? 2 : 5;
    document.getElementById('entry-price').value = data.price.toFixed(decimals);
    calculate();
}

function fillSLFromATR() {
    if (!atrData.slRecommendation || !document.getElementById('entry-price').value) return;
    const entry = parseFloat(document.getElementById('entry-price').value);
    const slDistance = atrData.slRecommendation * state.pip;
    const sl = state.direction === 'long' ? entry - slDistance : entry + slDistance;
    document.getElementById('sl-price').value = sl.toFixed(state.pip === 0.01 ? 2 : 5);
    calculate();
}

function autoFillTP() {
    const slPips = Math.abs(state.entryPrice - state.slPrice) / state.pip;
    if (slPips > 0) {
        const tpPipsTarget = slPips * state.riskReward;
        const tp = state.direction === 'long'
            ? state.entryPrice + (tpPipsTarget * state.pip)
            : state.entryPrice - (tpPipsTarget * state.pip);
        document.getElementById('tp-price').value = tp.toFixed(state.pip === 0.01 ? 2 : 5);
    }
}

function tickerSelectPair(symbol) {
    // Find the pair button for this symbol
    const pairBtn = document.querySelector(`.pair-btn-v2[data-pair="${symbol}"]`);
    if (pairBtn) {
        selectPair(pairBtn);
        renderPriceTicker();
    }
}

async function refreshData() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('spinning');
    btn.textContent = 'กำลังโหลด...';
    await loadAllMarketData();
    btn.classList.remove('spinning');
    btn.textContent = '🔄 Refresh';
}

// ================================================
// Lot Reference Table
// ================================================

function renderLotRefTable(pipValue) {
    const lotSizes = [0.01, 0.05, 0.1, 0.2, 0.5, 1.0];
    const tbody = document.getElementById('lot-ref-body');
    tbody.innerHTML = '';

    lotSizes.forEach(lot => {
        const units = lot * 100000;
        const pipVal = (units * state.pip).toFixed(2);
        const riskAt100 = (units * state.pip * 100).toFixed(2);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--gold);font-weight:600;">${lot.toFixed(2)} lots</td>
            <td>${units.toLocaleString()}</td>
            <td>$${pipVal}</td>
            <td>$${riskAt100}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ================================================
// Animations
// ================================================

function animateResults() {
    document.querySelectorAll('.result-card, .result-sub-card, .result-main-v2').forEach((el, i) => {
        el.style.animation = 'none';
        el.offsetHeight;
        el.style.animation = `fadeIn 0.3s ease ${i * 0.05}s both`;
    });
}

// ================================================
// Loading Overlay
// ================================================

function showLoading(text) {
    const overlay = document.getElementById('loading-overlay');
    document.getElementById('loading-text').textContent = text || 'กำลังดึงข้อมูล...';
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// ================================================
// Initialization
// ================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Attach input listeners
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(el => {
        el.addEventListener('input', () => {
            clearTimeout(el._calcTimer);
            el._calcTimer = setTimeout(calculate, 300);
        });
        el.addEventListener('change', () => {
            clearTimeout(el._calcTimer);
            calculate();
        });
    });

    // Load market data from FMP
    await loadAllMarketData();

    // Initial calculation
    calculate();
});