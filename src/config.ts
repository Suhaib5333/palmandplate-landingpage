// App URLs from environment variables
// Set PUBLIC_MEMBER_APP_URL and PUBLIC_API_URL in .env

const memberAppUrl = (import.meta.env.PUBLIC_MEMBER_APP_URL as string) || "https://app.palmandplate.com";
const apiUrl = (import.meta.env.PUBLIC_API_URL as string) || "https://api.palmandplate.com";

export const urls = {
  login: `${memberAppUrl}/login`,
  register: `${memberAppUrl}/register`,
  host: `${memberAppUrl}/host`,
};

export const api = {
  baseUrl: apiUrl,
};
