const { fetchSpotPrice, fetchFuturesPrice } = require('../utils/binance');
const { hFetchSpotPrice } = require('../utils/huobi');
const { buildMessage } = require('../utils/message');
const { getSymbol } = require('../utils/coin');
const HUOBI_LIST = require('../constants/huobiList');

const coinTester = /^[A-Za-z]+(\/?[A-Za-z]+)?\?|\$|？$/;

module.exports.name = 'Crypto Currency Price Checker';
module.exports = (ctx) => {
  ctx.middleware(async (session, next) => {
    const { content } = session;
    const formattedContent = content.trim();
    if (!coinTester.test(formattedContent)) {
      return next();
    }
    const coin = formattedContent.substr(0, formattedContent.length - 1);
    const { coinName, symbol } = getSymbol(coin);
    if (formattedContent.endsWith('?') || formattedContent.endsWith('？')) {
      let price;
      try {
        if (HUOBI_LIST.includes(coinName)) {
          price = await hFetchSpotPrice(symbol);
        } else {
          price = await fetchSpotPrice(symbol.toUpperCase());
        }
      } catch (err) {
        console.error('Failed to fetch price.', err);
        return next();
      }
      if (price) {
        return await session.send(buildMessage({ name: coin, type: 'spot' }, price));
      }
    } else if (formattedContent.endsWith('$')) {
      let price;
      try {
        price = await fetchFuturesPrice(symbol.toUpperCase());
      } catch (err) {
        console.error('Failed to fetch price.', err);
      }
      if (price) {
        return await session.send(buildMessage({ name: coin, type: 'futures' }, price));
      }
    }
    return next();
  });
};
