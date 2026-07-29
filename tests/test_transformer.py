import json
import io
import pytest
import pandas as pd
import pyarrow.parquet as pq
from src.transformer import (
    transform_json_to_dataframe,
    convert_dataframe_to_parquet_bytes,
    process_s3_raw_object
)

def test_transform_json_to_dataframe(sample_weather_payload):
    """Test raw payload is correctly flattened into Pandas DataFrame with correct dtypes."""
    df = transform_json_to_dataframe(sample_weather_payload)
    assert len(df) == 3
    assert list(df.columns) == [
        "timestamp", "latitude", "longitude", "timezone",
        "temperature_2m", "relative_humidity_2m", "wind_speed_10m", "processed_at"
    ]
    assert df["temperature_2m"].dtype == "float32"

def test_convert_dataframe_to_parquet_bytes(sample_weather_payload):
    """Test dataframe converts to valid Parquet byte stream."""
    df = transform_json_to_dataframe(sample_weather_payload)
    parquet_bytes = convert_dataframe_to_parquet_bytes(df)

    # Read back parquet bytes using PyArrow
    reader = pa = pq.read_table(io.BytesIO(parquet_bytes))
    read_df = reader.to_pandas()
    assert len(read_df) == 3
    assert read_df["temperature_2m"].iloc[0] == pytest.approx(18.5)

def test_process_s3_raw_object_end_to_end(s3_client, sample_weather_payload):
    """Test reading S3 JSON raw object, transforming, and writing S3 Parquet object."""
    src_bucket = "raw-bucket"
    dest_bucket = "processed-bucket"
    s3_client.create_bucket(Bucket=src_bucket)
    s3_client.create_bucket(Bucket=dest_bucket)

    src_key = "raw/year=2026/month=07/day=29/weather_123.json"
    s3_client.put_object(
        Bucket=src_bucket,
        Key=src_key,
        Body=json.dumps(sample_weather_payload).encode("utf-8")
    )

    dest_key = process_s3_raw_object(src_bucket, src_key, dest_bucket, s3_client=s3_client)
    assert dest_key.startswith("processed/year=")
    assert dest_key.endswith(".parquet")

    # Verify dest bucket object exists and is valid parquet
    response = s3_client.get_object(Bucket=dest_bucket, Key=dest_key)
    parquet_data = response["Body"].read()
    read_df = pq.read_table(io.BytesIO(parquet_data)).to_pandas()
    assert len(read_df) == 3
