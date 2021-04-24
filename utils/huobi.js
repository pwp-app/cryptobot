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
    res = await huobi.request('/market/detail/merged', 'public', 'get', {
      symbol,
    });
  } catch {
    console.error('Failed to fetch spot price from huobi.');
  }
  if (res) {
    return {
      lowPrice: res.low,
      highPrice: res.high,
      lastPrice: res.close,
      priceChange: res.close - res.open,
      priceChangePercent: (((res.close - res.open) / res.open) * 100).toFixed(2),
      volume: vol,
      quoteVolume: amount,
    };
  }
  return null;
};

module.exports = {
  hFetchSpotPrice,
};
