import React, { useState, useEffect } from 'react';
import {
  LicenseState,
  validateAndActivateKey,
  activate24HourPass,
  resetLicenseState,
  formatRemainingTime,
} from '../utils/license';
import {
  Key,
  ShieldCheck,
  Clock,
  Zap,
  AlertCircle,
  Lock,
  Sparkles,
  X,
  CheckCircle2,
  Shield,
  Loader2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseState: LicenseState;
  onUpdateLicense: (newState: LicenseState) => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  licenseState,
  onUpdateLicense,
}) => {
  const PASS_PRICE_INR = '300'; // ₹300 per 24-Hour Day Pass

  // Tabs: Payment Gateway (24-Hour Pass) & Redeem Key
  const [activeTab, setActiveTab] = useState<'gateway' | 'key'>('gateway');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessingGateway, setIsProcessingGateway] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Live timer tick for active pass countdown
  useEffect(() => {
    if (!licenseState.activePass) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [licenseState.activePass]);

  if (!isOpen) return null;

  const isActive = !!(
    licenseState.activePass &&
    licenseState.activePass.expiresAt &&
    now < licenseState.activePass.expiresAt
  );
  const isLifetime = !!(
    licenseState.activePass &&
    licenseState.activePass.expiresAt - now > 8760 * 3600 * 1000
  );
  const trialEditsLeft = Math.max(0, licenseState.maxTrialEdits - licenseState.trialEditsUsed);

  // Manual reset of license to clear un-paid / simulated pass
  const handleResetLicense = () => {
    const freshState = resetLicenseState();
    onUpdateLicense(freshState);
    setErrorMsg(null);
    setSuccessMsg('Pass has been reset. You are now in Free Trial mode.');
  };

  const handleActivateKey = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = validateAndActivateKey(licenseKeyInput);
    if (result.success && result.state) {
      setSuccessMsg(result.message);
      onUpdateLicense(result.state);
      setLicenseKeyInput('');
    } else {
      setErrorMsg(result.message);
    }
  };

  // Helper to safely load Razorpay SDK
  const loadRazorpaySdk = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      const existingScript = document.querySelector('script[src*="razorpay.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleStartGatewayCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailTrimmed = (userEmail || '').trim().toLowerCase();
    if (!emailTrimmed || !emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
      setErrorMsg('Please enter a valid email address (e.g., yourname@gmail.com) for your receipt.');
      return;
    }

    setIsProcessingGateway(true);

    try {
      // 1. Call backend to create Razorpay Order
      let orderRes: Response;
      try {
        orderRes = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(PASS_PRICE_INR),
            email: emailTrimmed,
          }),
        });
      } catch {
        setIsProcessingGateway(false);
        setErrorMsg('Unable to connect to the backend server. Please check your network connection.');
        return;
      }

      let orderData: any = null;
      try {
        orderData = await orderRes.json();
      } catch {
        // failed to parse JSON
      }

      if (!orderRes.ok || !orderData || !orderData.id) {
        setIsProcessingGateway(false);
        const backendError = orderData?.error || 'Payment gateway order creation failed.';
        setErrorMsg(
          `${backendError} If you have an Owner Key, please use the "Redeem Key" tab to activate directly.`
        );
        return;
      }

      // 2. Ensure Razorpay SDK is loaded
      const isSdkLoaded = await loadRazorpaySdk();
      if (!isSdkLoaded || !(window as any).Razorpay) {
        setIsProcessingGateway(false);
        setErrorMsg('Unable to load Razorpay payment window. Please check your network or ad-blocker.');
        return;
      }

      const activeKey = orderData.keyId || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
      const phoneTrimmed = (userPhone || '').trim().replace(/\D/g, '');

      // 3. Configure and open Razorpay Checkout
      const rzpOptions = {
        key: activeKey,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Tournament Draw Pro',
        description: '24-Hour Pass (Unlimited Tournament Edits)',
        order_id: orderData.id,
        prefill: {
          email: emailTrimmed,
          contact: phoneTrimmed || undefined,
        },
        theme: { color: '#2563eb' },
        handler: async function (response: any) {
          setIsProcessingGateway(true);
          try {
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              // Activate 24-Hour pass directly upon verified payment. No key displayed.
              const newState = activate24HourPass(`PAID-${response.razorpay_payment_id}`, false);
              onUpdateLicense(newState);
              setSuccessMsg('Payment Successful! 24-Hour Pass activated and countdown started.');
              setErrorMsg(null);
            } else {
              setErrorMsg(verifyData.message || 'Payment signature verification failed.');
            }
          } catch (err: any) {
            console.error('Verification error:', err);
            setErrorMsg('Network error while verifying payment.');
          } finally {
            setIsProcessingGateway(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessingGateway(false);
          },
        },
      };

      try {
        const rzp = new (window as any).Razorpay(rzpOptions);
        rzp.on('payment.failed', function (resp: any) {
          setIsProcessingGateway(false);
          setErrorMsg(`Payment Failed: ${resp.error?.description || 'Transaction was declined.'}`);
        });
        setIsProcessingGateway(false);
        rzp.open();
      } catch (sdkErr: any) {
        setIsProcessingGateway(false);
        setErrorMsg(sdkErr?.message || 'Failed to open Razorpay payment gateway.');
      }
    } catch (err: any) {
      setIsProcessingGateway(false);
      setErrorMsg(err?.message || 'Payment initialization error. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                24-Hour Pass & License Access
              </h2>
              <p className="text-xs text-slate-400">
                Unlock Unlimited Tournament Draw Creation & Editing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Active Pass Banner with Live Countdown */}
          {isActive && licenseState.activePass ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-900">
                    {isLifetime ? 'Owner Lifetime Access Active' : '24-Hour Day Pass Active'}
                  </span>
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    UNLIMITED ACCESS
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-emerald-800">
                    Remaining Time:{' '}
                    <strong className="font-mono text-emerald-950 font-bold">
                      {formatRemainingTime(licenseState.activePass.expiresAt)}
                    </strong>
                  </p>
                  <button
                    type="button"
                    onClick={handleResetLicense}
                    className="text-[11px] text-emerald-700 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer transition underline decoration-emerald-300"
                    title="Reset back to Free Trial"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Pass
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Trial Status Notice */
            <div
              className={`rounded-xl p-4 border flex items-start gap-3 ${
                trialEditsLeft > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {trialEditsLeft > 0 ? (
                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Lock className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider">
                    {trialEditsLeft > 0 ? 'Free Trial Mode' : 'Free Trial Expired'}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      trialEditsLeft > 0
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-rose-200 text-rose-900'
                    }`}
                  >
                    {trialEditsLeft} / {licenseState.maxTrialEdits} edits left
                  </span>
                </div>
                <p className="text-xs mt-1 leading-relaxed">
                  {trialEditsLeft > 0
                    ? `You are in free trial mode (${trialEditsLeft} edits left). Get a 24-Hour Pass to start 24 hours of unlimited updates.`
                    : 'Your 5 trial edits are complete. Get a 24-Hour Pass to unlock unlimited tournament draw edits.'}
                </p>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">{successMsg}</span>
              </div>
            </div>
          )}

          {/* Tabs: Payment Gateway vs Redeem Key */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab('gateway');
                setErrorMsg(null);
              }}
              className={`flex-1 pb-2.5 text-center text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'gateway'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              Payment Gateway (24-Hour Pass)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('key');
                setErrorMsg(null);
              }}
              className={`flex-1 pb-2.5 text-center text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'key'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Key className="w-4 h-4" />
              Redeem Key
            </button>
          </div>

          {activeTab === 'gateway' && (
            /* Razorpay Payment Gateway Form */
            <form onSubmit={handleStartGatewayCheckout} noValidate className="space-y-4">
              <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-blue-300 font-bold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Razorpay Payment Gateway
                  </span>
                  <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    INSTANT 24H ACCESS
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold">24-Hour Day Pass</h3>
                    <p className="text-xs text-blue-200">Unlimited tournament draw creation & updates</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-amber-400">₹{PASS_PRICE_INR}</div>
                    <div className="text-[10px] text-slate-300">INC. ALL TAXES</div>
                  </div>
                </div>
              </div>

              {/* Email & Mobile Input */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Your Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="e.g., yourname@gmail.com"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Your Razorpay payment receipt will be sent to this email.
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-800 mb-1">Payment Methods Accepted via Razorpay:</p>
                <p className="text-slate-500">
                  UPI (GPay, PhonePe, Paytm, BHIM), Debit & Credit Cards (Visa, Mastercard, RuPay), Net Banking, and Wallets.
                </p>
              </div>

              <button
                type="submit"
                disabled={isProcessingGateway}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs py-3 px-4 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessingGateway ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening Payment Gateway...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    Proceed to Pay ₹{PASS_PRICE_INR} for 24-Hour Pass
                    <ArrowRight className="w-4 h-4" />
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
            /* Clean Redeem Key Form (No keys displayed or exposed) */
            <form onSubmit={handleActivateKey} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-600" />
                  Enter License Key:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="Enter License Key"
                    className="flex-1 text-xs font-mono uppercase border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition flex-shrink-0 cursor-pointer shadow-xs"
                  >
                    Activate Key
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <p>
                  Enter your Owner License key to activate unlimited permanent access.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
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
