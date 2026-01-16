# M-Pesa Statement Analyzer MVP

This project contains the MVP Google Sheets script to analyze M-Pesa statements for B2B insights.

## Features
- **Auto-Categorization**: Sorts transactions into Utilities, Stock, Data, Rent, Staff, etc.
- **Business vs Personal**: Separates business expenses from personal transfers.
- **Insights**: Identifies top customers and top expense vendors.
- **Reporting**: Generates a high-level dashboard with Profit/Loss and Hustler Fund eligibility.

## Setup Instructions

1.  **Open Google Sheets**
    *   Create a new Google Sheet.
    *   Name it "M-Pesa Analyzer".

2.  **Add the Script**
    *   Go to **Extensions** > **Apps Script** in the menu.
    *   Delete any code in the `Code.gs` file.
    *   Copy the content of `Code.js` from this folder and paste it into the script editor.
    *   Click the **Save** icon (floppy disk).
    *   Reload your Google Sheet tab. A new menu **"M-Pesa Analyzer"** should appear after a few seconds.

3.  **Prepare Data**
    *   Create a sheet tab named **`Data`** (case-sensitive).
    *   Import your M-Pesa statement or paste the content from `sample_data.csv` (which now contains the data you provided).
        *   Ensure you have headers like `Receipt No.`, `Completion Time`, `Details`, `Paid In`, `Withdrawn`, `Balance`.

4.  **Run Analysis**
    *   Click **M-Pesa Analyzer** > **Analyze Statement**.
    *   Grant the necessary permissions if prompted (Review Permissions > Choose Account > Advanced > Go to Untitled Project (unsafe) > Allow).
    *   Switch to the newly created **`Dashboard`** tab to see your report.

## Customization
-   **Edit Categories**: Modify the `patterns` object in the `autoCategorize` function in `Code.js` to add your specific suppliers or staff names.
-   **Personal Name**: Update the `michael mwenda` check in `autoCategorize` to your own name to filter self-transfers.
