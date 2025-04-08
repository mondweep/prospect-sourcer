# Use an official Deno image
# Check https://hub.docker.com/r/denoland/deno for available tags
FROM denoland/deno:1.42.1

# Set working directory
WORKDIR /app

# Expose the port the app runs on (adjust if different in main.ts)
EXPOSE 8000

# --- Dependency Caching (Optional but Recommended) ---
# Cache dependencies before copying the full source code.
# This layer is rebuilt only when dependencies change.
COPY deno.jsonc deno.lock import_map.json ./
# Cache the dependencies listed in deno.jsonc/import_map.json
# The --no-check flag might be needed if type checking fails without full source
# Use --reload if you want to force re-fetching dependencies
RUN deno cache --reload --no-check src/main.ts

# --- Application Code ---
# Copy the rest of the application code
# Ensure .dockerignore excludes unnecessary files (.git, .env, .credentials, etc.)
COPY src/ ./src/
COPY public/ ./public/

# --- Environment Variables ---
# These need to be provided at runtime (`docker run -e ...`)
# GOOGLE_CREDENTIALS_JSON: The JSON content of the service account key file.
# (Optional: Add other ENV vars your app might need)
# ENV PORT=8000 # Example if you want to make port configurable

# --- Run the Application ---
# Command to run the application using the 'start' task defined in deno.jsonc
# The user needs to be 'deno' for security best practices if not running rootless
USER deno
CMD ["deno", "task", "start"]
