# Stock Price Converter - Chrome Extension

> 將購物網站上的商品價格轉換為「可以買多少股」的顯示，幫助您抑制購物慾，將消費衝動轉化為投資動力。

## 功能特色

- **自訂股票代碼**：支援任何美股 Ticker（NVDA、AAPL、TSLA、GOOG 等），在 Popup 中輸入即可切換
- **即時股價**：透過 Yahoo Finance API 取得最新股價
- **多貨幣自動偵測**：支援 40+ 種貨幣，根據網站域名自動判斷
- **貨幣→語言自動對應**：韓國網站顯示「주」、台灣顯示「股」、日本顯示「株」、其他顯示「shares」
- **多語言 UI**：Popup 介面支援繁中、簡中、英文、韓文、日文
- **SPA 相容**：支援 Shopee、Naver Shopping 等動態渲染網站
- **勵志金句**：隨機顯示投資名言，幫助三思而後行

## 支援電商平台

| 地區 | 貨幣 | 平台 |
|------|------|------|
| 韓國 | KRW (₩/원) | Naver Shopping, Coupang, Gmarket, 11번가, Musinsa, SSG, Kurly, Olive Young 等 |
| 台灣 | TWD (NT$) | 蝦皮, momo, PChome, 博客來 |
| 日本 | JPY (¥/円) | Amazon JP, 楽天, メルカリ |
| 中國 | CNY (¥/￥) | 淘寶, 天貓, 京東 |
| 新加坡 | SGD (S$) | Shopee SG, Lazada SG |
| 美國 | USD ($) | Amazon, eBay, Walmart, Best Buy |
| 歐洲 | EUR/GBP | Amazon UK/DE/FR |
| 東南亞 | MYR/THB/VND/PHP/IDR | Shopee, Lazada, Tokopedia |
| 其他 | AUD/CAD/HKD/INR | Amazon AU/CA/IN, HKTVmall |

## 安裝方式

1. 解壓縮 `stock-price-converter.zip`
2. 開啟 Chrome → `chrome://extensions/`
3. 開啟右上角「開發人員模式」
4. 點擊「載入未封裝項目」
5. 選擇解壓後的資料夾
6. 完成！

## 使用方式

1. 點擊 Extension 圖示開啟 Popup
2. 在 **Ticker** 欄位輸入想追蹤的股票代碼（預設 NVDA）
3. 點擊「Apply」套用
4. 瀏覽電商網站，每個價格旁邊會自動顯示等值股數

## 顯示效果

根據偵測到的貨幣，標籤會自動使用對應語言：

| 地區 | 貨幣 | 標籤範例 |
|------|------|----------|
| 韓國 | KRW | ≈ 0.06 주 NVDA |
| 台灣 | TWD | ≈ 2.35 股 NVDA |
| 日本 | JPY | ≈ 0.23 株 NVDA |
| 其他 | USD/SGD/EUR 等 | ≈ 5.52 shares NVDA |

## 技術架構

```
stock-price-converter/
├── manifest.json              # Extension 設定檔 (Manifest V3)
├── _locales/                  # 多語言資源
│   ├── en/messages.json
│   ├── zh_TW/messages.json
│   ├── zh_CN/messages.json
│   ├── ko/messages.json
│   └── ja/messages.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background.js          # Service Worker (API 取得與快取)
│   ├── content.js             # Content Script (價格偵測與轉換)
│   ├── content.css            # 標籤樣式
│   ├── popup.html             # Popup 介面
│   └── popup.js               # Popup 邏輯
└── README.md
```

## 使用的 API

| API | 用途 | 費用 |
|-----|------|------|
| Yahoo Finance Chart API | 取得任意美股即時股價 | 免費 |
| Frankfurter API | 匯率轉換 (200+ 貨幣) | 免費，無需 API Key |
| Open ER API | 匯率備用方案 | 免費 |

## 注意事項

- 股價資料可能有 15 分鐘延遲（Yahoo Finance 免費版限制）
- 匯率為每日更新（Frankfurter 使用歐洲央行資料）
- 此工具僅供參考，不構成投資建議

## 版本紀錄

- **v3.0.0** — 通用版：支援自訂 Ticker、貨幣語言自動對應
- **v2.3.0** — 修復 Extension context invalidated 錯誤
- **v2.1.0** — 改用 chrome.storage 通訊機制
- **v2.0.0** — 加入韓圜、多貨幣符號支援
- **v1.0.0** — 初版，NVIDIA 專用

## 授權

MIT License
