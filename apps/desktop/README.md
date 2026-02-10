# @hearth/desktop

Hearth desktop app built with Tauri v2, wrapping `@hearth/web`.

## Prerequisites

- Rust toolchain (install via https://rustup.rs)
- Tauri CLI: `cargo install tauri-cli --version ^2`
- System dependencies per [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Setup

1. Install Rust and system dependencies (see prerequisites above)
2. Install Node dependencies: `pnpm install`
3. Initialize Tauri: `pnpm tauri init`
4. Start development: `pnpm tauri dev`

## Architecture

The desktop app wraps the same React SPA that powers `@hearth/web`. The Tauri
backend provides native capabilities:

- System tray with presence indicator
- Global push-to-talk hotkey
- OS-native notifications
- Auto-update mechanism
- Deep linking for invite URLs
