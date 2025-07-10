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
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

const numbers = Array.from({ length: 200 }, (_, i) => ({
  number: String(i + 1).padStart(3, '0'),
  status: 'disponível'
}));
const reservations = new Map();
const purchases = [];

app.get('/public_key', (req, res) => {
  res.json({ publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY });
});

app.get('/available_numbers', (req, res) => {
  res.json(numbers);
});

app.post('/reserve_numbers', (req, res) => {
  const { userId, numbers: selectedNumbers } = req.body;
  const reservationTime = 5 * 60 * 1000;

  selectedNumbers.forEach(num => {
    const numberObj = numbers.find(n => n.number === num);
    if (numberObj && numberObj.status === 'disponível') {
      numberObj.status = 'reservado';
      reservations.set(num, { userId, timestamp: Date.now() });
    }
  });

  setTimeout(() => {
    selectedNumbers.forEach(num => {
      const reservation = reservations.get(num);
      if (reservation && Date.now() - reservation.timestamp > reservationTime) {
        const numberObj = numbers.find(n => n.number === num);
        if (numberObj && numberObj.status === 'reservado') {
          numberObj.status = 'disponível';
          reservations.delete(num);
        }
      }
    });
  }, reservationTime);

  res.json({ success: true });
});

app.post('/process_pix_payment', async (req, res) => {
  const { userId, numbers: selected, buyerName, buyerPhone, transaction_amount, buyerCPF } = req.body;

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
      purchases.push({
        name: buyerName,
        phone: buyerPhone,
        numbers: selected,
        date: new Date(),
        paymentId: paymentResponse.id,
        status: 'pending'
      });
    }

    res.json({
      payment_id: paymentResponse.id,
      qr_code: paymentResponse.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: paymentResponse.point_of_interaction.transaction_data.qr_code_base64
    });
  } catch (error) {
    console.error('Erro ao processar PIX:', error.message);
    selected.forEach(num => {
      const numberObj = numbers.find(n => n.number === num);
      if (numberObj && numberObj.status === 'reservado') {
        numberObj.status = 'disponível';
        reservations.delete(num);
      }
    });
    res.status(500).json({ status: 'rejected', error: error.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Servidor rodando na porta ${process.env.PORT || 3000}`);
});
