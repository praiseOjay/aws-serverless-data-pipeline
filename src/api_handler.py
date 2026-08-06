import json
import os
from decimal import Decimal
import boto3

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def get_weather_data(table_name: str, dynamodb_resource=None) -> list:
    """
    Fetches weather records from DynamoDB sorted by timestamp descending.
    """
    if dynamodb_resource is None:
        dynamodb_resource = boto3.resource("dynamodb")
        
    table = dynamodb_resource.Table(table_name)
    response = table.scan()
    items = response.get("Items", [])
    
    # Sort items by timestamp string ISO
    items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return items

def lambda_handler(event, context):
    """
    AWS Lambda handler for API Gateway HTTP endpoints.
    Endpoints:
      - /api/weather/latest
      - /api/weather/history
    """
    table_name = os.environ.get("DYNAMODB_TABLE", "WeatherAnalyticsTable")
    path = event.get("path", "/api/weather/latest")
    
    cors_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS"
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    try:
        items = get_weather_data(table_name)
        
        if "/latest" in path:
            body_data = items[0] if items else {}
        else:
            body_data = items

        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps(body_data, cls=DecimalEncoder)
        }
    except Exception as err:
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": str(err)})
        }
