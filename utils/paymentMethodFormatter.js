/**
 * Utility function to convert technical payment method names to user-friendly names
 * @param {string} paymentMethod - The technical payment method name from the database
 * @returns {string} - User-friendly payment method name
 */
const formatPaymentMethod = (paymentMethod) => {
    if (!paymentMethod) return 'Unknown';
    
    const method = paymentMethod.toLowerCase();
    
    switch (method) {
        case 'paynow_online':
        case 'paynow':
            return 'Pay Now';
        case 'credit_card':
        case 'card':
        case 'creditcard':
            return 'Credit Card';
        case 'bank_transfer':
        case 'banktransfer':
            return 'Bank Transfer';
        case 'cash':
            return 'Cash';
        case 'online':
        case 'online_payment':
            return 'Online Payment';
        default:
            // If it's already user-friendly, return as is
            if (paymentMethod.includes('Pay Now') || paymentMethod.includes('Credit Card')) {
                return paymentMethod;
            }
            // Capitalize first letter of each word for unknown methods
            return paymentMethod.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
    }
};

module.exports = {
    formatPaymentMethod
};
