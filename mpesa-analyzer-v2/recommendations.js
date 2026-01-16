/**
 * Recommendations Engine
 * Generates actionable recommendations based on analysis
 */

class RecommendationsEngine {
    constructor(businessType) {
        this.businessType = businessType;
    }

    generate(data, healthScore) {
        const recommendations = [];

        // High fee ratio
        if (data.feeRatio > 3) {
            const savings = Math.round(data.totalFees * 0.6);
            recommendations.push({
                id: 'high_fees',
                priority: 'high',
                icon: '💸',
                title: `You're losing KES ${data.totalFees.toLocaleString()} to transaction fees`,
                action: 'Switch to Pay Bill for suppliers instead of Send Money',
                impact: `Save ~KES ${savings.toLocaleString()}/month`,
                howTo: 'Ask your regular suppliers for their Pay Bill numbers. Pay Bill fees are 60% lower than Send Money.',
                category: 'efficiency'
            });
        }

        // Large withdrawals
        const largeWithdrawals = data.anomalies.filter(a => a.type === 'large_withdrawal');
        if (largeWithdrawals.length > 0) {
            const totalFees = largeWithdrawals.reduce((sum, w) => sum + (w.fees || 0), 0);
            recommendations.push({
                id: 'large_withdrawals',
                priority: 'medium',
                icon: '🏦',
                title: `${largeWithdrawals.length} large withdrawals detected`,
                action: 'Use M-Pesa to Bank transfer for amounts over KES 15,000',
                impact: `Could save KES ${Math.round(totalFees * 0.7).toLocaleString()} in fees`,
                howTo: 'Go to M-Pesa menu > Send Money > To Bank Account. Fees are much lower for bank transfers.',
                category: 'efficiency'
            });
        }

        // Low profit margin
        if (data.profitMargin < 2) {
            recommendations.push({
                id: 'low_margin',
                priority: 'high',
                icon: '📊',
                title: `Profit margin is ${data.profitMargin.toFixed(1)}% (Industry avg: 3-5%)`,
                action: 'Review pricing strategy and reduce operational costs',
                impact: 'Increasing margin to 3% would add KES ' + Math.round(data.totalRevenue * 0.02).toLocaleString(),
                howTo: '1. Audit your top 5 expenses. 2. Negotiate better rates with suppliers. 3. Consider 5-10% price increase on high-volume items.',
                category: 'profitability'
            });
        }

        // High expense-to-revenue ratio
        const expenseRatio = data.totalRevenue > 0 ? (data.totalExpenses / data.totalRevenue) : 0;
        if (expenseRatio > 0.9) {
            recommendations.push({
                id: 'high_expenses',
                priority: 'high',
                icon: '⚠️',
                title: 'Expenses are consuming ' + Math.round(expenseRatio * 100) + '% of revenue',
                action: 'Implement expense tracking and set monthly budgets',
                impact: 'Reducing expenses by 10% adds KES ' + Math.round(data.totalExpenses * 0.1).toLocaleString() + ' to profit',
                howTo: 'Use this analyzer monthly to track trends. Set alerts for unusual spending.',
                category: 'cashflow'
            });
        }

        // Recurring payments optimization
        if (data.recurring.length > 3) {
            recommendations.push({
                id: 'recurring_payments',
                priority: 'low',
                icon: '🔄',
                title: `${data.recurring.length} recurring payments detected`,
                action: 'Set up M-Pesa Standing Orders to automate and save time',
                impact: 'Save 2-3 hours/month on manual payments',
                howTo: 'Contact Safaricom to set up standing orders for rent, utilities, and regular suppliers.',
                category: 'efficiency'
            });
        }

        // Revenue concentration risk
        const topCustomer = Object.entries(data.customers).sort((a, b) => b[1] - a[1])[0];
        if (topCustomer && (topCustomer[1] / data.totalRevenue) > 0.4) {
            recommendations.push({
                id: 'revenue_concentration',
                priority: 'medium',
                icon: '🎯',
                title: `${Math.round((topCustomer[1] / data.totalRevenue) * 100)}% of revenue from one customer`,
                action: 'Diversify your customer base to reduce risk',
                impact: 'Protect against revenue loss if this customer leaves',
                howTo: 'Invest in marketing to acquire 3-5 new customers of similar size.',
                category: 'growth'
            });
        }

        // Cash flow volatility
        const dailyValues = Object.values(data.dailyFlow).map(d => d.in - d.out);
        const volatility = this.calculateVolatility(dailyValues);
        if (volatility > 5000) {
            recommendations.push({
                id: 'cash_volatility',
                priority: 'medium',
                icon: '📉',
                title: 'High cash flow volatility detected',
                action: 'Build a cash reserve equal to 1 month of expenses',
                impact: 'Protect against slow periods and emergencies',
                howTo: 'Set aside 10% of profits weekly until you reach KES ' + Math.round(data.totalExpenses).toLocaleString(),
                category: 'cashflow'
            });
        }

        // Sort by priority
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    }

    calculateVolatility(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    generateAnomalyRecommendations(anomaly) {
        if (anomaly.type === 'large_withdrawal') {
            return {
                title: `Large withdrawal: KES ${anomaly.amount.toLocaleString()}`,
                recommendation: 'Consider using Pay Bill or Bank Transfer to reduce fees',
                potentialSaving: Math.round(anomaly.amount * 0.015)
            };
        }

        if (anomaly.type === 'large_inflow') {
            return {
                title: `Large payment received: KES ${anomaly.amount.toLocaleString()}`,
                recommendation: 'Consider opening a business bank account for better rates',
                potentialSaving: 0
            };
        }

        return null;
    }
}
