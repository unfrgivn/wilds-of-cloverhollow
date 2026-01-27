# iOS Build & Submission Guide

**Wilds of Cloverhollow**

Complete guide for building and submitting to the Apple App Store.

---

## Prerequisites

### Development Environment
- macOS (required for iOS builds)
- Xcode (latest stable version)
- Godot 4.x with iOS export templates installed
- Apple Developer account ($99/year)

### Required Files
- App icons (see `docs/store-assets/app-store-metadata.md`)
- Screenshots for all required device sizes
- Privacy policy URL (live website)
- Support URL (live website)

---

## Step 1: Export Templates

Install iOS export templates in Godot:

1. Open Godot Editor
2. Go to **Editor → Manage Export Templates**
3. Download or install iOS templates for your Godot version

---

## Step 2: Apple Developer Setup

### Create App ID
1. Log in to [Apple Developer Portal](https://developer.apple.com)
2. Go to **Certificates, Identifiers & Profiles**
3. Create App ID: `com.cloverstudios.wildsofcloverhollow`

### Create Provisioning Profile
1. Create Development profile for testing
2. Create Distribution profile for App Store submission

### Create App in App Store Connect
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create new app with bundle ID matching App ID
3. Fill in metadata from `docs/store-assets/app-store-metadata.md`

---

## Step 3: Godot Export Configuration

### Export Preset Settings

Create iOS export preset in Godot (**Project → Export → Add → iOS**):

```
Application:
  Bundle Identifier: com.cloverstudios.wildsofcloverhollow
  Short Version: 1.0.0
  Version: 1
  App Store Team ID: [Your Team ID]
  
Capabilities:
  (none required)

Display:
  Orientation: Landscape
  
Icons:
  App Store Icon (1024x1024): res://game/assets/icons/ios/icon_1024.png
  (Other sizes auto-generated)

Launch Screen:
  Use custom: No (use Godot default)
```

### Project Settings for iOS

Verify these settings in **Project → Project Settings**:

```
Display/Window:
  Size/Viewport Width: 512
  Size/Viewport Height: 288
  Size/Window Width Override: 1536
  Size/Window Height Override: 864
  Stretch/Mode: canvas_items
  Stretch/Aspect: keep

Rendering:
  Textures/Canvas Textures/Default Texture Filter: Nearest
```

---

## Step 4: Build Process

### Development Build (Testing)
```bash
# Export from Godot Editor
# Project → Export → iOS → Export Project
# Select Development profile
```

### Release Build (App Store)
```bash
# Export from Godot Editor
# Project → Export → iOS → Export Project
# Select Distribution profile
# Creates .xcarchive for upload
```

### Build via Xcode
1. Open exported Xcode project
2. Select "Any iOS Device" as target
3. Product → Archive
4. Upload to App Store Connect via Organizer

---

## Step 5: App Store Submission

### Pre-Submission Checklist

#### Build
- [ ] Game runs without crashes on iOS device
- [ ] All features function correctly
- [ ] Touch controls work properly
- [ ] Save/load system works
- [ ] Performance is acceptable (target 60 FPS)

#### Metadata
- [ ] App name: "Wilds of Cloverhollow"
- [ ] Subtitle: "A Cozy Pixel Adventure"
- [ ] Description filled in
- [ ] Keywords added (10 max)
- [ ] Primary category: Games > Role Playing
- [ ] Age rating: 4+
- [ ] Privacy policy URL live

#### Assets
- [ ] App icon (1024x1024) uploaded
- [ ] Screenshots for all required sizes
- [ ] App preview video (optional)

#### Legal
- [ ] Privacy policy reviewed (`docs/legal/privacy-policy.md`)
- [ ] COPPA compliance confirmed
- [ ] No third-party content requiring attribution

### Upload Build
1. Archive in Xcode
2. Upload via Xcode Organizer or Transporter app
3. Wait for processing (15-30 minutes)
4. Select build in App Store Connect

### Submit for Review
1. Complete all required metadata fields
2. Answer App Review questionnaire
3. Add notes for reviewer (if needed)
4. Submit for review

---

## Step 6: Post-Submission

### Review Timeline
- Standard review: 24-48 hours
- First submission may take longer

### Common Rejection Reasons
- Crashes or bugs
- Missing privacy policy
- Incomplete metadata
- Guideline violations

### After Approval
1. Release manually or schedule release date
2. Monitor for crashes via App Store Connect
3. Respond to user reviews

---

## Troubleshooting

### Build Errors
- Ensure export templates match Godot version
- Verify provisioning profiles are valid
- Check bundle ID matches across all configs

### Upload Errors
- Verify Team ID is correct
- Ensure certificates haven't expired
- Check for signing issues

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `docs/store-assets/app-store-metadata.md` | Store listing content |
| `docs/legal/privacy-policy.md` | Privacy policy |
| `docs/legal/data-usage-disclosure.md` | App Store privacy labels |
| `docs/legal/age-rating-preparation.md` | Age rating questionnaire |
| `game/assets/icons/ios/README.md` | Icon requirements |
| `docs/store-assets/screenshots/README.md` | Screenshot requirements |

---

*Last Updated: January 26, 2026*
