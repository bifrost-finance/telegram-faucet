import Agent from 'socks5-https-client/lib/Agent';
import config from '../config';
import Logger from './utils/Logger';
import parameter from '../config/parameter.json';
import redis from 'redis';
import TelegramBot from 'node-telegram-bot-api';
import {
  ApiPromise,
  WsProvider,
  Keyring,
} from '@polkadot/api';
import {
  hexToU8a,
  isHex,
} from '@polkadot/util';
import { cryptoWaitReady, schnorrkelDerivePublic } from '@polkadot/util-crypto';

class MatchTelegram {
  static async start() {
    const logger = new Logger();
    let msg = `[Started] liebi-telegram-faucet, Running environment：${process.env.NODE_ENV}`;
    await (await logger.setMsg(msg).console().file());

    const host = config.redis.host;
    const post = config.redis.post;
    const password = config.redis.password;
    const opts = {
      auth_pass: password,
    };

    const failureTime = config.redis.failure_time;
    const client = redis.createClient(post, host, opts);

    client.on('error', function (error) {
      console.log(error);
    });
    client.select('15');
    await client.del('private_key_list');
    for (let seed of config.seed_list) {
      await client.rpush('private_key_list', seed);
    }

    const token = config.telegram.key;

    const bot = new TelegramBot(token, {
      polling: true,
      request: {
        agentClass: Agent,
        agentOptions: {
          socksHost: config.network.proxy.host,
          socksPort: config.network.proxy.port,
        },
      },
    });

    function sleep(time) {
      return new Promise((resolve) => setTimeout(resolve, time));
    }

    bot.onText(/\/drop/, async function onLoveText(msg) {
      // if (msg.chat.type !== 'supergroup') {
      //   await bot.sendMessage(msg.chat.id, 'Bifrost faucet bot don\'t support private chat, please send command in Bifrost Faucet Group');

      //   console.log('Bifrost faucet bot don\'t support private chat, please send command in Bifrost Faucet Group');

      //   return false;
      // }

      let data = msg.text;
      let get_str = data.slice(data.indexOf(' ') + 1);
      let targetAddress = get_str.replace(/^\s*/, '');
      console.log(targetAddress);
      client.select('15');

      const hostResources = [
        config.server.host,
        config.server.host
      ];

      let residue = new Date().getMinutes() % 2;
      let serverHost = hostResources[residue];

      const keyring = new Keyring({
        type: 'sr25519',
      });

      await cryptoWaitReady();

      // const seed = {
      //   dot: keyring.addFromUri(config.root_seed.seed_dot),
      //   ksm: keyring.addFromUri(config.root_seed.seed_ksm),
      //   ausd: keyring.addFromUri(config.root_seed.seed_ausd),
      //   asg: keyring.addFromUri(config.root_seed.seed_asg),
      // };

      const unit = 1000000000000;

      const amount = {
        dot: 100,
        ksm: 20,
        eth: 10,
        ausd: 10000,
        asg: 500,
      };

      let flag = true;
      try {
        await keyring.encodeAddress(isHex(targetAddress)
          ? hexToU8a(targetAddress)
          : keyring.decodeAddress(targetAddress));
      } catch (error) {
        flag = false;
      }

      if (flag) {
        try {
          await client.exists("tg:" + msg.from.id, async function (error, reply) {
            console.log(`tg:${msg.from.id} => reply: ${reply}`);
            if (reply === 1) {
              let message = '@' + msg.from.username + ' you can only drip once in 24 hours';
              await bot.sendMessage(msg.chat.id, message);
            } else {
              await client.exists("dripped:" + targetAddress, async function (error, reply) {
                if (reply === 1) {
                  let drippedMessage = targetAddress + '\n';
                  drippedMessage += 'has already dripped, you can only drip once in 24 hours';
                  await bot.sendMessage(msg.chat.id, drippedMessage);
                  console.log(targetAddress + ' have already dripped!');
                } else {
                  await client.set("matched:" + targetAddress, 1);

                  const promiseLpop = (key) =>
                    new Promise((resolve, reject) => {
                      client.lpop(key, (error, data) => {
                        error ? reject(error) : resolve(data);
                      });
                    });

                  const promiseSismember = (key, targetAddress) =>
                    new Promise((resolve, reject) => {
                      client.sismember(key, targetAddress, (error, data) => {
                        error ? reject(error) : resolve(data);
                      });
                    });

                  const ifWhitelist = await promiseSismember('whitelist', targetAddress);  // 是否在白名单中

                  const wsProvider = new WsProvider(serverHost);
                  const api = await ApiPromise.create({
                    provider: wsProvider,
                    types: parameter,
                  });

                  // const systemAccountFree = (key) =>
                  //   new Promise((resolve, reject) => {
                  //     api.query.system.account(key, (account_info) => {
                  //       const { data: balance } = account_info;
                  //       // console.log(`The balances are ${balance.free}`);
                  //       resolve(`${balance.free}`);
                  //     });
                  //   });
                  // const balance = await systemAccountFree(targetAddress).catch(e => { console.log(e) });
                  // if (balance / Math.pow(10, 12) < 100 && ifWhitelist == 0) {  // 不足100个BNC且没在白名单里
                  //   let message = '@' + msg.from.username + ' Sorry, your address balance is insufficient, only more than 100 BNC address can request test tokens.';
                  //   await bot.sendMessage(msg.chat.id, message);
                  //   return;
                  // }

                  const transcation = [
                    api.tx.currencies.transfer(targetAddress, { "Token": "DOT" }, amount.dot * unit),
                    api.tx.currencies.transfer(targetAddress, { "Token": "KSM" }, amount.ksm * unit),
                    api.tx.currencies.transfer(targetAddress, { "Token": "ETH" }, amount.eth * unit),
                    api.tx.currencies.transfer(targetAddress, { "Token": "aUSD" }, (amount.ausd * unit).toString()),
                    api.tx.currencies.transfer(targetAddress, { "Token": "ASG" }, amount.asg * unit),
                  ];
                  const privateKey = await promiseLpop('private_key_list');
                  if (privateKey == null) {  // redis中私钥被取光
                    let message = '@' + msg.from.username + ' Currently busy, please try again later!';
                    await bot.sendMessage(msg.chat.id, message);
                    return;
                  }

                  const batchHash = await api.tx.utility
                    .batch(transcation)
                    .signAndSend(keyring.addFromUri(privateKey))
                    .catch(async function (reason) { });

                  if (batchHash) {
                    await client.rpush('private_key_list', privateKey);
                  } else {
                    let message = '@' + msg.from.username + ' Currently busy, please try again later!';
                    await bot.sendMessage(msg.chat.id, message);
                    sleep(3000);  // 等三秒，视情况可作修改
                    await client.lpush('private_key_list', privateKey);
                    return;
                  }

                  // let message = '🥳 Registration address successful! \n\n';
                  // message += targetAddress + ' has received: \n';
                  // message += amount.dot + ' DOT      ' + amount.eth + ' ETH\n\n';
                  // message += 'Explorer: https://bifrost.subscan.io\nUse them in https://dash.bifrost.finance for test (OWNS NO VALUE)';

                  let message = '@' + msg.from.username + ' Sent ' + targetAddress + ' {"DOT":100, "KSM":20, "ETH":10, "aUSD":10000, "ASG":500}. \n'
                  message += ' Extrinsic hash:  ' + batchHash.toHex() + '\n';
                  message += 'View on [SubScan](https://bifrost.subscan.io/extrinsic/' + batchHash.toHex();
                  await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

                  let log = targetAddress + '\n';
                  log += "HOST: " + serverHost + '\n';
                  log += "txHASH: " + batchHash.toHex();
                  // log += "ASG: " + transcation.asg.toString() + "\n";
                  // log += "aUSD: " + transcation.ausd.toString() + "\n";
                  // log += "DOT: " + transcation.dot.toString() + "\n";
                  // log += "KSM: " + transcation.ksm.toString() + "\n";

                  await client.set("dripped:" + targetAddress, JSON.stringify({ type: 1 }))
                  await client.expire("dripped:" + targetAddress, failureTime);

                  await client.set("tg:" + msg.from.id, JSON.stringify({ type: 1 }))
                  await client.expire("tg:" + msg.from.id, failureTime);

                  await logger.setMsg(log).console().file();
                }
              });
            }
          });

        }
        catch (error) {
          console.log(error);
        }
      }
      else {
        await bot.sendMessage(msg.chat.id, 'You can send /want + BIFROST_ADDRESS to get some token in Bifrost for test (OWNS NO VALUE)');
      }
    });
  }
}

export default MatchTelegram;
