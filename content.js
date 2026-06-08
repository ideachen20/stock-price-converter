// Content Script - Stock Price Converter v3.0
// 支援動態 Ticker、多貨幣符號、貨幣→語言自動對應

(function() {
  'use strict';

  // ========== Extension Context 有效性檢查 ==========
  function isContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch(e) {
      return false;
    }
  }

  const CONFIG = {
    SCAN_INTERVAL: 3000,
    INITIAL_DELAY: 2500,
    TAG_CLASS: 'stock-converter-tag',
    PROCESSED_ATTR: 'data-stock-converted',
  };

  // ========== 貨幣→語言對應（頁面標籤自動適配語言）==========
  const CURRENCY_LANG_MAP = {
    KRW: { unit: '주', prefix: '≈ ', suffix: '' },
    TWD: { unit: '股', prefix: '≈ ', suffix: '' },
    CNY: { unit: '股', prefix: '≈ ', suffix: '' },
    JPY: { unit: '株', prefix: '≈ ', suffix: '' },
    HKD: { unit: '股', prefix: '≈ ', suffix: '' },
    // 其他語言預設英文
    DEFAULT: { unit: 'shares', prefix: '≈ ', suffix: '' },
  };

  function getUnitForCurrency(currency) {
    return CURRENCY_LANG_MAP[currency] || CURRENCY_LANG_MAP.DEFAULT;
  }

  // ========== 網站貨幣偵測 ==========
  const SITE_CURRENCY_MAP = {
    // 韓國
    'shopping.naver.com': 'KRW', 'smartstore.naver.com': 'KRW',
    'search.shopping.naver.com': 'KRW', 'naver.com': 'KRW',
    'coupang.com': 'KRW', 'gmarket.co.kr': 'KRW', '11st.co.kr': 'KRW',
    'musinsa.com': 'KRW', 'ssg.com': 'KRW', 'lotteon.com': 'KRW',
    'tmon.co.kr': 'KRW', 'wemakeprice.com': 'KRW', 'kurly.com': 'KRW',
    'oliveyoung.co.kr': 'KRW', 'auction.co.kr': 'KRW', 'interpark.com': 'KRW',
    'danawa.com': 'KRW', 'yes24.com': 'KRW', 'aladin.co.kr': 'KRW',
    // 台灣
    'shopee.tw': 'TWD', 'momo.com': 'TWD', 'momoshop.com.tw': 'TWD',
    'pchome.com.tw': 'TWD', 'books.com.tw': 'TWD', 'ruten.com.tw': 'TWD',
    // 日本
    'amazon.co.jp': 'JPY', 'rakuten.co.jp': 'JPY', 'mercari.com': 'JPY',
    'yahoo.co.jp': 'JPY', 'zozo.jp': 'JPY',
    // 中國
    'taobao.com': 'CNY', 'tmall.com': 'CNY', 'jd.com': 'CNY', 'pinduoduo.com': 'CNY',
    // 美國
    'amazon.com': 'USD', 'ebay.com': 'USD', 'walmart.com': 'USD',
    'bestbuy.com': 'USD', 'target.com': 'USD', 'newegg.com': 'USD',
    // 歐洲
    'amazon.co.uk': 'GBP',
    'amazon.de': 'EUR', 'amazon.fr': 'EUR', 'amazon.it': 'EUR', 'amazon.es': 'EUR',
    // 其他
    'amazon.com.au': 'AUD', 'amazon.ca': 'CAD',
    'amazon.in': 'INR', 'flipkart.com': 'INR',
    'shopee.sg': 'SGD', 'lazada.sg': 'SGD',
    'shopee.com.my': 'MYR', 'lazada.com.my': 'MYR',
    'shopee.co.th': 'THB', 'lazada.co.th': 'THB',
    'shopee.vn': 'VND', 'lazada.vn': 'VND',
    'shopee.ph': 'PHP', 'lazada.com.ph': 'PHP',
    'shopee.co.id': 'IDR', 'lazada.co.id': 'IDR', 'tokopedia.com': 'IDR',
    'hktvmall.com': 'HKD',
  };

  function detectSiteCurrency() {
    const hostname = window.location.hostname;
    for (const [domain, currency] of Object.entries(SITE_CURRENCY_MAP)) {
      if (hostname.includes(domain)) return currency;
    }
    return null;
  }

  // ========== 狀態 ==========
  let stockPrice = null;
  let exchangeRates = null;
  let siteCurrency = null;
  let currentTicker = 'NVDA';
  let isEnabled = true;

  // ========== 直接從 storage 讀取資料 ==========
  async function loadDataFromStorage() {
    if (!isContextValid()) return false;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['stockPrice', 'nvidiaPrice', 'exchangeRates', 'lastUpdate', 'enabled', 'ticker'], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('StockConverter: storage read error', chrome.runtime.lastError);
            resolve(false);
            return;
          }
          if (result.enabled === false) {
            isEnabled = false;
            resolve(false);
            return;
          }
          isEnabled = true;
          currentTicker = result.ticker || 'NVDA';
          const price = result.stockPrice || result.nvidiaPrice;
          if (price && result.exchangeRates) {
            stockPrice = price;
            exchangeRates = result.exchangeRates;
            resolve(true);
          } else {
            resolve(false);
          }
        });
      } catch(e) {
        resolve(false);
      }
    });
  }

  function triggerBackgroundFetch() {
    if (!isContextValid()) return;
    try {
      chrome.runtime.sendMessage({ type: 'GET_STOCK_DATA' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.success) {
          stockPrice = response.stockPrice || response.nvidiaPrice;
          exchangeRates = response.exchangeRates;
          currentTicker = response.ticker || 'NVDA';
          scanPage();
        }
      });
    } catch(e) {}
  }

  // ========== 價格解析（多貨幣） ==========
  function hasPriceIndicator(text) {
    if (/[$₩€£¥₹฿₫₱￥]/.test(text)) return true;
    if (/\d.*원/.test(text)) return true;
    if (/RM\s*[\d,]/.test(text)) return true;
    if (/Rp\s*[\d,.]/.test(text)) return true;
    if (/(?:NT|HK|S|A|C)\$\s*[\d,]/.test(text)) return true;
    return false;
  }

  function extractPricesFromText(text) {
    const results = [];

    // ===== 韓圜模式 =====
    const krwPatterns = [/(\d[\d,]*)\s*원/g, /₩\s*(\d[\d,]*)/g];
    for (const pattern of krwPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        const amount = parseNumber(m[1]);
        if (amount && amount >= 100) results.push({ amount, currency: 'KRW' });
      }
    }

    // ===== 日圓模式 =====
    const jpyPatterns = [/(\d[\d,]*)\s*円/g];
    for (const pattern of jpyPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        const amount = parseNumber(m[1]);
        if (amount && amount >= 100) results.push({ amount, currency: 'JPY' });
      }
    }
    if (siteCurrency === 'JPY' || siteCurrency === 'CNY') {
      const yenPatterns = [/[¥￥]\s*(\d[\d,]*(?:\.\d{1,2})?)/g];
      for (const pattern of yenPatterns) {
        let m;
        while ((m = pattern.exec(text)) !== null) {
          const amount = parseNumber(m[1]);
          if (amount && amount > 0) results.push({ amount, currency: siteCurrency });
        }
      }
    }

    // ===== 歐元模式 =====
    if (siteCurrency === 'EUR' || text.includes('€')) {
      const eurPatterns = [/€\s*(\d[\d.,]*)/g, /(\d[\d.,]*)\s*€/g];
      for (const pattern of eurPatterns) {
        let m;
        while ((m = pattern.exec(text)) !== null) {
          let numStr = m[1];
          if (/\d+\.\d{3}/.test(numStr) && numStr.includes(',')) {
            numStr = numStr.replace(/\./g, '').replace(',', '.');
          } else {
            numStr = numStr.replace(/,/g, '');
          }
          const amount = parseFloat(numStr);
          if (amount && amount > 0) results.push({ amount, currency: 'EUR' });
        }
      }
    }

    // ===== 英鎊模式 =====
    const gbpPatterns = [/£\s*(\d[\d,]*(?:\.\d{1,2})?)/g];
    for (const pattern of gbpPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        const amount = parseNumber(m[1]);
        if (amount && amount > 0) results.push({ amount, currency: 'GBP' });
      }
    }

    // ===== 印度盧比 =====
    const inrPatterns = [/₹\s*(\d[\d,]*(?:\.\d{1,2})?)/g];
    for (const pattern of inrPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        const amount = parseNumber(m[1]);
        if (amount && amount > 0) results.push({ amount, currency: 'INR' });
      }
    }

    // ===== 泰銖 =====
    const thbPatterns = [/฿\s*(\d[\d,]*(?:\.\d{1,2})?)/g];
    for (const pattern of thbPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        const amount = parseNumber(m[1]);
        if (amount && amount > 0) results.push({ amount, currency: 'THB' });
      }
    }

    // ===== 越南盾 =====
    const vndPatterns = [/(\d[\d.,]*)\s*₫/g, /₫\s*(\d[\d.,]*)/g];
    for (const pattern of vndPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        const amount = parseNumber(m[1]);
        if (amount && amount > 0) results.push({ amount, currency: 'VND' });
      }
    }

    // ===== 馬來西亞令吉 =====
    const myrPatterns = [/RM\s*(\d[\d,]*(?:\.\d{1,2})?)/g];
    for (const pattern of myrPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        const amount = parseNumber(m[1]);
        if (amount && amount > 0) results.push({ amount, currency: 'MYR' });
      }
    }

    // ===== 印尼盾 =====
    const idrPatterns = [/Rp\s*(\d[\d.,]*)/g];
    for (const pattern of idrPatterns) {
      let m;
      while ((m = pattern.exec(text)) !== null) {
        let numStr = m[1].replace(/\./g, '').replace(/,/g, '');
        const amount = parseFloat(numStr);
        if (amount && amount > 0) results.push({ amount, currency: 'IDR' });
      }
    }

    // ===== $ 符號模式 =====
    const specialDollarPatterns = [
      { regex: /NT\$\s*(\d[\d,]*(?:\.\d{1,2})?)/g, currency: 'TWD' },
      { regex: /HK\$\s*(\d[\d,]*(?:\.\d{1,2})?)/g, currency: 'HKD' },
      { regex: /S\$\s*(\d[\d,]*(?:\.\d{1,2})?)/g, currency: 'SGD' },
      { regex: /A\$\s*(\d[\d,]*(?:\.\d{1,2})?)/g, currency: 'AUD' },
      { regex: /C\$\s*(\d[\d,]*(?:\.\d{1,2})?)/g, currency: 'CAD' },
    ];
    for (const { regex, currency } of specialDollarPatterns) {
      let m;
      while ((m = regex.exec(text)) !== null) {
        const amount = parseNumber(m[1]);
        if (amount && amount > 0) results.push({ amount, currency });
      }
    }

    // 通用 $ 符號
    const dollarPattern = /(?<![A-Z])\$\s*(\d[\d,]*(?:\.\d{1,2})?)/g;
    let m;
    while ((m = dollarPattern.exec(text)) !== null) {
      const amount = parseNumber(m[1]);
      if (amount && amount > 0) {
        const currency = siteCurrency || 'USD';
        results.push({ amount, currency });
      }
    }

    // ===== 韓國網站純數字模式 =====
    if (siteCurrency === 'KRW' && results.length === 0) {
      const pureNumberPattern = /(\d{1,3}(?:,\d{3})+)/g;
      let nm;
      while ((nm = pureNumberPattern.exec(text)) !== null) {
        const amount = parseNumber(nm[1]);
        if (amount && amount >= 500 && amount <= 100000000) {
          results.push({ amount, currency: 'KRW' });
        }
      }
    }

    return results;
  }

  function parseNumber(str) {
    let cleaned = str.replace(/\s/g, '').replace(/,/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
  }

  // ========== 轉換計算 ==========
  function convertToShares(amount, currency) {
    if (!stockPrice || !exchangeRates || !currency) return null;
    
    let usdAmount;
    if (currency === 'USD') {
      usdAmount = amount;
    } else {
      const rate = exchangeRates[currency];
      if (!rate) return null;
      usdAmount = amount / rate;
    }
    
    if (usdAmount < 0.5) return null;
    return usdAmount / stockPrice;
  }

  function formatShares(shares) {
    if (shares >= 100) return shares.toFixed(0);
    if (shares >= 10) return shares.toFixed(1);
    if (shares >= 1) return shares.toFixed(2);
    if (shares >= 0.01) return shares.toFixed(3);
    return shares.toFixed(4);
  }

  // ========== DOM 操作 ==========
  function createTag(shares, currency, amount) {
    const tag = document.createElement('span');
    tag.className = CONFIG.TAG_CLASS;
    
    // 根據貨幣自動選擇語言單位
    const langInfo = getUnitForCurrency(currency);
    const ticker = currentTicker.toUpperCase();
    tag.innerHTML = `<span class="stock-dot-indicator"></span>${langInfo.prefix}${formatShares(shares)} ${langInfo.unit} ${ticker}`;
    
    const usdValue = (shares * stockPrice).toFixed(2);
    const rate = exchangeRates[currency] || 1;
    tag.title = `${currency} ${amount.toLocaleString()} ≈ US$${usdValue} ≈ ${formatShares(shares)} shares ${ticker}\n${ticker}: US$${stockPrice.toFixed(2)} | 1 USD = ${rate} ${currency}`;
    return tag;
  }

  // ========== 核心掃描 ==========
  function scanPage() {
    if (!isEnabled || !stockPrice || !exchangeRates) return;

    const body = document.body;
    if (!body) return;

    let convertedCount = 0;

    const walker = document.createTreeWalker(
      body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || 
              tag === 'TEXTAREA' || tag === 'INPUT') return NodeFilter.FILTER_REJECT;
          if (parent.closest('.' + CONFIG.TAG_CLASS)) return NodeFilter.FILTER_REJECT;
          if (parent.hasAttribute(CONFIG.PROCESSED_ATTR)) return NodeFilter.FILTER_REJECT;
          const text = node.textContent;
          if (!text || text.length < 2 || text.length > 80) return NodeFilter.FILTER_REJECT;
          if (hasPriceIndicator(text)) return NodeFilter.FILTER_ACCEPT;
          if (siteCurrency === 'KRW' && /\d{1,3}(?:,\d{3})+/.test(text)) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    let n;
    while (n = walker.nextNode()) nodes.push(n);

    for (const textNode of nodes) {
      const parent = textNode.parentElement;
      if (!parent) continue;
      if (parent.hasAttribute(CONFIG.PROCESSED_ATTR)) continue;
      if (parent.querySelector('.' + CONFIG.TAG_CLASS)) continue;

      const text = textNode.textContent.trim();
      const prices = extractPricesFromText(text);
      if (prices.length === 0) continue;

      const best = prices.reduce((a, b) => a.amount > b.amount ? a : b);
      if (best.amount < 1) continue;

      const shares = convertToShares(best.amount, best.currency);
      if (shares === null || shares < 0.001) continue;

      parent.setAttribute(CONFIG.PROCESSED_ATTR, 'true');

      const tag = createTag(shares, best.currency, best.amount);
      try {
        if (parent.nextSibling) {
          parent.parentNode.insertBefore(tag, parent.nextSibling);
        } else {
          parent.parentNode.appendChild(tag);
        }
        convertedCount++;
      } catch(e) {
        try { parent.appendChild(tag); convertedCount++; } catch(e2) {}
      }
    }

    if (convertedCount > 0) {
      console.log(`%cStock Converter%c ✓ Converted ${convertedCount} prices (${currentTicker}=$${stockPrice}, Currency=${siteCurrency || 'auto'})`,
        'background:#76b900;color:white;padding:2px 6px;border-radius:3px;font-weight:bold;',
        'color:#76b900;');
    }
  }

  // ========== 清除標籤 ==========
  function clearAllTags() {
    document.querySelectorAll('.' + CONFIG.TAG_CLASS).forEach(el => el.remove());
    document.querySelectorAll('[' + CONFIG.PROCESSED_ATTR + ']').forEach(el => {
      el.removeAttribute(CONFIG.PROCESSED_ATTR);
    });
  }

  // ========== 初始化 ==========
  async function init() {
    siteCurrency = detectSiteCurrency();

    // 儲存偵測到的貨幣到 storage（供 popup 顯示）
    if (siteCurrency && isContextValid()) {
      try { chrome.storage.local.set({ detectedCurrency: siteCurrency }); } catch(e) {}
    }

    let hasData = await loadDataFromStorage();
    
    if (!hasData) {
      triggerBackgroundFetch();
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        hasData = await loadDataFromStorage();
        if (hasData) break;
      }
    }

    if (!isEnabled) return;

    if (!hasData) {
      console.log('%cStock Converter%c ✗ No data available. Open the extension popup to initialize.',
        'background:#ff4444;color:white;padding:2px 6px;border-radius:3px;font-weight:bold;',
        'color:#ff4444;');
      return;
    }

    console.log(`%cStock Converter v3.0%c Ready | ${currentTicker}: $${stockPrice} | Site: ${siteCurrency || 'auto'} | Rate: ${siteCurrency ? exchangeRates[siteCurrency] : 'N/A'}`,
      'background:#76b900;color:white;padding:2px 6px;border-radius:3px;font-weight:bold;',
      'color:#76b900;');

    // 初始掃描
    setTimeout(scanPage, CONFIG.INITIAL_DELAY);

    // 定期掃描
    setInterval(() => {
      if (!isContextValid()) return;
      loadDataFromStorage().then(() => scanPage());
    }, CONFIG.SCAN_INTERVAL);

    // 監聽 URL 變化（SPA 路由切換）
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        clearAllTags();
        setTimeout(scanPage, CONFIG.INITIAL_DELAY);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    // 監聽 storage 變化（Ticker 切換時即時更新）
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.ticker || changes.stockPrice) {
        clearAllTags();
        loadDataFromStorage().then(() => {
          setTimeout(scanPage, 1000);
        });
      }
    });
  }

  // ========== 訊息監聽 ==========
  if (isContextValid()) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TOGGLE_CONVERSION' || message.type === 'TOGGLE_EXTENSION') {
        isEnabled = message.enabled;
        chrome.storage.local.set({ enabled: message.enabled });
        if (!isEnabled) {
          clearAllTags();
        } else {
          loadDataFromStorage().then(() => scanPage());
        }
        sendResponse({ success: true });
      }
      if (message.type === 'RESCAN_PAGE' || message.type === 'REFRESH_PRICES') {
        clearAllTags();
        loadDataFromStorage().then(() => {
          scanPage();
          sendResponse({ success: true });
        });
        return true;
      }
    });
  }

  // ========== 啟動 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }
})();
