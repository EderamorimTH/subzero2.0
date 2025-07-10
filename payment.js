let mp;
let selectedNumbers = [];
let userId = Math.random().toString(36).substring(2, 15);
const BASE_URL = 'https://subzero2-0.onrender.com';

async function loadNumbers() {
    // seu código...
}

function toggleNumber(number, element) {
    // seu código...
}

function updatePaymentSection() {
    // seu código...
}

async function loadPurchases() {
    // seu código...
}

async function reserveNumbers() {
    // seu código...
}

async function initializeCardForm() {
    const cardForm = mp.cardForm({
        form: {
            id: 'card-form',
            cardholderName: { id: 'card-holder', placeholder: 'Nome no cartão' },
            cardNumber: { id: 'card-number', placeholder: 'Número do cartão' },
            expirationDate: { id: 'card-expiry', placeholder: 'MM/AA' },
            securityCode: { id: 'card-cvc', placeholder: 'CVC' }
        },
        callbacks: {
            onFormMounted: () => console.log('Formulário de cartão montado'),
            onError: (errors) => {
                console.error('Erros no formulário de cartão:', errors);
                document.getElementById('error-message-box').style.display = 'block';
            }
        }
    });

    document.getElementById('submit-card').addEventListener('click', async () => {
        const buyerName = document.getElementById('buyer-name').value;
        const buyerPhone = document.getElementById('buyer-phone').value;
        const buyerCPF = document.getElementById('buyer-cpf').value;

        if (!buyerName || !buyerPhone || !buyerCPF) {
            alert('Por favor, preencha nome, telefone e CPF.');
            return;
        }

        try {
            const cardToken = await cardForm.createCardToken();
            await reserveNumbers();
            const transaction_amount = selectedNumbers.length * 5;
            const paymentData = {
                transaction_amount,
                token: cardToken.id,
                payment_method_id: 'visa',
                description: `Compra de números: ${selectedNumbers.join(', ')}`
            };
            const response = await fetch(`${BASE_URL}/process_payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, buyerCPF, paymentData })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao processar pagamento');
            if (result.status === 'approved') {
                document.getElementById('success-message').style.display = 'block';
                document.getElementById('payment-section').style.display = 'none';
                selectedNumbers = [];
                updatePaymentSection();
                loadNumbers();
            } else {
                document.getElementById('error-message-box').style.display = 'block';
                loadNumbers();
            }
        } catch (error) {
            console.error('Erro ao processar pagamento:', error);
            document.getElementById('error-message-box').style.display = 'block';
            loadNumbers();
        }
    });
}

document.getElementById('pay-pix')?.addEventListener('click', async () => {
    document.getElementById('card-form').style.display = 'none';
    document.getElementById('pix-details').style.display = 'block';
    await reserveNumbers();
    const transaction_amount = selectedNumbers.length * 5;
    const buyerName = document.getElementById('buyer-name').value;
    const buyerPhone = document.getElementById('buyer-phone').value;
    const buyerCPF = document.getElementById('buyer-cpf').value;

    if (!buyerName || !buyerPhone || !buyerCPF) {
        alert('Por favor, preencha nome, telefone e CPF.');
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/process_pix_payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, buyerCPF, transaction_amount })
        });
        if (!response.ok) throw new Error(`Erro ao processar Pix: ${response.statusText}`);
        const result = await response.json();
        if (result.qr_code) {
            document.getElementById('pix-qr').src = `data:image/png;base64,${result.qr_code_base64}`;
            document.getElementById('pix-code').textContent = result.qr_code;
            checkPixPaymentStatus(result.payment_id);
        } else {
            alert('Erro ao gerar Pix!');
            loadNumbers();
        }
    } catch (error) {
        console.error('Erro ao processar Pix:', error);
        alert('Erro ao processar Pix!');
        loadNumbers();
    }
});

async function checkPixPaymentStatus(paymentId) {
    // seu código...
}

window.onload = async () => {
    // seu código...
};
