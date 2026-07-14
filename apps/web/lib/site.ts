/** One place to name the product. Change this first when you start a project. */
export const site = {
  name: "Groundwork",
  description: "A fullstack boilerplate: Next.js web + admin, NestJS API.",
  url: process.env.AUTH_URL ?? "http://localhost:3000",
} as const;
