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
    return `\u{1F4DC} The following commands are supported:
*!balance* - _Get the faucet's balance_.
*!drip <Address>* - _Send ${process.env.FAUCET_AMOUNT} BNC to <Address>_.
*!top* - _Top 30 with the most delegate or collator rewards_.
*!rank <Address>* - _Rank and rewards obtained by <Address>_.
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

    const blacklist = "'c9eHvgbxTFzijvY3AnAKiRTHhi2hzS5SLCPzCkb4jP79MLu', 'fFjUFbokagaDRQUDzVhDcMZQaDwQvvha74RMZnyoSWNpiBQ', 'fBAbVJAsbWsKTedTVYGrBB3Usm6Vx635z1N9PX2tZ2boT37', 'e2s2dTSWe9kHebF2FCbPGbXftDT7fY5AMDfib3j86zSi3v7', \
    'eKTh3hnBLhBQWgiawDCjKZxLkhVJQ1h81og78EJLZrd3qzT', 'eocZB7kXvmy9JvuogD9dca9SKD84WdX5sgeG6yqEyFBArUJ', 'g7bJJiaWP4Wvzoe8FjkcfioUafhJcBxTDXRVBYh32NaBokw', \
    'fdCsyoMxbfz3UH9qRVBVnVBKAgEbJW22Y6xKbQ8t1i8Vp5u', 'fYXnD8KFa1cDA9EsgNmU2HiadFkbkScupJYtipQqk1c7Uft', 'fPhx4JSqwBxjt4ZAWLVNgN5FienAzbQjmgYzoXPtNYnfKav', \
    'gXNTa1XjwS4J4PsU1izyZ4b1mkdquFWo53c2y3y9mLDkq9U', 'dommmYS37BPtetRkRNvh8jf59dX5ifEEPgGAy4FDz9AuLog', 'eYSUYMraFTiQCCivJHtTCsiGv1M8ytxd7mkZ3SSQ2kG7aAN', \
    'cuVRDw9JXy6aswyXS7zb7iTfQVqFfxytUW42KuydAjnWuPx', 'h7gzM5XFVdHjMUGjxJ7CTHiksXTYGreu4445nWvm8HWv4Gp', 'gu19MAFrnWqipYfnDpMfJWqmCs6tj6z5ezsuzS9UKmFiQua', \
    'c4MyCbpbKBarQ1zdAXNPk7qYsaBcT2V8HyRskzEAJVofnhT', 'gcFS79GcKFGjcjHCqkZ4oGaxk9VkN3u9hU9ReeJb5J3KcKt', 'emEzHbtZbEWoTHGTHjsW9CccTyiS5xewq1svU9CkyMoskho', \
    'gCiibGsrpxUcMq49LCgDfGMyw65GEMebspUYa4jGp8KuojZ'";

    bot.onText(/^!help$/, async function onLoveText (msg) {
      await bot.sendMessage(msg.chat.id, Telegram.helpMessage(), {parse_mode: 'Markdown'});
    });

    bot.onText(/^!balance$/, async function onLoveText (msg) {
      const { nonce, data: balance } = await api.query.system.account(sender.address);
      let message = `\u{1F6B0} The faucet has ${balance.free / unit} BNC (testnet) remaining.`;
      await bot.sendMessage(msg.chat.id, message, {parse_mode: 'Markdown'});
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
        await bot.sendMessage(msg.chat.id, Telegram.helpMessage(), {parse_mode: 'Markdown'});
        return;
      }

      const CacheId = `tg:${msg.from.id}`;
      const CacheAddress = `dripped:${targetAddress}`;
      if (cacheClient.has(CacheId)) {
        const message = `\u{1F6B7} @${msg.from.username} has already dripped, you can only drip once in 12 hours.`;
        await bot.sendMessage(msg.chat.id, message);
        return;
      }

      if (cacheClient.has(CacheAddress)) {
        const drippedMessage = `\u{1F6B7} ${targetAddress} has already dripped, you can only drip once in 12 hours.`;
        await bot.sendMessage(msg.chat.id, drippedMessage);
        return;
      }

      cacheClient.set(CacheId, 'true', CacheTTL);
      cacheClient.set(CacheAddress, 'true', CacheTTL);

      try {
        // make transactions
        const transactions = [
          // api.tx.currencies.transfer(targetAddress, { "Token": "DOT" }, amount.dot * unit),
          api.tx.currencies.transferNativeCurrency(targetAddress, (new BigNumber(amount.bnc)).multipliedBy(unit).toString()),
        ];
        let tx;
        if (transactions.length > 1) {
          tx = api.tx.utility.batch(transactions);
        } else {
          tx = transactions[0];
        }
        const txHash = await tx.signAndSend(sender);

        let message = `\u{1F3AF} @${msg.from.username} sent ${amount.bnc} BNC, only for testing, owns no value.\n`;
        // message += `Extrinsic hash: ${txHash.toHex()}\n`;
        // message += `*ONLY FOR TESTING, OWNS NO VALUE*\n`;
        // message += `View on [SubScan](https://bifrost.subscan.io/extrinsic/ ${txHash.toHex()}`;
        await bot.sendMessage(msg.chat.id, message, {parse_mode: 'Markdown'});

        await logger.setMsg(`${targetAddress} => txHASH: ${txHash.toHex()}`).console().file();
      } catch (error) {
        await logger.setMsg(error).console().file();
        let message = `@${msg.from.username} Currently busy, please try again later!`;
        await bot.sendMessage(msg.chat.id, message);
      }
    });

    bot.onText(/^!rank/, async function onLoveText (msg) {
      const sums = await db.any("SELECT sum(balance) from parachain_staking_rewardeds where account NOT IN (" + blacklist + ")");
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
        await bot.sendMessage(msg.chat.id, Telegram.helpMessage(), {parse_mode: 'Markdown'});
        return;
      }

      const account = await db.any("select * from (SELECT account,sum(balance),rank() over(order by SUM(balance) desc) from parachain_staking_rewardeds where account NOT IN (" + blacklist + ") GROUP by account) t where t.account= $1",targetAddress);
      let account_bnc = new BigNumber(account[0].sum).dividedBy(sum).multipliedBy(bnc_reward);
      account_bnc = account_bnc.isNaN() ? 0:account_bnc.toFixed(2);
      let message = `\u{1F3AF} Ranking: ${account[0].rank}\n\u{1F505} Rewards (est.): ${account_bnc} BNC\n\u{1F334} Address: ${targetAddress}`
      // let message = `${targetAddress}:\nBNC reward: ${account_bnc} BNC\nCurrent ranking: ${account[0].rank}`;
      await bot.sendMessage(msg.chat.id, message);
    });

    bot.onText(/^!top$/, async function onLoveText (msg) {
      const sums = await db.any("SELECT sum(balance) from parachain_staking_rewardeds where account NOT IN (" + blacklist + ")");
      const sum = new BigNumber(sums[0].sum);
      const bnc_reward = new BigNumber(20000);

      let message =
      `<pre>\u{1F505} Top 30 List\n`;
      let results = await db.any("SELECT account,sum(balance) as bnc from parachain_staking_rewardeds where account NOT IN (" + blacklist + ") GROUP by account ORDER BY bnc DESC LIMIT 30");
      results.forEach(value =>{
        let percentage = BigNumber(value.bnc).multipliedBy(100).dividedBy(sum).toFixed(2);
        value.percentage = percentage + '%';
        value.bnc=bnc_reward.multipliedBy(value.bnc).dividedBy(sum).toFixed(2);
        message = message + `${value.account} / ${value.percentage} / ${value.bnc} BNC\n`
      })

      message = message+`</pre>`;
      await bot.sendMessage(msg.chat.id, message, {parse_mode: 'HTML'});
    });
  }
}

export default Telegram;
