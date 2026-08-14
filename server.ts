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
    const keyId = process.env.VITE_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return null;
    }

    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  // API 1: Create Razorpay Order
  app.post('/api/razorpay/create-order', async (req, res) => {
    try {
      const { amount = 300, currency = 'INR', email } = req.body;
      const razorpay = getRazorpayInstance();

      if (!razorpay) {
        return res.status(400).json({
          error: 'Razorpay Gateway is not yet configured. Please set VITE_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings.',
          isConfigured: false,
        });
      }

      // Real Razorpay Order Creation
      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100), // in paise (30000 = ₹300)
        currency,
        receipt: `receipt_${Date.now()}`,
        notes: {
          email: email || '',
          product: 'Tournament Draw 24H Pass',
        },
      });

      return res.json({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.VITE_RAZORPAY_KEY_ID,
      });
    } catch (err: any) {
      console.error('Razorpay Order Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to create payment order' });
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

      const keySecret = process.env.RAZORPAY_KEY_SECRET;

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
