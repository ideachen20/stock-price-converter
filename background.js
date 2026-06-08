// Background Service Worker - Stock Price Converter v3.0
// 支援動態 Ticker，取得即時股價和匯率資料，存入 chrome.storage

const CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘
const DEFAULT_TICKER = 'NVDA';

// 取得目前 Ticker
async function getCurrentTicker() {
  const result = await chrome.storage.local.get(['ticker']);
  return result.ticker || DEFAULT_TICKER;
}

// 取得股票即時價格
async function fetchStockPrice(symbol) {
  const urls = [
    `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (price && price > 0) {
        console.log(`[StockConverter] ${symbol} price: $${price}`);
        return price;
      }
    } catch(e) {
      console.warn(`[StockConverter] ${symbol} price fetch error:`, e.message);
    }
  }
  return null;
}

// 取得匯率
async function fetchExchangeRates() {
  const urls = [
    'https://api.frankfurter.dev/v1/latest?base=USD',
    'https://open.er-api.com/v6/latest/USD',
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const rates = data.rates;
      if (rates && Object.keys(rates).length > 5) {
        rates['USD'] = 1;
        console.log(`[StockConverter] Exchange rates loaded: ${Object.keys(rates).length} currencies`);
        return rates;
      }
    } catch(e) {
      console.warn('[StockConverter] Rates fetch error:', e.message);
    }
  }
  return null;
}

// 更新資料並存入 storage
async function updateData(force = false) {
  const ticker = await getCurrentTicker();

  if (!force) {
    const stored = await chrome.storage.local.get(['stockPrice', 'exchangeRates', 'lastUpdate', 'ticker']);
    if (stored.stockPrice && stored.exchangeRates && stored.ticker === ticker &&
        (Date.now() - stored.lastUpdate < CACHE_DURATION)) {
      return {
        stockPrice: stored.stockPrice,
        exchangeRates: stored.exchangeRates,
        lastUpdate: stored.lastUpdate,
        ticker: ticker
      };
    }
  }

  const [price, rates] = await Promise.all([fetchStockPrice(ticker), fetchExchangeRates()]);
  
  const result = {
    stockPrice: price,
    exchangeRates: rates,
    lastUpdate: Date.now(),
    ticker: ticker
  };

  // 如果部分失敗，嘗試保留舊資料
  if (!price || !rates) {
    const stored = await chrome.storage.local.get(['stockPrice', 'exchangeRates']);
    if (!price && stored.stockPrice) result.stockPrice = stored.stockPrice;
    if (!rates && stored.exchangeRates) result.exchangeRates = stored.exchangeRates;
  }

  // 存入 storage（content script 會從這裡讀取）
  if (result.stockPrice && result.exchangeRates) {
    await chrome.storage.local.set(result);
    console.log(`[StockConverter] Data saved: ${ticker} = $${result.stockPrice}`);
  }

  return result;
}

// 訊息處理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STOCK_DATA' || message.type === 'GET_NVIDIA_DATA') {
    updateData().then(data => {
      sendResponse({
        success: !!(data.stockPrice && data.exchangeRates),
        stockPrice: data.stockPrice,
        nvidiaPrice: data.stockPrice, // backward compat
        exchangeRates: data.exchangeRates,
        lastUpdate: data.lastUpdate,
        ticker: data.ticker
      });
    }).catch(e => {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  if (message.type === 'FORCE_REFRESH') {
    updateData(true).then(data => {
      sendResponse({
        success: !!(data.stockPrice && data.exchangeRates),
        stockPrice: data.stockPrice,
        exchangeRates: data.exchangeRates,
        lastUpdate: data.lastUpdate,
        ticker: data.ticker
      });
    }).catch(e => {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  if (message.type === 'CHANGE_TICKER') {
    const newTicker = message.ticker;
    chrome.storage.local.set({ ticker: newTicker }, () => {
      updateData(true).then(data => {
        sendResponse({ success: true, stockPrice: data.stockPrice, ticker: newTicker });
      }).catch(e => {
        sendResponse({ success: false, error: e.message });
      });
    });
    return true;
  }
});

// 安裝/啟動時立即取得資料
chrome.runtime.onInstalled.addListener(() => {
  console.log('[StockConverter] Extension installed, fetching initial data...');
  chrome.storage.local.get(['ticker'], (result) => {
    if (!result.ticker) {
      chrome.storage.local.set({ ticker: DEFAULT_TICKER });
    }
    updateData(true);
  });
});

// Service Worker 啟動時也取得資料
updateData();

// 定時更新
chrome.alarms.create('updateData', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateData') {
    updateData(true);
  }
});
