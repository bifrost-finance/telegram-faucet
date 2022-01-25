import Telegram from './src/Telegram';
import 'dotenv/config';

(async () => {
  await Telegram.start()
})()
