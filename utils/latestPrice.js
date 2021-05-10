class LatestPrice {
  constructor (opts) {
    const defaultOptions = {
      tick: 200,
    };
    const mergedOpts = Object.assign({}, defaultOptions, opts);
    const { fetchFn, tick } = mergedOpts;
    if (typeof fetchFn !== 'function') {
      throw new Error('fetchFn is not a functon.');
    }
    this.fetchFn = fetchFn;
    this.prices = {};
    this.tick = tick;
    this.interval = setInterval(async () => {
      const prices = await fetchFn();
      if (prices && Array.isArray(prices)) {
        for (let i = 0, len = prices.length; i < len; i++) {
          const parsedPrice = parseFloat(prices[i].price, 10);
          if (isNaN(parsedPrice)) {
            continue;
          }
          this.prices[prices[i].symbol.toLowerCase()] = parsedPrice;
        }
      }
    }, this.tick);
  }
  get(symbol) {
    return this.prices[symbol] || null;
  }
}

module.exports = LatestPrice;
