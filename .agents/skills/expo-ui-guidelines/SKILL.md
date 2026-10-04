---
name: expo-ui-guidelines
description: iOS Expo UI design standards, native SwiftUI components, SF Symbols, Liquid Glass blur effects, and Expo Router navigation patterns based on SchroederNathan/expo-ui-examples.
---

# Expo UI Guidelines & Component Reference

Use this skill whenever creating or modifying iOS screens, components, modals, buttons, or navigation in Palzee to ensure full alignment with `SchroederNathan/expo-ui-examples`.

## Key Pillars

1. **Platform Native Primitives (`@expo/ui`)**:
   - `Host`: Cross-platform host container for native UI trees.
   - `Form` & `FieldGroup`: Native settings & modal forms with iOS rounded grouping.
   - `List` & `ListItem`: Native virtualized list rows matching SwiftUI standards.

2. **Apple SF Symbols (`expo-symbols`)**:
   - Prefer native SF Symbols for system buttons, checks, arrows, and camera controls.

3. **Liquid Glass & Meta-Material Effects (`expo-blur`, `react-native-svg`)**:
   - Use standardized material variants:
     - `.regular`: Default balanced depth (45 intensity) for floating navigation pills, action buttons, and capsules.
     - `.clear`: High-transparency overlay (25 intensity) for viewfinder controls, camera buttons, and vlog media playback.
     - `.prominent`: Elevated depth (65 intensity) for modal sheets and alert dialogs.
   - Employ continuous super-ellipse squircles (`borderCurve: 'continuous'`) with concentric inner radii (`rx - strokeWidth`).
   - Dynamic multi-stop specular highlights (`#FFFFFF` with angle falloffs) without heavy opaque fills.
   - Built-in accessibility fallbacks when iOS *Reduce Transparency* is active.

4. **Fluid Navigation & Modals**:
   - Native Expo Router stack screens, sheet presentation options, and smooth tab bar pill interactions.
