// =============================================================
// APPLY.JS – Aid application with tier assessment
// =============================================================

const TIER_CONFIG = {
  disability_severe: { tier: 5, label: 'Severe Disability', amount: 30000, fee: 1000 },
  disability_moderate: { tier: 5, label: 'Moderate Disability', amount: 30000, fee: 1000 },
  parent_death_both: { tier: 4, label: 'Loss of Both Parents', amount: 25000, fee: 600 },
  parent_death_one: { tier: 4, label: 'Loss of One Parent', amount: 25000, fee: 600 },
  disease_chronic: { tier: 3, label: 'Chronic Disease', amount: 20000, fee: 450 },
  disease_acute: { tier: 3, label: 'Acute Disease', amount: 20000, fee: 450 },
  calamity: { tier: 2, label: 'Natural Calamity', amount: 15000, fee: 350 },
  general: { tier: 1, label: 'General Hardship', amount: 10000, fee: 250 }
};

// 🔴 UPDATED: Now using your Render backend!
const STK_PUSH_ENDPOINT = 'https://redcross-kenya.onrender.com/api/payments/stk-push';

function assessTier() {
  const disability = document.getElementById('q-disability').value;
  const disease = document.getElementById('q-disease').value;
  const parentDeath = document.getElementById('q-parent-death').value;
  const calamity = document.getElementById('q-calamity').value;
  const general = document.getElementById('q-general').value;

  if (disability === 'yes-severe') {
    return TIER_CONFIG.disability_severe;
  }
  if (disability === 'yes-moderate') {
    return TIER_CONFIG.disability_moderate;
  }
  if (parentDeath === 'yes-both' || parentDeath === 'yes-one') {
    return TIER_CONFIG[parentDeath === 'yes-both' ? 'parent_death_both' : 'parent_death_one'];
  }
  if (disease === 'yes-chronic' || disease === 'yes-acute') {
    return TIER_CONFIG.disease_chronic;
  }
  if (calamity !== 'no') {
    return TIER_CONFIG.calamity;
  }
  if (general === 'yes') {
    return TIER_CONFIG.general;
  }
  return null;
}

function displayAssessment() {
  const result = assessTier();
  const resultDiv = document.getElementById('assessment-result');

  if (!result) {
    resultDiv.style.display = 'none';
    document.getElementById('apply-error').textContent = 'Please answer the questions to assess your tier.';
    document.getElementById('apply-error').classList.add('show');
    return;
  }

  resultDiv.style.display = 'block';
  document.getElementById('assessed-tier').textContent = result.label;
  document.getElementById('assessed-amount').textContent = 'KES ' + result.amount.toLocaleString();
  document.getElementById('assessed-fee').textContent = 'KES ' + result.fee.toLocaleString();

  resultDiv.dataset.tier = result.tier;
  resultDiv.dataset.amount = result.amount;
  resultDiv.dataset.fee = result.fee;
  resultDiv.dataset.label = result.label;
}

let currentApplication = null;
let pollingInterval = null;

// =============================================================
// STEPPER NAVIGATION
// =============================================================
function goToStep(stepNum) {
  document.getElementById('reg-step-1').style.display = stepNum === 1 ? 'block' : 'none';
  document.getElementById('reg-step-2').style.display = stepNum === 2 ? 'block' : 'none';
  document.getElementById('reg-step-3').style.display = stepNum === 3 ? 'block' : 'none';

  document.getElementById('step-nav-1').className = 'step-item ' + (stepNum >= 1 ? 'active' : '');
  document.getElementById('step-nav-2').className = 'step-item ' + (stepNum >= 2 ? 'active' : '');
  document.getElementById('step-nav-3').className = 'step-item ' + (stepNum >= 3 ? 'active' : '');

  if (stepNum === 2) {
    const name = document.getElementById('reg-fullName').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const idNum = document.getElementById('reg-idNum').value;
    const location = document.getElementById('reg-location').value;
    if (!name || !email || !phone || !idNum || !location) {
      document.getElementById('step1-error').textContent = 'Please complete all fields in Step 1.';
      document.getElementById('step1-error').classList.add('show');
      goToStep(1);
      return;
    }
    document.getElementById('step1-error').classList.remove('show');
  }

  if (stepNum === 3) {
    const resultDiv = document.getElementById('assessment-result');
    const tier = parseInt(resultDiv.dataset.tier);
    const amount = parseInt(resultDiv.dataset.amount);
    const fee = parseInt(resultDiv.dataset.fee);
    const label = resultDiv.dataset.label;

    if (!tier) {
      document.getElementById('step2-error').textContent = 'Please complete the assessment first.';
      document.getElementById('step2-error').classList.add('show');
      goToStep(2);
      return;
    }

    document.getElementById('sum-name').textContent = document.getElementById('reg-fullName').value;
    document.getElementById('sum-phone').textContent = document.getElementById('reg-phone').value;
    document.getElementById('sum-county').textContent = document.getElementById('reg-location').value;
    document.getElementById('sum-tier').textContent = label;
    document.getElementById('sum-grant').textContent = 'KES ' + amount.toLocaleString();
    document.getElementById('sum-fee').textContent = 'KES ' + fee.toLocaleString();
  }
}

// =============================================================
// STK PUSH — TRIGGER REGISTRATION FEE
// =============================================================
async function triggerStkPush() {
  const resultDiv = document.getElementById('assessment-result');
  const fee = parseInt(resultDiv.dataset.fee);
  const phoneRaw = document.getElementById('reg-phone').value.trim();
  const name = document.getElementById('reg-fullName').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const user = window.getCurrentUser();

  const phone = normalizeKenyanPhone(phoneRaw);
  if (!phone) {
    document.getElementById('step3-error').textContent = 'Enter a valid Safaricom number, e.g. 0712345678.';
    document.getElementById('step3-error').classList.add('show');
    return;
  }

  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner--light"></span> Sending...';

  try {
    const response = await fetch(STK_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phone,
        amount: fee,
        description: 'Red Cross Kenya registration fee',
        orderId: user?.id || `guest-${Date.now()}`
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Payment failed');
    }

    document.getElementById('step3-error').classList.remove('show');
    document.getElementById('reg-ref-code').value = result.transactionId;

    // Start polling for payment status
    startPolling(result.transactionId);

    alert('✅ STK Push sent to ' + phone + '!\nCheck your phone and enter M-PIN to complete payment.');

  } catch (err) {
    document.getElementById('step3-error').textContent = err.message || 'Payment failed. Please try again.';
    document.getElementById('step3-error').classList.add('show');
  }

  btn.disabled = false;
  btn.innerHTML = 'Pay Registration Fee — STK Push';
}

// =============================================================
// POLL PAYMENT STATUS
// =============================================================
function startPolling(transactionId) {
  if (pollingInterval) clearInterval(pollingInterval);
  
  const statusUrl = STK_PUSH_ENDPOINT.replace('/stk-push', `/status/${transactionId}`);
  let attempts = 0;
  const maxAttempts = 30;

  pollingInterval = setInterval(async () => {
    attempts++;
    
    try {
      const response = await fetch(statusUrl);
      const result = await response.json();

      if (result.ok) {
        if (result.status === 'SUCCESS') {
          clearInterval(pollingInterval);
          document.getElementById('step3-error').classList.remove('show');
          document.getElementById('application-status').textContent = '✅ Payment successful! You can now submit your application.';
          document.getElementById('application-status').classList.add('show');
          document.getElementById('reg-ref-code').value = result.transactionId;
        } else if (result.status === 'FAILED' || result.status === 'TIMEOUT' || result.status === 'ERROR') {
          clearInterval(pollingInterval);
          document.getElementById('step3-error').textContent = 'Payment ' + result.status.toLowerCase() + '. Please try again.';
          document.getElementById('step3-error').classList.add('show');
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }

    if (attempts >= maxAttempts) {
      clearInterval(pollingInterval);
      document.getElementById('step3-error').textContent = 'Payment confirmation timed out. If you completed the payment, please contact support.';
      document.getElementById('step3-error').classList.add('show');
    }
  }, 3000);
}

// =============================================================
// SUBMIT APPLICATION
// =============================================================
async function submitApplication() {
  const refCode = document.getElementById('reg-ref-code').value;
  if (!refCode) {
    document.getElementById('step3-error').textContent = 'Please complete payment before submitting.';
    document.getElementById('step3-error').classList.add('show');
    return;
  }

  const resultDiv = document.getElementById('assessment-result');
  const tier = parseInt(resultDiv.dataset.tier);
  const amount = parseInt(resultDiv.dataset.amount);
  const fee = parseInt(resultDiv.dataset.fee);
  const label = resultDiv.dataset.label;

  const appData = {
    reference_code: refCode,
    full_name: document.getElementById('reg-fullName').value,
    email: document.getElementById('reg-email').value,
    phone: document.getElementById('reg-phone').value,
    id_number: document.getElementById('reg-idNum').value,
    county: document.getElementById('reg-location').value,
    description: document.getElementById('applicant-description').value,
    tier: tier,
    tier_label: label,
    aid_amount: amount,
    registration_fee: fee,
    status: 'pending_review',
    submitted_at: new Date().toISOString()
  };

  try {
    const { data, error } = await window.supabaseClient
      .from('aid_applications')
      .insert(appData)
      .select();

    if (error) throw error;

    localStorage.setItem('last_application', JSON.stringify({
      ...appData,
      referenceCode: refCode,
      submittedAt: new Date().toLocaleDateString('en-KE')
    }));

    window.location.href = 'confirmation.html';

  } catch (err) {
    document.getElementById('step3-error').textContent = 'Submission failed: ' + err.message;
    document.getElementById('step3-error').classList.add('show');
  }
}

function normalizeKenyanPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (/^2547\d{8}$/.test(digits)) return digits;
  if (/^07\d{8}$/.test(digits)) return '254' + digits.slice(1);
  if (/^7\d{8}$/.test(digits)) return '254' + digits;
  if (/^01\d{8}$/.test(digits)) return '254' + digits.slice(1);
  return null;
}

// Event listeners
document.getElementById('assess-btn').addEventListener('click', displayAssessment);
document.getElementById('proceed-to-payment').addEventListener('click', proceedToPayment);

// Auto-assess on question change
document.querySelectorAll('#q-disability, #q-disease, #q-parent-death, #q-calamity, #q-general').forEach(el => {
  el.addEventListener('change', () => {
    document.getElementById('assessment-result').style.display = 'none';
  });
});

// =============================================================
// EXPOSE FUNCTIONS TO GLOBAL
// =============================================================
window.goToStep = goToStep;
window.displayAssessment = displayAssessment;
window.triggerStkPush = triggerStkPush;
window.submitApplication = submitApplication;
window.normalizeKenyanPhone = normalizeKenyanPhone;
