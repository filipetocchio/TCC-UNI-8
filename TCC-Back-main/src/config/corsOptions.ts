import { CorsRequest } from "cors";
import { allowedOrigins } from "./allowedOrigins";
import { logEvents } from "../middleware/logEvents";

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (allowedOrigins.indexOf(origin as string) !== -1 || !origin) {
      callback(null, true);
    } else {
      const errorMsg = `Origem não permitida pelo CORS: ${origin}`;
      logEvents(errorMsg, "corsErrors.txt");
      callback(new Error(errorMsg));
    }
  },
  optionsSuccessStatus: 200,
};

export { corsOptions };