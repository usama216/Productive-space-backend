const { calculatePaymentAfterCredits } = require('../utils/creditHelper');

// Calculate payment required after applying credits
const calculatePayment = async (req, res) => {
  try {
    const { bookingAmount, userid } = req.body;
    const userId = userid || '00000000-0000-0000-0000-000000000000'; // For testing without auth

    if (!bookingAmount || bookingAmount <= 0) {
      return res.status(400).json({ error: 'Invalid booking amount' });
    }

    const paymentInfo = await calculatePaymentAfterCredits(userId, bookingAmount);

    res.json(paymentInfo);
  } catch (error) {
    console.error('❌ Error in calculatePayment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  calculatePayment
};
