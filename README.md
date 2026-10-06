# RAKSHNOVA

# RakshNova – AI Disaster Intelligence & Emergency Response

A frontend-only hackathon prototype that shows how AI-style analysis could support disaster monitoring, early warning and emergency response.

**Prototype notice:** All data and "AI" analysis are simulated for demonstration. This is not real emergency data. In a real emergency, contact your local emergency services.

## Problem

During floods, earthquakes, fires and extreme weather, people often lack timely, location-specific information. RakshNova demonstrates a dashboard that analyzes disaster data, gives early warnings, highlights high-risk areas and recommends faster emergency action.

## Features

- Live-style dashboard with simulated risk score, people affected, active alerts, high-risk zones and response priority
- Overview cards for Flood, Earthquake, Fire and Extreme Weather
- Interactive risk analysis by disaster type, location, severity and population density
- Early warning alerts, with a prominent banner when risk is Critical
- Clickable high-risk zone map of a fictional region
- Emergency response panel with evacuation advice, safe zones, sample contacts and a checklist
- AI situation briefing generated from the selected analysis or zone
- Reset button to restore the starting state

## How to Run

1. Keep `index.html`, `style.css` and `script.js` in the same folder.
2. Open `index.html` in any modern browser.

No installation, server or internet connection is needed.

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript

No frameworks, backend or database.

## How the Risk Score Works

The risk score is a weighted formula, not a trained model:

- Severity: 38%
- Location vulnerability: 32%
- Population density: 20%
- Seasonal and environmental conditions: 10%

A small random variation is added. Scores map to Low (under 30), Moderate (30–54), High (55–77) and Critical (78 and above).

## Project Files

- `index.html` – page structure
- `style.css` – styling and responsive layout
- `script.js` – simulated data, risk logic, alerts, map and briefing

## Limitations

- All locations, populations and alerts are fictional.
- Emergency contact numbers are samples and should be verified locally.
- No real sensors, maps or forecasting data are used.

## Future Scope

- Connect real data sources such as weather, seismic and satellite feeds
- Use real maps and GPS
- Train and validate real prediction models
- Add SMS and push notifications and multi-language support

 
🌱 Vision

From knowing that a disaster is coming to knowing who needs help first.
RAKSHNOVA aims to make disaster intelligence more accessible, localized, multilingual, and actionable—helping communities and responders make faster, better-informed decisions when every minute matters.
