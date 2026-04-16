import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type Status = 'idle' | 'loading' | 'sent' | 'error'

export function LoginPage() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return
    setErr(null)
    setStatus('loading')
    try {
      await signInWithEmail(email)
      setStatus('sent')
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === 'string' ? e : 'Failed to send link'
      setErr(message)
      setStatus('error')
    }
  }

  const reset = () => {
    setStatus('idle')
    setErr(null)
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* Ambient backdrop — layered radial gradients + subtle grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 15% 10%, hsl(var(--foreground) / 0.06), transparent 60%),\
             radial-gradient(50% 45% at 85% 20%, hsl(var(--foreground) / 0.05), transparent 65%),\
             radial-gradient(70% 60% at 50% 110%, hsl(var(--foreground) / 0.08), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--foreground) / 0.08) 1px, transparent 1px),\
             linear-gradient(to bottom, hsl(var(--foreground) / 0.08) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse 70% 55% at 50% 40%, #000 40%, transparent 85%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 55% at 50% 40%, #000 40%, transparent 85%)',
        }}
      />
      {/* Soft glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--foreground) / 0.10), transparent 70%)',
        }}
      />

      <div className="relative z-10 flex h-full w-full items-center justify-center px-5 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          {/* Brand mark */}
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
              Where every project has a memory.
            </p>
          </div>

          {/* Card */}
          <div
            className="relative rounded-[22px] border border-border/70 bg-card/70 p-6 sm:p-7 backdrop-blur-xl"
            style={{
              boxShadow:
                '0 1px 0 0 hsl(var(--foreground) / 0.05) inset,\
                 0 0 0 1px hsl(var(--foreground) / 0.02),\
                 0 24px 60px -24px hsl(0 0% 0% / 0.45),\
                 0 8px 24px -12px hsl(0 0% 0% / 0.25)',
            }}
          >
            {/* Hairline gradient top edge */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px"
              style={{
                background:
                  'linear-gradient(to right, transparent, hsl(var(--foreground) / 0.22), transparent)',
              }}
            />

            {status === 'sent' ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center py-2 text-center"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-secondary/60">
                  <CheckCircle2 className="h-5 w-5 text-foreground/80" strokeWidth={1.75} />
                </div>
                <h2 className="text-base font-medium tracking-tight text-foreground">
                  Check your email
                </h2>
                <p className="mt-1.5 max-w-[280px] text-[13px] leading-relaxed text-muted-foreground">
                  We sent a magic link to{' '}
                  <span className="text-foreground/90">{email}</span>. Open it on this device
                  to sign in.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-5 rounded-md px-2 py-1 text-[12.5px] text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Use a different email
                </button>
              </motion.div>
            ) : (
              <form onSubmit={submit} noValidate>
                <label
                  htmlFor="email"
                  className="mb-2 block text-[12px] font-medium tracking-wide text-muted-foreground"
                >
                  Email address
                </label>
                <div className="group relative">
                  <Mail
                    aria-hidden
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80 transition-colors group-focus-within:text-foreground/80"
                    strokeWidth={1.75}
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    disabled={status === 'loading'}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (status === 'error') setStatus('idle')
                    }}
                    className="h-11 w-full rounded-xl border border-border/80 bg-background/60 pl-10 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground/70 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)] outline-none transition focus:border-foreground/30 focus:bg-background/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading' || email.length === 0}
                  className="group relative mt-3.5 inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 text-[13.5px] font-medium tracking-tight text-primary-foreground shadow-[0_1px_0_0_hsl(var(--background)/0.25)_inset,0_10px_24px_-12px_hsl(var(--foreground)/0.5)] transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  {/* subtle top gloss */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background:
                        'linear-gradient(to right, transparent, hsl(var(--primary-foreground) / 0.35), transparent)',
                    }}
                  />
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                      <span>Sending link…</span>
                    </>
                  ) : (
                    <>
                      <span>Send magic link</span>
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                        strokeWidth={2}
                      />
                    </>
                  )}
                </button>

                {status === 'error' && err && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    role="alert"
                    className="mt-3.5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-destructive dark:text-red-300"
                  >
                    <AlertCircle
                      className="mt-px h-3.5 w-3.5 flex-shrink-0"
                      strokeWidth={2}
                    />
                    <span>{err}</span>
                  </motion.div>
                )}
              </form>
            )}
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted-foreground/80">
            By continuing you agree to our Terms and acknowledge our Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
