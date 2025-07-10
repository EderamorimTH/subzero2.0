let mp;
let selectedNumbers = [];
let userId = Math.random().toString(36).substring(2, 15);

async function loadNumbers() {
    const grid = document.getElementById('number-grid');
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('number-error');

    if (!grid || !loadingMessage || !errorMessage) {
        console.error('Elementos HTML não encontrados');
        return;
    }

    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    try {
        const response = await fetch('/available_numbers');
        if (!response.ok) throw new Error('Erro ao carregar números');
        const numbers = await response.json();
        grid.innerHTML = '';
        numbers.forEach(num => {
            const div = document.createElement('div');
            div.className = `number ${num.status === 'disponível' ? 'available' : num.status === 'reservado' ? 'reserved' : 'sold'}`;
            div.textContent = num.number;
            if (num.status === 'disponível') {
                div.addEventListener('click', () => toggleNumber(num.number, div));
            }
            grid.appendChild(div);
        });
        loadingMessage.style.display = 'none';
    } catch (error) {
        console.error('Erro ao carregar números:', error);
        errorMessage.style.display = 'block';
        loadingMessage.style.display = 'none';
    }
}

function toggleNumber(number, element) {
    if (selectedNumbers.includes(number)) {
        selectedNumbers = selectedNumbers.filter(n => n !== number);
        element.classList.remove('reserved');
        element.classList.add('available');
    } else {
        selectedNumbers.push(number);
        element.classList.remove('available');
        element.classList.add('reserved');
    }
    updatePaymentSection();
}

function updatePaymentSection() {
    const paymentSection = document.getElementById('payment-section');
    if (!paymentSection) return;
    paymentSection.style.display = selectedNumbers.length > 0 ? 'block' : 'none';
    document.getElementById('selected-numbers').textContent = `Números selecionados: ${selectedNumbers.join(', ') || 'Nenhum'}`;
    document.getElementById('total-amount').textContent = `Total: R$ ${(selectedNumbers.length * 5).toFixed(2)}`;
}

async function verifyPassword() {
    const passwordInput = document.getElementById('password-input');
    const errorMessage = document.getElementById('password-error');
    if (!passwordInput || !errorMessage) return;

    const password = passwordInput.value;
    try {
        const response = await fetch('/verify_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (!response.ok) throw new Error('Erro ao verificar senha');
        const result = await response.json();
        if (result.success) {
            document.getElementById('password-overlay').style.display = 'none';
            loadPurchases();
        } else {
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro ao verificar senha:', error);
        errorMessage.style.display = 'block';
    }
}

async function loadPurchases() {
    const tbody = document.querySelector('table tbody');
    if (!tbody) return;
    try {
        const response = await fetch('/purchases');
        if (!response.ok) throw new Error('Erro ao carregar compras');
        const purchases = await response.json();
        tbody.innerHTML = '';
        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">NENHUMA COMPRA APROVADA REGISTRADA AINDA.</td></tr>';
        } else {
            purchases.forEach(purchase => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${purchase.name}</td>
                    <td>${purchase.phone}</td>
                    <td>${purchase.numbers.join(', ')}</td>
                    <td>${new Date(purchase.date).toLocaleDateString()}</td>
                    <td>${purchase.paymentId}</td>
                    <td>${purchase.status}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar compras:', error);
        tbody.innerHTML = '<tr><td colspan="6">ERRO AO CARREGAR COMPRAS.</td></tr>';
    }
}

async function reserveNumbers() {
    if (selectedNumbers.length === 0) return;
    try {
        const response = await fetch('/reserve_numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers })
        });
        if (!response.ok) throw new Error('Erro ao reservar números');
    } catch (error) {
        console.error('Erro ao reservar números:', error);
        alert('Erro ao reservar números. Tente novamente.');
    }
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

        if (!buyerName || !buyerPhone) {
            alert('Por favor, preencha nome e telefone.');
            return;
        }

        try {
            const cardToken = await cardForm.createCardToken();
            await reserveNumbers();
            const transaction_amount = selectedNumbers.length * 5;
            const paymentData = {
                transaction_amount,
                token: cardToken.id,
                payment_method_id: 'visa', // You may need to dynamically determine this
                description: `Compra de números: ${selectedNumbers.join(', ')}`
            };
            const response = await fetch('/process_payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, paymentData })
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
    if (!buyerName || !buyerPhone) {
        alert('Por favor, preencha nome e telefone.');
        return;
    }
    try {
        const response = await fetch('/process_pix_payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, transaction_amount })
        });
        if (!response.ok) throw new Error('Erro ao processar Pix');
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
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/payment_status/${paymentId}`);
            if (!response.ok) throw new Error('Erro ao verificar status do pagamento');
            const result = await response.json();
            if (result.status === 'approved') {
                clearInterval(interval);
                document.getElementById('success-message').style.display = 'block';
                document.getElementById('payment-section').style.display = 'none';
                selectedNumbers = [];
                updatePaymentSection();
                loadNumbers();
            } else if (result.status === 'rejected') {
                clearInterval(interval);
                document.getElementById('error-message-box').style.display = 'block';
                loadNumbers();
            } else {
                document.getElementById('pending-message').style.display = 'block';
            }
        } catch (error) {
            console.error('Erro ao verificar status do pagamento:', error);
            clearInterval(interval);
            document.getElementById('error-message-box').style.display = 'block';
            loadNumbers();
        }
    }, 5000);
}

window.onload = async () => {
    try {
        const publicKeyResponse = await fetch('/public_key');
        if (!publicKeyResponse.ok) throw new Error('Erro ao obter chave pública');
        const { publicKey } = await publicKeyResponse.json();
        mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
        if (document.getElementById('card-form')) {
            initializeCardForm();
        }
        if (document.getElementById('number-grid')) {
            loadNumbers();
        }
    } catch (error) {
        console.error('Erro ao inicializar Mercado Pago:', error);
        document.getElementById('number-error').style.display = 'block';
    }
};

document.getElementById('password-submit')?.addEventListener('click', verifyPassword);
document.getElementById('password-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyPassword();
});
