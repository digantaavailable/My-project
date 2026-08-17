import express from 'express';
import path from 'path';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Master Developer Keys (Can be used over and over again without limitation)
  const MASTER_KEYS = ['MASTER2026', 'DIGANTA2026', 'ADMIN2026', 'DEV2026'];

  // Store for burned payment keys
  const burnedKeysSet: Set<string> = new Set();

  // In-memory data store for Admin Dashboard & Activity Tracking
  const activityLogs: any[] = [
    {
      id: 'act_init_1',
      type: 'admin_action',
      title: 'Tournament Draw Engine Online',
      details: 'System initialized & ready for tournament draw generation.',
      timestamp: Date.now() - 3600000,
    },
  ];

  const paymentLogs: any[] = [];

  const trialCodesStore: Map<
    string,
    {
      code: string;
      durationHours: number;
      status: 'available' | 'active' | 'used' | 'revoked';
      createdAt: number;
      activatedAt?: number;
      expiresAt?: number;
      notes?: string;
    }
  > = new Map([
    [
      'TRIAL24-7X9K',
      {
        code: 'TRIAL24-7X9K',
        durationHours: 24,
        status: 'available',
        createdAt: Date.now() - 86400000,
        notes: '24-Hour Single-Use Trial Code #1',
      },
    ],
    [
      'TRIAL24-M3Q8',
      {
        code: 'TRIAL24-M3Q8',
        durationHours: 24,
        status: 'available',
        createdAt: Date.now() - 86400000,
        notes: '24-Hour Single-Use Trial Code #2',
      },
    ],
    [
      'TRIAL24-B6V2',
      {
        code: 'TRIAL24-B6V2',
        durationHours: 24,
        status: 'available',
        createdAt: Date.now() - 86400000,
        notes: '24-Hour Single-Use Trial Code #3',
      },
    ],
  ]);

  const metricsCounter = {
    totalDrawsCreated: 14,
    totalExportsDocx: 9,
    totalExportsPdf: 6,
    totalExportsPng: 4,
    totalRevenueInr: 0,
    totalPaymentsCount: 0,
  };

  function getRazorpayInstance() {
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_TPgpZVAt5gFQkx';
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (
      !keySecret ||
      keyId.includes('MY_KEY') ||
      keySecret.includes('MY_SECRET') ||
      keyId === '""' ||
      keySecret === '""'
    ) {
      return null;
    }

    return {
      client: new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      }),
      keyId,
      keySecret,
    };
  }

  // --- API 1: Create Razorpay Order ---
  app.post('/api/razorpay/create-order', async (req, res) => {
    try {
      const { amount = 300, currency = 'INR', email } = req.body;
      const rzpConfig = getRazorpayInstance();

      if (!rzpConfig) {
        return res.json({
          id: null,
          amount: Math.round(amount * 100),
          currency,
          keyId: 'rzp_live_TPgpZVAt5gFQkx',
          fallback: true,
        });
      }

      const { client: razorpay, keyId } = rzpConfig;

      try {
        const order = await razorpay.orders.create({
          amount: Math.round(amount * 100),
          currency,
          receipt: `rcpt_${Date.now().toString().slice(-10)}`,
          notes: {
            email: email || '',
            product: 'Tournament Draw 24H Pass',
          },
        });

        return res.json({
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: keyId,
        });
      } catch (orderErr: any) {
        console.warn('Razorpay server order creation returned:', orderErr?.message || orderErr);
        return res.json({
          id: null,
          amount: Math.round(amount * 100),
          currency,
          keyId: keyId,
          fallback: true,
        });
      }
    } catch (err: any) {
      console.error('Razorpay Order Error:', err);
      return res.json({
        id: null,
        amount: 30000,
        currency: 'INR',
        keyId: 'rzp_live_TPgpZVAt5gFQkx',
        fallback: true,
      });
    }
  });

  // --- API 2: Verify Razorpay Payment Signature ---
  app.post('/api/razorpay/verify-payment', async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      const rzpConfig = getRazorpayInstance();
      const keySecret = rzpConfig?.keySecret;

      if (!keySecret) {
        return res.status(400).json({
          success: false,
          message: 'Razorpay secret key is not configured on the server.',
        });
      }

      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment signature. Payment verification failed.',
        });
      }

      return res.json({
        success: true,
        message: 'Payment verified successfully! 24-Hour Pass activated.',
        paymentId: razorpay_payment_id,
      });
    } catch (err: any) {
      console.error('Razorpay Verification Error:', err);
      return res.status(500).json({ error: err.message || 'Payment verification failed' });
    }
  });

  // --- API 3: Redeem License / Master Key ---
  app.post('/api/license/redeem', (req, res) => {
    try {
      const { key } = req.body;
      const cleaned = (key || '').trim().toUpperCase();

      if (!cleaned) {
        return res.status(400).json({ success: false, message: 'Please enter a valid key.' });
      }

      // Check Master Developer Keys (Always valid, reusable infinitely)
      if (MASTER_KEYS.includes(cleaned) || cleaned.startsWith('MASTER-') || cleaned.startsWith('DEV-')) {
        return res.json({
          success: true,
          isLifetime: true,
          message: 'Master Developer Key activated! Full access is now active.',
        });
      }

      if (burnedKeysSet.has(cleaned)) {
        return res.status(400).json({
          success: false,
          message: 'This pass key has already been used and expired.',
        });
      }

      // Check Predefined Trial Codes Store
      if (trialCodesStore.has(cleaned)) {
        const record = trialCodesStore.get(cleaned)!;
        if (record.status === 'revoked') {
          return res.status(400).json({ success: false, message: 'This trial code has been revoked.' });
        }
        if (record.status === 'used' || (record.expiresAt && Date.now() > record.expiresAt)) {
          return res.status(400).json({
            success: false,
            message: 'This 24-hour trial code has already been redeemed and has expired.',
          });
        }

        const now = Date.now();
        record.status = 'active';
        record.activatedAt = record.activatedAt || now;
        record.expiresAt = record.expiresAt || (now + record.durationHours * 3600 * 1000);
        trialCodesStore.set(cleaned, record);

        activityLogs.unshift({
          id: `act_${Date.now()}`,
          type: 'key_redeemed',
          title: `Trial Code Activated: ${cleaned}`,
          details: `24-Hour Pass activated. Valid until ${new Date(record.expiresAt).toLocaleTimeString()}`,
          timestamp: Date.now(),
        });

        return res.json({
          success: true,
          isLifetime: false,
          durationHours: record.durationHours,
          expiresAt: record.expiresAt,
          message: `24-Hour Trial Code Activated! Valid until ${new Date(record.expiresAt).toLocaleDateString()} ${new Date(record.expiresAt).toLocaleTimeString()}`,
        });
      }

      // Random Generated Payment-issued Key (format PASS-XXXX-XXXX)
      if (/^PASS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned) || cleaned.startsWith('PAID-')) {
        return res.json({
          success: true,
          isLifetime: false,
          message: '24-Hour Pass activated successfully!',
          durationHours: 24,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid pass code. Please enter a valid code or complete payment for a 24-Hour Pass.',
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message || 'Validation error' });
    }
  });

  // --- API 4: Reset Pass (Application returns to trial mode) ---
  app.post('/api/license/reset', (req, res) => {
    try {
      const { activeKey } = req.body;
      const cleaned = (activeKey || '').trim().toUpperCase();

      if (cleaned && trialCodesStore.has(cleaned)) {
        const record = trialCodesStore.get(cleaned)!;
        record.status = 'used';
        trialCodesStore.set(cleaned, record);
      }

      // Only burn single-use payment keys, NEVER master developer keys
      if (cleaned && !MASTER_KEYS.includes(cleaned) && !cleaned.startsWith('MASTER-') && !cleaned.startsWith('DEV-')) {
        burnedKeysSet.add(cleaned);
      }

      activityLogs.unshift({
        id: `act_${Date.now()}`,
        type: 'pass_reset',
        title: 'Pass Reset to Free Trial',
        details: cleaned ? `Key was: ${cleaned}` : 'Application reset to trial mode',
        timestamp: Date.now(),
      });

      return res.json({ success: true, message: 'Application returned to trial mode.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- API 5: Log Activity from Client ---
  app.post('/api/activity/log', (req, res) => {
    try {
      const { type, title, details } = req.body;
      if (type === 'draw_created') metricsCounter.totalDrawsCreated++;
      if (type === 'export_docx') metricsCounter.totalExportsDocx++;
      if (type === 'export_pdf') metricsCounter.totalExportsPdf++;
      if (type === 'export_png') metricsCounter.totalExportsPng++;

      activityLogs.unshift({
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: type || 'draw_edited',
        title: title || 'User Activity',
        details: details || '',
        timestamp: Date.now(),
      });

      if (activityLogs.length > 200) activityLogs.length = 200;
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- API 6: Admin Dashboard Data ---
  app.get('/api/admin/data', (req, res) => {
    try {
      // Check active codes
      let activePassesCount = 0;
      const now = Date.now();
      const trialCodesList = Array.from(trialCodesStore.values()).map((tc) => {
        if (tc.status === 'active' && tc.expiresAt && now > tc.expiresAt) {
          tc.status = 'used';
        }
        if (tc.status === 'active') activePassesCount++;
        return tc;
      });

      return res.json({
        metrics: {
          totalDrawsCreated: metricsCounter.totalDrawsCreated,
          totalExportsDocx: metricsCounter.totalExportsDocx,
          totalExportsPdf: metricsCounter.totalExportsPdf,
          totalExportsPng: metricsCounter.totalExportsPng,
          activePassesCount: activePassesCount,
          totalRevenueInr: metricsCounter.totalRevenueInr,
          totalPaymentsCount: metricsCounter.totalPaymentsCount,
        },
        trialCodes: trialCodesList,
        recentPayments: paymentLogs.slice(0, 50),
        recentActivities: activityLogs.slice(0, 100),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- API 7: Admin Generate 24-Hour Code ---
  app.post('/api/admin/generate-trial-key', (req, res) => {
    try {
      const { hours = 24, notes = 'Generated via Admin Dashboard' } = req.body;
      const randHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const code = `TRIAL24-${randHex}`;

      const newRecord = {
        code,
        durationHours: Number(hours) || 24,
        status: 'available' as const,
        createdAt: Date.now(),
        notes,
      };

      trialCodesStore.set(code, newRecord);

      activityLogs.unshift({
        id: `act_${Date.now()}`,
        type: 'admin_action',
        title: `New 24h Pass Code Created: ${code}`,
        details: `${hours}h validity code created by Admin`,
        timestamp: Date.now(),
      });

      return res.json({ success: true, code, record: newRecord });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- API 8: Admin Revoke Key ---
  app.post('/api/admin/revoke-key', (req, res) => {
    try {
      const { code } = req.body;
      const clean = (code || '').trim().toUpperCase();
      if (trialCodesStore.has(clean)) {
        const record = trialCodesStore.get(clean)!;
        record.status = 'revoked';
        trialCodesStore.set(clean, record);
      }
      burnedKeysSet.add(clean);

      activityLogs.unshift({
        id: `act_${Date.now()}`,
        type: 'admin_action',
        title: `Pass Code Revoked: ${clean}`,
        details: 'Code permanently disabled by admin',
        timestamp: Date.now(),
      });

      return res.json({ success: true, message: `Key ${clean} revoked successfully.` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- API 9: Admin Clear Logs ---
  app.post('/api/admin/clear-logs', (req, res) => {
    try {
      activityLogs.length = 0;
      activityLogs.push({
        id: `act_${Date.now()}`,
        type: 'admin_action',
        title: 'Activity logs reset by admin',
        timestamp: Date.now(),
      });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // --- Health Check ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Vite middleware for development vs static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tournament Draw Server running on http://localhost:${PORT}`);
  });
}

startServer();
