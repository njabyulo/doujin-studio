export const computeConfig = {
  web: {
    google: {
      generative: {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      },
    },
  },
  functions: {
    remotion: {
      serveURL: process.env.REMOTION_SERVE_URL!,
    },
  },
};

export const databaseConfig = {
  postgres: {
    dev: {
      username: "postgres",
      password: "password",
      database: "local",
      host: "localhost",
      port: 5432,
      url: "postgresql://postgres:password@localhost:5432/local",
    },
    username: process.env.POSTGRES_USERNAME || "dbadmin",
    password: process.env.POSTGRES_PASSWORD || "Pssw0rd",
  },
};
