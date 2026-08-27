# TravelBuddy Developer Documentation

> REST API and Model Context Protocol (MCP) Integration Guide.

## Base URLs

- **Production API**: `https://travelbuddy-backend-19l6.onrender.com`
- **Development API**: `http://localhost:4000`

## Machine-Readable Specifications

- **OpenAPI 3.0 JSON**: `https://travalbuddy.web.app/openapi.json`
- **OpenAPI 3.0 YAML**: `https://travalbuddy.web.app/openapi.yaml`
- **Model Context Protocol Manifest**: `https://travalbuddy.web.app/.well-known/mcp`
- **AI Agent Guidelines**: `https://travalbuddy.web.app/llms.txt`

## Authentication

All protected endpoints require a JWT bearer token:
```
Authorization: Bearer <TOKEN>
```

## Model Context Protocol (MCP) Tools

- `estimate_delivery_fee`: Calculates estimated fee based on distance, weight, and urgency tier.
- `search_travel_routes`: Finds active travelers on requested corridors.
- `get_parcel_status`: Retrieves public milestone status for a given order ID.
- `list_prohibited_items`: Returns all prohibited cargo classes.
- `get_platform_info`: Returns platform status, support points, and legal policies.
