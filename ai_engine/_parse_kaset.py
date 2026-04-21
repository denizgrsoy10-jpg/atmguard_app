"""Kaset Kapasiteleri.xlsx → kaset_kapasiteleri.json"""
import json, openpyxl

wb = openpyxl.load_workbook("Kaset Kapasiteleri.xlsx")
print("Sheets:", wb.sheetnames)

results = {}
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        rows.append(list(row))
        if i == 0:
            print(f"\n[{sheet_name}] Headers:", row)
        if i < 5:
            print(f"  Row {i}:", row)
    results[sheet_name] = rows

with open("kaset_kapasiteleri_raw.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2, default=str)

print("\n✅ kaset_kapasiteleri_raw.json yazıldı.")
