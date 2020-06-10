const config = require('../config')
const Network = require('./Network')

class Telegram {

    async sendGroupMessage(message) {
        const chatIds = config.telegram.chatIds
        for (const chatId of chatIds) {
            await this.sendMessage(chatId, encodeURI(message))
        }
    }

    async sendMessage(chatId, message) {
        try {
            const key = config.telegram.key
            const url = `https://api.telegram.org/bot${key}/sendMessage?chat_id=${chatId}&text=${message}`
            const network = new Network()
            await network.get(url)
        } catch (e) {
            console.log('sendMessage', e)
        }
    }
}

module.exports = Telegram
