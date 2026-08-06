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

def test_validate_raw_weather_payload_not_dict():
    """Test validation raises error when payload is not a dictionary."""
    with pytest.raises(DataValidationError, match="Payload must be a dictionary."):
        validate_raw_weather_payload("not a dictionary")

def test_validate_raw_weather_payload_hourly_not_dict(sample_weather_payload):
    """Test validation raises error when 'hourly' field is not a dictionary."""
    sample_weather_payload["hourly"] = "invalid_hourly_type"
    with pytest.raises(DataValidationError, match="'hourly' payload field must be a dictionary."):
        validate_raw_weather_payload(sample_weather_payload)

def test_validate_raw_weather_payload_empty_time_list(sample_weather_payload):
    """Test validation raises error when hourly 'time' is empty or not a list."""
    sample_weather_payload["hourly"]["time"] = []
    with pytest.raises(DataValidationError, match="Hourly 'time' list cannot be empty."):
        validate_raw_weather_payload(sample_weather_payload)

def test_validate_raw_weather_payload_mismatched_temp_list(sample_weather_payload):
    """Test validation raises error when temperature list length does not match time list length."""
    sample_weather_payload["hourly"]["temperature_2m"] = [18.5]  # len 1 vs time len 3
    with pytest.raises(DataValidationError, match="Hourly 'temperature_2m' list size must match 'time' list size."):
        validate_raw_weather_payload(sample_weather_payload)

