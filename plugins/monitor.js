const { customAlphabet } = require('nanoid');
const { addMontior, removeMonitor } = require('../utils/monitor');
const { checkCoin } = require('../utils/coin');
const { send } = require('../utils/message');
const db = require('../utils/db');

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 6);
const storeKey = 'monitor_tasks';

let tasks = [];
const taskMap = {};

const removeTask = (id) => {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (task.id === id) {
      tasks.splice(i, 1);
      break;
    }
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
  taskMap[id] = true;
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

module.exports.name = 'crypto-price-monitor';
module.exports = async (ctx) => {
  await initTasks.call(ctx.bots[0]);
  // add command
  ctx.command('monitor <coin> <type> <price>', '监控某个币的现货价格并给出提醒 (type支持lt/gt)').action(async (_, coin, type, price) => {
    // check type
    if (type !== 'gt' && type !== 'lt') {
      await send(_.session, 'Type 只能为 gt 或 lt');
      return;
    }
    // check price
    const formattedPrice = parseFloat(price, 10);
    if (isNaN(price) || price <= 0) {
      await send(_.session, 'Price 不合法');
      return;
    }
    // check coin
    if (!await checkCoin(coin)) {
      await send(_.session, '有效性检查失败，请重试');
      return;
    };
    // create a monitor task
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
    await await send(_.session, '价格提醒已创建');
  });
  ctx.command('my-monitors', '查询已创建的价格提醒').action(async (_) => {
    const { userId } = _.session;
    const myTasks = [];
    tasks.forEach((task) => {
      if (task.userId === userId) {
        myTasks.push(task);
      }
    });
    if (!myTasks.length) {
      await send(_.session, '您没有设置任何价格提醒');
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
  ctx.command('remove-monitor <id>', '根据ID移除价格提醒').action(async (_, id) => {
    const task = taskMap[id];
    if (!task) {
      await send(_.session, '无法找到对应的价格提醒');
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
    await send(_.session, `价格提醒 [${id}] 已移除`);
  });
};
