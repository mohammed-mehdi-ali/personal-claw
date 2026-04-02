import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import pkg from 'pg'
import { v4 as uuidv4 } from 'uuid'
import ollama from 'ollama'

const { Pool } = pkg

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres@localhost:5432/brain'
})

const app = new Hono()

// simple chunking
function chunk(text: string) {
  return text.match(/.{1,300}/g) || []
}

// =====================
// SAVE MEMORY
// =====================
app.post('/memory', async (c) => {
  try {
    const { text } = await c.req.json()
    const memoryId = uuidv4()

    // save raw memory
    await pool.query(
      'INSERT INTO memory_entries (id, content_raw) VALUES ($1, $2)',
      [memoryId, text]
    )

    const chunks = chunk(text)

    for (const ch of chunks) {
      const res = await ollama.embeddings({
        model: 'nomic-embed-text',
        prompt: ch
      })

      const embeddingArray = res.embedding

      // ✅ FIXED VECTOR FORMAT
      const vector = `[${embeddingArray.join(',')}]`

      await pool.query(
        'INSERT INTO memory_chunks (id, memory_id, chunk_text, embedding) VALUES ($1, $2, $3, $4)',
        [uuidv4(), memoryId, ch, vector]
      )
    }

    return c.json({ success: true })
  } catch (err) {
    console.error(err)
    return c.text('Error saving memory', 500)
  }
})

// =====================
// ASK QUESTION
// =====================
const conversations: Record<string, any[]> = {}
app.post('/ask', async (c) => {
  try {
    const { question, userId } = await c.req.json()

    const emb = await ollama.embeddings({
      model: 'nomic-embed-text',
      prompt: question
    })

    // ✅ FIXED VECTOR FORMAT
    const queryVector = `[${emb.embedding.join(',')}]`

    const result = await pool.query(
      `SELECT chunk_text FROM memory_chunks
       ORDER BY embedding <-> $1
       LIMIT 5`,
      [queryVector]
    )

    const context = result.rows.map(r => r.chunk_text).join('\n')

    const response = await ollama.chat({
      model: 'llama3',
      messages: [
        {
          role: 'user',
          content: `Answer using context:\n${context}\n\nQuestion: ${question}`
        }
      ]
    })

    return c.json({ answer: response.message.content })
  } catch (err) {
    console.error(err)
    return c.text('Error answering question', 500)
  }
})

// =====================
// ROOT
// =====================
app.get('/', (c) => c.text('AI Brain running'))

// START SERVER
serve({
  fetch: app.fetch,
  port: 3000
})

console.log('🚀 AI Brain running on http://localhost:3000')
