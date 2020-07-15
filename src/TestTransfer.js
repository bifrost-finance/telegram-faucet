import {
  ApiPromise,
  WsProvider,
  Keyring,
} from '@polkadot/api';


import { cryptoWaitReady } from '@polkadot/util-crypto';
import parameter from '../config/parameter.json';
import config from '../config';

class TestTransfer {
  static async start() {
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

    const wsProvider = new WsProvider('wss://n1.testnet.liebi.com/');

    const api = await ApiPromise.create({
      provider: wsProvider,
      types: parameter,
    });

    let targetAddress = '5CSpDMTeczUJoZ14BuoJTAXJzF2FnWj7gwAsfredQKdvzkGL';

    const transcation = {
      asg: await api.tx.balances.transfer(targetAddress, amount.asg * unit).signAndSend(seed.asg),
      dot: await api.tx.assets.transfer('DOT', targetAddress, amount.dot * unit).signAndSend(seed.dot),
      ksm: await api.tx.assets.transfer('KSM', targetAddress, amount.ksm * unit).signAndSend(seed.ksm),
      ausd: await api.tx.assets.transfer('aUSD', targetAddress, amount.ausd * unit).signAndSend(seed.ausd),
    };

    console.log(transcation.ausd.toString());
  }
}

(async () => {
  await TestTransfer.start()
})();