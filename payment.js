// payment.js

let mp;
let selectedNumbers = [];
let userId = Math.random().toString(36).substring(2, 15);
const BASE_URL = 'https://subzero2-0.onrender.com';

async function initializeMercadoPago() {
  try {
    // Use sua chave pública correta aqui
    const publicKey = 'APP_USR-d4fbc28c-ac60-4263-90bf-96b53835f289';
    mp = new MercadoPago(publicKey, {
      locale: 'pt-BR',
    });
    await initializeCardForm();
  } catch (error) {
    console.error('Erro ao inicializar Mercado Pago:', error);
  }
}

async function initializeCardForm() {
  try {
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
          const errorBox = document.getElementById('error-message-box');
          if (errorBox) errorBox.style.display = 'block';
        }
      }
    });

    const submitCardBtn = document.getElementById('submit-card');
    if (submitCardBtn) {
      submitCardBtn.addEventListener('click', async () => {
        const buyerName = document.getElementById('buyer-name').value.trim();
        const buyerPhone = document.getElementById('buyer-phone').value.trim();
        const buyerCPF = document.getElementById('buyer-cpf') ? document.getElementById('buyer-cpf').value.trim() : '';

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
            payment_method_id: 'visa', // ou outro conforme aceitação
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
            await loadNumbers();
          } else {
            const errorBox = document.getElementById('error-message-box');
            if (errorBox) errorBox.style.display = 'block';
            await loadNumbers();
          }

        } catch (error) {
          console.error('Erro ao processar pagamento:', error);
          const errorBox = document.getElementById('error-message-box');
          if (errorBox) errorBox.style.display = 'block';
          await loadNumbers();
        }
      });
    }

  } catch (error) {
    console.error('Erro ao configurar o formulário do cartão:', error);
  }
}

async function loadNumbers() {
  try {
    const response = await fetch(`${BASE_URL}/available_numbers`);
    const numbers = await response.json();

    const grid = document.getElementById('number-grid');
    if (!grid) return;

    grid.innerHTML = '';
    numbers.forEach(numObj => {
      const div = document.createElement('div');
      div.textContent = numObj.number;
      div.className = 'number ' + (numObj.status === 'disponível' ? 'available' : (numObj.status === 'reservado' ? 'reserved' : 'sold'));
      if (numObj.status === 'vendido' || numObj.status === 'reservado') {
        div.style.cursor = 'not-allowed';
      } else {
        div.addEventListener('click', () => toggleNumber(numObj.number, div));
      }
      grid.appendChild(div);
    });
  } catch (error) {
    console.error('Erro ao carregar números:', error);
    const numberError = document.getElementById('number-error');
    if (numberError) numberError.style.display = 'block';
  }
}

function toggleNumber(number, element) {
  if (selectedNumbers.includes(number)) {
    selectedNumbers = selectedNumbers.filter(n => n !== number);
    element.classList.remove('selected');
  } else {
    selectedNumbers.push(number);
    element.classList.add('selected');
  }
  updatePaymentSection();
}

function updatePaymentSection() {
  const selectedNumbersText = selectedNumbers.length > 0 ? selectedNumbers.join(', ') : 'Nenhum';
  const total = selectedNumbers.length * 5;

  const selectedNumbersEl = document.getElementById('selected-numbers');
  const totalAmountEl = document.getElementById('total-amount');

  if (selectedNumbersEl) selectedNumbersEl.textContent = `Números selecionados: ${selectedNumbersText}`;
  if (totalAmountEl) totalAmountEl.textContent = `Total: R$ ${total.toFixed(2)}`;
}

async function reserveNumbers() {
  try {
    const response = await fetch(`${BASE_URL}/reserve_numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, numbers: selectedNumbers })
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Erro ao reservar números:', error);
    return false;
  }
}

document.getElementById('pay-pix')?.addEventListener('click', async () => {
  document.getElementById('card-form').style.display = 'none';
  document.getElementById('pix-details').style.display = 'block';

  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerPhone = document.getElementById('buyer-phone').value.trim();
  const buyerCPF = document.getElementById('buyer-cpf') ? document.getElementById('buyer-cpf').value.trim() : '';
  const transaction_amount = selectedNumbers.length * 5;

  if (!buyerName || !buyerPhone || !buyerCPF) {
    alert('Por favor, preencha nome, telefone e CPF.');
    return;
  }

  const reserved = await reserveNumbers();
  if (!reserved) {
    alert('Erro ao reservar números. Tente novamente.');
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
      const pixQr = document.getElementById('pix-qr');
      const pixCode = document.getElementById('pix-code');
      if (pixQr) pixQr.src = `data:image/png;base64,${result.qr_code_base64}`;
      if (pixCode) pixCode.textContent = result.qr_code;
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

async function checkPixPaymentStatus(paymentId) {
  try {
    const response = await fetch(`${BASE_URL}/payment_status/${paymentId}`);
    const result = await response.json();

    if (result.status === 'approved') {
      document.getElementById('success-message').style.display = 'block';
      document.getElementById('payment-section').style.display = 'none';
      selectedNumbers = [];
      updatePaymentSection();
      await loadNumbers();
    } else if (result.status === 'pending') {
      setTimeout(() => checkPixPaymentStatus(paymentId), 5000);
    } else {
      document.getElementById('error-message-box').style.display = 'block';
      await loadNumbers();
    }
  } catch (error) {
    console.error('Erro ao verificar status do Pix:', error);
  }
}

window.onload = async () => {
  await initializeMercadoPago();
  await loadNumbers();
  updatePaymentSection();
};
