# Claude AI Assistance Documentation

## Overview

This document tracks the use of Claude AI (Anthropic) in the development of the HamSCI-TAPR Magnetometer Web Dashboard project. It serves as both a historical record and a guide for future AI-assisted development sessions.

---

## Purpose

This documentation serves to:

1. **Maintain Transparency**: Record all AI contributions to the project
2. **Ensure Continuity**: Help future Claude sessions understand the project context
3. **Provide Guidelines**: Establish best practices for AI-assisted development
4. **Track Model Usage**: Document which LLM models were used and when
5. **Enable Reproducibility**: Allow others to understand how AI was used in development

---

## LLM Models Used

### Model History

| Date | Model Name | Model ID | Used For | Primary Developer |
|------|------------|----------|----------|------------------|
| January 14, 2026 | Claude (unknown) | unknown | Initial requirements document creation | Nathaniel Frissell |
| January 22, 2026 | Claude Sonnet 4.5 | claude-sonnet-4-5-20250929 | Requirements document revision and standardization | Nathaniel Frissell |

### Current Model

**Model**: Claude Sonnet 4.5
**Model ID**: claude-sonnet-4-5-20250929
**Release Date**: September 29, 2025
**Context Window**: Large (suitable for entire codebase analysis)

---

## Project Context for Claude

### Project Summary

The HamSCI-TAPR Magnetometer Web Dashboard is a real-time web-based visualization system for citizen science magnetometer data. The system processes JSON Lines data from the mag-usb acquisition software and displays three-axis magnetic field measurements in geomagnetic HEZ coordinates.

### Key Technical Details

- **Data Format**: JSON Lines (JSONL) with RFC-2822 timestamps
- **Sampling Rate**: 1 Hz
- **Sensor**: PNI RM3100 magneto-inductive sensor
- **Resolution**: ~3 nT
- **Coordinate System**: Raw XYZ transformed to geomagnetic HEZ
- **Deployment**: Local network on Linux computers (previously Raspberry Pi)

### Related Repositories

- [mag-usb](https://github.com/wittend/mag-usb) - Backend data acquisition software
- [mag-dash](https://github.com/wittend/mag-dash) - Strawman dashboard prototype

### Key Documents

- `docs/REQUIREMENTS.md` - Project requirements specification (primary reference)
- `docs/kim_hamsci_gmag_hardwarex.pdf` - HardwareX paper describing the system

---

## AI Contributions by Session

### Session 1: Initial Requirements Document
**Date**: January 14, 2026
**Model**: Claude (unknown)
**Contributor**: Nathaniel Frissell
**Scope**: Creation of initial REQUIREMENTS.md

**Activities**:
- Synthesized information from HardwareX paper, mag-usb, and mag-dash repositories
- Created structured requirements document with functional and non-functional requirements
- Defined acceptance criteria and open questions
- Established initial project scope

### Session 2: Requirements Standardization
**Date**: January 22, 2026
**Model**: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
**Contributor**: Nathaniel Frissell
**Scope**: Major revision of REQUIREMENTS.md v0.1 → v0.2

**Activities**:
- Updated hardware references from "Raspberry Pi" to "Linux Computer"
- Standardized requirement keywords (SHALL/SHOULD/MAY) to match priority levels
- Added RFC 2119-based requirement level definitions
- Removed ambiguous requirement FR-HD-04
- Elevated offline capability requirements (FR-OFF-01/02/03) from Should to Must
- Updated acceptance criteria to require both CSV and JSONL export formats
- Enhanced document history with timestamps and LLM model tracking
- Created this CLAUDE.md documentation file

---

## Guidelines for Using Claude on This Project

### Before Starting a Session

1. **Read Key Documents**: Always read `docs/REQUIREMENTS.md` first to understand project scope
2. **Check Git Status**: Review recent commits to understand current state
3. **Review This File**: Check the session history above for context

### During Development

1. **Maintain Consistency**: Follow existing code style and conventions
2. **Document Changes**: Update relevant documentation when making changes
3. **Test Incrementally**: For code changes, test each component before moving on
4. **Ask for Clarification**: When requirements are ambiguous, ask rather than assume

### Requirements Document Changes

When modifying `docs/REQUIREMENTS.md`:

1. **Update Version Number**: Bump the version (0.1 → 0.2, etc.)
2. **Update Date**: Set to the current date
3. **Update Document History**: Add a new row with:
   - Version number
   - Date
   - ISO 8601 timestamp
   - Author name
   - LLM model and ID
   - Summary of changes
4. **Maintain Consistency**: Ensure SHALL/SHOULD/MAY match Must/Should/May priorities
5. **Update This File**: Add a new session entry in the "AI Contributions by Session" section

### Code Development Best Practices

1. **Follow Offline-First**: Remember FR-OFF-01/02/03 are Must requirements
2. **Vendor Dependencies**: Never add CDN dependencies; vendor all libraries locally
3. **Support HEZ Coordinates**: Always apply coordinate transformation from raw XYZ
4. **Handle 1 Hz Updates**: Ensure real-time performance at minimum 1 Hz
5. **Export Both Formats**: Support both JSONL and CSV export (acceptance criteria)

### Communication Style

- Use clear, technical language
- Reference requirement IDs (e.g., FR-DI-01) when discussing features
- Cite line numbers when discussing code
- Provide rationale for technical decisions

---

## Instructions for Future Claude Sessions

### On First Message

1. Read `docs/REQUIREMENTS.md` to understand the project
2. Read `docs/CLAUDE.md` (this file) to understand the AI contribution history
3. Check `git log` to see recent changes
4. Ask the user what they would like to work on

### For Requirements Work

- Requirements changes should follow the format established in v0.2
- Always maintain the SHALL/SHOULD/MAY and Must/Should/May consistency
- Document all changes in the Document History section
- Update this CLAUDE.md file with session notes

### For Implementation Work

- Reference the requirements document frequently
- Prioritize Must requirements over Should requirements
- Remember the offline-first constraint (no CDN dependencies)
- Test with realistic 1 Hz data streams
- Follow the coordinate transformation: H=-Z(raw), E=Y(raw), Z=X(raw)

### For Documentation Work

- Keep documentation concise but complete
- Use RFC 2119 keywords (SHALL/SHOULD/MAY) consistently
- Include examples where helpful
- Update version history appropriately

---

## Technical Constraints to Remember

### Must-Have Features (SHALL/Must)
- WebSocket real-time data streaming
- JSONL file loading
- JSON Lines parsing
- XYZ to HEZ coordinate transformation
- Three-component time-series plots
- 1 Hz update rate
- Zoom and pan on plots
- Scrollable history table
- JSONL export
- Connection status indicators
- No external CDN dependencies
- Vendor all critical libraries locally
- Local-network-only deployment support
- Chrome, Firefox, Safari support
- Linux computer compatibility
- Well-documented code
- Clear installation documentation
- Simple command-line deployment

### Highly Desired Features (SHOULD/Should)
- MQTT-over-WebSocket support
- Configurable data source URLs
- Total field magnitude display
- Configurable time windows
- Configurable orientation transformations
- dB (baseline variations) calculation
- Moving average filtering
- CSV export
- Light and dark themes
- User preference persistence
- Tabbed interface for multiple sources
- Configuration panel
- Tablet and desktop browser support
- CSP headers
- HTTPS/WSS support
- Optional MQTT authentication
- Standard, widely-adopted technologies
- Automated tests
- Responsive design
- 1 hour buffered data responsiveness
- 3-second page load time

### Optional Features (MAY/May)
- Mini sparkline charts
- dB/dt calculations
- Configurable data retention limits
- Containerized deployment (Docker)

---

## Contact and Collaboration

**Project Lead**: Nathaniel Frissell
**Project**: HamSCI-TAPR Personal Space Weather Station (PSWS)
**Funding**: National Science Foundation

For questions about this project or the use of AI assistance, please refer to the project documentation or contact the project lead.

---

## Version History

| Version | Date | Changes | Model Used |
|---------|------|---------|------------|
| 1.0 | January 22, 2026 | Initial creation of CLAUDE.md | Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) |

---

## License and Attribution

This documentation file is part of the HamSCI-TAPR Magnetometer Web Dashboard project. All AI assistance provided by Claude (Anthropic) should be acknowledged in project documentation and publications as appropriate.

**Recommended Citation Format**:
```
This project was developed with assistance from Claude (Anthropic) AI assistant.
See docs/CLAUDE.md for detailed contribution history.
```

---

*This file should be updated after each significant Claude session to maintain an accurate record of AI contributions to the project.*