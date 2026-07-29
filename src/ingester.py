import json
import os
import requests
from datetime import datetime, timezone
import boto3
from src.utils.validators import validate_raw_weather_payload

OPEN_METEO_API_URL = "https://api.open-meteo.com/v1/forecast"

def fetch_weather_data(latitude: float = 51.5074, longitude: float = -0.1278) -> dict:
    """
    Fetches real-time hourly weather forecast from Open-Meteo API.
    Default coordinates set to London, UK.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        "timezone": "UTC"
    }
    response = requests.get(OPEN_METEO_API_URL, params=params, timeout=10)
    response.raise_for_status()
    payload = response.json()
    
    # Run data quality validation before returning
    validate_raw_weather_payload(payload)
    return payload

def upload_raw_to_s3(payload: dict, bucket_name: str, s3_client=None) -> str:
    """
    Uploads raw JSON payload to S3 partitioned by date (year=YYYY/month=MM/day=DD).
    
    Returns:
        str: S3 key where raw file was written.
    """
    if s3_client is None:
        s3_client = boto3.client("s3")
        
    now = datetime.now(timezone.utc)
    s3_key = f"raw/year={now.year:04d}/month={now.month:02d}/day={now.day:02d}/weather_{int(now.timestamp())}.json"
    
    json_bytes = json.dumps(payload).encode("utf-8")
    s3_client.put_object(
        Bucket=bucket_name,
        Key=s3_key,
        Body=json_bytes,
        ContentType="application/json"
    )
    return s3_key

def lambda_handler(event, context):
    """
    AWS Lambda Entry point for data ingestion.
    """
    bucket_name = os.environ.get("RAW_S3_BUCKET", "aws-data-pipeline-raw-bucket")
    payload = fetch_weather_data()
    s3_key = upload_raw_to_s3(payload, bucket_name)
    
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Raw weather data successfully ingested.",
            "s3_key": s3_key
        })
    }

if __name__ == "__main__":
    print("Running ingestion locally...")
    data = fetch_weather_data()
    print(f"Ingested weather data for lat={data['latitude']}, lon={data['longitude']}")
