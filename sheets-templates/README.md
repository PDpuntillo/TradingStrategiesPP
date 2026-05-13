# Sheets Templates

Templates de referencia para crear manualmente las 3 Google Sheets (una por ticker).

Guía completa: [../docs/google-sheets-setup.md](../docs/google-sheets-setup.md).

## Archivos

- **[RAW_DATA_template.csv](RAW_DATA_template.csv)** — Headers exactos + 5 filas de ejemplo. Pegar en la pestaña `RAW_DATA` solo si querés ver el formato; en producción usar la fórmula GOOGLEFINANCE (ver doc).

## Fórmula GOOGLEFINANCE rápida

Pegar en `RAW_DATA!A2` de cada sheet (cambiar el símbolo según el ticker):

| Ticker | Fórmula |
|---|---|
| GGAL | `=GOOGLEFINANCE("BCBA:GGAL","all",TODAY()-365,TODAY(),"DAILY")` |
| YPF  | `=GOOGLEFINANCE("BCBA:YPFD","all",TODAY()-365,TODAY(),"DAILY")` |
| PAMP | `=GOOGLEFINANCE("BCBA:PAMP","all",TODAY()-365,TODAY(),"DAILY")` |
