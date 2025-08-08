const express = require('express');
const config = require('./config');
const routes = require('./routes');
const {
    corsMiddleware,
    notFoundHandler,
    errorHandler,
    requestLogger,
    initializeTempDirectory
} = require('./middleware');

const app = express();

initializeTempDirectory();

app.use(requestLogger);
app.use(express.json({ limit: config.server.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: config.server.urlencodedLimit }));
app.use(corsMiddleware);
app.use(express.static('public'));

app.use('/', routes);

app.use(notFoundHandler);
app.use(errorHandler);
app.listen(config.server.port, () => {
    console.log(`🚀 Email Validator API running on port ${config.server.port}`);
    console.log(`🏥 Health check: http://localhost:${config.server.port}/api/health`);
});

module.exports = app;