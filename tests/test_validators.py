import pytest
from src.utils.validators import validate_raw_weather_payload, DataValidationError

def test_validate_raw_weather_payload_success(sample_weather_payload):
    """Test valid weather payload passes validation."""
    assert validate_raw_weather_payload(sample_weather_payload) is True

def test_validate_raw_weather_payload_missing_root_key(sample_weather_payload):
    """Test validation raises DataValidationError when a mandatory root key is missing."""
    del sample_weather_payload["latitude"]
    with pytest.raises(DataValidationError, match="Missing required root key: 'latitude'"):
        validate_raw_weather_payload(sample_weather_payload)

def test_validate_raw_weather_payload_missing_hourly_key(sample_weather_payload):
    """Test validation raises error when a key inside hourly is missing."""
    del sample_weather_payload["hourly"]["temperature_2m"]
    with pytest.raises(DataValidationError, match="Missing required hourly key: 'temperature_2m'"):
        validate_raw_weather_payload(sample_weather_payload)

def test_validate_raw_weather_payload_invalid_temperature_bound(sample_weather_payload):
    """Test data quality rule catches unrealistic temperature values (e.g. 150°C)."""
    sample_weather_payload["hourly"]["temperature_2m"][0] = 150.0
    with pytest.raises(DataValidationError, match="Temperature value out of realistic bounds"):
        validate_raw_weather_payload(sample_weather_payload)
