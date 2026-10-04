const app = require('./src/app');
const config = require('./src/config');

app.listen(config.port, () => {
	console.log(`DrSahayak listening on http://localhost:${config.port}`);
	console.log(`Health check: http://localhost:${config.port}/health`);
});
