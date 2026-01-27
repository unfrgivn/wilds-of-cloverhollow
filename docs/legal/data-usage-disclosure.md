# Data Usage Disclosure

**Wilds of Cloverhollow**

This document summarizes data practices for App Store submission requirements.

---

## Data Collection Summary

| Data Type | Collected? | Purpose |
|-----------|------------|---------|
| Personal Information | ❌ No | N/A |
| Location Data | ❌ No | N/A |
| Contact Information | ❌ No | N/A |
| Device Identifiers | ❌ No | N/A |
| Usage Analytics | ❌ No | Stub only, no transmission |
| Crash Reports | ❌ No | Local logs only, no transmission |
| Game Progress | ✅ Yes (Local) | Save/load functionality |
| Settings | ✅ Yes (Local) | User preferences |

---

## App Store Privacy Label

For the Apple App Store privacy "nutrition label":

**Data Not Collected**
- We do not collect any data from this app.

**Data Not Linked to You**
- N/A (no data collected)

**Data Used to Track You**
- N/A (no tracking)

---

## Local Storage Details

The following data is stored **locally on the device only**:

### Save Files (`user://saves/`)
- Game progress (current area, position)
- Inventory (tools, items)
- Story progression flags
- Quest status

### Settings (`user://settings.json`)
- Audio volume levels
- Text size preference
- Touch control size
- Language preference

### Achievement Progress (`user://achievements.json`)
- Unlocked achievements
- Progress counters

### Collection Progress (`user://collection_log.json`)
- Fish/bug collection status
- Milestone completion

### Tutorial State (`user://tutorial_hints.json`)
- Which hints have been shown

---

## Third-Party SDKs

| SDK | Purpose | Data Collected |
|-----|---------|----------------|
| None | N/A | N/A |

The game does not include any third-party analytics, advertising, or tracking SDKs.

---

## COPPA Compliance

✅ **Compliant** - Designed for children 8-12

- No account creation required
- No personal data collection
- No online features requiring data transmission
- No advertising
- No in-app purchases

---

## Contact

For privacy inquiries: privacy@cloverhollow.example.com

---

*Last Updated: January 26, 2026*
