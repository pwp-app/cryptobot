const { fetchSpotLatest, fetchAllSpotLatest, fetchSpotPrice } = require('../utils/binance');
const { hFetchSpotPrice } = require('../utils/huobi');
const HUOBI_LIST = require('../constants/huobiList');
const LatestPrices = require('./latestPrice');

const availableCoins = {};
const binanceLatestPrices = new LatestPrices({
  fetchFn: fetchAllSpotLatest,
});

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

const getCoinNameByUSDTSymbol = (symbol) => {
  if (symbol.includes('/')) {
    return symbol.split('/')[0].toLowerCase();
  } else {
    return symbol.toLowerCase().replace('usdt', '');
  }
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
      const fetched = binanceLatestPrices.get(symbol);
      if (fetched) {
        availableCoins[coin] = true;
        return true;
      }
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
  try {
    if (HUOBI_LIST.includes(coin)) {
      price = await hFetchSpotPrice(symbol);
    } else {
      const fetched = binanceLatestPrices.get(symbol);
      if (fetched) {
        return fetched;
      }
      price = await fetchSpotPrice(symbol.toUpperCase());
    }
  } catch (err) {
    console.error('Failed to get latest price.', coin, err);
  }
  if (!price) {
    return null;
  }
  return parseFloat(price.lastPrice, 10);
};

const getLatestPriceBySymbol = async (symbol) => {
  let price;
  const coinName = getCoinNameByUSDTSymbol(symbol);
  try {
    if (HUOBI_LIST.includes(coinName)) {
      price = await hFetchSpotPrice(symbol);
    } else {
      const fetched = binanceLatestPrices.get(symbol);
      if (fetched) {
        return fetched;
      }
      price = await fetchSpotPrice(symbol.toUpperCase());
    }
  } catch (err) {
    console.error('Failed to get latest price by symbol.', symbol, err);
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
