import Agent from 'socks5-https-client/lib/Agent';
import config from '../config';
import Logger from './utils/Logger';
import Parameter from '../config/parameter.json';
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

    const parameter = Parameter;
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
      const serverHost = config.server.host;

      const keyring = new Keyring({
        type: 'sr25519',
      });

      const seed = {
        dot: config.root_seed.seed_dot,
        ksm: config.root_seed.seed_ksm,
        ausd: config.root_seed.seed_ausd,
        asg: config.root_seed.seed_asg,
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
        let address = await keyring.encodeAddress(isHex(targetAddress)
            ? hexToU8a(targetAddress)
            : keyring.decodeAddress(targetAddress));
      }
      catch (error) {
        flag = false;
      }

      if (flag) {
        try {
          await client.exists(targetAddress, async function(error, reply) {
            if (reply === 1) {
              await bot.sendMessage(msg.chat.id, targetAddress + '\nhave already dripped, you can only drip once in 24 hours');
              console.log(targetAddress + ' is exists');
            }
            else {
              await client.set(targetAddress, JSON.stringify({
                type: 1,
              }), async function(error, res) {
                if (error) {
                  console.log(error);
                }
                else {
                  await client.expire(targetAddress, failureTime);
                  const wsProvider = new WsProvider(serverHost);
                  const api = await ApiPromise.create({
                    provider: wsProvider,
                    types: parameter,
                  });

                  const transcation = {
                    asg: await api.tx.balances.transfer(targetAddress, amount.asg * unit).signAndSend(seed.asg),
                    dot: await api.tx.assets.transfer('DOT', targetAddress, amount.dot * unit).signAndSend(seed.dot),
                    ksm: await api.tx.assets.transfer('DOT', targetAddress, amount.ksm * unit).signAndSend(seed.ksm),
                    ausd: await api.tx.assets.transfer('DOT', targetAddress, amount.ausd * unit).signAndSend(seed.ausd)
                  }

                  let message = "🥳 Registration address successful! \n\n";
                  message += targetAddress + " has received\n";
                  message += amount.asg + " ASG      " + amount.ausd + " aUSD\n";
                  message += amount.dot + " DOT      " + amount.ksm + " KSM\n";
                  message += "These token just for test, OWNS NO VALUE, usd it in https://dash.bifrost.finance";

                  await bot.sendMessage(msg.chat.id, message);

                  let log = targetAddress + transcation.toString();
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