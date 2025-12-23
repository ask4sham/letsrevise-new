const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// TODO: later we will plug routes here

module.exports = app;
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'letsrevise-backend' });
});
