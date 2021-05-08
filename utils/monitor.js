const { EventEmitter } = require('events');
const { setInterval, clearInterval } = require('timers');
const { fetchSpotLatest } = require('../utils/binance');
const { hFetchSpotPrice } = require('../utils/huobi');
const { getSymbol } = require('../utils/coin');
const HUOBI_LIST = require('../constants/huobiList');

const checkTick = 200;

const priceEvents = new EventEmitter();

const monitors = {};
const monitorDeps = {};

const addMontior = (coin, handler) => {
  const { coinName, symbol } = getSymbol(coin);
  if (!monitorDeps[symbol]) {
    monitorDeps[symbol] = 1;
  } else {
    monitorDeps[symbol] += 1;
  }
  if (monitors[symbol]) {
    if (handler && typeof handler === 'function') {
      priceEvents.on(symbol, handler);
    }
    return;
  }
  // set up interval
  monitors[symbol] = setInterval(async () => {
    let originalPriceData, coinPrice;
    try {
      if (HUOBI_LIST.includes(coinName)) {
        originalPriceData = (await hFetchSpotPrice(symbol)).lastPrice;
        coinPrice = parseFloat(originalPriceData, 10);
      } else {
        originalPriceData = (await fetchSpotLatest(symbol.toUpperCase())).price;
        coinPrice = parseFloat(originalPriceData, 10);
      }
    } catch (err) {
      console.error(`Failed to fetch ${symbol} price in monitor.`, err);
      return;
    }
    if (originalPriceData && coinPrice) {
      priceEvents.emit(symbol, { original: originalPriceData, price: coinPrice });
    }
  }, checkTick);
  // set up handler if exists
  if (handler && typeof handler === 'function') {
    priceEvents.on(symbol, handler);
  }
};

const removeMonitor = (coin, handler) => {
  const { symbol } = getSymbol(coin);
  if (!monitors[symbol]) {
    return;
  }
  monitorDeps[symbol] -= 1;
  if (monitorDeps[symbol] <= 0) {
    clearInterval(monitors[symbol]);
    monitors[symbol] = null;
  }
  if (handler && typeof handler === 'function') {
    priceEvents.off(symbol, handler);
  }
};

module.exports = {
  addMontior,
  removeMonitor,
  priceEvents,
};
