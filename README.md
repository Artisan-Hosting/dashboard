# Dashboard Desktop

This repository includes a [Tauri](https://tauri.app) configuration that wraps the existing Next.js frontend to produce a Linux desktop application.

## Development

1. Install frontend dependencies:
   ```sh
   npm install --prefix frontend
   ```
2. Start the desktop app in development mode:
   ```sh
   cargo tauri dev
   ```
   This command runs the Next.js development server and opens it inside a Tauri window.

## Building

To create a release bundle for Linux run:
```sh
cargo tauri build
```
This builds the frontend using `npm run export` and packages the output using Tauri.
