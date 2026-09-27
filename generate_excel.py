import zipfile
import xml.etree.ElementTree as ET
import os

data = [
    ["Name", "Phone", "Email", "OrderID", "Amount", "Date", "OptInStatus"],
    ["Rahul Sharma", "9876543210", "rahul.sharma@example.com", "ORD-2001", "1499", "2026-09-25", "OPTED_IN"],
    ["Priya Patel", "9823456781", "priya.patel@example.com", "ORD-2002", "2999", "2026-09-25", "OPTED_IN"],
    ["Amit Verma", "9811223344", "amit.verma@example.com", "ORD-2003", "849", "2026-09-25", "OPTED_IN"],
    ["Neha Gupta", "9877889900", "neha.gupta@example.com", "ORD-2004", "4200", "2026-09-26", "OPTED_IN"],
    ["Vikram Malhotra", "9766554433", "vikram.m@example.com", "ORD-2005", "650", "2026-09-26", "OPTED_IN"],
    ["Ananya Roy", "9955443322", "ananya.r@example.com", "ORD-2006", "1899", "2026-09-26", "OPTED_OUT"], # Suppressed
    ["Karan Mehra", "9876543210", "karan.mehra@example.com", "ORD-2007", "1200", "2026-09-26", "OPTED_IN"], # Duplicate
    ["Ritu Singh", "99999", "ritu.singh@example.com", "ORD-2008", "500", "2026-09-27", "OPTED_IN"], # Invalid phone
    ["", "9845012345", "anonymous@example.com", "ORD-2009", "750", "2026-09-27", "OPTED_IN"], # Missing Name
    ["Siddharth Nair", "", "sid.nair@example.com", "ORD-2010", "3450", "2026-09-27", "OPTED_IN"], # Missing Phone
    ["Sneha Kulkarni", "9820098765", "sneha.k@example.com", "ORD-2011", "1120", "2026-09-27", "OPTED_IN"],
    ["Rohan Joshi", "9769012345", "rohan.j@example.com", "ORD-2012", "5600", "2026-09-28", "OPTED_IN"],
    ["Pooja Bhatia", "9810054321", "pooja.b@example.com", "ORD-2013", "999", "2026-09-28", "OPTED_IN"],
    ["Deepak Chawla", "9899011223", "deepak.c@example.com", "ORD-2014", "2150", "2026-09-28", "OPTED_IN"],
    ["Swati Deshmukh", "9822033445", "swati.d@example.com", "ORD-2015", "1780", "2026-09-28", "OPTED_IN"],
    ["Manish Tiwari", "9833044556", "manish.t@example.com", "ORD-2016", "3100", "2026-09-28", "OPTED_IN"],
    ["Kavita Sen", "9844055667", "kavita.s@example.com", "ORD-2017", "890", "2026-09-29", "OPTED_IN"],
    ["Arjun Reddy", "9855066778", "arjun.r@example.com", "ORD-2018", "4500", "2026-09-29", "OPTED_IN"],
    ["Divya Rao", "9866077889", "divya.rao@example.com", "ORD-2019", "1650", "2026-09-29", "OPTED_IN"],
    ["Suresh Iyer", "9877088990", "suresh.i@example.com", "ORD-2020", "2300", "2026-09-29", "OPTED_IN"],
    ["Meera Nambiar", "9888099001", "meera.n@example.com", "ORD-2021", "3750", "2026-09-30", "OPTED_IN"],
    ["Nikhil Agarwal", "9899100112", "nikhil.a@example.com", "ORD-2022", "1299", "2026-09-30", "OPTED_IN"],
    ["Shreya Banerjee", "9811211223", "shreya.b@example.com", "ORD-2023", "950", "2026-09-30", "OPTED_IN"],
    ["Gaurav Kapoor", "9822322334", "gaurav.k@example.com", "ORD-2024", "2850", "2026-09-30", "OPTED_IN"],
    ["Pallavi Das", "9833433445", "pallavi.d@example.com", "ORD-2025", "1999", "2026-09-30", "OPTED_IN"],
    ["Harish Pillai", "9844544556", "harish.p@example.com", "ORD-2026", "3400", "2026-10-01", "OPTED_IN"],
    ["Aarti Saxena", "9855655667", "aarti.s@example.com", "ORD-2027", "720", "2026-10-01", "OPTED_IN"],
    ["Tarun Sethi", "9866766778", "tarun.s@example.com", "ORD-2028", "4100", "2026-10-01", "OPTED_IN"],
    ["Geeta Menon", "9877877889", "geeta.m@example.com", "ORD-2029", "1550", "2026-10-01", "OPTED_IN"],
    ["Sanjay Jain", "9888988990", "sanjay.j@example.com", "ORD-2030", "2600", "2026-10-01", "OPTED_IN"],
    ["Sunita Chopra", "9899099001", "sunita.c@example.com", "ORD-2031", "3150", "2026-10-02", "OPTED_IN"],
    ["Vivek Anand", "9811234567", "vivek.a@example.com", "ORD-2032", "1850", "2026-10-02", "OPTED_IN"],
    ["Preeti Singhal", "9822345678", "preeti.s@example.com", "ORD-2033", "920", "2026-10-02", "OPTED_IN"],
    ["Ashok Kumar", "9833456789", "ashok.k@example.com", "ORD-2034", "2400", "2026-10-02", "OPTED_IN"],
    ["Bhavna Shah", "9844567890", "bhavna.s@example.com", "ORD-2035", "1680", "2026-10-02", "OPTED_IN"],
    ["Chirag Dave", "9855678901", "chirag.d@example.com", "ORD-2036", "3900", "2026-10-03", "OPTED_IN"],
    ["Deepa Krishnan", "9866789012", "deepa.k@example.com", "ORD-2037", "850", "2026-10-03", "OPTED_IN"],
    ["Esha Deol", "9877890123", "esha.d@example.com", "ORD-2038", "4300", "2026-10-03", "OPTED_IN"],
    ["Farhan Akhtar", "9888901234", "farhan.a@example.com", "ORD-2039", "1450", "2026-10-03", "OPTED_IN"],
    ["Gayatri Devi", "9899012345", "gayatri.d@example.com", "ORD-2040", "2700", "2026-10-03", "OPTED_IN"],
    ["Hemant Solanki", "9811122233", "hemant.s@example.com", "ORD-2041", "3250", "2026-10-04", "OPTED_IN"],
    ["Indira Gandhi", "9822233344", "indira.g@example.com", "ORD-2042", "1750", "2026-10-04", "OPTED_IN"],
    ["Jitendra Prasad", "9833344455", "jitendra.p@example.com", "ORD-2043", "980", "2026-10-04", "OPTED_IN"],
    ["Kiran Bedi", "9844455566", "kiran.b@example.com", "ORD-2044", "2550", "2026-10-04", "OPTED_IN"],
    ["Lalit Modi", "9855566677", "lalit.m@example.com", "ORD-2045", "1600", "2026-10-04", "OPTED_IN"],
    ["Madhuri Dixit", "9866677788", "madhuri.d@example.com", "ORD-2046", "3800", "2026-10-05", "OPTED_IN"],
    ["Naveen Patnaik", "9877788899", "naveen.p@example.com", "ORD-2047", "820", "2026-10-05", "OPTED_IN"],
    ["Om Puri", "9888899900", "om.p@example.com", "ORD-2048", "4150", "2026-10-05", "OPTED_IN"],
    ["Pankaj Tripathi", "9899900011", "pankaj.t@example.com", "ORD-2049", "1500", "2026-10-05", "OPTED_IN"],
    ["Quasar Thakore", "9812345678", "quasar.t@example.com", "ORD-2050", "2800", "2026-10-05", "OPTED_IN"]
]

def make_sheet_xml(rows):
    cols = ["A", "B", "C", "D", "E", "F", "G"]
    xml = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>']
    xml.append('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">')
    xml.append('<sheetData>')
    for r_idx, row in enumerate(rows, start=1):
        xml.append(f'<row r="{r_idx}">')
        for c_idx, val in enumerate(row):
            col_letter = cols[c_idx]
            ref = f"{col_letter}{r_idx}"
            # Escape XML entities
            clean_val = str(val).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
            xml.append(f'<c r="{ref}" t="inlineStr"><is><t>{clean_val}</t></is></c>')
        xml.append('</row>')
    xml.append('</sheetData>')
    xml.append('</worksheet>')
    return "".join(xml)

content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""

rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

workbook_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Customers" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""

workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""

target_file = "/Users/harshvardhan/Downloads/bulk_whatsappmsgtool/sample-customers.xlsx"

with zipfile.ZipFile(target_file, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("xl/workbook.xml", workbook_xml)
    z.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
    z.writestr("xl/worksheets/sheet1.xml", make_sheet_xml(data))

# Also copy into public/ directory so users can download it directly from the UI / browser!
public_target = "/Users/harshvardhan/Downloads/bulk_whatsappmsgtool/public/sample-customers.xlsx"
os.makedirs("/Users/harshvardhan/Downloads/bulk_whatsappmsgtool/public", exist_ok=True)
with open(target_file, "rb") as src, open(public_target, "wb") as dst:
    dst.write(src.read())

print("Successfully generated sample-customers.xlsx in both root and public/ folder!")
