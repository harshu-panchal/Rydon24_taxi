import http from 'http';

const post = (url, body) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

async function test() {
  console.log('1. Starting OTP login for phone 9389394808...');
  const sendRes = await post('http://localhost:5000/api/v1/drivers/onboarding/send-otp', {
    phone: '9389394808'
  });
  console.log('Send OTP response:', JSON.stringify(sendRes, null, 2));

  console.log('\n2. Verifying OTP FIRST (without role)...');
  const verifyRes = await post('http://localhost:5000/api/v1/drivers/auth/verify-otp', {
    phone: '9389394808',
    otp: '0000'
  });
  console.log('Verify OTP response:', JSON.stringify(verifyRes, null, 2));
}

test().catch(console.error);
