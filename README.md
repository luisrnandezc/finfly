# FinFly

FinFly is an MVP for managing corporate flight reports and their related expenses. It gives flight crews a single place to record trip details, crew assignments, receipts, and costs, while giving auditors a structured workflow to review and approve each report.

## MVP scope

- Create and edit flight reports with aircraft, flight legs, and crew assignments
- Record expenses in multiple currencies, attach receipts, and calculate USD/VES amounts from exchange rates
- Submit reports through an approval workflow with draft, review, approved, and rejected states
- Apply role-based access for pilots, auditors, and administrators
- Preserve review history and validate report data before submission

## Technology

- **Backend:** SAP Cloud Application Programming Model (CAP), Node.js, TypeScript, and OData
- **Frontend:** SAP Fiori elements / SAPUI5
- **Data:** CDS domain model with SQLite for local development
- **Quality:** Vitest integration and service-level tests

## Run locally

Requires a current Node.js installation.

```bash
npm install
npm start
```

Open the application URL shown in the terminal. Local development uses mocked users for the `Pilot`, `Auditor`, and `Admin` roles.

Run the automated test suite with:

```bash
npm test
```

## Status

FinFly is an MVP focused on the end-to-end flight expense reporting and approval flow. Production deployment, enterprise identity integration, and a live exchange-rate provider are outside the current scope.
