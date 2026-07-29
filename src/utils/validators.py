from typing import Dict, Any, List

class DataValidationError(Exception):
    """Custom exception raised when payload fails schema validation or data quality rules."""
    pass

REQUIRED_KEYS = ["latitude", "longitude", "timezone", "hourly"]
REQUIRED_HOURLY_KEYS = ["time", "temperature_2m", "relative_humidity_2m", "wind_speed_10m"]

def validate_raw_weather_payload(payload: Dict[str, Any]) -> bool:
    """
    Validates that the raw API weather payload contains all mandatory keys and structure.
    
    Args:
        payload (dict): Parsed JSON payload from API.
        
    Returns:
        bool: True if valid.
        
    Raises:
        DataValidationError: If any required key is missing or data types are invalid.
    """
    if not isinstance(payload, dict):
        raise DataValidationError("Payload must be a dictionary.")

    for key in REQUIRED_KEYS:
        if key not in payload:
            raise DataValidationError(f"Missing required root key: '{key}'")

    hourly = payload.get("hourly", {})
    if not isinstance(hourly, dict):
        raise DataValidationError("'hourly' payload field must be a dictionary.")

    for h_key in REQUIRED_HOURLY_KEYS:
        if h_key not in hourly:
            raise DataValidationError(f"Missing required hourly key: '{h_key}'")

    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])
    
    if not isinstance(times, list) or len(times) == 0:
        raise DataValidationError("Hourly 'time' list cannot be empty.")
        
    if not isinstance(temps, list) or len(temps) != len(times):
        raise DataValidationError("Hourly 'temperature_2m' list size must match 'time' list size.")

    # Data Quality: Validate temperature range limits (-100C to +70C)
    for temp in temps:
        if temp is not None and not (-100.0 <= float(temp) <= 70.0):
            raise DataValidationError(f"Temperature value out of realistic bounds: {temp}")

    return True
