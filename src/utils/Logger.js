import Telegram from '../Telegram'
import {getLogger, configure} from 'log4js'

configure({
    appenders: {
        everything: {type: 'file', filename: 'liebi-telegram-faucet'}
    },
    categories: {
        default: {appenders: ['everything'], level: 'all'}
    }
});
const logger = getLogger()

export default class Logger {
    constructor() {
        this.tg = new Telegram()
    }

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

    async telegram(enable = true) {
        if (enable) {
            await this.tg.sendGroupMessage(this.message)
        }
        return this
    }
}
