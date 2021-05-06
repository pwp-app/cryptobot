const cron = require('node-cron');
const { customAlphabet } = require('nanoid');
const { segment } = require('koishi-utils');
const { fetchSpotLatest } = require('../utils/binance');
const { hFetchSpotPrice } = require('../utils/huobi');
const { getSymbol } = require('../utils/coin');
const HUOBI_LIST = require('../constants/huobiList');
const db = require('../utils/db');

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 6);
const storeKey = 'monitor_tasks';

let tasks = [];
const taskMap = {};

const createMonitorTask = function ({ id, coin, type, price, userId, channelId }) {
  const task = cron.schedule('*/1 * * * * *', async () => {
    const { coinName, symbol } = getSymbol(coin);
    let coinPrice;
    let originPriceData;
    try {
      if (HUOBI_LIST.includes(coinName)) {
        originPriceData = (await hFetchSpotPrice(symbol)).lastPrice;
        coinPrice = parseFloat(originPriceData, 10);
      } else {
        originPriceData = (await fetchSpotLatest(symbol.toUpperCase())).price;
        coinPrice = parseFloat(originPriceData, 10);
      }
    } catch {
      console.error('Failed to fetch price in task.');
      return;
    }
    if (type === 'gt') {
      if (coinPrice >= price) {
        task.stop();
        await this.sendMessage(
          channelId,
          `${
            channelId.includes('private')
              ? ''
              : segment.at(userId)
          }${coin.toUpperCase()} 已经上涨至 ${coinPrice} (${price})`
        );
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          if (task.id === id) {
            tasks.splice(i, 1);
          }
        }
        await db.supdate(storeKey, JSON.stringify(tasks));
      }
    } else if (type === 'lt') {
      if (coinPrice <= price) {
        task.stop();
        await this.sendMessage(
          channelId,
          `${
            channelId.includes('private')
              ? ''
              : segment.at(userId)
          }${coin.toUpperCase()} 已经下跌至 ${coinPrice} (${price})`
        );
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          if (task.id === id) {
            tasks.splice(i, 1);
          }
        }
        await db.supdate(storeKey, JSON.stringify(tasks));
      }
    }
  });
  taskMap[id] = task;
};

const initTasks = async function () {
  try {
    const storedTasks = JSON.parse(await db.get(storeKey));
    storedTasks.forEach((opts) => {
      createMonitorTask.call(this, opts);
    });
    tasks = tasks.concat(storedTasks);
  } catch (err) {
    if (!err.notFound) {
      throw err;
    }
  }
};

module.exports.name = 'Crypto Currency Price Monitor';
module.exports = async (ctx) => {
  await initTasks.call(ctx.bots[0]);
  // add command
  ctx.app.command('monitor <coin> <type> <price>').action(async (_, coin, type, price) => {
    const buildMessage = (msg) => {
      let message = msg;
      if (_.session.subtype === 'group') {
        message =
          segment.at(_.session.userId) + message;
      }
      return message;
    };
    // check type
    if (type !== 'gt' && type !== 'lt') {
      await _.session.send(buildMessage('Type 只能为 gt 或 lt'));
      return;
    }
    // check price
    const formattedPrice = parseFloat(price, 10);
    if (isNaN(price) || price <= 0) {
      await _.session.send(buildMessage('Price 不合法'));
      return;
    }
    // try to fetch once
    const { coinName, symbol } = getSymbol(coin);
    try {
      if (HUOBI_LIST.includes(coinName)) {
        coinPrice = parseFloat((await hFetchSpotPrice(symbol)).lastPrice, 10);
      } else {
        coinPrice = parseFloat((await fetchSpotLatest(symbol.toUpperCase())).price, 10);
      }
    } catch {
      await _.session.send(buildMessage('首次获取价格失败，请重新创建提醒'));
      return;
    }
    const { userId, channelId } = _.session;
    let taskId = nanoid();
    while (taskMap[taskId]) {
      taskId = nanoid();
    }
    const opts = {
      id: taskId,
      coin,
      type,
      price: formattedPrice,
      userId,
      channelId,
    };
    tasks.push(opts);
    createMonitorTask.call(ctx.bots[0], opts);
    await db.supdate(storeKey, JSON.stringify(tasks));
    await _.session.send(buildMessage('价格提醒已创建'));
  });
  ctx.app.command('my-monitors').action(async (_) => {
    const { userId } = _.session;
    const myTasks = [];
    tasks.forEach((task) => {
      if (task.userId === userId) {
        myTasks.push(task);
      }
    });
    if (!myTasks.length) {
      await _.session.send(`${segment.at(_.session.userId)}您没有设置任何价格提醒`);
      return;
    }
    let message = '';
    if (_.session.subtype === 'group') {
      message += segment.at(_.session.userId);
    }
    message += '您的价格提醒: ';
    myTasks.forEach((task, index) => {
      const { coin, type, price, id } = task;
      message += `\n[${index + 1}] ${coin.toUpperCase()} ${type === 'gt' ? '高于' : '低于'} ${price} (${id})`;
    });
    await _.session.send(message);
  });
  ctx.app.command('remove-monitor <id>').action(async (_, id) => {
    const buildMessage = (msg) => {
      let message = msg;
      if (_.session.subtype === 'group') {
        message =
          segment.at(_.session.userId) + message;
      }
      return message;
    };
    const task = taskMap[id];
    if (!task) {
      await _.session.send(buildMessage('无法找到对应的价格提醒'));
      return;
    }
    task.stop();
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id === id) {
        tasks.splice(i, 1);
        break;
      }
    }
    await db.supdate(storeKey, JSON.stringify(tasks));
    await _.session.send(buildMessage(`价格提醒 [${id}] 已移除`));
  });
};
