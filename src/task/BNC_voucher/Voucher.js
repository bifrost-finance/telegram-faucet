// import DataList from './bnc_users1.json';
import DataList from './bnc_users2.json';
import InputJson from '../../../config/account.json'
import config from '../../../config'
import Parameter from '../../../config/parameter.json';
import {
    ApiPromise,
    WsProvider,
    Keyring,
} from '@polkadot/api';

class Voucher {

    async run() {
        console.log("sending vouch");

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

        // await keyring.addFromJson(InputJson);
        const root_dot = await keyring.addFromUri(config.root_seed.sudo_seed);
        // await keyring.getPair(InputJson.address).decodePkcs8('111');


        let account = keyring.getPair(InputJson.address);
        // let account = keyring.getPair(config.root_seed.sudo_seed);
        // let account = keyring.getPair("//Alice");

        let all_addresses = []
        for (let i = 0; i < data.length; i++) {
            all_addresses.push(data[i].account);
        }
        
        let index = 0;
        // How many transactions to send out at once
        let tx_batch_size = 50;
        let pause_time = 6000;
        let passed = [];
        for (let i = 0; i < data.length; i++) {
            let address = data[i].account;
            let bnc_voucher = data[i].amount * 1000000000000;
            console.log('add', address);
            let current_balances = await api.query.voucher.balancesVoucher(address);

            console.log("all balance: " + current_balances + ", user: " + address);
            try {
                let nonce = parseInt(accountNonce) + parseInt(index);
                console.log("========", nonce)
                index += 1;
                // if (index % tx_batch_size == 0) {
                //     await sleep(pause_time);
                // }
                // const proposal = api.tx.balances.setBalance(address, bnc_voucher, 0);
                const proposal = api.tx.voucher.issueVoucher(address, bnc_voucher);

                await api.tx.sudo.sudo(proposal).signAndSend(account, {
                    nonce: nonce
                }, ({
                        events = [],
                        status
                    }) => {
                    if (status.isInBlock) {
                        console.log('Successful transfer of ' + nonce + ' with hash ' + status.asInBlock.toHex());
                        passed.push(address);
                    } else if (status.isFinalized){
                        passed.push(address);
                        console.log('Status of transfer: ' + status.type + 'current nonce: ' + nonce);
                    }

                    // while (true) {
                    //     if (status.isInBlock) { break; }
                    //     console.log('Status of transfer: ' + status + 'current nonce: ' + nonce);
                    // }
                    // console.log('Successful transfer of ' + 2 + ' with hash ' + status.asInBlock.toHex());

                    // events.forEach(({
                    //                     phase,
                    //                     event: {
                    //                         data,
                    //                         method,
                    //                         section
                    //                     }
                    //                 }) => {
                    //     console.log(phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
                    // });
                });
                // let after_sent = await api.query.voucher.balancesVoucher(address);
                // if (after_sent != current_balances + bnc_voucher) {
                //     console.log("you are failed: " + address + ", last balances: " + current_balances + ", going to send: " + bnc_voucher + ", after sent: " + after_sent);
                // }

            } catch (err) {
                console.log(err);
                accountNonce = JSON.parse((await api.query.system.account(InputJson.address)).toString()).nonce;
            }
        }
        console.log("finished");

        for (let i = 0; i < all_addresses.length; i++) {
            let all = await api.query.voucher.balancesVoucher(all_addresses[i]);
            console.log("all balance: " + all + ", user: " + all_addresses[i] + ", i: " + i);
            // for (let j = 0; j < passed.length; j++) {
            //     if (all_addresses[i] == passed[j]) {
            //         all_addresses.splice(i, 1);
            //     }
            // }
        }

        // console.log("unfinished: " + all_addresses);
        console.log("unfinished: " + all_addresses.length);

    }
}

const voucher = new Voucher();
voucher.run()