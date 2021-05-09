const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const PNG = require('pngjs').PNG;
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
      try {
        if (!coin.includes('/')) {
          await page.goto(`https://${DOMAIN}/zh-CN/trade/${coin.toUpperCase()}_USDT?type=spot`, {
            waitUntil: 'networkidle2',
          });
        } else {
          const tradePair = coin.replace('/', '_').toUpperCase();
          await page.goto(`https://${DOMAIN}/zh-CN/trade/${tradePair}?type=spot`, {
            waitUntil: 'networkidle2',
          });
        }
      } catch (err) {
        console.error('Failed to navigate.', err);
        await send(session, `获取[${coin.toUpperCase()}]K线图数据失败 (等待超时)`);
        await page.close();
        return;
      }
      await page.mouse.click(1, 1);
      const { options } = _;
      await page.click(`[id="${options.period || '1d'}"]`);
      const loadTimeout = setTimeout(async () => {
        await send(session, `获取[${coin.toUpperCase()}]K线图数据失败 (加载超时)`);
      }, 15 * 1000);
      const delayExec = async (fn) => {
        await new Promise((resolve) => {
          setTimeout(() => {
            fn();
            resolve();
          }, 1000);
        });
      };
      const takeShot = async () => {
        const chart = await page.$('.kline-container');
        if (!chart) {
          return await delayExec(takeShot);
        }
        const imgBuffer = await chart.screenshot();
        const rx = 323;
        const ry = 155;
        const res = await new Promise((resolve) => {
          new PNG({ filterType: 4 }).parse(imgBuffer, function (err, img) {
            if (err) {
              return resolve(false);
            }
            const idx = (img.width * ry + rx) << 2;
            const { data } = img;
            const pixels = [data[idx], data[idx + 1], data[idx + 2]];
            if (pixels[0] === 240 && pixels[1] === 185 && pixels[2] === 11) {
              return resolve(false);
            }
            resolve(true);
          });
        });
        if (res) {
          await page.close();
          clearTimeout(loadTimeout);
          await session.send(segment.image(imgBuffer));
        } else {
          console.log(2);
          return await delayExec(takeShot);
        }
      };
      await takeShot();
    });
};
