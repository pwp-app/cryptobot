const { fetchSpotPrice, fetchFuturesPrice } = require('../utils/binance');
const { buildMessage } = require('../utils/message');

const coinTester = /^[A-Za-z]+\?|\$$/;

module.exports = (ctx) => {
  ctx.middleware(async (session, next) => {
    const { content } = session;
    const formattedContent = content.trim();
    if (!coinTester.test(formattedContent)) {
      return next();
    }
    const coin = formattedContent.substr(0, formattedContent.length - 1);
    if (formattedContent.endsWith('?')) {
      let price;
      try {
        price = await fetchSpotPrice(`${coin}usdt`.toUpperCase());
      } catch {
        console.error('Failed to fetch price.');
      }
      if (price) {
        return await session.send(buildMessage({ name: coin, type: 'spot' }, price));
      }
    } else if (formattedContent.endsWith('$')) {
      let price;
      try {
        price = await fetchFuturesPrice(`${coin}usdt`.toUpperCase());
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
