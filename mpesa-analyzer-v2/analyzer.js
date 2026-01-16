/**
 * M-Pesa Business Analyzer Engine
 * Handles transaction processing, consolidation, and health scoring
 */

class MpesaAnalyzer {
    constructor(businessType = 'retail') {
        this.businessType = businessType;
        this.benchmarks = this.getBenchmarks(businessType);
    }

    getBenchmarks(type) {
        const benchmarks = {
            retail: {
                profitMargin: { excellent: 8, good: 5, warning: 2, critical: 0 },
                feeRatio: { excellent: 1, good: 2, warning: 3, critical: 5 },
                growthRate: { excellent: 15, good: 8, warning: 3, critical: 0 }
            },
            distributor: {
                profitMargin: { excellent: 12, good: 8, warning: 4, critical: 0 },
                feeRatio: { excellent: 0.5, good: 1, warning: 2, critical: 3 },
                growthRate: { excellent: 20, good: 12, warning: 5, critical: 0 }
            },
            services: {
                profitMargin: { excellent: 25, good: 15, warning: 8, critical: 0 },
                feeRatio: { excellent: 2, good: 3, warning: 5, critical: 8 },
                growthRate: { excellent: 25, good: 15, warning: 8, critical: 0 }
            },
            online: {
                profitMargin: { excellent: 40, good: 25, warning: 15, critical: 0 },
                feeRatio: { excellent: 3, good: 5, warning: 8, critical: 12 },
                growthRate: { excellent: 30, good: 20, warning: 10, critical: 0 }
            }
        };
        return benchmarks[type] || benchmarks.retail;
    }

    /**
     * Consolidate transactions - merge fees into parent transactions
     */
    consolidateTransactions(transactions) {
        const consolidated = [];
        const feeKeywords = ['transaction charge', 'withdrawal fee', 'excise duty', 'ledger fee'];

        for (let i = 0; i < transactions.length; i++) {
            const txn = transactions[i];
            const desc = txn.details.toLowerCase();

            // Check if this is a fee
            const isFee = feeKeywords.some(keyword => desc.includes(keyword));

            if (isFee && consolidated.length > 0) {
                // Add to previous transaction's fees
                const parent = consolidated[consolidated.length - 1];
                parent.fees = (parent.fees || 0) + txn.withdrawn;
                parent.totalCost = (parent.totalCost || parent.withdrawn) + txn.withdrawn;
            } else {
                // Regular transaction
                consolidated.push({
                    ...txn,
                    fees: 0,
                    totalCost: txn.withdrawn || txn.paidIn
                });
            }
        }

        return consolidated;
    }

    /**
     * Parse M-Pesa PDF text
     */
    parseMpesaText(text) {
        const transactions = [];
        const cleanText = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
        const regex = /([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s+(.*?)(?=[A-Z0-9]{10}\s+\d{4}-\d{2}-\d{2}|$)/g;

        let match;
        while ((match = regex.exec(cleanText)) !== null) {
            const receipt = match[1];
            const date = match[2];
            const rawTail = match[3];
            const numberMatches = rawTail.match(/-?[\d,]+\.\d{2}/g);

            if (numberMatches && numberMatches.length >= 2) {
                const cleanNums = numberMatches.map(n => parseFloat(n.replace(/,/g, '')));
                const balance = cleanNums[cleanNums.length - 1];
                const rawAmount = cleanNums[cleanNums.length - 2];

                let details = rawTail.split('Completed')[0].trim();
                if (details.length === 0) details = rawTail.split(numberMatches[numberMatches.length - 2])[0].trim();

                let paidIn = 0;
                let withdrawn = 0;
                if (rawAmount < 0) withdrawn = Math.abs(rawAmount);
                else paidIn = rawAmount;

                details = details.replace(/Completed/gi, '').trim();

                transactions.push({ receipt, date, details, paidIn, withdrawn, balance });
            }
        }

        return this.consolidateTransactions(transactions);
    }

    /**
     * Analyze transactions and calculate metrics
     */
    analyze(transactions, dateFilter = 'all') {
        // Filter by date
        const filtered = this.filterByDate(transactions, dateFilter);

        const results = {
            totalRevenue: 0,
            totalExpenses: 0,
            totalFees: 0,
            netProfit: 0,
            categories: {
                Revenue: 0, Utilities: 0, Stock: 0, Data: 0, Rent: 0, Personal: 0, Other: 0
            },
            customers: {},
            vendors: {},
            dailyFlow: {},
            recurring: [],
            anomalies: []
        };

        const getName = (str) => {
            if (str.includes(' to ')) return str.split(' to ')[1].trim();
            if (str.includes(' from ')) return str.split(' from ')[1].trim();
            if (str.includes('-')) return str.split('-')[1].trim();
            return str.substring(0, 30);
        };

        filtered.forEach(t => {
            const dateKey = t.date.split(' ')[0];
            if (!results.dailyFlow[dateKey]) results.dailyFlow[dateKey] = { in: 0, out: 0 };

            const desc = t.details.toLowerCase();

            // Track fees separately
            results.totalFees += t.fees || 0;

            if (t.paidIn > 0) {
                results.dailyFlow[dateKey].in += t.paidIn;
                if (desc.includes('michael mwenda') || desc.includes('personal')) {
                    results.categories.Personal += t.paidIn;
                } else {
                    results.categories.Revenue += t.paidIn;
                    const payer = getName(t.details);
                    results.customers[payer] = (results.customers[payer] || 0) + t.paidIn;
                    results.totalRevenue += t.paidIn;
                }

                // Detect large inflows
                if (t.paidIn > 10000) {
                    results.anomalies.push({
                        type: 'large_inflow',
                        amount: t.paidIn,
                        date: t.date,
                        details: t.details
                    });
                }
            } else if (t.withdrawn > 0) {
                results.dailyFlow[dateKey].out += t.withdrawn;
                const payee = getName(t.details);
                results.vendors[payee] = (results.vendors[payee] || 0) + t.withdrawn;

                let cat = 'Other';
                if (desc.includes('kplc') || desc.includes('token')) cat = 'Utilities';
                else if (desc.includes('pakir') || desc.includes('wholesalers') || desc.includes('stock')) cat = 'Stock';
                else if (desc.includes('data') || desc.includes('safaricom') || desc.includes('airtime')) cat = 'Data';
                else if (desc.includes('rent') || desc.includes('loop biz')) cat = 'Rent';
                else if (desc.includes('michael mwenda') || desc.includes('personal')) cat = 'Personal';

                if (cat !== 'Personal') {
                    results.categories[cat] = (results.categories[cat] || 0) + t.withdrawn;
                    results.totalExpenses += t.withdrawn;
                } else {
                    results.categories.Personal -= t.withdrawn;
                }

                // Detect large withdrawals
                if (t.withdrawn > 15000) {
                    results.anomalies.push({
                        type: 'large_withdrawal',
                        amount: t.withdrawn,
                        date: t.date,
                        details: t.details,
                        fees: t.fees
                    });
                }
            }
        });

        results.netProfit = results.totalRevenue - results.totalExpenses;
        results.profitMargin = results.totalRevenue > 0 ? (results.netProfit / results.totalRevenue) * 100 : 0;
        results.feeRatio = results.totalRevenue > 0 ? (results.totalFees / results.totalRevenue) * 100 : 0;

        // Detect recurring patterns
        results.recurring = this.detectRecurring(filtered);

        return results;
    }

    filterByDate(transactions, period) {
        if (period === 'all') return transactions;

        const now = new Date();
        const cutoff = new Date();

        if (period === '30') cutoff.setDate(now.getDate() - 30);
        else if (period === '90') cutoff.setDate(now.getDate() - 90);
        else if (period === '7') cutoff.setDate(now.getDate() - 7);

        return transactions.filter(t => new Date(t.date) >= cutoff);
    }

    detectRecurring(transactions) {
        const patterns = {};

        transactions.forEach(t => {
            const desc = t.details.toLowerCase();
            const amount = t.withdrawn || t.paidIn;
            const key = `${desc.substring(0, 20)}_${Math.round(amount)}`;

            if (!patterns[key]) patterns[key] = [];
            patterns[key].push(t.date);
        });

        // Find patterns with 2+ occurrences
        return Object.entries(patterns)
            .filter(([_, dates]) => dates.length >= 2)
            .map(([key, dates]) => ({
                description: key.split('_')[0],
                amount: parseInt(key.split('_')[1]),
                frequency: dates.length,
                dates
            }));
    }

    /**
     * Calculate health score
     */
    calculateHealthScore(data) {
        const scores = {
            profitability: this.scoreProfitability(data.profitMargin),
            efficiency: this.scoreEfficiency(data.feeRatio),
            cashflow: this.scoreCashflow(data),
            growth: this.scoreGrowth(data)
        };

        const weights = { profitability: 0.3, efficiency: 0.25, cashflow: 0.25, growth: 0.2 };
        const overall = Object.entries(scores).reduce((sum, [key, score]) =>
            sum + (score * weights[key]), 0
        );

        return {
            overall: Math.round(overall),
            dimensions: scores,
            status: this.getStatus(overall)
        };
    }

    scoreProfitability(margin) {
        const b = this.benchmarks.profitMargin;
        if (margin >= b.excellent) return 100;
        if (margin >= b.good) return 75;
        if (margin >= b.warning) return 50;
        if (margin > b.critical) return 25;
        return 10;
    }

    scoreEfficiency(feeRatio) {
        const b = this.benchmarks.feeRatio;
        if (feeRatio <= b.excellent) return 100;
        if (feeRatio <= b.good) return 75;
        if (feeRatio <= b.warning) return 50;
        if (feeRatio <= b.critical) return 25;
        return 10;
    }

    scoreCashflow(data) {
        const positiveRatio = data.totalRevenue > 0 ?
            (data.totalRevenue / (data.totalRevenue + data.totalExpenses)) * 100 : 0;

        if (positiveRatio >= 60) return 100;
        if (positiveRatio >= 50) return 75;
        if (positiveRatio >= 40) return 50;
        return 25;
    }

    scoreGrowth(data) {
        // Simplified - would need historical data for real growth calc
        return 50; // Neutral score
    }

    getStatus(score) {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Needs Work';
        return 'Critical';
    }
}
