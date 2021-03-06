const { segment } = require('koishi-utils');

const COIN_TYPE = {
  spot: '现货',
  futures: '合约',
};

const formatNumber = (numStr) => {
  let formatted = `${numStr}`;
  if (!formatted.includes('.')) {
    return formatted;
  }
  let number = parseFloat(numStr, 10);
  if (number === 0) {
    return '0.00';
  }
  while (formatted.endsWith(0)) {
    if (formatted.length > 2 && formatted[formatted.length - 2] === '.') {
      break;
    }
    formatted = formatted.substr(0, formatted.length - 1);
  }
  return formatted;
};

const fixedNumber = (numStr, count = 6) => {
  if (!numStr.includes('.')) {
    return numStr;
  }
  const parts = numStr.split('.');
  if (parts[1].length > count) {
    parts[1] = parts[1].substr(0, count);
  }
  return parts.join('.');
};

const buildPriceMessage = (coin, price) => {
  const output = [];
  if (coin.name.includes('/')) {
    let name = coin.name.toUpperCase();
    if (coin.type !== 'spot') {
      name = name.replace('/', '');
    }
    output.push(`【${COIN_TYPE[coin.type]}】${name}`);
  } else {
    output.push(`【${COIN_TYPE[coin.type]}】${coin.name.toUpperCase()}${coin.type === 'spot' ? '/' : ''}USDT`);
  }
  const highPrice = parseFloat(price.highPrice, 10);
  const lowPrice = parseFloat(price.lowPrice, 10);
  const lastPrice = parseFloat(price.lastPrice, 10);
  const lowDistance = lastPrice - lowPrice;
  const highDistance = highPrice - lastPrice;
  const lowDistancePercent = ((lastPrice - lowPrice) / lowPrice) * 100;
  const highDistancePercent = ((highPrice - lastPrice) / highPrice) * 100;
  output.push(`当前价格: ${lastPrice}`);
  output.push(`24小时变化: ${parseFloat(price.priceChange, 10)} ${price.priceChangePercent}%`);
  output.push(`24小时交易量: ${parseFloat(price.volume, 10)} ${coin.name.toUpperCase()}`);
  output.push(`24小时交易额: ${parseFloat(price.quoteVolume, 10)} USD`);
  output.push(`24小时高点: ${highPrice}`);
  output.push(`24小时低点: ${lowPrice}`);
  output.push(`距离低点: ${formatNumber(lowDistance.toFixed(8))} ${lowDistancePercent.toFixed(2)}%`);
  output.push(`距离高点: -${formatNumber(highDistance.toFixed(8))} -${highDistancePercent.toFixed(2)}%`);
  return output.join('\n');
};

const send = async (session, msg) => {
  const { subtype, userId } = session;
  let message = msg;
  if (subtype === 'group') {
    message = segment.at(userId) + message;
  }
  await session.send(message);
};

module.exports = {
  send,
  formatNumber,
  fixedNumber,
  buildPriceMessage,
};
