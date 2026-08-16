import json
import io
import os
from decimal import Decimal
import boto3
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from datetime import datetime, timezone
try:
    from utils.validators import validate_raw_weather_payload
except ModuleNotFoundError:
    from src.utils.validators import validate_raw_weather_payload

def transform_json_to_dataframe(payload: dict) -> pd.DataFrame:
    """
    Transforms raw Open-Meteo nested JSON into a flattened Pandas DataFrame.
    """
    validate_raw_weather_payload(payload)
    
    lat = payload["latitude"]
    lon = payload["longitude"]
    tz = payload["timezone"]
    hourly = payload["hourly"]
    
    df = pd.DataFrame({
        "timestamp": pd.to_datetime(hourly["time"]),
        "latitude": lat,
        "longitude": lon,
        "timezone": tz,
        "temperature_2m": hourly["temperature_2m"],
        "relative_humidity_2m": hourly["relative_humidity_2m"],
        "wind_speed_10m": hourly["wind_speed_10m"],
        "processed_at": datetime.now(timezone.utc)
    })
    
    # Cast types explicitly for parquet schema contract
    df["temperature_2m"] = df["temperature_2m"].astype("float32")
    df["relative_humidity_2m"] = df["relative_humidity_2m"].astype("int32")
    df["wind_speed_10m"] = df["wind_speed_10m"].astype("float32")
    
    return df

def convert_dataframe_to_parquet_bytes(df: pd.DataFrame) -> bytes:
    """
    Converts a Pandas DataFrame to snappy-compressed Parquet bytes buffer.
    """
    table = pa.Table.from_pandas(df)
    buffer = io.BytesIO()
    pq.write_table(table, buffer, compression="SNAPPY")
    buffer.seek(0)
    return buffer.getvalue()

def process_s3_raw_object(src_bucket: str, src_key: str, dest_bucket: str, s3_client=None) -> str:
    """
    Reads raw JSON from src S3 bucket, transforms it to Parquet, and writes to dest S3 bucket.
    """
    if s3_client is None:
        s3_client = boto3.client("s3")

    response = s3_client.get_object(Bucket=src_bucket, Key=src_key)
    raw_content = response["Body"].read().decode("utf-8")
    payload = json.loads(raw_content)

    df = transform_json_to_dataframe(payload)
    parquet_bytes = convert_dataframe_to_parquet_bytes(df)

    now = datetime.now(timezone.utc)
    dest_key = f"processed/year={now.year:04d}/month={now.month:02d}/day={now.day:02d}/weather_processed_{int(now.timestamp())}.parquet"

    s3_client.put_object(
        Bucket=dest_bucket,
        Key=dest_key,
        Body=parquet_bytes,
        ContentType="application/x-parquet"
    )

    return dest_key

def write_records_to_dynamodb(df: pd.DataFrame, table_name: str, dynamodb_resource=None) -> int:
    """
    Writes transformed dataframe rows to DynamoDB table for fast API lookups.
    """
    if dynamodb_resource is None:
        dynamodb_resource = boto3.resource("dynamodb")
        
    table = dynamodb_resource.Table(table_name)
    count = 0
    with table.batch_writer() as batch:
        for _, row in df.iterrows():
            item = {
                "id": str(int(row["timestamp"].timestamp())),
                "timestamp": row["timestamp"].isoformat(),
                "latitude": Decimal(str(row["latitude"])),
                "longitude": Decimal(str(row["longitude"])),
                "timezone": str(row["timezone"]),
                "temperature_2m": Decimal(str(round(float(row["temperature_2m"]), 1))),
                "relative_humidity_2m": int(row["relative_humidity_2m"]),
                "wind_speed_10m": Decimal(str(round(float(row["wind_speed_10m"]), 1))),
                "processed_at": row["processed_at"].isoformat()
            }
            batch.put_item(Item=item)
            count += 1
    return count

def lambda_handler(event, context):
    """
    AWS Lambda entrypoint for Step 3 (Transformer & Loader) in Step Functions (or S3 trigger).
    """
    dest_bucket = os.environ.get("PROCESSED_S3_BUCKET", "aws-data-pipeline-processed-bucket")
    db_table = os.environ.get("DYNAMODB_TABLE", "WeatherAnalyticsTable")
    s3_client = boto3.client("s3")
    
    # Mode 1: Step Functions State Input
    if "payload" in event:
        payload = event["payload"]
        df = transform_json_to_dataframe(payload)
        parquet_bytes = convert_dataframe_to_parquet_bytes(df)
        
        now = datetime.now(timezone.utc)
        dest_key = f"processed/year={now.year:04d}/month={now.month:02d}/day={now.day:02d}/weather_processed_{int(now.timestamp())}.parquet"
        s3_client.put_object(
            Bucket=dest_bucket,
            Key=dest_key,
            Body=parquet_bytes,
            ContentType="application/x-parquet"
        )
        
        db_count = write_records_to_dynamodb(df, db_table)
        return {
            "statusCode": 200,
            "processed_key": dest_key,
            "dynamodb_items_written": db_count
        }

    # Mode 2: Legacy S3 ObjectCreated Event
    processed_keys = []
    for record in event.get("Records", []):
        src_bucket = record["s3"]["bucket"]["name"]
        src_key = record["s3"]["object"]["key"]
        
        dest_key = process_s3_raw_object(src_bucket, src_key, dest_bucket, s3_client)
        processed_keys.append(dest_key)
        
    return {
        "statusCode": 200,
        "body": json.dumps({"processed_keys": processed_keys})
    }
