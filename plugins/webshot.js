const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { checkCoin } = require('../utils/coin');
const { send } = require('../utils/message');
const { segment } = require('koishi-utils');

const tempDirPath = path.resolve(__dirname, '../temp');
const DOMAIN = 'www.binance.com';

if (!fs.existsSync(tempDirPath)) {
  fs.mkdirSync(tempDirPath, { recursive: true });
}

let browser;

const launchBrowser = async () => {
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
};

module.exports = async (ctx) => {
  await launchBrowser();
  ctx
    .command('chart <coin>', '查看某种币的K线')
    .option('period', '-p <period>')
    .action(async (_, coin) => {
      const { session } = _;
      // check coin
      if (!(await checkCoin(coin))) {
        await send(session, '请检查输入的币名');
        return;
      }
      // take shot
      const page = await browser.newPage();
      page.setViewport({
        width: 1020,
        height: 768,
      });
      if (!coin.includes('/')) {
        await page.goto(`https://${DOMAIN}/zh-CN/trade/${coin.toUpperCase()}_USDT?type=spot`);
      } else {
        const tradePair = coin.replace('/', '_').toUpperCase();
        await page.goto(`https://${DOMAIN}/zh-CN/trade/${tradePair}?type=spot`);
      }
      await page.mouse.click(1, 1);
      const { options } = _;
      await page.click(`[id="${options.period || '1d'}"]`);
      const loadTimeout = setTimeout(async () => {
        await send(session, '获取K线图数据失败');
      }, 15 * 1000);
      page.on('response', async (response) => {
        const url = response.request().url();
        if (!url.includes('klines') || !url.includes(options.period || '1d')) {
          return;
        }
        try {
          await response.json();
        } catch {
          await send(session, '获取K线图数据失败');
          return;
        }
        clearTimeout(loadTimeout);
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve();
          }, 3000);
        });
        const imgBuffer = await page.screenshot({
          clip: {
            x: 0,
            y: 162,
            width: 679,
            height: 392,
          },
        });
        await page.close();
        await session.send(segment.image(imgBuffer));
      });
    });
};
