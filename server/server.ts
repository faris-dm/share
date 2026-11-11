import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cookies from "cookie-parser";
import cors from "cors";
import signUp from "./Controllers/authController";

dotenv.config();
const app = express();
app.use(express());
app.use(cookies());
app.use(cors());
app.use(express.json());
app.use("/api/", signUp);

app.get("/", (req, res) => {
  console.log("server is running ");
  res.status(200).json(" the page is working");
});

const port = process.env.port;

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
