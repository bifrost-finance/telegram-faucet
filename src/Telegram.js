import Logger from './utils/Logger';
import NodeCache from 'node-cache';
import TelegramBot from 'node-telegram-bot-api';
import jsonrpc from '@polkadot/types/interfaces/jsonrpc';
import { options } from '@bifrost-finance/api';
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { hexToU8a, isHex } from '@polkadot/util';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import pgPromise from 'pg-promise' ;
import BigNumber from 'bignumber.js';

class Telegram {

  static helpMessage () {
    return `The following commands are supported:
*!balance* - _Get the faucet's balance_.
*!drip <Address>* - _Send ${process.env.FAUCET_AMOUNT} BNCs to <Address>_.
*!top* _Query the top 30 who get the most rewards through the delegate of the collator test network_.
*!rank <Address>* - _Query the test BNC reward obtained by the corresponding address_.
*!help* - _Print this message_`;
  }

  static async start () {
    const logger = new Logger();
    await (await logger.setMsg(`[Started] liebi-telegram-faucet`).console().file());

    const pgp = pgPromise();
    const db = pgp({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    const CacheTTL = process.env.CACHE_TTL;
    const cacheClient = new NodeCache();
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {polling: true});
    const unit = Math.pow(10, 12);
    const amount = {
      bnc: process.env.FAUCET_AMOUNT
    }

    // load sender
    const keyring = new Keyring({type: 'sr25519'});
    await cryptoWaitReady();
    const sender = keyring.addFromUri(process.env.PRIVATE_KEY);

    // load api
    const wsProvider = new WsProvider(process.env.NODE_ENDPOINT);
    const api = await ApiPromise.create(options(
      {
        provider: wsProvider,
        rpc: jsonrpc
      }
    ));

    bot.onText(/^!help$/, async function onLoveText (msg) {
      await bot.sendMessage(msg.from.id, Telegram.helpMessage(), {parse_mode: 'Markdown'});
    });

    bot.onText(/^!balance$/, async function onLoveText (msg) {
      const { nonce, data: balance } = await api.query.system.account(sender.address);
      let message = `The faucet has ${balance.free / unit} BNCs remaining.`;
      await bot.sendMessage(msg.from.id, message, {parse_mode: 'Markdown'});
    });

    bot.onText(/^!drip/, async function onLoveText (msg) {
      // if (msg.chat.type !== 'supergroup') {
      //   await bot.sendMessage(msg.chat.id, 'Bifrost faucet bot don\'t support private chat, please send command in Bifrost Faucet Group');
      //   console.log('Bifrost faucet bot don\'t support private chat, please send command in Bifrost Faucet Group');
      //   return false;
      // }

      let data = msg.text;
      const get_str = data.slice(data.indexOf(' ') + 1);
      const targetAddress = get_str.replace(/^\s*/, '');

      // validate address
      try {
        keyring.encodeAddress(isHex(targetAddress)
          ? hexToU8a(targetAddress)
          : keyring.decodeAddress(targetAddress));
      } catch (error) {
        await bot.sendMessage(msg.from.id, Telegram.helpMessage(), {parse_mode: 'Markdown'});
        return;
      }

      const CacheId = `tg:${msg.from.id}`;
      const CacheAddress = `dripped:${targetAddress}`;
      try {
        if (cacheClient.has(CacheId)) {
          const message = `@${msg.from.username} has already dripped, you can only drip once in 12 hours`;
          await bot.sendMessage(msg.chat.id, message);
          return;
        }

        if (cacheClient.has(CacheAddress)) {
          const drippedMessage = `${targetAddress}\nhas already dripped, you can only drip once in 12 hours`;
          await bot.sendMessage(msg.chat.id, drippedMessage);
          return;
        }

        // make transactions
        const transactions = [
          // api.tx.currencies.transfer(targetAddress, { "Token": "DOT" }, amount.dot * unit),
          api.tx.currencies.transferNativeCurrency(targetAddress, amount.bnc * unit),
        ];
        let tx;
        if (transactions.length > 1) {
          tx = api.tx.utility.batch(transactions);
        } else {
          tx = transactions[0];
        }
        const txHash = await tx.signAndSend(sender);

        let message = `@${msg.from.username} Sent ${amount.bnc} BNCs\n`;
        // message += `Extrinsic hash: ${txHash.toHex()}\n`;
        message += `*ONLY FOR TESTING, OWNS NO VALUE*\n`;
        // message += `View on [SubScan](https://bifrost.subscan.io/extrinsic/ ${txHash.toHex()}`;
        await bot.sendMessage(msg.chat.id, message, {parse_mode: 'Markdown'});

        cacheClient.set(CacheId, 'true', CacheTTL)
        cacheClient.set(CacheAddress, 'true', CacheTTL)

        await logger.setMsg(`${targetAddress} => txHASH: ${txHash.toHex()}`).console().file();
      } catch (error) {
        await logger.setMsg(error).console().file();
        let message = `@${msg.from.username} Currently busy, please try again later!`;
        await bot.sendMessage(msg.chat.id, message);
      }
    });

    bot.onText(/^!rank/, async function onLoveText (msg) {
      const sums = await db.any('SELECT sum(balance) from parachain_staking_rewardeds');
      const sum = new BigNumber(sums[0].sum);
      const bnc_reward = new BigNumber(20000);

      let data = msg.text;
      const get_str = data.slice(data.indexOf(' ') + 1);
      const targetAddress = get_str.replace(/^\s*/, '');
      // validate address
      try {
        keyring.encodeAddress(isHex(targetAddress)
          ? hexToU8a(targetAddress)
          : keyring.decodeAddress(targetAddress));
      } catch (error) {
        await bot.sendMessage(msg.from.id, Telegram.helpMessage(), {parse_mode: 'Markdown'});
        return;
      }

      const account = await db.any('SELECT sum(balance) from parachain_staking_rewardeds where account = $1',targetAddress);
      let account_bnc = new BigNumber(account[0].sum).dividedBy(sum).multipliedBy(bnc_reward);
      account_bnc = account_bnc.isNaN() ? 0:account_bnc.toFixed(2);
      let message = `${targetAddress} has bnc reward: ${account_bnc} BNC.\n`;
      await bot.sendMessage(msg.chat.id, message);
    });

    bot.onText(/^!top$/, async function onLoveText (msg) {
      const sums = await db.any('SELECT sum(balance) from parachain_staking_rewardeds');
      const sum = new BigNumber(sums[0].sum);
      const bnc_reward = new BigNumber(20000);

      let message =
      `<pre>| account | bnc | percentage |\n| ------- | --- | ---------- |\n`;
      let results = await db.any('SELECT account,sum(balance) as bnc from parachain_staking_rewardeds GROUP by account ORDER BY bnc DESC LIMIT 30');
      results.forEach(value =>{
        let percentage = BigNumber(value.bnc).multipliedBy(100).dividedBy(sum).toFixed(2);
        value.percentage = percentage + '%';
        value.bnc=bnc_reward.multipliedBy(value.bnc).dividedBy(sum).toFixed(2);
        message = message + `| ${value.account}  | ${value.bnc} | ${value.percentage} |\n`
      })

      message = message+`</pre>`;
      await bot.sendMessage(msg.chat.id, message, {parse_mode: 'HTML'});
    });
  }
}

export default Telegram;
