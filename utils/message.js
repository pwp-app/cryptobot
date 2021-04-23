const COIN_TYPE = {
  spot: '现货',
  futures: '合约',
};

const buildMessage = (coin, price) => {
  const output = [`【${COIN_TYPE[coin.type]}】${coin.name.toUpperCase()}${coin.type === 'spot' ? '/' : ''}USDT`];
  const highPrice = parseFloat(price.highPrice, 10);
  const lowPrice = parseFloat(price.lowPrice, 10);
  const avgPrice = parseFloat(price.weightedAvgPrice, 10);
  const lowDistance = avgPrice - lowPrice;
  const highDistance = highPrice - avgPrice;
  const lowDistancePercent = ((avgPrice - lowPrice) / avgPrice) * 100;
  const highDistancePercent = ((highPrice - avgPrice) / highPrice) * 100;
  output.push(`当前均价: ${avgPrice}`);
  output.push(`24小时变化: ${parseFloat(price.priceChange, 10)} ${price.priceChangePercent}%`);
  output.push(`24小时交易量: ${parseFloat(price.volume, 10)} ${coin.name.toUpperCase()}`);
  output.push(`24小时交易额: ${parseFloat(price.quoteVolume, 10)} USD`);
  output.push(`24小时高点: ${highPrice}`);
  output.push(`24小时低点: ${lowPrice}`);
  output.push(`距离低点: ${lowDistance.toFixed(8)} ${lowDistancePercent.toFixed(2)}%`);
  output.push(`距离高点: -${highDistance.toFixed(8)} - ${highDistancePercent.toFixed(2)}%`);
  return output.join('\n');
};

module.exports = {
  buildMessage,
};
