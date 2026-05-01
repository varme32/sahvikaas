import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  apiForgotPassword,
  apiVerifyResetOtp,
  apiResetPassword,
  apiGoogleAuth,
  apiSignupSendOtp,
  apiSignupVerifyOtp,
} from '../../lib/api'

// ─── Google Client ID (set VITE_GOOGLE_CLIENT_ID in frontend/.env) ───
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// ─── Helper: parse JWT credential from Google ───
function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export default function AuthPage({ mode }) {
  const [isLogin, setIsLogin] = useState(mode === 'login')
  const [showForgot, setShowForgot] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-[40%] bg-gradient-to-br from-[#F2CF7E] to-[#e0bd6c] text-black flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-black rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-black rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center max-w-md">
          <h1 className="logo-font text-4xl mb-4">StudyHub</h1>
          {isLogin ? (
            <>
              <p className="text-xl font-semibold mb-3">Your all-in-one AI-powered virtual study room</p>
              <p className="text-black/80 text-sm leading-relaxed">
                Join thousands of students collaborating in real-time. Create study rooms, share resources,
                get AI-powered assistance, and achieve your academic goals together.
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold mb-3">Join the future of collaborative learning</p>
              <p className="text-black/80 text-sm leading-relaxed italic">
                "StudyHub transformed how I study. The AI tools and collaborative rooms helped me improve
                my grades and connect with like-minded peers."
              </p>
              <p className="text-black/60 text-xs mt-3">— Student, Computer Science</p>
            </>
          )}
          <div className="mt-10">
            <img
              src="https://illustrations.popsy.co/white/student-with-laptop.svg"
              alt="Study illustration"
              className="w-64 mx-auto opacity-90"
            />
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[#eeeeee]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-6 sm:mb-8">
            <h1 className="logo-font text-2xl sm:text-3xl text-[#F2CF7E]">StudyHub</h1>
          </div>

          {isLogin ? (
            <LoginForm
              onSwitch={() => {
                setIsLogin(false)
                navigate('/signup', { replace: true })
              }}
              onSuccess={() => navigate('/')}
              onForgotPassword={() => setShowForgot(true)}
            />
          ) : (
            <SignupForm
              onSwitch={() => {
                setIsLogin(true)
                navigate('/login', { replace: true })
              }}
              onSuccess={() => navigate('/')}
            />
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <ForgotPasswordModal
          onClose={() => setShowForgot(false)}
          onSuccess={() => {
            setShowForgot(false)
            setIsLogin(true)
            navigate('/login', { replace: true })
          }}
        />
      )}
    </div>
  )
}

// ─── Google Sign-In Button using Google Identity Services ───
// Uses window.google.accounts.id — loaded via GSI script in index.html
function GoogleSignInButton({ label, onSuccess, onError }) {
  const btnRef = useRef(null)
  const [gsiReady, setGsiReady] = useState(false)
  const [loading, setLoading] = useState(false)

  // Poll until the GSI library is loaded
  useEffect(() => {
    let attempts = 0
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        setGsiReady(true)
        clearInterval(interval)
      }
      if (++attempts > 40) clearInterval(interval) // stop after ~10s
    }, 250)
    return () => clearInterval(interval)
  }, [])

  const handleCredentialResponse = useCallback(async (response) => {
    setLoading(true)
    try {
      const payload = parseJwt(response.credential)
      if (!payload) throw new Error('Failed to decode Google credential.')

      const data = await apiGoogleAuth({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
      })

      if (data.ok) {
        localStorage.setItem('studyhub-token', data.token)
        localStorage.setItem('studyhub-current-user', JSON.stringify(data.user))
        sessionStorage.setItem('studyhub-username', data.user.name)
        window.location.href = import.meta.env.BASE_URL || '/'
      } else {
        onError(data.error || 'Google sign-in failed.')
      }
    } catch (err) {
      onError(err.message || 'Google sign-in failed.')
    }
    setLoading(false)
  }, [onError])

  const handleClick = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      onError('Google Sign-In is not configured yet. Add VITE_GOOGLE_CLIENT_ID to frontend/.env')
      return
    }
    if (!gsiReady || !window.google?.accounts?.id) {
      onError('Google Sign-In is still loading. Please wait a moment and try again.')
      return
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      cancel_on_tap_outside: true,
    })

    // Show the One Tap / popup
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: open full Google sign-in popup
        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: window.location.origin,
          response_type: 'token id_token',
          scope: 'openid email profile',
          prompt: 'select_account',
          nonce: Math.random().toString(36).slice(2),
        })
        const popup = window.open(
          `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
          'google-oauth',
          'width=500,height=600,left=200,top=100'
        )
        if (!popup) {
          onError('Popup was blocked. Please allow popups for this site.')
        }
      }
    })
  }, [gsiReady, handleCredentialResponse, onError])

  if (loading) {
    return (
      <div className="w-full h-12 border border-gray-300 rounded-lg flex items-center justify-center gap-2 text-sm text-gray-600 bg-white/60">
        <i className="ri-loader-4-line animate-spin text-lg" />
        Signing in with Google...
      </div>
    )
  }

  return (
    <button
      ref={btnRef}
      type="button"
      id="google-signin-btn"
      onClick={handleClick}
      className="w-full h-12 border border-gray-300 rounded-lg font-medium text-black hover:bg-white hover:shadow-sm transition-all flex items-center justify-center gap-3 text-sm bg-white/70"
    >
      {/* Official Google "G" logo colors */}
      <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
          <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
          <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
          <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
          <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
        </g>
      </svg>
      {label}
    </button>
  )
}

// ─── Login Form ───
function LoginForm({ onSwitch, onSuccess, onForgotPassword }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    try {
      const result = await login({ email, password })
      setLoading(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSuccess()
    } catch (err) {
      setLoading(false)
      setError(err.message || 'Login failed.')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold text-black mb-1">Welcome back</h2>
      <p className="text-gray-600 text-sm mb-6">Sign in to your StudyHub account</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <i className="ri-error-warning-line" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="relative">
          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="email"
            id="login-email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E] bg-white"
          />
        </div>

        <div className="relative">
          <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            id="login-password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full h-12 pl-10 pr-12 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E] bg-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="rounded border-gray-300 text-[#F2CF7E] focus:ring-[#F2CF7E]"
            />
            Remember me
          </label>
          <button
            type="button"
            id="forgot-password-btn"
            onClick={onForgotPassword}
            className="text-sm text-[#F2CF7E] hover:text-[#e0bd6c] font-medium transition-colors underline-offset-2 hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          id="login-submit-btn"
          disabled={loading}
          className="w-full h-12 bg-[#F2CF7E] text-black rounded-lg font-semibold hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? <i className="ri-loader-4-line animate-spin text-xl" /> : 'Sign In'}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <GoogleSignInButton
        label="Sign in with Google"
        onSuccess={() => { }}
        onError={(msg) => setError(msg)}
      />

      <p className="text-center text-sm text-gray-600 mt-6">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-[#F2CF7E] font-medium hover:text-[#e0bd6c] transition-colors">
          Sign up
        </button>
      </p>
    </form>
  )
}

// ─── Signup Form (with OTP verification) ───
function SignupForm({ onSwitch, onSuccess }) {
  const { signup } = useAuth()
  const [step, setStep] = useState(1) // 1 = details, 2 = OTP verification
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(0)

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  const getPasswordStrength = () => {
    let score = 0
    if (password.length >= 8) score++
    if (/[a-z]/.test(password)) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9!@#$%^&*]/.test(password)) score++
    return score
  }

  const strength = getPasswordStrength()
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['bg-gray-200', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'][strength]

  // Step 1: Validate fields and send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!agreeTerms) {
      setError('Please agree to the Terms of Service.')
      return
    }
    setLoading(true)
    try {
      const data = await apiSignupSendOtp({ name, email, password })
      if (data.ok) {
        setStep(2)
        setCountdown(60)
        setSuccess('Verification code sent! Check your inbox (and spam folder).')
      } else {
        setError(data.error || 'Failed to send verification code.')
      }
    } catch (err) {
      setError(err.message || 'Failed to send verification code.')
    }
    setLoading(false)
  }

  // Step 2: Verify OTP and create account
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit code.')
      return
    }
    setLoading(true)
    try {
      const data = await apiSignupVerifyOtp({ email, otp })
      if (data.ok) {
        // Set token and user data
        localStorage.setItem('studyhub-token', data.token)
        localStorage.setItem('studyhub-current-user', JSON.stringify(data.user))
        sessionStorage.setItem('studyhub-username', data.user.name)
        // Reload to hydrate auth context
        window.location.href = import.meta.env.BASE_URL || '/'
      } else {
        setError(data.error || 'Invalid or expired OTP.')
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP.')
    }
    setLoading(false)
  }

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) return
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const data = await apiSignupSendOtp({ name, email, password })
      if (data.ok) {
        setCountdown(60)
        setOtp('')
        setSuccess('A new verification code has been sent to your email.')
      } else {
        setError(data.error || 'Failed to resend code.')
      }
    } catch (err) {
      setError(err.message || 'Failed to resend code.')
    }
    setLoading(false)
  }

  // ── Step 2: OTP Verification ──
  if (step === 2) {
    return (
      <form onSubmit={handleVerifyOtp}>
        <h2 className="text-2xl font-bold text-black mb-1">Verify your email</h2>
        <p className="text-gray-600 text-sm mb-1">We sent a 6-digit verification code to:</p>
        <p className="text-[#F2CF7E] font-semibold text-sm mb-5 truncate">{email}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <i className="ri-error-warning-line" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <i className="ri-checkbox-circle-line" />
            {success}
          </div>
        )}

        <div className="space-y-4">
          {/* OTP visual */}
          <div className="relative">
            <div className="flex justify-center gap-2 mb-1">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`w-11 h-14 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all ${otp[i]
                    ? 'border-[#F2CF7E] bg-[#F2CF7E]/10 text-black'
                    : 'border-gray-300 bg-white text-gray-300'
                    }`}
                >
                  {otp[i] || '•'}
                </div>
              ))}
            </div>
            <input
              type="text"
              id="signup-otp-input"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              inputMode="numeric"
              autoFocus
              className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              style={{ caretColor: 'transparent' }}
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">
              {otp.length}/6 digits entered
            </span>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={countdown > 0 || loading}
              className="text-xs font-medium text-[#F2CF7E] hover:text-[#e0bd6c] disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
            </button>
          </div>

          <button
            type="submit"
            id="signup-verify-otp-btn"
            disabled={loading || otp.length !== 6}
            className="w-full h-12 bg-[#F2CF7E] text-black rounded-lg font-semibold hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <i className="ri-loader-4-line animate-spin text-xl" /> : <><i className="ri-check-line" /> Verify & Create Account</>}
          </button>
        </div>

        <button
          type="button"
          onClick={() => { setStep(1); setError(''); setOtp(''); setSuccess('') }}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4 transition-colors"
        >
          ← Back to signup details
        </button>

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{' '}
          <button type="button" onClick={onSwitch} className="text-[#F2CF7E] font-medium hover:text-[#e0bd6c] transition-colors">
            Sign in
          </button>
        </p>
      </form>
    )
  }

  // ── Step 1: Signup details ──
  return (
    <form onSubmit={handleSendOtp}>
      <h2 className="text-2xl font-bold text-black mb-1">Create your account</h2>
      <p className="text-gray-600 text-sm mb-6">Start your collaborative learning journey</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <i className="ri-error-warning-line" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="relative">
          <i className="ri-user-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            id="signup-name"
            placeholder="Full name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E] bg-white"
          />
        </div>

        <div className="relative">
          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="email"
            id="signup-email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E] bg-white"
          />
        </div>

        <div>
          <div className="relative">
            <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              id="signup-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-12 pl-10 pr-12 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E] bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
            </button>
          </div>
          {password && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= strength ? strengthColor : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className={`text-xs mt-1 ${strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-yellow-500' : strength === 3 ? 'text-blue-500' : 'text-green-500'}`}>
                {strengthLabel}
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            id="signup-confirm-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E] bg-white"
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={e => setAgreeTerms(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-[#F2CF7E] focus:ring-[#F2CF7E]"
          />
          <span>
            I agree to the{' '}
            <button type="button" className="text-[#F2CF7E] hover:text-[#e0bd6c] transition-colors">Terms of Service</button>
            {' '}and{' '}
            <button type="button" className="text-[#F2CF7E] hover:text-[#e0bd6c] transition-colors">Privacy Policy</button>
          </span>
        </label>

        <button
          type="submit"
          id="signup-submit-btn"
          disabled={loading}
          className="w-full h-12 bg-[#F2CF7E] text-black rounded-lg font-semibold hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <i className="ri-loader-4-line animate-spin text-xl" /> : <><i className="ri-mail-send-line" /> Send Verification Code</>}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <GoogleSignInButton
        label="Sign up with Google"
        onSuccess={() => { }}
        onError={(msg) => setError(msg)}
      />

      <p className="text-center text-sm text-gray-600 mt-6">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-[#F2CF7E] font-medium hover:text-[#e0bd6c] transition-colors">
          Sign in
        </button>
      </p>
    </form>
  )
}

// ─── Forgot Password Modal ───
// Step 1 → Enter email → Send OTP
// Step 2 → Enter 6-digit OTP → Verify
// Step 3 → Set new password → Reset
function ForgotPasswordModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countdown, setCountdown] = useState(0)

  // Countdown for OTP resend
  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(id)
  }, [countdown])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true)
    try {
      const data = await apiForgotPassword({ email })
      if (data.ok) {
        setStep(2)
        setCountdown(60)
        setSuccess('OTP sent! Check your inbox (and spam folder).')
      } else {
        setError(data.error || 'Failed to send OTP.')
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please check the EMAIL_USER and EMAIL_PASS in backend/.env')
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (otp.length !== 6) { setError('Please enter a valid 6-digit OTP.'); return }
    setLoading(true)
    try {
      const data = await apiVerifyResetOtp({ email, otp })
      if (data.ok) {
        setResetToken(data.resetToken)
        setStep(3)
        setSuccess('')
      } else {
        setError(data.error || 'Invalid or expired OTP.')
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP.')
    }
    setLoading(false)
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const data = await apiResetPassword({ email, resetToken, newPassword })
      if (data.ok) {
        setSuccess('Password reset successfully! Redirecting to login…')
        setTimeout(() => onSuccess(), 2000)
      } else {
        setError(data.error || 'Failed to reset password.')
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password.')
    }
    setLoading(false)
  }

  const handleResendOtp = async () => {
    if (countdown > 0) return
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const data = await apiForgotPassword({ email })
      if (data.ok) {
        setCountdown(60)
        setOtp('')
        setSuccess('A new OTP has been sent to your email.')
      } else {
        setError(data.error || 'Failed to resend OTP.')
      }
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.')
    }
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <i className="ri-close-line text-xl" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center mb-6">
          {[
            { n: 1, label: 'Email' },
            { n: 2, label: 'OTP' },
            { n: 3, label: 'Password' },
          ].map(({ n, label }, idx) => (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${step > n ? 'bg-green-500 text-white' :
                step === n ? 'bg-[#F2CF7E] text-black' :
                  'bg-gray-200 text-gray-400'
                }`}>
                {step > n ? <i className="ri-check-line text-sm" /> : n}
              </div>
              <span className={`text-xs ml-1 mr-2 ${step === n ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{label}</span>
              {idx < 2 && <div className={`flex-1 h-0.5 mr-2 ${step > n ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Email ── */}
        {step === 1 && (
          <form onSubmit={handleSendOtp}>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Forgot your password?</h3>
            <p className="text-gray-500 text-sm mb-5">
              Enter your email address and we'll send you a 6-digit OTP to reset your password.
            </p>

            {error && <ErrorBox msg={error} />}

            <div className="relative mb-4">
              <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                id="forgot-email-input"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
              />
            </div>

            <button
              type="submit"
              id="send-otp-btn"
              disabled={loading}
              className="w-full h-11 bg-[#F2CF7E] text-black rounded-lg font-semibold hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <i className="ri-loader-4-line animate-spin text-lg" /> : <><i className="ri-send-plane-line" /> Send OTP</>}
            </button>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Enter OTP</h3>
            <p className="text-gray-500 text-sm mb-1">We sent a 6-digit code to:</p>
            <p className="text-[#F2CF7E] font-semibold text-sm mb-5 truncate">{email}</p>

            {error && <ErrorBox msg={error} />}
            {success && <SuccessBox msg={success} />}

            <div className="relative mb-1">
              <i className="ri-shield-keyhole-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                id="otp-input"
                placeholder="• • • • • •"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                inputMode="numeric"
                autoFocus
                className="w-full h-14 pl-10 pr-4 rounded-lg border border-gray-300 text-center font-bold text-2xl tracking-[0.5em] text-black placeholder-gray-300 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
              />
            </div>

            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-gray-400">
                {otp.length}/6 digits entered
              </span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || loading}
                className="text-xs font-medium text-[#F2CF7E] hover:text-[#e0bd6c] disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </button>
            </div>

            <button
              type="submit"
              id="verify-otp-btn"
              disabled={loading || otp.length !== 6}
              className="w-full h-11 bg-[#F2CF7E] text-black rounded-lg font-semibold hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <i className="ri-loader-4-line animate-spin text-lg" /> : <><i className="ri-check-line" /> Verify OTP</>}
            </button>

            <button
              type="button"
              onClick={() => { setStep(1); setError(''); setOtp(''); setSuccess('') }}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-3 transition-colors"
            >
              ← Use a different email
            </button>
          </form>
        )}

        {/* ── Step 3: New Password ── */}
        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Set New Password</h3>
            <p className="text-gray-500 text-sm mb-5">
              Choose a strong, memorable password for your account.
            </p>

            {error && <ErrorBox msg={error} />}
            {success && <SuccessBox msg={success} />}

            <div className="space-y-3 mb-4">
              <div className="relative">
                <i className="ri-lock-password-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="new-password-input"
                  placeholder="New password (min. 6 characters)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoFocus
                  className="w-full h-12 pl-10 pr-12 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                </button>
              </div>
              <div className="relative">
                <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirm-new-password-input"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
                />
              </div>
            </div>

            <button
              type="submit"
              id="reset-password-btn"
              disabled={loading}
              className="w-full h-11 bg-[#F2CF7E] text-black rounded-lg font-semibold hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <i className="ri-loader-4-line animate-spin text-lg" /> : <><i className="ri-refresh-line" /> Reset Password</>}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Shared alert components ───
function ErrorBox({ msg }) {
  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
      <i className="ri-error-warning-line mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  )
}

function SuccessBox({ msg }) {
  return (
    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-start gap-2">
      <i className="ri-checkbox-circle-line mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  )
}
