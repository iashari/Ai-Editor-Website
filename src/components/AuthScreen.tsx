'use client'

import { useState, useRef, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { motion, AnimatePresence } from './animations/MotionDiv'
import BlurText from './animations/BlurText'

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' }
  if (score <= 2) return { score, label: 'Fair', color: '#f97316' }
  if (score <= 3) return { score, label: 'Good', color: '#eab308' }
  return { score, label: 'Strong', color: '#22c55e' }
}

export default function AuthScreen() {
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authFullName, setAuthFullName] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [authSuccess, setAuthSuccess] = useState('')
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [showExistsPopup, setShowExistsPopup] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailInputRef.current?.focus()
  }, [authMode])

  function validateField(field: string, value: string) {
    const errors = { ...fieldErrors }
    if (field === 'email') {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.email = 'Please enter a valid email address'
      else delete errors.email
    }
    if (field === 'password') {
      if (value && value.length < 6) errors.password = 'Password must be at least 6 characters'
      else delete errors.password
      if (authConfirmPassword && value !== authConfirmPassword) errors.confirmPassword = 'Passwords do not match'
      else delete errors.confirmPassword
    }
    if (field === 'confirmPassword') {
      if (value && value !== authPassword) errors.confirmPassword = 'Passwords do not match'
      else delete errors.confirmPassword
    }
    if (field === 'fullName') {
      if (authMode === 'signup' && value && value.trim().length < 2) errors.fullName = 'Please enter your full name'
      else delete errors.fullName
    }
    setFieldErrors(errors)
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')

    if (authMode === 'signup') {
      if (authPassword !== authConfirmPassword) {
        setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }))
        return
      }
      if (authFullName.trim().length < 2) {
        setFieldErrors((prev) => ({ ...prev, fullName: 'Please enter your full name' }))
        return
      }
    }

    setAuthSubmitting(true)
    try {
      if (authMode === 'signup') {
        const { error } = await getSupabaseClient().auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { full_name: authFullName.trim() } },
        })
        if (error) {
          if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already been registered')) {
            setShowExistsPopup(true)
          } else {
            setAuthError(error.message)
          }
        } else {
          setShowSuccessPopup(true)
        }
      } else {
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email: authEmail, password: authPassword })
        if (error) setAuthError(error.message)
      }
    } catch {
      setAuthError('An unexpected error occurred. Please try again.')
    } finally {
      setAuthSubmitting(false)
    }
  }

  function switchAuthMode(mode: 'login' | 'signup') {
    setAuthMode(mode)
    setAuthError('')
    setAuthSuccess('')
    setFieldErrors({})
    setShowPassword(false)
    setShowConfirmPassword(false)
    if (mode === 'login') {
      setAuthFullName('')
      setAuthConfirmPassword('')
    }
  }

  const passwordStrength = getPasswordStrength(authPassword)

  const inputBase = 'w-full rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 bg-neutral-800/30 backdrop-blur-sm text-white placeholder-neutral-600'
  const inputNormal = `${inputBase} border-neutral-700/50 focus:ring-neutral-500/50 focus:border-neutral-600`
  const inputError = `${inputBase} border-red-500/50 focus:ring-red-500/30`

  return (
    <div className="h-screen bg-neutral-950 relative overflow-hidden flex flex-col">
      {/* Grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-neutral-950 via-transparent to-neutral-950 pointer-events-none" />

      {/* Success Popup */}
      <AnimatePresence>
        {showSuccessPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-neutral-900/80 border border-neutral-700 rounded-2xl backdrop-blur-xl"
              style={{ padding: '40px', maxWidth: '380px', width: '90%' }}
            >
              {/* Inner gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-white/[0.01] pointer-events-none rounded-2xl" />

              <div className="relative z-10 text-center">
                {/* Success icon */}
                <div className="flex items-center justify-center mx-auto" style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: '20px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight" style={{ marginBottom: '8px' }}>
                  Account Created<span className="text-neutral-500">!</span>
                </h3>
                <p className="text-neutral-400 text-sm leading-relaxed" style={{ marginBottom: '24px' }}>
                  We&apos;ve sent a confirmation email to <span className="text-white font-medium">{authEmail}</span>. Please check your inbox and verify your email to get started.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessPopup(false)
                    setAuthEmail('')
                    setAuthPassword('')
                    setAuthFullName('')
                    setAuthConfirmPassword('')
                    switchAuthMode('login')
                  }}
                  className="w-full rounded-full text-sm font-bold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white text-black flex items-center justify-center gap-2"
                  style={{ padding: '12px 0' }}
                >
                  Go to Sign In
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Already Registered Popup */}
      <AnimatePresence>
        {showExistsPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              className="absolute inset-0"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-neutral-900/80 border border-neutral-700 rounded-2xl backdrop-blur-xl"
              style={{ padding: '40px', maxWidth: '380px', width: '90%' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-white/[0.01] pointer-events-none rounded-2xl" />

              <div className="relative z-10 text-center">
                {/* Info icon */}
                <div className="flex items-center justify-center mx-auto" style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '20px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight" style={{ marginBottom: '8px' }}>
                  Account Exists<span className="text-neutral-500">.</span>
                </h3>
                <p className="text-neutral-400 text-sm leading-relaxed" style={{ marginBottom: '24px' }}>
                  An account with <span className="text-white font-medium">{authEmail}</span> already exists. Please sign in instead.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExistsPopup(false)
                      setAuthPassword('')
                      setAuthFullName('')
                      setAuthConfirmPassword('')
                      switchAuthMode('login')
                    }}
                    className="w-full rounded-full text-sm font-bold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white text-black flex items-center justify-center"
                    style={{ padding: '12px 0', gap: '8px' }}
                  >
                    Go to Sign In
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExistsPopup(false)}
                    className="w-full rounded-full text-sm font-medium tracking-wide transition-all duration-300 text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500"
                    style={{ padding: '12px 0' }}
                  >
                    Try Another Email
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content — single viewport, centered */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center" style={{ padding: '16px' }}>
        {/* Compact branding */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
          style={{ marginBottom: '24px' }}
        >
          <BlurText
            text="Document Editor."
            className="text-3xl font-bold text-white tracking-tight justify-center"
            delay={120}
            animateBy="words"
            direction="top"
          />
          <p className="text-neutral-500 text-sm" style={{ marginTop: '6px' }}>AI-powered writing, editing, and collaboration</p>
        </motion.div>

        {/* Glass auth card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
          style={{ maxWidth: '400px' }}
        >
          <div className="group relative">
            {/* Outer glow */}
            <div className="absolute rounded-2xl bg-gradient-to-b from-neutral-700/40 via-neutral-800/20 to-neutral-800/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ inset: '-1px' }} />

            {/* Glowing orbs */}
            <div className="absolute bg-white rounded-full opacity-0 group-hover:opacity-[0.02] transition-opacity duration-700 pointer-events-none" style={{ top: '-80px', right: '-80px', width: '160px', height: '160px', filter: 'blur(48px)' }} />
            <div className="absolute bg-white rounded-full opacity-0 group-hover:opacity-[0.015] transition-opacity duration-700 pointer-events-none" style={{ bottom: '-80px', left: '-80px', width: '160px', height: '160px', filter: 'blur(48px)' }} />

            {/* Glass container */}
            <div className="relative bg-neutral-900/50 border border-neutral-800 rounded-2xl backdrop-blur-xl" style={{ padding: '28px' }}>
              {/* Inner subtle gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-white/[0.01] pointer-events-none rounded-2xl" />

              <div className="relative z-10">
                {/* Mode tabs */}
                <div className="flex bg-neutral-800/50 border border-neutral-700/30 rounded-full" style={{ padding: '4px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => switchAuthMode('login')}
                    className={`flex-1 text-sm font-medium tracking-wide rounded-full transition-all duration-300 ${authMode === 'login' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-neutral-200'}`}
                    style={{ padding: '8px 0' }}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchAuthMode('signup')}
                    className={`flex-1 text-sm font-medium tracking-wide rounded-full transition-all duration-300 ${authMode === 'signup' ? 'bg-white text-black shadow-md' : 'text-neutral-400 hover:text-neutral-200'}`}
                    style={{ padding: '8px 0' }}
                  >
                    Create Account
                  </button>
                </div>

                {/* Alerts */}
                {authSuccess && (
                  <div className="rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm leading-relaxed" style={{ padding: '10px', marginBottom: '12px' }}>
                    {authSuccess}
                  </div>
                )}
                {authError && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed animate-shake" style={{ padding: '10px', marginBottom: '12px' }}>
                    {authError}
                  </div>
                )}

                {/* Form */}
                <AnimatePresence mode="wait">
                  <motion.form
                    key={authMode}
                    initial={{ opacity: 0, x: authMode === 'login' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: authMode === 'login' ? 20 : -20 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    onSubmit={handleAuth}
                    style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                  >
                    {authMode === 'signup' && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 tracking-widest uppercase" style={{ marginBottom: '4px' }}>
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={authFullName}
                          onChange={(e) => { setAuthFullName(e.target.value); validateField('fullName', e.target.value) }}
                          onBlur={(e) => validateField('fullName', e.target.value)}
                          style={{ padding: '10px 14px' }}
                          className={fieldErrors.fullName ? inputError : inputNormal}
                          placeholder="Enter your full name"
                          autoComplete="name"
                          required
                        />
                        {fieldErrors.fullName && (
                          <p className="text-red-400 text-xs animate-shake" style={{ marginTop: '4px' }}>{fieldErrors.fullName}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 tracking-widest uppercase" style={{ marginBottom: '4px' }}>
                        Email Address
                      </label>
                      <input
                        ref={emailInputRef}
                        type="email"
                        value={authEmail}
                        onChange={(e) => { setAuthEmail(e.target.value); validateField('email', e.target.value) }}
                        onBlur={(e) => validateField('email', e.target.value)}
                        style={{ padding: '10px 14px' }}
                        className={fieldErrors.email ? inputError : inputNormal}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                      />
                      {fieldErrors.email && (
                        <p className="text-red-400 text-xs animate-shake" style={{ marginTop: '4px' }}>{fieldErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                        <label className="text-xs font-medium text-neutral-400 tracking-widest uppercase">
                          Password
                        </label>
                        {authMode === 'login' && (
                          <button type="button" className="text-xs text-neutral-600 hover:text-neutral-300 transition-colors">
                            Forgot?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={authPassword}
                          onChange={(e) => { setAuthPassword(e.target.value); validateField('password', e.target.value) }}
                          onBlur={(e) => validateField('password', e.target.value)}
                          style={{ padding: '10px 44px 10px 14px' }}
                          className={fieldErrors.password ? inputError : inputNormal}
                          placeholder={authMode === 'signup' ? 'Min. 6 characters' : 'Enter your password'}
                          autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute top-1/2 text-neutral-600 hover:text-neutral-300 transition-colors"
                          style={{ right: '12px', transform: 'translateY(-50%)', padding: '4px' }}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          )}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-red-400 text-xs animate-shake" style={{ marginTop: '4px' }}>{fieldErrors.password}</p>
                      )}

                      {authMode === 'signup' && authPassword.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div className="flex" style={{ gap: '4px', marginBottom: '4px' }}>
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className="flex-1 rounded-full transition-all duration-300"
                                style={{
                                  height: '4px',
                                  backgroundColor: level <= passwordStrength.score ? passwordStrength.color : '#1a1a1a',
                                }}
                              />
                            ))}
                          </div>
                          <p className="text-xs font-mono transition-colors" style={{ color: passwordStrength.color }}>
                            {passwordStrength.label}
                          </p>
                        </div>
                      )}
                    </div>

                    {authMode === 'signup' && (
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 tracking-widest uppercase" style={{ marginBottom: '4px' }}>
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={authConfirmPassword}
                            onChange={(e) => { setAuthConfirmPassword(e.target.value); validateField('confirmPassword', e.target.value) }}
                            onBlur={(e) => validateField('confirmPassword', e.target.value)}
                            style={{ padding: '10px 44px 10px 14px' }}
                            className={fieldErrors.confirmPassword ? inputError : inputNormal}
                            placeholder="Re-enter your password"
                            autoComplete="new-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute top-1/2 text-neutral-600 hover:text-neutral-300 transition-colors"
                            style={{ right: '12px', transform: 'translateY(-50%)', padding: '4px' }}
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            )}
                          </button>
                        </div>
                        {fieldErrors.confirmPassword && (
                          <p className="text-red-400 text-xs animate-shake" style={{ marginTop: '4px' }}>{fieldErrors.confirmPassword}</p>
                        )}
                      </div>
                    )}

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={authSubmitting || Object.keys(fieldErrors).length > 0}
                      className="w-full rounded-full text-sm font-bold tracking-wide transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0 bg-white text-black flex items-center justify-center shadow-lg shadow-white/5"
                      style={{ padding: '12px 0', gap: '8px' }}
                    >
                      {authSubmitting ? (
                        <>
                          <div className="border-black/30 border-t-black rounded-full animate-spin" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                          {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
                        </>
                      ) : (
                        <>
                          {authMode === 'login' ? 'Sign In' : 'Create Account'}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                          </svg>
                        </>
                      )}
                    </button>
                  </motion.form>
                </AnimatePresence>

                {/* Terms */}
                {authMode === 'signup' && (
                  <p className="text-neutral-600 text-xs text-center leading-relaxed" style={{ marginTop: '12px' }}>
                    By creating an account, you agree to our{' '}
                    <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer">Terms</span>
                    {' '}and{' '}
                    <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
                  </p>
                )}

                {/* Switch mode */}
                <div className="border-t border-neutral-800/50" style={{ marginTop: '16px', paddingTop: '16px' }}>
                  <p className="text-center text-sm text-neutral-500">
                    {authMode === 'login' ? (
                      <>
                        Don&apos;t have an account?{' '}
                        <button
                          type="button"
                          onClick={() => switchAuthMode('signup')}
                          className="font-medium text-white hover:text-neutral-300 transition-colors"
                        >
                          Create one
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => switchAuthMode('login')}
                          className="font-medium text-white hover:text-neutral-300 transition-colors"
                        >
                          Sign in
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Bottom hover line */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-transparent via-neutral-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ height: '1px' }} />
            </div>
          </div>
        </motion.div>

        {/* Slim feature row below card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center text-neutral-600 text-xs"
          style={{ gap: '24px', marginTop: '24px' }}
        >
          <span className="flex items-center" style={{ gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M20 12a8 8 0 0 0-8-8v8h8z" /></svg>
            AI Editing
          </span>
          <span className="bg-neutral-800" style={{ width: '1px', height: '12px' }} />
          <span className="flex items-center" style={{ gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            Real-time Sync
          </span>
          <span className="bg-neutral-800" style={{ width: '1px', height: '12px' }} />
          <span className="flex items-center" style={{ gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
            Multimodal
          </span>
        </motion.div>
      </div>
    </div>
  )
}
