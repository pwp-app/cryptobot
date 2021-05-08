const { fetchSpotLatest } = require('../utils/binance');
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
  return true;
};

module.exports = {
  getSymbol,
  checkCoin,
};
