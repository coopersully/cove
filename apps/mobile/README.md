# @hearth/mobile

Hearth mobile app built with React Native 0.83 and Expo SDK 54.

## Setup

This workspace requires the full Expo toolchain. To initialize:

1. Install Expo CLI: `npm install -g expo-cli`
2. Install dependencies: `pnpm install`
3. Start the dev server: `npx expo start`

## Tech Stack

- React Native 0.83
- Expo SDK 54
- React 19.2.4
- Expo Router v6
- Zustand for client state
- TanStack Query for server state
- Nativewind for styling

## Shared Code

This app shares types, validators, API client, and gateway protocol definitions
with the web app via `@hearth/shared`, `@hearth/api-client`, and `@hearth/gateway`.
UI components are largely platform-specific due to differing navigation patterns,
gesture handling, and notification UX.
