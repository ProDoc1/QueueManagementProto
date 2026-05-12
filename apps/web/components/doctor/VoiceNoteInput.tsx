'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function VoiceNoteInput({ value, onChange, placeholder }: Props) {
  const [isListening, setIsListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as typeof window & { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
    setSupported(!!SpeechRecognition)
  }, [])

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || (window as typeof window & { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let finalTranscript = value

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i]![0]!.transcript
        if (event.results[i]!.isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript
        } else {
          interim = transcript
        }
      }
      onChange(finalTranscript + (interim ? ` ${interim}` : ''))
    }

    recognition.onend = () => {
      setIsListening(false)
      onChange(finalTranscript)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Type or speak your notes...'}
          rows={6}
          className={`w-full border rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
            isListening ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-300'
          }`}
        />
        {isListening && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Recording
          </div>
        )}
      </div>

      {supported && (
        <div className="flex gap-2">
          {!isListening ? (
            <button
              type="button"
              onClick={startListening}
              className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Speak Notes
            </button>
          ) : (
            <button
              type="button"
              onClick={stopListening}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <span className="w-3 h-3 bg-red-500 rounded-sm" />
              Stop Recording
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-gray-400 hover:text-gray-600 text-sm px-3 py-2"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
