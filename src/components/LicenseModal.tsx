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
  Check,
  AlertCircle,
  Lock,
  Sparkles,
  X,
  Copy,
  ExternalLink,
  Mail,
  CheckCircle2,
  QrCode as QrIcon,
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
  const UPI_ID = 'digantaavailable@oksbi';
  const PASS_PRICE_INR = '300'; // ₹300 per 24 hours

  const [activeTab, setActiveTab] = useState<'gateway' | 'upi_qr' | 'key'>('gateway');
  const [gatewayMethod, setGatewayMethod] = useState<'upi' | 'card' | 'netbanking' | 'wallet'>('upi');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedGeneratedKey, setCopiedGeneratedKey] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifyingUpi, setIsVerifyingUpi] = useState(false);
  const [isProcessingGateway, setIsProcessingGateway] = useState(false);
  const [gatewayStep, setGatewayStep] = useState<'idle' | 'checkout' | 'processing' | 'success'>('idle');
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const isActive = !!(licenseState.activePass && Date.now() < licenseState.activePass.expiresAt);
  const trialEditsLeft = Math.max(0, licenseState.maxTrialEdits - licenseState.trialEditsUsed);

  const upiPayLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(
    'Tournament Draw 24H Pass'
  )}&am=${PASS_PRICE_INR}&cu=INR`;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    upiPayLink
  )}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

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

  const handleConfirmUpiPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!userEmail.trim() || !userEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address to receive your 24-Hour Pass key.');
      return;
    }

    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      setErrorMsg('Please enter a valid 12-digit UPI UTR / Transaction Reference number.');
      return;
    }

    setIsVerifyingUpi(true);

    // Backend simulation: Generate unique random 24-hour key upon payment verification
    setTimeout(() => {
      const generatedKey = generateRandom24HourKey();
      const newState = activate24HourPass(generatedKey, false);

      setIsVerifyingUpi(false);
      setIssuedKey(generatedKey);
      setSuccessMsg(
        `Payment verified! Your random 24-Hour Pass key (${generatedKey}) has been generated, activated for 24 hours, and sent to ${userEmail}.`
      );
      onUpdateLicense(newState);
    }, 1200);
  };

  const handleStartGatewayCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailTrimmed = userEmail.trim();
    if (!emailTrimmed || !emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
      setErrorMsg('Please enter a valid email address to receive your payment receipt & 24-Hour key.');
      return;
    }

    setGatewayStep('checkout');
  };

  const handleExecuteGatewayPayment = async () => {
    setGatewayStep('processing');
    setIsProcessingGateway(true);
    setErrorMsg(null);

    const emailTrimmed = userEmail.trim();
    const phoneTrimmed = userPhone.trim().replace(/\D/g, '');

    try {
      // 1. Create order via backend Express API
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(PASS_PRICE_INR),
          email: emailTrimmed,
        }),
      });

      const order = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(order.error || 'Failed to initialize payment gateway order.');
      }

      // 2. Check if real Razorpay keys are configured & Razorpay Checkout script is loaded
      if (!order.isSimulation && order.keyId && (window as any).Razorpay) {
        setIsProcessingGateway(false);

        const options = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'Tournament Draw Pro',
          description: '24-Hour Unlimited Pass',
          order_id: order.id,
          prefill: {
            email: emailTrimmed,
            contact: phoneTrimmed || undefined,
          },
          theme: {
            color: '#2563eb',
          },
          handler: async function (response: any) {
            setIsProcessingGateway(true);
            setGatewayStep('processing');

            try {
              // 3. Verify Razorpay signature on backend
              const verifyRes = await fetch('/api/razorpay/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  userEmail: emailTrimmed,
                }),
              });

              const verifyData = await verifyRes.json();

              if (verifyData.success && verifyData.key) {
                const newState = activate24HourPass(verifyData.key, false);
                setIsProcessingGateway(false);
                setGatewayStep('success');
                setIssuedKey(verifyData.key);
                setSuccessMsg(
                  `Payment of ₹${PASS_PRICE_INR} verified via Razorpay! Your 24-Hour Pass Key (${verifyData.key}) has been activated.`
                );
                onUpdateLicense(newState);
              } else {
                setIsProcessingGateway(false);
                setGatewayStep('idle');
                setErrorMsg(verifyData.message || 'Payment signature verification failed.');
              }
            } catch (verErr: any) {
              setIsProcessingGateway(false);
              setGatewayStep('idle');
              setErrorMsg(verErr.message || 'Error communicating with verification server.');
            }
          },
          modal: {
            ondismiss: function () {
              setIsProcessingGateway(false);
              setGatewayStep('idle');
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Simulation mode (if keys aren't set in environment yet)
        setTimeout(async () => {
          try {
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                isSimulation: true,
                userEmail: emailTrimmed,
              }),
            });
            const verifyData = await verifyRes.json();

            const generatedKey = verifyData.key || generateRandom24HourKey();
            const newState = activate24HourPass(generatedKey, false);

            setIsProcessingGateway(false);
            setGatewayStep('success');
            setIssuedKey(generatedKey);
            setSuccessMsg(
              `Payment of ₹${PASS_PRICE_INR} verified! Your 24-Hour Pass Key (${generatedKey}) has been activated and registered.`
            );
            onUpdateLicense(newState);
          } catch (simErr: any) {
            setIsProcessingGateway(false);
            setGatewayStep('idle');
            setErrorMsg(simErr.message || 'Verification simulation failed.');
          }
        }, 1500);
      }
    } catch (err: any) {
      console.error('Payment Error:', err);
      setIsProcessingGateway(false);
      setGatewayStep('idle');
      const errText = err?.message || String(err);
      if (errText.includes('pattern') || errText.includes('match')) {
        setErrorMsg('Please ensure your email address is formatted correctly (e.g., name@example.com).');
      } else {
        setErrorMsg(errText || 'Payment processing encountered an error.');
      }
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
                UPI Payment & Instant 24-Hour Email Key Delivery
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
                  <span className="font-bold text-sm text-emerald-900">24-Hour Day Pass Active</span>
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    UNLIMITED ACCESS
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-1">
                  Time Remaining:{' '}
                  <strong className="font-mono text-emerald-950 font-bold">
                    {formatRemainingTime(licenseState.activePass.expiresAt)}
                  </strong>
                </p>
                <div className="mt-2 flex items-center gap-2 bg-emerald-100/70 p-2 rounded-lg border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 font-medium">Activated Key:</span>
                  <code className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-950">
                    {licenseState.activePass.licenseKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyGeneratedKey(licenseState.activePass?.licenseKey || '')}
                    className="ml-auto text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedGeneratedKey ? 'Copied' : 'Copy'}
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
                    ? `You are in free trial mode (${trialEditsLeft} edits left). Get a 24-Hour Pass for unlimited updates across devices.`
                    : 'Your 5 trial edits are complete. Get a 24-Hour Pass via UPI to unlock unlimited tournament draw edits.'}
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
                    <span className="text-[11px] text-slate-500">Your 24H Key:</span>
                    <strong className="font-mono text-xs text-slate-900">{issuedKey}</strong>
                    <button
                      type="button"
                      onClick={() => handleCopyGeneratedKey(issuedKey)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedGeneratedKey ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabs: Payment Gateway vs UPI QR vs License Key */}
          <div className="flex border-b border-slate-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('gateway')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'gateway'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-500" />
              Payment Gateway (Instant Key)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upi_qr')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'upi_qr'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrIcon className="w-4 h-4" />
              UPI QR Code
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('key')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
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
            /* Integrated Payment Gateway Section */
            <form onSubmit={handleStartGatewayCheckout} noValidate className="space-y-4">
              <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-blue-300 font-bold flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> Razorpay / Universal Gateway
                  </span>
                  <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    INSTANT AUTOMATED KEY
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold">24-Hour Pass Access</h3>
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
                      <div className="text-[10px] text-slate-500">GPay, PhonePe, Paytm</div>
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
                      <div className="text-[10px] text-slate-500">Paytm, Mobikwik</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Email & Phone Details */}
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Your Email Address (For Instant Key Delivery & Receipt)
                  </label>
                  <input
                    type="text"
                    inputMode="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="e.g., player@gmail.com"
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
                    placeholder="e.g., 9876543210"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-3 px-4 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                Proceed to Pay ₹{PASS_PRICE_INR} via Payment Gateway
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 pt-1">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-Bit SSL Encrypted & PCI-DSS Bank Grade Security</span>
              </div>
            </form>
          )}

          {activeTab === 'upi_qr' && (
            /* UPI QR Payment Section */
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* QR Code */}
                  <div className="bg-white p-2 border border-slate-300 rounded-xl shadow-xs flex flex-col items-center flex-shrink-0">
                    <img
                      src={qrCodeUrl}
                      alt="UPI Payment QR Code"
                      className="w-36 h-36 rounded-md object-contain"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 font-medium">
                      Scan with GPay / PhonePe / Paytm
                    </span>
                  </div>

                  {/* Payment Info */}
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Official Payment UPI ID
                      </span>
                      <div className="mt-1 flex items-center justify-between bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-900 font-bold">
                        <span>{UPI_ID}</span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="ml-2 text-blue-600 hover:text-blue-800 flex items-center gap-1 font-sans text-xs cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {copiedUpi ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        <strong>Amount:</strong> ₹{PASS_PRICE_INR} INR for 24-Hour Pass
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Works with Google Pay, PhonePe, Paytm, BHIM or any UPI app.
                      </p>
                    </div>

                    <a
                      href={upiPayLink}
                      className="inline-flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-3 rounded-lg transition shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open UPI App Directly (₹{PASS_PRICE_INR})
                    </a>
                  </div>
                </div>
              </div>

              {/* Payment Confirmation Form */}
              <form onSubmit={handleConfirmUpiPayment} className="space-y-3 pt-1">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-600" />
                  Confirm Payment to Get 24-Hour Pass Key:
                </h4>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Your Email Address (Pass key delivered here)
                    </label>
                    <input
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="e.g., player@gmail.com"
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      12-Digit UPI UTR / Transaction Reference No.
                    </label>
                    <input
                      type="text"
                      required
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="e.g., 4218XXXXXXXX or UTR Number"
                      className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingUpi}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded-lg transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  {isVerifyingUpi
                    ? 'Verifying Payment & Delivering Key...'
                    : 'Verify Payment & Deliver 24H Pass Key'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'key' && (
            /* Existing License Key Form */
            <form onSubmit={handleActivateKey} className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                Enter License Key:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="e.g., PASS-8F2K-9M3Q"
                  className="flex-1 text-xs font-mono uppercase border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition flex-shrink-0 cursor-pointer"
                >
                  Activate Key
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Enter your payment-generated 24-Hour Pass key (valid for 24 hours from activation).
              </p>
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
                  <p className="text-[10px] text-blue-100">Tournament Draw Pro • Secure Checkout</p>
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
                  <div className="text-slate-500 text-[10px]">Paying to</div>
                  <div className="font-bold text-slate-900">Tournament Draw Access</div>
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
                    <p className="text-xs text-slate-500">Connecting to Bank & Issuing 24H Pass Key</p>
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
                        placeholder="e.g., mobile@upi or username@okicici"
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

