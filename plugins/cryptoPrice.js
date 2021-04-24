const { fetchSpotPrice, fetchFuturesPrice, fetchSpotLatest } = require('../utils/binance');
const { hFetchSpotPrice } = require('../utils/huobi');
const { buildMessage } = require('../utils/message');

const HUOBI_LIST = [
  'ht',
  'husd',
];


const coinTester = /^[A-Za-z]+(\/?[A-Za-z]+)?\?|\$|？$/;

module.exports = (ctx) => {
  ctx.middleware(async (session, next) => {
    const { content } = session;
    const formattedContent = content.trim();
    if (!coinTester.test(formattedContent)) {
      return next();
    }
    const coin = formattedContent.substr(0, formattedContent.length - 1);
    let coinName = coin.toLowerCase();
    let symbol = coin;
    if (symbol.includes('/')) {
      coinName = symbol.split('/')[0];
      symbol = symbol.replace('/', '');
    } else {
      symbol = `${coin}usdt`;
    }
    if (formattedContent.endsWith('?') || formattedContent.endsWith('？')) {
      let price;
      try {
        if (HUOBI_LIST.includes(coinName)) {
          price = await hFetchSpotPrice(symbol);
        } else {
          price = await fetchSpotPrice(symbol.toUpperCase());
        }
      } catch {
        console.error('Failed to fetch price.');
        return next();
      }
      if (price) {
        return await session.send(buildMessage({ name: coin, type: 'spot' }, price));
      }
    } else if (formattedContent.endsWith('$')) {
      let price;
      try {
        price = await fetchFuturesPrice(symbol.toUpperCase());
      } catch {
        console.error('Failed to fetch price.');
      }
      if (price) {
        return await session.send(buildMessage({ name: coin, type: 'futures' }, price));
      }
    }
    return next();
  });
};
