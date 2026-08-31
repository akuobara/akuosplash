// Script para simular exactamente lo que hace el frontend
// y verificar que el backend lo procese bien

const http = require('http');

const data = JSON.stringify({
  clienteId: null,
  clienteNombre: "Cerro TEST",
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
});

console.log("Enviando:", data);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/entregas',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.write(data);
req.end();
