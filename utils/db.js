const levelup = require('levelup');
const leveldown = require('leveldown');
const levelatomic = require('@backrunner/levelatomic');
const path = require('path');
const fs = require('fs');

const storagePath = path.resolve(__dirname, '../storage');

if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}

const db = levelatomic(levelup(leveldown(storagePath)));

module.exports = db;
