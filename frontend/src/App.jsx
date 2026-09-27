import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Phone, Send, Sparkles, X } from 'lucide-react'
import HoverAssistant from './components/HoverAssistant.jsx'

const CHAT_URL = 'http://127.0.0.1:8001/chat'

const streamVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12 },
  },
}

const streamItem = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
}

function phoneFromText(text) {
  const match = text.match(/(?:\+?\d[\d\s./()-]{6,}\d)/)
  if (!match) return null
  return match[0].replace(/[^\d+]/g, '')
}

function AssistantTurn({ message }) {
  const action = message.action === 'location' || message.action === 'emergency'
    ? message.action
    : 'general'
  const phone = phoneFromText(message.text)

  return (
    <motion.div
      layout
      variants={streamVariants}
      initial="hidden"
      animate="show"
      className="mr-6 flex flex-col gap-2"
    >
      <motion.p
        layout
        variants={streamItem}
        className="rounded-2xl rounded-bl-md border border-white/15 bg-white/10 px-3 py-2 text-left text-sm text-slate-100 shadow-[0_0_24px_rgba(255,255,255,0.04)] backdrop-blur-xl"
      >
        {message.text}
      </motion.p>

      {action === 'location' && (
        <motion.div
          layout
          variants={streamItem}
          className="rounded-2xl border border-white/20 bg-black/40 p-3 shadow-[0_0_28px_rgba(129,140,248,0.28)] backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-200/30 bg-indigo-400/20 text-indigo-100">
              <MapPin className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-medium tracking-[0.18em] text-indigo-200 uppercase">
                Map Routing
              </p>
              <p className="mt-1 text-sm leading-5 text-white">{message.text}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const query = encodeURIComponent(message.text)
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${query}`,
                '_blank',
                'noopener,noreferrer',
              )
            }}
            className="mt-3 w-full rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            Get Directions
          </button>
        </motion.div>
      )}

      {action === 'emergency' && (
        <motion.div layout variants={streamItem}>
          <motion.a
            href={phone ? `tel:${phone}` : undefined}
            animate={{
              scale: [1, 1.045, 1],
              boxShadow: [
                '0 0 0 0 rgba(239,68,68,0.45)',
                '0 0 28px 6px rgba(239,68,68,0.45)',
                '0 0 0 0 rgba(239,68,68,0.45)',
              ],
            }}
            transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call Security
          </motion.a>
        </motion.div>
      )}
    </motion.div>
  )
}

function App() {
  const [open, setOpen] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const historyRef = useRef(null)

  useEffect(() => {
    const history = historyRef.current
    if (history) {
      history.scrollTop = history.scrollHeight
    }
  }, [messages, thinking, open])

  async function sendMessage(event) {
    event.preventDefault()
    const query = input.trim()
    if (!query || thinking) return

    setMessages((current) => [...current, { role: 'user', text: query }])
    setInput('')
    setThinking(true)

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (!response.ok) {
        throw new Error('Chat request failed')
      }
      const data = await response.json()
      const reply = typeof data.reply === 'string' && data.reply.trim()
        ? data.reply.trim()
        : 'I do not have a reply for that.'
      const action = data.action === 'location' || data.action === 'emergency'
        ? data.action
        : 'general'
      setMessages((current) => [...current, { role: 'assistant', text: reply, action }])
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: 'I could not reach the campus guide. Please try again.',
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.35),transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />

      <main className="relative flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <p className="text-xs font-medium tracking-[0.35em] text-indigo-200/80 uppercase">
          InterConnect
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          Autonomous Campus Guide
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-slate-300 sm:text-base">
          Ask about the library, cafeteria, rooms, and campus services.
        </p>
      </main>

      <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3 sm:right-8 sm:bottom-8">
        <AnimatePresence>
          {open && (
            <motion.section
              key="chat"
              role="dialog"
              aria-label="Campus guide chat"
              initial={{ opacity: 0, y: 24, scale: 0.86 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={{ transformOrigin: 'bottom right' }}
              className="flex h-[min(70vh,32rem)] w-[min(100vw-2.5rem,24rem)] flex-col overflow-hidden rounded-3xl border border-white/20 bg-black/40 shadow-[0_0_48px_rgba(129,140,248,0.32)] backdrop-blur-xl"
            >
              <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-200" aria-hidden="true" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Campus Guide</p>
                    <p className="text-xs text-slate-300">
                      {thinking ? 'Thinking…' : 'Online'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className="rounded-full p-1.5 text-slate-200 transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div
                ref={historyRef}
                className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
              >
                {messages.length === 0 && (
                  <p className="m-auto max-w-[16rem] text-center text-sm text-slate-300">
                    Ask about hours, rooms, or where to get help on campus.
                  </p>
                )}
                {messages.map((message, index) =>
                  message.role === 'user' ? (
                    <motion.p
                      layout
                      key={`user-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="ml-8 rounded-2xl rounded-br-md bg-indigo-500/90 px-3 py-2 text-left text-sm text-white"
                    >
                      {message.text}
                    </motion.p>
                  ) : (
                    <AssistantTurn key={`assistant-${index}`} message={message} />
                  ),
                )}
              </div>

              <form
                onSubmit={sendMessage}
                className="flex items-center gap-2 border-t border-white/10 p-3"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask the campus guide"
                  aria-label="Message"
                  className="h-11 flex-1 rounded-full border border-white/15 bg-slate-950/40 px-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-indigo-300/70"
                />
                <button
                  type="submit"
                  disabled={thinking || input.trim() === ''}
                  aria-label="Send message"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </motion.section>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Hide campus guide' : 'Open campus guide'}
          aria-expanded={open}
          animate={
            thinking
              ? { rotate: 360, scale: [1, 1.14, 1] }
              : { rotate: 0, scale: [1, 1.08, 1] }
          }
          transition={
            thinking
              ? {
                  rotate: { duration: 0.65, repeat: Infinity, ease: 'linear' },
                  scale: { duration: 0.45, repeat: Infinity, ease: 'easeInOut' },
                }
              : {
                  rotate: { duration: 0.35 },
                  scale: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
                }
          }
          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-300 via-violet-500 to-fuchsia-500 text-white shadow-[0_0_40px_rgba(129,140,248,0.55)]"
        >
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-indigo-200/70"
            animate={
              thinking
                ? { scale: [1, 1.45, 1], opacity: [0.8, 0, 0.8] }
                : { scale: [1, 1.35, 1], opacity: [0.55, 0, 0.55] }
            }
            transition={{
              duration: thinking ? 0.7 : 2.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <Sparkles className="relative h-7 w-7" />
        </motion.button>
      </div>
      <HoverAssistant />
    </div>
  )
}

export default App
