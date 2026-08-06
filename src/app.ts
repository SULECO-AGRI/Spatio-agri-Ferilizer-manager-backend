import express, { Application } from "express";
import cors from "cors";
import routes from "./routes";
import { notFound } from "./middlewares/notFound";
import { errorHandler } from "./middlewares/errorHandler";

const app: Application = express();

app.use(cors());
app.use(express.json());

app.use(routes);

app.use(notFound);
app.use(errorHandler);

export default app;
