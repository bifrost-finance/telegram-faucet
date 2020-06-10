### Usage

1. Put csv file to current folder and rename it as **bnc_voucher**.
2. Execute the command, that will generate a json file named **bnc_users.json**
```
npx babel-node Excel_reader.js
```
3. Modify file config/account.json with signer public address.
```
{
    "address":"your_signer_address"
} 
```
4. Modify file config/development.js. Two sections you need to modify.
```
# server
server: {
    host: 'wss://n3.testnet.liebi.com/' # point to the node you want to submit bnc
}

# add sudo key
root_seed: {
    ...
    sudo_seed: '' # add sudo key here
}
```
5. Submit bnc to node.
```
npx babel-node Voucher.js
```

Tips:
1. Try it on local node, ensure it works.
2. Remember which address donesn't receive bnc, and try it again with new list that only contains fail addresses.