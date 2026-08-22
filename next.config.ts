/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "encrypted-tbn3.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "static0.moviewebimages.com",
      },
      {
        protocol: "https",
        hostname: "development.autofore.com",
      },
      {
        protocol: "https",
        hostname: "image.mux.com",
      },
      {
        protocol: "https",
        hostname: "images.justwatch.com",
      },
      // Videos stream from CloudFront; images are served straight from S3.
      // Allow-list both hosts accordingly.
      ...(process.env.CLOUDFRONT_BASE_URL
        ? [{
            protocol: new URL(process.env.CLOUDFRONT_BASE_URL).protocol.replace(":", "") as "http" | "https",
            hostname: new URL(process.env.CLOUDFRONT_BASE_URL).hostname,
          }]
        : []),
      ...(process.env.NEXT_PUBLIC_S3_IMAGE_HOST
        ? [{
            protocol: "https" as const,
            hostname: process.env.NEXT_PUBLIC_S3_IMAGE_HOST,
            pathname: "/cbm-images/**",
          }]
        : []),
    ],
  },
};

export default nextConfig;
