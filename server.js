const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve files from root directory

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'SEU_ACCESS_TOKEN_AQUI'
});

const numbers = Array.from({ length: 200 }, (_, i) => ({
    number: String(i + 1).padStart(3, '0'),
    status: 'disponível'
}));
const reservations = new Map();
const purchases = [];

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/public_key', (req, res) => {
    res.json({ publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || 'SUA_CHAVE_PUBLICA_AQUI' });
});

app.post('/verify_password', (req, res) => {
    const { password } = req.body;
    const isValid = password === (process.env.PAGE_PASSWORD || 'VAIDACERTO');
    res.json({ success: isValid });
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

app.post('/process_payment', async (req, res) => {
    const { userId, numbers, buyerName, buyerPhone, paymentData } = req.body;

    try {
        const payment = new Payment(client);
        const paymentResponse = await payment.create({
            body: {
                transaction_amount: paymentData.transaction_amount,
                token: paymentData.token,
                description: `Compra de números: ${numbers.join(', ')}`,
                payment_method_id: paymentData.payment_method_id,
                payer: {
                    email: `${userId}@subzero2.0.com`,
                    name: buyerName,
                    identification: { type: 'CPF', number: buyerPhone.replace(/\D/g, '') }
                }
            }
        });

        if (paymentResponse.status === 'approved') {
            purchases.push({
                name: buyerName,
                phone: buyerPhone,
                numbers,
                date: new Date(paymentResponse.date_approved),
                paymentId: paymentResponse.id,
                status: 'approved'
            });
            numbers.forEach(num => {
                const numberObj = numbers.find(n => n.number === num);
                if (numberObj && numberObj.status === 'reservado') {
                    numberObj.status = 'vendido';
                    reservations.delete(num);
                }
            });
        }

        res.json({ status: paymentResponse.status });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Erro ao processar pagamento:`, error.message);
        numbers.forEach(num => {
            const numberObj = numbers.find(n => n.number === num);
            if (numberObj && numberObj.status === 'reservado') {
                numberObj.status = 'disponível';
                reservations.delete(num);
            }
        });
        res.status(500).json({ status: 'rejected', error: error.message });
    }
});

app.post('/process_pix_payment', async (req, res) => {
    const { userId, numbers, buyerName, buyerPhone, transaction_amount } = req.body;

    try {
        const payment = new Payment(client);
        const paymentResponse = await payment.create({
            body: {
                transaction_amount,
                description: `Compra de números: ${numbers.join(', ')}`,
                payment_method_id: 'pix',
                payer: {
                    email: `${userId}@subzero2.0.com`,
                    first_name: buyerName.split(' ')[0],
                    last_name: buyerName.split(' ').slice(1).join(' '),
                    identification: { type: 'CPF', number: buyerPhone.replace(/\D/g, '') }
                }
            }
        });

        if (paymentResponse.status === 'pending') {
            purchases.push({
                name: buyerName,
                phone: buyerPhone,
                numbers,
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
        console.error(`[${new Date().toISOString()}] Erro ao processar pagamento Pix:`, error.message);
        numbers.forEach(num => {
            const numberObj = numbers.find(n => n.number === num);
            if (numberObj && numberObj.status === 'reservado') {
                numberObj.status = 'disponível';
                reservations.delete(num);
            }
        });
        res.status(500).json({ status: 'rejected', error: error.message });
    }
});

app.get('/payment_status/:paymentId', async (req, res) => {
    const { paymentId } = req.params;
    try {
        const payment = new Payment(client);
        const paymentResponse = await payment.get({ id: paymentId });
        if (paymentResponse.status === 'approved') {
            const purchase = purchases.find(p => p.paymentId === paymentId);
            if (purchase) {
                purchase.status = 'approved';
                purchase.date = new Date(paymentResponse.date_approved);
                purchase.numbers.forEach(num => {
                    const numberObj = numbers.find(n => n.number === num);
                    if (numberObj) numberObj.status = 'vendido';
                    reservations.delete(num);
                });
            }
        }
        res.json({ status: paymentResponse.status });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Erro ao verificar status do pagamento:`, error.message);
        res.status(500).json({ status: 'rejected', error: error.message });
    }
});

app.get('/purchases', (req, res) => {
    res.json(purchases);
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Servidor rodando na porta ${PORT}`);
});
