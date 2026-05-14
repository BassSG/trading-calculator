// ================================================
// Trading Calculator - Position Size Engine
// ================================================

// State
let state = {
    balance: 10000,
    accountCurrency: 'USD',
    leverage: 50,
    riskMode: 'percent',   // 'percent' or 'amount'
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

// ================================================
// Core Calculation Logic
// ================================================

function calculate() {
    readInputs();

    // 1. Risk amount in account currency
    let riskAmountCalc;
    if (state.riskMode === 'percent') {
        riskAmountCalc = (state.riskPercent / 100) * state.balance;
    } else {
        riskAmountCalc = state.riskAmount;
    }

    // 2. Stop Loss distance in pips
    const slPips = Math.abs(state.entryPrice - state.slPrice) / state.pip;

    // 3. Pip value per lot (in quote currency of the pair)
    // Standard lot = 100,000 units
    const pipValuePerLot = calculatePipValue(state.pair, state.unit);

    // 4. Lot size = riskAmount / (slPips * pipValuePerLot)
    const lotSize = slPips > 0 ? riskAmountCalc / (slPips * pipValuePerLot) : 0;

    // 5. Position size in units
    const positionUnits = lotSize * state.unit;

    // 6. Pip value for THIS position
    const positionPipValue = slPips > 0 ? riskAmountCalc / slPips : 0;

    // 7. Take Profit pips
    const tpPips = Math.abs(state.tpPrice - state.entryPrice) / state.pip;

    // 8. Estimated Profit/Loss
    const estimatedProfit = tpPips * positionPipValue;
    const estimatedLoss = slPips * positionPipValue;

    // 9. Actual R:R
    const actualRR = slPips > 0 ? tpPips / slPips : 0;

    // 10. Margin required
    const marginRequired = positionUnits / state.leverage;

    // 11. % of account risked
    const riskPct = state.balance > 0 ? (riskAmountCalc / state.balance) * 100 : 0;

    // 12. Effective pip value in account currency
    const effectivePipValue = calculateEffectivePipValue(state.pair, state.unit, state.accountCurrency);

    // ================================================
    // Render Results
    // ================================================
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
        effectivePipValue,
        positionPipValue,
        pipValuePerLot
    });
}

function calculatePipValue(pair, unit) {
    // Pip value per standard lot in quote currency
    // For JPY pairs, pip = 0.01, for others pip = 0.0001
    const isJPY = pair.includes('JPY');
    const pipSize = isJPY ? 0.01 : 0.0001;
    return unit * pipSize;
}

function calculateEffectivePipValue(pair, unit, accountCurrency) {
    // Returns pip value per standard lot in account currency
    // We estimate by assuming USD is quote or using rough conversion
    const isJPY = pair.includes('JPY');
    const pipSize = isJPY ? 0.01 : 0.0001;

    // For standard lot
    let pipValue = unit * pipSize;

    // If account currency is not the quote currency, convert
    // For simplicity, we'll show both quote and account currency
    return pipValue;
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

    // Main lot display
    document.getElementById('lot-size').textContent = r.lotSize.toFixed(2);

    // Risk value
    document.getElementById('risk-value').textContent = fmtMoney(r.riskAmountCalc);
    document.getElementById('risk-amount-result').textContent = fmtMoney(r.riskAmountCalc);

    // R:R
    document.getElementById('rr-ratio').textContent = `1 : ${r.actualRR.toFixed(2)}`;
    document.getElementById('rr-detail-result').textContent = `1 : ${r.actualRR.toFixed(2)}`;

    // Position size
    document.getElementById('position-size-result').textContent = `${r.positionUnits.toLocaleString('en-US', { maximumFractionDigits: 0 })} Units`;

    // Pip value
    document.getElementById('pip-value-result').textContent = `$${r.positionPipValue.toFixed(2)}/lot`;

    // SL / TP pips
    document.getElementById('sl-pips-result').textContent = `${r.slPips.toFixed(1)} pips`;
    document.getElementById('tp-pips-result').textContent = `${r.tpPips.toFixed(1)} pips`;

    // Profit/Loss
    document.getElementById('profit-result').textContent = `+${fmtMoney(r.estimatedProfit)}`;
    document.getElementById('profit-result').style.color = 'var(--bullish)';
    document.getElementById('loss-result').textContent = `-${fmtMoney(r.estimatedLoss)}`;
    document.getElementById('loss-result').style.color = 'var(--bearish)';

    // Margin
    document.getElementById('margin-result').textContent = fmtMoney(r.marginRequired);

    // Risk %
    document.getElementById('risk-pct-result').textContent = `${r.riskPct.toFixed(2)}%`;

    // Account balance display
    document.getElementById('account-balance-display').textContent = `Balance: $${state.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

    // Risk bar
    const maxRisk = state.balance * 0.05; // 5% of balance as max display
    const riskBarWidth = Math.min((r.riskAmountCalc / maxRisk) * 100, 100);
    document.getElementById('risk-bar-fill').style.width = riskBarWidth + '%';

    // Risk badge
    const badge = document.getElementById('risk-level-badge');
    badge.className = 'risk-badge';
    if (r.riskPct <= 1) {
        badge.textContent = '🟢 ปลอดภัยมาก';
    } else if (r.riskPct <= 2) {
        badge.textContent = '🟢 ปลอดภัย';
        badge.className += '';
    } else if (r.riskPct <= 5) {
        badge.textContent = '🟡 ระมัดระวัง';
        badge.className += ' warning';
    } else {
        badge.textContent = '🔴 เสี่ยงสูง';
        badge.className += ' danger';
    }

    // Update risk bar labels based on actual risk
    const riskBarMax = Math.max(riskAmountCalc * 2, state.balance * 0.02);
    document.getElementById('risk-bar-max').textContent = '$' + riskBarMax.toLocaleString('en-US', { maximumFractionDigits: 0 });
    document.getElementById('risk-pct-bar-max').textContent = ((riskBarMax / state.balance) * 100).toFixed(1) + '%';

    // Reference table
    renderLotRefTable(r.positionPipValue);

    // Animate results
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
        btn.classList.toggle('active', parseInt(btn.textContent.replace('1:','')) === ratio);
    });
}

function selectPair(el) {
    document.querySelectorAll('.pair-btn').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
    state.pair = el.dataset.pair;
    state.pip = parseFloat(el.dataset.pip);
    state.unit = parseInt(el.dataset.unit);

    // Auto-set entry price placeholder based on pair type
    const isJPY = state.pair.includes('JPY') || state.pair === 'XAUUSD';
    const entryInput = document.getElementById('entry-price');
    const slInput = document.getElementById('sl-price');
    const tpInput = document.getElementById('tp-price');

    if (state.pair === 'XAUUSD') {
        entryInput.placeholder = '3300.00';
        slInput.placeholder = '3280.00';
        tpInput.placeholder = '3350.00';
    } else if (isJPY) {
        entryInput.placeholder = '150.00';
        slInput.placeholder = '149.50';
        tpInput.placeholder = '151.00';
    } else {
        entryInput.placeholder = '1.0950';
        slInput.placeholder = '1.0900';
        tpInput.placeholder = '1.1050';
    }
}

function setDirection(dir) {
    state.direction = dir;
    document.querySelectorAll('.dir-btn').forEach(btn => {
        btn.classList.toggle('active', btn.classList.contains(dir));
    });
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
            <td style="color: var(--gold); font-weight: 600;">${lot.toFixed(2)} lots</td>
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
    document.querySelectorAll('.result-card, .mini-card, .result-main-card').forEach((el, i) => {
        el.style.animation = 'none';
        el.offsetHeight; // trigger reflow
        el.style.animation = `fadeIn 0.3s ease ${i * 0.05}s both`;
    });
}

// ================================================
// Auto-calculate on input change
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(el => {
        el.addEventListener('input', () => {
            // Debounce
            clearTimeout(el._calcTimer);
            el._calcTimer = setTimeout(calculate, 300);
        });
        el.addEventListener('change', () => {
            clearTimeout(el._calcTimer);
            calculate();
        });
    });

    // Initial calculation
    calculate();
});

// ================================================
// Utility: format currency
// ================================================

function riskAmountCalc() {
    if (state.riskMode === 'percent') {
        return (state.riskPercent / 100) * state.balance;
    }
    return state.riskAmount;
}
