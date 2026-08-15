import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";


const app: Express = express();


const isProduction = process.env.NODE_ENV === "production";


app.set("trust proxy", 1);


app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = new Set(
  [process.env.APP_ORIGIN, ...(process.env.CORS_ALLOWED_ORIGINS ?? '').split(',')]
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean),
);

app.use(cors({
  origin(origin, callback) {
    // Same-origin and server-to-server requests have no Origin header.
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));


if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}


app.use(
  session({
    name: "kc_admin_sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12,
    },
  }),
);


app.use("/api", router);


export default app;
Footer
© 2026 GitHub, Inc.
