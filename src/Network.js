const urllib = require('url');
const https = require('https');
const SocksProxyAgent = require('socks-proxy-agent');
const axios = require('axios')
const config = require('../config')

class Network {

    async get(url) {
        const {network} = config
        const {mode, proxy} = network
        if (mode === 'proxy') {
            const {host: proxyHost, port: proxyPort} = proxy
            const proxyConfig = `socks://${proxyHost}:${proxyPort}`
            const agent = new SocksProxyAgent(proxyConfig, true);
            let opts = urllib.parse(url);
            opts.agent = agent;
            https.get(opts, (res) => {
                // console.log(res)
            }).on("error", (err) => {
                console.log("Https Error: " + err.message);
            });
        } else if (mode === 'direct') {
            let response = await axios.get(url)
            // console.log(response)
        }
    }
}

module.exports = Network
