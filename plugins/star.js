const HUOBI_LIST = require('../constants/huobiList');
const { fetchSpotPrice } = require('../utils/binance');
const { getSymbol } = require('../utils/coin');
const { hFetchSpotPrice } = require('../utils/huobi');
const { formatNumber, send } = require('../utils/message');
const { checkCoin } = require('../utils/coin');
const db = require('../utils/db');

let stars = {};

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

module.exports.name = 'crypto-star-list';
module.exports = async (ctx) => {
  await initStars();
  ctx.command('star <coin>', '将某个币添加至关注').action(async (_, coin) => {
    const { session } = _;
    const { userId } = session;
    // try to fetch price
    if (!(await checkCoin(coin))) {
      await send(session, '有效性检查失败，请重试');
      return;
    }
    // add to star
    if (!stars[userId]) {
      stars[userId] = [];
    }
    const { coinName } = getSymbol(coin);
    if (stars[userId].includes(coinName)) {
      await send(session, '您已经关注了这个币');
      return;
    }
    stars[userId].push(coinName);
    await saveStars();
    await send(session, '关注成功');
  });
  ctx.command('remove-star <coin>', '移除关注').action(async (_, coin) => {
    const { session } = _;
    const { userId } = session;
    const { coinName } = getSymbol(coin);
    if (!stars[userId] || !stars[userId].includes(coinName)) {
      await send(session, '您没有关注这个币');
      return;
    }
    const idx = stars[userId].indexOf(coinName);
    stars[userId].splice(idx, 1);
    await send(session, '已取消关注');
  });
  ctx.command('my-stars', '查询我的关注').action(async (_) => {
    const { session } = _;
    const { userId } = session;
    const myStars = stars[userId];
    if (!myStars || !myStars.length) {
      await send(session, '您没有关注任何币');
      return;
    }
    // fetch price
    let coins = [];
    await Promise.all(
      myStars.map((coinName, idx) => {
        return new Promise(async (resolve) => {
          const { symbol } = getSymbol(coinName);
          let price;
          if (HUOBI_LIST.includes(symbol)) {
            price = await hFetchSpotPrice(symbol);
          } else {
            price = await fetchSpotPrice(symbol.toUpperCase());
          }
          if (price) {
            coins.push({
              idx,
              msg: `${coinName.toUpperCase()} ${formatNumber(price.lastPrice)} ${price.priceChangePercent}%`,
            });
          } else {
            coins.push({
              idx,
              msg: `${coinName.toUpperCase()} 获取失败`,
            });
          }
          resolve();
        });
      })
    );
    // build message
    coins.sort((a, b) => a.idx - b.idx);
    let starsMsg = '您的关注: ';
    coins.forEach((item, index) => {
      starsMsg += `\n[${index + 1}] ${item.msg}`;
    });
    await send(session, starsMsg);
  });
};
