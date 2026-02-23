'use client'

import { useState, useRef, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabaseClient'

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
        if (error) { setAuthError(error.message) }
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

  return (
    <div className="min-h-screen bg-neutral-950 relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-neutral-950 via-transparent to-neutral-950 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* Left panel - Branding */}
        <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
          <div className="max-w-md w-full">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
              <span className="text-neutral-500 text-sm tracking-widest uppercase mb-4 block">
                AI-Powered
              </span>
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight leading-tight">
                Document
                <br />
                <span className="text-neutral-400">Editor</span><span className="text-neutral-500">.</span>
              </h1>
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
              <div className="w-16 h-px bg-neutral-700 my-6" />
            </div>

            <div className="animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
              <p className="text-neutral-400 text-lg leading-relaxed mb-8">
                Write, edit, and collaborate with AI assistance. A smart document editor powered by Gemini that understands your content and helps you create better documents.
              </p>
            </div>

            <div className="animate-fade-in-up space-y-4" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
              {[
                { title: 'AI-Powered Editing', desc: 'Smart document manipulation with natural language' },
                { title: 'Real-time Sync', desc: 'Auto-save and live collaboration ready' },
                { title: 'Multimodal Support', desc: 'Upload images, PDFs, and documents for AI analysis' },
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3 group">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0 group-hover:bg-neutral-400 transition-colors duration-300" />
                  <div>
                    <p className="text-white text-sm font-medium tracking-tight">{feature.title}</p>
                    <p className="text-neutral-500 text-sm">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel - Auth form */}
        <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
          <div className="animate-scale-in w-full max-w-md" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-2xl blur opacity-20" />

              <div className="relative bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 backdrop-blur-sm">
                {/* Mode tabs */}
                <div className="flex mb-8 bg-neutral-800/50 rounded-full p-1">
                  <button
                    type="button"
                    onClick={() => switchAuthMode('login')}
                    className={`flex-1 py-2.5 text-sm font-medium tracking-wide rounded-full transition-all duration-300 ${authMode === 'login' ? 'bg-white text-black' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchAuthMode('signup')}
                    className={`flex-1 py-2.5 text-sm font-medium tracking-wide rounded-full transition-all duration-300 ${authMode === 'signup' ? 'bg-white text-black' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    Create Account
                  </button>
                </div>

                <h2 className="text-xl font-bold text-white tracking-tight mb-1">
                  {authMode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-neutral-500 text-sm mb-6">
                  {authMode === 'login'
                    ? 'Enter your credentials to access your documents'
                    : 'Fill in the details below to get started'}
                </p>

                {authSuccess && (
                  <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm leading-relaxed">
                    {authSuccess}
                  </div>
                )}

                {authError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed">
                    {authError}
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1.5 tracking-wide">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={authFullName}
                        onChange={(e) => { setAuthFullName(e.target.value); validateField('fullName', e.target.value) }}
                        onBlur={(e) => validateField('fullName', e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-neutral-800/50 text-white placeholder-neutral-600 ${fieldErrors.fullName ? 'border-red-500/50 focus:ring-red-500/30' : 'border-neutral-700 focus:ring-neutral-500 focus:border-neutral-600'}`}
                        placeholder="Enter your full name"
                        autoComplete="name"
                        required
                      />
                      {fieldErrors.fullName && (
                        <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.fullName}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5 tracking-wide">
                      Email Address
                    </label>
                    <input
                      ref={emailInputRef}
                      type="email"
                      value={authEmail}
                      onChange={(e) => { setAuthEmail(e.target.value); validateField('email', e.target.value) }}
                      onBlur={(e) => validateField('email', e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-neutral-800/50 text-white placeholder-neutral-600 ${fieldErrors.email ? 'border-red-500/50 focus:ring-red-500/30' : 'border-neutral-700 focus:ring-neutral-500 focus:border-neutral-600'}`}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                    {fieldErrors.email && (
                      <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-neutral-300 tracking-wide">
                        Password
                      </label>
                      {authMode === 'login' && (
                        <button type="button" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={authPassword}
                        onChange={(e) => { setAuthPassword(e.target.value); validateField('password', e.target.value) }}
                        onBlur={(e) => validateField('password', e.target.value)}
                        className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-neutral-800/50 text-white placeholder-neutral-600 ${fieldErrors.password ? 'border-red-500/50 focus:ring-red-500/30' : 'border-neutral-700 focus:ring-neutral-500 focus:border-neutral-600'}`}
                        placeholder={authMode === 'signup' ? 'Min. 6 characters' : 'Enter your password'}
                        autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.password}</p>
                    )}

                    {authMode === 'signup' && authPassword.length > 0 && (
                      <div className="mt-2.5">
                        <div className="flex gap-1 mb-1.5">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className="h-1 flex-1 rounded-full transition-all duration-300"
                              style={{
                                backgroundColor: level <= passwordStrength.score ? passwordStrength.color : '#262626',
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-xs transition-colors" style={{ color: passwordStrength.color }}>
                          {passwordStrength.label}
                        </p>
                      </div>
                    )}
                  </div>

                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-1.5 tracking-wide">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={authConfirmPassword}
                          onChange={(e) => { setAuthConfirmPassword(e.target.value); validateField('confirmPassword', e.target.value) }}
                          onBlur={(e) => validateField('confirmPassword', e.target.value)}
                          className={`w-full px-4 py-3 pr-12 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 bg-neutral-800/50 text-white placeholder-neutral-600 ${fieldErrors.confirmPassword ? 'border-red-500/50 focus:ring-red-500/30' : 'border-neutral-700 focus:ring-neutral-500 focus:border-neutral-600'}`}
                          placeholder="Re-enter your password"
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          )}
                        </button>
                      </div>
                      {fieldErrors.confirmPassword && (
                        <p className="mt-1.5 text-red-400 text-xs">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authSubmitting || Object.keys(fieldErrors).length > 0}
                    className="w-full py-3 rounded-full text-sm font-bold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 bg-white text-black flex items-center justify-center gap-2"
                  >
                    {authSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
                      </>
                    ) : (
                      authMode === 'login' ? 'Sign In' : 'Create Account'
                    )}
                  </button>
                </form>

                {authMode === 'signup' && (
                  <p className="text-neutral-600 text-xs text-center mt-4 leading-relaxed">
                    By creating an account, you agree to our{' '}
                    <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer">Terms of Service</span>
                    {' '}and{' '}
                    <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
                  </p>
                )}

                <div className="mt-6 pt-6 border-t border-neutral-800">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
