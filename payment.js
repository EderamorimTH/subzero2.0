let mp;
let selectedNumbers = [];
let userId = Math.random().toString(36).substring(2, 15);
const BASE_URL = 'https://subzero2-0.onrender.com';

async function loadNumbers() {
    try {
        const response = await fetch(`${BASE_URL}/available_numbers`);
        const data = await response.json();
        const grid = document.getElementById('number-grid');
        grid.innerHTML = '';

        data.forEach(({ number, status }) => {
            const div = document.createElement('div');
            div.textContent = number;
            div.className = 'number ' + (status === 'vendido' ? 'sold' : status === 'reservado' ? 'reserved' : 'available');
            if (status === 'disponível') {
                div.onclick = () => toggleNumber(number, div);
            }
            grid.appendChild(div);
        });

        document.getElementById('loading-message').style.display = 'none';
    } catch (err) {
        console.error('Erro ao carregar números:', err);
        document.getElementById('number-error').style.display = 'block';
    }
}

function toggleNumber(number, element) {
    const index = selectedNumbers.indexOf(number);
    if (index > -1) {
        selectedNumbers.splice(index, 1);
        element.classList.remove('selected');
    } else {
        selectedNumbers.push(number);
        element.classList.add('selected');
    }
    updatePaymentSection();
}

function updatePaymentSection() {
    document.getElementById('selected-numbers').textContent = `Números selecionados: ${selectedNumbers.join(', ') || 'Nenhum'}`;
    document.getElementById('total-amount').textContent = `Total: R$ ${(selectedNumbers.length * 5).toFixed(2)}`;
    document.getElementById('payment-section').style.display = selectedNumbers.length ? 'block' : 'none';
}

async function reserveNumbers() {
    if (selectedNumbers.length === 0) return;
    await fetch(`${BASE_URL}/reserve_numbers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, numbers: selectedNumbers })
    });
}

async function initializeCardForm() {
    mp = new MercadoPago('SUA_PUBLIC_KEY_DO_MERCADO_PAGO');

    const cardForm = mp.cardForm({
        form: {
            id: 'card-form',
            cardholderName: { id: 'card-holder', placeholder: 'Nome no cartão' },
            cardNumber: { id: 'card-number', placeholder: 'Número do cartão' },
            expirationDate: { id: 'card-expiry', placeholder: 'MM/AA' },
            securityCode: { id: 'card-cvc', placeholder: 'CVC' }
        },
        callbacks: {
            onFormMounted: () => console.log('Formulário montado'),
            onError: (errors) => console.error('Erros no formulário:', errors)
        }
    });

    document.getElementById('submit-card').addEventListener('click', async () => {
        const buyerName = document.getElementById('buyer-name').value;
        const buyerPhone = document.getElementById('buyer-phone').value;
        const buyerCPF = document.getElementById('buyer-cpf').value;

        if (!buyerName || !buyerPhone || !buyerCPF) {
            alert('Preencha nome, telefone e CPF.');
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
            if (!response.ok || result.status !== 'approved') throw new Error(result.error || 'Pagamento não aprovado');

            document.getElementById('success-message').style.display = 'block';
            document.getElementById('payment-section').style.display = 'none';
            selectedNumbers = [];
            updatePaymentSection();
            loadNumbers();
        } catch (err) {
            console.error('Erro ao processar pagamento:', err);
            document.getElementById('error-message-box').style.display = 'block';
            loadNumbers();
        }
    });
}

document.getElementById('pay-pix')?.addEventListener('click', async () => {
    document.getElementById('card-form').style.display = 'none';
    document.getElementById('pix-details').style.display = 'block';

    const buyerName = document.getElementById('buyer-name').value;
    const buyerPhone = document.getElementById('buyer-phone').value;
    const buyerCPF = document.getElementById('buyer-cpf')?.value;

    if (!buyerName || !buyerPhone || !buyerCPF) {
        alert('Preencha nome, telefone e CPF.');
        return;
    }

    await reserveNumbers();
    const transaction_amount = selectedNumbers.length * 5;

    try {
        const response = await fetch(`${BASE_URL}/process_pix_payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, buyerCPF, transaction_amount })
        });

        if (!response.ok) throw new Error('Erro no servidor ao criar Pix');
        const result = await response.json();

        if (result.qr_code) {
            document.getElementById('pix-qr').src = `data:image/png;base64,${result.qr_code_base64}`;
            document.getElementById('pix-code').textContent = result.qr_code;
            checkPixPaymentStatus(result.payment_id);
        } else {
            alert('Erro ao gerar código Pix.');
        }
    } catch (error) {
        console.error('Erro ao processar Pix:', error);
        alert('Erro ao processar Pix.');
        loadNumbers();
    }
});

async function checkPixPaymentStatus(paymentId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${BASE_URL}/payment_status/${paymentId}`);
            const result = await response.json();
            if (result.status === 'approved') {
                clearInterval(interval);
                document.getElementById('success-message').style.display = 'block';
                document.getElementById('payment-section').style.display = 'none';
                selectedNumbers = [];
                updatePaymentSection();
                loadNumbers();
            }
        } catch (err) {
            console.error('Erro ao checar status do Pix:', err);
        }
    }, 5000);
}

window.onload = async () => {
    await loadNumbers();
    await initializeCardForm();
};
