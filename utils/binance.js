const ccxt = require('ccxt');
const HttpsProxyAgent = require('https-proxy-agent');
const { apiKey, secret } = require('../config.private');

const binanceOpts = {
  apiKey,
  secret,
  countries: ['CN'],
};

let binance;

if (process.env.NODE_ENV === 'dev') {
  binance = new ccxt.binance({
    ...binanceOpts,
    agent: new HttpsProxyAgent('http://127.0.0.1:7890'),
  });
} else {
  binance = new ccxt.binance(binanceOpts);
}

const fetchSpotPrice = async (symbol) => {
  return await binance.request('ticker/24hr', 'public', 'get', { symbol });
};

const fetchFuturesPrice = async (symbol) => {
  return await binance.request('ticker/24hr', 'fapiPublic', 'get', { symbol });
}

module.exports = {
  fetchSpotPrice,
  fetchFuturesPrice,
};
