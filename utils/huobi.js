const ccxt = require('ccxt');
const HttpsProxyAgent = require('https-proxy-agent');
const { hApiKey, hApiSecret } = require('../config.private');

const huobiOpts = {
  apiKey: hApiKey,
  apiSecret: hApiSecret,
  countries: ['CN'],
};

let huobi;

if (process.env.NODE_ENV === 'dev') {
  huobi = new ccxt.huobipro({
    ...huobiOpts,
    agent: new HttpsProxyAgent('http://127.0.0.1:7890'),
  });
} else {
  huobi = new ccxt.huobipro(huobiOpts);
}

const hFetchSpotPrice = async (symbol) => {
  let res;
  try {
    res = await huobi.request('detail/merged', 'market', 'get', {
      symbol,
    });
  } catch (err) {
    console.error('Failed to fetch spot price from huobi.', err);
  }
  if (res) {
    const { tick } = res;
    return {
      lowPrice: tick.low,
      highPrice: tick.high,
      lastPrice: tick.close,
      priceChange: tick.close - tick.open,
      priceChangePercent: (((tick.close - tick.open) / tick.open) * 100).toFixed(2),
      volume: tick.amount,
      quoteVolume: tick.vol,
    };
  }
  return null;
};

module.exports = {
  hFetchSpotPrice,
};
