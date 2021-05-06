const HUOBI_LIST = require('../constants/huobiList');
const { fetchSpotPrice } = require('../utils/binance');
const { getSymbol } = require('../utils/coin');
const db = require('../utils/db');
const { hFetchSpotPrice } = require('../utils/huobi');

const stars = {};

const storeKey = 'coin_stars';

const initStars = async () => {
  try {
    const stored = await db.get(storeKey);
    if (stored) {
      stars = JSON.parse(stored);
    }
  } catch (err) {
    if (!err.notFound) {
      throw err;
    }
  }
};

const saveStars = async () => {
  await db.supdate(storeKey, JSON.stringify(stars));
};

module.exports = async (ctx) => {
  await initStars();
  ctx.app.command('star <coin>').action(async (_, coin) => {
    const { subtype, userId } = _.session;
    const buildMessage = (msg) => {
      let message = msg;
      if (subtype === 'group') {
        message =
          segment.at(userId) + message;
      }
      return message;
    };
    // try to fetch price
    const { coinName, symbol } = getSymbol(coin);
    try {
      if (HUOBI_LIST.includes(coinName)) {
        coinPrice = parseFloat((await hFetchSpotPrice(symbol)).lastPrice, 10);
      } else {
        coinPrice = parseFloat((await fetchSpotLatest(symbol.toUpperCase())).price, 10);
      }
    } catch {
      await _.session.send(buildMessage('首次获取价格失败，请重试'));
      return;
    }
    // add to star
    if (!stars[userId]) {
      stars[userId] = [];
    }
    if (stars[userId].includes(coinName)) {
      await _.session.send(buildMessage('您已经关注了这个币'))
      return;
    }
    stars[userId].push(coinName);
    await saveStars();
    await _.session.send(buildMessage('关注成功'));
  });
  ctx.app.command('remove-star <coin>').action(async (_, coin) => {
    const buildMessage = (msg) => {
      let message = msg;
      if (subtype === 'group') {
        message =
          segment.at(userId) + message;
      }
      return message;
    };
    const { userId } = _.session;
    const { coinName } = getSymbol(coin);
    if (!stars[userId] || !stars[userId].includes(coinName)) {
      await _.session.send(buildMessage('您没有关注这个币'))
      return;
    }
    const idx = stars[userId].indexOf(coinName);
    stars[userId].splice(idx, 1);
    await _.sesion.send(buildMessage('已取消关注'));
  });
  ctx.app.command('my-stars').action(async (_) => {
    const buildMessage = (msg) => {
      let message = msg;
      if (subtype === 'group') {
        message =
          segment.at(userId) + message;
      }
      return message;
    };
    const myStars = stars[_.session.userId];
    if (!myStars || !myStars.length) {
      await _.session.send(buildMessage('您没有关注任何币'));
      return;
    }
    let coins = [];
    for (const coinName of myStars) {
      const { symbol } = getSymbol(coinName);
      let price;
      if (HUOBI_LIST.includes(symbol)) {
        price = await hFetchSpotPrice(symbol);
      } else {
        price = await fetchSpotPrice(symbol);
      }
      if (price) {
        coins += `${coinName.toUpperCase()} ${price.lastPrice} ${price.priceChangePercent}%`;
      } else {
        coins += `${coinName.toUpperCase()} 获取失败`;
      }
    }
    const starsMsg = '您的关注: ';
    coins.forEach((str, index) => {
      starsMsg += `\n[${index}] ${str}`;
    });
    await _.session.send(buildMessage(starsMsg));
  });
}