import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../../shared/api/axiosInstance';
import { userAuthService } from '../../user/services/authService';
import { userService } from '../../user/services/userService';
import {
  clearPendingPhonePeRedirect,
  readPendingPhonePeRedirect,
  resolvePendingPhonePeTransaction,
} from '../../../shared/utils/phonePeResume';

const FLOWS = {
  'user-wallet': {
    flowKey: 'user-wallet-topup',
    targetPath: '/taxi/user/wallet',
    label: 'Wallet top-up',
    verify: (merchantTransactionId) => userAuthService.verifyPhonePeWalletTopup(merchantTransactionId),
  },
  'driver-wallet': {
    flowKey: 'driver-wallet-topup',
    targetPath: '/taxi/driver/wallet',
    label: 'Driver wallet top-up',
    verify: (merchantTransactionId) => api.get(`/drivers/wallet/top-up/phonepe/status/${merchantTransactionId}`),
  },
  'user-rental': {
    flowKey: 'user-rental-advance',
    targetPath: '/rental/deposit',
    label: 'Rental advance',
    verify: (merchantTransactionId) => userService.verifyPhonePeRentalAdvancePayment(merchantTransactionId),
  },
};

const normalizeResponse = (response) => response?.data || response || {};

const PhonePeStatusPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Please wait while we confirm your PhonePe payment.');
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef(null);

  const flow = String(searchParams.get('flow') || '').trim();
  const config = FLOWS[flow] || null;
  const merchantTransactionId = config
    ? resolvePendingPhonePeTransaction(config.flowKey, `?${searchParams.toString()}`)
    : '';
  const pendingPayload = config ? readPendingPhonePeRedirect(config.flowKey) || {} : {};

  const destinationUrl = useMemo(() => {
    if (!config?.targetPath || !merchantTransactionId) return config?.targetPath || '/';
    return `${config.targetPath}?phonepe_txn=${encodeURIComponent(merchantTransactionId)}`;
  }, [config?.targetPath, merchantTransactionId]);

  useEffect(() => {
    if (!config || !merchantTransactionId) {
      setStatus('failed');
      setMessage('Invalid PhonePe payment reference.');
      return undefined;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        const response = await config.verify(merchantTransactionId);
        if (cancelled) return;

        const payload = normalizeResponse(response);
        const data = payload?.data || {};
        const nextStatus = String(data.status || payload.status || '').trim().toLowerCase();

        if (nextStatus === 'paid') {
          clearPendingPhonePeRedirect(config.flowKey);
          setStatus('paid');
          setMessage(`${config.label} confirmed. Redirecting...`);
          window.setTimeout(() => {
            if (!cancelled) navigate(destinationUrl, { replace: true });
          }, 800);
          return;
        }

        if (nextStatus === 'failed') {
          setStatus('failed');
          setMessage(payload?.message || 'PhonePe payment was not completed.');
          return;
        }

        setStatus('pending');
        setMessage(payload?.message || 'PhonePe payment is still pending. We will retry automatically.');

        if (attempt < 9) {
          timerRef.current = window.setTimeout(() => {
            setAttempt((current) => current + 1);
          }, 2500);
        }
      } catch (error) {
        if (cancelled) return;
        setStatus('failed');
        setMessage(error?.message || 'Could not verify PhonePe payment.');
      }
    };

    verify();

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [attempt, config, destinationUrl, merchantTransactionId, navigate]);

  const title =
    status === 'paid'
      ? 'Payment successful'
      : status === 'pending'
        ? 'Payment pending'
        : status === 'failed'
          ? 'Something went wrong'
          : 'Verifying payment';

  const Icon =
    status === 'paid'
      ? CheckCircle2
      : status === 'pending'
        ? Clock3
        : status === 'failed'
          ? AlertCircle
          : RefreshCw;

  const iconClass =
    status === 'paid'
      ? 'text-emerald-600'
      : status === 'pending'
        ? 'text-amber-500'
        : status === 'failed'
          ? 'text-rose-500'
          : 'text-indigo-500 animate-spin';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-5">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-xl p-8 text-center">
        <Icon className={`mx-auto h-14 w-14 ${iconClass}`} />
        <h1 className="mt-5 text-2xl font-black text-slate-950">{title}</h1>
        <p className="mt-3 text-sm font-medium text-slate-500">{message}</p>
        {pendingPayload?.merchantTransactionId ? (
          <p className="mt-4 text-xs font-bold tracking-wide text-slate-400">
            Ref: {String(pendingPayload.merchantTransactionId).slice(-10).toUpperCase()}
          </p>
        ) : null}
        {(status === 'failed' || status === 'pending') && destinationUrl ? (
          <button
            type="button"
            onClick={() => navigate(destinationUrl, { replace: true })}
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Go back
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default PhonePeStatusPage;
