module.exports = {
  apps: [
    {
      name: 'markd-backend',
      script: 'main.py',
      cwd: './backend',
      interpreter: 'python3',
      env: {
        PYTHONUNBUFFERED: '1'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'markd-mcp',
      script: 'mcp_server.py',
      cwd: './backend',
      interpreter: 'python3',
      env: {
        PYTHONUNBUFFERED: '1'
      },
      error_file: './logs/mcp-error.log',
      out_file: './logs/mcp-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    },
    {
      name: 'markd-frontend',
      script: 'npm',
      args: 'run dev -- --port 5173 --host 0.0.0.0',
      cwd: './frontend',
      interpreter: 'none',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};