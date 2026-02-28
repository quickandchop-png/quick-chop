import type { Express } from "express";
import { createServer, type Server } from "node:http";
import Stripe from "stripe";

const paymentStatusStore = new Map<string, 'pending' | 'paid' | 'failed'>();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2026-01-28.clover' });
}

export async function registerRoutes(app: Express): Promise<Server> {

  app.post('/api/payment/create-checkout', async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY.' });
    }

    const { orderId, amount, customerName, items, currency = 'inr' } = req.body;

    if (!orderId || !amount || !items?.length) {
      return res.status(400).json({ error: 'orderId, amount, and items are required.' });
    }

    try {
      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : `http://localhost:5000`;

      const lineItems = items.map((item: { name: string; price: number; quantity: number }) => ({
        price_data: {
          currency,
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${baseUrl}/payment/success?orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/payment/cancel?orderId=${orderId}`,
        metadata: { orderId, customerName: customerName || '' },
        customer_email: undefined,
      });

      paymentStatusStore.set(orderId, 'pending');
      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error('Stripe error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/payment/status/:orderId', (req, res) => {
    const { orderId } = req.params;
    const status = paymentStatusStore.get(orderId) || 'pending';
    res.json({ orderId, paymentStatus: status });
  });

  app.post('/api/payment/webhook', async (req, res) => {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !webhookSecret) {
      return res.status(400).json({ error: 'Stripe not configured' });
    }

    let event: Stripe.Event;
    try {
      const sig = req.headers['stripe-signature']!;
      event = stripe.webhooks.constructEvent(req.rawBody as any, sig, webhookSecret);
    } catch (err: any) {
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        paymentStatusStore.set(orderId, 'paid');
        console.log(`Payment confirmed for order ${orderId}`);
      }
    }

    res.json({ received: true });
  });

  app.get('/payment/success', (req, res) => {
    const { orderId } = req.query;
    if (orderId) {
      paymentStatusStore.set(String(orderId), 'paid');
    }
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F7F5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 24px; padding: 40px 32px; max-width: 380px; width: 90%; text-align: center; box-shadow: 0 4px 32px rgba(27,94,32,0.12); }
    .icon { width: 80px; height: 80px; background: #E8F5E9; border-radius: 40px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 40px; }
    h1 { color: #1B5E20; font-size: 24px; margin-bottom: 12px; }
    p { color: #5A5A5A; font-size: 15px; line-height: 1.6; margin-bottom: 8px; }
    .order-id { background: #F5F7F5; border-radius: 10px; padding: 10px 16px; font-size: 13px; color: #9E9E9E; margin: 16px 0; }
    .back-btn { display: inline-block; margin-top: 24px; background: #1B5E20; color: #fff; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-size: 15px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Payment Successful!</h1>
    <p>Your payment has been confirmed. Your order is being processed.</p>
    ${orderId ? `<div class="order-id">Order #${String(orderId).slice(0, 8)}</div>` : ''}
    <p style="font-size:13px;color:#9E9E9E;">You can now return to the app and check your order status in the Orders tab.</p>
    <a href="javascript:window.close()" class="back-btn">Close & Return to App</a>
  </div>
</body>
</html>`);
  });

  app.get('/payment/cancel', (req, res) => {
    const { orderId } = req.query;
    if (orderId) {
      paymentStatusStore.set(String(orderId), 'failed');
    }
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Cancelled</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F7F5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #fff; border-radius: 24px; padding: 40px 32px; max-width: 380px; width: 90%; text-align: center; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
    .icon { width: 80px; height: 80px; background: #FFF3E0; border-radius: 40px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 40px; }
    h1 { color: #E65100; font-size: 24px; margin-bottom: 12px; }
    p { color: #5A5A5A; font-size: 15px; line-height: 1.6; }
    .back-btn { display: inline-block; margin-top: 24px; background: #E65100; color: #fff; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-size: 15px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Payment Cancelled</h1>
    <p>Your payment was not completed. You can return to the app and try again.</p>
    <a href="javascript:window.close()" class="back-btn">Close & Return to App</a>
  </div>
</body>
</html>`);
  });

  const httpServer = createServer(app);
  return httpServer;
}
