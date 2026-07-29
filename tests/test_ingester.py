import json
import pytest
from unittest.mock import patch, MagicMock
from src.ingester import fetch_weather_data, upload_raw_to_s3

def test_fetch_weather_data_success(sample_weather_payload):
    """Test fetch_weather_data makes HTTP GET request and returns valid dictionary."""
    mock_response = MagicMock()
    mock_response.json.return_value = sample_weather_payload
    mock_response.raise_for_status.return_value = None

    with patch("requests.get", return_value=mock_response) as mock_get:
        data = fetch_weather_data()
        assert data["latitude"] == 51.5
        mock_get.assert_called_once()

def test_upload_raw_to_s3_success(s3_client, sample_weather_payload):
    """Test raw payload is uploaded to S3 raw zone correctly with date partitioning."""
    bucket_name = "test-raw-bucket"
    s3_client.create_bucket(Bucket=bucket_name)

    s3_key = upload_raw_to_s3(sample_weather_payload, bucket_name, s3_client=s3_client)
    assert s3_key.startswith("raw/year=")
    assert s3_key.endswith(".json")

    # Verify S3 object content
    response = s3_client.get_object(Bucket=bucket_name, Key=s3_key)
    downloaded_content = json.loads(response["Body"].read().decode("utf-8"))
    assert downloaded_content["latitude"] == 51.5
