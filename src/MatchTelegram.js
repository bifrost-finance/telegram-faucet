import Agent from 'socks5-https-client/lib/Agent';
import config from '../config'
import Logger from './utils/Logger'
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
    isHex
} from '@polkadot/util'

class MatchTelegram {

    static async start() {

        const logger = new Logger()
        let msg = `[Started] liebi-telegram-faucet, Running environment：${process.env.NODE_ENV}`
        await (await logger.setMsg(msg).console().file())

        const host = config.redis.host;
        const post = config.redis.post;
        const password = config.redis.password;
        const opts = {
            auth_pass: password,
        }
        const failure_time = config.redis.failure_time;
        const client = redis.createClient(post, host, opts);

        client.on('error', function (error) {
            console.log(error);
        });

        const token = config.telegram.key;

        const bot = new TelegramBot(token, {
            polling: true,
            request: {
                agentClass: Agent,
                agentOptions: {
                    socksHost: config.network.proxy.host,
                    socksPort: config.network.proxy.port
                }
            }
        });

        const AssetSymbol = {
            DOT: 0,
            KSM: 1,
            EOS: 2,
        }

        const parameter = Parameter;
        bot.onText(/\/want/, async function onLoveText(msg) {
            let data = msg.text;
            let get_str = data.slice(data.indexOf(' ') + 1);
            let key = get_str.replace(/^\s*/, '');
            console.log(key);
            client.select("15");
            const server_host = config.server.host;

            const keyring = new Keyring({
                type: 'sr25519'
            });

            const root_seed_dot = config.root_seed.seed_dot;
            const root_dot = keyring.addFromUri(root_seed_dot);
            const root_seed_ksm = config.root_seed.seed_ksm;
            const root_ksm = keyring.addFromUri(root_seed_ksm);
            const root_seed_ausd = config.root_seed.seed_ausd;
            const root_ausd = keyring.addFromUri(root_seed_ausd);
            const root_seed_asg = config.root_seed.seed_asg;
            const root_asg = keyring.addFromUri(root_seed_asg);
            const amount = 10 * 1000000000000;
            const amount_asg = 5 * 1000000000000;
            const amount_ausd = 100 * 1000000000000;

            let flag = true;
            try {
                let address = await keyring.encodeAddress(isHex(key) ? hexToU8a(value) : keyring.decodeAddress(key));
            } catch (error) {
                flag = false;
            }

            if (flag == true) {
                try {
                    await client.exists(key, async function (error, reply) {
                        if (reply === 1) {
                            await bot.sendMessage(msg.chat.id, key + "\nhave already dripped, you can only drip once in 24 hours");
                            console.log('exists')
                        } else {
                            await client.set(key, JSON.stringify({
                                type: 1
                            }), async function (error, res) {
                                if (error) {
                                    console.log(error);
                                } else {
                                    await client.expire(key, failure_time)
                                    const wsProvider = new WsProvider(server_host);
                                    const api = await ApiPromise.create({
                                        provider: wsProvider,
                                        types: parameter
                                    });
                                    const dot_address = await api.tx.assets.transfer("DOT", key, amount).signAndSend(root_dot);
                                    const ksm_address = await api.tx.assets.transfer("KSM", key, amount).signAndSend(root_ksm);
                                    const ausd_address = await api.tx.assets.transfer("aUSD", key, amount_ausd).signAndSend(root_ausd);
                                    const asg_address = await api.tx.balances.transfer(key, amount_asg).signAndSend(root_asg);
                                    await bot.sendMessage("Registration address successful: " + msg.chat.id,key + "\n" + "has issued 10 DOT / 10 KSM / 5 ASG / 100 aUSD in Bifrost for test, check it out at https://dash.bifrost.finance");
                                    let message = key + ": DOT sent successfully" + dot_address + "," + "  " + "KSM sent successfully" + ksm_address + " " + "aUSD sent successfully" + ausd_address + "  " + "ASG sent successfully" + asg_address;
                                    await logger.setMsg(message).console().file();
                                }
                            })
                        }
                    })
                } catch (error) {
                    console.log(error)
                }
            } else {
                await bot.sendMessage(msg.chat.id, "You can send /want + BIFROST_ADDRESS to get 10 KSM / 10 DOT / 5 ASG in Bifrost for test (OWNS NO VALUE)");
            }
        })
    }
}

export default MatchTelegram