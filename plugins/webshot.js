const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { checkCoin } = require('../utils/coin');
const { send } = require('../utils/message');
const { segment } = require('koishi-utils');

const tempDirPath = path.resolve(__dirname, '../temp');
const DOMAIN = 'www.binance.cc';

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
        width: 1280,
        height: 800,
      });
      if (!coin.includes('/')) {
        await page.goto(`https://${DOMAIN}/zh-CN/trade/${coin.toUpperCase()}_USDT?type=spot`);
      } else {
        const tradePair = coin.replace('/', '_').toUpperCase();
        await page.goto(`https://${DOMAIN}/zh-CN/trade/${tradePair}?type=spot`);
      }
      await page.mouse.click(962, 184);
      await page.mouse.click(932, 130);
      const { options } = _;
      if (options.period) {
        if (options.period === '15m') {
          await page.mouse.click(398, 202);
        } else if (options.period === '1h') {
          await page.mouse.click(448, 202);
        } else if (options.period === '4h') {
          await page.mouse.click(497, 202);
        }
      } else {
        await page.mouse.click(536, 202);
      }
      const loadTimeout = setTimeout(async () => {
        await page.close();
        await send(session, 'K线图加载失败');
      }, 15 * 1000);
      page.on('response', async (response) => {
        const url = response.request().url();
        if (!url.includes('klines') || !url.includes(options.period || '1d')) {
          return;
        }
        await response.json();
        clearTimeout(loadTimeout);
        const imgBuffer = await page.screenshot({
          clip: {
            x: 328,
            y: 182,
            width: 622,
            height: 484,
          },
        });
        await page.close();
        await session.send(segment.image(imgBuffer));
      });
    });
};
