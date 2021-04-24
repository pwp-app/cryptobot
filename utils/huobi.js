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
    console.log(res);
    return {
      lowPrice: res.low,
      highPrice: res.high,
      lastPrice: res.close,
      priceChange: res.close - res.open,
      priceChangePercent: (((res.close - res.open) / res.open) * 100).toFixed(2),
      volume: res.vol,
      quoteVolume: res.amount,
    };
  }
  return null;
};

module.exports = {
  hFetchSpotPrice,
};
