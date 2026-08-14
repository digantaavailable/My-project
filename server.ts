import express from 'express';
import path from 'path';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to initialize Razorpay SDK lazily
  function getRazorpayInstance() {
    const rawKeyId = process.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TPgpZVAt5gFQkx';
    const rawKeySecret = process.env.RAZORPAY_KEY_SECRET || 'WDwOFp9skemZUhj8XetvJ689';

    const keyId = rawKeyId.trim().replace(/^["']|["']$/g, '');
    const keySecret = rawKeySecret.trim().replace(/^["']|["']$/g, '');

    // Ignore invalid placeholder values
    if (
      !keyId ||
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

  // API 1: Create Razorpay Order
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
        // Real Razorpay Order Creation
        const order = await razorpay.orders.create({
          amount: Math.round(amount * 100), // in paise (30000 = ₹300)
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

  // API 2: Verify Razorpay Payment Signature
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

      // Real Cryptographic HMAC SHA256 Signature Verification
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

  // Vite middleware for development vs static serve for production
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
