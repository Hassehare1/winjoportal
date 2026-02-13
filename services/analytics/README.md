# Analytics Service (Isolerad)

Denna modul ar avsiktligt separat fran portalen for att minska risk vid ny utveckling.

## Mal
- Lasa manadsfiler i Excel-format (en fil, flera butiksflikar).
- Mappa till ett kanoniskt schema.
- Skriva stabilt till Parquet (raw/staging).
- Skapa datakvalitetsrapport per korning.

## Struktur
```text
services/analytics/
  schemas/
    sales_monthly_v1.json
  scripts/
    common.py
    profile_sales_month.py
    ingest_sales_month.py
    ingest_all_months.py
    build_curated_sales_monthly.py
    generate_sales_kpis.py
  requirements.txt
```

## Installera
```powershell
cd services/analytics
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 1) Profilera input innan ingest
```powershell
python scripts/profile_sales_month.py `
  --input "C:\Users\winqu\OneDrive\9.Projects\winjoportalinputdata\Sales2024\2024-01.xlsx" `
  --output "data\reports\sales_monthly\v1\2024-01_profile.json"
```

## 2) Ingest till Parquet
```powershell
python scripts/ingest_sales_month.py `
  --input "C:\Users\winqu\OneDrive\9.Projects\winjoportalinputdata\Sales2024\2024-01.xlsx" `
  --output-root "data"
```

Exempel pa output:
- `data/raw/sales_monthly/v1/report_month_2024-01/sales_monthly_v1.parquet`
- `data/reports/sales_monthly/v1/2024-01_ingest.json`

## 3) Inkrementell ingest for hela mappen (rekommenderad daglig/manadlig korning)
```powershell
python scripts/ingest_all_months.py `
  --input-dir "C:\Users\winqu\OneDrive\9.Projects\winjoportalinputdata\Sales2024" `
  --output-root "data"
```

Med post-steg (curated + KPI):
```powershell
python scripts/ingest_all_months.py `
  --input-dir "C:\Users\winqu\OneDrive\9.Projects\winjoportalinputdata\Sales2024" `
  --output-root "data" `
  --build-curated `
  --generate-kpis
```

Vad den gor:
- Laster alla `.xlsx` i mappen.
- Beraknar SHA-256 per fil.
- Skipper filer som ar oforandrade sedan senaste korning.
- Processar bara nya/andrade filer.
- Sparar state i `data/state/sales_monthly/v1/processed_files.json`.
- Skriver korrapporter i `data/reports/sales_monthly/v1/runs/`.

## 4) Bygg curated-lager (inkrementellt)
```powershell
python scripts/build_curated_sales_monthly.py `
  --output-root "data"
```

Vad ar curated-lager (kort):
- Ett stabilt, foradlat datalager ovanpa raw-data.
- Samma data, men med konsekvent grain (manad/butik/artikel), aggregerade matt och beraknade falter.
- Byggs inkrementellt per manad, sa oforandrade manader hoppas over.

## 5) Generera fasta KPI-rapporter (DuckDB)
```powershell
python scripts/generate_sales_kpis.py `
  --output-root "data" `
  --report-month "2024-02" `
  --top-n 10
```

Exempel pa KPI-output:
- `data/reports/sales_monthly/v1/kpi_2024-02.json`
- `data/reports/sales_monthly/v1/kpi_2024-02_quicklook.html`
- Innehaller sammanfattning, andelar per butik/avdelning, topplistor, risklistor och enkel grafvy for andel forsaljning/andel vinst.
- Quicklook-HTML har dropdown med checkboxar for avdelningar (markera/avmarkera) och uppdaterar KPI-kort, andelsgrafer och tabeller direkt.

KPI-paket v1 (for kladretail):
- Nettoforsaljning, TB, TB-% och salda enheter.
- Andel forsaljning och andel vinst per butik (3 butiker).
- Andel forsaljning och andel vinst per avdelning.
- Toppartiklar per forsaljning respektive TB.
- Lag marginal med hog forsaljning (prio for atgard).
- Lagerexponering (stock value och stock/sales-ratio) per butik+avdelning.
- Risklistor for negativ marginal och nettoretur.
- Manad-mot-manad delta om tidigare manad finns.

## Stabilitetsprinciper
- Ingen koppling till portalens runtime.
- Header-validering sker innan data laddas.
- Art.nr och EAN hanteras som text for att undvika formatforlust.
- Radkalla sparas (`source_file`, `source_sheet`, `source_row`) for full sparbarhet.
- KPI-scriptet anvander fasta, fordefinierade SQL-fragor (ingen fri SQL fran klienter).
- Integrering i portalen sker senare bakom feature flag.
