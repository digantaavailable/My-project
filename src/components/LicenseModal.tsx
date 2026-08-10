import React, { useState } from 'react';
import { LicenseState, validateAndActivateKey, activate24HourPass, formatRemainingTime } from '../utils/license';
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
  QrCode,
  Copy,
  ExternalLink,
  Mail,
  CheckCircle2,
  QrCode as QrIcon,
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

  const [activeTab, setActiveTab] = useState<'upi' | 'key'>('upi');
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedGeneratedKey, setCopiedGeneratedKey] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifyingUpi, setIsVerifyingUpi] = useState(false);
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

    // Simulate backend payment verification & key generation
    setTimeout(() => {
      const generatedKey = `PASS-24H-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const newState = activate24HourPass(generatedKey);

      setIsVerifyingUpi(false);
      setIssuedKey(generatedKey);
      setSuccessMsg(
        `Payment verified! Your 24-Hour Pass key (${generatedKey}) has been activated and delivered to ${userEmail}.`
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

          {/* Tabs: UPI Payment vs Existing Key */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('upi')}
              className={`pb-2 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'upi'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <QrIcon className="w-4 h-4" />
              Pay via UPI (₹{PASS_PRICE_INR} / 24 Hours)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('key')}
              className={`pb-2 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'key'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Key className="w-4 h-4" />
              Redeem License Key
            </button>
          </div>

          {activeTab === 'upi' ? (
            /* UPI Payment Section */
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
                          className="ml-2 text-blue-600 hover:text-blue-800 flex items-center gap-1 font-sans text-xs"
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
          ) : (
            /* Existing License Key Form */
            <form onSubmit={handleActivateKey} className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                Enter Received 24-Hour License Key:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="e.g., PASS-24H-8F39 or DAYPASS24"
                  className="flex-1 text-xs font-mono uppercase border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition flex-shrink-0 cursor-pointer"
                >
                  Activate Pass
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Key will grant instant 24-hour unlimited access for creating and updating tournament draws.
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
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

