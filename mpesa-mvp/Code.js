/**
 * M-Pesa Statement Analyzer - B2B MVP
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code into 'Code.gs'.
 * 4. Save and reload the spreadsheet.
 * 5. Import your M-Pesa CSV data into a sheet named 'Data'.
 * 6. Use the 'M-Pesa Analyzer' menu to run the analysis.
 */

function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('M-Pesa Analyzer')
        .addItem('Analyze Statement', 'runAnalysis')
        .addItem('Clear Dashboard', 'clearDashboard')
        .addToUi();
}

/**
 * Main function to run the full analysis
 */
function runAnalysis() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName('Data');

    if (!dataSheet) {
        SpreadsheetApp.getUi().alert('Please create a sheet named "Data" and paste your CSV content there.');
        return;
    }

    // Get data range (assuming headers in row 1)
    const data = dataSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    // Identify columns
    const colMap = mapColumns(headers);
    if (!colMap) return; // Error handled in mapColumns

    // Process Transactions
    const analysis = processTransactions(rows, colMap);

    // Generate Dashboard
    generateDashboard(analysis);

    SpreadsheetApp.getUi().alert('Analysis Complete! Check the "Dashboard" sheet.');
}

/**
 * Maps column names to indices
 */
function mapColumns(headers) {
    const map = {};
    const required = ['Details', 'Paid In', 'Withdrawn', 'Completion Time']; // Essential columns

    headers.forEach((h, i) => {
        const cleanHeader = h.trim().toLowerCase();
        if (cleanHeader.includes('details')) map.details = i;
        else if (cleanHeader.includes('paid in')) map.paidIn = i;
        else if (cleanHeader.includes('withdrawn')) map.withdrawn = i;
        else if (cleanHeader.includes('completion time') || cleanHeader.includes('date')) map.date = i;
    });

    // Validation
    const missing = required.filter(r => {
        const key = r.toLowerCase().replace(' ', '');
        // Simple check: paidin vs paidIn mapping logic needs care.
        // map keys are: details, paidIn, withdrawn, date
        if (r === 'Details') return map.details === undefined;
        if (r === 'Paid In') return map.paidIn === undefined;
        if (r === 'Withdrawn') return map.withdrawn === undefined;
        if (r === 'Completion Time') return map.date === undefined;
        return false;
    });

    if (missing.length > 0) {
        SpreadsheetApp.getUi().alert('Missing columns: ' + missing.join(', '));
        return null;
    }

    return map;
}

/**
 * Core Logic: Categorize and Aggregate
 */
function processTransactions(rows, map) {
    const results = {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        categories: {
            Revenue: 0,
            Utilities: 0,
            Stock: 0,
            Data: 0,
            Rent: 0,
            Staff: 0,
            Other_Expense: 0,
            Personal: 0
        },
        topCustomers: {},
        topExpenses: {},
        monthlyTrends: {},
        hustlerFundQualifying: 0 // ~30% of monthly inflows approximation
    };

    rows.forEach(row => {
        const details = String(row[map.details]);
        const paidIn = parseFloat(row[map.paidIn]) || 0;
        const withdrawn = parseFloat(row[map.withdrawn]) || 0;
        const dateStr = row[map.date];

        // Categorize
        const category = autoCategorize(details, paidIn, withdrawn);

        // Aggregation
        if (paidIn > 0) {
            if (category.main === 'Personal') {
                // Treat as Personal Injection (not business revenue)
                results.categories.Personal += paidIn;
            } else {
                results.totalRevenue += paidIn;
                results.categories.Revenue += paidIn;

                // Top Customer Logic
                const payer = getPayerName(details);
                results.topCustomers[payer] = (results.topCustomers[payer] || 0) + paidIn;
            }
        }

        if (withdrawn > 0) {
            // Check for personal
            if (category.main === 'Personal') {
                // Exclude from business expenses
                results.categories.Personal += withdrawn; // Net Personal? Or just track drawings? 
                // Let's just track drawings as positive expense for now to show where money went
                // But strictly it shouldn't reduce Net Profit unless we consider it a salary.
                // For MVP, let's keep it simple: It IS an outflow.
            } else {
                results.totalExpenses += withdrawn;
                results.categories[category.sub || 'Other_Expense'] = (results.categories[category.sub || 'Other_Expense'] || 0) + withdrawn;

                // Top Expense Logic
                const payee = getPayeeName(details);
                results.topExpenses[payee] = (results.topExpenses[payee] || 0) + withdrawn;
            }
        }
    });

    results.netProfit = results.totalRevenue - results.totalExpenses;
    results.hustlerFundQualifying = results.totalRevenue * 0.3; // Simple rule

    return results;
}

/**
 * Auto-Categorization Rule Engine
 */
function autoCategorize(details, paidIn, withdrawn) {
    const d = details.toLowerCase();

    // Patterns
    const patterns = {
        revenue: ["funds received", "business payment", "salary payment", "transfer from bank"],
        expenses: {
            Utilities: ["kplc", "pay bill to 888880", "token"],
            Stock: ["pakir enterprises", "kassmatt supermarkets", "wholesalers"],
            Data: ["data vibez", "data bundles", "safaricom offers", "airtime"],
            Rent: ["loop biz", "family bank pesa pap", "rent"],
            Staff: ["customer transfer to", "mary wambui"], // Specific staff names would go here
            Personal: ["michael mwenda"] // Self name
        }
    };

    // 1. Check Personal/Self (Priority)
    if (d.includes('michael mwenda')) {
        if (paidIn > 0) return { main: 'Personal', sub: 'Injection' };
        if (withdrawn > 0) return { main: 'Personal', sub: 'Drawings' };
    }

    // 2. Check Revenue
    if (paidIn > 0) {
        return { main: 'Revenue', sub: 'Customer' };
    }

    // 3. Check Expenses
    if (withdrawn > 0) {
        for (const [cat, keywords] of Object.entries(patterns.expenses)) {
            if (keywords.some(k => d.includes(k))) {
                return { main: 'Expense', sub: cat };
            }
        }

        // Default
        return { main: 'Expense', sub: 'Other_Expense' };
    }

    return { main: 'Unknown', sub: 'Unknown' };
}

/**
 * Extract Name Helper
 */
function getPayerName(details) {
    // Example: "Funds received from Emmanuel Muchiri"
    if (details.includes('from')) {
        return details.split('from')[1].trim();
    }
    return details;
}

function getPayeeName(details) {
    // Example: "Pay Bill to 888880 - KPLC"
    if (details.includes('-')) {
        return details.split('-')[1].trim();
    }
    // Example: "Customer Transfer to Mary Wambui"
    if (details.includes(' to ')) {
        return details.split(' to ')[1].trim();
    }
    return details;
}

/**
 * Render Dashboard
 */
function generateDashboard(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Dashboard');

    if (sheet) {
        sheet.clear();
    } else {
        sheet = ss.insertSheet('Dashboard');
    }

    // Styles
    const validHeader = SpreadsheetApp.newTextStyle().setBold(true).setFontSize(14).build();
    const subHeader = SpreadsheetApp.newTextStyle().setBold(true).setFontSize(12).build();

    // 1. High-Level Summary
    sheet.getRange('A1').setValue('BUSINESS HEALTH REPORT').setTextStyle(validHeader);

    sheet.getRange('A3').setValue('Total Revenue');
    sheet.getRange('B3').setValue(data.totalRevenue);

    sheet.getRange('A4').setValue('Total Expenses');
    sheet.getRange('B4').setValue(data.totalExpenses);

    sheet.getRange('A5').setValue('Net Profit');
    sheet.getRange('B5').setValue(data.netProfit).setBackground(data.netProfit >= 0 ? '#ccffcc' : '#ffcccc');

    sheet.getRange('A7').setValue('Hustler Fund Eligibility (Approx.)');
    sheet.getRange('B7').setValue(data.hustlerFundQualifying);

    // 2. Expense Breakdown
    sheet.getRange('D1').setValue('EXPENSE BREAKDOWN').setTextStyle(validHeader);
    const categories = data.categories;
    let row = 3;
    for (const [cat, amount] of Object.entries(categories)) {
        if (cat !== 'Revenue' && amount > 0) {
            sheet.getRange('D' + row).setValue(cat);
            sheet.getRange('E' + row).setValue(amount);
            row++;
        }
    }

    // 3. Top Insights
    sheet.getRange('G1').setValue('INSIGHTS').setTextStyle(validHeader);

    // Best Customer
    const sortedCustomers = Object.entries(data.topCustomers).sort((a, b) => b[1] - a[1]);
    if (sortedCustomers.length > 0) {
        sheet.getRange('G3').setValue('Top Customer (Revenue Source):');
        sheet.getRange('G4').setValue(`${sortedCustomers[0][0]} (${sortedCustomers[0][1]})`);
    }

    // Top Expense
    const sortedExpenses = Object.entries(data.topExpenses).sort((a, b) => b[1] - a[1]);
    if (sortedExpenses.length > 0) {
        sheet.getRange('G6').setValue('Highest Expense Vendor:');
        sheet.getRange('G7').setValue(`${sortedExpenses[0][0]} (${sortedExpenses[0][1]})`);
    }

    // Formatting
    sheet.getRange('B3:B7').setNumberFormat('#,##0.00');
    sheet.getRange('E3:E20').setNumberFormat('#,##0.00');
    sheet.autoResizeColumns(1, 8);
}

function clearDashboard() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Dashboard');
    if (sheet) sheet.clear();
}
