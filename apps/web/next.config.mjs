import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Enable HSTS in production — reverse proxy must terminate TLS
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        // All routes except /embed/* (which must be embeddable in partner sites)
        source: "/((?!embed/).*)",
        headers: [
          ...SECURITY_HEADERS,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // Embed pages: allow cross-origin framing, still apply basic headers
        source: "/embed/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  experimental: {
    // Workspace packages are TypeScript source — let Next transpile them.
    externalDir: true,
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  },
  transpilePackages: [
    "@unisi/agnic",
    "@unisi/ai",
    "@unisi/audit",
    "@unisi/db",
    "@unisi/email",
    "@unisi/pdf",
    "@unisi/shared",
    "@unisi/storage",
    "@unisi/ui",
  ],
  webpack: (config, { isServer }) => {
    // Resolve the "@/*" path alias explicitly (some build environments do
    // not pick it up from tsconfig paths reliably).
    config.resolve = config.resolve || {};
    config.resolve.alias = { ...(config.resolve.alias || {}), "@": path.resolve(__dirname, "src") };
    if (isServer) {
      // @napi-rs/canvas ships per-platform .node binaries; webpack can't bundle
      // them, so we leave it as an external require'd at runtime.
      const externals = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean);
      externals.push({
        "@napi-rs/canvas": "commonjs @napi-rs/canvas",
      });
      config.externals = externals;
    }
    return config;
  },
};

export default nextConfig;
