import { useState, useEffect } from "react"
import { useNavigate, Link, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldCheck, FileSearch, Cpu, ArrowLeft, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Determine initial state based on route, but allow toggling without navigating
  const [isLogin, setIsLogin] = useState(location.pathname === "/login")
  
  // Sync state if route actually changes from outside
  useEffect(() => {
    setIsLogin(location.pathname === "/login")
  }, [location.pathname])

  // Login fields
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  
  // Signup fields
  const [signupName, setSignupName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupConfirm, setSignupConfirm] = useState("")
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  
  const [isLoading, setIsLoading] = useState(false)

  const rules = {
    length: signupPassword.length >= 8,
    number: /\d/.test(signupPassword),
    upperLower: /[a-z]/.test(signupPassword) && /[A-Z]/.test(signupPassword),
  }
  const allRulesPassed = rules.length && rules.number && rules.upperLower

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) return
    setIsLoading(true)
    setTimeout(() => navigate("/dashboard"), 700)
  }

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!signupName || !signupEmail || !signupPassword || !signupConfirm || !allRulesPassed || signupPassword !== signupConfirm) return
    setIsLoading(true)
    setTimeout(() => navigate("/dashboard"), 700)
  }

  const CheckIcon = ({ passed }: { passed: boolean }) => (
    <div className="w-4 h-4 flex items-center justify-center shrink-0">
      <AnimatePresence mode="wait">
        {passed ? (
          <motion.div
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </motion.div>
        ) : (
          <motion.div
            key="dot"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const toggleMode = (mode: "login" | "signup") => {
    setIsLogin(mode === "login")
    // Optionally update the URL without full reload
    window.history.pushState(null, "", `/${mode}`)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="app-shell-bg min-h-screen flex flex-col md:flex-row text-white font-sans"
    >
      {/* Left Column */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="flex justify-between items-center mb-6">
            <Link to="/" className="inline-flex items-center text-xs font-medium text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to home
            </Link>
            <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-300 border-amber-400/30 bg-amber-500/10 py-0.5 px-2">
              Demo Mode
            </Badge>
          </div>
          
          {/* Slider Toggle */}
          <div className="relative flex items-center p-1 bg-white/5 border border-white/10 rounded-xl mb-8 w-full">
            <button
              type="button"
              onClick={() => toggleMode("login")}
              className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${isLogin ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => toggleMode("signup")}
              className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${!isLogin ? 'text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Sign Up
            </button>
            <div className="absolute inset-y-1 inset-x-1 flex pointer-events-none">
              <motion.div 
                layoutId="auth-slider"
                className="w-1/2 bg-white/10 rounded-lg shadow-sm border border-white/10"
                animate={{ x: isLogin ? "0%" : "100%" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            </div>
          </div>
          
          <div className="glass-strong border border-white/10 rounded-2xl p-8 shadow-2xl overflow-hidden relative">
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome Back</h1>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    Demo prototype — this starts a local session only.
                  </p>
                  
                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Email Address</label>
                      <Input 
                        type="email" 
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="you@example.com" 
                        className="h-11 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm" 
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Password</label>
                      <Input 
                        type="password" 
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="h-11 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm" 
                        required
                      />
                    </div>
                    
                    <div className="flex items-center justify-between mt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500 focus:ring-offset-0" />
                        <span className="text-xs text-slate-300">Remember me</span>
                      </label>
                      <a href="#" onClick={(e) => e.preventDefault()} className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors">
                        Forgot password?
                      </a>
                    </div>
                    
                    <Button type="submit" disabled={isLoading} className="w-full h-11 text-sm font-bold mt-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black border-none shadow-lg shadow-amber-500/20">
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-black/70" /> : "Sign In"}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="signup-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-2xl font-bold tracking-tight mb-2">Create Account</h1>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    Demo prototype — no real account is created.
                  </p>
                  
                  <form onSubmit={handleSignupSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Full Name</label>
                      <Input 
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder="Jane Doe" 
                        className="h-11 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm" 
                        required
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Email Address</label>
                      <Input 
                        type="email" 
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="you@example.com" 
                        className="h-11 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm" 
                        required
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Password</label>
                      <div className="relative">
                        <Input 
                          type={showSignupPassword ? "text" : "password"} 
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="••••••••" 
                          className="h-11 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm pr-10" 
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                          {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 py-1">
                      <div className={`flex items-center gap-2 text-xs ${rules.length ? "text-emerald-400/90" : "text-slate-400"}`}>
                        <CheckIcon passed={rules.length} /> At least 8 characters
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${rules.number ? "text-emerald-400/90" : "text-slate-400"}`}>
                        <CheckIcon passed={rules.number} /> Contains a number
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${rules.upperLower ? "text-emerald-400/90" : "text-slate-400"}`}>
                        <CheckIcon passed={rules.upperLower} /> Upper and lowercase letters
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Confirm Password</label>
                      <Input 
                        type="password" 
                        value={signupConfirm}
                        onChange={(e) => setSignupConfirm(e.target.value)}
                        placeholder="••••••••" 
                        className="h-11 bg-white/[0.03] border-white/10 focus-visible:ring-amber-500 text-sm" 
                        required
                      />
                      {signupConfirm && signupPassword !== signupConfirm && (
                        <div className="text-[10px] text-rose-400 mt-1">Passwords do not match</div>
                      )}
                    </div>
                    
                    <Button type="submit" disabled={isLoading || !allRulesPassed || (signupPassword !== signupConfirm && signupConfirm.length > 0)} className="w-full h-11 text-sm font-bold mt-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black border-none shadow-lg shadow-amber-500/20">
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-black/70" /> : "Create Account"}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Right Column */}
      <div className="hidden md:flex flex-1 relative items-center justify-center p-12 overflow-hidden border-l border-white/10 bg-black/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.08),transparent_70%)]" />
        
        <div className="relative max-w-md w-full z-20">
          {/* Floating Chips - Positioned far enough to not overlap text */}
          <div className="absolute -right-8 -top-16 z-30">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0 }}>
              <div className="w-14 h-14 bg-[#141517] border border-white/10 shadow-2xl rounded-2xl flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>
            </motion.div>
          </div>
          
          <div className="absolute -left-10 top-24 z-30">
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}>
              <div className="w-12 h-12 bg-[#141517] border border-white/10 shadow-xl rounded-xl flex items-center justify-center">
                <FileSearch className="h-5 w-5 text-amber-400" />
              </div>
            </motion.div>
          </div>
          
          <div className="absolute right-12 -bottom-12 z-30">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}>
              <div className="w-16 h-16 bg-[#141517] border border-white/10 shadow-2xl rounded-2xl flex items-center justify-center">
                <Cpu className="h-7 w-7 text-slate-300" />
              </div>
            </motion.div>
          </div>
          
          <div className="glass border border-white/10 rounded-2xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative z-20 bg-black/40 backdrop-blur-xl">
            <h3 className="text-lg font-bold text-white mb-2">Every verdict comes with its evidence</h3>
            <p className="text-sm text-slate-400 mb-6">never a bare score.</p>
            
            <div className="border border-emerald-400/30 bg-emerald-500/10 rounded-xl p-5 relative overflow-hidden">
              {/* Removed the large absolute ShieldCheck icon that was overlapping the text */}
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Supported</div>
                <div className="text-xs font-mono text-emerald-400/80 font-bold bg-emerald-500/10 px-2 py-1 rounded">entailment 0.96</div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed font-serif italic mb-4 relative z-10">
                "Revenue increased by 12% in fiscal year 2025, driven by strong demand."
              </p>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 border-t border-emerald-500/20 pt-3 relative z-10">
                <FileSearch className="h-3.5 w-3.5" /> Source Document, p. 43
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
