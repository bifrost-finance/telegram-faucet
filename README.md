# telegram-faucet 通过群指令获取 Bifrost 地址每日领取 Token
根据 Group 消息 Telegram Bot 获取 Bifrost 地址获取Token。

## 部署与运行
运行前先配置 .env 文件

1. 本地运行
```
yarn install
yarn start
```

2. 线上运行
```
yarn install
yarn prod
```

## 命令
```
The following commands are supported:
!balance - Get the faucet's balance.
!drip <Address> - Send BNC to <Address>.
!help - Print this message
```
