import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * A three-question "friend gate" that stands in for email/password login.
 *
 * Passing rule: get at least 2 of 3 correct. Wrong answers don't get flagged
 * mid-flow — we just collect all three and grade at the end so the gate
 * doesn't leak which questions matched.
 *
 * NB: this is NOT real security. The questions and hashed answers live in
 * the compiled bundle — anyone with DevTools can extract them. Treat this
 * like a "don't come in here unless you know me" front door. The underlying
 * data is still protected by Supabase RLS; all we're doing here is gating
 * the single shared Supabase account that owns the project data.
 *
 * Answers are normalized (trim + lowercase + collapse whitespace) before
 * hashing, so "Chai", "chai ", "CHAI" all match. Hashing (SHA-256) means
 * casual source-reading won't reveal the plaintext — you'd need to brute
 * force from a wordlist to recover the answers.
 */

const PASSING_SCORE = 2

interface Question {
  prompt: string
  /** SHA-256 hex of the normalized expected answer. */
  answerHash: string
  hint?: string
}

const QUESTIONS: Question[] = [
  {
    prompt: "What's the first name of your software engineer?",
    answerHash:
      '5f700512181ef806f73819ef86eeed662d4f6507d83cb499ecba042e2ebfd860'
  },
  {
    prompt:
      "What's the most common beverage we have on Thursdays with breakfast? (one word)",
    answerHash:
      'ca9cfcfa498aa21bd1c28fd0a3396fd6ddf4d97403d0b7f0ee88ea6b87ee3223'
  },
  {
    prompt: 'Who is Andy?',
    answerHash:
      'c857d09db23e6822e3600bc06ad8d58f92ed62bc8efd81c753f77048662cb97d'
  }
]

function normalizeAnswer(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function checkAnswer(question: Question, raw: string): Promise<boolean> {
  const hash = await sha256Hex(normalizeAnswer(raw))
  return hash === question.answerHash
}

type Phase = 'asking' | 'signing-in' | 'error' | 'failed'

export function SecurityGate() {
  const [idx, setIdx] = useState(0)
  const [draft, setDraft] = useState('')
  // Collect every answer across all 3 questions, then grade at the end.
  // We grade on submission of the last question rather than per-question so
  // the gate doesn't reveal which specific answers were wrong.
  const [answers, setAnswers] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('asking')
  const [checking, setChecking] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const question = QUESTIONS[idx]
  const total = QUESTIONS.length

  useEffect(() => {
    inputRef.current?.focus()
  }, [idx])

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (checking) return
    if (!draft.trim()) return
    const collected = [...answers, draft]

    if (idx + 1 < total) {
      // More questions to go — just advance. No mid-flow "wrong" feedback.
      setAnswers(collected)
      setIdx(idx + 1)
      setDraft('')
      return
    }

    // Last question submitted — grade all three, pass if >= PASSING_SCORE.
    setChecking(true)
    try {
      const results = await Promise.all(
        QUESTIONS.map((q, i) => checkAnswer(q, collected[i] ?? ''))
      )
      const score = results.filter(Boolean).length
      if (score >= PASSING_SCORE) {
        await signInWithEnvCreds()
      } else {
        setPhase('failed')
      }
    } finally {
      setChecking(false)
    }
  }

  function restart() {
    setAnswers([])
    setIdx(0)
    setDraft('')
    setPhase('asking')
    setSignInError(null)
  }

  async function signInWithEnvCreds() {
    const email = import.meta.env.VITE_SECURITY_EMAIL as string | undefined
    const password = import.meta.env.VITE_SECURITY_PASSWORD as string | undefined
    if (!email || !password) {
      setPhase('error')
      setSignInError(
        'Auth is not fully configured: set VITE_SECURITY_EMAIL and VITE_SECURITY_PASSWORD and rebuild.'
      )
      return
    }
    setPhase('signing-in')
    setSignInError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setPhase('error')
      setSignInError(error.message)
    }
    // On success, the top-level AuthGuard re-renders with a session and this
    // component unmounts — no further work to do here.
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 15% 10%, hsl(var(--foreground) / 0.06), transparent 60%),\
             radial-gradient(50% 45% at 85% 20%, hsl(var(--foreground) / 0.05), transparent 65%),\
             radial-gradient(70% 60% at 50% 110%, hsl(var(--foreground) / 0.08), transparent 70%)'
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--foreground) / 0.10), transparent 70%)'
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px]"
        >
          {/* Brand */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div
              className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-card/60 shadow-[0_1px_0_0_hsl(var(--foreground)/0.06)_inset,0_8px_24px_-12px_hsl(var(--foreground)/0.25)] backdrop-blur"
              aria-hidden
            >
              <div className="h-2 w-2 rounded-full bg-foreground/80" />
            </div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
              Project Command Center
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              A few quick questions before we let you in.
            </p>
          </div>

          {/* Card */}
          <div
            className="relative rounded-[22px] border border-border/70 bg-card/70 p-6 backdrop-blur-xl sm:p-7"
            style={{
              boxShadow:
                '0 1px 0 0 hsl(var(--foreground) / 0.05) inset,\
                 0 0 0 1px hsl(var(--foreground) / 0.02),\
                 0 24px 60px -24px hsl(0 0% 0% / 0.45),\
                 0 8px 24px -12px hsl(0 0% 0% / 0.25)'
            }}
          >
            {/* Hairline gradient top edge */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{
                background:
                  'linear-gradient(to right, transparent, hsl(var(--foreground) / 0.22), transparent)'
              }}
            />

            {phase === 'signing-in' ? (
              <SigningIn />
            ) : phase === 'error' ? (
              <ErrorState
                message={signInError ?? 'Something went wrong.'}
                onRetry={restart}
              />
            ) : phase === 'failed' ? (
              <FailedState onRetry={restart} />
            ) : (
              <div>
                <ProgressDots count={total} active={idx} />

                <AnimatePresence mode="wait" initial={false}>
                  <motion.form
                    key={idx}
                    onSubmit={submit}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <label className="mb-2 block text-[12px] font-medium tracking-wide text-muted-foreground">
                      Question {idx + 1} of {total}
                    </label>
                    <p className="mb-4 text-[15px] leading-relaxed text-foreground">
                      {question.prompt}
                    </p>

                    <input
                      ref={inputRef}
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={checking}
                      placeholder="Your answer"
                      className="h-11 w-full rounded-xl border border-border/80 bg-background/60 px-4 text-[14px] text-foreground placeholder:text-muted-foreground/70 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)] outline-none transition focus:border-foreground/30 focus:bg-background/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <button
                      type="submit"
                      disabled={checking || !draft.trim()}
                      className="group relative mt-4 inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 text-[13.5px] font-medium tracking-tight text-primary-foreground shadow-[0_1px_0_0_hsl(var(--background)/0.25)_inset,0_10px_24px_-12px_hsl(var(--foreground)/0.5)] transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-px"
                        style={{
                          background:
                            'linear-gradient(to right, transparent, hsl(var(--primary-foreground) / 0.35), transparent)'
                        }}
                      />
                      {checking ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                          <span>Checking…</span>
                        </>
                      ) : idx + 1 === total ? (
                        <>
                          <ShieldCheck className="h-4 w-4" strokeWidth={2} />
                          <span>Unlock</span>
                        </>
                      ) : (
                        <>
                          <span>Next</span>
                          <ArrowRight
                            className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                            strokeWidth={2}
                          />
                        </>
                      )}
                    </button>
                  </motion.form>
                </AnimatePresence>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted-foreground/80">
            This is a friend-gate, not a vault. Data is still protected by
            server-side row-level security.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function ProgressDots({ count, active }: { count: number; active: number }) {
  return (
    <div className="mb-5 flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => {
        const done = i < active
        const current = i === active
        return (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              done
                ? 'w-6 bg-foreground/80'
                : current
                ? 'w-4 bg-foreground/60'
                : 'w-3 bg-border/80'
            }`}
          />
        )
      })}
    </div>
  )
}

function SigningIn() {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-secondary/60">
        <Check className="h-5 w-5 text-emerald-300/90" strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-medium tracking-tight text-foreground">
        All three right.
      </h2>
      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Signing you in…
      </p>
    </div>
  )
}

function FailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center py-2 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
        <AlertCircle className="h-5 w-5 text-rose-300/90" strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-medium tracking-tight text-foreground">
        Not enough right.
      </h2>
      <p className="mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
        You need at least two of the three correct. Give it another go.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        Start over
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}

function ErrorState({
  message,
  onRetry
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center py-2 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
        <AlertCircle className="h-5 w-5 text-rose-300/90" strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-medium tracking-tight text-foreground">
        Couldn't sign in
      </h2>
      <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-muted-foreground">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-md px-2 py-1 text-[12.5px] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
      >
        Start over
      </button>
    </div>
  )
}
