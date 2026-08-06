"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type RecognitionType = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

export function useSpeechRecognition(lang = "pt-BR") {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interim, setInterim] = useState("")
  const [supported, setSupported] = useState(false)
  const recRef = useRef<RecognitionType | null>(null)
  const shouldRestartRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SR) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false)
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true)
    const rec: RecognitionType = new SR()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    recRef.current = rec

    rec.onresult = (e: any) => {
      let finalText = ""
      let interimText = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      if (finalText) setTranscript((prev) => prev + finalText)
      setInterim(interimText)
    }
    rec.onerror = (e: any) => {
      console.warn("STT error:", e.error)
    }
    rec.onend = () => {
      setListening(false)
      setInterim("")
      if (shouldRestartRef.current) {
        try {
          rec.start()
          setListening(true)
        } catch {
          // ignore
        }
      }
    }
    rec.onstart = () => setListening(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const start = useCallback(() => {
    if (!recRef.current) return
    shouldRestartRef.current = false
    setTranscript("")
    setInterim("")
    try {
      recRef.current.start()
    } catch {
      // already started
    }
  }, [])

  const stop = useCallback(() => {
    shouldRestartRef.current = false
    if (recRef.current) recRef.current.stop()
  }, [])

  const startContinuous = useCallback(() => {
    if (!recRef.current) return
    shouldRestartRef.current = true
    setTranscript("")
    setInterim("")
    try {
      recRef.current.start()
    } catch {
      // ignore
    }
  }, [])

  return {
    listening,
    transcript,
    interim,
    supported,
    start,
    stop,
    startContinuous,
  }
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("speechSynthesis" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false)
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true)
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      setVoices(v.filter((voice) => voice.lang.startsWith("pt")))
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  const speak = useCallback(
    (text: string, opts?: { rate?: number; pitch?: number; voiceName?: string }) => {
      if (!("speechSynthesis" in window)) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "pt-BR"
      u.rate = opts?.rate ?? 1
      u.pitch = opts?.pitch ?? 1
      const v = voices.find((voice) => voice.name === opts?.voiceName)
      if (v) u.voice = v
      else {
        const ptVoice = voices.find((voice) => voice.lang.startsWith("pt"))
        if (ptVoice) u.voice = ptVoice
      }
      u.onstart = () => setSpeaking(true)
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      utterRef.current = u
      window.speechSynthesis.speak(u)
    },
    [voices]
  )

  const cancel = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  return { speaking, supported, voices, speak, cancel }
}
