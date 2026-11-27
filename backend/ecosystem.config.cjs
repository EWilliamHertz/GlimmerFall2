module.exports = {
  apps: [
    {
      name: "glimmerfall-cards",
      cwd: __dirname,
      script: ".venv/bin/uvicorn",
      args: "server:app --host 127.0.0.1 --port 8100 --workers 1",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },
  ],
};
