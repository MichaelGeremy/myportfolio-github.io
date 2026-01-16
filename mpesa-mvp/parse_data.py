import re
import csv
import sys

def parse_mpesa_text(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Normalize newlines
    content = content.replace('\r\n', '\n')

    # The data seems to start with "Receipt No..." then records.
    # Each record starts with 10 alphanumerics like "TLC8U0QFQ7"
    
    # Regex to find the start of a transaction
    # Group 1: Receipt
    # Group 2: Date Time
    # Group 3: Rest of the line(s) until the next receipt
    pattern = re.compile(r'([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s(.*?)(?=\n[A-Z0-9]{10}\s|\Z)', re.DOTALL)
    
    matches = pattern.findall(content)
    
    records = []
    
    for match in matches:
        receipt, date_time, rest = match
        
        # 'rest' contains Details + "Completed" + Amounts
        # It might span multiple lines
        rest = rest.replace('\n', ' ').strip()
        
        # Split by "Completed"
        if "Completed" in rest:
            parts = rest.split("Completed")
            details = parts[0].strip()
            status = "Completed"
            
            # The part after Completed contains amounts
            amount_part = parts[1].strip()
            
            # Find numbers. They can be negative. They can have commas (e.g. 1,000.00)
            # Remove commas for parsing
            # Regex for numbers: -?[\d,]+\.\d{2}
             # But first let's just split by whitespace and filter for things that look like numbers
            tokens = amount_part.split()
            nums = []
            for t in tokens:
                try:
                    clean_t = t.replace(',', '')
                    val = float(clean_t)
                    nums.append(val)
                except ValueError:
                    pass
            
            paid_in = ""
            withdrawn = ""
            balance = ""
            
            if len(nums) >= 2:
                # Last number is Balance
                balance = nums[-1]
                amount = nums[-2] # The transaction amount
                
                # Logic based on observation:
                # If negative, it's Withdrawn (outflow). If positive, it's Paid In (inflow).
                if amount < 0:
                    withdrawn = abs(amount)
                    paid_in = ""
                else:
                    paid_in = amount
                    withdrawn = ""
            elif len(nums) == 1:
                # Maybe just balance?
                balance = nums[0]
            
            records.append([receipt, date_time, details, status, paid_in, withdrawn, balance])
        else:
            # Fallback if "Completed" not found
            records.append([receipt, date_time, rest, "Unknown", "", "", ""])

    # Write to CSV
    headers = ['Receipt No.', 'Completion Time', 'Details', 'Transaction Status', 'Paid In', 'Withdrawn', 'Balance']
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(records)

    print(f"Successfully processed {len(records)} records.")

if __name__ == "__main__":
    parse_mpesa_text('raw_subset.txt', 'sample_data.csv')
