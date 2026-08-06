import pytest
from src.validator_lambda import lambda_handler
from src.utils.validators import DataValidationError

def test_validator_lambda_success(sample_weather_payload):
    """Test validator lambda successfully validates valid payload."""
    event = {
        "s3_bucket": "raw-bucket",
        "s3_key": "raw/key.json",
        "payload": sample_weather_payload
    }
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    assert response["is_valid"] is True
    assert response["s3_key"] == "raw/key.json"

def test_validator_lambda_missing_payload():
    """Test validator lambda raises DataValidationError when payload key is missing."""
    event = {"s3_bucket": "raw-bucket"}
    with pytest.raises(DataValidationError, match="State input missing 'payload' dictionary."):
        lambda_handler(event, None)
