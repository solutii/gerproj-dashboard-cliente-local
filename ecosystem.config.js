const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'dashboard',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001 -H 0.0.0.0',
      instances: 2,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      
      // Memória
      max_memory_restart: '400M', // Reduzi para 400M (você tem pouca RAM)
      node_args: '--max-old-space-size=384', // Ajustado proporcionalmente
      
      // Restarts e timeouts
      min_uptime: '10s', // Considera "online" após 10s
      max_restarts: 15, // Permite mais restarts
      restart_delay: 2000, // Espera 2s entre restarts
      exp_backoff_restart_delay: 100, // Backoff exponencial
      
      // Timeouts para evitar travamentos
      kill_timeout: 5000, // Força kill após 5s
      listen_timeout: 10000, // Timeout para app começar a escutar
      
      // Restart programado (previne memory leaks)
      cron_restart: '0 3 * * *', // Reinicia todo dia às 3h da manhã
      
      // Logs
      error_file: path.join(__dirname, 'logs', 'error.log'),
      out_file: path.join(__dirname, 'logs', 'out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Variáveis de ambiente
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        
        // Otimizações Next.js
        NEXT_TELEMETRY_DISABLED: '1', // Desabilita telemetria
        
        // Firebird
        DATABASE_URL: process.env.DATABASE_URL,
        FIREBIRD_HOST: process.env.FIREBIRD_HOST,
        FIREBIRD_PORT: process.env.FIREBIRD_PORT,
        FIREBIRD_DATABASE: process.env.FIREBIRD_DATABASE,
        FIREBIRD_USER: process.env.FIREBIRD_USER,
        FIREBIRD_PASSWORD: process.env.FIREBIRD_PASSWORD,
      },
    },
  ],
};