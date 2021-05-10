# CryptoBot 部署文档

本文档将告诉你如何正确地部署`CryptoBot`。

## 1. 启动一个支持 OneBot 的主机

我们推荐使用[go-cqhttp](https://github.com/Mrs4s/go-cqhttp)，其他机器人主机未经测试，可能会出现未知问题。

`go-cqhttp`的配置请参考该项目的文档，我们推荐使用`正向WebSocket`而非`HTTP`，为了保证服务的安全，我们建议配置`访问密钥`。

## 2. 克隆仓库

随意找到一个文件夹，克隆本仓库。

```bash
git clone https://github.com/pwp-app/cryptobot.git -b main --depth 1
```

克隆完成之后请在克隆下来的项目目录下运行`npm install`安装依赖。

## 3. 配置

在项目目录下运行`./node_modules/.bin/koishi init`，初始化`Koishi`的配置，请参考`Koishi`的文档配置你的机器人。

如果你已经根据上文内容启用了`go-cqhttp`的`正向WebSocket`，设置了访问密钥，你可以参考下方的配置模板配置`Koishi`。

```javascript
// koishi.config.js
// 配置项文档：https://koishi.js.org/api/app.html
module.exports = {
  // Koishi 服务器监听的端口
  port: 8080,
  onebot: {
    secret: 'YOUR_GO_CQHTTP_SECRET',
  },
  bots: [
    {
      type: 'onebot:ws',
      // 对应 cqhttp 配置项 ws_config.port
      server: 'ws://127.0.0.1:6700',
      selfId: YOUR_BOT_QQ_NUMBER,
      token: 'YOUR_BOT_TOKEN',
    },
  ],
  plugins: {
    './plugins/priceChecker.js': {},
    './plugins/monitor.js': {},
    './plugins/star.js': {},
    './plugins/simTrade.js': {},
    './plugins/webshot.js': {},
    './plugins/disposeExit.js': {},
  },
};

```

在项目的根目录，你还需要手动创建一个名为`config.private.js`的文件，配置你的交易所API。

下方是该配置文件的模板：

```javascript
// config.private.js
module.exports = {
  apiKey: 'YOUR_BINANCE_API_KEY',
  secret: 'YOUR_BINANCE_API_SECRET',
  hApiKey: 'YOUR_HUOBI_PRO_API_KEY',
  hApiSecret: 'YOU_HUOBI_PRO_API_SECRET',
};

```

## 4. 启动

在完成上述配置之后，你可以使用`npm run start`启动Bot（对于开发者，请使用`npm run dev`）。

在此之前请确保你已经启动了`go-cqhttp`，对于Linux用户，你可以简单地使用`nohup`启动它。

如果你需要使用`pm2`，你可以直接使用`pm2 start`启动Bot。

## 5. 更新

如果你按照本文档克隆了本仓库，你可以在项目根目录执行`git pull`拉取项目的最新更改，并执行`npm install`安装新的依赖。

如果Git提示你的文件有更改过，存在冲突，无法拉取，你可以简单地通过`git stash`命令解决这个问题。

之后你只需要重启Bot即可（注：`go-cqhttp`不需要重启，除非你也需要更新它）
