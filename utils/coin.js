const { fetchSpotLatest, fetchSpotPrice } = require('../utils/binance');
const { hFetchSpotPrice } = require('../utils/huobi');
const HUOBI_LIST = require('../constants/huobiList');

const availableCoins = {};

const getSymbol = (coin) => {
  let coinName = coin.toLowerCase();
  let symbol = coin;
  if (symbol.includes('/')) {
    coinName = symbol.split('/')[0];
    symbol = symbol.replace('/', '');
  } else {
    symbol = `${coin}usdt`;
  }
  return { coinName, symbol };
};

const checkCoin = async (coin) => {
  if (availableCoins[coin]) {
    return true;
  }
  const { coinName, symbol } = getSymbol(coin);
  try {
    let coinPrice;
    if (HUOBI_LIST.includes(coinName)) {
      coinPrice = await hFetchSpotPrice(symbol);
    } else {
      coinPrice = await fetchSpotLatest(symbol.toUpperCase());
    }
    if (!coinPrice) {
      return false;
    }
  } catch (err) {
    console.error('Failed to check coin.', err);
    return false;
  }
  availableCoins[coin] = true;
  return true;
};

const getLatestPrice = async (coin) => {
  let price;
  const { symbol } = getSymbol(coin);
  if (HUOBI_LIST.includes(symbol)) {
    price = await hFetchSpotPrice(symbol);
  } else {
    price = await fetchSpotPrice(symbol.toUpperCase());
  }
  if (!price) {
    return null;
  }
  return parseFloat(price.lastPrice, 10);
};

const getLatestPriceBySymbol = async (symbol) => {
  let price;
  if (HUOBI_LIST.includes(symbol)) {
    price = await hFetchSpotPrice(symbol);
  } else {
    price = await fetchSpotPrice(symbol.toUpperCase());
  }
  if (!price) {
    return null;
  }
  return parseFloat(price.lastPrice, 10);
};

module.exports = {
  getSymbol,
  checkCoin,
  getLatestPrice,
  getLatestPriceBySymbol,
};
