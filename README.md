# AWS Serverless Data Engineering Pipeline 🚀

A production-grade, event-driven serverless data pipeline built on AWS using Test-Driven Development (TDD) principles.

## 🏗️ Architecture Overview

```
[Open-Meteo Weather API]
           │
           ▼ (Hourly EventBridge Trigger)
   [AWS Lambda Ingester]
           │
           ▼ 
 [S3: Raw Zone (JSON)] ──(s3:ObjectCreated)──► [AWS Lambda Transformer]
                                                       │
                                                       ▼
                                            [S3: Processed Zone (Parquet)]
                                                       │
                                                       ▼
                                           [AWS Glue Data Catalog]
                                                       │
                                                       ▼
                                           [Amazon Athena (SQL)]
```

- **Ingestion**: AWS Lambda extracts hourly weather data from public open APIs and stores raw payloads in partitioned S3 buckets (`raw/year=YYYY/month=MM/day=DD/`).
- **Transformation & Validation**: S3 trigger executes the transformer Lambda which validates schema contracts, enforces data quality rules, transforms JSON into columnar **Apache Parquet**, and partitions output.
- **Analytics**: AWS Glue Catalog registers table schemas allowing instant serverless SQL querying via **Amazon Athena**.

---

## 🛠️ Tech Stack & Prerequisites

- **Language**: Python 3.11+
- **Data Engine**: Pandas, PyArrow
- **Testing (TDD)**: Pytest, Moto (AWS Mocking)
- **Cloud Infrastructure**: AWS SAM / CloudFormation (S3, Lambda, Glue, EventBridge, IAM)
- **Version Control**: Git (`main` & `dev` branching model) + GitHub Actions CI

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

### 2. Run Test Suite (TDD)
```bash
pytest --cov=src tests/
```

### 3. Local Execution Example
```bash
python -m src.ingester
python -m src.transformer
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
