const app = require('./app');
const http = require('http');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log('Backend running on port ' + PORT);
});
