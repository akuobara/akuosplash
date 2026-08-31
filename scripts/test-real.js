// Simular una petición real al backend
const http = require('http');

const payload = JSON.stringify({
  clienteNombre: "TEST REAL",
  clienteId: null,
  litros: 17000,
  precioPorLitro: 8.7,
  total: 147900,
  montoEfectivo: 300000,
  montoTransferencia: 0,
  metodoPago: "efectivo",
  estadoPago: "pagado",
  descuentoTipo: "ninguno",
  descuento: 0,
  descuentoPorLitro: 0,
  descuentoPor: "chofer",
  fotoMedidorUrl: null,
  nota: "TEST DE PAGO",
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/entregas',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log("Enviando payload con montoEfectivo=300000...");

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body.substring(0, 500));
    
    // Si fue 401, no hay sesión. Pero podemos ver si el backend procesa el body.
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(payload);
req.end();
