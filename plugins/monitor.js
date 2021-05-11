const { addMontior, removeMonitor } = require('../utils/monitor');
const { checkCoin } = require('../utils/coin');
const { send } = require('../utils/message');
const { segment } = require('koishi-utils');
const { nanoid } = require('../utils/nanoid');
const db = require('../utils/db');

const storeKey = 'monitor_tasks';

let tasks = {};

const removeTask = (id) => {
  if (tasks[id]) {
    tasks[id] = null;
    delete tasks[id];
  }
};

const createMonitorTask = function ({ id, coin, type, price, userId, channelId }) {
  const sendMessage = async (coinPrice) => {
    await this.sendMessage(
      channelId,
      `${
        channelId.includes('private')
          ? ''
          : segment.at(userId)
      }${coin.toUpperCase()} 已经${type === 'gt' ? '上涨' : '下跌'}至 ${coinPrice} (${price})`
    );
  }
  const handler = async ({ price: coinPrice }) => {
    if ((type === 'gt' && coinPrice >= price) || (type === 'lt' && coinPrice <= price)) {
      removeMonitor(coin, handler);
      removeTask(id);
      await sendMessage(coinPrice);
      await db.supdate(storeKey, JSON.stringify(tasks));
    }
  };
  addMontior(coin, handler);
  tasks[id].handler = handler;
};

const initTasks = async function () {
  try {
    const storedTasks = JSON.parse(await db.get(storeKey));
    if (Array.isArray(storedTasks)) {
      storedTasks.forEach((opts) => {
        tasks[opts.id] = opts;
        createMonitorTask.call(this, opts);
      });
    } else {
      tasks = storedTasks;
      Object.keys(tasks).forEach((taskId) => {
        createMonitorTask.call(this, tasks[taskId]);
      });
    }
  } catch (err) {
    if (!err.notFound) {
      throw err;
    }
  }
};

module.exports.name = 'crypto-price-monitor';
module.exports = async (ctx) => {
  await initTasks.call(ctx.bots[0]);
  // add command
  ctx.command('monitor <coin> <type> <price>', '监控某个币的现货价格并给出提醒 (type支持lt/gt)').action(async (_, coin, type, price) => {
    const { session } = _;
    // check type
    if (type !== 'gt' && type !== 'lt') {
      await send(session, 'Type 只能为 gt 或 lt');
      return;
    }
    // check price
    const formattedPrice = parseFloat(price, 10);
    if (isNaN(price) || price <= 0) {
      await send(session, 'Price 不合法');
      return;
    }
    // check coin
    if (!await checkCoin(coin)) {
      await send(session, '有效性检查失败，请重试');
      return;
    };
    // create a monitor task
    const { userId, channelId } = _.session;
    let taskId = nanoid();
    while (tasks[taskId]) {
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
    tasks[taskId] = opts;
    createMonitorTask.call(session.bot, opts);
    await db.supdate(storeKey, JSON.stringify(tasks));
    await await send(session, '价格提醒已创建');
  });
  ctx.command('my-monitors', '查询已创建的价格提醒').action(async (_) => {
    const { session } = _;
    const { userId } = session;
    const myTasks = [];
    Object.keys(tasks).forEach((taskId) => {
      const task = tasks[taskId];
      if (task.userId === userId) {
        myTasks.push(task);
      }
    });
    if (!myTasks.length) {
      await send(session, '您没有设置任何价格提醒');
      return;
    }
    let message = '';
    if (session.subtype === 'group') {
      message += segment.at(session.userId);
    }
    message += '您的价格提醒: ';
    myTasks.forEach((task, index) => {
      const { coin, type, price, id } = task;
      message += `\n[${index + 1}] ${coin.toUpperCase()} ${type === 'gt' ? '高于' : '低于'} ${price} (${id})`;
    });
    await session.send(message);
  });
  ctx.command('remove-monitor <id>', '根据ID移除价格提醒').action(async (_, id) => {
    const { session } = _;
    const task = tasks[id];
    if (!task) {
      await send(session, '无法找到对应的价格提醒');
      return;
    }
    removeMonitor(task.coin, task.handler);
    removeTask(id);
    await db.supdate(storeKey, JSON.stringify(tasks));
    await send(session, `价格提醒 [${id}] 已移除`);
  });
};
