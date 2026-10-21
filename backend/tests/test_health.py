"""Tests for System Health, Readiness, and OpenAPI Documentation."""


def test_health_ping(client):
    """Test standard health check endpoint."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["status"] == "healthy"
    assert "version" in data["data"]


def test_ready_check(client):
    """Test readiness check endpoint."""
    response = client.get("/api/v1/ready")
    assert response.status_code == 200

    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["status"] == "ready"
    assert "database" in data["data"]["checks"]
    assert "storage" in data["data"]["checks"]


def test_openapi_spec(client):
    """Test raw OpenAPI JSON specification."""
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200

    data = response.get_json()
    assert data["openapi"] == "3.0.3"
    assert "/recordings" in data["paths"]
    assert "/health" in data["paths"]


def test_swagger_ui_html(client):
    """Test Swagger UI documentation page."""
    response = client.get("/api/v1/docs")
    assert response.status_code == 200
    assert b"swagger-ui" in response.data


def test_404_error_envelope(client):
    """Test that 404 errors return standardized JSON envelope."""
    response = client.get("/api/v1/nonexistent-route")
    assert response.status_code == 404

    data = response.get_json()
    assert data["success"] is False
    assert data["code"] == "NOT_FOUND"
    assert "message" in data
