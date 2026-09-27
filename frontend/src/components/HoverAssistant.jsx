import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a, svg, img, [role="button"]'
const REST_MS = 1000
const MOVE_THRESHOLD = 12
const OFFSET = 20
const VIEW_MARGIN = 8
const ESTIMATED_WIDTH = 364
const ESTIMATED_HEIGHT = 80
const TEXT_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'email',
  'password',
  'tel',
  'url',
  'number',
])

function readableText(value) {
  if (!value) return ''
  return value.replace(/\s+/g, ' ').trim()
}

function clickPhrase(label) {
  const text = readableText(label)
  if (!text) return ''
  return /[.!?]$/.test(text) ? `Click here to ${text}` : `Click here to ${text}.`
}

function guideTipFromAncestor(element) {
  const host = element.closest('[data-guide-tip]')
  return readableText(host?.getAttribute('data-guide-tip'))
}

function parentControlLabel(element) {
  const parent = element.closest('button, a, [role="button"]')
  if (!parent || parent === element) return ''
  return readableText(parent.getAttribute('aria-label') || parent.innerText || parent.textContent)
}

function guideTip(element) {
  const custom = guideTipFromAncestor(element)
  if (custom) return custom

  const tag = element.tagName.toLowerCase()

  if (tag === 'textarea' || (tag === 'input' && TEXT_INPUT_TYPES.has((element.getAttribute('type') || '').toLowerCase()))) {
    const placeholder = readableText(element.getAttribute('placeholder'))
    if (placeholder) return `Type your ${placeholder} here`
    const name = readableText(element.getAttribute('name') || element.getAttribute('aria-label'))
    if (name) return `Type your ${name} here`
    return 'Click to interact with this element.'
  }

  if (tag === 'svg' || tag === 'img') {
    const own = readableText(element.getAttribute('aria-label') || element.getAttribute('alt'))
    if (own) return clickPhrase(own)
    const parentLabel = parentControlLabel(element)
    if (parentLabel) return clickPhrase(parentLabel)
    return 'Click to interact with this element.'
  }

  if (tag === 'select') {
    const selected = element.options?.[element.selectedIndex]?.text
    return clickPhrase(element.getAttribute('aria-label') || selected || element.getAttribute('name'))
      || 'Click to interact with this element.'
  }

  const label = readableText(element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('value'))
  if (label) return clickPhrase(label)
  return 'Click to interact with this element.'
}

function placeNearCursor(x, y, width, height) {
  const maxLeft = window.innerWidth - width - VIEW_MARGIN
  const maxTop = window.innerHeight - height - VIEW_MARGIN
  let left = x + OFFSET
  let top = y + OFFSET

  if (left > maxLeft) left = x - OFFSET - width
  if (top > maxTop) top = y - OFFSET - height

  return {
    left: Math.round(Math.min(Math.max(left, VIEW_MARGIN), Math.max(VIEW_MARGIN, maxLeft))),
    top: Math.round(Math.min(Math.max(top, VIEW_MARGIN), Math.max(VIEW_MARGIN, maxTop))),
  }
}

function interactiveTarget(target) {
  const element = target instanceof Element ? target : target?.parentElement
  if (!element || element.closest('[data-hover-assistant]')) return null
  return element.closest(INTERACTIVE_SELECTOR)
}

function sameHoverTarget(current, next) {
  if (!current || !next) return false
  return current === next || current.contains(next) || next.contains(current)
}

function BotIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-white"
      aria-hidden="true"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  )
}

function HoverAssistant() {
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const panelRef = useRef(null)
  const timerRef = useRef(0)
  const hoverRef = useRef(null)
  const anchorRef = useRef({ x: 0, y: 0 })
  const mouseRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(false)

  useLayoutEffect(() => {
    if (!visible || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    const next = placeNearCursor(mouseRef.current.x, mouseRef.current.y, rect.width, rect.height)
    setPos((current) => (
      Math.abs(current.left - next.left) < 1 && Math.abs(current.top - next.top) < 1
        ? current
        : next
    ))
  }, [visible, text])

  useEffect(() => {
    function clearTimer() {
      window.clearTimeout(timerRef.current)
      timerRef.current = 0
    }

    function hideAssistant() {
      clearTimer()
      hoverRef.current = null
      if (!visibleRef.current) return
      visibleRef.current = false
      setVisible(false)
      setText('')
    }

    function arm() {
      clearTimer()
      timerRef.current = window.setTimeout(() => {
        timerRef.current = 0
        const element = hoverRef.current
        if (!element?.isConnected) return
        const { x, y } = mouseRef.current
        const underPointer = document.elementFromPoint(x, y)
        const underTarget = underPointer instanceof Element ? interactiveTarget(underPointer) : null
        if (!underTarget || !sameHoverTarget(element, underTarget)) {
          hoverRef.current = null
          return
        }
        const message = guideTip(element)
        visibleRef.current = true
        setText(message)
        setPos(placeNearCursor(x, y, ESTIMATED_WIDTH, ESTIMATED_HEIGHT))
        setVisible(true)
      }, REST_MS)
    }

    function onMouseOver(event) {
      const next = interactiveTarget(event.target)
      if (!next || sameHoverTarget(hoverRef.current, next)) return
      hideAssistant()
      hoverRef.current = next
      anchorRef.current = { x: event.clientX, y: event.clientY }
      mouseRef.current = { x: event.clientX, y: event.clientY }
      arm()
    }

    function onMouseOut(event) {
      const current = hoverRef.current
      if (!current) return
      const related = event.relatedTarget
      if (related instanceof Node && current.contains(related)) return
      if (related instanceof Element && sameHoverTarget(current, interactiveTarget(related))) return
      hideAssistant()
    }

    function onMouseMove(event) {
      mouseRef.current = { x: event.clientX, y: event.clientY }
      if (!hoverRef.current || visibleRef.current || !timerRef.current) return
      const distance = Math.hypot(event.clientX - anchorRef.current.x, event.clientY - anchorRef.current.y)
      if (distance < MOVE_THRESHOLD) return
      anchorRef.current = { x: event.clientX, y: event.clientY }
      arm()
    }

    function onClick() {
      hideAssistant()
    }

    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('mouseout', onMouseOut)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('mouseover', onMouseOver)
      document.removeEventListener('mouseout', onMouseOut)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('click', onClick)
      clearTimer()
    }
  }, [])

  if (!visible || !text) return null

  return createPortal(
    <div
      ref={panelRef}
      data-hover-assistant
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed z-[80] flex items-start gap-2"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-400 shadow-lg shadow-blue-900/40">
        <BotIcon />
      </div>
      <p className="backdrop-blur-md bg-slate-900/90 text-white text-xs rounded-xl p-3 shadow-xl max-w-xs animate-in fade-in zoom-in-95">
        {text}
      </p>
    </div>,
    document.body,
  )
}

export default HoverAssistant
