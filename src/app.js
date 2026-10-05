const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth, requireRole } = require('./middleware/auth');
const authRoutes = require('./routes/auth.routes');
const voiceRoutes = require('./routes/voice.routes');
const ocrRoutes = require('./routes/ocr.routes');
const patientRoutes = require('./routes/patient.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(config.uploadDir));

app.get('/health', (req, res) => {
	res.json({ status: 'ok', mode: { gemini: config.geminiApiKey ? 'live' : 'mock' } });
});

app.use('/api/auth', authRoutes);
app.use('/api/voice', requireAuth, requireRole('doctor'), voiceRoutes);
app.use('/api/ocr', requireAuth, requireRole('doctor'), ocrRoutes);
app.use('/api/patients', requireAuth, patientRoutes);
app.use('/api/dashboard', requireAuth, requireRole('doctor'), dashboardRoutes);

app.use((req, res) => {
	if (req.path.startsWith('/api')) {
		return res.status(404).json({ success: false, error: 'Not found' });
	}
	return res.status(404).type('text/plain').send('Not found');
});

app.use(errorHandler);

module.exports = app;
