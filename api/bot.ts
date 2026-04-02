import TelegramBot from 'node-telegram-bot-api'

const bot = new TelegramBot(
  "8628106169:AAG7H3P4qA2ITT2APBhmo_JC70_5lk_m4rY",
  { polling: true }
)

bot.on('message', async (msg) => {
  const text = msg.text || ''
  const chatId = msg.chat.id

  try {
    // show typing (like ChatGPT)
    await bot.sendChatAction(chatId, 'typing')

    // save message automatically
    await fetch('http://localhost:3000/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  text,
  userId: chatId
})
    })

    // ask AI automatically
    const res = await fetch('http://localhost:3000/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  question: text,
  userId: chatId
})
    })

    const data = await res.json()

    bot.sendMessage(chatId, data.answer || 'I don’t know')

  } catch (err) {
    console.error(err)
    bot.sendMessage(chatId, 'Error ❌')
  }
})
