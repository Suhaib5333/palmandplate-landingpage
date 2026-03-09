// App URLs per environment
// Set VITE_APP_ENV in .env to switch: "dev" | "uat" | "prod" (defaults to "prod")

const env = (import.meta.env.VITE_APP_ENV as string) || "prod";

const appBaseUrls: Record<string, string> = {
  dev: "http://localhost:5173",
  uat: "https://uat.palmandplate.com",
  prod: "https://app.palmandplate.com",
};

const appBase = appBaseUrls[env] || appBaseUrls.prod;

export const urls = {
  login: `${appBase}/login`,
  register: `${appBase}/register`,
};
