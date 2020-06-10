import Logger from './Logger'
import Util from './Util'
import * as Sentry from '@sentry/node'

const {DateTime, Interval} = require('luxon')


const TaskTimeLog = (type, enableTelegram = true) => {

    return (target, name, descriptor) => {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const startAt = DateTime.local()

            const ret = await method.apply(this, args);

            const endAt = DateTime.local()
            const i = Interval.fromDateTimes(startAt, endAt)
            const logger = new Logger()
            await logger.setMsg(`「${type}」总耗时 - ${i.length()} ms`).console().file().telegram(enableTelegram)

            return ret;
        }
    }
}

const TaskLog = (type, enableTelegram = true) => {
    const logger = new Logger()

    return (target, name, descriptor) => {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            await logger.setMsg(`「${type}」任务开始: ${name}(${args})`).console().file().telegram(enableTelegram)
            let ret;
            try {
                ret = await method.apply(this, args);
                await logger.setMsg(`「${type}」任务成功 : ${name}(${args})`).console().file().telegram(enableTelegram)
            } catch (e) {
                Sentry.captureException(e)
                const error = Util.formatError(e)
                await logger.setMsg(`「${type}」任务失败: ${name}(${args}) => ${error}`).console().file().telegram(enableTelegram)
            }
            return ret;
        }
    }
}

const MethodLog = (type, message) => {

    return (target, name, descriptor) => {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const logger = new Logger()
            await logger.setMsg(`「${type}」${message}`).console().file()

            return await method.apply(this, args);
        }
    }
}

export {
    TaskTimeLog,
    TaskLog,
    MethodLog,
}
