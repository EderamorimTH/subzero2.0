const BASE_URL = 'https://subzero2-0.onrender.com';
let mp; // variável global para o Mercado Pago
let selectedNumbers = [];
let userId = Math.random().toString(36).substring(2, 15);

async function initializeMercadoPago() {
  try {
    // Usa sua chave pública real aqui
    const publicKey = 'APP_USR-d4fbc28c-ac60-4263-90bf-96b53835f289';

    // Inicializa o Mercado Pago
    mp = new MercadoPago(publicKey, {
      locale: 'pt-BR',
    });

    await initializeCardForm();
  } catch (error) {
    console.error('Erro ao inicializar Mercado Pago:', error);
  }
}

async function loadNumbers() {
  try {
    const response = await fetch(`${BASE_URL}/available_numbers`);
    const numbers = await response.json();

    const grid = document.getElementById('number-grid');
    grid.innerHTML = '';

    numbers.forEach(numObj => {
      const div = document.createElement('div');
      div.textContent = numObj.number;
      div.classList.add('number');

      if (numObj.status === 'disponível') div.classList.add('available');
      else if (numObj.status === 'reservado') div.classList.add('reserved');
      else if (numObj.status === 'vendido') div.classList.add('sold');

      if (numObj.status === 'disponível') {
        div.addEventListener('click', () => toggleNumber(numObj.number, div));
      }

      grid.appendChild(div);
    });

    updatePaymentSection();
  } catch (error) {
    console.error('Erro ao carregar números:', error);
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
  const selectedText = selectedNumbers.length ? selectedNumbers.join(', ') : 'Nenhum';
  document.getElementById('selected-numbers').textContent = `Números selecionados: ${selectedText}`;
  const total = selectedNumbers.length * 5;
  document.getElementById('total-amount').textContent = `Total: R$ ${total.toFixed(2)}`;

  document.getElementById('payment-section').style.display = selectedNumbers.length > 0 ? 'block' : 'none';
}

async function reserveNumbers() {
  try {
    const response = await fetch(`${BASE_URL}/reserve_numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, numbers: selectedNumbers }),
    });
    const result = await response.json();
    if (!result.success) throw new Error('Erro ao reservar números');
  } catch (error) {
    console.error(error);
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
      securityCode: { id: 'card-cvc', placeholder: 'CVC' },
    },
    callbacks: {
      onFormMounted: () => console.log('Formulário de cartão montado'),
      onError: (errors) => {
        console.error('Erros no formulário de cartão:', errors);
        document.getElementById('error-message-box').style.display = 'block';
      },
    },
  });

  document.getElementById('submit-card').addEventListener('click', async () => {
    const buyerName = document.getElementById('buyer-name').value.trim();
    const buyerPhone = document.getElementById('buyer-phone').value.trim();
    const buyerCPF = document.getElementById('buyer-cpf')?.value.trim();

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
        description: `Compra de números: ${selectedNumbers.join(', ')}`,
      };

      const response = await fetch(`${BASE_URL}/process_payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, buyerCPF, paymentData }),
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

document.getElementById('pay-pix').addEventListener('click', async () => {
  document.getElementById('card-form').style.display = 'none';
  document.getElementById('pix-details').style.display = 'block';

  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerPhone = document.getElementById('buyer-phone').value.trim();
  const buyerCPF = document.getElementById('buyer-cpf')?.value.trim();

  if (!buyerName || !buyerPhone || !buyerCPF) {
    alert('Por favor, preencha nome, telefone e CPF.');
    return;
  }

  await reserveNumbers();

  const transaction_amount = selectedNumbers.length * 5;

  try {
    const response = await fetch(`${BASE_URL}/process_pix_payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, buyerCPF, transaction_amount }),
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
  try {
    const response = await fetch(`${BASE_URL}/payment_status/${paymentId}`);
    if (!response.ok) throw new Error('Erro ao verificar status do pagamento Pix');
    const result = await response.json();

    if (result.status === 'approved') {
      document.getElementById('success-message').style.display = 'block';
      document.getElementById('payment-section').style.display = 'none';
      document.getElementById('pix-details').style.display = 'none';
      selectedNumbers = [];
      updatePaymentSection();
      loadNumbers();
    } else if (result.status === 'pending') {
      setTimeout(() => checkPixPaymentStatus(paymentId), 5000);
    } else {
      document.getElementById('error-message-box').style.display = 'block';
      loadNumbers();
    }
  } catch (error) {
    console.error('Erro ao verificar status do Pix:', error);
  }
}

window.onload = async () => {
  await initializeMercadoPago();
  await loadNumbers();
};
