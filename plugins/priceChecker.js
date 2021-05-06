const {
  fetchSpotPrice,
  fetchFuturesPrice,
  fetchLongShortPosition,
  fetchTopLongShortAccount,
  fetchGlobalLongShortAccount,
  fetchDepth,
} = require('../utils/binance');
const { hFetchSpotPrice } = require('../utils/huobi');
const { buildMessage, formatNumber } = require('../utils/message');
const { getSymbol } = require('../utils/coin');
const HUOBI_LIST = require('../constants/huobiList');

const coinTester = /^[A-Za-z]+(\/?[A-Za-z]+)?\?|\$|？|#|\*$/;

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
    } else if (formattedContent.endsWith('#')) {
      if (HUOBI_LIST.includes(coinName)) {
        await session.send('不支持该币种 (Huobi only)');
        return;
      }
      // fetch data
      const fetch = async (fn, target, idx, ...args) => {
        const res = await fn(...args);
        if (res) {
          target.push({
            ...res,
            idx,
          });
        }
      };
      const period = ['15m', '1d'];
      const promises = [];
      const lsPosition = [];
      const lsAccount = [];
      const lsGA = [];
      period.forEach((v, idx) => {
        promises.push(fetch(fetchLongShortPosition, lsPosition, idx, symbol.toUpperCase(), v));
        promises.push(fetch(fetchTopLongShortAccount, lsAccount, idx, symbol.toUpperCase(), v));
        promises.push(fetch(fetchGlobalLongShortAccount, lsGA, idx, symbol.toUpperCase(), v));
      });
      try {
        await Promise.all(promises);
      } catch (err) {
        console.error('Failed to fetch long short data.', err);
      }
      if (lsPosition.length !== period.length || lsAccount.length !== period.length || lsGA.length !== period.length) {
        await session.send('数据获取失败');
        return;
      }
      // sort data
      const sorter = (a, b) => a.idx - b.idx;
      lsPosition.sort(sorter);
      lsAccount.sort(sorter);
      lsGA.sort(sorter);
      // build message
      let message = `${coinName.toUpperCase()} 合约持仓情况统计`;
      const getPercent = (s) => (parseFloat(s, 10) * 100).toFixed(2);
      period.forEach((p, idx) => {
        message += `\n[${p}]`;
        const lsPositionPercent = [getPercent(lsPosition[idx].longAccount), getPercent(lsPosition[idx].shortAccount)];
        message += `\n大户多空持仓比 ${lsPosition[idx].longShortRatio} ${lsPositionPercent[0]}% ${lsPositionPercent[1]}%`;
        const lsAccountPercent = [getPercent(lsAccount[idx].longAccount), getPercent(lsAccount[idx].shortAccount)];
        message += `\n大户多空人数比 ${lsAccount[idx].longShortRatio} ${lsAccountPercent[0]}% ${lsAccountPercent[1]}%`;
        const lsGAPercent = [getPercent(lsGA[idx].longAccount), getPercent(lsGA[idx].shortAccount)];
        message += `\n全局多空人数比 ${lsGA[idx].longShortRatio} ${lsGAPercent[0]}% ${lsGAPercent[1]}%`;
      });
      await session.send(message);
    } else if (formattedContent.endsWith('*')) {
      // query depth
      if (!HUOBI_LIST.includes(coinName)) {
        const depth = await fetchDepth(symbol.toUpperCase());
        console.log(depth);
        let { bids, asks } = depth;
        let message = `${coinName.toUpperCase()} 现货交易深度`;
        asks = asks.reverse();
        asks.forEach((item, idx) => {
          message += `\n卖${5 - idx} ${formatNumber(item[0])} ${formatNumber(item[1])}`;
        });
        bids.forEach((item, idx) => {
          message += `\n买${idx + 1} ${formatNumber(item[0])} ${formatNumber(item[1])}`;
        });
        await session.send(message);
      }
    }
    return next();
  });
};
