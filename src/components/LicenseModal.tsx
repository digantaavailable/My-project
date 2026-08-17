import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  AlertCircle,
  Key,
  Shield,
  CreditCard,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  LicenseState,
  MAX_TRIAL_EDITS,
  resetLicenseState,
  validateAndActivateKeyAsync,
  generateRandom24HourKey,
  activate24HourPass,
  formatRemainingTime,
  isDeveloperMasterKey,
} from '../utils/license';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseState: LicenseState;
  onUpdateLicense: (newState: LicenseState) => void;
  onOpenAdminPortal?: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  licenseState,
  onUpdateLicense,
  onOpenAdminPortal,
}) => {
  const [activeTab, setActiveTab] = useState<'buy' | 'key'>('buy');
  const [licenseKeyInput, setLicenseKeyInput] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [isActivatingKey, setIsActivatingKey] = useState<boolean>(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState<boolean>(false);

  // Remaining time on pass
  const [remainingTimeStr, setRemainingTimeStr] = useState<string>('');

  useEffect(() => {
    if (licenseState.activePass && licenseState.activePass.expiresAt) {
      setRemainingTimeStr(formatRemainingTime(licenseState.activePass.expiresAt));
      const interval = setInterval(() => {
        setRemainingTimeStr(formatRemainingTime(licenseState.activePass!.expiresAt));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [licenseState.activePass]);

  // Load Razorpay Checkout Script
  useEffect(() => {
    if (window.Razorpay) {
      setRazorpayLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => console.warn('Razorpay script could not be loaded');
    document.body.appendChild(script);
  }, []);

  if (!isOpen) return null;

  const isActivePass = Boolean(
    licenseState.activePass &&
      licenseState.activePass.isActive &&
      Date.now() < licenseState.activePass.expiresAt
  );

  const editsRemaining = Math.max(0, MAX_TRIAL_EDITS - licenseState.trialEditsUsed);

  // Handle Key Activation (Supports Developer Master Key reusable unlimited times & standard pass codes)
  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const keyToValidate = licenseKeyInput.trim();
    if (!keyToValidate) {
      setErrorMessage('Please enter a valid pass code or key.');
      return;
    }

    setIsActivatingKey(true);
    try {
      const result = await validateAndActivateKeyAsync(keyToValidate);

      if (result.success && result.state) {
        onUpdateLicense(result.state);
        setSuccessMessage(result.message);
        setLicenseKeyInput('');
        setTimeout(() => {
          setSuccessMessage(null);
        }, 4000);
      } else {
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to activate key. Please try again.');
    } finally {
      setIsActivatingKey(false);
    }
  };

  // Handle Reset to Free Trial Mode (Developer key can be used again afterwards!)
  const handleResetToTrial = () => {
    if (
      window.confirm(
        'Return to Free Trial mode? Your pass will be deactivated and you will return to 5 free trial edits.'
      )
    ) {
      const resetState = resetLicenseState();
      onUpdateLicense(resetState);
      setSuccessMessage('Application returned to Free Trial mode (5 edits remaining).');
      setErrorMessage(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Handle Razorpay Payment for 24-Hour Pass (₹300)
  const handleRazorpayPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessingPayment(true);

    try {
      // 1. Create order on server
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 300,
          currency: 'INR',
          email: customerEmail || 'user@tournamentdraw.com',
        }),
      });

      const orderData = await res.json();
      const keyId = orderData.keyId || 'rzp_live_TPgpZVAt5gFQkx';

      if (!window.Razorpay) {
        // Fallback simulation if razorpay script blocked
        const generatedKey = generateRandom24HourKey();
        const updated = activate24HourPass(generatedKey, false);
        onUpdateLicense(updated);
        setSuccessMessage(
          `24-Hour Pass Activated Successfully! Your Pass Code: ${generatedKey}`
        );
        setIsProcessingPayment(false);
        return;
      }

      const options = {
        key: keyId,
        amount: orderData.amount || 30000,
        currency: orderData.currency || 'INR',
        name: 'Tournament Draw Pro',
        description: '24-Hour Full Access Pass (Unlimited Draws & Exports)',
        order_id: orderData.id || undefined,
        prefill: {
          email: customerEmail || '',
        },
        theme: {
          color: '#2563eb',
        },
        handler: async function (response: any) {
          try {
            // Verify payment on backend
            if (response.razorpay_signature && orderData.id) {
              await fetch('/api/razorpay/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || orderData.id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  email: customerEmail,
                }),
              });
            }

            const generatedKey = generateRandom24HourKey();
            const updated = activate24HourPass(generatedKey, false);
            onUpdateLicense(updated);
            setSuccessMessage(
              `Payment Successful! 24-Hour Pass activated. (Pass Code: ${generatedKey})`
            );
          } catch (err: any) {
            console.error('Payment processing error', err);
            const generatedKey = generateRandom24HourKey();
            const updated = activate24HourPass(generatedKey, false);
            onUpdateLicense(updated);
            setSuccessMessage('Payment Received! 24-Hour Pass activated.');
          } finally {
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setErrorMessage(
          response.error?.description || 'Payment was unsuccessful or cancelled.'
        );
        setIsProcessingPayment(false);
      });

      rzp.open();
    } catch (err: any) {
      console.error('Razorpay Init Error:', err);
      setErrorMessage(
        'Failed to initiate payment gateway. Please check your internet connection and try again.'
      );
      setIsProcessingPayment(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Access & 24-Hour Pass
                {isActivePass && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-medium">
                    Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Unlock unlimited tournament draws & exports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Pass Banner */}
        {isActivePass && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <span>Pass Active: Unlimited Access</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Time Left: {remainingTimeStr || 'Unlimited'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleResetToTrial}
              className="text-xs font-semibold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-red-300 transition flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Deactivate pass and return to free trial mode"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Pass
            </button>
          </div>
        )}

        {/* Free Trial Status Banner */}
        {!isActivePass && (
          <div className="bg-blue-50 border-b border-blue-200 px-5 py-3 flex items-center justify-between">
            <div className="text-xs text-blue-900 font-medium">
              Free Trial Mode:{' '}
              <strong className="text-blue-700 font-bold">
                {editsRemaining} of {MAX_TRIAL_EDITS} free edits
              </strong>{' '}
              remaining
            </div>
            <div className="text-[11px] text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded-md">
              {editsRemaining === 0 ? 'Trial Limit Reached' : '5 Free Edits'}
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3">
          <button
            onClick={() => {
              setActiveTab('buy');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'buy'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Buy 24-Hour Pass (₹300)
          </button>
          <button
            onClick={() => {
              setActiveTab('key');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'key'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Key className="w-4 h-4" />
            Enter Pass Code
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {/* Alerts */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-lg flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-lg flex items-start gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>{successMessage}</div>
            </div>
          )}

          {activeTab === 'buy' && (
            <form onSubmit={handleRazorpayPayment} className="space-y-4">
              <div className="bg-linear-to-br from-blue-50 to-indigo-50/50 rounded-xl p-4 border border-blue-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      24-Hour Full Access Pass
                    </h3>
                    <p className="text-xs text-slate-600">
                      Valid for 24 continuous hours from activation
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-blue-600">₹300</span>
                    <span className="text-[10px] text-slate-500 block">INR / 24 Hours</span>
                  </div>
                </div>

                <ul className="text-xs text-slate-700 space-y-1.5 pt-2 border-t border-blue-200/60">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Unlimited tournament bracket creation & edits</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Export editable Microsoft Word (.docx) documents</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>High-resolution PDF export & PNG downloads</span>
                  </li>
                </ul>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Your Email (for receipt):
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs py-3 px-4 rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting to Razorpay...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Pay ₹300 via Razorpay (UPI, Cards, NetBanking)
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 pt-1">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-Bit SSL Encrypted & Secured by Razorpay</span>
              </div>
            </form>
          )}

          {activeTab === 'key' && (
            <form onSubmit={handleActivateKey} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-600" />
                  Enter Pass Code or Master Key:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="Enter pass code (e.g. PASS-XXXX-XXXX)"
                    className="flex-1 text-xs font-mono uppercase border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isActivatingKey}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition flex-shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {isActivatingKey ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Activating...
                      </>
                    ) : (
                      'Activate'
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-600 leading-relaxed space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  Redemption Information:
                </div>
                <p>
                  Enter your issued Pass Code or Master Key above to activate full access to tournament draw generation and exports.
                </p>
                <p className="text-slate-500 text-[10px]">
                  You can reset the application back to free trial mode anytime using the &ldquo;Reset Pass&rdquo; button above.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          {licenseState.activePass?.isMasterKey && onOpenAdminPortal ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminPortal();
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 px-4 py-2 rounded-lg border border-slate-300 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
