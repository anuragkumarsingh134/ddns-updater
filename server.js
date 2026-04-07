const express = require('express');
const dotenv = require('dotenv');
const { ensureFiles, ENV_FILE, logMessage } = require('./utils');
const apiRoutes = require('./api');
const { startDDNSUpdater } = require('./updater');

ensureFiles();
dotenv.config({ path: ENV_FILE });

const app = express();

app.use(express.json());
app.use(express.static('public'));

app.use('/api', apiRoutes);

app.listen(5000, '0.0.0.0', () => {
    logMessage('INFO', 'Node.js Server Started on port 5000');
    console.log(`Server listening on port 5000`);
    startDDNSUpdater();
});
