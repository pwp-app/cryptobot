const { ONE_MIN } = require('../constants/time');

class RateLimiter {
  constructor(opts) {
    const defaultOptions = {
      weightsPerMin: 500,
      defaultCost: 1,
    };
    const mergedOpts = Object.assign({}, defaultOptions, opts);
    const { weightsPerMin, defaultCost } = mergedOpts;
    this.weightsPerMin = weightsPerMin;
    this.remainWeights = weightsPerMin;
    this.defaultCost = defaultCost;
    this.lastRefresh = Date.now();
    this.checker = () => {
      setTimeout(() => {
        const now = Date.now();
        if (now - this.lastRefresh >= ONE_MIN) {
          this.remainWeights = weightsPerMin;
          this.lastRefresh = now;
        }
        this.checker();
      }, 500);
    };
    // start check limits
    this.checker();
  }
  throttle({ requestFn, cost, thisArg }) {
    return async (...args) => {
      const realCost = cost || this.defaultCost;
      if (realCost > this.remainWeights) {
        throw new Error('Out of limit, the request will be dropped.');
      }
      this.remainWeights -= realCost;
      return await requestFn.call(thisArg, ...args);
    };
  }
}

module.exports = RateLimiter;
