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
};

const fetchSpotLatest = async (symbol) => {
  return await binance.request('ticker/price', 'public', 'get', { symbol });
};

const fetchFuturesLatest = async (symbol) => {
  return await binance.request('ticker/price', 'fapiPublic', 'get', { symbol });
};

const fetchLongShortPosition = async (symbol, period) => {
  let res;
  try {
    res = await binance.request('topLongShortPositionRatio', 'fapiData', 'get', { symbol, period, limit: 1 });
  } catch (err) {
    console.error('Failed to fetch long short position data.', err);
    return null;
  }
  return res[0];
};

const fetchTopLongShortAccount = async (symbol, period) => {
  let res;
  try {
    res = await binance.request('topLongShortAccountRatio', 'fapiData', 'get', { symbol, period, limit: 1 });
  } catch (err) {
    console.error('Failed to fetch global long short account data.', err);
    return null;
  }
  return res[0];
};

const fetchGlobalLongShortAccount = async (symbol, period) => {
  let res;
  try {
    res = await binance.request('globalLongShortAccountRatio', 'fapiData', 'get', { symbol, period, limit: 1 });
  } catch (err) {
    console.error('Failed to fetch global long short account data.', err);
    return null;
  }
  return res[0];
};

const fetchDepth = async (symbol) => {
  return await binance.request('depth', 'public', 'get', { symbol, limit: 5 });
};

module.exports = {
  fetchSpotPrice,
  fetchFuturesPrice,
  fetchSpotLatest,
  fetchFuturesLatest,
  fetchLongShortPosition,
  fetchTopLongShortAccount,
  fetchGlobalLongShortAccount,
  fetchDepth,
};
