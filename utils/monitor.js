const { EventEmitter } = require('events');
const { setInterval, clearInterval } = require('timers');
const { getSymbol, getLatestPriceBySymbol } = require('../utils/coin');

const checkTick = 166;

const priceEvents = new EventEmitter();

const monitors = {};
const monitorDeps = {};

const addMontior = (coin, handler) => {
  const { symbol } = getSymbol(coin);
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
    const price = await getLatestPriceBySymbol(symbol);
    if (price) {
      priceEvents.emit(symbol, { price });
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
