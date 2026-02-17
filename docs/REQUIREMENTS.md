# HamSCI-TAPR Magnetometer Web Dashboard
## Requirements Document

**Version:** 0.2
**Date:** January 22, 2026
**Status:** Revised Draft

---

## 1. Introduction

### 1.1 Purpose

This document defines the requirements for a real-time web-based dashboard for the HamSCI-TAPR Personal Space Weather Station (PSWS) magnetometer system. The dashboard will allow users to visualize and interact with magnetic field data collected by low-cost, citizen science magnetometers deployed across the United States.

### 1.2 Background

The HamSCI magnetometer is part of the Ham Radio Science Citizen Investigation (HamSCI) Personal Space Weather Station (PSWS) project, funded by the National Science Foundation. The system uses a PNI RM3100 magneto-inductive sensor to measure three-axis magnetic field variations with ~3 nT resolution at 1 Hz sampling rate. The magnetometer network aims to provide dense spatial coverage for monitoring geomagnetic activity, including storms, substorms, and ULF waves.

**Key References:**
- [HardwareX Paper (Kim et al., 2024)](https://doi.org/10.1016/j.ohx.2024.e00580) - System design and validation
- [mag-usb Repository](https://github.com/wittend/mag-usb) - Backend data acquisition software
- [mag-dash Repository](https://github.com/wittend/mag-dash) - Strawman dashboard implementation

### 1.3 Scope

This requirements document covers the web-based dashboard component only. It does not cover:
- Hardware modifications to the magnetometer system
- Changes to the mag-usb data acquisition software
- Central data aggregation server infrastructure

---

## 2. System Overview

### 2.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAGNETOMETER SYSTEM                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    CAT5/6    ┌──────────────┐                    │
│  │    Linux     │◄────────────►│   Remote     │                    │
│  │   Computer   │   (up to     │   Board +    │                    │
│  │              │   500 ft)    │   RM3100     │                    │
│  │  ┌────────┐  │              │   Sensor     │                    │
│  │  │mag-usb │  │              └──────────────┘                    │
│  │  │software│  │                   (buried)                       │
│  │  └───┬────┘  │                                                  │
│  │      │       │                                                  │
│  │      ▼       │                                                  │
│  │  JSON Lines  │                                                  │
│  │  (stdout or  │                                                  │
│  │  named pipe) │                                                  │
│  └──────┬───────┘                                                  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────┐                                                  │
│  │  Web-Based   │◄─── THIS PROJECT                                 │
│  │  Dashboard   │                                                  │
│  └──────────────┘                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Format

The mag-usb software outputs JSON Lines (JSONL) with the following structure:

```json
{"ts": "DD Mon YYYY HH:MM:SS", "rt": <float> , "x": <float>, "y": <float>, "z": <float>}
```

**Field Definitions:**
| Field | Type | Description |
|-------|------|-------------|
| `ts` | string | RFC-2822 formatted timestamp |
| `rt` | float | remote sensor temperature in deg. C. |
| `x` | float | X-axis magnetic field (nT) |
| `y` | float | Y-axis magnetic field (nT) |
| `z` | float | Z-axis magnetic field (nT) |

**Coordinate System Note:** The sensor's raw XYZ coordinates require transformation to the standard geomagnetic HEZ coordinate system:
- **H** (horizontal north) = -Z (raw)
- **E** (horizontal east) = Y (raw)
- **Z** (vertical down) = X (raw)

### 2.3 Sensor Specifications

| Parameter | Value |
|-----------|-------|
| Resolution | ~3 nT at 1 Hz |
| Noise Floor | 4 pT/√Hz at 1 Hz |
| Measurement Range | ±1.1 × 10⁶ nT |
| Sample Rate | 1 Hz |
| Temperature Range | -40°C to +85°C |

---

## 3. Functional Requirements

### Requirement Levels

This document uses the following keywords to indicate requirement levels, as defined in RFC 2119:

- **SHALL** (Priority: Must) - Indicates an absolute requirement. The feature must be implemented for the system to be considered complete.
- **SHOULD** (Priority: Should) - Indicates a recommended requirement. The feature is highly desirable and should be implemented unless there are compelling reasons not to do so.
- **MAY** (Priority: May) - Indicates an optional requirement. The feature is truly optional and may be included or omitted at the implementer's discretion.

### 3.1 Data Ingestion

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DI-01 | The system SHALL support real-time data streaming via WebSocket | Must |
| FR-DI-02 | The system SHALL support loading historical data from JSONL files | Must |
| FR-DI-03 | The system SHOULD support MQTT-over-WebSocket for data ingestion | Should |
| FR-DI-04 | The system SHALL parse JSON Lines format with timestamp and XYZ values | Must |
| FR-DI-05 | The system SHALL handle connection interruptions gracefully with automatic reconnection | Must |
| FR-DI-06 | The system SHOULD support configurable data source URLs | Should |

### 3.2 Real-Time Visualization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-VIS-01 | The system SHALL display real-time time-series plots for all three magnetic field components | Must |
| FR-VIS-02 | The system SHALL update plots at minimum 1 Hz to match sensor sample rate | Must |
| FR-VIS-03 | The system SHALL display current values with at least 3 decimal places (nT precision) | Must |
| FR-VIS-04 | The system SHALL provide zoom and pan capabilities on time-series plots | Must |
| FR-VIS-05 | The system SHOULD calculate and display total field magnitude (√(H² + E² + Z²)) | Should |
| FR-VIS-06 | The system SHOULD support configurable time windows (1 min, 5 min, 1 hour, etc.) | Should |
| FR-VIS-07 | The system MAY display mini sparkline charts for quick overview | May |

### 3.3 Data Processing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DP-01 | The system SHALL apply coordinate transformation from raw XYZ to geomagnetic HEZ | Must |
| FR-DP-02 | The system SHOULD support configurable orientation transformations in 90° increments | Should |
| FR-DP-03 | The system SHOULD calculate and display dB (variations from baseline) | Should |
| FR-DP-04 | The system SHOULD support moving average filtering (e.g., 60-second window) | Should |
| FR-DP-05 | The system MAY calculate and display dB/dt (rate of change) for space weather monitoring | May |

### 3.4 Historical Data

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-HD-01 | The system SHALL maintain a scrollable history table of readings | Must |
| FR-HD-02 | The system SHALL support data export to JSONL format | Must |
| FR-HD-03 | The system SHOULD support data export to CSV format | Should |
| FR-HD-04 | The system MAY support configurable data retention limits | May |

### 3.5 User Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-UI-01 | The system SHALL provide a clean, responsive web interface | Must |
| FR-UI-02 | The system SHOULD support both light and dark themes | Should |
| FR-UI-03 | The system SHOULD persist user preferences (theme, layout) in local storage | Should |
| FR-UI-04 | The system SHOULD support tabbed interface for multiple data sources | Should |
| FR-UI-05 | The system SHOULD provide a configuration panel for connection settings | Should |
| FR-UI-06 | The system SHALL display connection status indicators | Must |
| FR-UI-07 | The system SHOULD be usable on tablets and desktop browsers | Should |

### 3.6 Offline Capability

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-OFF-01 | The system SHALL function without external CDN dependencies | Must |
| FR-OFF-02 | The system SHALL vendor all critical JavaScript libraries locally | Must |
| FR-OFF-03 | The system SHALL support local-network-only deployments | Must |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-PERF-01 | The dashboard SHALL render updates within 100ms of data receipt | Must |
| NFR-PERF-02 | The system SHALL handle continuous 1 Hz data streams without memory leaks | Must |
| NFR-PERF-03 | The system SHOULD remain responsive with at least 1 hour of buffered data | Should |
| NFR-PERF-04 | Initial page load SHOULD complete within 3 seconds on local network | Should |

### 4.2 Compatibility

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-COMPAT-01 | The system SHALL support modern versions of Chrome, Firefox, and Safari | Must |
| NFR-COMPAT-02 | The system SHALL run on Linux Computer hardware | Must |
| NFR-COMPAT-03 | The backend SHOULD be deployable using Deno or Node.js runtime | Should |

### 4.3 Security

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-SEC-01 | The system SHOULD support Content Security Policy (CSP) headers | Should |
| NFR-SEC-02 | The system SHOULD support HTTPS/WSS for internet-facing deployments | Should |
| NFR-SEC-03 | The system SHOULD support optional authentication for MQTT connections | Should |

### 4.4 Maintainability

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-MAINT-01 | Code SHALL be well-documented with inline comments | Must |
| NFR-MAINT-02 | The system SHOULD use standard, widely-adopted technologies | Should |
| NFR-MAINT-03 | The system SHOULD include automated tests for critical functionality | Should |

### 4.5 Deployment

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-DEPLOY-01 | The system SHALL be deployable via simple command-line invocation | Must |
| NFR-DEPLOY-02 | The system SHALL include clear installation documentation | Must |
| NFR-DEPLOY-03 | The system MAY support containerized deployment (Docker) | May |

---

## 5. Technical Constraints

### 5.1 Inherited from mag-dash Strawman

The existing mag-dash prototype provides a reference implementation using:
- **Runtime:** Deno 2.x
- **Frontend:** Vanilla JavaScript, HTML5, CSS
- **Charting:** Canvas-based sparklines (lightweight)
- **Styling:** Light/dark theme support via CSS
- **Icons:** Tabler Icons (MIT licensed, vendored)
- **MQTT:** MQTT.js v5 (vendored)

The student developer may choose to:
1. Extend and improve the existing mag-dash codebase
2. Rewrite using a modern framework (React, Vue, Svelte) while maintaining feature parity
3. Use a different backend runtime (Node.js) if preferred

### 5.2 Integration Requirements

- Must integrate with mag-usb JSON Lines output
- Should work with the standard PSWS Linux Computer deployment
- Should be compatible with the TOML configuration approach used by mag-usb

---

## 6. User Stories

### 6.1 Local Monitoring

> **As a** citizen scientist with a HamSCI magnetometer,
> **I want to** see real-time magnetic field readings from my sensor,
> **so that** I can verify my system is working and observe geomagnetic activity.

### 6.2 Event Detection

> **As a** space weather enthusiast,
> **I want to** see historical plots with zoom capability,
> **so that** I can identify geomagnetic storms and pulsations when they occur.

### 6.3 Data Export

> **As a** researcher,
> **I want to** export magnetometer data to standard formats,
> **so that** I can perform detailed analysis in other tools.

### 6.4 Multiple Sensors

> **As a** user monitoring multiple magnetometer stations,
> **I want to** view data from different sources in separate tabs,
> **so that** I can compare readings across locations.

### 6.5 Remote Access

> **As a** magnetometer operator,
> **I want to** access my dashboard remotely via a web browser,
> **so that** I can check my system status from anywhere.

---

## 7. Future Considerations

The following features are explicitly out of scope for the initial implementation but should be considered for future development:

1. **Network Aggregation:** Integration with central HamSCI data servers
2. **Multi-Station Map View:** Geographic visualization of multiple magnetometers
3. **Spectral Analysis:** FFT spectrograms for ULF wave detection (as shown in Kim et al., 2024, Fig. 8)
4. **GRAPE Integration:** Combined display with HF radio receiver data
5. **Alert System:** Notifications for significant geomagnetic events
6. **IGRF Comparison:** Overlay of International Geomagnetic Reference Field model values
7. **Mobile App:** Native iOS/Android applications

---

## 8. Acceptance Criteria

The dashboard will be considered complete when:

1. [ ] Real-time data can be displayed from a WebSocket connection to mag-usb
2. [ ] All three magnetic field components are plotted with proper HEZ labeling
3. [ ] Users can zoom and pan through historical data
4. [ ] Data can be exported to both JSONL and CSV formats
5. [ ] The interface works on Chrome and Firefox browsers
6. [ ] The system runs successfully on a Linux Computer
7. [ ] Documentation includes installation and usage instructions
8. [ ] The codebase follows consistent style and includes basic comments

---

## 9. Open Questions

The following items require team discussion and decisions:

1. **Framework Choice:** Should we extend mag-dash (vanilla JS) or use a modern framework?
2. **Charting Library:** Canvas sparklines vs. full-featured library (Chart.js, Plotly, uPlot)?
3. **Backend Runtime:** Continue with Deno or switch to Node.js for broader familiarity?
4. **Data Persistence:** Should the dashboard store data locally (IndexedDB, SQLite)?
5. **Authentication:** Is authentication needed for local deployments?
6. **Coordinate Display:** Show raw XYZ, HEZ, or both with toggle?

---

## 10. References

1. Kim, H., Witten, D., Madey, J., et al. (2024). "Citizen science: Development of a low-cost magnetometer system for a coordinated space weather monitoring." *HardwareX*, 20, e00580. https://doi.org/10.1016/j.ohx.2024.e00580

2. HamSCI PSWS Magnetometer Project: https://hamsci.org/mag_overview

3. mag-usb Software Repository: https://github.com/wittend/mag-usb

4. mag-dash Dashboard Prototype: https://github.com/wittend/mag-dash

5. PNI RM3100 Sensor Datasheet: https://www.pnisensor.com/rm3100/

---

## Document History

| Version | Date | Timestamp | Author | LLM Model | Changes |
|---------|------|-----------|--------|-----------|---------|
| 0.2 | January 22, 2026 | 2026-01-22T14:30:00Z | Nathaniel Frissell | Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) | Updated hardware references from Raspberry Pi to Linux Computer; standardized SHALL/SHOULD/MAY usage; added requirement level definitions; removed FR-HD-04; elevated offline capability requirements to Must; updated acceptance criteria to require both CSV and JSONL export |
| 0.1 | January 14, 2026 | 2026-01-14 | Nathaniel Frissell | Claude (model unknown) | Initial requirements document |

---

## Acknowledgments

This requirements document was prepared with assistance from Claude (Anthropic) using Claude Sonnet 4.5 (model: claude-sonnet-4-5-20250929), which helped synthesize information from the HardwareX paper, mag-usb repository, and mag-dash prototype into a structured requirements format.

---

*This document is intended as a starting point for team discussion. All requirements should be reviewed and prioritized before development begins.*
