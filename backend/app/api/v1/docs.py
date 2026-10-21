"""OpenAPI 3.0 Documentation Specification and Swagger UI."""

from flask import Blueprint, jsonify, render_template_string

docs_bp = Blueprint("docs", __name__)

OPENAPI_SPEC = {
    "openapi": "3.0.3",
    "info": {
        "title": "VoxMind REST API",
        "description": "Local-First AI Voice Intelligence Platform REST API Specification.",
        "version": "1.0.0",
        "contact": {
            "name": "VoxMind Engineering",
            "url": "https://github.com/voxmind/voxmind",
        },
    },
    "servers": [{"url": "/api/v1", "description": "Local Development / Production Server"}],
    "paths": {
        "/health": {
            "get": {
                "summary": "API Liveness Probe",
                "responses": {
                    "200": {
                        "description": "Service is alive",
                        "content": {"application/json": {"schema": {"type": "object"}}},
                    }
                },
            }
        },
        "/ready": {
            "get": {
                "summary": "System Readiness Probe",
                "responses": {
                    "200": {"description": "All dependencies are healthy and ready"},
                    "503": {"description": "Critical dependency failure"},
                },
            }
        },
        "/recordings": {
            "get": {
                "summary": "List recordings with pagination and filtering",
                "parameters": [
                    {"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
                    {
                        "name": "per_page",
                        "in": "query",
                        "schema": {"type": "integer", "default": 20},
                    },
                    {"name": "search", "in": "query", "schema": {"type": "string"}},
                    {
                        "name": "status",
                        "in": "query",
                        "schema": {
                            "type": "string",
                            "enum": ["queued", "transcribing", "summarizing", "ready", "failed"],
                        },
                    },
                    {
                        "name": "sort_by",
                        "in": "query",
                        "schema": {"type": "string", "default": "created_at"},
                    },
                    {
                        "name": "order",
                        "in": "query",
                        "schema": {"type": "string", "enum": ["asc", "desc"], "default": "desc"},
                    },
                ],
                "responses": {
                    "200": {"description": "List of recordings"},
                },
            },
            "post": {
                "summary": "Upload and register a new audio recording",
                "requestBody": {
                    "required": True,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "type": "object",
                                "required": ["file"],
                                "properties": {
                                    "file": {"type": "string", "format": "binary"},
                                    "title": {"type": "string"},
                                    "collection_id": {"type": "string", "format": "uuid"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "201": {"description": "Recording uploaded and queued for processing"},
                    "400": {"description": "Invalid file format or missing audio file"},
                    "413": {"description": "File payload exceeds max upload limit (100MB)"},
                },
            },
        },
        "/recordings/{id}": {
            "get": {
                "summary": "Retrieve recording details, transcript segments, and insights",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "200": {"description": "Detailed recording object"},
                    "404": {"description": "Recording not found"},
                },
            },
            "delete": {
                "summary": "Delete a recording and remove its audio file",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "200": {"description": "Recording deleted successfully"},
                    "404": {"description": "Recording not found"},
                },
            },
        },
        "/recordings/{id}/transcript": {
            "get": {
                "summary": "Retrieve chronological transcript segments for a recording",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "200": {"description": "Chronological transcript segments"},
                    "404": {"description": "Recording not found"},
                },
            },
        },
        "/recordings/{id}/retry": {
            "post": {
                "summary": "Re-enqueue transcription pipeline for a failed recording",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "200": {"description": "Transcription re-enqueued successfully"},
                    "400": {"description": "Recording has already completed"},
                    "404": {"description": "Recording not found"},
                    "409": {"description": "Recording is currently being processed"},
                },
            },
        },
        "/recordings/{id}/analysis": {
            "get": {
                "summary": "Retrieve AI intelligence analysis (summary, takeaways, decisions)",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "200": {"description": "Structured AI intelligence analysis"},
                    "404": {"description": "Recording not found"},
                },
            },
        },
        "/recordings/{id}/analysis/status": {
            "get": {
                "summary": "Retrieve AI analysis processing status",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "200": {"description": "Analysis processing status"},
                    "404": {"description": "Recording not found"},
                },
            },
        },
        "/recordings/{id}/analysis/regenerate": {
            "post": {
                "summary": "Request asynchronous regeneration of AI insights",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "202": {"description": "Regeneration task enqueued"},
                    "404": {"description": "Recording not found"},
                    "409": {"description": "Analysis or transcription is already in progress"},
                },
            },
        },
        "/recordings/{id}/ask": {
            "post": {
                "summary": "Ask a question grounded exclusively in the audio transcript",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["question"],
                                "properties": {"question": {"type": "string"}},
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"description": "Grounded answer with evidence timestamps"},
                    "400": {"description": "Invalid question or no transcript dialogue"},
                    "404": {"description": "Recording not found"},
                    "503": {"description": "Local Ollama service unavailable"},
                },
            },
        },
        "/recordings/{id}/index-status": {
            "get": {
                "summary": "Retrieve vector indexing status and chunk count for a recording",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "200": {"description": "Indexing status, chunk count, and timestamps"},
                    "404": {"description": "Recording not found"},
                },
            },
        },
        "/recordings/{id}/reindex": {
            "post": {
                "summary": "Trigger asynchronous re-chunking and re-embedding of a recording",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "202": {"description": "Vector indexing task enqueued"},
                    "400": {"description": "Cannot index recording without completed transcript"},
                    "404": {"description": "Recording not found"},
                },
            },
        },
        "/search": {
            "post": {
                "summary": "Semantic, keyword, or hybrid retrieval across authorized recordings",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["query"],
                                "properties": {
                                    "query": {"type": "string", "maxLength": 500},
                                    "limit": {"type": "integer", "default": 10},
                                    "recording_id": {"type": "string", "format": "uuid"},
                                    "recording_ids": {
                                        "type": "array",
                                        "items": {"type": "string", "format": "uuid"},
                                    },
                                    "mode": {
                                        "type": "string",
                                        "enum": ["hybrid", "semantic", "keyword"],
                                        "default": "hybrid",
                                    },
                                    "min_score": {"type": "number"},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"description": "Ranked passages with audio timestamps and metadata"},
                    "400": {"description": "Invalid query or parameters"},
                },
            },
        },
        "/knowledge/ask": {
            "post": {
                "summary": "Cross-recording evidence-grounded QA with verified audio citations",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["question"],
                                "properties": {
                                    "question": {"type": "string", "maxLength": 1000},
                                    "recording_ids": {
                                        "type": "array",
                                        "items": {"type": "string", "format": "uuid"},
                                    },
                                    "max_passages": {"type": "integer", "default": 5},
                                },
                            }
                        }
                    },
                },
                "responses": {
                    "200": {"description": "Synthesized answer with citation links and timestamps"},
                    "400": {"description": "Invalid question"},
                    "500": {"description": "Ollama inference or retrieval error"},
                },
            },
        },
        "/jobs/{id}": {
            "get": {
                "summary": "Retrieve transcription job execution metadata and status",
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string", "format": "uuid"},
                    }
                ],
                "responses": {
                    "200": {"description": "Transcription job details"},
                    "404": {"description": "Job not found"},
                },
            },
        },
        "/collections": {
            "get": {
                "summary": "List collections in current workspace",
                "responses": {"200": {"description": "Workspace collections"}},
            },
            "post": {
                "summary": "Create a new workspace collection",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["name"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "description": {"type": "string"},
                                    "color": {"type": "string"},
                                },
                            }
                        }
                    },
                },
                "responses": {"201": {"description": "Collection created"}},
            },
        },
        "/api-keys": {
            "get": {
                "summary": "List developer API keys",
                "responses": {"200": {"description": "API keys list"}},
            },
            "post": {
                "summary": "Generate a new scoped developer API key",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["name"],
                                "properties": {
                                    "name": {"type": "string"},
                                    "expires_days": {"type": "integer"},
                                },
                            }
                        }
                    },
                },
                "responses": {"201": {"description": "API key generated"}},
            },
        },
        "/usage": {
            "get": {
                "summary": "Get workspace AI token and operational resource metrics",
                "responses": {"200": {"description": "Usage summary"}},
            },
        },
        "/diagnostics": {
            "get": {
                "summary": "Deep multi-service infrastructure diagnostics",
                "responses": {"200": {"description": "Diagnostics result"}},
            },
        },
    },
}

SWAGGER_UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>VoxMind API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0D0E11; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>
"""


@docs_bp.route("/openapi.json", methods=["GET"])
def get_openapi_spec():
    """Return the raw OpenAPI 3.0 specification as JSON."""
    return jsonify(OPENAPI_SPEC)


@docs_bp.route("/docs", methods=["GET"])
def get_swagger_ui():
    """Render interactive Swagger UI documentation."""
    return render_template_string(SWAGGER_UI_HTML)
