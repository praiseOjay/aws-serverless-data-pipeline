import json
from src.utils.validators import validate_raw_weather_payload, DataValidationError

def lambda_handler(event, context):
    """
    AWS Lambda entrypoint for Step 2 (Validator) in Step Functions.
    Validates payload contract and data quality bounds.
    """
    payload = event.get("payload")
    if not payload:
        raise DataValidationError("State input missing 'payload' dictionary.")
    
    validate_raw_weather_payload(payload)
    
    return {
        "statusCode": 200,
        "is_valid": True,
        "s3_bucket": event.get("s3_bucket"),
        "s3_key": event.get("s3_key"),
        "payload": payload
    }
