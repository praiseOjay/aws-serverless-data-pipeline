# AWS Serverless Data Engineering Pipeline & Real-Time Dashboard 🚀

An enterprise-grade, event-driven serverless data pipeline and real-time analytics dashboard orchestrated with **AWS Step Functions**, built using Test-Driven Development (TDD) principles.

## 🏗️ End-to-End Architecture Overview

```
                      [Hourly EventBridge Schedule]
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │         AWS Step Functions Visual State Machine         │
       │                                                         │
       │  1. ExtractData Lambda (Open-Meteo API -> S3 Raw)       │
       │                       │                                 │
       │                       ▼ (State Retry & Error Handling)  │
       │  2. ValidateData Lambda (Schema & Data Quality Check)   │
       │                       │                                 │
       │                       ▼                                 │
       │  3. TransformAndLoad Lambda                             │
       │        ├──► [S3 Processed Zone (Apache Parquet)]       │
       │        └──► [Amazon DynamoDB (Fast Key Lookups)]        │
       └─────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                ▼                                       ▼
    [AWS Glue Catalog & Athena]             [AWS API Gateway]
    (Ad-hoc SQL Analytics)                          │
                                                    ▼
                                          [Analytics API Lambda]
                                                    │
                                                    ▼
                                     [Interactive Web Dashboard]
```

- **Orchestration**: AWS Step Functions state machine coordinates discrete Lambda steps (`Extract`, `Validate`, `Transform & Load`) with native retry logic and structured error catching.
- **Ingestion & Validation**: Extractor Lambda fetches raw Open-Meteo weather JSON payloads into S3 raw partition paths. Validator Lambda enforces strict schema contracts and temperature sanity bounds.
- **Storage Dual-Engine**:
  - **S3 Processed Zone**: Columnar **Apache Parquet** formatted data registered with **AWS Glue Data Catalog** for serverless **Amazon Athena** SQL querying.
  - **Amazon DynamoDB**: Key-value table for low-latency (<10ms) single-point and historical time-series queries.
- **API & Visual Dashboard**: AWS API Gateway REST API backed by an Analytics Lambda serves real-time metrics to an interactive, dark-mode **Web Dashboard** featuring Chart.js visual trends.

---

## 📊 Dashboard Preview

![AWS Serverless Pipeline Dashboard](docs/images/dashboard_preview.png)

---

## 🛠️ Tech Stack & Prerequisites

- **Language**: Python 3.11+
- **Data Engine**: Pandas, PyArrow
- **Testing (TDD)**: Pytest, Moto (100% Code Coverage)
- **Cloud Infrastructure**: AWS SAM / CloudFormation (Step Functions, Lambda, DynamoDB, S3, Glue, EventBridge, API Gateway, IAM)
- **Web Frontend**: HTML5, CSS3 Glassmorphism, JavaScript ES6+, Chart.js
- **Version Control**: Git (`main` & `dev` branching model)

---

## 🧪 Development & TDD Workflow

This repository strictly enforces a **Test-Driven Development (TDD)** workflow across two branches:
- `dev`: Active development and test verification branch. All feature code is written against failing tests.
- `main`: Production branch. Merged only after all local and CI tests pass 100%.

### 1. Setup Environment
```bash
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# Install development dependencies
pip install -r requirements-dev.txt
```

### 2. Run Test Suite (TDD - 100% Coverage)
```bash
pytest --cov=src tests/
```

### 3. Preview Dashboard Locally
Open `web/index.html` directly in your browser or serve via Python local server:
```bash
python -m http.server 8000 --directory web
```

---

## ☁️ Deploying to AWS (AWS SAM)

```bash
# Validate SAM template
sam validate -t iac/template.yaml

# Build & Deploy
sam build -t iac/template.yaml
sam deploy --guided
```

---

## 🔗 Repository & Contact
Created by [praiseOjay](https://github.com/praiseOjay)
