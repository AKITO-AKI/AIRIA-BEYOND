// Simple test for health endpoint
const handler = require('./api/health.ts');

const req = {
  method: 'GET',
  headers: {}
};

const res = {
  status: (code) => {
    console.log('Status:', code);
    return res;
  },
  json: (data) => {
    console.log('Response:', JSON.stringify(data, null, 2));
    return res;
  }
};

handler.default(req, res);
