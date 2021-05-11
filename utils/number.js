function cutDecimalTail(num, precision) {
  return (Math.floor(num * Math.pow(10, precision)) / Math.pow(10, precision)).toFixed(precision);
}

module.exports = {
  cutDecimalTail,
};
