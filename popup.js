// popup.js - Stock Price Converter v3.0

(function() {
  'use strict';

  function t(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  let currentTicker = 'NVDA';

  function initUI() {
    document.getElementById('popup-title').textContent = t('popupTitle');
    document.getElementById('popup-subtitle').textContent = t('popupSubtitle');
    document.getElementById('ticker-label').textContent = t('tickerLabel');
    document.getElementById('ticker-input').placeholder = t('tickerPlaceholder');
    document.getElementById('ticker-apply').textContent = t('tickerApply');
    document.getElementById('stock-price-label').textContent = t('stockPriceLabel');
    document.getElementById('detected-currency-label').textContent = t('detectedCurrency');
    document.getElementById('exchange-rate-label').textContent = t('exchangeRate');
    document.getElementById('toggle-label').textContent = t('toggleEnable');
    document.getElementById('btn-refresh').textContent = t('btnRefresh');
    document.getElementById('btn-rescan').textContent = t('btnRescan');

    // Random quote
    const quoteIndex = Math.floor(Math.random() * 10) + 1;
    document.getElementById('quote').textContent = t('quote' + quoteIndex);
  }

  function updateTickerDisplay() {
    const ticker = currentTicker.toUpperCase();
    document.getElementById('ticker-display').textContent = ticker;
    document.getElementById('ticker-input').value = ticker;
    document.getElementById('link-stock').textContent = t('viewStock') || `View ${ticker}`;
    document.getElementById('link-stock').href = `https://finance.yahoo.com/quote/${ticker}`;
  }

  function loadData() {
    chrome.storage.local.get(['stockPrice', 'nvidiaPrice', 'exchangeRates', 'lastUpdate', 'enabled', 'ticker', 'detectedCurrency'], (result) => {
      if (chrome.runtime.lastError) return;

      currentTicker = result.ticker || 'NVDA';
      updateTickerDisplay();

      const price = result.stockPrice || result.nvidiaPrice;
      if (price) {
        document.getElementById('price-value').textContent = price.toFixed(2);
      }

      if (result.lastUpdate) {
        const date = new Date(result.lastUpdate);
        const timeStr = date.toLocaleString();
        document.getElementById('update-time').textContent = t('lastUpdate', [timeStr]);
      }

      if (result.detectedCurrency && result.detectedCurrency !== 'USD') {
        document.getElementById('detected-currency').textContent = result.detectedCurrency;
        if (result.exchangeRates && result.exchangeRates[result.detectedCurrency]) {
          document.getElementById('exchange-rate').textContent = result.exchangeRates[result.detectedCurrency].toFixed(4);
        }
      } else {
        document.getElementById('detected-currency').textContent = result.detectedCurrency || 'AUTO';
        document.getElementById('exchange-rate').textContent = '--';
      }

      const toggle = document.getElementById('toggle-enabled');
      toggle.checked = result.enabled !== false;
    });
  }

  // Apply ticker
  document.getElementById('ticker-apply').addEventListener('click', () => {
    const input = document.getElementById('ticker-input').value.trim().toUpperCase();
    if (!input) return;

    currentTicker = input;
    document.getElementById('price-value').textContent = '--';
    document.getElementById('update-time').textContent = '';
    updateTickerDisplay();

    // Save ticker and trigger background fetch
    chrome.storage.local.set({ ticker: currentTicker }, () => {
      chrome.runtime.sendMessage({ type: 'CHANGE_TICKER', ticker: currentTicker }, (response) => {
        if (chrome.runtime.lastError) return;
        setTimeout(loadData, 2000);
      });
    });

    // Button feedback
    const btn = document.getElementById('ticker-apply');
    btn.textContent = '✅';
    setTimeout(() => { btn.textContent = t('tickerApply'); }, 1500);
  });

  // Enter key on ticker input
  document.getElementById('ticker-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('ticker-apply').click();
    }
  });

  // Toggle
  document.getElementById('toggle-enabled').addEventListener('change', (e) => {
    chrome.storage.local.set({ enabled: e.target.checked });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_CONVERSION', enabled: e.target.checked });
      }
    });
  });

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', () => {
    const btn = document.getElementById('btn-refresh');
    btn.textContent = t('btnRefreshing');
    btn.disabled = true;

    chrome.runtime.sendMessage({ type: 'FORCE_REFRESH' }, (response) => {
      if (chrome.runtime.lastError) {
        btn.textContent = t('btnRefreshFailed');
        setTimeout(() => { btn.textContent = t('btnRefresh'); btn.disabled = false; }, 2000);
        return;
      }
      btn.textContent = t('btnRefreshed');
      setTimeout(() => {
        btn.textContent = t('btnRefresh');
        btn.disabled = false;
        loadData();
      }, 1500);
    });
  });

  // Rescan
  document.getElementById('btn-rescan').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'RESCAN_PAGE' });
      }
    });
  });

  // Init
  initUI();
  loadData();
})();
