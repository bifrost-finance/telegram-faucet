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
import {cryptoWaitReady} from '@polkadot/util-crypto';

class MatchTelegram {
  static async start() {
    const logger = new Logger();
    let msg = `[Started] liebi-telegram-faucet, Running environment：${process.env.NODE_ENV}`;
    await ( await logger.setMsg(msg).console().file() );

    const host = config.redis.host;
    const post = config.redis.post;
    const password = config.redis.password;
    const opts = {
      auth_pass: password,
    };

    const failureTime = config.redis.failure_time;
    const client = redis.createClient(post, host, opts);

    client.on('error', function(error) {
      console.log(error);
    });

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

    bot.onText(/\/want/, async function onLoveText(msg) {
      let data = msg.text;
      let get_str = data.slice(data.indexOf(' ') + 1);
      let targetAddress = get_str.replace(/^\s*/, '');
      console.log(targetAddress);
      client.select('15');

      const hostResources = [
          'wss://n1.testnet.liebi.com/',
          'wss://n2.testnet.liebi.com/',
          'wss://n3.testnet.liebi.com/'
      ];

      let residue = new Date().getMinutes() % 3;
      let serverHost = hostResources[residue];

      const keyring = new Keyring({
        type: 'sr25519',
      });

      await cryptoWaitReady();

      const seed = {
        dot: keyring.addFromUri(config.root_seed.seed_dot),
        ksm: keyring.addFromUri(config.root_seed.seed_ksm),
        ausd: keyring.addFromUri(config.root_seed.seed_ausd),
        asg: keyring.addFromUri(config.root_seed.seed_asg),
      };

      const unit = 1000000000000;

      const amount = {
        dot: 10,
        ksm: 10,
        ausd: 100,
        asg: 20,
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
          await client.exists("dripped:" + targetAddress, async function(error, reply) {
            if (reply === 1) {
              let drippedMessage = targetAddress + '\n';
              drippedMessage += 'has already dripped, you can only drip once in 24 hours';
              await bot.sendMessage(msg.chat.id, drippedMessage);
              console.log(targetAddress + ' have already dripped!');
            } else {
              await client.set("matched:" + targetAddress, 1);

              const wsProvider = new WsProvider(serverHost);
              const api = await ApiPromise.create({
                provider: wsProvider,
                types: parameter,
              });

              const transcation = {
                asg: await api.tx.balances.transfer(targetAddress, amount.asg * unit).signAndSend(seed.asg),
                ausd: await api.tx.assets.transfer('aUSD', targetAddress, amount.ausd * unit).signAndSend(seed.ausd),
                // dot: await api.tx.assets.transfer('DOT', targetAddress, amount.dot * unit).signAndSend(seed.dot),
                // ksm: await api.tx.assets.transfer('KSM', targetAddress, amount.ksm * unit).signAndSend(seed.ksm),
              };

              let message = '🥳 Registration address successful! \n\n';
              message += targetAddress + ' has received: \n';
              message += amount.asg + ' ASG      ' + amount.ausd + ' aUSD\n\n';
              // message += amount.dot + ' DOT      ' + amount.ksm + ' KSM\n\n';
              message += 'Explorer: https://bifrost.subscan.io\nUse them in https://dash.bifrost.finance for test (OWNS NO VALUE)';

              await bot.sendMessage(msg.chat.id, message);

              let log = targetAddress + '\n';
              log += "HOST: " + serverHost + '\n';
              log += "ASG: " + transcation.asg.toString() + "\n";
              log += "aUSD: " + transcation.ausd.toString() + "\n";
              // log += "DOT: " + transcation.dot.toString() + "\n";
              // log += "KSM: " + transcation.ksm.toString() + "\n";

              await client.set("dripped:" + targetAddress, JSON.stringify({type: 1}))
              await client.expire("dripped:" + targetAddress, failureTime);

              await logger.setMsg(log).console().file();
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