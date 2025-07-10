const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://ederamorimth.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'SEU_ACCESS_TOKEN_AQUI'
});

// Dados simulados (números, reservas, compras)...

app.post('/process_payment', async (req, res) => {
  const { userId, numbers: selected, buyerName, buyerPhone, buyerCPF, paymentData } = req.body;
  try {
    const payment = new Payment(client);
    const paymentResponse = await payment.create({
      body: {
        transaction_amount: paymentData.transaction_amount,
        token: paymentData.token,
        description: `Compra de números: ${selected.join(', ')}`,
        payment_method_id: paymentData.payment_method_id,
        payer: {
          email: `${userId}@subzero.com`,
          name: buyerName,
          identification: { type: 'CPF', number: buyerCPF.replace(/\D/g, '') }
        }
      }
    });

    if (paymentResponse.status === 'approved') {
      // atualizar compras e status dos números...
    }

    res.json({ status: paymentResponse.status });
  } catch (error) {
    // tratar erro e liberar números...
    res.status(500).json({ status: 'rejected', error: error.message });
  }
});

app.post('/process_pix_payment', async (req, res) => {
  const { userId, numbers: selected, buyerName, buyerPhone, buyerCPF, transaction_amount } = req.body;
  try {
    const payment = new Payment(client);
    const paymentResponse = await payment.create({
      body: {
        transaction_amount,
        description: `Compra de números: ${selected.join(', ')}`,
        payment_method_id: 'pix',
        payer: {
          email: `${userId}@subzero.com`,
          first_name: buyerName.split(' ')[0],
          last_name: buyerName.split(' ').slice(1).join(' '),
          identification: { type: 'CPF', number: buyerCPF.replace(/\D/g, '') }
        }
      }
    });

    if (paymentResponse.status === 'pending') {
      // salvar compra pendente...
    }

    res.json({
      payment_id: paymentResponse.id,
      qr_code: paymentResponse.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: paymentResponse.point_of_interaction.transaction_data.qr_code_base64
    });
  } catch (error) {
    // tratar erro e liberar números...
    res.status(500).json({ status: 'rejected', error: error.message });
  }
});
