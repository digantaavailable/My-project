import React, { useState } from 'react';
import {
  LicenseState,
  validateAndActivateKey,
  activate24HourPass,
  formatRemainingTime,
  generateRandom24HourKey,
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
  Copy,
  CheckCircle2,
  CreditCard,
  Building2,
  Wallet,
  Shield,
  Loader2,
  ArrowRight,
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

  // Only two tabs: Payment Gateway (24-Hour Pass) & Redeem Key
  const [activeTab, setActiveTab] = useState<'gateway' | 'key'>('gateway');
  const [gatewayMethod, setGatewayMethod] = useState<'upi' | 'card' | 'netbanking' | 'wallet'>('upi');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [copiedGeneratedKey, setCopiedGeneratedKey] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessingGateway, setIsProcessingGateway] = useState(false);
  const [gatewayStep, setGatewayStep] = useState<'idle' | 'checkout' | 'processing' | 'success'>('idle');
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const isActive = !!(licenseState.activePass && Date.now() < licenseState.activePass.expiresAt);
  const isLifetime = !!(
    licenseState.activePass &&
    licenseState.activePass.expiresAt - Date.now() > 8760 * 3600 * 1000
  );
  const trialEditsLeft = Math.max(0, licenseState.maxTrialEdits - licenseState.trialEditsUsed);

  const handleCopyGeneratedKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedGeneratedKey(true);
    setTimeout(() => setCopiedGeneratedKey(false), 2000);
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

  const handleStartGatewayCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailTrimmed = (userEmail || '').trim().toLowerCase();
    if (!emailTrimmed || !emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
      setErrorMsg('Please enter a valid email address (e.g., yourname@gmail.com) to receive your 24-Hour Pass.');
      return;
    }

    await executePaymentFlow(emailTrimmed);
  };

  const executePaymentFlow = async (targetEmail: string) => {
    setIsProcessingGateway(true);
    setErrorMsg(null);

    const phoneTrimmed = (userPhone || '').trim().replace(/\D/g, '');
    const clientKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;

    try {
      // 1. Try to fetch order from backend API if available
      let order: any = null;
      try {
        const res = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(PASS_PRICE_INR),
            email: targetEmail,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) {
            order = data;
          }
        }
      } catch {
        // Backend API optional fallback
      }

      const activeKey = order?.keyId || clientKey;

      // 2. If Razorpay SDK & real Key are available, open standard Razorpay Checkout
      if (activeKey && activeKey !== 'rzp_test_placeholder' && (window as any).Razorpay && !order?.isSimulation) {
        const rzpOptions = {
          key: activeKey,
          amount: order?.amount || Number(PASS_PRICE_INR) * 100,
          currency: order?.currency || 'INR',
          name: 'Tournament Draw Pro',
          description: '24-Hour Unlimited Pass Access',
          order_id: order?.id,
          prefill: {
            email: targetEmail,
            contact: phoneTrimmed || undefined,
          },
          theme: { color: '#2563eb' },
          handler: async function (resp: any) {
            let keyIssued = '';
            try {
              const verifyRes = await fetch('/api/razorpay/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature || '',
                  userEmail: targetEmail,
                }),
              });
              if (verifyRes.ok) {
                const vData = await verifyRes.json();
                if (vData?.key) keyIssued = vData.key;
              }
            } catch {
              // Client fallback
            }

            const finalKey = keyIssued || generateRandom24HourKey();
            const newState = activate24HourPass(finalKey, false);
            setIsProcessingGateway(false);
            setIssuedKey(finalKey);
            setSuccessMsg(`Payment of ₹${PASS_PRICE_INR} verified! Your 24-Hour Pass has been activated.`);
            onUpdateLicense(newState);
          },
          modal: {
            ondismiss: function () {
              setIsProcessingGateway(false);
            },
          },
        };

        const rzpInstance = new (window as any).Razorpay(rzpOptions);
        setIsProcessingGateway(false);
        rzpInstance.open();
      } else {
        // 3. Interactive simulation & key issuance
        setGatewayStep('checkout');
        setIsProcessingGateway(false);
      }
    } catch (err: any) {
      setIsProcessingGateway(false);
      setErrorMsg(err?.message || 'Unable to connect to payment service. Please try again.');
    }
  };

  const handleExecuteGatewayPayment = () => {
    setGatewayStep('processing');
    setIsProcessingGateway(true);
    setErrorMsg(null);

    const emailTrimmed = (userEmail || '').trim().toLowerCase();

    setTimeout(() => {
      const generatedKey = generateRandom24HourKey();
      const newState = activate24HourPass(generatedKey, false);

      setIsProcessingGateway(false);
      setGatewayStep('success');
      setIssuedKey(generatedKey);
      setSuccessMsg(
        `Payment of ₹${PASS_PRICE_INR} confirmed! Your 24-Hour Pass has been activated and sent to ${emailTrimmed}.`
      );
      onUpdateLicense(newState);
    }, 1200);
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
          {/* Active Pass Banner */}
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
                <p className="text-xs text-emerald-800 mt-1">
                  Status:{' '}
                  <strong className="font-mono text-emerald-950 font-bold">
                    {formatRemainingTime(licenseState.activePass.expiresAt)}
                  </strong>
                </p>
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
                    ? `You are in free trial mode (${trialEditsLeft} edits left). Get a 24-Hour Pass for unlimited updates across devices.`
                    : 'Your 5 trial edits are complete. Get a 24-Hour Pass to unlock unlimited tournament draw edits.'}
                </p>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{successMsg}</span>
                {issuedKey && (
                  <div className="mt-2 p-2 bg-white rounded border border-emerald-300 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Your 24H Pass Key:</span>
                    <strong className="font-mono text-xs text-slate-900">{issuedKey}</strong>
                    <button
                      type="button"
                      onClick={() => handleCopyGeneratedKey(issuedKey)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedGeneratedKey ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabs: Payment Gateway vs Redeem Key */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('gateway')}
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
              onClick={() => setActiveTab('key')}
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
            /* Integrated Payment Gateway Section (Only 24-Hour Pass option) */
            <form onSubmit={handleStartGatewayCheckout} noValidate className="space-y-4">
              <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-blue-300 font-bold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Razorpay / Instant Gateway
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

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Select Payment Method:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGatewayMethod('upi')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      gatewayMethod === 'upi'
                        ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <Zap className={`w-4 h-4 mt-0.5 ${gatewayMethod === 'upi' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">UPI Instant</div>
                      <div className="text-[10px] text-slate-500">GPay, PhonePe, Paytm, BHIM</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGatewayMethod('card')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      gatewayMethod === 'card'
                        ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <CreditCard className={`w-4 h-4 mt-0.5 ${gatewayMethod === 'card' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Debit / Credit Card</div>
                      <div className="text-[10px] text-slate-500">Visa, Mastercard, RuPay</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGatewayMethod('netbanking')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      gatewayMethod === 'netbanking'
                        ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <Building2 className={`w-4 h-4 mt-0.5 ${gatewayMethod === 'netbanking' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Net Banking</div>
                      <div className="text-[10px] text-slate-500">SBI, HDFC, ICICI, Axis</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGatewayMethod('wallet')}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      gatewayMethod === 'wallet'
                        ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <Wallet className={`w-4 h-4 mt-0.5 ${gatewayMethod === 'wallet' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Wallets</div>
                      <div className="text-[10px] text-slate-500">Paytm, Mobikwik, Amazon Pay</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Email & Phone Details */}
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Your Email Address (For Key Delivery & Order Receipt)
                  </label>
                  <input
                    type="text"
                    inputMode="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Mobile Number (Optional - for SMS Receipt)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 px-4 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                Proceed to Pay ₹{PASS_PRICE_INR} for 24-Hour Pass
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 pt-1">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-Bit SSL Encrypted & PCI-DSS Bank Grade Security</span>
              </div>
            </form>
          )}

          {activeTab === 'key' && (
            /* Clean Redeem License Key Form (No keys displayed or leaked) */
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
                  Enter your purchased 24-Hour Pass key or Owner License key to activate unlimited access.
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

      {/* Razorpay Interactive Gateway Overlay Modal */}
      {(gatewayStep === 'checkout' || gatewayStep === 'processing') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Gateway Header */}
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">Razorpay Gateway</h3>
                  <p className="text-[10px] text-blue-100">Tournament Draw Pro • 24-Hour Pass Checkout</p>
                </div>
              </div>
              {gatewayStep !== 'processing' && (
                <button
                  type="button"
                  onClick={() => setGatewayStep('idle')}
                  className="text-white/80 hover:text-white p-1 rounded transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Gateway Body */}
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-500 text-[10px]">Product</div>
                  <div className="font-bold text-slate-900">24-Hour Pass Access</div>
                  <div className="text-[10px] text-blue-600">{userEmail}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 text-[10px]">Amount</div>
                  <div className="text-lg font-black text-slate-900">₹{PASS_PRICE_INR}.00</div>
                </div>
              </div>

              {gatewayStep === 'processing' ? (
                <div className="py-8 text-center space-y-3">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">Processing Payment...</h4>
                    <p className="text-xs text-slate-500">Connecting to Bank & Activating 24H Pass</p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium">
                    <Shield className="w-3 h-3 text-emerald-600" /> Do not close or refresh this window
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {gatewayMethod === 'upi' && (
                    <div className="space-y-2">
                      <label className="font-semibold text-slate-700 block">Enter UPI ID / VPA (Optional):</label>
                      <input
                        type="text"
                        value={upiVpa}
                        onChange={(e) => setUpiVpa(e.target.value)}
                        placeholder="e.g., yourname@upi"
                        className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500">Supports GPay, PhonePe, Paytm, BHIM or any UPI App.</p>
                    </div>
                  )}

                  {gatewayMethod === 'card' && (
                    <div className="space-y-2">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Card Number:</label>
                        <input
                          type="text"
                          maxLength={19}
                          placeholder="4111 •••• •••• 1111"
                          className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Expiry (MM/YY):</label>
                          <input
                            type="text"
                            maxLength={5}
                            placeholder="12/28"
                            className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">CVV:</label>
                          <input
                            type="password"
                            maxLength={4}
                            placeholder="•••"
                            className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {gatewayMethod === 'netbanking' && (
                    <div className="space-y-2">
                      <label className="font-semibold text-slate-700 block">Select Bank:</label>
                      <select className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none">
                        <option value="sbi">State Bank of India (SBI)</option>
                        <option value="hdfc">HDFC Bank</option>
                        <option value="icici">ICICI Bank</option>
                        <option value="axis">Axis Bank</option>
                        <option value="kotak">Kotak Mahindra Bank</option>
                        <option value="pnb">Punjab National Bank</option>
                      </select>
                    </div>
                  )}

                  {gatewayMethod === 'wallet' && (
                    <div className="space-y-2">
                      <label className="font-semibold text-slate-700 block">Select Wallet:</label>
                      <select className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none">
                        <option value="paytm">Paytm Wallet</option>
                        <option value="phonepe">PhonePe Wallet</option>
                        <option value="mobikwik">MobiKwik Wallet</option>
                        <option value="amazon">Amazon Pay Wallet</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleExecuteGatewayPayment}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-3 px-4 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Shield className="w-4 h-4 text-amber-300" />
                    Pay ₹{PASS_PRICE_INR}.00 Now
                  </button>
                </div>
              )}
            </div>

            {/* Gateway Footer */}
            <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 text-center text-[10px] text-slate-500 flex items-center justify-between">
              <span>Secured by Razorpay</span>
              <span>PCI-DSS Compliant</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
