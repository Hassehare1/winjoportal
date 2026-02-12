Placera nya manadsfiler (.xlsx) i den har mappen.

Krav:
- Filnamnet maste innehalla manad i format YYYY-MM, t.ex. sales_2024-03.xlsx.
- En fil per manad rekommenderas.

Flode:
1) Lagg in ny .xlsx i services/analytics/input/
2) Tryck "Hamta data" i portalen eller kor GitHub Action manuellt
3) Workflow bygger KPI och uppdaterar public/analytics/
