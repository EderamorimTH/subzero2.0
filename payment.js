const BASE_URL = 'https://subzero2-0.onrender.com';

let mp = null;
let cardForm = null;
let selectedNumbers = [];
let userId = Math.random().toString(36).substring(2, 15);

// Inicializa Mercado Pago
async function initializeMercadoPago() {
  try {
    const res = await fetch(`${BASE_URL}/public_key`);
    const data = await res.json();

    if (!data.publicKey) throw new Error('Chave pública não encontrada');

    mp = new MercadoPago(data.publicKey, { locale: 'pt-BR' });

    await initializeCardForm();
  } catch (error) {
    console.error('Erro ao inicializar Mercado Pago: ', error);
  }
}

// Configura o formulário do cartão
async function initializeCardForm() {
  try {
    cardForm = mp.cardForm({
      amount: selectedNumbers.length * 5,
      autoMount: true,
      form: {
        id: 'card-form',
        cardholderName: { id: 'card-holder', placeholder: 'Nome no cartão' },
        cardNumber: { id: 'card-number', placeholder: 'Número do cartão' },
        expirationDate: { id: 'card-expiry', placeholder: 'MM/AA' },
        securityCode: { id: 'card-cvc', placeholder: 'CVC' },
      },
      callbacks: {
        onFormMounted: () => {
          console.log('Formulário do cartão montado');
        },
        onSubmit: async (event) => {
          event.preventDefault();
          await processCardPayment();
        },
        onError: (errors) => {
          console.error('Erro no formulário do cartão:', errors);
          document.getElementById('error-message-box').style.display = 'block';
        },
      },
    });
  } catch (error) {
    console.error('Erro ao configurar o formulário do cartão: ', error);
  }
}

// Processa o pagamento com cartão
async function processCardPayment() {
  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerPhone = document.getElementById('buyer-phone').value.trim();
  const buyerCPF = document.getElementById('buyer-cpf').value.trim();

  if (!buyerName || !buyerPhone || !buyerCPF) {
    alert('Por favor, preencha nome, telefone e CPF.');
    return;
  }

  try {
    const { token } = await cardForm.createCardToken();

    const transaction_amount = selectedNumbers.length * 5;
    const paymentData = {
      transaction_amount,
      token,
      payment_method_id: 'visa',
      description: `Compra de números: ${selectedNumbers.join(', ')}`,
    };

    await reserveNumbers();

    const res = await fetch(`${BASE_URL}/process_payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        numbers: selectedNumbers,
        buyerName,
        buyerPhone,
        buyerCPF,
        paymentData,
      }),
    });

    const result = await res.json();

    if (!res.ok) throw new Error(result.error || 'Erro ao processar pagamento');

    if (result.status === 'approved') {
      document.getElementById('success-message').style.display = 'block';
      document.getElementById('payment-section').style.display = 'none';
      selectedNumbers = [];
      updatePaymentSection();
      await loadNumbers();
    } else {
      document.getElementById('error-message-box').style.display = 'block';
      await loadNumbers();
    }
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    document.getElementById('error-message-box').style.display = 'block';
    await loadNumbers();
  }
}

// Carrega números disponíveis
async function loadNumbers() {
  try {
    const res = await fetch(`${BASE_URL}/available_numbers`);
    const numbers = await res.json();

    const grid = document.getElementById('number-grid');
    grid.innerHTML = '';

    numbers.forEach(({ number, status }) => {
      const div = document.createElement('div');
      div.textContent = number;
      div.className = 'number';

      if (status === 'disponível') div.classList.add('available');
      else if (status === 'reservado') div.classList.add('reserved');
      else if (status === 'vendido') div.classList.add('sold');

      if (status === 'disponível' || (status === 'reservado' && selectedNumbers.includes(number))) {
        div.addEventListener('click', () => toggleNumber(number, div));
      }

      grid.appendChild(div);
    });

    updatePaymentSection();
  } catch (error) {
    console.error('Erro ao carregar números:', error);
    document.getElementById('number-error').style.display = 'block';
  }
}

// Alterna seleção de número
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

// Atualiza seção de pagamento com resumo
function updatePaymentSection() {
  const selectedSpan = document.getElementById('selected-numbers');
  const totalSpan = document.getElementById('total-amount');
  selectedSpan.textContent = `Números selecionados: ${selectedNumbers.length > 0 ? selectedNumbers.join(', ') : 'Nenhum'}`;
  totalSpan.textContent = `Total: R$ ${(selectedNumbers.length * 5).toFixed(2)}`;

  const paySection = document.getElementById('payment-section');
  paySection.style.display = selectedNumbers.length > 0 ? 'block' : 'none';
}

// Reserva números no backend
async function reserveNumbers() {
  if (selectedNumbers.length === 0) return;

  const res = await fetch(`${BASE_URL}/reserve_numbers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      numbers: selectedNumbers,
    }),
  });

  if (!res.ok) throw new Error('Erro ao reservar números');
}

// Evento pagamento via Pix
document.getElementById('pay-pix')?.addEventListener('click', async () => {
  document.getElementById('card-form').style.display = 'none';
  document.getElementById('pix-details').style.display = 'block';

  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerPhone = document.getElementById('buyer-phone').value.trim();
  const buyerCPF = document.getElementById('buyer-cpf').value.trim();

  if (!buyerName || !buyerPhone || !buyerCPF) {
    alert('Por favor, preencha nome, telefone e CPF.');
    return;
  }

  try {
    await reserveNumbers();

    const transaction_amount = selectedNumbers.length * 5;
    const res = await fetch(`${BASE_URL}/process_pix_payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        numbers: selectedNumbers,
        buyerName,
        buyerPhone,
        buyerCPF,
        transaction_amount,
      }),
    });

    if (!res.ok) throw new Error(`Erro ao processar Pix: ${res.statusText}`);

    const result = await res.json();

    if (result.qr_code) {
      document.getElementById('pix-qr').src = `data:image/png;base64,${result.qr_code_base64}`;
      document.getElementById('pix-code').textContent = result.qr_code;
      checkPixPaymentStatus(result.payment_id);
    } else {
      alert('Erro ao gerar Pix!');
      await loadNumbers();
    }
  } catch (error) {
    console.error('Erro ao processar Pix:', error);
    alert('Erro ao processar Pix!');
    await loadNumbers();
  }
});

// Verifica status do Pix
async function checkPixPaymentStatus(paymentId) {
  try {
    const res = await fetch(`${BASE_URL}/payment_status/${paymentId}`);
    const data = await res.json();

    if (data.status === 'approved') {
      document.getElementById('success-message').style.display = 'block';
      document.getElementById('payment-section').style.display = 'none';
      selectedNumbers = [];
      updatePaymentSection();
      await loadNumbers();
    } else if (data.status === 'pending') {
      setTimeout(() => checkPixPaymentStatus(paymentId), 5000);
    } else {
      document.getElementById('error-message-box').style.display = 'block';
      await loadNumbers();
    }
  } catch (error) {
    console.error('Erro ao verificar status do Pix:', error);
    await loadNumbers();
  }
}

window.onload = async () => {
  await initializeMercadoPago();
  await loadNumbers();
};
