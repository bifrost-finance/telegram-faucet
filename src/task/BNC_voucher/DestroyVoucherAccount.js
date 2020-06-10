import DataList from './bnc_users1.json';
import InputJson from '../../../config/account.json'
import config from '../../../config'
import Parameter from '../../../config/parameter.json';
import {
    ApiPromise,
    WsProvider,
    Keyring,
} from '@polkadot/api';

class DestroyVoucherAccount {

    async run() {

        let data = []

        for (let i = 0; i < DataList.length; i++) {
            data.push(DataList[i])
        }

        if (data.length > 0) {
            await this.sendBNCVoucher(data);
        }

    }

    async sendBNCVoucher(data) {

        const parameter = Parameter;
        const keyring = new Keyring({
            type: 'sr25519'
        });

        const server_host = config.server.host;
        const wsProvider = new WsProvider(server_host);
        const api = await ApiPromise.create({
            provider: wsProvider,
            types: parameter
        });

        let accountNonce = await api.query.system.account(InputJson.address);
        accountNonce = JSON.parse(accountNonce.toString()).nonce;
        console.log(accountNonce);

        await keyring.addFromJson(InputJson);
        await keyring.getPair(InputJson.address).decodePkcs8('111');
        let account = keyring.getPair(InputJson.address);
        let index = 0;
        // How many transactions to send out at once
        let tx_batch_size = 50;
        let pause_time = 6000;
        for (let i = 0; i < data.length; i++) {
            let address = data[i].account;
            let bnc_voucher = data[i].amount * 1000000000000;
            console.log('add', address);
            try {
                let nonce = parseInt(accountNonce) + parseInt(index);
                console.log("========", nonce)
                index += 1;
                if (index % tx_batch_size == 0) {
                    await sleep(pause_time);
                }
                // const proposal = api.tx.balances.setBalance(address, bnc_voucher, 0);
                const proposal = api.tx.voucher.destroyVoucher(address, bnc_voucher);

                await api.tx.sudo.sudo(proposal).signAndSend(account, {
                    nonce: nonce
                }, ({
                        events = [],
                        status
                    }) => {
                    if (status.isInBlock) {
                        console.log('Successful transfer of ' + 2 + ' with hash ' + status.asInBlock.toHex());
                    } else {
                        console.log('Status of transfer: ' + status.type);
                    }

                    events.forEach(({
                                        phase,
                                        event: {
                                            data,
                                            method,
                                            section
                                        }
                                    }) => {
                        console.log(phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
                    });
                });

            } catch (err) {
                console.log(err);
                accountNonce = JSON.parse((await api.query.system.account(InputJson.address)).toString()).nonce;
            }
        }


    }
}

const dest = new DestroyVoucherAccount();
dest.run()