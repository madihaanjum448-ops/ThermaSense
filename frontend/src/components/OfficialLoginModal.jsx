import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  User,
  Key,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Building2,
  BadgeCheck,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function OfficialLoginModal({ isOpen, onClose, onSuccess }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both officer username and security password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await login(username.trim(), password.trim());
    setIsSubmitting(false);

    if (result.success) {
      if (onSuccess) onSuccess(result.user);
      onClose();
    } else {
      setError(result.error || 'Authentication failed. Please check credentials.');
    }
  };

  const handleQuickFill = (demoUser, demoPass) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="gov-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="gov-modal-card official-login-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header official-login-header">
          <div className="modal-header-brand">
            <div className="official-auth-icon-badge">
              <ShieldAlert size={22} className="text-amber-400" />
            </div>
            <div>
              <h3 className="modal-heading">Authorized Official Sign In</h3>
              <p className="modal-subheading">
                State Disaster Management Authority & BBMP Command Console
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div className="official-auth-info-banner">
            <Lock size={15} className="flex-shrink-0" />
            <span>
              Restricted to authorized disaster management, public health, and municipal officials for issuing live intervention orders.
            </span>
          </div>

          {error && (
            <div className="gov-auth-error-banner" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="official-login-form">
            <div className="form-group">
              <label htmlFor="officer-username" className="form-label">
                <User size={14} />
                <span>Officer ID / Username</span>
              </label>
              <input
                id="officer-username"
                type="text"
                className="gov-form-input"
                placeholder="e.g. officer1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="officer-password" className="form-label">
                <Key size={14} />
                <span>Security Access PIN / Password</span>
              </label>
              <input
                id="officer-password"
                type="password"
                className="gov-form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {/* Quick Demo Credentials Helper */}
            <div className="demo-credentials-accordion">
              <button
                type="button"
                className="demo-credentials-toggle"
                onClick={() => setShowDemoAccounts(!showDemoAccounts)}
              >
                <div className="toggle-left">
                  <BadgeCheck size={14} className="text-emerald-400" />
                  <span className="toggle-text">Evaluation Demo Official Accounts</span>
                </div>
                {showDemoAccounts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showDemoAccounts && (
                <div className="demo-credentials-panel">
                  <p className="demo-hint-text">
                    Click an official below to auto-fill verified evaluation credentials:
                  </p>
                  <div className="demo-accounts-grid">
                    <button
                      type="button"
                      className="demo-account-chip"
                      onClick={() => handleQuickFill('officer1', 'demo123')}
                    >
                      <div className="chip-header">
                        <strong className="officer-name">R. Sharma</strong>
                        <span className="role-tag">officer1</span>
                      </div>
                      <div className="chip-details">
                        <Building2 size={12} />
                        <span>Disaster Management Officer (BBMP)</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="demo-account-chip"
                      onClick={() => handleQuickFill('officer2', 'demo123')}
                    >
                      <div className="chip-header">
                        <strong className="officer-name">A. Iyer</strong>
                        <span className="role-tag">officer2</span>
                      </div>
                      <div className="chip-details">
                        <Building2 size={12} />
                        <span>Municipal Health Officer (Health Dept)</span>
                      </div>
                    </button>
                  </div>
                  <div className="demo-pass-note">Default Demo Password: <code>demo123</code></div>
                </div>
              )}
            </div>

            <div className="modal-footer official-modal-footer">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn-confirm btn-official-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>Sign In as Official</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="modal-compliance-footer">
          <small>Disaster Management Act 2005 · Section 34 Compliance · NIC/BBMP Gateway</small>
        </div>
      </div>
    </div>
  );
}
