# iOS export

This project targets iOS (landscape only).

## Requirements
- macOS
- Xcode installed
- Apple developer provisioning

## Notes
- iOS simulator is not supported; test on device.

## On-device smoke checklist
- Launches into the test room without a crash.
- Virtual joystick moves the player in all directions.
- Interact button triggers the nearest interaction.
- Touch controls stay inside the safe area (no notch/home overlap).
- Render scale can be adjusted via `--render_scale` for performance checks.
