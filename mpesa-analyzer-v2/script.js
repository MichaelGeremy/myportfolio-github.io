/**
 * Main Application Script
 * Handles UI interactions, PDF processing, and dashboard rendering
 */

// Configure PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Global state
let analyzer, recommendationsEngine;
let currentData, currentPeriod = '30';
let businessConfig = {
    type: 'retail',
    revenueTarget: null
};

// DOM Elements
const onboardingModal = document.getElementById('onboarding-modal');
const uploadSection = document.getElementById('upload-section');
const loading = document.getElementById('loading');
const dashboard = document.getElementById('dashboard');
const fileInput = document.getElementById('file-input');
const dropArea = document.getElementById('drop-area');
const demoBtn = document.getElementById('demo-btn');
const errorDisplay = document.getElementById('error-display');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkOnboarding();
    setupEventListeners();
});

function checkOnboarding() {
    const saved = localStorage.getItem('mpesa_business_config');
    if (saved) {
        businessConfig = JSON.parse(saved);
        analyzer = new MpesaAnalyzer(businessConfig.type);
        recommendationsEngine = new RecommendationsEngine(businessConfig.type);
    } else {
        onboardingModal.classList.remove('hidden');
    }
}

function setupEventListeners() {
    // Onboarding
    document.querySelectorAll('.business-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.business-type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            businessConfig.type = btn.dataset.type;
        });
    });

    document.getElementById('save-onboarding').addEventListener('click', () => {
        const target = document.getElementById('revenue-target').value;
        if (target) businessConfig.revenueTarget = parseInt(target);

        localStorage.setItem('mpesa_business_config', JSON.stringify(businessConfig));
        analyzer = new MpesaAnalyzer(businessConfig.type);
        recommendationsEngine = new RecommendationsEngine(businessConfig.type);
        onboardingModal.classList.add('hidden');
    });

    // Settings
    document.getElementById('settings-btn').addEventListener('click', () => {
        onboardingModal.classList.remove('hidden');
    });

    // File upload
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Drag & drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });

    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    // Demo
    demoBtn.addEventListener('click', loadDemoData);

    // Date filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            if (currentData) updateDashboard(currentData);
        });
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFiles(files) {
    const file = files[0];
    if (file.type !== 'application/pdf') {
        showError('Please upload a PDF file');
        return;
    }
    processPDF(file);
}

async function processPDF(file) {
    uploadSection.classList.add('hidden');
    errorDisplay.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        const transactions = analyzer.parseMpesaText(fullText);

        if (transactions.length === 0) {
            showError('No transactions found. Ensure this is a valid M-Pesa statement PDF.');
            console.log('Raw text sample:', fullText.substring(0, 1000));
            return;
        }

        currentData = transactions;
        updateDashboard(transactions);

        loading.classList.add('hidden');
        dashboard.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        showError('Error processing PDF. Please try again.');
    }
}

function loadDemoData() {
    const demoTxns = [
        { receipt: 'DEMO1', date: '2025-06-01 10:00:00', details: 'Funds received from Emmanuel Muchiri', paidIn: 50000, withdrawn: 0, balance: 50000, fees: 0 },
        { receipt: 'DEMO2', date: '2025-06-02 12:00:00', details: 'Pay Bill to 888880 - KPLC PREPAID', paidIn: 0, withdrawn: 2500, balance: 47500, fees: 35 },
        { receipt: 'DEMO3', date: '2025-06-03 09:30:00', details: 'Merchant Payment to PAKIR ENTERPRISES', paidIn: 0, withdrawn: 15000, balance: 32500, fees: 50 },
        { receipt: 'DEMO4', date: '2025-06-03 14:00:00', details: 'Funds received from John Doe', paidIn: 30000, withdrawn: 0, balance: 62500, fees: 0 },
        { receipt: 'DEMO5', date: '2025-06-04 16:20:00', details: 'Pay Bill to 544544 - DATA VIBEZ', paidIn: 0, withdrawn: 1000, balance: 61500, fees: 15 },
        { receipt: 'DEMO6', date: '2025-06-05 08:00:00', details: 'Withdraw Cash at Agent', paidIn: 0, withdrawn: 16000, balance: 45500, fees: 240 },
        { receipt: 'DEMO7', date: '2025-06-05 10:00:00', details: 'Funds received from Emmanuel Muchiri', paidIn: 20000, withdrawn: 0, balance: 65500, fees: 0 },
        { receipt: 'DEMO8', date: '2025-06-06 11:00:00', details: 'Pay Bill to 888880 - KPLC PREPAID', paidIn: 0, withdrawn: 2500, balance: 63000, fees: 35 },
        { receipt: 'DEMO9', date: '2025-06-07 15:00:00', details: 'Funds received from Jane Smith', paidIn: 15000, withdrawn: 0, balance: 78000, fees: 0 },
        { receipt: 'DEMO10', date: '2025-06-08 09:00:00', details: 'Merchant Payment to PAKIR ENTERPRISES', paidIn: 0, withdrawn: 18000, balance: 60000, fees: 60 },
    ];

    uploadSection.classList.add('hidden');
    currentData = demoTxns;
    updateDashboard(demoTxns);
    dashboard.classList.remove('hidden');

    // Add demo banner
    if (!document.querySelector('.demo-banner')) {
        const banner = document.createElement('div');
        banner.className = 'demo-banner';
        banner.style.cssText = 'background: #f59e0b; color: #000; text-align: center; padding: 12px; font-weight: 600; margin-bottom: 20px; border-radius: 8px;';
        banner.innerHTML = '⚠️ DEMO MODE - Showing sample data';
        dashboard.insertBefore(banner, dashboard.firstChild);
    }
}

function updateDashboard(transactions) {
    const data = analyzer.analyze(transactions, currentPeriod);
    const healthScore = analyzer.calculateHealthScore(data);
    const recommendations = recommendationsEngine.generate(data, healthScore);

    // Update health score
    updateHealthScore(healthScore, data);

    // Update recommendations
    updateRecommendations(recommendations);

    // Update metrics
    document.getElementById('total-revenue').innerText = `KES ${data.totalRevenue.toLocaleString()}`;
    document.getElementById('total-expenses').innerText = `KES ${data.totalExpenses.toLocaleString()}`;
    document.getElementById('net-profit').innerText = `KES ${data.netProfit.toLocaleString()}`;
    document.getElementById('profit-margin').innerText = `${data.profitMargin.toFixed(1)}% margin`;
    document.getElementById('loan-limit').innerText = `KES ${Math.round(data.totalRevenue * 0.3).toLocaleString()}`;

    // Update charts
    updateCharts(data);

    // Update insights
    updateInsights(data);
}

function updateHealthScore(healthScore, data) {
    // Overall score
    const scoreCircle = document.getElementById('overall-score-circle');
    const percentage = (healthScore.overall / 100) * 360;
    scoreCircle.style.background = `conic-gradient(var(--accent-primary) ${percentage}deg, var(--bg-card) ${percentage}deg)`;

    document.getElementById('overall-score').innerText = healthScore.overall;
    document.getElementById('score-status').innerText = healthScore.status;
    document.getElementById('score-status').className = `score-status status-${healthScore.status.toLowerCase().replace(' ', '-')}`;

    // Dimensions
    updateDimension('profitability', healthScore.dimensions.profitability,
        `${data.profitMargin.toFixed(1)}% profit margin`,
        `Industry benchmark: 3-5% for ${businessConfig.type} businesses`);

    updateDimension('efficiency', healthScore.dimensions.efficiency,
        `${data.feeRatio.toFixed(1)}% of revenue goes to fees`,
        `Target: Keep fees below 2% of revenue`);

    updateDimension('cashflow', healthScore.dimensions.cashflow,
        `${Object.keys(data.dailyFlow).length} days of activity`,
        `Maintain positive cash flow consistently`);

    updateDimension('growth', healthScore.dimensions.growth,
        `Tracking ${Object.keys(data.customers).length} customers`,
        `Focus on customer acquisition and retention`);
}

function updateDimension(id, score, status, insight) {
    document.getElementById(`${id}-score`).innerText = score;
    document.getElementById(`${id}-status`).innerText = status;
    document.getElementById(`${id}-insight`).innerText = insight;

    const statusClass = score >= 75 ? 'status-excellent' : score >= 50 ? 'status-good' : score >= 25 ? 'status-warning' : 'status-critical';
    document.getElementById(`${id}-status`).className = `dimension-status ${statusClass}`;
}

function updateRecommendations(recommendations) {
    const list = document.getElementById('recommendations-list');
    list.innerHTML = recommendations.slice(0, 5).map(rec => `
        <div class="recommendation-card priority-${rec.priority}">
            <div class="recommendation-icon">${rec.icon}</div>
            <div class="recommendation-content">
                <div class="recommendation-title">${rec.title}</div>
                <div class="recommendation-action">💡 ${rec.action}</div>
                <div class="recommendation-impact">✅ ${rec.impact}</div>
            </div>
        </div>
    `).join('');
}

function updateCharts(data) {
    // Cashflow chart
    const sortedDates = Object.keys(data.dailyFlow).sort();
    const ctxCashflow = document.getElementById('cashflowChart').getContext('2d');

    // Destroy existing chart if it's a Chart instance (not just the canvas element)
    if (window.cashflowChartInstance && typeof window.cashflowChartInstance.destroy === 'function') {
        window.cashflowChartInstance.destroy();
    }

    window.cashflowChartInstance = new Chart(ctxCashflow, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Cash In',
                data: sortedDates.map(d => data.dailyFlow[d].in),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Cash Out',
                data: sortedDates.map(d => data.dailyFlow[d].out),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { labels: { color: '#94a3b8' } } }
        }
    });

    // Expense chart
    const ctxExpense = document.getElementById('expenseChart').getContext('2d');

    if (window.expenseChartInstance && typeof window.expenseChartInstance.destroy === 'function') {
        window.expenseChartInstance.destroy();
    }

    window.expenseChartInstance = new Chart(ctxExpense, {
        type: 'doughnut',
        data: {
            labels: ['Stock', 'Utilities', 'Data', 'Rent', 'Other'],
            datasets: [{
                data: [
                    data.categories.Stock,
                    data.categories.Utilities,
                    data.categories.Data,
                    data.categories.Rent,
                    data.categories.Other
                ],
                backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
        }
    });
}

function updateInsights(data) {
    // Top customers
    const topCustomers = Object.entries(data.customers).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('top-customers-list').innerHTML = topCustomers.map(([name, amount]) => `
        <li>
            <span class="name">${name}</span>
            <span class="amount positive">+KES ${amount.toLocaleString()}</span>
        </li>
    `).join('');

    // Top expenses
    const topExpenses = Object.entries(data.vendors).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('top-expenses-list').innerHTML = topExpenses.map(([name, amount]) => `
        <li>
            <span class="name">${name}</span>
            <span class="amount negative">-KES ${amount.toLocaleString()}</span>
        </li>
    `).join('');

    // Anomalies
    document.getElementById('anomalies-list').innerHTML = data.anomalies.slice(0, 5).map(anomaly => {
        const rec = recommendationsEngine.generateAnomalyRecommendations(anomaly);
        return `
            <li>
                <div>
                    <div>${rec.title}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${rec.recommendation}</div>
                </div>
            </li>
        `;
    }).join('');
}

function showError(msg) {
    errorDisplay.innerText = msg;
    errorDisplay.classList.remove('hidden');
    loading.classList.add('hidden');
    uploadSection.classList.remove('hidden');
}
