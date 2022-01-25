import Logger from './utils/Logger';
import NodeCache from 'node-cache';
import TelegramBot from 'node-telegram-bot-api';
import jsonrpc from '@polkadot/types/interfaces/jsonrpc';
import { options } from '@bifrost-finance/api';
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { hexToU8a, isHex } from '@polkadot/util';
import { cryptoWaitReady } from '@polkadot/util-crypto';

class MatchTelegram {
  static async start () {
    const logger = new Logger();
    await (await logger.setMsg(
      `[Started] liebi-telegram-faucet, Running environment：${process.env.NODE_ENV}`
    ).console().file());

    const CacheTTL = process.env.CACHE_TTL;
    const cacheClient = new NodeCache();
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {polling: true});

    bot.onText(/^!drip/, async function onLoveText (msg) {
      // if (msg.chat.type !== 'supergroup') {
      //   await bot.sendMessage(msg.chat.id, 'Bifrost faucet bot don\'t support private chat, please send command in Bifrost Faucet Group');
      //   console.log('Bifrost faucet bot don\'t support private chat, please send command in Bifrost Faucet Group');
      //   return false;
      // }

      let data = msg.text;
      const get_str = data.slice(data.indexOf(' ') + 1);
      const targetAddress = get_str.replace(/^\s*/, '');
      const unit = Math.pow(10, 12);
      const amount = {
        bnc: 500,
      };

      const keyring = new Keyring({type: 'sr25519'});
      await cryptoWaitReady();

      // validate address
      try {
        keyring.encodeAddress(isHex(targetAddress)
          ? hexToU8a(targetAddress)
          : keyring.decodeAddress(targetAddress));
      } catch (error) {
        const message = `Send *!drip ADDRESS* to get ${amount.bnc} BNC from Bifrost for testing \n*OWNS NO VALUE*`;
        await logger.setMsg(message).console().file();
        await bot.sendMessage(msg.from.id, message, {parse_mode: 'Markdown'});
        return;
      }

      const CacheId = `tg:${msg.from.id}`;
      const CacheAddress = `dripped:${targetAddress}`;
      try {
        if (cacheClient.has(CacheId)) {
          const message = `@${msg.from.username} has already dripped, you can only drip once in 24 hours`;
          await bot.sendMessage(msg.chat.id, message);
          return;
        }

        if (cacheClient.has(CacheAddress)) {
          const drippedMessage = `${targetAddress}\nhas already dripped, you can only drip once in 24 hours`;
          await bot.sendMessage(msg.chat.id, drippedMessage);
          return;
        }

        const wsProvider = new WsProvider(process.env.NODE_ENDPOINT);
        const api = await ApiPromise.create(options(
          {
            provider: wsProvider,
            rpc: jsonrpc
          }
        ));
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
        const txHash = await tx.signAndSend(keyring.addFromUri(process.env.PRIVATE_KEY));

        let message = `@${msg.from.username} Sent ${amount.bnc} BNC\n`;
        // message += `Extrinsic hash: ${txHash.toHex()}\n`;
        message += `*ONLY FOR TESTING, OWNS NO VALUE*\n`;
        // message += `View on [SubScan](https://bifrost.subscan.io/extrinsic/ ${txHash.toHex()}`;
        await bot.sendMessage(msg.chat.id, message, {parse_mode: 'Markdown'});

        cacheClient.set(CacheId, 'true', CacheTTL)
        cacheClient.set(CacheAddress, 'true', CacheTTL)

        await logger.setMsg(`${targetAddress} => txHASH: ${txHash.toHex()}`).console().file();
      } catch (error) {
        let message = `@${msg.from.username} Currently busy, please try again later!`;
        await bot.sendMessage(msg.chat.id, message);
      }
    });
  }
}

export default MatchTelegram;
