const { ONE_WEEK } = require('../constants/time');
const { send, formatNumber, fixedNumber } = require('../utils/message');
const { getLatestPrice, getLatestPriceBySymbol, getSymbol, checkCoin } = require('../utils/coin');
const { addMontior, removeMonitor } = require('../utils/monitor');
const { shortNanoId } = require('../utils/nanoid');
const { getGroupMemberNames } = require('../utils/group');
const { segment } = require('koishi-utils');
const db = require('../utils/db');

let userData = {};
let futuresData = {};
let orderHandlers = {};

const INIT_MONEY = 10000.0;
const STORE_KEY = 'sim_trade_data';

const initUserData = async function () {
  try {
    userData = JSON.parse(await db.get(STORE_KEY));
  } catch (err) {
    if (!err.notFound) {
      throw err;
    }
  }
  // init order monitors
  Object.keys(userData).forEach((userId) => {
    const user = userData[userId];
    user.orders &&
      Object.keys(user.orders).forEach((orderId) => {
        const order = user.orders[orderId];
        addOrderMonitor.call(this, order);
      });
  });
};

const saveUserData = async () => {
  await db.supdate(STORE_KEY, JSON.stringify(userData));
};

const initUser = async (userId, groupId) => {
  userData[userId] = {
    money: INIT_MONEY,
    availableMoney: INIT_MONEY,
    orders: {},
    positions: {},
    createTime: Date.now(),
    groupId,
  };
  await saveUserData();
};

const checkUser = async (session) => {
  const { userId } = session;
  if (!userData[userId]) {
    await send(session, '请先使用"init-trade"指令初始化模拟交易');
    return false;
  }
  return true;
};

const getPositionsValue = async (userId) => {
  const { positions } = userData[userId];
  if (!positions) {
    return 0;
  }
  const symbols = Object.keys(positions);
  if (!symbols.length) {
    return 0;
  }
  const price = {};
  await Promise.all(
    symbols.map((symbol) => {
      return new Promise(async (resolve) => {
        const res = await getLatestPriceBySymbol(symbol);
        if (res) {
          price[symbol] = res;
        }
        resolve();
      });
    })
  );
  let value = 0;
  symbols.forEach((symbol) => {
    const position = positions[symbol];
    if (!position) {
      return;
    }
    if (!price[symbol]) {
      return -1;
    }
    value += price[symbol] * position.amount;
  });
  return value;
};

const addOrderMonitor = function ({ id: orderId, userId, coin, type, price, amount, channelId }) {
  const sendMessage = async (message) => {
    await this.sendMessage(channelId, `${channelId.includes('private') ? '' : segment.at(userId)}${message}`);
  };
  const handler = async ({ price: lastPrice }) => {
    // deal
    if (type === 'buy' && lastPrice <= price) {
      const user = userData[userId];
      const consume = price * amount;
      user.money -= consume;
      const { symbol } = getSymbol(coin);
      const position = user.positions[symbol];
      if (!position) {
        user.positions[symbol] = {
          amount,
          availableAmount: amount,
          avgCost: price,
        };
      } else {
        const { amount: storedAmount, avgCost: storedAvgCost, availableAmount: storedAvailableAmount } = user.positions[symbol];
        user.positions[symbol] = {
          amount: storedAmount + amount,
          availableAmount: storedAvailableAmount + amount,
          avgCost: (storedAmount * storedAvgCost + amount * price) / (storedAmount + amount),
        };
      }
      user.orders[orderId] = null;
      delete user.orders[orderId];
      await saveUserData();
      removeMonitor(coin, handler);
      await sendMessage(`订单[${orderId}]已成交 (${coin.toUpperCase()}, ${formatNumber(price)} * ${formatNumber(amount)})`);
    } else if (type === 'sell' && lastPrice >= price) {
      const user = userData[userId];
      const { symbol } = getSymbol(coin);
      const position = user.positions[symbol];
      if (!position) {
        return;
      }
      // consume position amount
      const remainAmount = position.amount - amount;
      if (remainAmount <= 0) {
        user.positions[symbol] = null;
        delete user.positions[symbol];
      } else {
        // calc avg cost
        position.avgCost = (position.amount * position.avgCost - amount * price) / remainAmount;
        position.amount = remainAmount;
      }
      // remove money
      const selledMoney = price * amount;
      user.money += selledMoney;
      user.availableMoney += selledMoney;
      user.orders[orderId] = null;
      delete user.orders[orderId];
      await saveUserData();
      removeMonitor(coin, handler);
      await sendMessage(`订单[${orderId}]已成交 (${coin.toUpperCase()}, ${formatNumber(price)} * ${formatNumber(amount)})`);
    }
  };
  addMontior(coin, handler);
  orderHandlers[orderId] = handler;
};

const placeOrder = async (session, { type, coin, price, amount }) => {
  if (!checkUser(session)) {
    return;
  }
  if (type !== 'buy' && type !== 'sell') {
    await send(session, '请输入正确的类型');
    return;
  }
  const parsedPrice = parseFloat(price, 10);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    await send(session, '价格不合法');
    return;
  }
  const parsedAmount = parseFloat(amount, 10);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    await send(session, '数量不合法');
    return;
  }
  // check coin
  if (!checkCoin(coin)) {
    await send(session, '请检查输入的币名');
    return;
  }
  const lowerCaseCoin = coin.toLowerCase();
  if (lowerCaseCoin.includes('/') && !lowerCaseCoin.endsWith('usdt')) {
    await send(session, '模拟交易仅支持 币/USDT 交易对');
    return;
  }
  // place order
  const { userId } = session;
  const user = userData[userId];
  if (type === 'buy') {
    // check user available money
    const consume = parsedPrice * parsedAmount;
    if (consume > user.availableMoney) {
      await send(session, `可用资金不足 (可用: ${user.availableMoney} USDT)`);
      return;
    }
    user.availableMoney -= consume;
  } else if (type === 'sell') {
    const { symbol } = getSymbol(coin);
    const position = user.positions[symbol];
    if (!position) {
      await session.send('您没有对应的持仓');
      return;
    }
    if (parsedAmount > position.availableAmount) {
      await session.send('超出最大可售量，无法挂单');
      return;
    }
    position.availableAmount -= parsedAmount;
  }
  // add order to user
  let orderId = shortNanoId();
  while (user.orders[orderId]) {
    orderId = shortNanoId();
  }
  const order = {
    id: orderId,
    userId,
    coin: lowerCaseCoin,
    type,
    price: parsedPrice,
    amount: parsedAmount,
    channelId: session.channelId,
  };
  user.orders[orderId] = order;
  await saveUserData();
  // start monitor
  addOrderMonitor.call(session.bot, order);
  await send(session, '挂单成功');
};

module.exports.name = 'crypto-sim-trade';
module.exports = async (ctx) => {
  await initUserData.call(ctx.bots[0]);
  ctx.command('init-trade', '初始化模拟交易（重复调用会重置数据）').action(async (_) => {
    const { session } = _;
    const { subtype, userId } = session;
    if (process.env.NODE_ENV !== 'dev') {
      if (userData[userId]) {
        const { createTime } = userData[userId];
        if (Date.now() - createTime < ONE_WEEK) {
          await send(session, '每7天只允许初始化一次数据');
          return;
        }
      }
    }
    let groupId = null;
    if (subtype === 'group') {
      groupId = session.groupId;
    }
    await initUser(userId, groupId);
    await send(session, '模拟交易(Beta) 用户数据初始化完成');
  });
  // ctx.command('trans-to-futures <amount>', '从钱包划转至模拟合约账户', () => {

  // });
  // ctx.command('trans-to-wallet <amount>', '从模拟合约账户划转至钱包', () => {

  // });
  ctx.command('buy <amount> <coin> [at] [price]', '模拟购买限价/市价买入现货').action(async (_, amount, coin, at, price) => {
    const { session } = _;
    if (!checkUser(session)) {
      return;
    }
    if (at && at !== 'at') {
      await send(session, '命令格式错误');
      return;
    }
    if (at === 'at') {
      return await placeOrder(session, { type: 'buy', coin, price, amount });
    }
    const parsedAmount = parseFloat(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await send(session, '数量不合法');
      return;
    }
    const lowerCaseCoin = coin.toLowerCase();
    if (lowerCaseCoin.includes('/') && !lowerCaseCoin.endsWith('usdt')) {
      await send(session, '模拟交易仅支持 币/USDT 交易对');
      return;
    }
    const { symbol } = getSymbol(coin);
    const latestPrice = await getLatestPrice(coin);
    if (!latestPrice) {
      await send(session, '价格获取失败');
      return;
    }
    // check account money
    const { userId } = session;
    const user = userData[userId];
    const consumeAmount = latestPrice * parsedAmount;
    if (consumeAmount > user.money) {
      await send(session, `资金不足 (可用: ${user.availableMoney})`);
      return;
    }
    // consume money and add position
    user.money -= consumeAmount;
    user.availableMoney -= consumeAmount;
    if (!user.positions[symbol]) {
      user.positions[symbol] = {
        amount: parsedAmount,
        availableAmount: parsedAmount,
        avgCost: latestPrice,
      };
    } else {
      const { amount: storedAmount, avgCost: storedAvgCost, availableAmount: storedAvailableAmount } = user.positions[symbol];
      user.positions[symbol] = {
        amount: storedAmount + parsedAmount,
        availableAmount: storedAvailableAmount + parsedAmount,
        avgCost: (storedAmount * storedAvgCost + parsedAmount * latestPrice) / (storedAmount + parsedAmount),
      };
    }
    await saveUserData();
    await send(session, `市价购入成功 (${formatNumber(latestPrice)} * ${formatNumber(parsedAmount)})`);
  });
  ctx.command('sell <amount> <coin> [at] [price]', '模拟购买限价/市价卖出现货').action(async (_, amount, coin, at, price) => {
    const { session } = _;
    if (!checkUser(session)) {
      return;
    }
    if (at && at !== 'at') {
      await send(session, '命令格式错误');
      return;
    }
    if (at === 'at') {
      return await placeOrder(session, { type: 'sell', coin, price, amount });
    }
    const parsedAmount = parseFloat(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await send(session, '数量不合法');
      return;
    }
    // get latest price
    const latestPrice = await getLatestPrice(coin);
    if (!latestPrice) {
      await send(session, '价格获取失败');
      return;
    }
    // check user position
    const { userId } = session;
    const user = userData[userId];
    const { symbol } = getSymbol(coin);
    if (!user.positions[symbol]) {
      await send(session, '您没有对应的持仓');
      return;
    }
    const position = user.positions[symbol];
    if (parsedAmount > position.availableAmount) {
      await send(session, '卖出失败，超出可用数量');
      return;
    }
    // sell position
    const remainAmount = position.amount - parsedAmount;
    if (remainAmount <= 0) {
      user.positions[symbol] = null;
      delete user.positions[symbol];
    } else {
      // calc avg cost
      position.avgCost = (position.amount * position.avgCost - parsedAmount * latestPrice) / remainAmount;
      position.amount = remainAmount;
      position.availableAmount = position.availableAmount - parsedAmount;
    }
    // remove money
    const selledMoney = latestPrice * parsedAmount;
    user.money += selledMoney;
    user.availableMoney += selledMoney;
    await saveUserData();
    await send(session, `市价卖出成功 (${formatNumber(latestPrice)} * ${formatNumber(parsedAmount)})`);
  });
  ctx.command('cancel-order <orderId>', '撤销模拟交易中的订单').action(async (_, orderId) => {
    const { session } = _;
    if (!checkUser(session)) {
      return;
    }
    const { userId } = session;
    const user = userData[userId];
    const order = user.orders[orderId];
    if (!order) {
      await send(session, '找不到对应的订单');
      return;
    }
    if (order.type === 'buy') {
      user.availableMoney += order.price * order.amount;
    } else if (order.type === 'sell') {
      const { symbol } = getSymbol(order.coin);
      user.positions[symbol].availableAmount += order.amount;
    }
    // remove handler
    if (orderHandlers[orderId]) {
      removeMonitor(order.coin, orderHandlers[orderId]);
      orderHandlers[orderId] = null;
      delete orderHandlers[orderId];
    }
    // remove order
    user.orders[orderId] = null;
    delete user.orders[orderId];
    await saveUserData();
    await send(session, `订单[${orderId}]已撤销`);
  });
  ctx.command('my-account', '查询模拟交易账户信息').action(async (_) => {
    const { session } = _;
    if (!checkUser(session)) {
      return;
    }
    const { userId } = session;
    const user = userData[userId];
    let positionsValue;
    try {
      positionsValue = await getPositionsValue(userId);
    } catch (err) {
      console.error('Failed to get positions value.', err);
      await send(session, '无法获取持仓价值');
    }
    if (positionsValue < 0) {
      await send(session, '无法获取持仓价值');
      return;
    }
    const userValue = user.money + positionsValue;
    await send(
      session,
      `您的账户信息:\n总价值: ${userValue.toFixed(2)} USDT\n总资金: ${user.money.toFixed(2)} USDT\n可用资金: ${user.availableMoney.toFixed(
        2
      )} USDT\n收益: ${(userValue - INIT_MONEY).toFixed(2)} USDT (${(((user.money + positionsValue - INIT_MONEY) / INIT_MONEY) * 100).toFixed(5)}%)`
    );
  });
  ctx.command('my-positions', '查询模拟交易持仓').action(async (_) => {
    const { session } = _;
    if (!checkUser(session)) {
      return;
    }
    const { userId } = session;
    const { positions } = userData[userId];
    const symbols = Object.keys(positions);
    if (!symbols.length) {
      await send(session, '您当前没有任何持仓');
      return;
    }
    // fetch latest price data
    const price = {};
    try {
      await Promise.all(
        symbols.map((symbol) => {
          return new Promise(async (resolve) => {
            const res = await getLatestPriceBySymbol(symbol);
            if (res) {
              price[symbol] = res;
            }
            resolve();
          });
        })
      );
    } catch (err) {
      console.error('Failed to get price of positions.', err);
      await send(session, '获取持仓信息失败');
      return;
    }
    let message = '您的持仓:';
    symbols.forEach((symbol, index) => {
      const position = positions[symbol];
      if (!position) {
        return;
      }
      const value = price[symbol] ? ` (${(price[symbol] * position.amount).toFixed(2)} USDT)` : '';
      message += `\n[${index + 1}] ${symbol.toUpperCase().replace('USDT', '')}\n总数/可用: ${formatNumber(position.amount)} / ${formatNumber(
        position.availableAmount
      )}${value}\n现价/平均成本: ${price[symbol] || 'Failed'} / ${fixedNumber(formatNumber(position.avgCost))}\n未实现盈亏: ${
        price[symbol] ? ((price[symbol] - position.avgCost) * position.amount).toFixed(2) : 'Failed'
      } USDT (${price[symbol] ? (((price[symbol] - position.avgCost) / position.avgCost) * 100).toFixed(2) + '%' : 'Failed'})`;
    });
    await send(session, message);
  });
  ctx.command('my-orders', '查询模拟交易订单').action(async (_) => {
    const { session } = _;
    if (!checkUser(session)) {
      return;
    }
    const { userId } = session;
    const { orders } = userData[userId];
    const orderIds = Object.keys(orders);
    if (!orderIds.length) {
      await send(session, '您没有设置任何订单');
      return;
    }
    let message = '您的订单:';
    orderIds.forEach((id, index) => {
      const order = orders[id];
      message += `\n[${index + 1}] ${order.type === 'buy' ? 'Buy' : 'Sell'} ${formatNumber(
        order.amount
      )} ${order.coin.toUpperCase()} at ${formatNumber(order.price)} (${order.id})`;
    });
    await send(session, message);
  });
  ctx.command('group-rank', '查看群韭菜排行榜').action(async (_) => {
    const { session } = _;
    if (session.subtype !== 'group') {
      return;
    }
    // get group users
    const { groupId } = session;
    const groupUsers = [];
    Object.keys(userData).forEach((userId) => {
      const user = userData[userId];
      const { groupId: userGroupId } = user;
      if (userGroupId === groupId) {
        Object.assign(user, {
          id: userId,
        });
        groupUsers.push(user);
      }
    });
    if (!groupUsers.length) {
      await send(session, '群里没有韭菜');
      return;
    }
    // get all users account value
    await Promise.all(
      groupUsers.map(async (user) => {
        const { id } = user;
        const positionsValue = await getPositionsValue(id);
        if (positionsValue < 0) {
          return;
        }
        Object.assign(user, {
          totalValue: user.money + positionsValue,
        });
      })
    );
    // build message
    let message = '韭菜排行榜';
    // sro
    groupUsers.sort((a, b) => {
      if (!a.totalValue && b.totalValue) {
        return 1;
      }
      if (a.totalValue && !b.totalValue) {
        return -1;
      }
      if (!a.totalValue && !b.totalValue) {
        return 0;
      }
      return b.totalValue - a.totalValue;
    });
    const memberNames = await getGroupMemberNames(session.bot, groupId);
    groupUsers.forEach((user, index) => {
      const profit = user.totalValue - INIT_MONEY;
      const profitRate = (profit / INIT_MONEY) * 100;
      const profitStr = `${profit >= 0 ? '+' : ''}${profit.toFixed(2)}`;
      const profitRateStr = `${profit >= 0 ? '+' : ''}${profitRate.toFixed(4)}%`;
      message += `\n[${index + 1}] ${memberNames[user.id]} ${user.totalValue ? user.totalValue.toFixed(2) : '账户价值获取失败'}${
        user.totalValue ? ' ' + `${profitStr} (${profitRateStr})` : ''
      }`;
    });
    await session.send(message);
  });
};
