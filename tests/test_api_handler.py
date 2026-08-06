import json
import pytest
from decimal import Decimal
import boto3
from moto import mock_aws
from src.api_handler import lambda_handler, DecimalEncoder

@pytest.fixture
def dynamodb_setup(aws_credentials):
    with mock_aws():
        resource = boto3.resource("dynamodb", region_name="us-east-1")
        table = resource.create_table(
            TableName="WeatherAnalyticsTable",
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST"
        )
        # Seed test record
        table.put_item(
            Item={
                "id": "1786009200",
                "timestamp": "2026-08-06T12:00:00",
                "temperature_2m": Decimal("18.5"),
                "relative_humidity_2m": 75,
                "wind_speed_10m": Decimal("12.4")
            }
        )
        yield resource

def test_api_handler_latest(dynamodb_setup, monkeypatch):
    """Test API Gateway endpoint /api/weather/latest returns single latest item."""
    monkeypatch.setenv("DYNAMODB_TABLE", "WeatherAnalyticsTable")
    event = {"path": "/api/weather/latest", "httpMethod": "GET"}
    response = lambda_handler(event, None)
    
    assert response["statusCode"] == 200
    assert response["headers"]["Access-Control-Allow-Origin"] == "*"
    body = json.loads(response["body"])
    assert body["id"] == "1786009200"
    assert body["temperature_2m"] == 18.5

def test_api_handler_history(dynamodb_setup, monkeypatch):
    """Test API Gateway endpoint /api/weather/history returns array of records."""
    monkeypatch.setenv("DYNAMODB_TABLE", "WeatherAnalyticsTable")
    event = {"path": "/api/weather/history", "httpMethod": "GET"}
    response = lambda_handler(event, None)
    
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert isinstance(body, list)
    assert len(body) == 1

def test_api_handler_options_cors():
    """Test API Gateway OPTIONS preflight CORS request."""
    event = {"httpMethod": "OPTIONS"}
    response = lambda_handler(event, None)
    assert response["statusCode"] == 200
    assert response["headers"]["Access-Control-Allow-Origin"] == "*"

def test_api_handler_error(aws_credentials):
    """Test API Gateway handler error handling returns 500 status."""
    from unittest.mock import patch
    with patch("src.api_handler.get_weather_data", side_effect=Exception("DynamoDB error")):
        event = {"path": "/api/weather/latest", "httpMethod": "GET"}
        response = lambda_handler(event, None)
        assert response["statusCode"] == 500
        body = json.loads(response["body"])
        assert "DynamoDB error" in body["error"]

def test_decimal_encoder_fallback():
    """Test DecimalEncoder fallback for non-decimal types."""
    encoder = DecimalEncoder()
    assert encoder.default(Decimal("10.5")) == 10.5
    with pytest.raises(TypeError):
        encoder.default(object())
