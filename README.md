# 📐 Trading Calculator

> Position Size & Lot Calculator สำหรับ Forex, Gold และ Cross Pairs

**Live:** https://BassSG.github.io/trading-calculator

## ✨ Features

- **Position Size Calculator** — คำนวณขนาดล็อตอย่างแม่นยำจาก Stop Loss
- **Multi-Pair Support** — Majors, Minors, Crosses, Gold (XAUUSD)
- **Risk Management** — ใส่ Risk เป็น % หรือ จำนวนเงิน (USD/THB/EUR/GBP)
- **Risk : Reward** — กำหนด R:R ratio และดูผลตอบแทนที่ TP
- **Margin Calculation** — ดู Margin ที่ต้องใช้ตาม Leverage
- **Visual Risk Bar** — เห็นภาพว่าความเสี่ยงอยู่ระดับไหน
- **Live Auto-Calculate** — คำนวณอัตโนมัติทุกครั้งที่แก้ไข Input
- **Dark Gold Theme** — สวยงามเข้ากับ XAUUSD Trading Hub

## 📊 Supported Pairs

### Majors
EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD

### Crosses & Others
XAU/USD (Gold), EUR/GBP, EUR/JPY, GBP/JPY, AUD/JPY, EUR/AUD, GBP/AUD, GBP/CAD, GBP/NZD, NZD/JPY, AUD/CAD, AUD/CHF, CAD/JPY, CHF/JPY, EUR/CAD, EUR/NZD, EUR/CHF, CAD/CHF

## 🧮 How It Works

```
Lot Size = Risk Amount ($) ÷ (Stop Loss Pips × Pip Value per Lot)
```

## 📁 Project Structure

```
trading-calculator/
├── index.html          # Main calculator page
├── assets/
│   ├── css/style.css   # Dark gold theme stylesheet
│   └── js/calculator.js # Position size calculation engine
└── README.md
```

## 🚀 Deploy to GitHub Pages

1. Push to `BassSG/trading-calculator`
2. Go to Settings → Pages → Source: `main` / `root`
3. Site will be live at `https://BassSG.github.io/trading-calculator`

---

Developed by **Nong Her** 🐢 | Ocean Ten HQ
