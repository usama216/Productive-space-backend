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
            if (paymentMethod.includes('Pay Now') || paymentMethod.includes('Credit Card')) {
                return paymentMethod;
            }
            return paymentMethod.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
    }
};

module.exports = {
    formatPaymentMethod
};
