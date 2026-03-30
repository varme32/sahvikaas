import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function AuthPage({ mode }) {
  const [isLogin, setIsLogin] = useState(mode === 'login')
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
    </div>
  )
}

function LoginForm({ onSwitch, onSuccess }) {
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
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
          />
        </div>

        <div className="relative">
          <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full h-12 pl-10 pr-12 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
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
          <button type="button" className="text-sm text-[#F2CF7E] hover:text-[#e0bd6c] font-medium transition-colors">
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-[#F2CF7E] text-black rounded-lg font-semibold hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? (
            <i className="ri-loader-4-line animate-spin text-xl" />
          ) : (
            'Sign In'
          )}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <button
        type="button"
        className="w-full h-12 border border-gray-300 rounded-lg font-medium text-black hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <i className="ri-google-fill text-lg" />
        Sign in with Google
      </button>

      <p className="text-center text-sm text-gray-600 mt-6">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-[#F2CF7E] font-medium hover:text-[#e0bd6c] transition-colors">
          Sign up
        </button>
      </p>
    </form>
  )
}

function SignupForm({ onSwitch, onSuccess }) {
  const { signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!agreeTerms) {
      setError('Please agree to the Terms of Service.')
      return
    }
    setLoading(true)
    try {
      const result = await signup({ name, email, password })
      setLoading(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSuccess()
    } catch (err) {
      setLoading(false)
      setError(err.message || 'Signup failed.')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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
            placeholder="Full name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
          />
        </div>

        <div className="relative">
          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
          />
        </div>

        <div>
          <div className="relative">
            <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-12 pl-10 pr-12 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
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
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-500 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
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
          disabled={loading}
          className="w-full h-12 bg-[#F2CF7E] text-black rounded-lg font-semibold hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? (
            <i className="ri-loader-4-line animate-spin text-xl" />
          ) : (
            'Create Account'
          )}
        </button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <button
        type="button"
        className="w-full h-12 border border-gray-300 rounded-lg font-medium text-black hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <i className="ri-google-fill text-lg" />
        Sign up with Google
      </button>

      <p className="text-center text-sm text-gray-600 mt-6">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} className="text-[#F2CF7E] font-medium hover:text-[#e0bd6c] transition-colors">
          Sign in
        </button>
      </p>
    </form>
  )
}
