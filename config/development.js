const environments = {
  network: {
    mode: 'proxy', // direct or proxy
    proxy: {
      host: '127.0.0.1',
      port: 10808,
    },
  },
  telegram: {
    key: '',
    chatIds: [''],
  },
  redis: {
    host: '127.0.0.1',
    post: '6379',
    password: '',
    failure_time: 86400,
  },
  server: {
    host: 'wss://n3.testnet.liebi.com/',
  },
  root_seed: {
    seed_dot: '',
    seed_ksm: '',
    seed_asg: '',
    seed_ausd: '',
    sudo_seed: '',
  },
  asset: {
    dot: 2,
    eth: 4
  },
  seed_list: [
    '',
    ''
  ]
};

module.exports = environments;