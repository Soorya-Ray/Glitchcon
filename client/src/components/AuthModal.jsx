import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

function validateUsername(username) {
  if (!username?.trim()) return 'Username is required';
  if (username.trim().length < 3) return 'Username must be at least 3 characters';
  if (/\s/.test(username)) return 'Username cannot contain spaces';
  return '';
}

function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  return '';
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login', defaultRole = null }) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState(defaultMode);
  const [role, setRole] = useState(defaultRole || 'customer');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', username: '', password: '', email: '', phone: '' });

  const [loginErrors, setLoginErrors] = useState({});
  const [registerErrors, setRegisterErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setMode(defaultMode);
    setRole(defaultRole || 'customer');
    setApiError('');
  }, [defaultMode, defaultRole, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const roleLabel = useMemo(() => (role === 'driver' ? 'Driver' : 'Customer'), [role]);

  if (!isOpen) return null;

  function switchMode(nextMode) {
    setApiError('');
    setMode(nextMode);
  }

  function validateLogin() {
    const nextErrors = {
      username: validateUsername(loginForm.username),
      password: validatePassword(loginForm.password),
    };
    setLoginErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  function validateRegister() {
    const nextErrors = {
      name: registerForm.name.trim() ? '' : 'Full Name is required',
      username: validateUsername(registerForm.username),
      password: validatePassword(registerForm.password),
    };
    setRegisterErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  async function submitLogin(event) {
    event.preventDefault();
    setApiError('');
    if (!validateLogin()) return;

    setLoading(true);
    try {
      await login(loginForm.username.trim(), loginForm.password);
      onClose();
      navigate('/dashboard');
    } catch (err) {
      setApiError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setApiError('');
    if (!validateRegister()) return;

    setLoading(true);
    try {
      const data = await api.register({
        name: registerForm.name.trim(),
        username: registerForm.username.trim(),
        password: registerForm.password,
        email: registerForm.email.trim() || undefined,
        phone: registerForm.phone.trim() || undefined,
        role,
      });
      await login(data);
      onClose();
      navigate('/dashboard');
    } catch (err) {
      setApiError(err.message || 'Unable to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
        <div className="auth-modal-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')} type="button">LOGIN</button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')} type="button">REGISTER</button>
          <button className="auth-modal-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="auth-modal-body">
          {apiError && <div className="auth-error-banner">{apiError}</div>}

          {mode === 'login' ? (
            <form onSubmit={submitLogin}>
              <div className="form-group">
                <label htmlFor="auth-login-username">Username</label>
                <input
                  id="auth-login-username"
                  className="form-input"
                  type="text"
                  value={loginForm.username}
                  onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
                  required
                />
                {loginErrors.username && <p className="form-error">{loginErrors.username}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="auth-login-password">Password</label>
                <input
                  id="auth-login-password"
                  className="form-input"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                  required
                />
                {loginErrors.password && <p className="form-error">{loginErrors.password}</p>}
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <p className="auth-switch-text">
                Don't have an account?{' '}
                <button className="auth-switch-btn" type="button" onClick={() => switchMode('register')}>Register</button>
              </p>
            </form>
          ) : (
            <form onSubmit={submitRegister}>
              <div className="form-group">
                <label htmlFor="auth-register-name">Full Name</label>
                <input
                  id="auth-register-name"
                  className="form-input"
                  type="text"
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
                  required
                />
                {registerErrors.name && <p className="form-error">{registerErrors.name}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="auth-register-username">Username</label>
                <input
                  id="auth-register-username"
                  className="form-input"
                  type="text"
                  value={registerForm.username}
                  onChange={(event) => setRegisterForm({ ...registerForm, username: event.target.value })}
                  required
                />
                {registerErrors.username && <p className="form-error">{registerErrors.username}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="auth-register-password">Password</label>
                <input
                  id="auth-register-password"
                  className="form-input"
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                  required
                />
                {registerErrors.password && <p className="form-error">{registerErrors.password}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="auth-register-email">Email (optional)</label>
                <input
                  id="auth-register-email"
                  className="form-input"
                  type="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-register-phone">Phone (optional)</label>
                <input
                  id="auth-register-phone"
                  className="form-input"
                  type="tel"
                  value={registerForm.phone}
                  onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <div className="auth-role-badge">{roleLabel}</div>
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
              <p className="auth-switch-text">
                Already have an account?{' '}
                <button className="auth-switch-btn" type="button" onClick={() => switchMode('login')}>Sign In</button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
