/// <reference path="../.sst/platform/config.d.ts" />

import { database } from './database';

// Start Docker Compose services (PostgreSQL)
new sst.x.DevCommand('Docker', {
  dev: {
    autostart: true,
    title: 'Docker Services',
    directory: '.',
    command: 'docker compose up',
  },
});

// Start Drizzle Studio for database management
new sst.x.DevCommand('Studio', {
  link: [database],
  dev: {
    autostart: false,
    title: 'Drizzle Studio',
    command: 'npx drizzle-kit studio',
  },
});
