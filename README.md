# Moco ➔ Timing Sync Tool

<div align="center">
  <a href="#deutsch">Deutsch</a> | <a href="#english">English</a>
</div>

---

<div id="deutsch"></div>

## 🇩🇪 Dokumentation (Deutsch)

Dieses Tool dient der Synchronisierung von Projektdaten aus **Moco** in die **Timing App**. Es hilft dabei, die Projektstruktur aktuell zu halten und manuelle Arbeit zu vermeiden.

### 📋 Zusammenfassung

Das Tool vergleicht die aktiven Projekte und Kunden, die in Moco hinterlegt sind, mit der Ordnerstruktur in der Timing App. Es bietet eine webbasierte Oberfläche, um Unterschiede zu erkennen und gezielt Änderungen vorzunehmen. Dabei werden Projekte niemals gelöscht, sondern sicherheitshalber nur archiviert.

### ✨ Hauptfunktionen

1.  **Selektiver Abgleich (Sync)**
    *   **Scannen**: Analyse beider Systeme.
    *   **Erstellen (<span style="color:green">CREATE</span>)**: Neue Moco-Projekte werden in Timing angelegt.
    *   **Archivieren (<span style="color:orange">ARCHIVE</span>)**: Nicht mehr existierende Projekte werden archiviert.

2.  **Namens-Mapping**
    *   Kürzen Sie lange Kundennamen (z.B. "Firmenname GmbH" -> "Firma") über das **"Manage Mappings ⚙️"** Menü.

3.  **Automatische Umbenennung & Linking**
    *   **Linking (<span style="color:#7aa2f7">LINK</span>)**: Verknüpft bestehende Projekte beim ersten Scan.
    *   **Renaming (<span style="color:#bb9af7">RENAME</span>)**: Erkennt Umbenennungen in Moco anhand der ID und aktualisiert Timing automatisch.

4.  **Aufräumen inaktiver Projekte (Cleanup)**
    *   Prüft Projekte auf Zeiteinträge in einem gewählten Zeitraum (z.B. letztes Jahr).
    *   Schlägt ungenutzte Projekte zur Archivierung vor.

### 🚀 Installation & Start

1.  **Konfiguration**: `.env` Datei erstellen (siehe `.env.example`).
    ```bash
    MOCO_DOMAIN="ihredomain"
    MOCO_API_KEY="ihr_key"
    TIMING_API_KEY="ihr_key"
    ```
    *   (Optional) Mappings vorbereiten: `cp mappings.json.example mappings.json`
2.  **Starten**
    ```bash
    npm install
    node server.js
    ```
3.  **Öffnen**: [http://localhost:3001](http://localhost:3001)

<div align="right">
  <a href="#english">Go to English Version 🇺🇸</a>
</div>

---

<div id="english"></div>

## 🇺🇸 Documentation (English)

A robust utility to keep your **Moco** project structure perfectly synchronized with the **Timing App**. Automate your workflow, eliminate manual maintenance, and ensure your time tracking is always ready to go.

### 📋 Overview

This tool acts as a bridge between Moco and Timing. It analyzes your active clients and projects, compares them with your Timing folders, and provides a sleek "Scan & Execute" interface to handle updates.

**Philosophy:** We prioritize data safety. Projects are never deleted—only archived.

### ✨ Key Features

1.  **Smart Selective Sync**
    *   **Scan**: Instantly analyze discrepancies.
    *   **Create (<span style="color:green">CREATE</span>)**: Builds structure in Timing.
    *   **Archive (<span style="color:orange">ARCHIVE</span>)**: Archives inactive projects safely.

2.  **Intelligent Mapping**
    *   Map complex names (e.g., *"Agency GmbH"*) to clean folders (e.g., *"Agency"*) via the UI settings.

3.  **Auto-Link & Rename**
    *   **Deep Linking (<span style="color:#7aa2f7">LINK</span>)**: Links projects by ID on first run.
    *   **Auto-Rename (<span style="color:#bb9af7">RENAME</span>)**: Updates names in Timing automatically if they change in Moco.

4.  **Inactive Project Cleanup**
    *   Analyzes time entries for a given date range.
    *   Suggests archiving projects with zero activity.

### 🚀 Quick Start

1.  **Setup**:
    *   Configure `.env` (copy from `.env.example`).
    *   (Optional) Prepare mappings: `cp mappings.json.example mappings.json`
2.  **Run**:
    ```bash
    npm install
    node server.js
    ```
3.  **Open**: [http://localhost:3001](http://localhost:3001)

<div align="right">
  <a href="#deutsch">Zur deutschen Version 🇩🇪</a>
</div>

---

<div align="center">
  <br>
  <p>
    Developed with ❤️ by <a href="https://waterproof.agency" target="_blank">Waterproof Web Wizard GmbH</a><br>
    Built by <b>Dennis Huettner</b>
  </p>
</div>
