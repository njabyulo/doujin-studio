// PostgreSQL configuration
export const database = new sst.aws.Postgres('Database', {
  dev: {
    username: 'postgres',
    password: 'password',
    database: 'local',
    host: 'localhost',
    port: 5432,
  },
});
