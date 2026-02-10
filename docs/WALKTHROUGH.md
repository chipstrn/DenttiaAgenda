# Phase 6: Onboarding Walkthrough

## 1. Import Wizard
A powerful tool for new clinics to migrate their data.

### Features
- **File Support**: Accepts Excel (`.xlsx`) and CSV files.
- **Smart Mapping**: Users can map columns from their file to the database fields (e.g., "Nombre Completo" -> `first_name`).
- **Preview**: Shows the first 5 rows before importing to ensure data looks correct.
- **Bulk Insert**: efficiently inserts hundreds of records in batches.

## 2. Interactive Guided Tours
To help new users get started, we integrated `driver.js`.

### Features
- **Welcome Tour**: Introduces the main layout and navigation.
- **Contextual Help**: Floating action button to restart tours.
- **Feature Spotlights**: Highlights key actions like "New Appointment" or "Add Patient".

## 3. PDF Generation (Recap)
Client-side PDF generation for prescriptions using `jspdf`.
- **Privacy**: No data leaves the browser.
- **Speed**: Instant generation.
