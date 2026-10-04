const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/', dashboardController.overview);
router.post('/:id/summary', dashboardController.generateSummary);
router.post('/:id/review', dashboardController.markReviewed);

module.exports = router;
