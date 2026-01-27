/// <reference path="../.sst/platform/config.d.ts" />

export const devDocker = new sst.x.DevCommand("Docker", {
  dev: {
    autostart: true,
    title: "Docker Services",
    directory: ".",
    command: "docker compose up",
  },
});

// new sst.x.DevCommand('Studio', {
//   link: [database],
//   dev: {
//     autostart: false,
//     title: 'Drizzle Studio',
//     command: 'npx drizzle-kit studio',
//   },
// });

export const devDependencies = new sst.x.DevCommand("DevDependencies", {
  dev: {
    autostart: true,
    command: "turbo dev --filter='!web'",
    directory: ".",
  },
});
