const getSymbol = (coin) => {
  let coinName = coin.toLowerCase();
  let symbol = coin;
  if (symbol.includes('/')) {
    coinName = symbol.split('/')[0];
    symbol = symbol.replace('/', '');
  } else {
    symbol = `${coin}usdt`;
  }
  return { coinName, symbol };
};

module.exports = {
  getSymbol,
};
