"""Tests for System Health and API envelope standards."""


def test_health_ping(client):
    """Test standard health check endpoint."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.get_json()
    assert data["success"] is True
    assert data["data"]["status"] == "healthy"
    assert "version" in data["data"]


def test_health_detailed(client):
    """Test detailed diagnostics endpoint."""
    response = client.get("/api/v1/health/detailed")
    # In test mode with in-memory SQLite and without external
    # Ollama/Redis running, status will be 200 or 503
    assert response.status_code in (200, 503)

    data = response.get_json()
    assert "services" in data["data"]
    assert "database" in data["data"]["services"]
    assert "redis" in data["data"]["services"]
    assert "ollama" in data["data"]["services"]
    assert "whisper" in data["data"]["services"]


def test_404_error_envelope(client):
    """Test that 404 errors return standardized JSON envelope."""
    response = client.get("/api/v1/nonexistent-route")
    assert response.status_code == 404

    data = response.get_json()
    assert data["success"] is False
    assert data["code"] == "NOT_FOUND"
    assert "message" in data
