# ProCamera

A powerful mobile camera app with 120x digital zoom, photo editing tools, filters, and background effects.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo dev server
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- Scan QR code from the Replit URL bar with Expo Go to test on a physical device

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo 54 + Expo Router (file-based routing)
- State: AsyncStorage (local photo history), React Query
- Camera: expo-camera (CameraView with digital zoom)
- Photo editing: expo-image-manipulator (rotate, flip)
- Media saving: expo-media-library
- UI: react-native-reanimated, expo-linear-gradient, expo-haptics

## Where things live

- `artifacts/mobile/app/(tabs)/index.tsx` — Main camera screen (120x zoom, flash, grid, capture)
- `artifacts/mobile/app/edit.tsx` — Photo editing (filters, brightness, background, rotate/flip)
- `artifacts/mobile/app/gallery.tsx` — Photo gallery (grid view, full-screen viewer, save/delete)
- `artifacts/mobile/constants/colors.ts` — Dark camera theme tokens (cyan primary, deep black)
- `artifacts/mobile/app.json` — Expo config with camera/media permissions

## Product

- **120x Digital Zoom**: Smooth zoom from 1x to 120x via swipe gesture or preset buttons (1×, 2×, 5×, 10×, 30×, 60×, 120×)
- **Photo Capture**: High-quality capture with haptic feedback and thumbnail preview
- **Photo Editing**: 8 visual filters (Warm, Cool, Fade, Drama, Vintage, Noir, Vivid), brightness adjustment, rotate & flip via expo-image-manipulator
- **Background Change**: 8 gradient background presets (Night, Ocean, Forest, Sunset, Rose, Cosmic, Gold, Ice)
- **Gallery**: Full-screen photo viewer with edit, save to library, and delete options
- **Flash Control**: Off / On / Auto toggle
- **Composition Grid**: Rule-of-thirds overlay

## User preferences

- APK via EAS Build: User provided EXPO_TOKEN for EAS. For Android APK, use EAS CLI outside Replit: `npx eas build -p android --profile preview`
- App is dark-themed with electric cyan (#00D4FF) primary color

## Architecture decisions

- Camera app uses Stack navigation (no tab bar) for a clean full-screen camera UX
- Digital zoom is mapped linearly: zoom_native = (displayZoom - 1) / 119
- Photo history stored in AsyncStorage (up to 200 photos), keyed as `photos`
- Filter effects implemented as colored View overlays (no native library needed, Expo Go compatible)
- Background change applies LinearGradient behind the image frame in edit screen

## Gotchas

- `expo-camera` zoom range on device: 0–1 (actual optical range varies by hardware; max zoom = maximum digital zoom of the device)
- Web preview shows permission screen (no camera in browser) — scan QR code to test on device
- For EAS Build (APK download): run `eas build -p android --profile preview` from local machine with EXPO_TOKEN set
