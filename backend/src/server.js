const app = require('./app');
const http = require('http');
const { port } = require('./config/config');

const server = http.createServer(app);

server.listen(port, () => {
  console.log('Backend running on port ' + port);
});
