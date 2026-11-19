/** @type {import("next").NextConfig} */
const config = {
  output: process.env.SONA_STANDALONE === "1" ? "standalone" : undefined,
};

export default config;
