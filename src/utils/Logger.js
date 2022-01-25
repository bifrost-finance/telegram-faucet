import {getLogger, configure} from 'log4js'

configure({
    appenders: {
        everything: {type: 'file', filename: 'liebi-telegram-faucet.log'}
    },
    categories: {
        default: {appenders: ['everything'], level: 'all'}
    }
});
const logger = getLogger()

export default class Logger {
    constructor() {}

    setMsg(message) {
        this.message = `${message}`
        return this
    }

    console() {
        console.log(this.message)
        return this
    }

    file() {
        logger.info(this.message)
        return this
    }
}
