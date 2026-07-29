import os
import pytest
import boto3
from moto import mock_aws

@pytest.fixture
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

@pytest.fixture
def s3_client(aws_credentials):
    """Mocked S3 Client using moto."""
    with mock_aws():
        conn = boto3.client("s3", region_name="us-east-1")
        yield conn

@pytest.fixture
def sample_weather_payload():
    """Valid sample Open-Meteo weather JSON payload."""
    return {
        "latitude": 51.5,
        "longitude": -0.12,
        "generationtime_ms": 0.15,
        "utc_offset_seconds": 0,
        "timezone": "UTC",
        "timezone_abbreviation": "UTC",
        "elevation": 25.0,
        "hourly_units": {
            "time": "iso8601",
            "temperature_2m": "°C",
            "relative_humidity_2m": "%",
            "wind_speed_10m": "km/h"
        },
        "hourly": {
            "time": ["2026-07-29T00:00", "2026-07-29T01:00", "2026-07-29T02:00"],
            "temperature_2m": [18.5, 17.8, 17.2],
            "relative_humidity_2m": [75, 78, 82],
            "wind_speed_10m": [12.4, 11.1, 9.8]
        }
    }
